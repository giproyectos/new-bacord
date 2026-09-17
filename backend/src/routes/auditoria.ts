import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db/prisma.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors.js'
import { actorDe } from '../services/audit.js'

export const auditoriaRouter = Router()

// Se deja sin gate de módulo (solo requireAuth): el registro (POST) lo disparan flujos de
// otros módulos y nunca debe fallar por permisos, y la consulta (GET) también se usa de forma
// acotada por idEntidad desde dentro de Batch Record (panel de auditoría embebido), no solo
// desde la pantalla de Consulta de Auditoría. El módulo 'auditoria' solo controla si esa
// pantalla aparece en el menú.
const LIMITE_POR_DEFECTO = 500
const LIMITE_MAXIMO = 5000

auditoriaRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { entidad, idEntidad, limite } = req.query
    const where: Record<string, unknown> = {}
    if (typeof entidad === 'string' && entidad) where.entidad = entidad
    if (typeof idEntidad === 'string' && idEntidad) where.idEntidad = idEntidad
    // La pantalla de Consulta de Auditoría trae todo el historial (sin `entidad`/`idEntidad`) para
    // filtrar y resumir del lado del cliente — con un límite fijo de 500, un historial más largo
    // que eso quedaba invisible en pantalla sin ningún aviso, aunque los datos seguían intactos
    // en la base de datos. `limite` deja pedir más (acotado a LIMITE_MAXIMO para no forzar una
    // consulta sin fondo); el panel embebido en un Batch Record no lo necesita y sigue usando
    // el valor por defecto.
    const take = Math.min(LIMITE_MAXIMO, Math.max(1, Number(limite) || LIMITE_POR_DEFECTO))

    const entries = await prisma.auditEntry.findMany({ where, orderBy: { timestamp: 'desc' }, take })
    res.json(entries.map((e) => ({ ...e, cambios: e.cambios ? JSON.parse(e.cambios) : undefined })))
  })
)

const cambioSchema = z.object({ campo: z.string(), etiqueta: z.string(), valorAnterior: z.string(), valorNuevo: z.string() })

// Solo estas combinaciones entidad+acción llegan hoy desde el cliente (ver useAudit.ts y sus
// usos: cerrar sesión, registrar acceso a un Batch Record, y anotar un paquete multi-lote).
// Cualquier otra acción de negocio (firmar, cancelar, derogar, liberar, cerrar una etapa,
// modificar un Detalle...) la registra el propio backend, dentro de la misma transacción que
// hace el cambio real — nunca a través de este endpoint genérico. Permitir aquí cualquier
// combinación dejaría a cualquier usuario autenticado fabricar una entrada de auditoría para
// una acción que nunca ocurrió.
const registrarSchema = z.object({
  entidad: z.enum(['BatchRecord', 'Sesion']),
  idEntidad: z.union([z.string(), z.number()]),
  descripcionEntidad: z.string(),
  accion: z.enum(['CREAR', 'MODIFICAR', 'LOGOUT']),
  modulo: z.string(),
  cambios: z.array(cambioSchema).optional(),
  motivo: z.string().optional(),
})

auditoriaRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = registrarSchema.safeParse(req.body)
    if (!parsed.success) throw new ValidationError(parsed.error.message)
    const { cambios, idEntidad, entidad, accion, descripcionEntidad, modulo, motivo } = parsed.data

    if (entidad === 'Sesion') {
      if (accion !== 'LOGOUT') throw new ValidationError('Esa acción no es válida para la entidad Sesion')
      // Evita que un usuario registre un cierre de sesión atribuido a otro idUsuario.
      if (String(idEntidad) !== String(req.auth!.idUsuario)) {
        throw new ForbiddenError('No puede registrar el cierre de sesión de otro usuario')
      }
    } else {
      if (accion === 'LOGOUT') throw new ValidationError('Esa acción no es válida para la entidad BatchRecord')
      // El idEntidad debe ser un Batch Record real — evita anotar auditoría sobre un id inventado.
      const existe = await prisma.batchRecord.findUnique({ where: { idBatchRecord: Number(idEntidad) } })
      if (!existe) throw new NotFoundError('Ese Batch Record no existe')
    }

    // El actor se deriva siempre de la sesión autenticada (req.auth), nunca del body — antes se
    // podía enviar un `firmante` arbitrario y este endpoint lo aceptaba sin verificarlo contra
    // la sesión real, permitiendo que cualquier usuario autenticado falsificara una entrada de
    // auditoría atribuida a otra persona (incluso a un administrador).
    const actor = await actorDe(prisma, req.auth!.idUsuario)

    const entry = await prisma.auditEntry.create({
      data: {
        entidad, accion, descripcionEntidad, modulo, motivo,
        idEntidad: String(idEntidad),
        idUsuario: actor.idUsuario || null,
        nombreUsuario: actor.nombreUsuario,
        loginUsuario: actor.loginUsuario,
        cargo: actor.cargo,
        cambios: cambios ? JSON.stringify(cambios) : null,
      },
    })
    res.status(201).json(entry)
  })
)

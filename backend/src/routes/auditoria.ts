import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db/prisma.js'
import { requireModulo } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors.js'
import { actorDe } from '../services/audit.js'
import { ENTIDADES_DE_BR } from '../constants/auditoria.js'

export const auditoriaRouter = Router()

// El router se monta solo con requireAuth (sin gate de módulo): el registro (POST) lo disparan
// flujos de otros módulos y nunca debe fallar por permisos. La consulta (GET) sí necesita
// distinguir dos usos muy distintos — ver el gate inline dentro de ese handler.
const LIMITE_POR_DEFECTO = 500
const LIMITE_MAXIMO = 5000

auditoriaRouter.get(
  '/',
  asyncHandler(async (req, res, next) => {
    const { entidad, idEntidad } = req.query
    const idQ = typeof idEntidad === 'string' && idEntidad ? idEntidad : undefined
    const entidadQ = typeof entidad === 'string' && entidad ? entidad : undefined
    // Volcado general (sin idEntidad): hasta 5000 filas de todo el sistema — requiere el módulo
    // 'auditoria', igual que cualquier pantalla de consulta.
    if (!idQ) return requireModulo('auditoria')(req, res, next)
    // Historial de un registro de Batch Record puntual (panel embebido): idEntidad es un
    // idBatchRecord, así que basta con poder abrir Batch Records — el mismo control con que la
    // app protege esas pantallas (ver app.ts).
    if (!entidadQ || ENTIDADES_DE_BR.includes(entidadQ)) {
      return requireModulo('batch-records')(req, res, next)
    }
    // Cualquier otra entidad (p. ej. Sesion, cuyo idEntidad es un idUsuario) es información de
    // administración general — requiere el módulo 'auditoria'.
    return requireModulo('auditoria')(req, res, next)
  }),
  asyncHandler(async (req, res) => {
    const { entidad, idEntidad, limite } = req.query
    const where: Record<string, unknown> = {}
    if (typeof entidad === 'string' && entidad) where.entidad = entidad
    // Sin `entidad` explícita, un idEntidad solo puede traer entidades de Batch Record: un
    // número como idUsuario coincide también con Sesion, y eso no debe salir por esta vía.
    if (typeof idEntidad === 'string' && idEntidad) {
      where.idEntidad = idEntidad
      if (!where.entidad) where.entidad = { in: [...ENTIDADES_DE_BR] }
    }
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

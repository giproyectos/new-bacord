import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db/prisma.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ValidationError } from '../utils/errors.js'

export const auditoriaRouter = Router()

// Se deja sin gate de módulo (solo requireAuth): el registro (POST) lo disparan flujos de
// otros módulos y nunca debe fallar por permisos, y la consulta (GET) también se usa de forma
// acotada por idEntidad desde dentro de Batch Record (panel de auditoría embebido), no solo
// desde la pantalla de Consulta de Auditoría. El módulo 'auditoria' solo controla si esa
// pantalla aparece en el menú.
auditoriaRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { entidad, idEntidad } = req.query
    const where: Record<string, unknown> = {}
    if (typeof entidad === 'string' && entidad) where.entidad = entidad
    if (typeof idEntidad === 'string' && idEntidad) where.idEntidad = idEntidad

    const entries = await prisma.auditEntry.findMany({ where, orderBy: { timestamp: 'desc' }, take: 500 })
    res.json(entries.map((e) => ({ ...e, cambios: e.cambios ? JSON.parse(e.cambios) : undefined })))
  })
)

const cambioSchema = z.object({ campo: z.string(), etiqueta: z.string(), valorAnterior: z.string(), valorNuevo: z.string() })

const registrarSchema = z.object({
  entidad: z.enum(['BatchRecord', 'DetalleValores', 'FirmaSeccion', 'FirmaCierre', 'Sesion']),
  idEntidad: z.union([z.string(), z.number()]),
  descripcionEntidad: z.string(),
  accion: z.enum(['CREAR', 'MODIFICAR', 'CANCELAR', 'FIRMAR_SECCION', 'FIRMAR_CIERRE', 'DEROGAR_FIRMA', 'LIBERAR_LOTE', 'LOGIN', 'LOGIN_FALLIDO', 'LOGOUT']),
  modulo: z.string(),
  cambios: z.array(cambioSchema).optional(),
  motivo: z.string().optional(),
  firmante: z.object({ idUsuario: z.number().int(), nombreUsuario: z.string(), loginUsuario: z.string(), cargo: z.string() }).optional(),
})

auditoriaRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = registrarSchema.safeParse(req.body)
    if (!parsed.success) throw new ValidationError(parsed.error.message)
    const { firmante, cambios, idEntidad, ...rest } = parsed.data

    let actor = firmante
    if (!actor) {
      const usuario = await prisma.usuario.findUnique({ where: { idUsuario: req.auth!.idUsuario } })
      actor = usuario
        ? { idUsuario: usuario.idUsuario, nombreUsuario: `${usuario.nombres} ${usuario.apellidos}`, loginUsuario: usuario.login, cargo: 'Usuario' }
        : { idUsuario: 0, nombreUsuario: 'Sin identificar', loginUsuario: 'desconocido', cargo: 'Sin sesión activa' }
    }

    const entry = await prisma.auditEntry.create({
      data: {
        ...rest,
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

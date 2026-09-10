import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db/prisma.js'
import { requireModuloEditar } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { NotFoundError, ValidationError } from '../utils/errors.js'
import { logAudit, actorDe } from '../services/audit.js'

export const desviacionesRouter = Router()

const usuarioSelect = { select: { nombres: true, apellidos: true, login: true } }
const include = { usuarioReporta: usuarioSelect, usuarioCierra: usuarioSelect }

desviacionesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { idBatchRecord } = req.query
    const where: Record<string, unknown> = {}
    if (typeof idBatchRecord === 'string' && idBatchRecord) where.idBatchRecord = Number(idBatchRecord)
    res.json(await prisma.desviacion.findMany({ where, include, orderBy: { fechaHora: 'desc' } }))
  })
)

const crearSchema = z.object({
  idBatchRecord: z.number().int(),
  idDetalle: z.number().int(),
  campo: z.string().min(1),
  labelCampo: z.string().min(1),
  valorIngresado: z.string(),
  limiteInfo: z.string(),
  descripcion: z.string().min(1),
})

desviacionesRouter.post(
  '/',
  requireModuloEditar('batch-records'),
  asyncHandler(async (req, res) => {
    const parsed = crearSchema.safeParse(req.body)
    if (!parsed.success) throw new ValidationError(parsed.error.message)
    const detalle = await prisma.detalle.findUnique({ where: { id: parsed.data.idDetalle } })
    if (!detalle) throw new NotFoundError('Detalle no encontrado')

    const desviacion = await prisma.$transaction(async (tx) => {
      const creada = await tx.desviacion.create({
        data: { ...parsed.data, idUsuarioReporta: req.auth!.idUsuario },
        include,
      })
      await logAudit(tx, {
        entidad: 'Desviacion', idEntidad: creada.id,
        descripcionEntidad: `BR-${parsed.data.idBatchRecord} · ${detalle.descripcion} · ${parsed.data.labelCampo}`,
        accion: 'REGISTRAR_DESVIACION', modulo: 'batch-record', motivo: parsed.data.descripcion,
        actor: await actorDe(tx, req.auth!.idUsuario),
      })
      return creada
    })
    res.status(201).json({ estado: true, mensaje: 'Desviación registrada', datos: desviacion })
  })
)

const cerrarSchema = z.object({ observacionCierre: z.string().min(1) })

desviacionesRouter.post(
  '/:id/cerrar',
  requireModuloEditar('batch-records'),
  asyncHandler(async (req, res) => {
    const parsed = cerrarSchema.safeParse(req.body)
    if (!parsed.success) throw new ValidationError(parsed.error.message)
    const id = Number(req.params.id)
    const existente = await prisma.desviacion.findUnique({ where: { id } })
    if (!existente) throw new NotFoundError('Desviación no encontrada')

    const desviacion = await prisma.desviacion.update({
      where: { id },
      data: {
        estado: 'cerrada',
        observacionCierre: parsed.data.observacionCierre,
        fechaCierre: new Date(),
        idUsuarioCierre: req.auth!.idUsuario,
      },
      include,
    })
    res.json({ estado: true, mensaje: 'Desviación cerrada', datos: desviacion })
  })
)

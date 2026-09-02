import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db/prisma.js'
import { requireModuloEditar } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { NotFoundError, ValidationError } from '../utils/errors.js'
import { logAudit, actorDe, diffObjetos, type AuditCambio } from '../services/audit.js'

export const estrategiasFirmaRouter = Router()

const include = { firmas: { orderBy: { orden: 'asc' as const }, include: { firma: { include: { grupo: true } } } } }

const ETIQUETAS = { codigo: 'Código', descripcion: 'Descripción', activo: 'Activo', gruposDerogacion: 'Grupos que pueden derogar' }

estrategiasFirmaRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await prisma.estrategiaFirma.findMany({ include, orderBy: { codigo: 'asc' } }))
  })
)

const itemSchema = z.object({
  idFirma: z.number().int(),
  texto: z.string().min(1),
  orden: z.number().int(),
  activo: z.boolean().optional(),
})

const estrategiaSchema = z.object({
  codigo: z.string().min(1),
  descripcion: z.string().min(1),
  activo: z.boolean().optional(),
  gruposDerogacion: z.array(z.string()).optional(),
  firmas: z.array(itemSchema),
})

estrategiasFirmaRouter.post(
  '/',
  requireModuloEditar('estrategias-firma'),
  asyncHandler(async (req, res) => {
    const parsed = estrategiaSchema.safeParse(req.body)
    if (!parsed.success) throw new ValidationError(parsed.error.message)
    const { firmas, gruposDerogacion, ...rest } = parsed.data

    const estrategia = await prisma.$transaction(async (tx) => {
      const creada = await tx.estrategiaFirma.create({
        data: {
          ...rest,
          usuarioCreacion: req.auth!.login,
          gruposDerogacion: gruposDerogacion?.join(',') ?? null,
          firmas: { create: firmas },
        },
        include,
      })
      await logAudit(tx, {
        entidad: 'EstrategiaFirma', idEntidad: creada.id, descripcionEntidad: `${creada.codigo} — ${creada.descripcion}`,
        accion: 'CREAR', modulo: 'estrategias-firma', actor: await actorDe(tx, req.auth!.idUsuario),
      })
      return creada
    })
    res.status(201).json({ estado: true, mensaje: 'Estrategia de firma creada', datos: estrategia })
  })
)

estrategiasFirmaRouter.put(
  '/:id',
  requireModuloEditar('estrategias-firma'),
  asyncHandler(async (req, res) => {
    const parsed = estrategiaSchema.partial().safeParse(req.body)
    if (!parsed.success) throw new ValidationError(parsed.error.message)
    const { firmas, gruposDerogacion, ...rest } = parsed.data
    const id = Number(req.params.id)

    const anterior = await prisma.estrategiaFirma.findUnique({ where: { id }, include })
    if (!anterior) throw new NotFoundError('Estrategia de firma no encontrada')

    const estrategia = await prisma.$transaction(async (tx) => {
      if (firmas) {
        await tx.estrategiaFirmaItem.deleteMany({ where: { idEstrategiaFirma: id } })
      }
      const actualizada = await tx.estrategiaFirma.update({
        where: { id },
        data: {
          ...rest,
          ...(gruposDerogacion !== undefined ? { gruposDerogacion: gruposDerogacion.join(',') } : {}),
          ...(firmas ? { firmas: { create: firmas } } : {}),
        },
        include,
      })

      const cambios: AuditCambio[] = diffObjetos(
        { ...anterior, gruposDerogacion: anterior.gruposDerogacion },
        { ...rest, ...(gruposDerogacion !== undefined ? { gruposDerogacion: gruposDerogacion.join(',') } : {}) },
        ETIQUETAS
      )
      if (firmas) {
        const antesTxt = anterior.firmas.map((f) => f.firma.codigo).join(', ') || '—'
        const despuesTxt = actualizada.firmas.map((f) => f.firma.codigo).join(', ') || '—'
        if (antesTxt !== despuesTxt) {
          cambios.push({ campo: 'firmas', etiqueta: 'Firmas asignadas', valorAnterior: antesTxt, valorNuevo: despuesTxt })
        }
      }
      if (cambios.length > 0) {
        await logAudit(tx, {
          entidad: 'EstrategiaFirma', idEntidad: id, descripcionEntidad: `${actualizada.codigo} — ${actualizada.descripcion}`,
          accion: 'MODIFICAR', modulo: 'estrategias-firma', cambios, actor: await actorDe(tx, req.auth!.idUsuario),
        })
      }
      return actualizada
    })
    res.json({ estado: true, mensaje: 'Estrategia de firma actualizada', datos: estrategia })
  })
)

estrategiasFirmaRouter.delete(
  '/:id',
  requireModuloEditar('estrategias-firma'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    const anterior = await prisma.estrategiaFirma.findUnique({ where: { id } })
    if (!anterior) throw new NotFoundError('Estrategia de firma no encontrada')

    await prisma.$transaction(async (tx) => {
      await tx.estrategiaFirma.update({ where: { id }, data: { activo: false } })
      await logAudit(tx, {
        entidad: 'EstrategiaFirma', idEntidad: id, descripcionEntidad: `${anterior.codigo} — ${anterior.descripcion}`,
        accion: 'MODIFICAR', modulo: 'estrategias-firma',
        cambios: [{ campo: 'activo', etiqueta: 'Activo', valorAnterior: 'true', valorNuevo: 'false' }],
        actor: await actorDe(tx, req.auth!.idUsuario),
      })
    })
    res.json({ estado: true, mensaje: 'Estrategia de firma desactivada' })
  })
)

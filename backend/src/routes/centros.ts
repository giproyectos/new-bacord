import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db/prisma.js'
import { requireModuloEditar } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ValidationError, NotFoundError } from '../utils/errors.js'
import { logAudit, actorDe, diffObjetos } from '../services/audit.js'

export const centrosRouter = Router()

const ETIQUETAS = { codigo: 'Código', descripcion: 'Descripción', direccion: 'Dirección', activo: 'Activo' }

centrosRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await prisma.centro.findMany({ orderBy: { codigo: 'asc' } }))
  })
)

const centroSchema = z.object({
  codigo: z.string().min(1),
  descripcion: z.string().min(1),
  direccion: z.string().optional(),
  activo: z.boolean().optional(),
})

centrosRouter.post(
  '/',
  requireModuloEditar('centros'),
  asyncHandler(async (req, res) => {
    const parsed = centroSchema.safeParse(req.body)
    if (!parsed.success) throw new ValidationError(parsed.error.message)
    const centro = await prisma.$transaction(async (tx) => {
      const creado = await tx.centro.create({ data: parsed.data })
      await logAudit(tx, {
        entidad: 'Centro', idEntidad: creado.id, descripcionEntidad: `${creado.codigo} — ${creado.descripcion}`,
        accion: 'CREAR', modulo: 'centros', actor: await actorDe(tx, req.auth!.idUsuario),
      })
      return creado
    })
    res.status(201).json({ estado: true, mensaje: 'Centro creado', datos: centro })
  })
)

centrosRouter.put(
  '/:id',
  requireModuloEditar('centros'),
  asyncHandler(async (req, res) => {
    const parsed = centroSchema.partial().safeParse(req.body)
    if (!parsed.success) throw new ValidationError(parsed.error.message)
    const id = Number(req.params.id)
    const anterior = await prisma.centro.findUnique({ where: { id } })
    if (!anterior) throw new NotFoundError('Centro no encontrado')

    const centro = await prisma.$transaction(async (tx) => {
      const actualizado = await tx.centro.update({ where: { id }, data: parsed.data })
      const cambios = diffObjetos(anterior, parsed.data, ETIQUETAS)
      if (cambios.length > 0) {
        await logAudit(tx, {
          entidad: 'Centro', idEntidad: id, descripcionEntidad: `${actualizado.codigo} — ${actualizado.descripcion}`,
          accion: 'MODIFICAR', modulo: 'centros', cambios, actor: await actorDe(tx, req.auth!.idUsuario),
        })
      }
      return actualizado
    })
    res.json({ estado: true, mensaje: 'Centro actualizado', datos: centro })
  })
)

centrosRouter.delete(
  '/:id',
  requireModuloEditar('centros'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    const anterior = await prisma.centro.findUnique({ where: { id } })
    if (!anterior) throw new NotFoundError('Centro no encontrado')

    await prisma.$transaction(async (tx) => {
      await tx.centro.update({ where: { id }, data: { activo: false } })
      await logAudit(tx, {
        entidad: 'Centro', idEntidad: id, descripcionEntidad: `${anterior.codigo} — ${anterior.descripcion}`,
        accion: 'MODIFICAR', modulo: 'centros',
        cambios: [{ campo: 'activo', etiqueta: 'Activo', valorAnterior: 'true', valorNuevo: 'false' }],
        actor: await actorDe(tx, req.auth!.idUsuario),
      })
    })
    res.json({ estado: true, mensaje: 'Centro desactivado' })
  })
)

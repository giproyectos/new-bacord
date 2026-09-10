import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db/prisma.js'
import { requireModuloEditar } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ValidationError, NotFoundError } from '../utils/errors.js'
import { logAudit, actorDe, diffObjetos } from '../services/audit.js'

export const procesosRouter = Router()

const ETIQUETAS = { codigo: 'Código', descripcion: 'Descripción', orden: 'Orden', activo: 'Activo', idMaterial: 'Material' }

procesosRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { idMaterial } = req.query
    const where: Record<string, unknown> = {}
    if (typeof idMaterial === 'string' && idMaterial) where.idMaterial = Number(idMaterial)
    res.json(await prisma.proceso.findMany({ where, orderBy: { orden: 'asc' } }))
  })
)

const procesoSchema = z.object({
  idMaterial: z.number().int(),
  codigo: z.string().min(1),
  descripcion: z.string().min(1),
  orden: z.number().int().optional(),
  activo: z.boolean().optional(),
})

// Los procesos (etapas de manufactura) solo se definen sobre Producto Terminado — un insumo
// (empaque, envase, excipiente, principio activo) se consume en un proceso, no tiene los suyos.
async function assertProductoTerminado(idMaterial: number) {
  const material = await prisma.material.findUnique({ where: { id: idMaterial } })
  if (!material) throw new NotFoundError('Material no encontrado')
  if (material.tipo !== 'PRODUCTO_TERMINADO') {
    throw new ValidationError('Los procesos solo se pueden definir sobre un material de tipo Producto Terminado')
  }
}

procesosRouter.post(
  '/',
  requireModuloEditar('procesos'),
  asyncHandler(async (req, res) => {
    const parsed = procesoSchema.safeParse(req.body)
    if (!parsed.success) throw new ValidationError(parsed.error.message)
    await assertProductoTerminado(parsed.data.idMaterial)
    const proceso = await prisma.$transaction(async (tx) => {
      const creado = await tx.proceso.create({ data: parsed.data })
      await logAudit(tx, {
        entidad: 'Proceso', idEntidad: creado.id, descripcionEntidad: `${creado.codigo} — ${creado.descripcion}`,
        accion: 'CREAR', modulo: 'procesos', actor: await actorDe(tx, req.auth!.idUsuario),
      })
      return creado
    })
    res.status(201).json({ estado: true, mensaje: 'Proceso creado', datos: proceso })
  })
)

procesosRouter.put(
  '/:id',
  requireModuloEditar('procesos'),
  asyncHandler(async (req, res) => {
    const parsed = procesoSchema.partial().safeParse(req.body)
    if (!parsed.success) throw new ValidationError(parsed.error.message)
    const id = Number(req.params.id)
    const anterior = await prisma.proceso.findUnique({ where: { id } })
    if (!anterior) throw new NotFoundError('Proceso no encontrado')
    if (parsed.data.idMaterial !== undefined && parsed.data.idMaterial !== anterior.idMaterial) {
      await assertProductoTerminado(parsed.data.idMaterial)
    }

    const proceso = await prisma.$transaction(async (tx) => {
      const actualizado = await tx.proceso.update({ where: { id }, data: parsed.data })
      const cambios = diffObjetos(anterior, parsed.data, ETIQUETAS)
      if (cambios.length > 0) {
        await logAudit(tx, {
          entidad: 'Proceso', idEntidad: id, descripcionEntidad: `${actualizado.codigo} — ${actualizado.descripcion}`,
          accion: 'MODIFICAR', modulo: 'procesos', cambios, actor: await actorDe(tx, req.auth!.idUsuario),
        })
      }
      return actualizado
    })
    res.json({ estado: true, mensaje: 'Proceso actualizado', datos: proceso })
  })
)

procesosRouter.delete(
  '/:id',
  requireModuloEditar('procesos'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    const anterior = await prisma.proceso.findUnique({ where: { id } })
    if (!anterior) throw new NotFoundError('Proceso no encontrado')

    await prisma.$transaction(async (tx) => {
      await tx.proceso.update({ where: { id }, data: { activo: false } })
      await logAudit(tx, {
        entidad: 'Proceso', idEntidad: id, descripcionEntidad: `${anterior.codigo} — ${anterior.descripcion}`,
        accion: 'MODIFICAR', modulo: 'procesos',
        cambios: [{ campo: 'activo', etiqueta: 'Activo', valorAnterior: 'true', valorNuevo: 'false' }],
        actor: await actorDe(tx, req.auth!.idUsuario),
      })
    })
    res.json({ estado: true, mensaje: 'Proceso desactivado' })
  })
)

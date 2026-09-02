import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db/prisma.js'
import { requireModuloEditar } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ValidationError, NotFoundError } from '../utils/errors.js'
import { logAudit, actorDe, diffObjetos } from '../services/audit.js'

export const materialesRouter = Router()

const TIPOS_MATERIAL = ['PRODUCTO_TERMINADO', 'MATERIAL_EMPAQUE', 'MATERIAL_ENVASE', 'EXCIPIENTE', 'PRINCIPIO_ACTIVO'] as const

const ETIQUETAS = { codigo: 'Código', descripcion: 'Descripción', tipo: 'Tipo', activo: 'Activo' }

materialesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const tipo = typeof req.query.tipo === 'string' ? req.query.tipo : undefined
    res.json(await prisma.material.findMany({
      where: tipo ? { tipo: tipo as (typeof TIPOS_MATERIAL)[number] } : undefined,
      orderBy: { codigo: 'asc' },
    }))
  })
)

materialesRouter.get(
  '/cargues',
  asyncHandler(async (_req, res) => {
    const registros = await prisma.cargueMaterialRegistro.findMany({
      orderBy: { fechaCargue: 'desc' },
      include: { usuario: { select: { login: true } } },
    })
    res.json(registros.map(r => ({
      id: r.id, archivo: r.archivo, fechaCargue: r.fechaCargue, usuario: r.usuario.login,
      totalMateriales: r.totalMateriales, errores: r.errores, estado: r.estado,
    })))
  })
)

const materialSchema = z.object({
  codigo: z.string().min(1),
  descripcion: z.string().min(1),
  tipo: z.enum(TIPOS_MATERIAL).optional(),
  activo: z.boolean().optional(),
})

materialesRouter.post(
  '/',
  requireModuloEditar('materiales'),
  asyncHandler(async (req, res) => {
    const parsed = materialSchema.safeParse(req.body)
    if (!parsed.success) throw new ValidationError(parsed.error.message)
    const material = await prisma.$transaction(async (tx) => {
      const creado = await tx.material.create({ data: parsed.data })
      await logAudit(tx, {
        entidad: 'Material', idEntidad: creado.id, descripcionEntidad: `${creado.codigo} — ${creado.descripcion}`,
        accion: 'CREAR', modulo: 'materiales', actor: await actorDe(tx, req.auth!.idUsuario),
      })
      return creado
    })
    res.status(201).json({ estado: true, mensaje: 'Material creado', datos: material })
  })
)

materialesRouter.put(
  '/:id',
  requireModuloEditar('materiales'),
  asyncHandler(async (req, res) => {
    const parsed = materialSchema.partial().safeParse(req.body)
    if (!parsed.success) throw new ValidationError(parsed.error.message)
    const id = Number(req.params.id)
    const anterior = await prisma.material.findUnique({ where: { id } })
    if (!anterior) throw new NotFoundError('Material no encontrado')

    const material = await prisma.$transaction(async (tx) => {
      const actualizado = await tx.material.update({ where: { id }, data: parsed.data })
      const cambios = diffObjetos(anterior, parsed.data, ETIQUETAS)
      if (cambios.length > 0) {
        await logAudit(tx, {
          entidad: 'Material', idEntidad: id, descripcionEntidad: `${actualizado.codigo} — ${actualizado.descripcion}`,
          accion: 'MODIFICAR', modulo: 'materiales', cambios, actor: await actorDe(tx, req.auth!.idUsuario),
        })
      }
      return actualizado
    })
    res.json({ estado: true, mensaje: 'Material actualizado', datos: material })
  })
)

materialesRouter.delete(
  '/:id',
  requireModuloEditar('materiales'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    const anterior = await prisma.material.findUnique({ where: { id } })
    if (!anterior) throw new NotFoundError('Material no encontrado')

    await prisma.$transaction(async (tx) => {
      await tx.material.update({ where: { id }, data: { activo: false } })
      await logAudit(tx, {
        entidad: 'Material', idEntidad: id, descripcionEntidad: `${anterior.codigo} — ${anterior.descripcion}`,
        accion: 'MODIFICAR', modulo: 'materiales',
        cambios: [{ campo: 'activo', etiqueta: 'Activo', valorAnterior: 'true', valorNuevo: 'false' }],
        actor: await actorDe(tx, req.auth!.idUsuario),
      })
    })
    res.json({ estado: true, mensaje: 'Material desactivado' })
  })
)

const cargueMaterialSchema = z.object({
  archivo: z.string().min(1),
  materiales: z.array(z.object({
    codigo: z.string().min(1),
    descripcion: z.string().min(1),
    tipo: z.enum(TIPOS_MATERIAL),
  })).min(1),
})

materialesRouter.post(
  '/cargue',
  requireModuloEditar('materiales'),
  asyncHandler(async (req, res) => {
    const parsed = cargueMaterialSchema.safeParse(req.body)
    if (!parsed.success) throw new ValidationError(parsed.error.message)
    const { archivo, materiales } = parsed.data

    let errores = 0
    const creados: string[] = []
    await prisma.$transaction(async (tx) => {
      for (const m of materiales) {
        try {
          const creado = await tx.material.create({ data: m })
          creados.push(creado.codigo)
        } catch {
          errores++
        }
      }
      const estado = errores === 0 ? 'Exitoso' : errores === materiales.length ? 'Fallido' : 'Con errores'
      await tx.cargueMaterialRegistro.create({
        data: { archivo, idUsuario: req.auth!.idUsuario, totalMateriales: materiales.length, errores, estado },
      })
      if (creados.length > 0) {
        await logAudit(tx, {
          entidad: 'Material', idEntidad: 0, descripcionEntidad: `Cargue masivo (${archivo}): ${creados.join(', ')}`,
          accion: 'CREAR', modulo: 'materiales', actor: await actorDe(tx, req.auth!.idUsuario),
        })
      }
    })
    res.status(201).json({
      estado: true, mensaje: 'Cargue procesado',
      datos: { total: materiales.length, creados: creados.length, errores },
    })
  })
)

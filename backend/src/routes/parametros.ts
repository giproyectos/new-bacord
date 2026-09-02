import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db/prisma.js'
import { requireModuloEditar } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ValidationError, NotFoundError } from '../utils/errors.js'
import { logAudit, actorDe, diffObjetos } from '../services/audit.js'

export const parametrosRouter = Router()

const ETIQUETAS = { nombre: 'Nombre', valor: 'Valor', descripcion: 'Descripción' }

parametrosRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await prisma.parametro.findMany({ orderBy: { nombre: 'asc' } }))
  })
)

const parametroSchema = z.object({
  nombre: z.string().min(1),
  valor: z.string(),
  descripcion: z.string().optional(),
})

parametrosRouter.post(
  '/',
  requireModuloEditar('parametros'),
  asyncHandler(async (req, res) => {
    const parsed = parametroSchema.safeParse(req.body)
    if (!parsed.success) throw new ValidationError(parsed.error.message)
    const parametro = await prisma.$transaction(async (tx) => {
      const creado = await tx.parametro.create({ data: parsed.data })
      await logAudit(tx, {
        entidad: 'Parametro', idEntidad: creado.id, descripcionEntidad: `${creado.nombre} = ${creado.valor}`,
        accion: 'CREAR', modulo: 'parametros', actor: await actorDe(tx, req.auth!.idUsuario),
      })
      return creado
    })
    res.status(201).json({ estado: true, mensaje: 'Parámetro creado', datos: parametro })
  })
)

parametrosRouter.put(
  '/:id',
  requireModuloEditar('parametros'),
  asyncHandler(async (req, res) => {
    const parsed = parametroSchema.partial().safeParse(req.body)
    if (!parsed.success) throw new ValidationError(parsed.error.message)
    const id = Number(req.params.id)
    const anterior = await prisma.parametro.findUnique({ where: { id } })
    if (!anterior) throw new NotFoundError('Parámetro no encontrado')

    const parametro = await prisma.$transaction(async (tx) => {
      const actualizado = await tx.parametro.update({ where: { id }, data: parsed.data })
      const cambios = diffObjetos(anterior, parsed.data, ETIQUETAS)
      if (cambios.length > 0) {
        await logAudit(tx, {
          entidad: 'Parametro', idEntidad: id, descripcionEntidad: `${actualizado.nombre} = ${actualizado.valor}`,
          accion: 'MODIFICAR', modulo: 'parametros', cambios, actor: await actorDe(tx, req.auth!.idUsuario),
        })
      }
      return actualizado
    })
    res.json({ estado: true, mensaje: 'Parámetro actualizado', datos: parametro })
  })
)

parametrosRouter.delete(
  '/:id',
  requireModuloEditar('parametros'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    const anterior = await prisma.parametro.findUnique({ where: { id } })
    if (!anterior) throw new NotFoundError('Parámetro no encontrado')

    // Parametro no tiene bandera `activo` — a diferencia de los demás catálogos, aquí eliminar es un borrado real.
    await prisma.$transaction(async (tx) => {
      await tx.parametro.delete({ where: { id } })
      await logAudit(tx, {
        entidad: 'Parametro', idEntidad: id, descripcionEntidad: `${anterior.nombre} = ${anterior.valor}`,
        accion: 'CANCELAR', modulo: 'parametros', motivo: 'Parámetro eliminado permanentemente',
        actor: await actorDe(tx, req.auth!.idUsuario),
      })
    })
    res.json({ estado: true, mensaje: 'Parámetro eliminado' })
  })
)

import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db/prisma.js'
import { requireModuloEditar } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { NotFoundError, ValidationError } from '../utils/errors.js'
import { logAudit, actorDe, diffObjetos, type AuditCambio } from '../services/audit.js'

export const detallesRouter = Router()

const ETIQUETAS = { codigo: 'Código', descripcion: 'Descripción', estado: 'Estado', idEstrategiaFirma: 'Estrategia de firma de cierre' }

detallesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await prisma.detalle.findMany({ orderBy: { codigo: 'asc' } }))
  })
)

detallesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const detalle = await prisma.detalle.findUniqueOrThrow({ where: { id: Number(req.params.id) } })
    res.json(detalle)
  })
)

// Ciclo de vida de un formulario: 'En creación' (recién creado, aún no se usa en ninguna receta) →
// 'Activo' (listo, se puede asignar) → 'Obsoleto' (retirado — nunca se borra, para no romper el
// historial de batch records que ya lo referencian; simplemente deja de poder asignarse a recetas nuevas).
const detalleSchema = z.object({
  codigo: z.string().min(1),
  descripcion: z.string().min(1),
  estado: z.enum(['Activo', 'En creación', 'Obsoleto']).optional(),
  idEstrategiaFirma: z.number().int().nullable().optional(),
  jsonSchema: z.string(),
  jsonData: z.string().optional(),
  jsonOptions: z.string().optional(),
})

detallesRouter.post(
  '/',
  requireModuloEditar('detalles'),
  asyncHandler(async (req, res) => {
    const parsed = detalleSchema.safeParse(req.body)
    if (!parsed.success) throw new ValidationError(parsed.error.message)
    const detalle = await prisma.$transaction(async (tx) => {
      const creado = await tx.detalle.create({ data: parsed.data })
      await logAudit(tx, {
        entidad: 'Detalle', idEntidad: creado.id, descripcionEntidad: `${creado.codigo} — ${creado.descripcion}`,
        accion: 'CREAR', modulo: 'detalles', actor: await actorDe(tx, req.auth!.idUsuario),
      })
      return creado
    })
    res.status(201).json({ estado: true, mensaje: 'Formulario creado', datos: detalle })
  })
)

detallesRouter.put(
  '/:id',
  requireModuloEditar('detalles'),
  asyncHandler(async (req, res) => {
    const parsed = detalleSchema.partial().safeParse(req.body)
    if (!parsed.success) throw new ValidationError(parsed.error.message)
    const id = Number(req.params.id)
    const anterior = await prisma.detalle.findUnique({ where: { id } })
    if (!anterior) throw new NotFoundError('Formulario no encontrado')

    const detalle = await prisma.$transaction(async (tx) => {
      const actualizado = await tx.detalle.update({ where: { id }, data: parsed.data })
      const cambios: AuditCambio[] = diffObjetos(anterior, parsed.data, ETIQUETAS)
      // El schema Form.io es un blob JSON grande — no tiene sentido volcarlo entero en el
      // audit trail, así que solo se anota que cambió (con el tamaño, como referencia).
      if (parsed.data.jsonSchema !== undefined && parsed.data.jsonSchema !== anterior.jsonSchema) {
        cambios.push({
          campo: 'jsonSchema', etiqueta: 'Diseño del formulario',
          valorAnterior: `(${anterior.jsonSchema.length} caracteres)`,
          valorNuevo: `(${parsed.data.jsonSchema.length} caracteres)`,
        })
      }
      if (cambios.length > 0) {
        await logAudit(tx, {
          entidad: 'Detalle', idEntidad: id, descripcionEntidad: `${actualizado.codigo} — ${actualizado.descripcion}`,
          accion: 'MODIFICAR', modulo: 'detalles', cambios, actor: await actorDe(tx, req.auth!.idUsuario),
        })
      }
      return actualizado
    })
    res.json({ estado: true, mensaje: 'Formulario actualizado', datos: detalle })
  })
)

detallesRouter.delete(
  '/:id',
  requireModuloEditar('detalles'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    const anterior = await prisma.detalle.findUnique({ where: { id } })
    if (!anterior) throw new NotFoundError('Formulario no encontrado')

    // Los formularios nunca se borran (los batch records existentes siguen referenciándolos) —
    // "eliminar" en la UI en realidad los marca como Obsoletos, para que dejen de poder asignarse
    // a recetas nuevas sin perder el historial de los batch records que ya los usaron.
    await prisma.$transaction(async (tx) => {
      await tx.detalle.update({ where: { id }, data: { estado: 'Obsoleto' } })
      await logAudit(tx, {
        entidad: 'Detalle', idEntidad: id, descripcionEntidad: `${anterior.codigo} — ${anterior.descripcion}`,
        accion: 'MODIFICAR', modulo: 'detalles',
        cambios: [{ campo: 'estado', etiqueta: 'Estado', valorAnterior: anterior.estado, valorNuevo: 'Obsoleto' }],
        actor: await actorDe(tx, req.auth!.idUsuario),
      })
    })
    res.json({ estado: true, mensaje: 'Formulario marcado como obsoleto' })
  })
)

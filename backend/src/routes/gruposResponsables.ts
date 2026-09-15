import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db/prisma.js'
import { requireModuloEditar } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ConflictError, ValidationError, NotFoundError } from '../utils/errors.js'
import { logAudit, actorDe, diffObjetos } from '../services/audit.js'

export const gruposResponsablesRouter = Router()

const ETIQUETAS = { nombre: 'Nombre', descripcion: 'Descripción', colorKey: 'Color', activo: 'Activo' }

gruposResponsablesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await prisma.grupoResponsable.findMany({ orderBy: { nombre: 'asc' } }))
  })
)

const grupoSchema = z.object({
  nombre: z.string().min(1),
  descripcion: z.string().optional(),
  colorKey: z.string().optional(),
  activo: z.boolean().optional(),
})

gruposResponsablesRouter.post(
  '/',
  requireModuloEditar('grupos-responsables'),
  asyncHandler(async (req, res) => {
    const parsed = grupoSchema.safeParse(req.body)
    if (!parsed.success) throw new ValidationError(parsed.error.message)
    const grupo = await prisma.$transaction(async (tx) => {
      const creado = await tx.grupoResponsable.create({ data: parsed.data })
      await logAudit(tx, {
        entidad: 'GrupoResponsable', idEntidad: creado.id, descripcionEntidad: creado.nombre,
        accion: 'CREAR', modulo: 'grupos-responsables', actor: await actorDe(tx, req.auth!.idUsuario),
      })
      return creado
    })
    res.status(201).json({ estado: true, mensaje: 'Grupo creado', datos: grupo })
  })
)

// EstrategiaFirma.gruposDerogacion (ver estrategiasFirma.ts) guarda los grupos autorizados a
// derogar una firma como un CSV de NOMBRES, no de ids. Renombrar un grupo ya referenciado ahí
// dejaría esa referencia apuntando a un nombre que ya no existe — la autorización de derogación
// se rompería en silencio, recién visible cuando alguien intente derogar una firma y no pueda.
async function assertNombreSinUsoEnDerogacion(nombreAnterior: string) {
  const estrategias = await prisma.estrategiaFirma.findMany({
    where: { gruposDerogacion: { contains: nombreAnterior } },
    select: { codigo: true, gruposDerogacion: true },
  })
  const enUso = estrategias.filter((e) =>
    (e.gruposDerogacion ?? '').split(',').map((s) => s.trim()).includes(nombreAnterior)
  )
  if (enUso.length > 0) {
    throw new ConflictError(
      `No se puede renombrar: el grupo "${nombreAnterior}" está autorizado para derogar firmas en la(s) estrategia(s) ${enUso.map((e) => e.codigo).join(', ')} — quite esa autorización antes de renombrarlo`
    )
  }
}

gruposResponsablesRouter.put(
  '/:id',
  requireModuloEditar('grupos-responsables'),
  asyncHandler(async (req, res) => {
    const parsed = grupoSchema.partial().safeParse(req.body)
    if (!parsed.success) throw new ValidationError(parsed.error.message)
    const id = Number(req.params.id)
    const anterior = await prisma.grupoResponsable.findUnique({ where: { id } })
    if (!anterior) throw new NotFoundError('Grupo no encontrado')
    if (parsed.data.nombre !== undefined && parsed.data.nombre !== anterior.nombre) {
      await assertNombreSinUsoEnDerogacion(anterior.nombre)
    }

    const grupo = await prisma.$transaction(async (tx) => {
      const actualizado = await tx.grupoResponsable.update({ where: { id }, data: parsed.data })
      const cambios = diffObjetos(anterior, parsed.data, ETIQUETAS)
      if (cambios.length > 0) {
        await logAudit(tx, {
          entidad: 'GrupoResponsable', idEntidad: id, descripcionEntidad: actualizado.nombre,
          accion: 'MODIFICAR', modulo: 'grupos-responsables', cambios, actor: await actorDe(tx, req.auth!.idUsuario),
        })
      }
      return actualizado
    })
    res.json({ estado: true, mensaje: 'Grupo actualizado', datos: grupo })
  })
)

gruposResponsablesRouter.delete(
  '/:id',
  requireModuloEditar('grupos-responsables'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    const anterior = await prisma.grupoResponsable.findUnique({ where: { id } })
    if (!anterior) throw new NotFoundError('Grupo no encontrado')

    await prisma.$transaction(async (tx) => {
      await tx.grupoResponsable.update({ where: { id }, data: { activo: false } })
      await logAudit(tx, {
        entidad: 'GrupoResponsable', idEntidad: id, descripcionEntidad: anterior.nombre,
        accion: 'MODIFICAR', modulo: 'grupos-responsables',
        cambios: [{ campo: 'activo', etiqueta: 'Activo', valorAnterior: 'true', valorNuevo: 'false' }],
        actor: await actorDe(tx, req.auth!.idUsuario),
      })
    })
    res.json({ estado: true, mensaje: 'Grupo desactivado' })
  })
)

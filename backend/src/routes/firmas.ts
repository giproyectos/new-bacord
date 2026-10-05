import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db/prisma.js'
import { requireModuloEditar } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ValidationError, NotFoundError } from '../utils/errors.js'
import { logAudit, actorDe, diffObjetos } from '../services/audit.js'

export const firmasRouter = Router()

const ETIQUETAS = { codigo: 'Código', descripcion: 'Descripción', texto: 'Texto', idGrupo: 'Grupo responsable', activo: 'Activo' }

firmasRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await prisma.firma.findMany({ include: { grupo: true }, orderBy: { codigo: 'asc' } }))
  })
)

const firmaSchema = z.object({
  codigo: z.string().min(1),
  descripcion: z.string().min(1),
  texto: z.string().min(1),
  idGrupo: z.number().int(),
  activo: z.boolean().optional(),
})

// Sin este chequeo, un idGrupo inexistente llega intacto hasta el `data: parsed.data` de Prisma,
// que revienta con una violación de llave foránea (P2003) no manejada por errorHandler — el
// administrador ve un 500 genérico en vez de un mensaje claro. Un idGrupo de un grupo ya
// desactivado sí satisface la llave foránea y no revienta, pero deja una Firma vinculada a un
// grupo que ya no puede derogar/firmar nada — la misma regla que ya exige estrategiasFirma.ts
// para sus propias referencias a Firma/Grupo Responsable.
async function assertGrupoValido(idGrupo: number | undefined) {
  if (idGrupo === undefined) return
  const grupo = await prisma.grupoResponsable.findUnique({ where: { id: idGrupo } })
  if (!grupo || !grupo.activo) throw new ValidationError('El Grupo responsable indicado no existe o está inactivo')
}

firmasRouter.post(
  '/',
  requireModuloEditar('firmas'),
  asyncHandler(async (req, res) => {
    const parsed = firmaSchema.safeParse(req.body)
    if (!parsed.success) throw new ValidationError(parsed.error.message)
    await assertGrupoValido(parsed.data.idGrupo)
    const firma = await prisma.$transaction(async (tx) => {
      const creada = await tx.firma.create({ data: parsed.data, include: { grupo: true } })
      await logAudit(tx, {
        entidad: 'Firma', idEntidad: creada.idFirma, descripcionEntidad: `${creada.codigo} — ${creada.descripcion}`,
        accion: 'CREAR', modulo: 'firmas', actor: await actorDe(tx, req.auth!.idUsuario),
      })
      return creada
    })
    res.status(201).json({ estado: true, mensaje: 'Firma creada', datos: firma })
  })
)

firmasRouter.put(
  '/:id',
  requireModuloEditar('firmas'),
  asyncHandler(async (req, res) => {
    const parsed = firmaSchema.partial().safeParse(req.body)
    if (!parsed.success) throw new ValidationError(parsed.error.message)
    await assertGrupoValido(parsed.data.idGrupo)
    const id = Number(req.params.id)
    const anterior = await prisma.firma.findUnique({ where: { idFirma: id } })
    if (!anterior) throw new NotFoundError('Firma no encontrada')

    const firma = await prisma.$transaction(async (tx) => {
      const actualizada = await tx.firma.update({ where: { idFirma: id }, data: parsed.data, include: { grupo: true } })
      const cambios = diffObjetos(anterior, parsed.data, ETIQUETAS)
      if (cambios.length > 0) {
        await logAudit(tx, {
          entidad: 'Firma', idEntidad: id, descripcionEntidad: `${actualizada.codigo} — ${actualizada.descripcion}`,
          accion: 'MODIFICAR', modulo: 'firmas', cambios, actor: await actorDe(tx, req.auth!.idUsuario),
        })
      }
      return actualizada
    })
    res.json({ estado: true, mensaje: 'Firma actualizada', datos: firma })
  })
)

firmasRouter.delete(
  '/:id',
  requireModuloEditar('firmas'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    const anterior = await prisma.firma.findUnique({ where: { idFirma: id } })
    if (!anterior) throw new NotFoundError('Firma no encontrada')

    await prisma.$transaction(async (tx) => {
      await tx.firma.update({ where: { idFirma: id }, data: { activo: false } })
      await logAudit(tx, {
        entidad: 'Firma', idEntidad: id, descripcionEntidad: `${anterior.codigo} — ${anterior.descripcion}`,
        accion: 'MODIFICAR', modulo: 'firmas',
        cambios: [{ campo: 'activo', etiqueta: 'Activo', valorAnterior: 'true', valorNuevo: 'false' }],
        actor: await actorDe(tx, req.auth!.idUsuario),
      })
    })
    res.json({ estado: true, mensaje: 'Firma desactivada' })
  })
)

import { Router, type Request } from 'express'
import { z } from 'zod'
import { prisma } from '../db/prisma.js'
import { requireModuloEditar } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors.js'
import { logAudit, actorDe } from '../services/audit.js'
import { verificarPin } from '../services/pin.js'
import { getParametroGrupos } from '../services/parametros.js'
import { gruposDeReceta, puedeAccederBatchRecord } from '../services/accesoBatchRecord.js'

export const desviacionesRouter = Router()

const usuarioSelect = { select: { nombres: true, apellidos: true, login: true } }
const include = { usuarioReporta: usuarioSelect, usuarioCierra: usuarioSelect }

// Misma regla de Centro + Grupo Responsable que /api/batch-records/:id (ver accesoBatchRecord.ts)
// — una desviación es del Batch Record donde se reportó, así que el acceso es el mismo.
async function assertAccesoABatchRecord(req: Request, idBatchRecord: number) {
  const br = await prisma.batchRecord.findUnique({ where: { idBatchRecord }, select: { idCentro: true, idRecetaMaestra: true } })
  if (!br) throw new NotFoundError('Batch Record no encontrado')
  const grupos = await gruposDeReceta(prisma, br.idRecetaMaestra)
  if (!puedeAccederBatchRecord(req.auth!, br, grupos)) throw new ForbiddenError('No tiene acceso a este Batch Record')
}

desviacionesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { idBatchRecord } = req.query
    const where: Record<string, unknown> = {}
    if (typeof idBatchRecord === 'string' && idBatchRecord) {
      const id = Number(idBatchRecord)
      await assertAccesoABatchRecord(req, id)
      where.idBatchRecord = id
    } else if (!req.auth!.esAdministrador) {
      // Sin un lote puntual, un no-administrador solo puede listar las de su propio Centro —
      // el filtro de Grupo exige saber la receta de cada una, que no vale la pena acá.
      where.batchRecord = { idCentro: req.auth!.idCentro ?? -1 }
    }
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
    await assertAccesoABatchRecord(req, parsed.data.idBatchRecord)

    const desviacion = await prisma.$transaction(async (tx) => {
      const creada = await tx.desviacion.create({
        data: { ...parsed.data, idUsuarioReporta: req.auth!.idUsuario },
        include,
      })
      // idEntidad es el idBatchRecord (no el id propio de la Desviacion) para que este evento
      // aparezca en el panel de auditoría embebido en el Batch Record — igual que BatchRecord,
      // DetalleValores, FirmaSeccion y FirmaCierre, que ya se identifican por su idBatchRecord.
      await logAudit(tx, {
        entidad: 'Desviacion', idEntidad: parsed.data.idBatchRecord,
        descripcionEntidad: `BR-${parsed.data.idBatchRecord} · ${detalle.descripcion} · ${parsed.data.labelCampo}`,
        accion: 'REGISTRAR_DESVIACION', modulo: 'batch-record', motivo: parsed.data.descripcion,
        actor: await actorDe(tx, req.auth!.idUsuario),
      })
      return creada
    })
    res.status(201).json({ estado: true, mensaje: 'Desviación registrada', datos: desviacion })
  })
)

const cerrarSchema = z.object({ login: z.string().min(1), pin: z.string().min(1), observacionCierre: z.string().min(1) })

desviacionesRouter.post(
  '/:id/cerrar',
  requireModuloEditar('batch-records'),
  asyncHandler(async (req, res) => {
    const parsed = cerrarSchema.safeParse(req.body)
    if (!parsed.success) throw new ValidationError(parsed.error.message)
    const { login, pin, observacionCierre } = parsed.data
    const id = Number(req.params.id)

    const existente = await prisma.desviacion.findUnique({ where: { id }, include: { detalle: true } })
    if (!existente) throw new NotFoundError('Desviación no encontrada')
    if (existente.estado === 'cerrada') throw new ConflictError('Esta desviación ya fue cerrada')
    await assertAccesoABatchRecord(req, existente.idBatchRecord)

    // Cerrar una desviación es una decisión de calidad — exige re-autenticación con PIN, igual
    // que firmar, liberar, cancelar o derogar una firma. Quién puede hacerlo (además de un
    // administrador) es configurable por cliente vía el parámetro `desviaciones_grupo_cierre`.
    const solicitante = await prisma.usuario.findUnique({ where: { login }, include: { grupos: { include: { grupo: true } } } })
    if (!solicitante || !solicitante.activo || solicitante.bloqueado) {
      return res.json({ estado: false, mensaje: 'Usuario no válido para cerrar la desviación' })
    }
    const pinCheck = await verificarPin(prisma, solicitante, pin)
    if (!pinCheck.ok) return res.json({ estado: false, mensaje: pinCheck.mensaje })

    if (!solicitante.esAdministrador) {
      const gruposAutorizados = await getParametroGrupos(prisma, 'desviaciones_grupo_cierre', 'Calidad')
      const autorizado = solicitante.grupos.some((g) => gruposAutorizados.includes(g.grupo.nombre))
      if (!autorizado) throw new ForbiddenError('No tiene permisos para cerrar desviaciones')
    }

    const desviacion = await prisma.$transaction(async (tx) => {
      const actualizada = await tx.desviacion.update({
        where: { id },
        data: {
          estado: 'cerrada',
          observacionCierre,
          fechaCierre: new Date(),
          idUsuarioCierre: solicitante.idUsuario,
        },
        include,
      })
      await logAudit(tx, {
        entidad: 'Desviacion', idEntidad: existente.idBatchRecord,
        descripcionEntidad: `BR-${existente.idBatchRecord} · ${existente.detalle.descripcion} · ${existente.labelCampo}`,
        accion: 'CERRAR_DESVIACION', modulo: 'batch-record', motivo: observacionCierre,
        actor: await actorDe(tx, solicitante.idUsuario),
      })
      return actualizada
    })
    res.json({ estado: true, mensaje: 'Desviación cerrada', datos: desviacion })
  })
)

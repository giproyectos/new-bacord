import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db/prisma.js'
import { requireModuloEditar } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors.js'
import { logAudit, actorDe } from '../services/audit.js'

export const formulasControlRouter = Router()

formulasControlRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await prisma.formulaControl.findMany({ orderBy: { fechaCreacion: 'desc' } }))
  })
)

formulasControlRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const fc = await prisma.formulaControl.findUnique({ where: { idFormulaControl: Number(req.params.id) } })
    if (!fc) throw new NotFoundError('Fórmula de Control no encontrada')
    res.json(fc)
  })
)

const crearSchema = z.object({ idOrdenProceso: z.number().int() })

formulasControlRouter.post(
  '/',
  requireModuloEditar('formulas-control'),
  asyncHandler(async (req, res) => {
    const parsed = crearSchema.safeParse(req.body)
    if (!parsed.success) throw new ValidationError(parsed.error.message)
    const { idOrdenProceso } = parsed.data

    const orden = await prisma.ordenProceso.findUnique({ where: { idOrdenProceso } })
    if (!orden) throw new NotFoundError('Orden de proceso no encontrada')

    const activa = await prisma.formulaControl.findFirst({ where: { idOrdenProceso, idEstado: { not: 3 } } })
    if (activa) throw new ConflictError('Ya existe una Fórmula de Control activa para esta Orden de Proceso')

    const fc = await prisma.$transaction(async (tx) => {
      const nueva = await tx.formulaControl.create({
        data: {
          idRecetaMaestra: orden.idRecetaMaestra,
          idOrdenProceso,
          idCentro: orden.idCentro,
          idUsuarioCreacion: req.auth!.idUsuario,
        },
      })
      await tx.ordenProceso.update({ where: { idOrdenProceso }, data: { idEstado: 2 } })
      await logAudit(tx, {
        entidad: 'FormulaControl', idEntidad: nueva.idFormulaControl,
        descripcionEntidad: `FC-${nueva.idFormulaControl} — ${orden.numeroOrdenProceso}`,
        accion: 'CREAR', modulo: 'formulas-control', actor: await actorDe(tx, req.auth!.idUsuario),
      })
      return nueva
    })
    res.status(201).json(fc)
  })
)

formulasControlRouter.post(
  '/:id/enviar',
  requireModuloEditar('formulas-control'),
  asyncHandler(async (req, res) => {
    const idFormulaControl = Number(req.params.id)
    const fc = await prisma.formulaControl.findUnique({ where: { idFormulaControl } })
    if (!fc) throw new NotFoundError('Fórmula de Control no encontrada')
    if (fc.idEstado !== 1) throw new ConflictError('La Fórmula de Control ya fue enviada o cancelada')

    const br = await prisma.$transaction(async (tx) => {
      await tx.formulaControl.update({ where: { idFormulaControl }, data: { idEstado: 2 } })
      const nuevoBr = await tx.batchRecord.create({
        data: {
          idFormulaControl,
          idRecetaMaestra: fc.idRecetaMaestra,
          idOrdenProceso: fc.idOrdenProceso,
          idCentro: fc.idCentro,
          idUsuarioCreacion: req.auth!.idUsuario,
          idUsuarioModificacion: req.auth!.idUsuario,
        },
      })
      await tx.ordenProceso.update({ where: { idOrdenProceso: fc.idOrdenProceso }, data: { idEstado: 3 } })
      const actor = await actorDe(tx, req.auth!.idUsuario)
      await logAudit(tx, {
        entidad: 'FormulaControl', idEntidad: idFormulaControl, descripcionEntidad: `FC-${idFormulaControl}`,
        accion: 'MODIFICAR', modulo: 'formulas-control',
        cambios: [{ campo: 'idEstado', etiqueta: 'Estado', valorAnterior: 'En Tratamiento', valorNuevo: 'Enviada a Producción' }],
        actor,
      })
      await logAudit(tx, {
        entidad: 'BatchRecord', idEntidad: nuevoBr.idBatchRecord, descripcionEntidad: `BR-${nuevoBr.idBatchRecord}`,
        accion: 'CREAR', modulo: 'batch-record', motivo: `Generado a partir de FC-${idFormulaControl}`, actor,
      })
      return nuevoBr
    })
    res.json(br)
  })
)

formulasControlRouter.post(
  '/:id/cancelar',
  requireModuloEditar('formulas-control'),
  asyncHandler(async (req, res) => {
    const idFormulaControl = Number(req.params.id)
    const fc = await prisma.formulaControl.findUnique({ where: { idFormulaControl } })
    if (!fc) throw new NotFoundError('Fórmula de Control no encontrada')

    await prisma.$transaction(async (tx) => {
      await tx.formulaControl.update({ where: { idFormulaControl }, data: { idEstado: 3 } })
      await tx.ordenProceso.update({ where: { idOrdenProceso: fc.idOrdenProceso }, data: { idEstado: 1 } })
      await logAudit(tx, {
        entidad: 'FormulaControl', idEntidad: idFormulaControl, descripcionEntidad: `FC-${idFormulaControl}`,
        accion: 'CANCELAR', modulo: 'formulas-control', actor: await actorDe(tx, req.auth!.idUsuario),
      })
    })
    res.status(204).end()
  })
)

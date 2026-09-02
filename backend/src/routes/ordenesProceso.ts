import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db/prisma.js'
import { requireModuloEditar } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { NotFoundError, ValidationError } from '../utils/errors.js'
import { logAudit, actorDe } from '../services/audit.js'

export const ordenesProcesoRouter = Router()

ordenesProcesoRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { numeroOrden, codigoMaterial, idEstado } = req.query
    const where: Record<string, unknown> = {}
    if (typeof numeroOrden === 'string' && numeroOrden) where.numeroOrdenProceso = { contains: numeroOrden }
    if (typeof codigoMaterial === 'string' && codigoMaterial) where.codigoMaterial = { contains: codigoMaterial }
    if (typeof idEstado === 'string' && idEstado) where.idEstado = Number(idEstado)

    const ordenes = await prisma.ordenProceso.findMany({ where, orderBy: { numeroOrdenProceso: 'asc' }, include: { centro: true } })
    res.json(ordenes.map(({ centro, ...rest }) => ({ ...rest, centro: centro.descripcion })))
  })
)

ordenesProcesoRouter.get(
  '/cargues',
  asyncHandler(async (_req, res) => {
    const cargues = await prisma.cargueRegistro.findMany({
      orderBy: { fechaCargue: 'desc' },
      include: { usuario: { select: { login: true } } },
    })
    res.json(cargues.map((c) => ({ ...c, usuario: c.usuario.login })))
  })
)

ordenesProcesoRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const orden = await prisma.ordenProceso.findUnique({ where: { idOrdenProceso: Number(req.params.id) }, include: { centro: true } })
    if (!orden) throw new NotFoundError('Orden de Proceso no encontrada')
    const { centro, ...rest } = orden
    res.json({ ...rest, centro: centro.descripcion })
  })
)

ordenesProcesoRouter.get(
  '/:id/componentes',
  asyncHandler(async (req, res) => {
    res.json(await prisma.componenteOrden.findMany({ where: { idOrdenProceso: Number(req.params.id) } }))
  })
)

const componenteSchema = z.object({
  codigoMaterialComponente: z.string().min(1),
  descripcionMaterialComponente: z.string().min(1),
  cantidad: z.number(),
  unidadMedida: z.string().min(1),
  loteComponente: z.string().min(1),
  codigoListaMateriales: z.string().min(1),
})

const ordenSchema = z.object({
  idRecetaMaestra: z.number().int(),
  numeroOrdenProceso: z.string().min(1),
  codigoMaterial: z.string().min(1),
  descripcionMaterial: z.string().min(1),
  idCentro: z.number().int(),
  loteLogistico: z.string().min(1),
  cantidadOrden: z.number(),
  unidadMedida: z.string().min(1),
  loteInspeccion: z.string().min(1),
  fechaFabricacion: z.string(),
  fechaCaducidad: z.string(),
  registroSanitario: z.string().min(1),
  formaFarmaceutica: z.string().min(1),
  componentes: z.array(componenteSchema).optional(),
})

ordenesProcesoRouter.post(
  '/',
  requireModuloEditar('ordenes-proceso'),
  asyncHandler(async (req, res) => {
    const parsed = ordenSchema.safeParse(req.body)
    if (!parsed.success) throw new ValidationError(parsed.error.message)
    const { componentes, fechaFabricacion, fechaCaducidad, ...rest } = parsed.data

    const orden = await prisma.$transaction(async (tx) => {
      const creada = await tx.ordenProceso.create({
        data: {
          ...rest,
          fechaFabricacion: new Date(fechaFabricacion),
          fechaCaducidad: new Date(fechaCaducidad),
          componentes: componentes ? { create: componentes } : undefined,
        },
        include: { componentes: true },
      })
      await logAudit(tx, {
        entidad: 'OrdenProceso', idEntidad: creada.idOrdenProceso, descripcionEntidad: `${creada.numeroOrdenProceso} — ${creada.descripcionMaterial}`,
        accion: 'CREAR', modulo: 'ordenes-proceso', actor: await actorDe(tx, req.auth!.idUsuario),
      })
      return creada
    })
    res.status(201).json({ estado: true, mensaje: 'Orden de Proceso guardada', datos: orden })
  })
)

const cargueSchema = z.object({
  archivo: z.string().min(1),
  ordenes: z.array(ordenSchema.omit({ componentes: true })),
  componentes: z.array(z.array(componenteSchema)),
})

ordenesProcesoRouter.post(
  '/cargue',
  requireModuloEditar('ordenes-proceso'),
  asyncHandler(async (req, res) => {
    const parsed = cargueSchema.safeParse(req.body)
    if (!parsed.success) throw new ValidationError(parsed.error.message)
    const { archivo, ordenes, componentes } = parsed.data
    if (ordenes.length !== componentes.length) throw new ValidationError('ordenes y componentes deben tener la misma longitud')

    let totalComponentes = 0
    let errores = 0
    const numeros: string[] = []

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < ordenes.length; i++) {
        const { fechaFabricacion, fechaCaducidad, ...rest } = ordenes[i]
        try {
          await tx.ordenProceso.create({
            data: {
              ...rest,
              fechaFabricacion: new Date(fechaFabricacion),
              fechaCaducidad: new Date(fechaCaducidad),
              componentes: { create: componentes[i] },
            },
          })
          totalComponentes += componentes[i].length
          numeros.push(rest.numeroOrdenProceso)
        } catch {
          errores++
        }
      }

      await tx.cargueRegistro.create({
        data: {
          archivo,
          idUsuario: req.auth!.idUsuario,
          totalOrdenes: ordenes.length,
          totalComponentes,
          errores,
          estado: errores === 0 ? 'Exitoso' : errores === ordenes.length ? 'Fallido' : 'Con errores',
        },
      })

      if (numeros.length > 0) {
        await logAudit(tx, {
          entidad: 'OrdenProceso', idEntidad: 0, descripcionEntidad: `Cargue masivo "${archivo}" — ${numeros.join(', ')}`,
          accion: 'CREAR', modulo: 'ordenes-proceso',
          motivo: `${numeros.length} orden(es) cargadas${errores > 0 ? `, ${errores} con error` : ''}`,
          actor: await actorDe(tx, req.auth!.idUsuario),
        })
      }
    })

    res.json({
      estado: true,
      mensaje: `${ordenes.length - errores} órdenes cargadas correctamente`,
      datos: { totalCargadas: ordenes.length - errores, totalComponentes, errores },
    })
  })
)

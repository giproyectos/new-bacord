import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db/prisma.js'
import { requireModuloEditar } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors.js'
import { logAudit, actorDe, diffObjetos } from '../services/audit.js'

export const recetasMaestrasRouter = Router()

const listInclude = {
  centro: true,
  material: true,
  procesos: { include: { proceso: true, detalles: true } },
}

const ETIQUETAS = { codigo: 'Código', descripcion: 'Descripción', version: 'Versión', idCentro: 'Centro', idMaterial: 'Material', motivo: 'Motivo' }

recetasMaestrasRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { codigo, descripcion, idEstado } = req.query
    const where: Record<string, unknown> = {}
    if (typeof codigo === 'string' && codigo) where.codigo = { contains: codigo }
    if (typeof descripcion === 'string' && descripcion) where.descripcion = { contains: descripcion }
    if (typeof idEstado === 'string' && idEstado) where.idEstado = Number(idEstado)

    res.json(await prisma.recetaMaestra.findMany({ where, include: listInclude, orderBy: { codigo: 'asc' } }))
  })
)

recetasMaestrasRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const receta = await prisma.recetaMaestra.findUnique({
      where: { idRecetaMaestra: Number(req.params.id) },
      include: listInclude,
    })
    if (!receta) throw new NotFoundError('Receta Maestra no encontrada')
    res.json(receta)
  })
)

recetasMaestrasRouter.get(
  '/:id/estructura',
  asyncHandler(async (req, res) => {
    const idRecetaMaestra = Number(req.params.id)
    const procesos = await prisma.recetaProceso.findMany({
      where: { idRecetaMaestra },
      orderBy: { orden: 'asc' },
      include: { proceso: true, detalles: { orderBy: { orden: 'asc' }, include: { detalle: true } } },
    })
    res.json({ idRecetaMaestra, procesos })
  })
)

const recetaSchema = z.object({
  codigo: z.string().min(1),
  descripcion: z.string().min(1),
  version: z.string().min(1),
  idCentro: z.number().int(),
  idMaterial: z.number().int(),
  motivo: z.string().optional(),
})

recetasMaestrasRouter.post(
  '/',
  requireModuloEditar('recetas-maestras'),
  asyncHandler(async (req, res) => {
    const parsed = recetaSchema.safeParse(req.body)
    if (!parsed.success) throw new ValidationError(parsed.error.message)

    const receta = await prisma.$transaction(async (tx) => {
      const creada = await tx.recetaMaestra.create({
        data: {
          ...parsed.data,
          idEstado: 4, // Creación — debe pasar por Revisión y Aprobación antes de poder Activarse.
          usuarioCreacion: req.auth!.login,
          usuarioModificacion: req.auth!.login,
        },
        include: listInclude,
      })
      await logAudit(tx, {
        entidad: 'RecetaMaestra', idEntidad: creada.idRecetaMaestra, descripcionEntidad: `${creada.codigo} — ${creada.descripcion}`,
        accion: 'CREAR', modulo: 'recetas-maestras', actor: await actorDe(tx, req.auth!.idUsuario),
      })
      return creada
    })
    res.status(201).json({ estado: true, mensaje: 'Receta Maestra creada', datos: receta })
  })
)

recetasMaestrasRouter.put(
  '/:id',
  requireModuloEditar('recetas-maestras'),
  asyncHandler(async (req, res) => {
    const parsed = recetaSchema.partial().safeParse(req.body)
    if (!parsed.success) throw new ValidationError(parsed.error.message)
    const idRecetaMaestra = Number(req.params.id)
    const anterior = await prisma.recetaMaestra.findUnique({ where: { idRecetaMaestra } })
    if (!anterior) throw new NotFoundError('Receta Maestra no encontrada')

    // El producto no se puede cambiar nunca, ni siquiera antes de tener Batch Records — define de
    // qué receta se trata. El frontend ya deshabilita ese campo al editar, pero eso no protege
    // contra una llamada directa a la API.
    if (parsed.data.idMaterial !== undefined && parsed.data.idMaterial !== anterior.idMaterial) {
      throw new ConflictError('El producto no se puede cambiar una vez creada la receta')
    }

    // Mismo criterio que PUT /:id/estructura: una vez que la receta tiene Batch Records, cambiar
    // su código, versión, descripción o centro alteraría retroactivamente lo que ya muestra un
    // Batch Record en curso o liberado (EditarBatchRecord.tsx consulta la receta en vivo, nunca
    // guarda una foto al crearse). La vía correcta es versionarla con "Copiar".
    const CAMPOS_IDENTIDAD = ['codigo', 'descripcion', 'version', 'idCentro'] as const
    const cambiaIdentidad = CAMPOS_IDENTIDAD.some(
      (campo) => parsed.data[campo] !== undefined && parsed.data[campo] !== anterior[campo]
    )
    if (cambiaIdentidad) {
      const tieneBatchRecords = await prisma.batchRecord.findFirst({ where: { idRecetaMaestra } })
      if (tieneBatchRecords) {
        throw new ConflictError('Esta receta ya tiene Batch Records asociados — no se puede modificar. Cree una nueva versión con "Copiar".')
      }
    }

    const receta = await prisma.$transaction(async (tx) => {
      const actualizada = await tx.recetaMaestra.update({
        where: { idRecetaMaestra },
        data: { ...parsed.data, usuarioModificacion: req.auth!.login },
        include: listInclude,
      })
      const cambios = diffObjetos(anterior, parsed.data, ETIQUETAS)
      if (cambios.length > 0) {
        await logAudit(tx, {
          entidad: 'RecetaMaestra', idEntidad: idRecetaMaestra, descripcionEntidad: `${actualizada.codigo} — ${actualizada.descripcion}`,
          accion: 'MODIFICAR', modulo: 'recetas-maestras', cambios, actor: await actorDe(tx, req.auth!.idUsuario),
        })
      }
      return actualizada
    })
    res.json({ estado: true, mensaje: 'Receta Maestra actualizada', datos: receta })
  })
)

const estructuraSchema = z.object({
  procesos: z.array(
    z.object({
      idProceso: z.number().int(),
      orden: z.number().int(),
      detalles: z.array(z.object({ idDetalle: z.number().int(), orden: z.number().int() })),
    })
  ),
})

recetasMaestrasRouter.put(
  '/:id/estructura',
  requireModuloEditar('recetas-maestras'),
  asyncHandler(async (req, res) => {
    const parsed = estructuraSchema.safeParse(req.body)
    if (!parsed.success) throw new ValidationError(parsed.error.message)
    const idRecetaMaestra = Number(req.params.id)

    const receta = await prisma.recetaMaestra.findUnique({ where: { idRecetaMaestra } })
    if (!receta) throw new NotFoundError('Receta Maestra no encontrada')

    // batchRecordProgress.ts consulta la estructura de la receta EN VIVO (nunca guarda una foto al
    // crear el Batch Record) — editarla después de que existe un Batch Record cambiaría
    // retroactivamente qué pasos/firmas requiere un lote ya en ejecución, o incluso alteraría lo
    // que muestra un lote ya liberado frente a lo que realmente se siguió al fabricarlo. Una vez
    // que la receta tiene algún Batch Record, la vía correcta es versionarla con "Copiar".
    const tieneBatchRecords = await prisma.batchRecord.findFirst({ where: { idRecetaMaestra } })
    if (tieneBatchRecords) {
      throw new ConflictError('Esta receta ya tiene Batch Records asociados — no se puede modificar su estructura. Cree una nueva versión con "Copiar".')
    }

    const antes = await prisma.recetaProceso.findMany({
      where: { idRecetaMaestra },
      orderBy: { orden: 'asc' },
      include: { proceso: true, detalles: { orderBy: { orden: 'asc' }, include: { detalle: true } } },
    })

    await prisma.$transaction(async (tx) => {
      await tx.recetaProceso.deleteMany({ where: { idRecetaMaestra } }) // cascada borra RecetaDetalle
      for (const p of parsed.data.procesos) {
        await tx.recetaProceso.create({
          data: {
            idRecetaMaestra,
            idProceso: p.idProceso,
            orden: p.orden,
            detalles: { create: p.detalles.map((d) => ({ idDetalle: d.idDetalle, orden: d.orden })) },
          },
        })
      }

      const despues = await tx.recetaProceso.findMany({
        where: { idRecetaMaestra },
        orderBy: { orden: 'asc' },
        include: { proceso: true, detalles: { orderBy: { orden: 'asc' }, include: { detalle: true } } },
      })

      const fmt = (procesos: typeof antes) =>
        procesos.map((p) => `${p.proceso.codigo}[${p.detalles.map((d) => d.detalle.codigo).join(',')}]`).join(' · ') || '—'
      const antesTxt = fmt(antes)
      const despuesTxt = fmt(despues)
      if (antesTxt !== despuesTxt) {
        await logAudit(tx, {
          entidad: 'RecetaMaestra', idEntidad: idRecetaMaestra, descripcionEntidad: `${receta.codigo} — ${receta.descripcion}`,
          accion: 'MODIFICAR', modulo: 'recetas-maestras',
          cambios: [{ campo: 'estructura', etiqueta: 'Procesos y formularios', valorAnterior: antesTxt, valorNuevo: despuesTxt }],
          actor: await actorDe(tx, req.auth!.idUsuario),
        })
      }
    })

    const procesos = await prisma.recetaProceso.findMany({
      where: { idRecetaMaestra },
      orderBy: { orden: 'asc' },
      include: { proceso: true, detalles: { orderBy: { orden: 'asc' }, include: { detalle: true } } },
    })
    res.json({ estado: true, mensaje: 'Estructura actualizada', datos: { idRecetaMaestra, procesos } })
  })
)

const ESTADO_LABEL: Record<number, string> = { 1: 'Activo', 2: 'Inactivo', 3: 'Aprobado', 4: 'Creación', 5: 'Revisión', 6: 'Rechazado' }
// Mismo flujo que expone el frontend (RecetaMaestraList.tsx, `siguienteEstado`): Creación → Revisión
// → Aprobado → Activo → Inactivo, con la salida de Revisión de vuelta a Creación (rechazo). Sin
// esto, el endpoint aceptaba cualquier entero — una llamada directa a la API podía saltarse la
// revisión/aprobación y activar la receta de un salto, o guardar un idEstado que ni el propio
// ESTADO_LABEL reconoce.
const TRANSICIONES_VALIDAS: Record<number, number[]> = {
  4: [5], // Creación → Revisión
  5: [3, 4], // Revisión → Aprobado, o rechazada de vuelta a Creación
  3: [1], // Aprobado → Activo
  1: [2], // Activo → Inactivo
}
const cambiarEstadoSchema = z.object({ idEstado: z.number().int(), motivo: z.string().optional() })

recetasMaestrasRouter.post(
  '/:id/estado',
  requireModuloEditar('recetas-maestras'),
  asyncHandler(async (req, res) => {
    const parsed = cambiarEstadoSchema.safeParse(req.body)
    if (!parsed.success) throw new ValidationError(parsed.error.message)
    const idRecetaMaestra = Number(req.params.id)
    const anterior = await prisma.recetaMaestra.findUnique({ where: { idRecetaMaestra } })
    if (!anterior) throw new NotFoundError('Receta Maestra no encontrada')

    const transicionesPermitidas = TRANSICIONES_VALIDAS[anterior.idEstado] ?? []
    if (!transicionesPermitidas.includes(parsed.data.idEstado)) {
      const estadoActual = ESTADO_LABEL[anterior.idEstado] ?? String(anterior.idEstado)
      const estadoPedido = ESTADO_LABEL[parsed.data.idEstado] ?? String(parsed.data.idEstado)
      throw new ConflictError(`No se puede pasar de "${estadoActual}" a "${estadoPedido}"`)
    }
    // Rechazar una receta en Revisión es la única transición negativa — exige que quede
    // documentado por qué, igual que derogar una firma o cancelar un lote.
    if (anterior.idEstado === 5 && parsed.data.idEstado === 4 && !parsed.data.motivo?.trim()) {
      throw new ValidationError('Debe indicar el motivo del rechazo')
    }

    const receta = await prisma.$transaction(async (tx) => {
      const actualizada = await tx.recetaMaestra.update({
        where: { idRecetaMaestra },
        data: { idEstado: parsed.data.idEstado, motivo: parsed.data.motivo, usuarioModificacion: req.auth!.login },
      })
      await logAudit(tx, {
        entidad: 'RecetaMaestra', idEntidad: idRecetaMaestra, descripcionEntidad: `${actualizada.codigo} — ${actualizada.descripcion}`,
        accion: 'MODIFICAR', modulo: 'recetas-maestras', motivo: parsed.data.motivo,
        cambios: [{
          campo: 'idEstado', etiqueta: 'Estado',
          valorAnterior: ESTADO_LABEL[anterior.idEstado] ?? String(anterior.idEstado),
          valorNuevo: ESTADO_LABEL[parsed.data.idEstado] ?? String(parsed.data.idEstado),
        }],
        actor: await actorDe(tx, req.auth!.idUsuario),
      })
      return actualizada
    })
    res.json({ estado: true, mensaje: 'Estado actualizado', datos: receta })
  })
)

const copiarSchema = z.object({ codigo: z.string().min(1) })

recetasMaestrasRouter.post(
  '/:id/copiar',
  requireModuloEditar('recetas-maestras'),
  asyncHandler(async (req, res) => {
    const parsed = copiarSchema.safeParse(req.body)
    if (!parsed.success) throw new ValidationError(parsed.error.message)
    const idRecetaMaestra = Number(req.params.id)

    const original = await prisma.recetaMaestra.findUnique({
      where: { idRecetaMaestra },
      include: {
        procesos: { include: { detalles: true } },
      },
    })
    if (!original) throw new NotFoundError('Receta Maestra no encontrada')

    const copia = await prisma.$transaction(async (tx) => {
      const creada = await tx.recetaMaestra.create({
        data: {
          codigo: parsed.data.codigo,
          descripcion: original.descripcion,
          version: original.version,
          idCentro: original.idCentro,
          idMaterial: original.idMaterial,
          idEstado: 4, // Creación — una nueva versión vuelve a pasar por Revisión y Aprobación, no hereda el estado del original.
          motivo: `Copiada de ${original.codigo}`,
          usuarioCreacion: req.auth!.login,
          usuarioModificacion: req.auth!.login,
          procesos: {
            create: original.procesos.map((p) => ({
              idProceso: p.idProceso,
              orden: p.orden,
              detalles: { create: p.detalles.map((d) => ({ idDetalle: d.idDetalle, orden: d.orden })) },
            })),
          },
        },
        include: listInclude,
      })
      await logAudit(tx, {
        entidad: 'RecetaMaestra', idEntidad: creada.idRecetaMaestra, descripcionEntidad: `${creada.codigo} — ${creada.descripcion}`,
        accion: 'CREAR', modulo: 'recetas-maestras', motivo: `Copiada de ${original.codigo}`,
        actor: await actorDe(tx, req.auth!.idUsuario),
      })
      return creada
    })
    res.json({ estado: true, mensaje: `Copiada como ${parsed.data.codigo}`, datos: copia })
  })
)

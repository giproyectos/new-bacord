import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db/prisma.js'
import { requireModuloEditar } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors.js'
import { getEstructuraProcesos, recomputePorcentajeAvance } from '../services/batchRecordProgress.js'
import { logAudit, actorDe, type AuditCambio } from '../services/audit.js'
import { findFirmaSeccionEstrategia } from '../services/formioSchema.js'
import { verificarPin } from '../services/pin.js'

export const batchRecordsRouter = Router()

batchRecordsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { idEstado, idCentro } = req.query
    const where: Record<string, unknown> = {}
    if (typeof idEstado === 'string' && idEstado) where.idEstado = Number(idEstado)
    if (typeof idCentro === 'string' && idCentro) where.idCentro = Number(idCentro)
    res.json(await prisma.batchRecord.findMany({ where, orderBy: { fechaCreacion: 'desc' } }))
  })
)

batchRecordsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const br = await prisma.batchRecord.findUnique({ where: { idBatchRecord: Number(req.params.id) } })
    if (!br) throw new NotFoundError('Batch Record no encontrado')
    res.json(br)
  })
)

/** Datos de cabecera derivados de la Orden de Proceso — reemplaza la tabla PreLlenadoBR del mock. */
batchRecordsRouter.get(
  '/:id/prellenado',
  asyncHandler(async (req, res) => {
    const br = await prisma.batchRecord.findUnique({
      where: { idBatchRecord: Number(req.params.id) },
      include: { ordenProceso: { include: { componentes: true } } },
    })
    if (!br) throw new NotFoundError('Batch Record no encontrado')
    const op = br.ordenProceso
    res.json({
      idBatchRecord: br.idBatchRecord,
      numeroOrdenProceso: op.numeroOrdenProceso,
      codigoMaterial: op.codigoMaterial,
      descripcionMaterial: op.descripcionMaterial,
      loteLogistico: op.loteLogistico,
      loteInspeccion: op.loteInspeccion,
      fechaFabricacion: op.fechaFabricacion,
      fechaCaducidad: op.fechaCaducidad,
      registroSanitario: op.registroSanitario,
      formaFarmaceutica: op.formaFarmaceutica,
      cantidadOrden: op.cantidadOrden,
      unidadMedida: op.unidadMedida,
      componentes: op.componentes,
    })
  })
)

/** Estructura (procesos + detalles, con schema Form.io) de la receta que ejecuta este BR. */
batchRecordsRouter.get(
  '/:id/estructura',
  asyncHandler(async (req, res) => {
    const br = await prisma.batchRecord.findUnique({ where: { idBatchRecord: Number(req.params.id) } })
    if (!br) throw new NotFoundError('Batch Record no encontrado')
    res.json(await getEstructuraProcesos(prisma, br.idRecetaMaestra))
  })
)

async function assertDetalleEnReceta(idRecetaMaestra: number, idDetalle: number) {
  const rd = await prisma.recetaDetalle.findFirst({
    where: { idDetalle, recetaProceso: { idRecetaMaestra } },
    include: { recetaProceso: true },
  })
  if (!rd) throw new ValidationError('Ese detalle no pertenece a la estructura de esta receta')
  return rd
}

function assertEnProceso(br: { idEstado: number }) {
  if (br.idEstado !== 1) throw new ConflictError('El Batch Record no está en proceso (ya fue finalizado, liberado o cancelado)')
}

// ── Datos de formulario por paso ─────────────────────────────────────────────

batchRecordsRouter.get(
  '/:id/detalles',
  asyncHandler(async (req, res) => {
    res.json(await prisma.batchRecordDetalleData.findMany({ where: { idBatchRecord: Number(req.params.id) } }))
  })
)

const detalleDataSchema = z.object({ jsonData: z.string() })

batchRecordsRouter.put(
  '/:id/detalles/:idDetalle',
  requireModuloEditar('batch-records'),
  asyncHandler(async (req, res) => {
    const parsed = detalleDataSchema.safeParse(req.body)
    if (!parsed.success) throw new ValidationError(parsed.error.message)
    const idBatchRecord = Number(req.params.id)
    const idDetalle = Number(req.params.idDetalle)

    const br = await prisma.batchRecord.findUnique({ where: { idBatchRecord } })
    if (!br) throw new NotFoundError('Batch Record no encontrado')
    assertEnProceso(br)
    await assertDetalleEnReceta(br.idRecetaMaestra, idDetalle)

    const datos = await prisma.batchRecordDetalleData.upsert({
      where: { idBatchRecord_idDetalle: { idBatchRecord, idDetalle } },
      update: { jsonData: parsed.data.jsonData },
      create: { idBatchRecord, idDetalle, jsonData: parsed.data.jsonData },
    })
    res.json({ estado: true, mensaje: 'Guardado', datos })
  })
)

// ── Cierre de etapas (procesos) ──────────────────────────────────────────────

batchRecordsRouter.get(
  '/:id/procesos-cerrados',
  asyncHandler(async (req, res) => {
    res.json(await prisma.batchRecordProcesoCierre.findMany({ where: { idBatchRecord: Number(req.params.id) } }))
  })
)

batchRecordsRouter.post(
  '/:id/procesos/:idProceso/cerrar',
  requireModuloEditar('batch-records'),
  asyncHandler(async (req, res) => {
    const idBatchRecord = Number(req.params.id)
    const idProceso = Number(req.params.idProceso)

    const br = await prisma.batchRecord.findUnique({ where: { idBatchRecord } })
    if (!br) throw new NotFoundError('Batch Record no encontrado')
    // No se usa assertEnProceso (exige idEstado === 1) porque firmar el último detalle de toda
    // la receta —en cualquier etapa— ya deja el BR en Finalizado (2) antes de que se alcance a
    // cerrar la etapa que lo contiene; bloquear el cierre en ese momento haría imposible cerrar
    // la última etapa. Cancelado (3) y Liberado (4) sí siguen bloqueados.
    if (br.idEstado === 3 || br.idEstado === 4) {
      throw new ConflictError('El Batch Record no está en proceso (ya fue cancelado o liberado)')
    }

    const estructura = await getEstructuraProcesos(prisma, br.idRecetaMaestra)
    const idx = estructura.findIndex((p) => p.idProceso === idProceso)
    if (idx === -1) throw new ValidationError('Ese proceso no pertenece a la estructura de esta receta')
    if (idx > 0) {
      const previoCerrado = await prisma.batchRecordProcesoCierre.findUnique({
        where: { idBatchRecord_idProceso: { idBatchRecord, idProceso: estructura[idx - 1].idProceso } },
      })
      if (!previoCerrado) throw new ConflictError('Debe cerrar la etapa anterior primero')
    }

    // El frontend ya deshabilita "Cerrar Proceso" hasta que todas las firmas de cierre de esta
    // etapa estén completas, pero esa regla no estaba repetida acá — llamando el endpoint
    // directo se podía cerrar (y así bloquear el orden secuencial de) una etapa sin firmar.
    const requeridas = new Set<string>()
    for (const rd of estructura[idx].detalles) {
      for (const f of rd.detalle.estrategiaFirma?.firmas ?? []) requeridas.add(`${rd.idDetalle}:${f.idFirma}`)
    }
    if (requeridas.size > 0) {
      const firmadas = await prisma.batchRecordFirma.findMany({
        where: { idBatchRecord, idDetalle: { in: estructura[idx].detalles.map((rd) => rd.idDetalle) }, bloqueKey: '' },
        select: { idDetalle: true, idFirma: true },
      })
      const hechas = new Set(firmadas.map((f) => `${f.idDetalle}:${f.idFirma}`))
      if ([...requeridas].some((r) => !hechas.has(r))) {
        throw new ConflictError('Faltan firmas de cierre en esta etapa para poder cerrarla')
      }
    }

    const cierre = await prisma.batchRecordProcesoCierre.upsert({
      where: { idBatchRecord_idProceso: { idBatchRecord, idProceso } },
      update: {},
      create: { idBatchRecord, idProceso, idUsuario: req.auth!.idUsuario },
    })
    res.json({ estado: true, mensaje: 'Etapa cerrada', datos: cierre })
  })
)

// ── Firmas electrónicas ──────────────────────────────────────────────────────

batchRecordsRouter.get(
  '/:id/firmas',
  asyncHandler(async (req, res) => {
    const firmas = await prisma.batchRecordFirma.findMany({
      where: { idBatchRecord: Number(req.params.id) },
      include: { usuario: { select: { nombres: true, apellidos: true, login: true } }, firma: { include: { grupo: true } } },
      orderBy: { firmadoEn: 'asc' },
    })
    res.json(firmas)
  })
)

const firmarSchema = z.object({
  idDetalle: z.number().int(),
  idFirma: z.number().int(),
  bloqueKey: z.string().optional(),
  login: z.string().min(1),
  pin: z.string().min(1),
})

batchRecordsRouter.post(
  '/:id/firmas',
  requireModuloEditar('batch-records'),
  asyncHandler(async (req, res) => {
    const parsed = firmarSchema.safeParse(req.body)
    if (!parsed.success) throw new ValidationError(parsed.error.message)
    const idBatchRecord = Number(req.params.id)
    const { idDetalle, idFirma, login, pin } = parsed.data
    const bloqueKey = parsed.data.bloqueKey ?? ''

    const br = await prisma.batchRecord.findUnique({ where: { idBatchRecord } })
    if (!br) throw new NotFoundError('Batch Record no encontrado')
    assertEnProceso(br)

    await assertDetalleEnReceta(br.idRecetaMaestra, idDetalle)
    const detalle = await prisma.detalle.findUnique({
      where: { id: idDetalle },
      include: { estrategiaFirma: { include: { firmas: { where: { activo: true } } } } },
    })
    if (!detalle) throw new NotFoundError('Detalle no encontrado')

    // Firma de cierre del detalle (bloqueKey vacío) usa la estrategia del detalle;
    // una firma de un bloque intermedio del schema usa la estrategia declarada en ese bloque.
    let firmas = detalle.estrategiaFirma?.firmas ?? []
    if (bloqueKey) {
      const idEstrategiaBloque = findFirmaSeccionEstrategia(detalle.jsonSchema, bloqueKey)
      const estrategiaBloque = idEstrategiaBloque
        ? await prisma.estrategiaFirma.findUnique({ where: { id: idEstrategiaBloque }, include: { firmas: { where: { activo: true } } } })
        : null
      firmas = estrategiaBloque?.firmas ?? []
    }
    const firmaPermitida = firmas.find((f) => f.idFirma === idFirma)
    if (!firmaPermitida) throw new ValidationError('Esa firma no está permitida para este punto del formulario')

    const usuario = await prisma.usuario.findUnique({ where: { login }, include: { grupos: { include: { grupo: true } } } })
    if (!usuario || !usuario.activo || usuario.bloqueado) {
      return res.json({ estado: false, mensaje: 'Usuario no válido para firmar' })
    }
    const pinCheck = await verificarPin(prisma, usuario, pin)
    if (!pinCheck.ok) return res.json({ estado: false, mensaje: pinCheck.mensaje })

    if (!usuario.esAdministrador) {
      const requiereFirma = await prisma.firma.findUnique({ where: { idFirma }, include: { grupo: true } })
      const perteneceAlGrupo = usuario.grupos.some((g) => g.grupo.nombre === requiereFirma?.grupo.nombre)
      if (!perteneceAlGrupo) {
        return res.json({ estado: false, mensaje: `"${usuario.nombres} ${usuario.apellidos}" no pertenece al grupo "${requiereFirma?.grupo.nombre}"` })
      }
    }

    const yaFirmado = await prisma.batchRecordFirma.findUnique({
      where: { idBatchRecord_idDetalle_bloqueKey_idFirma: { idBatchRecord, idDetalle, bloqueKey, idFirma } },
    })
    if (yaFirmado) throw new ConflictError('Esta firma ya fue registrada')

    const firma = await prisma.$transaction(async (tx) => {
      const creada = await tx.batchRecordFirma.create({
        data: { idBatchRecord, idDetalle, bloqueKey, idFirma, idUsuario: usuario.idUsuario },
        include: { usuario: { select: { nombres: true, apellidos: true, login: true } }, firma: { include: { grupo: true } } },
      })
      if (!bloqueKey) await recomputePorcentajeAvance(tx, idBatchRecord)
      await logAudit(tx, {
        entidad: bloqueKey ? 'FirmaSeccion' : 'FirmaCierre', idEntidad: idBatchRecord,
        descripcionEntidad: `BR-${idBatchRecord} · ${detalle.descripcion}`,
        accion: bloqueKey ? 'FIRMAR_SECCION' : 'FIRMAR_CIERRE', modulo: 'batch-record', actor: await actorDe(tx, usuario.idUsuario),
      })
      return creada
    })

    res.status(201).json({ estado: true, mensaje: 'Firma registrada', datos: firma })
  })
)

const derogarSchema = z.object({ login: z.string().min(1), pin: z.string().min(1), motivo: z.string().min(1) })

batchRecordsRouter.post(
  '/:id/firmas/:idFirmaRegistro/derogar',
  requireModuloEditar('batch-records'),
  asyncHandler(async (req, res) => {
    const parsed = derogarSchema.safeParse(req.body)
    if (!parsed.success) throw new ValidationError(parsed.error.message)
    const { login, pin, motivo } = parsed.data
    const idBatchRecord = Number(req.params.id)
    const idFirmaRegistro = Number(req.params.idFirmaRegistro)

    const br = await prisma.batchRecord.findUnique({ where: { idBatchRecord } })
    if (!br) throw new NotFoundError('Batch Record no encontrado')
    // A diferencia de Finalizado (2) — que sí se puede reabrir derogando su firma de cierre,
    // más abajo —, Cancelado (3) y Liberado (4) son estados terminales: derogar ahí borraría
    // evidencia de un lote ya cerrado o ya liberado al mercado, sin forma de dejarlo consistente.
    if (br.idEstado === 3 || br.idEstado === 4) {
      throw new ConflictError('No se puede derogar una firma de un Batch Record cancelado o liberado')
    }

    const registro = await prisma.batchRecordFirma.findUnique({
      where: { id: idFirmaRegistro },
      include: { usuario: true, firma: true },
    })
    if (!registro || registro.idBatchRecord !== idBatchRecord) throw new NotFoundError('Firma no encontrada')

    const detalle = await prisma.detalle.findUniqueOrThrow({ where: { id: registro.idDetalle } })

    // Derogar revoca evidencia de firma — exige re-autenticación explícita con PIN, igual que
    // firmar o liberar, en vez de confiar en que la sesión del navegador siga siendo de la
    // misma persona (riesgo real en un equipo compartido en planta).
    const solicitante = await prisma.usuario.findUnique({ where: { login }, include: { grupos: { include: { grupo: true } } } })
    if (!solicitante || !solicitante.activo || solicitante.bloqueado) {
      return res.json({ estado: false, mensaje: 'Usuario no válido para derogar' })
    }
    const pinCheck = await verificarPin(prisma, solicitante, pin)
    if (!pinCheck.ok) return res.json({ estado: false, mensaje: pinCheck.mensaje })

    if (!solicitante.esAdministrador) {
      const idEstrategia = registro.bloqueKey
        ? findFirmaSeccionEstrategia(detalle.jsonSchema, registro.bloqueKey)
        : detalle.idEstrategiaFirma
      const estrategia = idEstrategia ? await prisma.estrategiaFirma.findUnique({ where: { id: idEstrategia } }) : null
      const gruposDerogacion = estrategia?.gruposDerogacion?.split(',').filter(Boolean) ?? []
      const puedeDerogar = solicitante.grupos.some((g) => gruposDerogacion.includes(g.grupo.nombre))
      if (!puedeDerogar) throw new ForbiddenError('No tiene permisos para derogar esta firma')
    }

    // El registro se borra físicamente de BatchRecordFirma — este snapshot queda en el propio
    // evento de auditoría para que sea autosuficiente (quién firmó, qué firma y cuándo) sin
    // depender de cruzarlo con el evento FIRMAR_SECCION/FIRMAR_CIERRE original.
    const cambios: AuditCambio[] = [
      {
        campo: 'firmante', etiqueta: 'Firmada por',
        valorAnterior: `${registro.usuario.nombres} ${registro.usuario.apellidos} (${registro.usuario.login})`,
        valorNuevo: '',
      },
      { campo: 'firmadoEn', etiqueta: 'Firmada el', valorAnterior: registro.firmadoEn.toISOString(), valorNuevo: '' },
      { campo: 'firma', etiqueta: 'Firma revocada', valorAnterior: `${registro.firma.codigo} — ${registro.firma.descripcion}`, valorNuevo: '' },
    ]

    await prisma.$transaction(async (tx) => {
      await tx.batchRecordFirma.delete({ where: { id: idFirmaRegistro } })
      if (!registro.bloqueKey) {
        await recomputePorcentajeAvance(tx, idBatchRecord)
        // Derogar una firma de cierre reabre el BR si ya estaba Finalizado.
        if (br.idEstado === 2) await tx.batchRecord.update({ where: { idBatchRecord }, data: { idEstado: 1 } })
      }
      await logAudit(tx, {
        entidad: registro.bloqueKey ? 'FirmaSeccion' : 'FirmaCierre', idEntidad: idBatchRecord,
        descripcionEntidad: `BR-${idBatchRecord} · ${detalle.descripcion}`,
        accion: 'DEROGAR_FIRMA', modulo: 'batch-record', motivo, cambios,
        actor: await actorDe(tx, solicitante.idUsuario),
      })
    })

    res.json({ estado: true, mensaje: 'Firma derogada' })
  })
)

// ── Liberación y cancelación ─────────────────────────────────────────────────

batchRecordsRouter.get(
  '/:id/liberacion',
  asyncHandler(async (req, res) => {
    const liberacion = await prisma.batchRecordLiberacion.findUnique({
      where: { idBatchRecord: Number(req.params.id) },
      include: { usuario: { select: { nombres: true, apellidos: true, login: true } } },
    })
    res.json(liberacion)
  })
)

const liberarSchema = z.object({ login: z.string().min(1), pin: z.string().min(1), observacion: z.string().optional() })

batchRecordsRouter.post(
  '/:id/liberar',
  requireModuloEditar('batch-records'),
  asyncHandler(async (req, res) => {
    const parsed = liberarSchema.safeParse(req.body)
    if (!parsed.success) throw new ValidationError(parsed.error.message)
    const idBatchRecord = Number(req.params.id)
    const { login, pin, observacion } = parsed.data

    const br = await prisma.batchRecord.findUnique({ where: { idBatchRecord } })
    if (!br) throw new NotFoundError('Batch Record no encontrado')
    if (br.idEstado !== 2) throw new ConflictError('El Batch Record debe estar Finalizado (todas las firmas de cierre completas) antes de liberarse')

    // Liberar el lote es un evento crítico GMP: exige re-autenticación explícita del firmante, igual que una firma.
    const usuario = await prisma.usuario.findUnique({ where: { login } })
    if (!usuario || !usuario.activo || usuario.bloqueado) {
      return res.json({ estado: false, mensaje: 'Usuario no válido para liberar el lote' })
    }
    const pinCheck = await verificarPin(prisma, usuario, pin)
    if (!pinCheck.ok) return res.json({ estado: false, mensaje: pinCheck.mensaje })

    const liberacion = await prisma.$transaction(async (tx) => {
      const creada = await tx.batchRecordLiberacion.create({
        data: { idBatchRecord, idUsuario: usuario.idUsuario, observacion },
        include: { usuario: { select: { nombres: true, apellidos: true, login: true } } },
      })
      await tx.batchRecord.update({ where: { idBatchRecord }, data: { idEstado: 4 } })
      await logAudit(tx, {
        entidad: 'BatchRecord', idEntidad: idBatchRecord, descripcionEntidad: `BR-${idBatchRecord}`,
        accion: 'LIBERAR_LOTE', modulo: 'batch-record', actor: await actorDe(tx, usuario.idUsuario),
      })
      return creada
    })
    res.status(201).json({ estado: true, mensaje: 'Lote liberado', datos: liberacion })
  })
)

const cancelarSchema = z.object({ login: z.string().min(1), pin: z.string().min(1), motivo: z.string().min(1) })

batchRecordsRouter.post(
  '/:id/cancelar',
  requireModuloEditar('batch-records'),
  asyncHandler(async (req, res) => {
    const parsed = cancelarSchema.safeParse(req.body)
    if (!parsed.success) throw new ValidationError(parsed.error.message)
    const { login, pin, motivo } = parsed.data
    const idBatchRecord = Number(req.params.id)

    const actual = await prisma.batchRecord.findUnique({ where: { idBatchRecord } })
    if (!actual) throw new NotFoundError('Batch Record no encontrado')
    // Cancelado (3) ya está en el estado que se pediría — y Liberado (4) es un estado terminal:
    // el lote ya fue aprobado y distribuido, cancelarlo después borraría esa aprobación sin dejar
    // ningún rastro de que existió (a diferencia de un recall formal, que es un proceso aparte).
    if (actual.idEstado === 3 || actual.idEstado === 4) {
      throw new ConflictError('No se puede cancelar un Batch Record ya cancelado o liberado')
    }

    // Cancelar un lote es un evento crítico GMP — exige re-autenticación explícita con PIN,
    // igual que firmar, liberar o derogar una firma.
    const solicitante = await prisma.usuario.findUnique({ where: { login } })
    if (!solicitante || !solicitante.activo || solicitante.bloqueado) {
      return res.json({ estado: false, mensaje: 'Usuario no válido para cancelar' })
    }
    const pinCheck = await verificarPin(prisma, solicitante, pin)
    if (!pinCheck.ok) return res.json({ estado: false, mensaje: pinCheck.mensaje })

    const br = await prisma.$transaction(async (tx) => {
      const actualizado = await tx.batchRecord.update({
        where: { idBatchRecord },
        data: { idEstado: 3, motivoEstado: motivo, idUsuarioModificacion: solicitante.idUsuario },
      })
      await logAudit(tx, {
        entidad: 'BatchRecord', idEntidad: idBatchRecord, descripcionEntidad: `BR-${idBatchRecord}`,
        accion: 'CANCELAR', modulo: 'batch-record', motivo, actor: await actorDe(tx, solicitante.idUsuario),
      })
      return actualizado
    })
    res.json({ estado: true, mensaje: 'Batch Record cancelado', datos: br })
  })
)

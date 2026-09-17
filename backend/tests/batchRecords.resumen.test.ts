import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { app } from '../src/app.js'
import { resetDb, prisma } from './helpers/db.js'
import { crearEscenarioBasico } from './helpers/fixtures.js'
import { tokenPara } from './helpers/auth.js'

beforeEach(async () => {
  await resetDb()
})

// El Dashboard (página de inicio) no puede cargar el historial completo de Batch Records en cada
// visita — GET / ahora incluye el material de la Orden de Proceso directamente (evita una consulta
// aparte de todo el historial de Órdenes de Proceso solo para unir dos campos), y GET /resumen
// calcula los agregados (conteos por estado, top de materiales, últimos 6) en el servidor.
describe('GET /api/batch-records — incluye el material de la Orden de Proceso', () => {
  it('trae codigoMaterial y descripcionMaterial embebidos, sin pedir Órdenes de Proceso aparte', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)

    const res = await request(app).get('/api/batch-records').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    const br = res.body.find((b: { idBatchRecord: number }) => b.idBatchRecord === esc.batchRecord.idBatchRecord)
    expect(br.ordenProceso).toEqual({
      codigoMaterial: esc.material.codigo,
      descripcionMaterial: esc.material.descripcion,
    })
  })

  it('ultimaActividad refleja guardar un campo del formulario, aunque fechaModificacion no cambie', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)

    const antes = await request(app).get('/api/batch-records').set('Authorization', `Bearer ${token}`)
    const fechaModificacionAntes = antes.body.find((b: { idBatchRecord: number }) => b.idBatchRecord === esc.batchRecord.idBatchRecord).fechaModificacion

    // Guardar un campo del formulario no toca BatchRecord.fechaModificacion — solo queda
    // registrado en el audit trail (DetalleValores).
    await request(app)
      .put(`/api/batch-records/${esc.batchRecord.idBatchRecord}/detalles/${esc.procesos[0].idDetalle}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ jsonData: JSON.stringify({ temperatura: '22' }) })

    const despues = await request(app).get('/api/batch-records').set('Authorization', `Bearer ${token}`)
    const br = despues.body.find((b: { idBatchRecord: number }) => b.idBatchRecord === esc.batchRecord.idBatchRecord)

    expect(br.fechaModificacion).toBe(fechaModificacionAntes)
    expect(new Date(br.ultimaActividad).getTime()).toBeGreaterThan(new Date(fechaModificacionAntes).getTime())
  })
})

describe('GET /api/batch-records/resumen', () => {
  it('devuelve conteos por estado y top de materiales', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)

    const res = await request(app).get('/api/batch-records/resumen').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.total).toBe(1)
    expect(res.body.porEstado).toEqual({ '1': 1, '2': 0, '3': 0, '4': 0 })
    expect(res.body.porMaterial).toEqual([{ codigoMaterial: esc.material.codigo, cantidad: 1 }])
    // El lote recién creado por el fixture (vía Prisma directo, no por la API) no deja ningún
    // evento en el audit trail — a diferencia de `recientes` (antes: últimos BR por fecha de
    // creación), `actividadReciente` solo muestra acciones reales, así que acá empieza vacío.
    expect(res.body.actividadReciente).toEqual([])
  })

  it('actividadReciente refleja eventos reales del audit trail, no solo lotes recién creados', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)

    await request(app)
      .put(`/api/batch-records/${esc.batchRecord.idBatchRecord}/detalles/${esc.procesos[0].idDetalle}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ jsonData: JSON.stringify({ temperatura: '22' }) })

    const res = await request(app).get('/api/batch-records/resumen').set('Authorization', `Bearer ${token}`)

    expect(res.body.actividadReciente).toHaveLength(1)
    expect(res.body.actividadReciente[0]).toMatchObject({
      idBatchRecord: esc.batchRecord.idBatchRecord,
      accion: 'MODIFICAR',
      loginUsuario: esc.usuarioAdmin.login,
      codigoMaterial: esc.material.codigo,
    })
  })

  it('actividadReciente se acota por idCentro cuando se filtra', async () => {
    // crearEscenarioBasico() usa códigos fijos (Centro, Material, etc.) — no se puede llamar dos
    // veces en la misma prueba. Se arma un segundo Centro con un segundo Batch Record a mano,
    // reutilizando la Receta/Orden de Proceso del fixture (idCentro no exige consistencia entre
    // BatchRecord y su Receta/Orden en el modelo real).
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)

    const centroB = await prisma.centro.create({ data: { codigo: 'C-TEST-B', descripcion: 'Centro B' } })
    const formulaControlB = await prisma.formulaControl.create({
      data: {
        idRecetaMaestra: esc.recetaMaestra.idRecetaMaestra, idOrdenProceso: esc.ordenProceso.idOrdenProceso,
        idCentro: centroB.id, idUsuarioCreacion: esc.usuarioAdmin.idUsuario,
      },
    })
    const batchRecordB = await prisma.batchRecord.create({
      data: {
        idFormulaControl: formulaControlB.idFormulaControl, idRecetaMaestra: esc.recetaMaestra.idRecetaMaestra,
        idOrdenProceso: esc.ordenProceso.idOrdenProceso, idCentro: centroB.id,
        idUsuarioCreacion: esc.usuarioAdmin.idUsuario, idUsuarioModificacion: esc.usuarioAdmin.idUsuario,
      },
    })

    await request(app)
      .put(`/api/batch-records/${esc.batchRecord.idBatchRecord}/detalles/${esc.procesos[0].idDetalle}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ jsonData: JSON.stringify({ temperatura: '10' }) })
    await request(app)
      .put(`/api/batch-records/${batchRecordB.idBatchRecord}/detalles/${esc.procesos[0].idDetalle}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ jsonData: JSON.stringify({ temperatura: '20' }) })

    const res = await request(app)
      .get(`/api/batch-records/resumen?idCentro=${esc.centro.id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.body.actividadReciente).toHaveLength(1)
    expect(res.body.actividadReciente[0]).toMatchObject({
      idBatchRecord: esc.batchRecord.idBatchRecord,
      codigoMaterial: esc.material.codigo,
    })
  })

  it('`dias` acota por fecha de creación — un lote más viejo que la ventana no cuenta', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    await prisma.batchRecord.update({
      where: { idBatchRecord: esc.batchRecord.idBatchRecord },
      data: { fechaCreacion: new Date(Date.now() - 60 * 86400000) },
    })

    const dentro = await request(app).get('/api/batch-records/resumen?dias=90').set('Authorization', `Bearer ${token}`)
    expect(dentro.body.total).toBe(1)

    const fuera = await request(app).get('/api/batch-records/resumen?dias=30').set('Authorization', `Bearer ${token}`)
    expect(fuera.body.total).toBe(0)
  })

  it('tiempoCicloPromedioDias promedia creación → liberación de los lotes liberados en el alcance', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    const fechaCreacion = new Date(Date.now() - 5 * 86400000)
    await prisma.batchRecord.update({
      where: { idBatchRecord: esc.batchRecord.idBatchRecord },
      data: { fechaCreacion, idEstado: 4 },
    })
    await prisma.batchRecordLiberacion.create({
      data: { idBatchRecord: esc.batchRecord.idBatchRecord, idUsuario: esc.usuarioAdmin.idUsuario, liberadoEn: new Date() },
    })

    const res = await request(app).get('/api/batch-records/resumen').set('Authorization', `Bearer ${token}`)

    expect(res.body.lotesLiberadosEnAlcance).toBe(1)
    expect(res.body.tiempoCicloPromedioDias).toBeCloseTo(5, 0)
  })

  it('desviacionesAbiertas cuenta las desviaciones sin cerrar', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    await request(app)
      .post('/api/desviaciones')
      .set('Authorization', `Bearer ${token}`)
      .send({
        idBatchRecord: esc.batchRecord.idBatchRecord, idDetalle: esc.procesos[0].idDetalle,
        campo: 'peso', labelCampo: 'Peso', valorIngresado: '999', limiteInfo: 'Máximo 100',
        descripcion: 'Justificación de la desviación',
      })

    const res = await request(app).get('/api/batch-records/resumen').set('Authorization', `Bearer ${token}`)

    expect(res.body.desviacionesAbiertas).toBe(1)
  })
})

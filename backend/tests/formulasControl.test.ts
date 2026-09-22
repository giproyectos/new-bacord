import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { app } from '../src/app.js'
import { resetDb, prisma } from './helpers/db.js'
import { crearEscenarioBasico } from './helpers/fixtures.js'
import { tokenPara } from './helpers/auth.js'

beforeEach(async () => {
  await resetDb()
})

async function crearOrdenPropia(esc: Awaited<ReturnType<typeof crearEscenarioBasico>>, numero: string) {
  // La Receta Maestra de la fixture nace en Creación (idEstado 4, ver fixtures.ts) — se activa acá
  // porque estos tests crean la Orden directo por Prisma (sin pasar por el endpoint que valida
  // idEstado) y luego sí crean la Fórmula de Control por la API, que exige la receta Activa.
  await prisma.recetaMaestra.update({ where: { idRecetaMaestra: esc.recetaMaestra.idRecetaMaestra }, data: { idEstado: 1 } })
  return prisma.ordenProceso.create({
    data: {
      idRecetaMaestra: esc.recetaMaestra.idRecetaMaestra,
      numeroOrdenProceso: numero,
      codigoMaterial: esc.material.codigo, descripcionMaterial: esc.material.descripcion,
      idCentro: esc.centro.id, loteLogistico: 'LOTE-FC', cantidadOrden: 10, unidadMedida: 'kg',
      loteInspeccion: 'INSP-FC', fechaFabricacion: new Date(), fechaCaducidad: new Date(Date.now() + 365 * 86400000),
      registroSanitario: 'RS-FC', formaFarmaceutica: 'Comprimido',
    },
  })
}

// A diferencia de /enviar (que sí valida idEstado !== 1), /cancelar no tenía ningún chequeo de
// estado — se podía cancelar una FC ya Enviada a Producción, dejando huérfano el Batch Record que
// ya generó (relación 1:1) y reseteando la Orden de Proceso a Pendiente como si nunca se hubiera usado.
describe('POST /api/formulas-control/:id/cancelar — validación de estado', () => {
  it('rechaza cancelar una FC ya Enviada a Producción (que ya generó su Batch Record)', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    const orden = await crearOrdenPropia(esc, 'OP-FC-TEST-1')

    const resCrear = await request(app)
      .post('/api/formulas-control')
      .set('Authorization', `Bearer ${token}`)
      .send({ idOrdenProceso: orden.idOrdenProceso })
    const idFormulaControl = resCrear.body.idFormulaControl

    const resEnviar = await request(app)
      .post(`/api/formulas-control/${idFormulaControl}/enviar`)
      .set('Authorization', `Bearer ${token}`)
    expect(resEnviar.status).toBe(200)
    const idBatchRecord = resEnviar.body.idBatchRecord

    const resCancelar = await request(app)
      .post(`/api/formulas-control/${idFormulaControl}/cancelar`)
      .set('Authorization', `Bearer ${token}`)
      .send({ motivo: 'Intento de cancelación' })
    expect(resCancelar.status).toBe(409)

    const fc = await prisma.formulaControl.findUniqueOrThrow({ where: { idFormulaControl } })
    expect(fc.idEstado).toBe(2) // sigue Enviada, no Cancelada
    const ordenActual = await prisma.ordenProceso.findUniqueOrThrow({ where: { idOrdenProceso: orden.idOrdenProceso } })
    expect(ordenActual.idEstado).toBe(3) // sigue "En BR", no se reseteó a Pendiente
    const br = await prisma.batchRecord.findUniqueOrThrow({ where: { idBatchRecord } })
    expect(br.idFormulaControl).toBe(idFormulaControl) // el Batch Record sigue vinculado, no quedó huérfano
  })

  it('rechaza cancelar una FC que ya está Cancelada', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    const orden = await crearOrdenPropia(esc, 'OP-FC-TEST-2')

    const resCrear = await request(app)
      .post('/api/formulas-control')
      .set('Authorization', `Bearer ${token}`)
      .send({ idOrdenProceso: orden.idOrdenProceso })
    const idFormulaControl = resCrear.body.idFormulaControl

    const primera = await request(app)
      .post(`/api/formulas-control/${idFormulaControl}/cancelar`)
      .set('Authorization', `Bearer ${token}`)
      .send({ motivo: 'Error en la orden' })
    expect(primera.status).toBe(204)

    const segunda = await request(app)
      .post(`/api/formulas-control/${idFormulaControl}/cancelar`)
      .set('Authorization', `Bearer ${token}`)
      .send({ motivo: 'Segundo intento' })
    expect(segunda.status).toBe(409)
  })

  it('permite cancelar una FC recién creada (En Tratamiento) y guarda el motivo', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    const orden = await crearOrdenPropia(esc, 'OP-FC-TEST-3')

    const resCrear = await request(app)
      .post('/api/formulas-control')
      .set('Authorization', `Bearer ${token}`)
      .send({ idOrdenProceso: orden.idOrdenProceso })
    const idFormulaControl = resCrear.body.idFormulaControl

    const res = await request(app)
      .post(`/api/formulas-control/${idFormulaControl}/cancelar`)
      .set('Authorization', `Bearer ${token}`)
      .send({ motivo: 'Material contaminado' })
    expect(res.status).toBe(204)

    const fc = await prisma.formulaControl.findUniqueOrThrow({ where: { idFormulaControl } })
    expect(fc.idEstado).toBe(3)
    expect(fc.motivoEstado).toBe('Material contaminado')
    const ordenActual = await prisma.ordenProceso.findUniqueOrThrow({ where: { idOrdenProceso: orden.idOrdenProceso } })
    expect(ordenActual.idEstado).toBe(1)
  })

  it('rechaza cancelar sin motivo', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    const orden = await crearOrdenPropia(esc, 'OP-FC-TEST-4')

    const resCrear = await request(app)
      .post('/api/formulas-control')
      .set('Authorization', `Bearer ${token}`)
      .send({ idOrdenProceso: orden.idOrdenProceso })
    const idFormulaControl = resCrear.body.idFormulaControl

    const res = await request(app)
      .post(`/api/formulas-control/${idFormulaControl}/cancelar`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
    expect(res.status).toBe(400)
  })
})

// La Receta Maestra puede Inactivarse (transición sin restricciones) después de que ya existe una
// Orden de Proceso pendiente para ella — sin este chequeo, esa orden todavía podía usarse para
// crear una Fórmula de Control, o una FC ya creada con una receta luego inactivada todavía podía
// enviarse a producción.
describe('Fórmula de Control — receta debe estar Activa', () => {
  it('rechaza crear una FC cuando la Receta Maestra de la Orden ya no está Activa', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    const orden = await crearOrdenPropia(esc, 'OP-FC-TEST-5')

    await prisma.recetaMaestra.update({ where: { idRecetaMaestra: esc.recetaMaestra.idRecetaMaestra }, data: { idEstado: 2 } })

    const res = await request(app)
      .post('/api/formulas-control')
      .set('Authorization', `Bearer ${token}`)
      .send({ idOrdenProceso: orden.idOrdenProceso })
    expect(res.status).toBe(409)

    const formulas = await prisma.formulaControl.findMany({ where: { idOrdenProceso: orden.idOrdenProceso } })
    expect(formulas).toHaveLength(0)
  })

  it('rechaza enviar a producción una FC cuya Receta Maestra fue Inactivada después de crearla', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    const orden = await crearOrdenPropia(esc, 'OP-FC-TEST-6')

    const resCrear = await request(app)
      .post('/api/formulas-control')
      .set('Authorization', `Bearer ${token}`)
      .send({ idOrdenProceso: orden.idOrdenProceso })
    const idFormulaControl = resCrear.body.idFormulaControl

    await prisma.recetaMaestra.update({ where: { idRecetaMaestra: esc.recetaMaestra.idRecetaMaestra }, data: { idEstado: 2 } })

    const res = await request(app)
      .post(`/api/formulas-control/${idFormulaControl}/enviar`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(409)

    const fc = await prisma.formulaControl.findUniqueOrThrow({ where: { idFormulaControl } })
    expect(fc.idEstado).toBe(1) // sigue En Tratamiento, no avanzó
    const br = await prisma.batchRecord.findFirst({ where: { idFormulaControl } })
    expect(br).toBeNull()
  })
})

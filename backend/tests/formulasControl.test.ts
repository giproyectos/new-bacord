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
    expect(primera.status).toBe(204)

    const segunda = await request(app)
      .post(`/api/formulas-control/${idFormulaControl}/cancelar`)
      .set('Authorization', `Bearer ${token}`)
    expect(segunda.status).toBe(409)
  })

  it('permite cancelar una FC recién creada (En Tratamiento)', async () => {
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
    expect(res.status).toBe(204)

    const fc = await prisma.formulaControl.findUniqueOrThrow({ where: { idFormulaControl } })
    expect(fc.idEstado).toBe(3)
    const ordenActual = await prisma.ordenProceso.findUniqueOrThrow({ where: { idOrdenProceso: orden.idOrdenProceso } })
    expect(ordenActual.idEstado).toBe(1)
  })
})

import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { app } from '../src/app.js'
import { resetDb } from './helpers/db.js'
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
})

describe('GET /api/batch-records/resumen', () => {
  it('devuelve conteos por estado, top de materiales y los últimos registros', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)

    const res = await request(app).get('/api/batch-records/resumen').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.total).toBe(1)
    expect(res.body.porEstado).toEqual({ '1': 1, '2': 0, '3': 0, '4': 0 })
    expect(res.body.porMaterial).toEqual([{ codigoMaterial: esc.material.codigo, cantidad: 1 }])
    expect(res.body.recientes).toHaveLength(1)
    expect(res.body.recientes[0]).toMatchObject({
      idBatchRecord: esc.batchRecord.idBatchRecord,
      idEstado: 1,
      codigoMaterial: esc.material.codigo,
    })
  })
})

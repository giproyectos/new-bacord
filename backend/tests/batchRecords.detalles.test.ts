import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { app } from '../src/app.js'
import { resetDb, prisma } from './helpers/db.js'
import { crearEscenarioBasico } from './helpers/fixtures.js'
import { tokenPara } from './helpers/auth.js'

beforeEach(async () => {
  await resetDb()
})

// El guardado de los valores de un Detalle (el dato GMP capturado en el batch record) ahora
// registra su propia auditoría en el servidor, calculada a partir de lo que ya había guardado —
// antes ese rastro dependía por completo de una segunda solicitud aparte iniciada por el
// navegador (POST /auditoria), que podía fallar en silencio sin que el guardado real se enterara.
describe('PUT /api/batch-records/:id/detalles/:idDetalle — auditoría server-side', () => {
  it('registra un evento DetalleValores con los campos nuevos al guardar por primera vez', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    const idDetalle = esc.procesos[0].idDetalle

    const res = await request(app)
      .put(`/api/batch-records/${esc.batchRecord.idBatchRecord}/detalles/${idDetalle}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ jsonData: JSON.stringify({ temperatura: '22' }), labels: { temperatura: 'Temperatura (°C)' } })

    expect(res.status).toBe(200)
    const evento = await prisma.auditEntry.findFirstOrThrow({
      where: { entidad: 'DetalleValores', idEntidad: String(esc.batchRecord.idBatchRecord) },
    })
    expect(evento.accion).toBe('MODIFICAR')
    const cambios = JSON.parse(evento.cambios ?? '[]')
    expect(cambios).toEqual([{ campo: 'temperatura', etiqueta: 'Temperatura (°C)', valorAnterior: '', valorNuevo: '22' }])
  })

  it('el diff del segundo guardado refleja el valor anterior real, no lo que el cliente afirme', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    const idDetalle = esc.procesos[0].idDetalle
    const url = `/api/batch-records/${esc.batchRecord.idBatchRecord}/detalles/${idDetalle}`

    await request(app).put(url).set('Authorization', `Bearer ${token}`).send({ jsonData: JSON.stringify({ temperatura: '22' }) })
    const res = await request(app).put(url).set('Authorization', `Bearer ${token}`).send({ jsonData: JSON.stringify({ temperatura: '25' }) })

    expect(res.status).toBe(200)
    const eventos = await prisma.auditEntry.findMany({
      where: { entidad: 'DetalleValores', idEntidad: String(esc.batchRecord.idBatchRecord) },
      orderBy: { timestamp: 'asc' },
    })
    expect(eventos).toHaveLength(2)
    const cambios = JSON.parse(eventos[1].cambios ?? '[]')
    expect(cambios).toEqual([{ campo: 'temperatura', etiqueta: 'temperatura', valorAnterior: '22', valorNuevo: '25' }])
  })

  it('no registra ningún evento si se guarda exactamente el mismo dato', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    const idDetalle = esc.procesos[0].idDetalle
    const url = `/api/batch-records/${esc.batchRecord.idBatchRecord}/detalles/${idDetalle}`

    await request(app).put(url).set('Authorization', `Bearer ${token}`).send({ jsonData: JSON.stringify({ temperatura: '22' }) })
    await request(app).put(url).set('Authorization', `Bearer ${token}`).send({ jsonData: JSON.stringify({ temperatura: '22' }) })

    const eventos = await prisma.auditEntry.findMany({ where: { entidad: 'DetalleValores' } })
    expect(eventos).toHaveLength(1)
  })

  it('guarda el dato aunque no se pueda calcular auditoría de un jsonData corrupto', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    const idDetalle = esc.procesos[0].idDetalle

    const res = await request(app)
      .put(`/api/batch-records/${esc.batchRecord.idBatchRecord}/detalles/${idDetalle}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ jsonData: '{not valid json' })

    expect(res.status).toBe(200)
    const guardado = await prisma.batchRecordDetalleData.findUniqueOrThrow({
      where: { idBatchRecord_idDetalle: { idBatchRecord: esc.batchRecord.idBatchRecord, idDetalle } },
    })
    expect(guardado.jsonData).toBe('{not valid json')
  })
})

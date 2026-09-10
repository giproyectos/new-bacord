import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { app } from '../src/app.js'
import { resetDb, prisma } from './helpers/db.js'
import { crearEscenarioBasico } from './helpers/fixtures.js'
import { tokenPara } from './helpers/auth.js'

beforeEach(async () => {
  await resetDb()
})

describe('POST /api/desviaciones', () => {
  it('registra una desviación y la deja en el historial de auditoría', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)

    const res = await request(app)
      .post('/api/desviaciones')
      .set('Authorization', `Bearer ${token}`)
      .send({
        idBatchRecord: esc.batchRecord.idBatchRecord,
        idDetalle: esc.procesos[0].idDetalle,
        campo: 'peso', labelCampo: 'Peso',
        valorIngresado: '999', limiteInfo: 'Máximo 100',
        descripcion: 'Justificación de la desviación',
      })

    expect(res.status).toBe(201)
    expect(res.body.estado).toBe(true)
    expect(res.body.datos.estado).toBe('abierta')

    const evento = await prisma.auditEntry.findFirstOrThrow({ where: { accion: 'REGISTRAR_DESVIACION' } })
    expect(evento.entidad).toBe('Desviacion')
    expect(evento.motivo).toBe('Justificación de la desviación')
  })
})

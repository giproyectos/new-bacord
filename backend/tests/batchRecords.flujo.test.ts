import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import { app } from '../src/app.js'
import { resetDb, prisma } from './helpers/db.js'
import { crearEscenarioBasico, PIN_PLANO } from './helpers/fixtures.js'
import { tokenPara } from './helpers/auth.js'

// Cubre los tres flujos identificados como críticos en el plan de mejoras: firmar un paso,
// cerrar una etapa del batch record, y liberar el lote — con sus principales barreras de
// negocio (GMP: no se puede firmar dos veces, no se puede saltar una etapa, no se libera antes
// de estar Finalizado).

beforeEach(async () => {
  await resetDb()
})

describe('POST /api/batch-records/:id/firmas', () => {
  it('firma un paso con PIN correcto, y al completar el 100% pasa el BR a Finalizado', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)

    const res = await request(app)
      .post(`/api/batch-records/${esc.batchRecord.idBatchRecord}/firmas`)
      .set('Authorization', `Bearer ${token}`)
      .send({ idDetalle: esc.procesos[0].idDetalle, idFirma: esc.firma.idFirma, login: esc.usuarioAdmin.login, pin: PIN_PLANO })

    expect(res.status).toBe(201)
    expect(res.body.estado).toBe(true)

    const br = await prisma.batchRecord.findUniqueOrThrow({ where: { idBatchRecord: esc.batchRecord.idBatchRecord } })
    expect(br.porcentajeAvance).toBe(100)
    expect(br.idEstado).toBe(2) // 2 = Finalizado
  })

  it('rechaza un PIN incorrecto y no registra la firma', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)

    const res = await request(app)
      .post(`/api/batch-records/${esc.batchRecord.idBatchRecord}/firmas`)
      .set('Authorization', `Bearer ${token}`)
      .send({ idDetalle: esc.procesos[0].idDetalle, idFirma: esc.firma.idFirma, login: esc.usuarioAdmin.login, pin: '000000' })

    expect(res.status).toBe(200) // la ruta responde 200 con estado:false, no un error HTTP
    expect(res.body.estado).toBe(false)
    expect(res.body.mensaje).toMatch(/PIN incorrecto/i)

    const firmas = await prisma.batchRecordFirma.findMany({ where: { idBatchRecord: esc.batchRecord.idBatchRecord } })
    expect(firmas).toHaveLength(0)
  })

  it('bloquea el PIN tras 5 intentos fallidos, igual que la contraseña de login', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)

    for (let i = 0; i < 5; i++) {
      await request(app)
        .post(`/api/batch-records/${esc.batchRecord.idBatchRecord}/firmas`)
        .set('Authorization', `Bearer ${token}`)
        .send({ idDetalle: esc.procesos[0].idDetalle, idFirma: esc.firma.idFirma, login: esc.usuarioAdmin.login, pin: '000000' })
    }

    const res = await request(app)
      .post(`/api/batch-records/${esc.batchRecord.idBatchRecord}/firmas`)
      .set('Authorization', `Bearer ${token}`)
      .send({ idDetalle: esc.procesos[0].idDetalle, idFirma: esc.firma.idFirma, login: esc.usuarioAdmin.login, pin: PIN_PLANO })

    expect(res.body.estado).toBe(false)
    expect(res.body.mensaje).toMatch(/bloqueado/i)
  })

  it('rechaza registrar la misma firma dos veces', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    const payload = { idDetalle: esc.procesos[0].idDetalle, idFirma: esc.firma.idFirma, login: esc.usuarioAdmin.login, pin: PIN_PLANO }

    const primera = await request(app).post(`/api/batch-records/${esc.batchRecord.idBatchRecord}/firmas`).set('Authorization', `Bearer ${token}`).send(payload)
    expect(primera.status).toBe(201)

    const segunda = await request(app).post(`/api/batch-records/${esc.batchRecord.idBatchRecord}/firmas`).set('Authorization', `Bearer ${token}`).send(payload)
    expect(segunda.status).toBe(409)
  })

  it('rechaza la petición sin token de autenticación', async () => {
    const esc = await crearEscenarioBasico()
    const res = await request(app)
      .post(`/api/batch-records/${esc.batchRecord.idBatchRecord}/firmas`)
      .send({ idDetalle: esc.procesos[0].idDetalle, idFirma: esc.firma.idFirma, login: esc.usuarioAdmin.login, pin: PIN_PLANO })
    expect(res.status).toBe(401)
  })
})

describe('POST /api/batch-records/:id/procesos/:idProceso/cerrar', () => {
  it('cierra la primera etapa exitosamente', async () => {
    const esc = await crearEscenarioBasico(2)
    const token = tokenPara(esc.usuarioAdmin)

    const res = await request(app)
      .post(`/api/batch-records/${esc.batchRecord.idBatchRecord}/procesos/${esc.procesos[0].idProceso}/cerrar`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.estado).toBe(true)
  })

  it('no permite cerrar la segunda etapa si la primera sigue abierta', async () => {
    const esc = await crearEscenarioBasico(2)
    const token = tokenPara(esc.usuarioAdmin)

    const res = await request(app)
      .post(`/api/batch-records/${esc.batchRecord.idBatchRecord}/procesos/${esc.procesos[1].idProceso}/cerrar`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(409)
  })

  it('permite cerrar la segunda etapa una vez cerrada la primera', async () => {
    const esc = await crearEscenarioBasico(2)
    const token = tokenPara(esc.usuarioAdmin)

    await request(app).post(`/api/batch-records/${esc.batchRecord.idBatchRecord}/procesos/${esc.procesos[0].idProceso}/cerrar`).set('Authorization', `Bearer ${token}`)
    const res = await request(app).post(`/api/batch-records/${esc.batchRecord.idBatchRecord}/procesos/${esc.procesos[1].idProceso}/cerrar`).set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
  })
})

describe('POST /api/batch-records/:id/liberar', () => {
  it('rechaza liberar si el BR todavía no está Finalizado', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)

    const res = await request(app)
      .post(`/api/batch-records/${esc.batchRecord.idBatchRecord}/liberar`)
      .set('Authorization', `Bearer ${token}`)
      .send({ login: esc.usuarioAdmin.login, pin: PIN_PLANO })

    expect(res.status).toBe(409)
  })

  it('libera el lote una vez que todas las firmas de cierre están completas', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)

    await request(app)
      .post(`/api/batch-records/${esc.batchRecord.idBatchRecord}/firmas`)
      .set('Authorization', `Bearer ${token}`)
      .send({ idDetalle: esc.procesos[0].idDetalle, idFirma: esc.firma.idFirma, login: esc.usuarioAdmin.login, pin: PIN_PLANO })

    const res = await request(app)
      .post(`/api/batch-records/${esc.batchRecord.idBatchRecord}/liberar`)
      .set('Authorization', `Bearer ${token}`)
      .send({ login: esc.usuarioAdmin.login, pin: PIN_PLANO, observacion: 'Prueba automatizada' })

    expect(res.status).toBe(201)
    expect(res.body.estado).toBe(true)

    const br = await prisma.batchRecord.findUniqueOrThrow({ where: { idBatchRecord: esc.batchRecord.idBatchRecord } })
    expect(br.idEstado).toBe(4) // 4 = Liberado
  })
})

describe('POST /api/batch-records/:id/firmas/:idFirmaRegistro/derogar', () => {
  it('reabre a En proceso un BR Finalizado al derogar su firma de cierre', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)

    const firmar = await request(app)
      .post(`/api/batch-records/${esc.batchRecord.idBatchRecord}/firmas`)
      .set('Authorization', `Bearer ${token}`)
      .send({ idDetalle: esc.procesos[0].idDetalle, idFirma: esc.firma.idFirma, login: esc.usuarioAdmin.login, pin: PIN_PLANO })
    expect((await prisma.batchRecord.findUniqueOrThrow({ where: { idBatchRecord: esc.batchRecord.idBatchRecord } })).idEstado).toBe(2)

    const res = await request(app)
      .post(`/api/batch-records/${esc.batchRecord.idBatchRecord}/firmas/${firmar.body.datos.id}/derogar`)
      .set('Authorization', `Bearer ${token}`)
      .send({ login: esc.usuarioAdmin.login, pin: PIN_PLANO, motivo: 'Error de digitación, corrigiendo el valor' })

    expect(res.status).toBe(200)
    expect(res.body.estado).toBe(true)

    const br = await prisma.batchRecord.findUniqueOrThrow({ where: { idBatchRecord: esc.batchRecord.idBatchRecord } })
    expect(br.idEstado).toBe(1) // reabierto
  })

  it('rechaza un PIN incorrecto y no borra la firma', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)

    const firmar = await request(app)
      .post(`/api/batch-records/${esc.batchRecord.idBatchRecord}/firmas`)
      .set('Authorization', `Bearer ${token}`)
      .send({ idDetalle: esc.procesos[0].idDetalle, idFirma: esc.firma.idFirma, login: esc.usuarioAdmin.login, pin: PIN_PLANO })

    const res = await request(app)
      .post(`/api/batch-records/${esc.batchRecord.idBatchRecord}/firmas/${firmar.body.datos.id}/derogar`)
      .set('Authorization', `Bearer ${token}`)
      .send({ login: esc.usuarioAdmin.login, pin: '000000', motivo: 'Intento con PIN incorrecto' })

    expect(res.status).toBe(200) // igual que firmar: responde 200 con estado:false, no un error HTTP
    expect(res.body.estado).toBe(false)
    expect(res.body.mensaje).toMatch(/PIN incorrecto/i)

    const firmas = await prisma.batchRecordFirma.findMany({ where: { idBatchRecord: esc.batchRecord.idBatchRecord } })
    expect(firmas).toHaveLength(1)
  })

  it('rechaza derogar a un usuario sin permiso del grupo de derogación', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    const sinPermiso = await prisma.usuario.create({
      data: {
        numeroIdentificacion: '900000002', nombres: 'Operario', apellidos: 'De Pruebas',
        login: 'operario.pruebas', email: 'operario.pruebas@bacord.test',
        esAdministrador: false, activo: true, pinHash: await bcrypt.hash(PIN_PLANO, 4),
      },
    })

    const firmar = await request(app)
      .post(`/api/batch-records/${esc.batchRecord.idBatchRecord}/firmas`)
      .set('Authorization', `Bearer ${token}`)
      .send({ idDetalle: esc.procesos[0].idDetalle, idFirma: esc.firma.idFirma, login: esc.usuarioAdmin.login, pin: PIN_PLANO })

    const res = await request(app)
      .post(`/api/batch-records/${esc.batchRecord.idBatchRecord}/firmas/${firmar.body.datos.id}/derogar`)
      .set('Authorization', `Bearer ${token}`)
      .send({ login: sinPermiso.login, pin: PIN_PLANO, motivo: 'Intento sin permiso' })

    expect(res.status).toBe(403)
    const firmas = await prisma.batchRecordFirma.findMany({ where: { idBatchRecord: esc.batchRecord.idBatchRecord } })
    expect(firmas).toHaveLength(1)
  })

  it('rechaza derogar una firma de un BR ya Liberado', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)

    const firmar = await request(app)
      .post(`/api/batch-records/${esc.batchRecord.idBatchRecord}/firmas`)
      .set('Authorization', `Bearer ${token}`)
      .send({ idDetalle: esc.procesos[0].idDetalle, idFirma: esc.firma.idFirma, login: esc.usuarioAdmin.login, pin: PIN_PLANO })
    await request(app)
      .post(`/api/batch-records/${esc.batchRecord.idBatchRecord}/liberar`)
      .set('Authorization', `Bearer ${token}`)
      .send({ login: esc.usuarioAdmin.login, pin: PIN_PLANO })

    const res = await request(app)
      .post(`/api/batch-records/${esc.batchRecord.idBatchRecord}/firmas/${firmar.body.datos.id}/derogar`)
      .set('Authorization', `Bearer ${token}`)
      .send({ login: esc.usuarioAdmin.login, pin: PIN_PLANO, motivo: 'Intento indebido tras liberar' })

    expect(res.status).toBe(409)
    const firmas = await prisma.batchRecordFirma.findMany({ where: { idBatchRecord: esc.batchRecord.idBatchRecord } })
    expect(firmas).toHaveLength(1) // la firma sigue intacta
  })

  it('rechaza derogar una firma de un BR ya Cancelado', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)

    const firmar = await request(app)
      .post(`/api/batch-records/${esc.batchRecord.idBatchRecord}/firmas`)
      .set('Authorization', `Bearer ${token}`)
      .send({ idDetalle: esc.procesos[0].idDetalle, idFirma: esc.firma.idFirma, login: esc.usuarioAdmin.login, pin: PIN_PLANO })
    await request(app)
      .post(`/api/batch-records/${esc.batchRecord.idBatchRecord}/cancelar`)
      .set('Authorization', `Bearer ${token}`)
      .send({ motivo: 'Cancelado para la prueba' })

    const res = await request(app)
      .post(`/api/batch-records/${esc.batchRecord.idBatchRecord}/firmas/${firmar.body.datos.id}/derogar`)
      .set('Authorization', `Bearer ${token}`)
      .send({ login: esc.usuarioAdmin.login, pin: PIN_PLANO, motivo: 'Intento indebido tras cancelar' })

    expect(res.status).toBe(409)
  })
})

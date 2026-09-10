import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import { app } from '../src/app.js'
import { resetDb, prisma } from './helpers/db.js'
import { crearEscenarioBasico, PIN_PLANO } from './helpers/fixtures.js'
import { tokenPara } from './helpers/auth.js'

async function crearDesviacion(idBatchRecord: number, idDetalle: number, token: string) {
  const res = await request(app)
    .post('/api/desviaciones')
    .set('Authorization', `Bearer ${token}`)
    .send({
      idBatchRecord, idDetalle,
      campo: 'peso', labelCampo: 'Peso',
      valorIngresado: '999', limiteInfo: 'Máximo 100',
      descripcion: 'Justificación de la desviación',
    })
  return res.body.datos.id as number
}

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

describe('POST /api/desviaciones/:id/cerrar', () => {
  it('un administrador puede cerrarla sin pertenecer al grupo configurado', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    const idDesviacion = await crearDesviacion(esc.batchRecord.idBatchRecord, esc.procesos[0].idDetalle, token)

    const res = await request(app)
      .post(`/api/desviaciones/${idDesviacion}/cerrar`)
      .set('Authorization', `Bearer ${token}`)
      .send({ login: esc.usuarioAdmin.login, pin: PIN_PLANO, observacionCierre: 'Se acepta, no afecta la calidad del producto' })

    expect(res.status).toBe(200)
    expect(res.body.datos.estado).toBe('cerrada')

    const evento = await prisma.auditEntry.findFirstOrThrow({ where: { accion: 'CERRAR_DESVIACION' } })
    expect(evento.entidad).toBe('Desviacion')
  })

  it('rechaza cerrarla a un usuario que no pertenece al grupo configurado (Calidad por defecto)', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    const idDesviacion = await crearDesviacion(esc.batchRecord.idBatchRecord, esc.procesos[0].idDetalle, token)

    const sinPermiso = await prisma.usuario.create({
      data: {
        numeroIdentificacion: '900000003', nombres: 'Operario', apellidos: 'De Pruebas',
        login: 'operario.desviaciones', email: 'operario.desviaciones@bacord.test',
        esAdministrador: false, activo: true, pinHash: await bcrypt.hash(PIN_PLANO, 4),
      },
    })

    const res = await request(app)
      .post(`/api/desviaciones/${idDesviacion}/cerrar`)
      .set('Authorization', `Bearer ${token}`)
      .send({ login: sinPermiso.login, pin: PIN_PLANO, observacionCierre: 'Intento sin permiso' })

    expect(res.status).toBe(403)
  })

  it('permite cerrarla a un usuario del grupo configurado por parámetro', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    const idDesviacion = await crearDesviacion(esc.batchRecord.idBatchRecord, esc.procesos[0].idDetalle, token)

    const grupoCalidad = await prisma.grupoResponsable.create({ data: { nombre: 'Calidad' } })
    const usuarioCalidad = await prisma.usuario.create({
      data: {
        numeroIdentificacion: '900000004', nombres: 'Analista', apellidos: 'De Calidad',
        login: 'calidad.pruebas', email: 'calidad.pruebas@bacord.test',
        esAdministrador: false, activo: true, pinHash: await bcrypt.hash(PIN_PLANO, 4),
        grupos: { create: { idGrupo: grupoCalidad.id } },
      },
    })

    const res = await request(app)
      .post(`/api/desviaciones/${idDesviacion}/cerrar`)
      .set('Authorization', `Bearer ${token}`)
      .send({ login: usuarioCalidad.login, pin: PIN_PLANO, observacionCierre: 'Revisado por Calidad, se acepta' })

    expect(res.status).toBe(200)
    expect(res.body.datos.estado).toBe('cerrada')
  })

  it('rechaza un PIN incorrecto y no cierra la desviación', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    const idDesviacion = await crearDesviacion(esc.batchRecord.idBatchRecord, esc.procesos[0].idDetalle, token)

    const res = await request(app)
      .post(`/api/desviaciones/${idDesviacion}/cerrar`)
      .set('Authorization', `Bearer ${token}`)
      .send({ login: esc.usuarioAdmin.login, pin: '000000', observacionCierre: 'Intento con PIN incorrecto' })

    expect(res.status).toBe(200) // igual que firmar: responde 200 con estado:false, no un error HTTP
    expect(res.body.estado).toBe(false)
    expect(res.body.mensaje).toMatch(/PIN incorrecto/i)

    const desv = await prisma.desviacion.findUniqueOrThrow({ where: { id: idDesviacion } })
    expect(desv.estado).toBe('abierta')
  })

  it('rechaza cerrar una desviación ya cerrada', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    const idDesviacion = await crearDesviacion(esc.batchRecord.idBatchRecord, esc.procesos[0].idDetalle, token)

    await request(app)
      .post(`/api/desviaciones/${idDesviacion}/cerrar`)
      .set('Authorization', `Bearer ${token}`)
      .send({ login: esc.usuarioAdmin.login, pin: PIN_PLANO, observacionCierre: 'Primer cierre' })

    const res = await request(app)
      .post(`/api/desviaciones/${idDesviacion}/cerrar`)
      .set('Authorization', `Bearer ${token}`)
      .send({ login: esc.usuarioAdmin.login, pin: PIN_PLANO, observacionCierre: 'Segundo intento' })

    expect(res.status).toBe(409)
  })
})

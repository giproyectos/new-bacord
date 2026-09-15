import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { app } from '../src/app.js'
import { resetDb, prisma } from './helpers/db.js'
import { crearEscenarioBasico } from './helpers/fixtures.js'
import { tokenPara } from './helpers/auth.js'

beforeEach(async () => {
  await resetDb()
})

// EstrategiaFirma.gruposDerogacion guarda los grupos autorizados a derogar una firma como un CSV
// de NOMBRES, no de ids (ver estrategiasFirma.ts). Renombrar un grupo ya referenciado ahí dejaría
// esa referencia apuntando a un nombre inexistente — la autorización de derogación se rompería en
// silencio.
describe('PUT /api/grupos-responsables/:id — protección contra renombrar un grupo en uso', () => {
  it('rechaza renombrar un grupo que está autorizado a derogar en alguna Estrategia de Firma', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    const grupoDerogador = await prisma.grupoResponsable.create({ data: { nombre: 'Supervisión-Test' } })
    const ef = await prisma.estrategiaFirma.create({
      data: { codigo: 'EF-DEROG', descripcion: 'Con derogación', usuarioCreacion: 'seed', gruposDerogacion: grupoDerogador.nombre },
    })

    const res = await request(app)
      .put(`/api/grupos-responsables/${grupoDerogador.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Supervisión-Renombrado' })

    expect(res.status).toBe(409)
    const actual = await prisma.grupoResponsable.findUniqueOrThrow({ where: { id: grupoDerogador.id } })
    expect(actual.nombre).toBe('Supervisión-Test')
    const efActual = await prisma.estrategiaFirma.findUniqueOrThrow({ where: { id: ef.id } })
    expect(efActual.gruposDerogacion).toBe('Supervisión-Test')
  })

  it('permite renombrar un grupo que no está autorizado a derogar en ninguna estrategia', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    const grupo = await prisma.grupoResponsable.create({ data: { nombre: 'Sin-Uso-Test' } })

    const res = await request(app)
      .put(`/api/grupos-responsables/${grupo.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Renombrado-Test' })

    expect(res.status).toBe(200)
  })

  it('permite editar otros campos (descripcion, activo) de un grupo en uso sin tocar el nombre', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    const grupoDerogador = await prisma.grupoResponsable.create({ data: { nombre: 'Calidad-Test' } })
    await prisma.estrategiaFirma.create({
      data: { codigo: 'EF-DEROG-2', descripcion: 'Con derogación', usuarioCreacion: 'seed', gruposDerogacion: grupoDerogador.nombre },
    })

    const res = await request(app)
      .put(`/api/grupos-responsables/${grupoDerogador.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ descripcion: 'Nueva descripción' })

    expect(res.status).toBe(200)
  })
})

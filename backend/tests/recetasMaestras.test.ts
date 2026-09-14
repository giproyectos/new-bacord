import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { app } from '../src/app.js'
import { resetDb, prisma } from './helpers/db.js'
import { crearEscenarioBasico } from './helpers/fixtures.js'
import { tokenPara } from './helpers/auth.js'

beforeEach(async () => {
  await resetDb()
})

// batchRecordProgress.ts consulta la estructura de la receta EN VIVO (nunca guarda una foto al
// crear el Batch Record) — editarla después de que existe un Batch Record cambiaría retroactivamente
// qué pasos/firmas requiere un lote ya en ejecución, o incluso lo que muestra uno ya liberado.
describe('PUT /api/recetas-maestras/:id/estructura — protección contra Batch Records existentes', () => {
  it('rechaza modificar la estructura si la receta ya tiene un Batch Record asociado', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)

    const res = await request(app)
      .put(`/api/recetas-maestras/${esc.recetaMaestra.idRecetaMaestra}/estructura`)
      .set('Authorization', `Bearer ${token}`)
      .send({ procesos: [] })

    expect(res.status).toBe(409)
    const procesos = await prisma.recetaProceso.findMany({ where: { idRecetaMaestra: esc.recetaMaestra.idRecetaMaestra } })
    expect(procesos.length).toBe(esc.procesos.length) // no se tocó nada
  })

  it('permite modificar la estructura de una receta sin Batch Records', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)

    const recetaNueva = await prisma.recetaMaestra.create({
      data: {
        codigo: 'RM-SIN-BR', descripcion: 'Receta sin uso', version: '1',
        idCentro: esc.centro.id, idMaterial: esc.material.id,
        usuarioCreacion: 'seed', usuarioModificacion: 'seed',
      },
    })

    const res = await request(app)
      .put(`/api/recetas-maestras/${recetaNueva.idRecetaMaestra}/estructura`)
      .set('Authorization', `Bearer ${token}`)
      .send({ procesos: [{ idProceso: esc.procesos[0].idProceso, orden: 1, detalles: [{ idDetalle: esc.procesos[0].idDetalle, orden: 1 }] }] })

    expect(res.status).toBe(200)
    const procesos = await prisma.recetaProceso.findMany({ where: { idRecetaMaestra: recetaNueva.idRecetaMaestra } })
    expect(procesos.length).toBe(1)
  })
})

// idEstado: 1 Activo, 2 Inactivo, 3 Aprobado, 4 Creación, 5 Revisión, 6 Rechazado.
describe('POST /api/recetas-maestras — estado inicial', () => {
  it('crea la receta en Creación (4), no en Activo — debe pasar por Revisión y Aprobación', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)

    const res = await request(app)
      .post('/api/recetas-maestras')
      .set('Authorization', `Bearer ${token}`)
      .send({ codigo: 'RM-NUEVA', descripcion: 'Receta nueva', version: '1', idCentro: esc.centro.id, idMaterial: esc.material.id })

    expect(res.status).toBe(201)
    expect(res.body.datos.idEstado).toBe(4)
  })
})

describe('POST /api/recetas-maestras/:id/copiar — estado de la copia', () => {
  it('la copia queda en Creación (4), no hereda el estado Activo del original', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    // Llevar el original hasta Activo (1) antes de copiar, para confirmar que la copia NO lo hereda.
    await prisma.recetaMaestra.update({ where: { idRecetaMaestra: esc.recetaMaestra.idRecetaMaestra }, data: { idEstado: 1 } })

    const res = await request(app)
      .post(`/api/recetas-maestras/${esc.recetaMaestra.idRecetaMaestra}/copiar`)
      .set('Authorization', `Bearer ${token}`)
      .send({ codigo: 'RM-COPIA' })

    expect(res.status).toBe(200)
    expect(res.body.datos.idEstado).toBe(4)
  })
})

describe('POST /api/recetas-maestras/:id/estado — transiciones válidas', () => {
  it('rechaza saltarse Revisión y Aprobación (Creación → Activo directo)', async () => {
    const esc = await crearEscenarioBasico() // la receta del fixture queda en Creación (4) por el default
    const token = tokenPara(esc.usuarioAdmin)

    const res = await request(app)
      .post(`/api/recetas-maestras/${esc.recetaMaestra.idRecetaMaestra}/estado`)
      .set('Authorization', `Bearer ${token}`)
      .send({ idEstado: 1 })

    expect(res.status).toBe(409)
    const actual = await prisma.recetaMaestra.findUniqueOrThrow({ where: { idRecetaMaestra: esc.recetaMaestra.idRecetaMaestra } })
    expect(actual.idEstado).toBe(4)
  })

  it('permite recorrer la secuencia completa Creación → Revisión → Aprobado → Activo → Inactivo', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    const id = esc.recetaMaestra.idRecetaMaestra

    for (const idEstado of [5, 3, 1, 2]) {
      const res = await request(app)
        .post(`/api/recetas-maestras/${id}/estado`)
        .set('Authorization', `Bearer ${token}`)
        .send({ idEstado })
      expect(res.status).toBe(200)
    }
    const actual = await prisma.recetaMaestra.findUniqueOrThrow({ where: { idRecetaMaestra: id } })
    expect(actual.idEstado).toBe(2)
  })
})

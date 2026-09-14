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

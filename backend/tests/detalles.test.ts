import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { app } from '../src/app.js'
import { resetDb, prisma } from './helpers/db.js'
import { crearEscenarioBasico } from './helpers/fixtures.js'
import { tokenPara } from './helpers/auth.js'

beforeEach(async () => {
  await resetDb()
})

// Un Detalle es una plantilla de formulario reutilizable entre Recetas Maestras.
// batchRecordProgress.ts consulta su jsonSchema/estrategiaFirma EN VIVO — editarlos después de que
// el Detalle ya está en una receta con Batch Records cambiaría retroactivamente qué ve/firma un
// lote en ejecución o ya liberado.
describe('PUT /api/detalles/:id — protección contra Batch Records existentes', () => {
  it('rechaza cambiar el jsonSchema si el Detalle ya está en una receta con Batch Records', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    const idDetalle = esc.procesos[0].idDetalle

    const res = await request(app)
      .put(`/api/detalles/${idDetalle}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ jsonSchema: JSON.stringify({ components: [{ key: 'nuevo' }] }) })

    expect(res.status).toBe(409)
    const actual = await prisma.detalle.findUniqueOrThrow({ where: { id: idDetalle } })
    expect(actual.jsonSchema).toBe(JSON.stringify({ components: [] })) // valor original del fixture, sin tocar
  })

  it('rechaza cambiar idEstrategiaFirma si el Detalle ya está en uso', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    const idDetalle = esc.procesos[0].idDetalle
    const otraEstrategia = await prisma.estrategiaFirma.create({
      data: { codigo: 'EF-OTRA', descripcion: 'Otra estrategia', usuarioCreacion: 'seed' },
    })

    const res = await request(app)
      .put(`/api/detalles/${idDetalle}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ idEstrategiaFirma: otraEstrategia.id })

    expect(res.status).toBe(409)
  })

  it('permite cambiar codigo/descripcion/estado aunque el Detalle ya esté en uso', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    const idDetalle = esc.procesos[0].idDetalle

    const res = await request(app)
      .put(`/api/detalles/${idDetalle}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ descripcion: 'Descripción actualizada' })

    expect(res.status).toBe(200)
    const actual = await prisma.detalle.findUniqueOrThrow({ where: { id: idDetalle } })
    expect(actual.descripcion).toBe('Descripción actualizada')
  })

  it('permite editar el jsonSchema de un Detalle que todavía no está en uso', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    const detalleNuevo = await prisma.detalle.create({
      data: { codigo: 'D-SIN-USO', descripcion: 'Sin uso', jsonSchema: JSON.stringify({ components: [] }) },
    })

    const res = await request(app)
      .put(`/api/detalles/${detalleNuevo.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ jsonSchema: JSON.stringify({ components: [{ key: 'campo1' }] }) })

    expect(res.status).toBe(200)
  })

  it('permite reenviar el mismo jsonSchema sin cambios aunque el Detalle ya esté en uso', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    const idDetalle = esc.procesos[0].idDetalle
    const detalle = await prisma.detalle.findUniqueOrThrow({ where: { id: idDetalle } })

    const res = await request(app)
      .put(`/api/detalles/${idDetalle}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ jsonSchema: detalle.jsonSchema })

    expect(res.status).toBe(200)
  })
})

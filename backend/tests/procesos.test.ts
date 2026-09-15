import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { app } from '../src/app.js'
import { resetDb, prisma } from './helpers/db.js'
import { crearEscenarioBasico } from './helpers/fixtures.js'
import { tokenPara } from './helpers/auth.js'

beforeEach(async () => {
  await resetDb()
})

// RecetaProceso solo guarda el idProceso, no el material — cambiarle el material a un Proceso ya
// asignado a la estructura de una Receta Maestra lo desacopla en silencio del producto para el
// que realmente fue construido.
describe('PUT /api/procesos/:id — protección contra cambiar el material de un proceso en uso', () => {
  it('rechaza cambiar idMaterial si el proceso ya está en la estructura de una receta', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    const idProceso = esc.procesos[0].idProceso
    const otroMaterial = await prisma.material.create({
      data: { codigo: 'M-OTRO', descripcion: 'Otro producto terminado', tipo: 'PRODUCTO_TERMINADO' },
    })

    const res = await request(app)
      .put(`/api/procesos/${idProceso}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ idMaterial: otroMaterial.id })

    expect(res.status).toBe(409)
    const actual = await prisma.proceso.findUniqueOrThrow({ where: { id: idProceso } })
    expect(actual.idMaterial).toBe(esc.material.id)
  })

  it('permite cambiar el material de un proceso que no está en ninguna receta', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    const otroMaterial = await prisma.material.create({
      data: { codigo: 'M-OTRO-2', descripcion: 'Otro producto terminado', tipo: 'PRODUCTO_TERMINADO' },
    })
    const procesoSinUso = await prisma.proceso.create({
      data: { idMaterial: esc.material.id, codigo: 'P-SIN-USO', descripcion: 'Sin uso', orden: 99 },
    })

    const res = await request(app)
      .put(`/api/procesos/${procesoSinUso.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ idMaterial: otroMaterial.id })

    expect(res.status).toBe(200)
  })

  it('permite editar codigo/descripcion de un proceso en uso sin tocar el material', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    const idProceso = esc.procesos[0].idProceso

    const res = await request(app)
      .put(`/api/procesos/${idProceso}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ descripcion: 'Descripción actualizada' })

    expect(res.status).toBe(200)
  })
})

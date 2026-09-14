import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { app } from '../src/app.js'
import { resetDb, prisma } from './helpers/db.js'
import { crearEscenarioBasico } from './helpers/fixtures.js'
import { tokenPara } from './helpers/auth.js'

beforeEach(async () => {
  await resetDb()
})

// gruposDerogacion determina quién puede derogar una firma ya registrada (backend/src/routes/
// batchRecords.ts) — a diferencia de `modulos` en Roles, no hay un enum fijo que lo respalde, así
// que hay que validar contra los Grupos Responsables reales al guardar la estrategia.
describe('POST /api/estrategias-firma — validación de gruposDerogacion', () => {
  it('rechaza un grupo que no existe', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)

    const res = await request(app)
      .post('/api/estrategias-firma')
      .set('Authorization', `Bearer ${token}`)
      .send({ codigo: 'EF-NUEVA', descripcion: 'Estrategia nueva', gruposDerogacion: ['Grupo-Inexistente'], firmas: [] })

    expect(res.status).toBe(400)
    const creada = await prisma.estrategiaFirma.findUnique({ where: { codigo: 'EF-NUEVA' } })
    expect(creada).toBeNull()
  })

  it('rechaza un grupo que existe pero está inactivo', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    const grupoInactivo = await prisma.grupoResponsable.create({ data: { nombre: 'Grupo-Inactivo', activo: false } })

    const res = await request(app)
      .post('/api/estrategias-firma')
      .set('Authorization', `Bearer ${token}`)
      .send({ codigo: 'EF-NUEVA-2', descripcion: 'Estrategia nueva', gruposDerogacion: [grupoInactivo.nombre], firmas: [] })

    expect(res.status).toBe(400)
  })

  it('acepta un grupo activo real', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    const grupo = await prisma.grupoResponsable.create({ data: { nombre: 'Grupo-Valido' } })

    const res = await request(app)
      .post('/api/estrategias-firma')
      .set('Authorization', `Bearer ${token}`)
      .send({ codigo: 'EF-NUEVA-3', descripcion: 'Estrategia nueva', gruposDerogacion: [grupo.nombre], firmas: [] })

    expect(res.status).toBe(201)
    const creada = await prisma.estrategiaFirma.findUniqueOrThrow({ where: { codigo: 'EF-NUEVA-3' } })
    expect(creada.gruposDerogacion).toBe(grupo.nombre)
  })
})

describe('PUT /api/estrategias-firma/:id — validación de gruposDerogacion', () => {
  it('rechaza actualizar con un grupo inexistente y no modifica el registro', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)

    const res = await request(app)
      .put(`/api/estrategias-firma/${esc.estrategiaFirma.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ gruposDerogacion: ['Grupo-Que-No-Existe'] })

    expect(res.status).toBe(400)
    const actual = await prisma.estrategiaFirma.findUniqueOrThrow({ where: { id: esc.estrategiaFirma.id } })
    expect(actual.gruposDerogacion).toBeNull()
  })
})

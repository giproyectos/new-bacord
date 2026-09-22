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

describe('POST /api/estrategias-firma — validación de firmas', () => {
  it('rechaza un idFirma inexistente con 400 en vez de un 500 por violación de llave foránea', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)

    const res = await request(app)
      .post('/api/estrategias-firma')
      .set('Authorization', `Bearer ${token}`)
      .send({ codigo: 'EF-FIRMA-MALA', descripcion: 'Estrategia nueva', firmas: [{ idFirma: 999999, texto: 'x', orden: 1 }] })

    expect(res.status).toBe(400)
    const creada = await prisma.estrategiaFirma.findUnique({ where: { codigo: 'EF-FIRMA-MALA' } })
    expect(creada).toBeNull()
  })

  it('rechaza una Firma que existe pero está inactiva', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    await prisma.firma.update({ where: { idFirma: esc.firma.idFirma }, data: { activo: false } })

    const res = await request(app)
      .post('/api/estrategias-firma')
      .set('Authorization', `Bearer ${token}`)
      .send({ codigo: 'EF-FIRMA-INACTIVA', descripcion: 'Estrategia nueva', firmas: [{ idFirma: esc.firma.idFirma, texto: 'x', orden: 1 }] })

    expect(res.status).toBe(400)
  })
})

// Mismo riesgo que assertDetalleSinBatchRecords en detalles.ts, por esta otra puerta: un Detalle
// consulta su estrategiaFirma EN VIVO, así que editar las firmas de una Estrategia ya asignada a un
// Detalle en uso cambiaría retroactivamente qué se exigió para cerrar un Batch Record en ejecución
// o ya liberado.
describe('PUT /api/estrategias-firma/:id — no se pueden editar las firmas si ya está en uso', () => {
  it('rechaza modificar las firmas de una Estrategia asignada a un Detalle con Batch Records', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)

    const res = await request(app)
      .put(`/api/estrategias-firma/${esc.estrategiaFirma.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ firmas: [{ idFirma: esc.firma.idFirma, texto: 'Nuevo texto', orden: 1 }] })

    expect(res.status).toBe(409)
    const items = await prisma.estrategiaFirmaItem.findMany({ where: { idEstrategiaFirma: esc.estrategiaFirma.id } })
    expect(items).toHaveLength(1)
    expect(items[0].texto).toBe(esc.firma.texto) // no se tocó
  })

  it('permite editar campos cosméticos (descripción) de esa misma Estrategia sin tocar `firmas`', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)

    const res = await request(app)
      .put(`/api/estrategias-firma/${esc.estrategiaFirma.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ descripcion: 'Estrategia renombrada' })

    expect(res.status).toBe(200)
    const actual = await prisma.estrategiaFirma.findUniqueOrThrow({ where: { id: esc.estrategiaFirma.id } })
    expect(actual.descripcion).toBe('Estrategia renombrada')
  })

  it('permite modificar las firmas de una Estrategia que no está en uso por ningún Detalle con Batch Records', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    const libre = await prisma.estrategiaFirma.create({ data: { codigo: 'EF-LIBRE', descripcion: 'Sin uso', usuarioCreacion: 'seed' } })

    const res = await request(app)
      .put(`/api/estrategias-firma/${libre.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ firmas: [{ idFirma: esc.firma.idFirma, texto: 'x', orden: 1 }] })

    expect(res.status).toBe(200)
    const items = await prisma.estrategiaFirmaItem.findMany({ where: { idEstrategiaFirma: libre.id } })
    expect(items).toHaveLength(1)
  })
})

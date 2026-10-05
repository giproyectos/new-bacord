import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { app } from '../src/app.js'
import { resetDb, prisma } from './helpers/db.js'
import { crearEscenarioBasico } from './helpers/fixtures.js'
import { tokenPara } from './helpers/auth.js'

beforeEach(async () => {
  await resetDb()
})

// Sin validar idGrupo contra Grupo Responsable, uno inexistente revienta con una violación de
// llave foránea (P2003) no manejada por errorHandler (500 genérico), y uno ya desactivado se
// acepta sin problema, dejando una Firma vinculada a un grupo que ya no puede firmar/derogar nada.
describe('POST /api/firmas — validación de idGrupo', () => {
  it('rechaza un idGrupo que no existe, con un mensaje claro en vez de un 500', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)

    const res = await request(app)
      .post('/api/firmas')
      .set('Authorization', `Bearer ${token}`)
      .send({ codigo: 'F-NUEVA', descripcion: 'Firma nueva', texto: 'Confirmo', idGrupo: 999999 })

    expect(res.status).toBe(400)
    expect(res.body.mensaje).toMatch(/no existe o está inactivo/i)
    const creada = await prisma.firma.findUnique({ where: { codigo: 'F-NUEVA' } })
    expect(creada).toBeNull()
  })

  it('rechaza un idGrupo de un grupo ya desactivado', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    const grupoInactivo = await prisma.grupoResponsable.create({ data: { nombre: 'Grupo-Inactivo-Firma', activo: false } })

    const res = await request(app)
      .post('/api/firmas')
      .set('Authorization', `Bearer ${token}`)
      .send({ codigo: 'F-NUEVA-2', descripcion: 'Firma nueva', texto: 'Confirmo', idGrupo: grupoInactivo.id })

    expect(res.status).toBe(400)
  })

  it('acepta un idGrupo de un grupo activo real', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    const grupo = await prisma.grupoResponsable.create({ data: { nombre: 'Grupo-Valido-Firma' } })

    const res = await request(app)
      .post('/api/firmas')
      .set('Authorization', `Bearer ${token}`)
      .send({ codigo: 'F-NUEVA-3', descripcion: 'Firma nueva', texto: 'Confirmo', idGrupo: grupo.id })

    expect(res.status).toBe(201)
    const creada = await prisma.firma.findUniqueOrThrow({ where: { codigo: 'F-NUEVA-3' } })
    expect(creada.idGrupo).toBe(grupo.id)
  })
})

describe('PUT /api/firmas/:id — validación de idGrupo', () => {
  it('rechaza actualizar con un idGrupo inexistente y no modifica el registro', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    const grupo = await prisma.grupoResponsable.create({ data: { nombre: 'Grupo-Original-Firma' } })
    const firma = await prisma.firma.create({
      data: { codigo: 'F-EXISTENTE', descripcion: 'Firma existente', texto: 'Confirmo', idGrupo: grupo.id },
    })

    const res = await request(app)
      .put(`/api/firmas/${firma.idFirma}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ idGrupo: 999999 })

    expect(res.status).toBe(400)
    const actual = await prisma.firma.findUniqueOrThrow({ where: { idFirma: firma.idFirma } })
    expect(actual.idGrupo).toBe(grupo.id)
  })
})

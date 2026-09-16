import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { app } from '../src/app.js'
import { resetDb, prisma } from './helpers/db.js'
import { crearEscenarioBasico } from './helpers/fixtures.js'
import { tokenPara } from './helpers/auth.js'

beforeEach(async () => {
  await resetDb()
})

// Parámetros sostiene la política de contraseña y el timeout de sesión — tan sensible como
// Usuarios/Roles, así que no se gobierna por el sistema de módulos por Rol: queda reservado a
// esAdministrador, igual sin importar qué módulos tenga asignado el Rol del usuario.
describe('Acceso a /api/parametros — reservado a esAdministrador', () => {
  async function crearUsuarioNoAdmin(esc: Awaited<ReturnType<typeof crearEscenarioBasico>>) {
    return prisma.usuario.create({
      data: {
        numeroIdentificacion: '900000003', nombres: 'Operario', apellidos: 'De Pruebas',
        login: 'operario.parametros', email: 'operario.parametros@bacord.test',
        idCentro: esc.centro.id, esAdministrador: false, activo: true,
      },
    })
  }

  it('GET rechaza a un usuario no-administrador', async () => {
    const esc = await crearEscenarioBasico()
    const noAdmin = await crearUsuarioNoAdmin(esc)
    const token = tokenPara(noAdmin)

    const res = await request(app).get('/api/parametros').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(403)
  })

  it('POST rechaza a un usuario no-administrador', async () => {
    const esc = await crearEscenarioBasico()
    const noAdmin = await crearUsuarioNoAdmin(esc)
    const token = tokenPara(noAdmin)

    const res = await request(app)
      .post('/api/parametros')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'password_min_caracteres', valor: '8' })

    expect(res.status).toBe(403)
    expect(await prisma.parametro.count()).toBe(0)
  })

  it('PUT y DELETE rechazan a un usuario no-administrador', async () => {
    const esc = await crearEscenarioBasico()
    const noAdmin = await crearUsuarioNoAdmin(esc)
    const token = tokenPara(noAdmin)
    const parametro = await prisma.parametro.create({ data: { nombre: 'password_min_caracteres', valor: '8' } })

    const put = await request(app)
      .put(`/api/parametros/${parametro.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ valor: '12' })
    expect(put.status).toBe(403)

    const del = await request(app)
      .delete(`/api/parametros/${parametro.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(del.status).toBe(403)

    const actual = await prisma.parametro.findUniqueOrThrow({ where: { id: parametro.id } })
    expect(actual.valor).toBe('8')
  })

  it('un administrador sí puede leer y crear parámetros', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)

    const crear = await request(app)
      .post('/api/parametros')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'password_min_caracteres', valor: '8' })
    expect(crear.status).toBe(201)

    const listar = await request(app).get('/api/parametros').set('Authorization', `Bearer ${token}`)
    expect(listar.status).toBe(200)
    expect(listar.body).toHaveLength(1)
  })
})

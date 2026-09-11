import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import { app } from '../src/app.js'
import { resetDb, prisma } from './helpers/db.js'
import { crearEscenarioBasico } from './helpers/fixtures.js'
import { tokenPara } from './helpers/auth.js'

beforeEach(async () => {
  await resetDb()
})

// isOidcConfigured() lee estas tres variables directo de process.env en cada llamada — alcanza
// con fijarlas/borrarlas alrededor de cada prueba, sin necesitar mocks.
const OIDC_ENV_KEYS = ['OIDC_ISSUER_URL', 'OIDC_CLIENT_ID', 'OIDC_REDIRECT_URI'] as const
function activarOidc() {
  process.env.OIDC_ISSUER_URL = 'https://login.example.com'
  process.env.OIDC_CLIENT_ID = 'bacord-test'
  process.env.OIDC_REDIRECT_URI = 'https://bacord.example.com/api/auth/oidc/callback'
}
afterEach(() => {
  for (const key of OIDC_ENV_KEYS) delete process.env[key]
})

describe('PUT /api/usuarios/:id — loginLocalDeshabilitado', () => {
  it('rechaza activarlo si el despliegue no tiene OIDC configurado', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    const objetivo = await prisma.usuario.create({
      data: {
        numeroIdentificacion: '900000006', nombres: 'Usuario', apellidos: 'Objetivo',
        login: 'objetivo.sso', email: 'objetivo.sso@bacord.test', idCentro: esc.centro.id,
        esAdministrador: false, activo: true,
      },
    })

    const res = await request(app)
      .put(`/api/usuarios/${objetivo.idUsuario}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ loginLocalDeshabilitado: true })

    expect(res.status).toBe(400)
    const actual = await prisma.usuario.findUniqueOrThrow({ where: { idUsuario: objetivo.idUsuario } })
    expect(actual.loginLocalDeshabilitado).toBe(false)
  })

  it('lo activa con OIDC configurado y revoca la contraseña local que tuviera', async () => {
    activarOidc()
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    const objetivo = await prisma.usuario.create({
      data: {
        numeroIdentificacion: '900000007', nombres: 'Usuario', apellidos: 'Con Clave',
        login: 'objetivo.clave', email: 'objetivo.clave@bacord.test', idCentro: esc.centro.id,
        esAdministrador: false, activo: true,
        passwordHash: await bcrypt.hash('Clave-Vieja123!', 4), passwordCambiadaEn: new Date(),
      },
    })

    const res = await request(app)
      .put(`/api/usuarios/${objetivo.idUsuario}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ loginLocalDeshabilitado: true })

    expect(res.status).toBe(200)
    const actual = await prisma.usuario.findUniqueOrThrow({ where: { idUsuario: objetivo.idUsuario } })
    expect(actual.loginLocalDeshabilitado).toBe(true)
    expect(actual.passwordHash).toBeNull()
    expect(actual.passwordCambiadaEn).toBeNull()
  })
})

describe('protección del último administrador activo', () => {
  it('rechaza quitarle la marca de Administrador al único administrador', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)

    const res = await request(app)
      .put(`/api/usuarios/${esc.usuarioAdmin.idUsuario}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ esAdministrador: false })

    expect(res.status).toBe(400)
    const actual = await prisma.usuario.findUniqueOrThrow({ where: { idUsuario: esc.usuarioAdmin.idUsuario } })
    expect(actual.esAdministrador).toBe(true)
  })

  it('rechaza desactivar al único administrador (PUT)', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)

    const res = await request(app)
      .put(`/api/usuarios/${esc.usuarioAdmin.idUsuario}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ activo: false })

    expect(res.status).toBe(400)
  })

  it('rechaza eliminar (desactivar) al único administrador', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)

    const res = await request(app)
      .delete(`/api/usuarios/${esc.usuarioAdmin.idUsuario}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(400)
    const actual = await prisma.usuario.findUniqueOrThrow({ where: { idUsuario: esc.usuarioAdmin.idUsuario } })
    expect(actual.activo).toBe(true)
  })

  it('permite desactivar a un administrador si queda otro administrador activo', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    const otroAdmin = await prisma.usuario.create({
      data: {
        numeroIdentificacion: '900000009', nombres: 'Otro', apellidos: 'Administrador',
        login: 'otro.admin', email: 'otro.admin@bacord.test', idCentro: esc.centro.id,
        esAdministrador: true, activo: true,
      },
    })

    const res = await request(app)
      .delete(`/api/usuarios/${otroAdmin.idUsuario}`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
  })
})

describe('POST /api/usuarios/:id/reenviar-invitacion', () => {
  it('rechaza reenviar un enlace de contraseña a una cuenta con loginLocalDeshabilitado', async () => {
    activarOidc()
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    const objetivo = await prisma.usuario.create({
      data: {
        numeroIdentificacion: '900000008', nombres: 'Usuario', apellidos: 'SSO',
        login: 'objetivo.sso2', email: 'objetivo.sso2@bacord.test', idCentro: esc.centro.id,
        esAdministrador: false, activo: true, loginLocalDeshabilitado: true,
      },
    })

    const res = await request(app)
      .post(`/api/usuarios/${objetivo.idUsuario}/reenviar-invitacion`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(400)
  })
})

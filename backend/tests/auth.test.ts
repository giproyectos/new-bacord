import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import { app } from '../src/app.js'
import { resetDb, prisma } from './helpers/db.js'
import { crearEscenarioBasico } from './helpers/fixtures.js'
import { tokenPara } from './helpers/auth.js'
import { signToken } from '../src/middleware/auth.js'

// El token JWT dura hasta 12h con las claims (esAdministrador, modulos, modulosEdicion) tal como
// estaban al momento del login — requireAuth debe revalidar el estado real del usuario en cada
// solicitud, para que desactivar/bloquear una cuenta o cambiarle el Rol tenga efecto de inmediato
// y no recién cuando el token expire por su cuenta.

beforeEach(async () => {
  await resetDb()
})

describe('requireAuth — revalidación contra la base de datos', () => {
  it('acepta un token válido de un usuario activo', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)

    const res = await request(app).get('/api/batch-records').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
  })

  it('rechaza el mismo token una vez que el usuario fue desactivado', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)

    await prisma.usuario.update({ where: { idUsuario: esc.usuarioAdmin.idUsuario }, data: { activo: false } })

    const res = await request(app).get('/api/batch-records').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(401)
  })

  it('rechaza el mismo token una vez que el usuario fue bloqueado', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)

    await prisma.usuario.update({ where: { idUsuario: esc.usuarioAdmin.idUsuario }, data: { bloqueado: true } })

    const res = await request(app).get('/api/batch-records').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(401)
  })

  it('aplica de inmediato un cambio de Rol que quita acceso a un módulo, sin esperar a que el token expire', async () => {
    const esc = await crearEscenarioBasico()

    const rol = await prisma.rol.create({
      data: { nombre: 'Operario-Test', modulos: 'batch-records', modulosEdicion: 'batch-records', activo: true },
    })
    const operario = await prisma.usuario.create({
      data: {
        numeroIdentificacion: '900000005', nombres: 'Operario', apellidos: 'Con Rol',
        login: 'operario.rol', email: 'operario.rol@bacord.test',
        esAdministrador: false, activo: true, idRol: rol.id,
      },
    })
    // Token firmado con los módulos que tenía el Rol al momento del login.
    const token = signToken({
      idUsuario: operario.idUsuario, login: operario.login, esAdministrador: false,
      modulos: 'batch-records', modulosEdicion: 'batch-records',
    })

    const antes = await request(app).get('/api/batch-records').set('Authorization', `Bearer ${token}`)
    expect(antes.status).toBe(200)

    // El administrador le quita el módulo desde la pantalla de Roles — sin que el usuario vuelva a loguearse.
    await prisma.rol.update({ where: { id: rol.id }, data: { modulos: '', modulosEdicion: '' } })

    const despues = await request(app).get('/api/batch-records').set('Authorization', `Bearer ${token}`)
    expect(despues.status).toBe(403)
  })
})

describe('POST /api/auth/login — cuenta con loginLocalDeshabilitado', () => {
  it('rechaza el login local aunque la contraseña sea correcta', async () => {
    const esc = await crearEscenarioBasico()
    const clave = 'Clave-Segura123!'
    await prisma.usuario.update({
      where: { idUsuario: esc.usuarioAdmin.idUsuario },
      data: { passwordHash: await bcrypt.hash(clave, 4), passwordCambiadaEn: new Date(), loginLocalDeshabilitado: true },
    })

    const res = await request(app).post('/api/auth/login').send({ login: esc.usuarioAdmin.login, clave })

    expect(res.status).toBe(401)
    expect(res.body.mensaje).toMatch(/cuenta corporativa/i)
  })
})

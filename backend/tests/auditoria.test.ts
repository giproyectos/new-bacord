import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { app } from '../src/app.js'
import { resetDb, prisma } from './helpers/db.js'
import { crearEscenarioBasico } from './helpers/fixtures.js'
import { tokenPara } from './helpers/auth.js'

beforeEach(async () => {
  await resetDb()
})

// El actor de una entrada de auditoría debe derivarse siempre de la sesión autenticada
// (req.auth), nunca de lo que mande el cliente — de lo contrario cualquier usuario autenticado
// podría falsificar una entrada atribuida a otra persona (incluso a un administrador).
describe('POST /api/auditoria — el actor se deriva de la sesión, no del body', () => {
  it('ignora un `firmante` enviado en el body y usa el usuario autenticado real', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    const otroUsuario = await prisma.usuario.create({
      data: {
        numeroIdentificacion: '900000020', nombres: 'Víctima', apellidos: 'Suplantada',
        login: 'victima.suplantada', email: 'victima@bacord.test', idCentro: esc.centro.id,
        esAdministrador: true, activo: true,
      },
    })

    const res = await request(app)
      .post('/api/auditoria')
      .set('Authorization', `Bearer ${token}`)
      .send({
        entidad: 'BatchRecord',
        idEntidad: esc.batchRecord.idBatchRecord,
        descripcionEntidad: 'Intento de falsificación',
        accion: 'CREAR',
        modulo: 'batch-record',
        // Un cliente malicioso intenta atribuir el evento a otro usuario.
        firmante: {
          idUsuario: otroUsuario.idUsuario,
          nombreUsuario: `${otroUsuario.nombres} ${otroUsuario.apellidos}`,
          loginUsuario: otroUsuario.login,
          cargo: 'Director Técnico de Planta',
        },
      })

    expect(res.status).toBe(201)
    const entry = await prisma.auditEntry.findUniqueOrThrow({ where: { id: res.body.id } })
    // El actor real es el dueño del token (esc.usuarioAdmin), no la víctima suplantada en el body.
    expect(entry.idUsuario).toBe(esc.usuarioAdmin.idUsuario)
    expect(entry.loginUsuario).toBe(esc.usuarioAdmin.login)
    expect(entry.idUsuario).not.toBe(otroUsuario.idUsuario)
  })
})

// Fuera de estas dos combinaciones (LOGOUT sobre la propia sesión, y una anotación sobre un
// Batch Record real) no hay ningún flujo legítimo del cliente que use este endpoint — cualquier
// otra acción de negocio la registra el backend directamente dentro de su propia transacción.
// Sin este chequeo, cualquier usuario autenticado podía fabricar una entrada de auditoría
// (firmar, cancelar, derogar, etc.) para una acción que nunca ocurrió.
describe('POST /api/auditoria — restringido a las combinaciones que de verdad usa el cliente', () => {
  it('rechaza registrar el cierre de sesión de otro usuario', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    const otroUsuario = await prisma.usuario.create({
      data: {
        numeroIdentificacion: '900000021', nombres: 'Otro', apellidos: 'Usuario',
        login: 'otro.usuario', email: 'otro.usuario@bacord.test', idCentro: esc.centro.id,
        esAdministrador: false, activo: true,
      },
    })

    const res = await request(app)
      .post('/api/auditoria')
      .set('Authorization', `Bearer ${token}`)
      .send({
        entidad: 'Sesion', idEntidad: otroUsuario.idUsuario,
        descripcionEntidad: 'Cierre de sesión falso', accion: 'LOGOUT', modulo: 'autenticacion',
      })

    expect(res.status).toBe(403)
  })

  it('permite registrar el cierre de la propia sesión', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)

    const res = await request(app)
      .post('/api/auditoria')
      .set('Authorization', `Bearer ${token}`)
      .send({
        entidad: 'Sesion', idEntidad: esc.usuarioAdmin.idUsuario,
        descripcionEntidad: 'Cierre de sesión', accion: 'LOGOUT', modulo: 'autenticacion',
      })

    expect(res.status).toBe(201)
  })

  it('rechaza anotar un Batch Record que no existe', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)

    const res = await request(app)
      .post('/api/auditoria')
      .set('Authorization', `Bearer ${token}`)
      .send({
        entidad: 'BatchRecord', idEntidad: 999999,
        descripcionEntidad: 'BR inventado', accion: 'MODIFICAR', modulo: 'BatchRecordList',
      })

    expect(res.status).toBe(404)
  })

  it('rechaza una entidad/acción de negocio que ya no está permitida desde el cliente', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)

    const res = await request(app)
      .post('/api/auditoria')
      .set('Authorization', `Bearer ${token}`)
      .send({
        entidad: 'DetalleValores', idEntidad: esc.batchRecord.idBatchRecord,
        descripcionEntidad: 'Cambio fabricado', accion: 'MODIFICAR', modulo: 'batch-record',
        cambios: [{ campo: 'x', etiqueta: 'X', valorAnterior: '1', valorNuevo: '2' }],
      })

    expect(res.status).toBe(400)
    expect(await prisma.auditEntry.count()).toBe(0)
  })
})

describe('GET /api/auditoria — límite acotado', () => {
  it('respeta un `limite` pedido por el cliente, dentro del máximo permitido', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/auditoria')
        .set('Authorization', `Bearer ${token}`)
        .send({
          entidad: 'Sesion', idEntidad: esc.usuarioAdmin.idUsuario,
          descripcionEntidad: `Evento ${i}`, accion: 'LOGOUT', modulo: 'autenticacion',
        })
    }

    const res = await request(app).get('/api/auditoria?limite=2').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
  })
})

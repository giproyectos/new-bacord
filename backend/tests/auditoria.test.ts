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
        idEntidad: 1,
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

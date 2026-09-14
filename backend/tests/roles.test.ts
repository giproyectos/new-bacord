import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { app } from '../src/app.js'
import { resetDb, prisma } from './helpers/db.js'
import { crearEscenarioBasico } from './helpers/fixtures.js'
import { tokenPara } from './helpers/auth.js'

beforeEach(async () => {
  await resetDb()
})

describe('PUT /api/roles/:id — recorte de modulosEdicion al reducir modulos', () => {
  it('recorta modulosEdicion aunque la petición no la incluya, si ya no es subconjunto de modulos', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    const rol = await prisma.rol.create({
      data: {
        nombre: 'Rol-Test', modulos: 'batch-records,recetas-maestras',
        modulosEdicion: 'batch-records,recetas-maestras', activo: true,
      },
    })

    const res = await request(app)
      .put(`/api/roles/${rol.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ modulos: ['batch-records'] }) // sin modulosEdicion en el body

    expect(res.status).toBe(200)
    const actual = await prisma.rol.findUniqueOrThrow({ where: { id: rol.id } })
    expect(actual.modulos).toBe('batch-records')
    // recetas-maestras ya no está en modulos — no puede seguir en modulosEdicion
    expect(actual.modulosEdicion).toBe('batch-records')
  })

  it('el evento de auditoría refleja el recorte real, no un vaciado que nunca ocurrió', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    const rol = await prisma.rol.create({
      data: {
        nombre: 'Rol-Test-2', modulos: 'batch-records,recetas-maestras',
        modulosEdicion: 'batch-records,recetas-maestras', activo: true,
      },
    })

    await request(app)
      .put(`/api/roles/${rol.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ modulos: ['batch-records'] })

    const evento = await prisma.auditEntry.findFirstOrThrow({
      where: { entidad: 'Rol', idEntidad: String(rol.id), accion: 'MODIFICAR' },
    })
    const cambios = JSON.parse(evento.cambios ?? '[]')
    const cambioEdicion = cambios.find((c: { campo: string }) => c.campo === 'modulosEdicion')
    expect(cambioEdicion.valorNuevo).toBe('batch-records') // no "—"
  })

  it('no toca modulosEdicion si la petición no cambia modulos ni modulosEdicion', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    const rol = await prisma.rol.create({
      data: { nombre: 'Rol-Test-3', modulos: 'batch-records', modulosEdicion: 'batch-records', activo: true },
    })

    const res = await request(app)
      .put(`/api/roles/${rol.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ descripcion: 'Solo cambia la descripción' })

    expect(res.status).toBe(200)
    const actual = await prisma.rol.findUniqueOrThrow({ where: { id: rol.id } })
    expect(actual.modulosEdicion).toBe('batch-records')
  })
})

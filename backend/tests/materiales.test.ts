import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { app } from '../src/app.js'
import { resetDb, prisma } from './helpers/db.js'
import { crearEscenarioBasico } from './helpers/fixtures.js'
import { tokenPara } from './helpers/auth.js'

beforeEach(async () => {
  await resetDb()
})

// Antes, cada fila fallida del cargue masivo se reducía a un contador, y el frontend asumía
// ciegamente "código duplicado" como la única causa posible sin verificarlo — sin registrar cuál
// código falló ni por qué.
describe('POST /api/materiales/cargue — detalleErrores', () => {
  it('devuelve en la respuesta y guarda en el historial el código y motivo de cada fila fallida', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)

    const res = await request(app)
      .post('/api/materiales/cargue')
      .set('Authorization', `Bearer ${token}`)
      .send({
        archivo: 'cargue-materiales.csv',
        materiales: [
          { codigo: 'MAT-NUEVO', descripcion: 'Material nuevo', tipo: 'PRODUCTO_TERMINADO' },
          { codigo: esc.material.codigo, descripcion: 'Ya existe', tipo: 'PRODUCTO_TERMINADO' },
        ],
      })

    expect(res.status).toBe(201)
    expect(res.body.datos.creados).toBe(1)
    expect(res.body.datos.errores).toBe(1)
    expect(res.body.datos.detalleErrores).toEqual([
      { codigo: esc.material.codigo, motivo: `Ya existe un Material con el código "${esc.material.codigo}"` },
    ])

    const historial = await request(app).get('/api/materiales/cargues').set('Authorization', `Bearer ${token}`)
    const registro = historial.body.find((c: { archivo: string }) => c.archivo === 'cargue-materiales.csv')
    expect(registro.detalleErrores).toEqual([
      { codigo: esc.material.codigo, motivo: `Ya existe un Material con el código "${esc.material.codigo}"` },
    ])
  })

  it('no incluye detalleErrores (arreglo vacío) cuando el cargue no tuvo errores', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)

    const res = await request(app)
      .post('/api/materiales/cargue')
      .set('Authorization', `Bearer ${token}`)
      .send({
        archivo: 'cargue-limpio.csv',
        materiales: [{ codigo: 'MAT-LIMPIO', descripcion: 'Material limpio', tipo: 'PRODUCTO_TERMINADO' }],
      })

    expect(res.status).toBe(201)
    expect(res.body.datos.detalleErrores).toEqual([])

    const historial = await request(app).get('/api/materiales/cargues').set('Authorization', `Bearer ${token}`)
    const registro = historial.body.find((c: { archivo: string }) => c.archivo === 'cargue-limpio.csv')
    expect(registro.detalleErrores).toEqual([])
  })
})

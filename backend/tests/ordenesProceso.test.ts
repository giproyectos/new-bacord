import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { app } from '../src/app.js'
import { resetDb, prisma } from './helpers/db.js'
import { crearEscenarioBasico } from './helpers/fixtures.js'
import { tokenPara } from './helpers/auth.js'

beforeEach(async () => {
  await resetDb()
})

function payloadOrden(esc: Awaited<ReturnType<typeof crearEscenarioBasico>>, numero: string, idRecetaMaestra: number) {
  return {
    idRecetaMaestra,
    numeroOrdenProceso: numero,
    codigoMaterial: esc.material.codigo,
    descripcionMaterial: esc.material.descripcion,
    idCentro: esc.centro.id,
    loteLogistico: 'LOTE-X',
    cantidadOrden: 50,
    unidadMedida: 'kg',
    loteInspeccion: 'INSP-X',
    fechaFabricacion: new Date().toISOString(),
    fechaCaducidad: new Date(Date.now() + 365 * 86400000).toISOString(),
    registroSanitario: 'RS-X',
    formaFarmaceutica: 'Comprimido',
  }
}

// Una Receta Maestra solo queda lista para producción al llegar a Activo (idEstado 1) tras pasar
// por Creación → Revisión → Aprobado (ver recetasMaestras.ts). Sin este chequeo se podía fabricar
// con una receta que nunca pasó por revisión ni aprobación.
describe('POST /api/ordenes-proceso — la Receta Maestra debe estar Activa', () => {
  it('rechaza crear la orden si la receta todavía está en Creación (estado inicial por default)', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    expect(esc.recetaMaestra.idEstado).toBe(4) // Creación

    const res = await request(app)
      .post('/api/ordenes-proceso')
      .set('Authorization', `Bearer ${token}`)
      .send(payloadOrden(esc, 'OP-NUEVA-0001', esc.recetaMaestra.idRecetaMaestra))

    expect(res.status).toBe(409)
    const orden = await prisma.ordenProceso.findUnique({ where: { numeroOrdenProceso: 'OP-NUEVA-0001' } })
    expect(orden).toBeNull()
  })

  it('permite crear la orden una vez que la receta está Activa', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    await prisma.recetaMaestra.update({ where: { idRecetaMaestra: esc.recetaMaestra.idRecetaMaestra }, data: { idEstado: 1 } })

    const res = await request(app)
      .post('/api/ordenes-proceso')
      .set('Authorization', `Bearer ${token}`)
      .send(payloadOrden(esc, 'OP-NUEVA-0002', esc.recetaMaestra.idRecetaMaestra))

    expect(res.status).toBe(201)
  })
})

describe('POST /api/ordenes-proceso/cargue — la Receta Maestra debe estar Activa por fila', () => {
  it('cuenta como error la fila con receta no Activa, sin crear la orden ni bloquear el resto del cargue', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    await prisma.recetaMaestra.update({ where: { idRecetaMaestra: esc.recetaMaestra.idRecetaMaestra }, data: { idEstado: 1 } })
    const recetaNoActiva = await prisma.recetaMaestra.create({
      data: {
        codigo: 'RM-NO-ACTIVA', descripcion: 'No activa', version: '1',
        idCentro: esc.centro.id, idMaterial: esc.material.id,
        usuarioCreacion: 'seed', usuarioModificacion: 'seed',
      },
    })

    const res = await request(app)
      .post('/api/ordenes-proceso/cargue')
      .set('Authorization', `Bearer ${token}`)
      .send({
        archivo: 'cargue-test.xlsx',
        ordenes: [
          payloadOrden(esc, 'OP-CARGUE-OK', esc.recetaMaestra.idRecetaMaestra),
          payloadOrden(esc, 'OP-CARGUE-MAL', recetaNoActiva.idRecetaMaestra),
        ],
        componentes: [[], []],
      })

    expect(res.status).toBe(200)
    expect(res.body.datos.totalCargadas).toBe(1)
    expect(res.body.datos.errores).toBe(1)
    expect(await prisma.ordenProceso.findUnique({ where: { numeroOrdenProceso: 'OP-CARGUE-OK' } })).not.toBeNull()
    expect(await prisma.ordenProceso.findUnique({ where: { numeroOrdenProceso: 'OP-CARGUE-MAL' } })).toBeNull()
  })
})

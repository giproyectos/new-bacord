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

// El formulario de búsqueda de OrdenProcesoList.tsx llamaba a buscar() sin pasarle ningún filtro
// — estos parámetros existían en el backend pero nunca llegaban a usarse desde la UI.
describe('GET /api/ordenes-proceso — filtros', () => {
  it('filtra por numeroOrden, codigoMaterial e idEstado', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    await prisma.recetaMaestra.update({ where: { idRecetaMaestra: esc.recetaMaestra.idRecetaMaestra }, data: { idEstado: 1 } })
    await request(app).post('/api/ordenes-proceso').set('Authorization', `Bearer ${token}`)
      .send(payloadOrden(esc, 'OP-FILTRO-A', esc.recetaMaestra.idRecetaMaestra))
    await request(app).post('/api/ordenes-proceso').set('Authorization', `Bearer ${token}`)
      .send(payloadOrden(esc, 'OP-FILTRO-B', esc.recetaMaestra.idRecetaMaestra))

    const porNumero = await request(app).get('/api/ordenes-proceso?numeroOrden=FILTRO-A').set('Authorization', `Bearer ${token}`)
    expect(porNumero.body.map((o: { numeroOrdenProceso: string }) => o.numeroOrdenProceso)).toEqual(['OP-FILTRO-A'])

    // El fixture ya crea su propia OP (OP-TEST-0001) con el mismo material.
    const porMaterial = await request(app).get(`/api/ordenes-proceso?codigoMaterial=${esc.material.codigo}`).set('Authorization', `Bearer ${token}`)
    expect(porMaterial.body.length).toBe(3)

    const porEstado = await request(app).get('/api/ordenes-proceso?idEstado=2').set('Authorization', `Bearer ${token}`)
    expect(porEstado.body.length).toBe(0) // ambas quedan en 1 (Pendiente), ninguna tiene Fórmula de Control todavía
  })

  it('filtra por rango de fecha de fabricación', async () => {
    const esc = await crearEscenarioBasico()
    const token = tokenPara(esc.usuarioAdmin)
    await prisma.recetaMaestra.update({ where: { idRecetaMaestra: esc.recetaMaestra.idRecetaMaestra }, data: { idEstado: 1 } })
    const vieja = payloadOrden(esc, 'OP-FAB-VIEJA', esc.recetaMaestra.idRecetaMaestra)
    vieja.fechaFabricacion = new Date('2020-01-01').toISOString()
    const reciente = payloadOrden(esc, 'OP-FAB-RECIENTE', esc.recetaMaestra.idRecetaMaestra)
    reciente.fechaFabricacion = new Date().toISOString()
    await request(app).post('/api/ordenes-proceso').set('Authorization', `Bearer ${token}`).send(vieja)
    await request(app).post('/api/ordenes-proceso').set('Authorization', `Bearer ${token}`).send(reciente)

    const res = await request(app)
      .get(`/api/ordenes-proceso?fechaFabricacionDesde=${new Date(Date.now() - 86400000).toISOString().slice(0, 10)}`)
      .set('Authorization', `Bearer ${token}`)

    // El fixture ya crea su propia OP (OP-TEST-0001), fabricada "hoy" igual que OP-FAB-RECIENTE.
    expect(res.body.map((o: { numeroOrdenProceso: string }) => o.numeroOrdenProceso).sort()).toEqual(['OP-FAB-RECIENTE', 'OP-TEST-0001'])
  })
})

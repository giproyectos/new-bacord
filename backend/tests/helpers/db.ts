import { prisma } from '../../src/db/prisma.js'

/**
 * Vacía todas las tablas de la app, en orden que respeta las llaves foráneas (hijos antes que
 * padres). La base de pruebas (`bacord_test`) es de uso exclusivo de este suite — no hay ningún
 * dato que preservar entre corridas, así que cada archivo de prueba arranca de un estado limpio
 * en vez de intentar aislar por IDs o por prefijos únicos.
 */
export async function resetDb() {
  await prisma.auditEntry.deleteMany()
  await prisma.batchRecordLiberacion.deleteMany()
  await prisma.batchRecordFirma.deleteMany()
  await prisma.batchRecordProcesoCierre.deleteMany()
  await prisma.batchRecordDetalleData.deleteMany()
  await prisma.desviacion.deleteMany()
  await prisma.batchRecord.deleteMany()
  await prisma.formulaControl.deleteMany()
  await prisma.componenteOrden.deleteMany()
  await prisma.ordenProceso.deleteMany()
  await prisma.recetaDetalle.deleteMany()
  await prisma.recetaProceso.deleteMany()
  await prisma.recetaMaestra.deleteMany()
  await prisma.estrategiaFirmaItem.deleteMany()
  await prisma.estrategiaFirma.deleteMany()
  await prisma.firma.deleteMany()
  await prisma.detalle.deleteMany()
  await prisma.proceso.deleteMany()
  await prisma.material.deleteMany()
  await prisma.cargueRegistro.deleteMany()
  await prisma.cargueMaterialRegistro.deleteMany()
  await prisma.usuarioGrupo.deleteMany()
  await prisma.usuario.deleteMany()
  await prisma.grupoResponsable.deleteMany()
  await prisma.rol.deleteMany()
  await prisma.centro.deleteMany()
  await prisma.parametro.deleteMany()
}

export { prisma }

import bcrypt from 'bcryptjs'
import { prisma } from './db.js'

export const PIN_PLANO = '135790'

/**
 * Arma la cadena mínima y real (Centro → Material/Proceso → Detalle+EstrategiaFirma/Firma →
 * RecetaMaestra → OrdenProceso → FormulaControl → BatchRecord) necesaria para poder firmar,
 * cerrar una etapa y liberar un lote — exactamente los tres flujos que cubre este suite.
 *
 * `numProcesos` controla cuántas etapas tiene la receta (cada una con su propio Detalle, todas
 * exigiendo la misma Firma de cierre) — útil para probar el orden secuencial de cierre de etapas.
 */
export async function crearEscenarioBasico(numProcesos = 1) {
  const centro = await prisma.centro.create({
    data: { codigo: 'C-TEST', descripcion: 'Centro de pruebas' },
  })

  const usuarioAdmin = await prisma.usuario.create({
    data: {
      numeroIdentificacion: '900000001',
      nombres: 'Admin',
      apellidos: 'De Pruebas',
      login: 'admin.pruebas',
      email: 'admin.pruebas@bacord.test',
      idCentro: centro.id,
      esAdministrador: true,
      activo: true,
      pinHash: await bcrypt.hash(PIN_PLANO, 4), // costo bajo — más rápido en pruebas, no es un secreto real
    },
  })

  const grupo = await prisma.grupoResponsable.create({ data: { nombre: 'Producción-Test' } })
  const firma = await prisma.firma.create({
    data: { codigo: 'F-TEST', descripcion: 'Firma de prueba', texto: 'Confirmo la etapa', idGrupo: grupo.id },
  })
  const estrategiaFirma = await prisma.estrategiaFirma.create({
    data: { codigo: 'EF-TEST', descripcion: 'Estrategia de prueba', usuarioCreacion: 'seed' },
  })
  await prisma.estrategiaFirmaItem.create({
    data: { idEstrategiaFirma: estrategiaFirma.id, idFirma: firma.idFirma, texto: firma.texto, orden: 1 },
  })

  const material = await prisma.material.create({ data: { codigo: 'M-TEST', descripcion: 'Material de prueba' } })

  const recetaMaestra = await prisma.recetaMaestra.create({
    data: {
      codigo: 'RM-TEST', descripcion: 'Receta de prueba', version: '1',
      idCentro: centro.id, idMaterial: material.id,
      usuarioCreacion: 'seed', usuarioModificacion: 'seed',
    },
  })

  const procesos: { idProceso: number; idDetalle: number }[] = []
  for (let i = 1; i <= numProcesos; i++) {
    const proceso = await prisma.proceso.create({
      data: { idMaterial: material.id, codigo: `P-TEST-${i}`, descripcion: `Etapa ${i}`, orden: i },
    })
    const detalle = await prisma.detalle.create({
      data: {
        codigo: `D-TEST-${i}`, descripcion: `Detalle ${i}`,
        idEstrategiaFirma: estrategiaFirma.id, jsonSchema: JSON.stringify({ components: [] }),
      },
    })
    const recetaProceso = await prisma.recetaProceso.create({
      data: { idRecetaMaestra: recetaMaestra.idRecetaMaestra, idProceso: proceso.id, orden: i },
    })
    await prisma.recetaDetalle.create({
      data: { idRecetaProceso: recetaProceso.id, idDetalle: detalle.id, orden: 1 },
    })
    procesos.push({ idProceso: proceso.id, idDetalle: detalle.id })
  }

  const ordenProceso = await prisma.ordenProceso.create({
    data: {
      idRecetaMaestra: recetaMaestra.idRecetaMaestra,
      numeroOrdenProceso: 'OP-TEST-0001',
      codigoMaterial: material.codigo, descripcionMaterial: material.descripcion,
      idCentro: centro.id, loteLogistico: 'LOTE-TEST', cantidadOrden: 100, unidadMedida: 'kg',
      loteInspeccion: 'INSP-TEST', fechaFabricacion: new Date(), fechaCaducidad: new Date(Date.now() + 365 * 86400000),
      registroSanitario: 'RS-TEST', formaFarmaceutica: 'Comprimido',
    },
  })

  const formulaControl = await prisma.formulaControl.create({
    data: { idRecetaMaestra: recetaMaestra.idRecetaMaestra, idOrdenProceso: ordenProceso.idOrdenProceso, idCentro: centro.id, idUsuarioCreacion: usuarioAdmin.idUsuario },
  })

  const batchRecord = await prisma.batchRecord.create({
    data: {
      idFormulaControl: formulaControl.idFormulaControl, idRecetaMaestra: recetaMaestra.idRecetaMaestra,
      idOrdenProceso: ordenProceso.idOrdenProceso, idCentro: centro.id,
      idUsuarioCreacion: usuarioAdmin.idUsuario, idUsuarioModificacion: usuarioAdmin.idUsuario,
    },
  })

  return { centro, usuarioAdmin, grupo, firma, estrategiaFirma, material, recetaMaestra, procesos, ordenProceso, formulaControl, batchRecord }
}

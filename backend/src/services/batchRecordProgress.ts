import type { Prisma } from '@prisma/client'
import { prisma } from '../db/prisma.js'

type Tx = Prisma.TransactionClient | typeof prisma

/** Recalcula porcentajeAvance de un BR: firmas registradas / firmas requeridas por la estructura de su receta. */
export async function recomputePorcentajeAvance(tx: Tx, idBatchRecord: number): Promise<number> {
  const br = await tx.batchRecord.findUniqueOrThrow({ where: { idBatchRecord } })

  const procesos = await tx.recetaProceso.findMany({
    where: { idRecetaMaestra: br.idRecetaMaestra },
    include: {
      detalles: {
        include: { detalle: { include: { estrategiaFirma: { include: { firmas: { where: { activo: true } } } } } } },
      },
    },
  })

  // Una firma registrada queda ligada al Detalle (idDetalle+idFirma), no a la ocurrencia de
  // proceso donde aparece — si el mismo Detalle se reutiliza en varios procesos de la receta,
  // firmarlo una vez cuenta para todas esas ocurrencias. El requerido debe deduplicarse igual,
  // o el porcentaje nunca podría llegar a 100% cuando hay Detalles compartidos entre procesos.
  const requeridas = new Set<string>()
  for (const rp of procesos) {
    for (const rd of rp.detalles) {
      for (const f of rd.detalle.estrategiaFirma?.firmas ?? []) {
        requeridas.add(`${rd.idDetalle}:${f.idFirma}`)
      }
    }
  }
  const totalFirmas = requeridas.size
  const doneFirmas = await tx.batchRecordFirma.count({ where: { idBatchRecord, bloqueKey: '' } })
  const pct = totalFirmas > 0 ? Math.round((doneFirmas / totalFirmas) * 100) : 0

  await tx.batchRecord.update({
    where: { idBatchRecord },
    data: {
      porcentajeAvance: pct,
      // Al completar el 100% de firmas de cierre, el BR pasa de "En proceso" a "Finalizado" (pendiente de liberar).
      ...(pct === 100 && br.idEstado === 1 ? { idEstado: 2 } : {}),
    },
  })

  return pct
}

/** Estructura completa (procesos + detalles, con su schema Form.io y las firmas requeridas) de la receta de un batch record. */
export async function getEstructuraProcesos(tx: Tx, idRecetaMaestra: number) {
  return tx.recetaProceso.findMany({
    where: { idRecetaMaestra },
    orderBy: { orden: 'asc' },
    include: {
      proceso: true,
      detalles: {
        orderBy: { orden: 'asc' },
        include: {
          detalle: {
            include: {
              estrategiaFirma: {
                include: { firmas: { where: { activo: true }, orderBy: { orden: 'asc' }, include: { firma: { include: { grupo: true } } } } },
              },
            },
          },
        },
      },
    },
  })
}

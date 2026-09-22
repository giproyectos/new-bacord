import type { Prisma } from '@prisma/client'
import { prisma } from '../db/prisma.js'
import { ConflictError, ValidationError } from '../utils/errors.js'

type Tx = Prisma.TransactionClient | typeof prisma

// Una Receta Maestra recorre Creación → Revisión → Aprobado antes de llegar a Activo (idEstado 1,
// ver recetasMaestras.ts) — es la única que ya pasó por el flujo de aprobación y está lista para
// producción. Se valida tanto al crear la Orden de Proceso como al crear la Fórmula de Control y
// al enviarla a producción — una receta puede Inactivarse (transición válida sin restricciones)
// después de que ya existe una Orden de Proceso pendiente, y sin este chequeo en los tres pasos
// esa orden todavía podía usarse para arrancar un Batch Record con una receta ya inactiva.
export async function assertRecetaActiva(tx: Tx, idRecetaMaestra: number) {
  const receta = await tx.recetaMaestra.findUnique({ where: { idRecetaMaestra } })
  if (!receta) throw new ValidationError('La Receta Maestra indicada no existe')
  if (receta.idEstado !== 1) {
    throw new ConflictError(`La Receta Maestra "${receta.codigo}" no está Activa — no se puede continuar con ella`)
  }
}

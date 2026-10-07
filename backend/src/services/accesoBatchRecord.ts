import type { Prisma } from '@prisma/client'
import { prisma } from '../db/prisma.js'
import type { AuthTokenPayload } from '../middleware/auth.js'

type Tx = Prisma.TransactionClient | typeof prisma

/**
 * Los Grupos Responsables involucrados en una Receta Maestra: los de cada Firma que pide algún
 * formulario de sus etapas, vía su Estrategia de Firma. Se calcula en vivo a partir de la
 * estructura actual de la receta — igual que el resto del sistema nunca usa una foto congelada
 * de la receta (ver el comentario de detalles.ts) — así que si se agrega o quita un formulario,
 * o se cambia su estrategia, el acceso se ajusta sin tocar Batch Records ya creados.
 */
export async function gruposDeReceta(tx: Tx, idRecetaMaestra: number): Promise<Set<number>> {
  const procesos = await tx.recetaProceso.findMany({
    where: { idRecetaMaestra },
    select: {
      detalles: {
        select: {
          detalle: {
            select: {
              estrategiaFirma: {
                select: {
                  firmas: { select: { firma: { select: { idGrupo: true } } } },
                  gruposDerogacion: true, // CSV de NOMBRES de grupo, no de ids — ver nota abajo
                },
              },
            },
          },
        },
      },
    },
  })
  const grupos = new Set<number>()
  const nombresDerogacion = new Set<string>()
  for (const p of procesos) {
    for (const rd of p.detalles) {
      const ef = rd.detalle.estrategiaFirma
      if (!ef) continue
      for (const item of ef.firmas) grupos.add(item.firma.idGrupo)
      for (const nombre of (ef.gruposDerogacion ?? '').split(',').map((s) => s.trim()).filter(Boolean)) {
        nombresDerogacion.add(nombre)
      }
    }
  }
  // Quien puede derogar una firma también necesita poder ver el Batch Record para hacerlo — sin
  // esto, un usuario de Calidad autorizado a derogar (por `gruposDerogacion`, configurado en la
  // Estrategia de Firma) quedaría bloqueado del lote por esta misma regla de acceso.
  if (nombresDerogacion.size > 0) {
    const gruposPorNombre = await tx.grupoResponsable.findMany({
      where: { nombre: { in: [...nombresDerogacion] } }, select: { id: true },
    })
    for (const g of gruposPorNombre) grupos.add(g.id)
  }
  return grupos
}

/**
 * Un administrador siempre tiene acceso. Para el resto: mismo Centro del lote, y al menos un
 * Grupo Responsable en común con la receta — si la receta no tiene ningún Grupo asociado
 * todavía (ninguno de sus formularios tiene estrategia de firma), el Centro ya alcanza, para no
 * dejar un lote sin ningún Grupo visible para nadie.
 */
export function puedeAccederBatchRecord(
  auth: AuthTokenPayload,
  br: { idCentro: number },
  gruposReceta: Set<number>
): boolean {
  if (auth.esAdministrador) return true
  if (br.idCentro !== auth.idCentro) return false
  if (gruposReceta.size === 0) return true
  const gruposUsuario = new Set(auth.grupos ?? [])
  for (const g of gruposReceta) if (gruposUsuario.has(g)) return true
  return false
}

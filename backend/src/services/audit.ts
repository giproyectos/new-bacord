import type { Prisma } from '@prisma/client'
import { prisma } from '../db/prisma.js'

type Tx = Prisma.TransactionClient | typeof prisma

export type AuditAccion =
  | 'CREAR' | 'MODIFICAR' | 'CANCELAR'
  | 'FIRMAR_SECCION' | 'FIRMAR_CIERRE' | 'DEROGAR_FIRMA' | 'LIBERAR_LOTE'
  | 'LOGIN' | 'LOGIN_FALLIDO' | 'LOGOUT'

export type AuditEntidad =
  | 'BatchRecord' | 'DetalleValores' | 'FirmaSeccion' | 'FirmaCierre' | 'Sesion'
  | 'Centro' | 'Material' | 'Proceso' | 'Firma' | 'EstrategiaFirma' | 'Detalle'
  | 'GrupoResponsable' | 'Parametro' | 'RecetaMaestra' | 'OrdenProceso' | 'FormulaControl'
  | 'Usuario' | 'Rol'

export interface AuditCambio {
  campo: string
  etiqueta: string
  valorAnterior: string
  valorNuevo: string
}

interface LogAuditParams {
  entidad: AuditEntidad
  idEntidad: string | number
  descripcionEntidad: string
  accion: AuditAccion
  modulo: string
  motivo?: string
  cambios?: AuditCambio[]
  actor: { idUsuario: number; nombreUsuario: string; loginUsuario: string; cargo: string }
}

export async function logAudit(tx: Tx, params: LogAuditParams) {
  const { actor, idEntidad, cambios, ...rest } = params
  return tx.auditEntry.create({
    data: {
      ...rest,
      idEntidad: String(idEntidad),
      idUsuario: actor.idUsuario || null,
      nombreUsuario: actor.nombreUsuario,
      loginUsuario: actor.loginUsuario,
      cargo: actor.cargo,
      cambios: cambios && cambios.length > 0 ? JSON.stringify(cambios) : null,
    },
  })
}

const CARGO_MAP: Record<string, string> = {
  Producción: 'Operario de Producción',
  Calidad: 'Analista de Control de Calidad',
  Supervisión: 'Supervisor de Producción',
  Administradores: 'Administrador del Sistema',
  Dirección: 'Director Técnico de Planta',
}

export function cargoDeGrupos(grupoNombres: string[], esAdministrador: boolean): string {
  if (esAdministrador) return CARGO_MAP.Administradores
  const primero = grupoNombres[0]
  return (primero && CARGO_MAP[primero]) || primero || 'Usuario'
}

/** Identidad + cargo del usuario autenticado, lista para usar como `actor` en logAudit. */
export async function actorDe(tx: Tx, idUsuario: number) {
  const usuario = await tx.usuario.findUniqueOrThrow({
    where: { idUsuario },
    include: { grupos: { include: { grupo: true } } },
  })
  return {
    idUsuario: usuario.idUsuario,
    nombreUsuario: `${usuario.nombres} ${usuario.apellidos}`,
    loginUsuario: usuario.login,
    cargo: cargoDeGrupos(usuario.grupos.map((g) => g.grupo.nombre), usuario.esAdministrador),
  }
}

/**
 * Compara dos objetos plano-por-campo y devuelve solo los campos presentes en `nuevo` cuyo
 * valor cambió respecto a `anterior` — usado para el detalle "campo por campo" de MODIFICAR.
 */
export function diffObjetos(
  anterior: Record<string, unknown>,
  nuevo: Record<string, unknown>,
  etiquetas: Record<string, string>
): AuditCambio[] {
  const cambios: AuditCambio[] = []
  for (const [campo, etiqueta] of Object.entries(etiquetas)) {
    if (!(campo in nuevo)) continue
    const av = anterior[campo]
    const nv = nuevo[campo]
    const avStr = av === null || av === undefined ? '' : String(av)
    const nvStr = nv === null || nv === undefined ? '' : String(nv)
    if (avStr !== nvStr) cambios.push({ campo, etiqueta, valorAnterior: avStr, valorNuevo: nvStr })
  }
  return cambios
}

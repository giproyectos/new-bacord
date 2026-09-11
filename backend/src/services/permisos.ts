import { MODULO_CLAVES } from '../constants/modulos.js'

export type RolPermisos = { activo: boolean; modulos: string; modulosEdicion: string | null } | null

/** Claves de módulo con acceso de lectura, según el Rol del usuario (todas si es administrador). */
export function modulosDe(usuario: { esAdministrador: boolean; rol: RolPermisos }): string[] {
  if (usuario.esAdministrador) return [...MODULO_CLAVES]
  if (!usuario.rol || !usuario.rol.activo) return []
  return usuario.rol.modulos.split(',').map((s) => s.trim()).filter(Boolean)
}

/** Claves de módulo con permiso de edición (subconjunto de `modulosDe`), según el Rol del usuario. */
export function modulosEdicionDe(usuario: { esAdministrador: boolean; rol: RolPermisos }): string[] {
  if (usuario.esAdministrador) return [...MODULO_CLAVES]
  if (!usuario.rol || !usuario.rol.activo) return []
  return (usuario.rol.modulosEdicion ?? '').split(',').map((s) => s.trim()).filter(Boolean)
}

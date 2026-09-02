import { useAuthStore } from '@/stores/authStore'
import type { ModuloClave } from '@/constants/modulos'

/** true si el usuario actual (admin, o su Rol) tiene permiso de EDICIÓN sobre ese módulo. */
export function usePuedeEditar(clave: ModuloClave): boolean {
  return useAuthStore((s) => !!s.user?.esAdministrador || !!s.user?.moduloEdicion?.includes(clave))
}

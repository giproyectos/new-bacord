import { auditoriaApi } from '@/api/auditoria'
import type { AuditAccion, AuditEntidad, AuditCambio } from '@/types/audit'

export function useAudit() {
  // El backend deriva el actor siempre de la sesión autenticada (req.auth), nunca de lo que
  // mande el cliente — antes este hook armaba un `firmante` completo (idUsuario, nombre, login,
  // cargo) y lo mandaba en el body, y el backend lo aceptaba sin verificarlo contra la sesión
  // real, permitiendo falsificar a quién se le atribuye un evento de auditoría.
  const registrar = (params: {
    entidad: AuditEntidad
    idEntidad: string | number
    descripcionEntidad: string
    accion: AuditAccion
    modulo: string
    cambios?: AuditCambio[]
    motivo?: string
  }) => {
    void auditoriaApi.registrar(params).catch((err) => {
      console.error('No se pudo registrar el evento de auditoría', err)
    })
  }

  return { registrar }
}

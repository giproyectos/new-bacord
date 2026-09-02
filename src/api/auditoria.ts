import { http } from './http'
import type { AuditAccion, AuditCambio, AuditEntidad, AuditEntry } from '@/types/audit'

export interface FirmanteAudit {
  idUsuario: number
  nombreUsuario: string
  loginUsuario: string
  cargo: string
}

export interface RegistrarAuditParams {
  entidad: AuditEntidad
  idEntidad: string | number
  descripcionEntidad: string
  accion: AuditAccion
  modulo: string
  cambios?: AuditCambio[]
  motivo?: string
  firmante?: FirmanteAudit
}

export const auditoriaApi = {
  registrar: async (params: RegistrarAuditParams): Promise<void> => {
    await http.post('/auditoria', params)
  },
  consultar: async (filtro?: { entidad?: AuditEntidad; idEntidad?: string | number }): Promise<AuditEntry[]> => {
    const { data } = await http.get<AuditEntry[]>('/auditoria', { params: filtro })
    return data
  },
}

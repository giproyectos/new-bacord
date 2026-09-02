import { useAuthStore } from '@/stores/authStore'
import { auditoriaApi } from '@/api/auditoria'
import type { AuditAccion, AuditEntidad, AuditCambio } from '@/types/audit'

const CARGO_MAP: Record<string, string> = {
  'Producción':      'Operario de Producción',
  'Calidad':         'Analista de Control de Calidad',
  'Supervisión':     'Supervisor de Producción',
  'Administradores': 'Administrador del Sistema',
  'Dirección':       'Director Técnico de Planta',
}

export interface FirmanteAudit {
  idUsuario: number
  nombreUsuario: string
  loginUsuario: string
  cargo: string
}

export function useAudit() {
  const user = useAuthStore(s => s.user)

  const registrar = (params: {
    entidad: AuditEntidad
    idEntidad: string | number
    descripcionEntidad: string
    accion: AuditAccion
    modulo: string
    cambios?: AuditCambio[]
    motivo?: string
    firmante?: FirmanteAudit
  }) => {
    const { firmante, ...rest } = params
    const primaryGrupo = (user?.grupos ?? '').split(',')[0].trim()

    // Usar el firmante explícito, luego el usuario de sesión, luego un actor anónimo
    // para que NUNCA se pierda un evento de auditoría
    const actor: FirmanteAudit = firmante ?? (user ? {
      idUsuario: user.idUsuario,
      nombreUsuario: `${user.nombres} ${user.apellidos}`,
      loginUsuario: user.login,
      cargo: CARGO_MAP[primaryGrupo] ?? (primaryGrupo || 'Usuario'),
    } : {
      idUsuario: 0,
      nombreUsuario: 'Sin identificar',
      loginUsuario: 'desconocido',
      cargo: 'Sin sesión activa',
    })

    void auditoriaApi.registrar({ ...rest, firmante: actor }).catch((err) => {
      console.error('No se pudo registrar el evento de auditoría', err)
    })
  }

  return { registrar }
}

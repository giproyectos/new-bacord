import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/stores/authStore'
import { useAudit } from '@/hooks/useAudit'

const EVENTOS_ACTIVIDAD = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'wheel'] as const

/**
 * Bloqueo automático de sesión por inactividad — punto 4 del checklist GxP/21 CFR 11. Los
 * minutos son un `Parametro` configurable por cliente (`sesion_inactividad_minutos`, GET
 * /auth/sesion-config), no un valor fijo en el frontend.
 */
export function useInactividad() {
  const logout = useAuthStore((s) => s.logout)
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const { registrar } = useAudit()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelado = false
    let minutos = 5

    const cerrarPorInactividad = () => {
      registrar({
        entidad: 'Sesion', idEntidad: user?.idUsuario ?? 0,
        descripcionEntidad: `Cierre de sesión por inactividad — ${user?.login ?? ''}`,
        accion: 'LOGOUT', modulo: 'autenticacion', motivo: 'Inactividad',
      })
      logout()
      navigate('/login?motivo=inactividad', { replace: true })
    }

    const reiniciarTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(cerrarPorInactividad, minutos * 60 * 1000)
    }

    authApi.sesionConfig()
      .then((cfg) => { if (!cancelado) { minutos = cfg.inactividadMinutos; reiniciarTimer() } })
      .catch(() => { if (!cancelado) reiniciarTimer() })

    EVENTOS_ACTIVIDAD.forEach((evento) => window.addEventListener(evento, reiniciarTimer))

    return () => {
      cancelado = true
      if (timerRef.current) clearTimeout(timerRef.current)
      EVENTOS_ACTIVIDAD.forEach((evento) => window.removeEventListener(evento, reiniciarTimer))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

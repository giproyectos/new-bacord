import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import type { AuthUser } from '@/types'

/**
 * Destino del redirect final de `/api/auth/oidc/callback`. El backend ya validó la identidad
 * contra el proveedor y busca el Usuario por correo — esta página solo toma la sesión que llega
 * en el fragmento de la URL (nunca en la query ni en el path, para que no quede en logs del
 * servidor ni en el historial de red) y la guarda como cualquier login local.
 */
export function OidcCallbackPage() {
  const setAuth = useAuthStore((s) => s.login)
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const ranRef = useRef(false)

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true
    const hash = window.location.hash.replace(/^#/, '')
    const params = new URLSearchParams(hash)
    const raw = params.get('session')
    if (!raw) { setError('No se recibió una sesión válida del proveedor de identidad.'); return }
    try {
      const user = JSON.parse(decodeURIComponent(raw)) as AuthUser
      setAuth(user)
      navigate('/', { replace: true })
    } catch {
      setError('No se pudo leer la sesión recibida del proveedor de identidad.')
    }
  }, [setAuth, navigate])

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--navy-900)' }}>
        <div style={{ background: 'var(--paper)', borderRadius: 12, padding: '28px 32px', maxWidth: 380, textAlign: 'center' }}>
          <p style={{ color: '#b91c1c', fontSize: 14, marginBottom: 16 }}>{error}</p>
          <a href="/login" style={{ color: 'var(--navy)', fontWeight: 600, fontSize: 14 }}>Volver a iniciar sesión</a>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--navy-900)' }}>
      <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>Iniciando sesión…</div>
    </div>
  )
}

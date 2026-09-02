import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '@/api/auth'

export function ActivarCuentaPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const navigate = useNavigate()

  const [checking, setChecking] = useState(true)
  const [valido, setValido] = useState(false)
  const [nombre, setNombre] = useState('')
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [listo, setListo] = useState(false)

  useEffect(() => {
    if (!token) { setChecking(false); return }
    authApi.validarTokenActivacion(token)
      .then(r => { setValido(r.valido); setNombre(r.nombre ?? '') })
      .catch(() => setValido(false))
      .finally(() => setChecking(false))
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }
    if (password !== confirmar) { setError('Las contraseñas no coinciden'); return }
    setLoading(true)
    try {
      const res = await authApi.activarCuenta(token, password)
      if (!res.estado) { setError(res.mensaje); return }
      setListo(true)
      setTimeout(() => navigate('/login'), 2500)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al activar la cuenta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style>{`
        .activar-page { min-height: 100vh; background: var(--navy-900); display: flex; align-items: center; justify-content: center; padding: 20px; }
        .activar-v2 { width: 380px; }
        .activar-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
        .activar-header .brand { color: #fff; font-size: 26px; font-weight: 800; letter-spacing: 0.04em; }
        .activar-header .brand small { display: block; font-size: 12px; font-weight: 400; color: rgba(255,255,255,0.45); margin-top: 2px; letter-spacing: 0; }
        .activar-header .icon { color: rgba(255,255,255,0.2); font-size: 36px; }
        .activar-content { background: var(--paper); border-radius: var(--r-xl); box-shadow: var(--sh-3); padding: 32px 30px; margin-top: 20px; }
        .activar-content .form-group { margin-bottom: 16px; }
        .activar-content .form-control { width: 100%; padding: 11px 14px; background: var(--white); border: 1.5px solid var(--hair-2); border-radius: var(--r-sm); font-size: 14px; color: var(--ink); font-family: var(--f-sans); outline: none; transition: border-color 150ms; }
        .activar-content .form-control:focus { border-color: var(--navy); }
        .activar-msg { text-align: center; color: var(--ink-3); font-size: 13.5px; line-height: 1.6; }
        .activar-error { margin-top: 12px; padding: 10px 14px; background: #fef2f2; border: 1px solid #fecaca; border-radius: var(--r-sm); font-size: 13px; color: #b91c1c; }
        .activar-ok { text-align: center; color: #065F46; font-size: 14px; font-weight: 600; }
      `}</style>
      <div className="activar-page">
        <div className="activar-v2">
          <div className="activar-header">
            <div className="brand"><b>BAC</b>ord<small>Activación de cuenta</small></div>
            <div className="icon"><i className="fa fa-key" /></div>
          </div>
          <div className="activar-content">
            {checking ? (
              <p className="activar-msg"><i className="fa fa-spinner fa-spin" /> Verificando enlace…</p>
            ) : listo ? (
              <p className="activar-ok"><i className="fa fa-check-circle" /> Contraseña definida. Redirigiendo al login…</p>
            ) : !token || !valido ? (
              <p className="activar-msg">
                Este enlace es inválido o ya venció. Solicita uno nuevo al administrador del sistema
                {nombre ? ` para la cuenta de ${nombre}` : ''}.
              </p>
            ) : (
              <form onSubmit={handleSubmit}>
                <p className="activar-msg" style={{ marginBottom: 16 }}>
                  Hola{nombre ? ` ${nombre}` : ''}, define tu contraseña para activar tu cuenta.
                </p>
                <div className="form-group">
                  <input
                    type="password" className="form-control" placeholder="Nueva contraseña"
                    value={password} onChange={e => setPassword(e.target.value)} autoFocus autoComplete="new-password"
                  />
                </div>
                <div className="form-group">
                  <input
                    type="password" className="form-control" placeholder="Confirmar contraseña"
                    value={confirmar} onChange={e => setConfirmar(e.target.value)} autoComplete="new-password"
                  />
                </div>
                <button type="submit" className="btn btn-success btn-block btn-lg" disabled={loading || !password || !confirmar}>
                  {loading ? 'Guardando…' : 'Activar cuenta'}
                </button>
                {error && <div className="activar-error"><i className="fa fa-warning" /> {error}</div>}
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

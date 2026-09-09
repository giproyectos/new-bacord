import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { authApi, type PoliticaPassword } from '@/api/auth'

const POLITICA_POR_DEFECTO: PoliticaPassword = {
  minCaracteres: 8, requiereMayuscula: true, requiereMinuscula: true, requiereEspecial: true,
}

/** Frase legible con los requisitos vigentes — la política es configurable por cliente. */
function describirPolitica(p: PoliticaPassword): string {
  const requisitos = [`mínimo ${p.minCaracteres} caracteres`]
  if (p.requiereMayuscula) requisitos.push('una mayúscula')
  if (p.requiereMinuscula) requisitos.push('una minúscula')
  if (p.requiereEspecial) requisitos.push('un carácter especial')
  if (requisitos.length === 1) return `Debe tener ${requisitos[0]}.`
  return `Debe tener ${requisitos.slice(0, -1).join(', ')} y ${requisitos[requisitos.length - 1]}.`
}

function validarContraPolitica(password: string, p: PoliticaPassword): string | null {
  if (password.length < p.minCaracteres) return `La contraseña debe tener al menos ${p.minCaracteres} caracteres`
  if (p.requiereMayuscula && !/[A-Z]/.test(password)) return 'La contraseña debe incluir al menos una mayúscula'
  if (p.requiereMinuscula && !/[a-z]/.test(password)) return 'La contraseña debe incluir al menos una minúscula'
  if (p.requiereEspecial && !/[^A-Za-z0-9]/.test(password)) return 'La contraseña debe incluir al menos un carácter especial'
  return null
}

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
  const [politica, setPolitica] = useState<PoliticaPassword>(POLITICA_POR_DEFECTO)

  useEffect(() => {
    if (!token) { setChecking(false); return }
    authApi.validarTokenActivacion(token)
      .then(r => { setValido(r.valido); setNombre(r.nombre ?? '') })
      .catch(() => setValido(false))
      .finally(() => setChecking(false))
    authApi.config().then(cfg => setPolitica(cfg.passwordPolitica)).catch(() => {})
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const errorPolitica = validarContraPolitica(password, politica)
    if (errorPolitica) { setError(errorPolitica); return }
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
                  <small style={{ display: 'block', marginTop: 6, color: 'var(--ink-3)', fontSize: 12 }}>
                    {describirPolitica(politica)}
                  </small>
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

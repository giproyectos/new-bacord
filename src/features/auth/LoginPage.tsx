import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/stores/authStore'

const OIDC_ERROR_MENSAJES: Record<string, string> = {
  no_registrado: 'Su cuenta no está registrada en Bacord. Contacte a su administrador para que le asigne acceso.',
  proveedor: 'No se pudo completar el inicio de sesión con el proveedor de identidad. Intente de nuevo.',
  estado_invalido: 'La sesión de inicio de sesión venció o no es válida. Intente de nuevo.',
}

export function LoginPage() {
  const [login, setLogin] = useState('')
  const [clave, setClave] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showRecuperar, setShowRecuperar] = useState(false)
  const [email, setEmail] = useState('')
  const [recuperarEnviando, setRecuperarEnviando] = useState(false)
  const [recuperarMensaje, setRecuperarMensaje] = useState('')
  const [oidc, setOidc] = useState<{ oidcEnabled: boolean; oidcLabel: string } | null>(null)
  const setAuth = useAuthStore((s) => s.login)
  const navigate = useNavigate()

  useEffect(() => {
    authApi.config().then(setOidc).catch(() => setOidc({ oidcEnabled: false, oidcLabel: '' }))
    const params = new URLSearchParams(window.location.search)
    const oidcError = params.get('oidcError')
    if (oidcError) setError(OIDC_ERROR_MENSAJES[oidcError] ?? 'No se pudo iniciar sesión con el proveedor de identidad.')
    else if (params.get('motivo') === 'inactividad') setError('Su sesión se cerró automáticamente por inactividad.')
  }, [])

  const cerrarRecuperar = () => { setShowRecuperar(false); setEmail(''); setRecuperarMensaje('') }

  const handleRecuperar = async () => {
    if (!email) return
    setRecuperarEnviando(true)
    try {
      const res = await authApi.olvideClave(email)
      setRecuperarMensaje(res.mensaje)
    } catch {
      setRecuperarMensaje('Si el correo está registrado, se envió un enlace para restablecer la contraseña.')
    } finally {
      setRecuperarEnviando(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!login || !clave) return
    setLoading(true); setError('')
    try {
      const user = await authApi.login(login, clave)
      setAuth(user); navigate('/')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión')
    } finally { setLoading(false) }
  }

  return (
    <>
      <style>{`
        .login-page {
          min-height: 100vh;
          background: var(--navy-900);
          display: flex; align-items: center; justify-content: center;
        }
        .login-v2 {
          width: 380px;
        }
        .login-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 4px;
        }
        .login-header .brand {
          color: #fff; font-size: 26px; font-weight: 800; letter-spacing: 0.04em;
        }
        .login-header .brand b { color: #fff; }
        .login-header .brand small {
          display: block; font-size: 12px; font-weight: 400;
          color: rgba(255,255,255,0.45); margin-top: 2px; letter-spacing: 0;
        }
        .login-header .icon { color: rgba(255,255,255,0.2); font-size: 36px; }

        .login-content {
          background: var(--paper); border-radius: var(--r-xl);
          box-shadow: var(--sh-3); padding: 32px 30px; margin-top: 20px;
        }
        .login-content .form-group { margin-bottom: 16px; }
        .login-content .form-control {
          width: 100%; padding: 11px 14px;
          background: var(--white); border: 1.5px solid var(--hair-2);
          border-radius: var(--r-sm); font-size: 14px; color: var(--ink);
          font-family: var(--f-sans); outline: none; transition: border-color 150ms;
        }
        .login-content .form-control:focus { border-color: var(--navy); }
        .login-content .form-control::placeholder { color: var(--ink-4); }

        .login-buttons .btn-success {
          width: 100%; padding: 11px;
          background: var(--navy); color: #fff; border: none;
          border-radius: var(--r-sm); font-size: 14px; font-weight: 600;
          font-family: var(--f-sans); cursor: pointer; transition: background 150ms;
        }
        .login-buttons .btn-success:hover:not(:disabled) { background: var(--navy-700); }
        .login-buttons .btn-success:disabled { opacity: 0.5; cursor: not-allowed; }

        .login-forgot { margin-top: 14px; font-size: 13px; color: var(--ink-3); }
        .login-forgot a { color: var(--navy); text-decoration: none; font-weight: 600; }
        .login-forgot a:hover { text-decoration: underline; }

        .login-oidc-btn {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          width: 100%; padding: 11px; margin-bottom: 16px;
          background: #fff; color: var(--navy); border: 1.5px solid var(--hair-2);
          border-radius: var(--r-sm); font-size: 14px; font-weight: 600;
          font-family: var(--f-sans); text-decoration: none; cursor: pointer;
          transition: border-color 150ms, background 150ms; box-sizing: border-box;
        }
        .login-oidc-btn:hover { border-color: var(--navy); background: var(--paper-2); }

        .login-oidc-divider {
          display: flex; align-items: center; gap: 10px;
          margin-bottom: 16px; font-size: 11.5px; color: var(--ink-4);
        }
        .login-oidc-divider::before, .login-oidc-divider::after {
          content: ''; flex: 1; height: 1px; background: var(--hair-2);
        }

        .login-error {
          margin-top: 12px; padding: 10px 14px;
          background: #fef2f2; border: 1px solid #fecaca;
          border-radius: var(--r-sm); font-size: 13px; color: #b91c1c;
        }

        /* Modal recuperar clave */
        .modal-overlay {
          position: fixed; inset: 0; z-index: 100;
          background: rgba(10,21,48,0.5);
          display: flex; align-items: center; justify-content: center; padding: 20px;
        }
        .modal-box {
          background: var(--paper); border-radius: var(--r-xl);
          box-shadow: var(--sh-3); width: 100%; max-width: 400px;
          border: 1px solid var(--hair);
        }
        .modal-box .modal-header {
          padding: 18px 22px 14px;
          border-bottom: 1px solid var(--hair);
          font-size: 15px; font-weight: 700; color: var(--ink);
        }
        .modal-box .modal-body {
          padding: 18px 22px; font-size: 13.5px; color: var(--ink-3);
        }
        .modal-box .modal-body input {
          width: 100%; margin-top: 12px; padding: 10px 14px;
          border: 1.5px solid var(--hair-2); border-radius: var(--r-sm);
          font-size: 14px; color: var(--ink); font-family: var(--f-sans); outline: none;
        }
        .modal-box .modal-body input:focus { border-color: var(--navy); }
        .modal-box .modal-footer {
          padding: 14px 22px; border-top: 1px solid var(--hair);
          display: flex; justify-content: flex-end; gap: 8px;
        }
        .btn-gray {
          padding: 7px 16px; background: var(--paper-2); border: 1.5px solid var(--hair-2);
          border-radius: var(--r-sm); font-size: 13px; cursor: pointer; font-family: var(--f-sans);
          color: var(--ink-3);
        }
        .btn-sm-success {
          padding: 7px 16px; background: var(--navy); color: #fff;
          border: none; border-radius: var(--r-sm); font-size: 13px;
          cursor: pointer; font-family: var(--f-sans); font-weight: 600;
        }

        .login-hint {
          text-align: center; margin-top: 18px;
          font-family: var(--f-mono); font-size: 10px; color: rgba(255,255,255,0.3);
          letter-spacing: 0.08em;
        }
        .login-hint strong { color: rgba(255,255,255,0.5); }
      `}</style>

      <div className="login-page">
        <div className="login-v2">
          {/* Header */}
          <div className="login-header">
            <div className="brand">
              <b>BAC</b>ord
              <small>Su herramienta para el registro de actividades</small>
            </div>
            <div className="icon">
              <i className="fa fa-lock" />
            </div>
          </div>

          {/* Form */}
          <div className="login-content">
            {oidc?.oidcEnabled && (
              <>
                <a href={authApi.oidcLoginUrl()} className="login-oidc-btn">
                  <i className="fa fa-building" /> Ingresar con {oidc.oidcLabel}
                </a>
                <div className="login-oidc-divider"><span>o con tu cuenta local</span></div>
              </>
            )}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <input
                  type="text"
                  className="form-control form-control-lg"
                  placeholder="Login en el sistema"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  autoComplete="off"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <input
                  type="password"
                  className="form-control form-control-lg"
                  placeholder="Clave"
                  value={clave}
                  onChange={(e) => setClave(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="login-buttons">
                <button type="submit" className="btn btn-success btn-block btn-lg" disabled={loading || !login || !clave}>
                  {loading ? 'Ingresando...' : 'Ingresar'}
                </button>
              </div>
              <div className="login-forgot">
                Olvidé mi clave Click{' '}
                <a href="#" onClick={(e) => { e.preventDefault(); setShowRecuperar(true) }}>aquí</a>.
              </div>
              {error && <div className="login-error"><i className="fa fa-warning" /> {error}</div>}
            </form>
          </div>

        </div>
      </div>

      {/* Modal recuperar clave */}
      {showRecuperar && (
        <div className="modal-overlay" onClick={cerrarRecuperar}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">Recuperar clave</div>
            <div className="modal-body">
              {recuperarMensaje ? (
                <p style={{ color: 'var(--forest)' }}><i className="fa fa-check-circle" /> {recuperarMensaje}</p>
              ) : (
                <>
                  Digite su email y le enviaremos un enlace para restablecer su contraseña
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoFocus
                  />
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-gray" onClick={cerrarRecuperar}>{recuperarMensaje ? 'Cerrar' : 'Regresar'}</button>
              {!recuperarMensaje && (
                <button className="btn-sm-success" onClick={handleRecuperar} disabled={!email || recuperarEnviando}>
                  {recuperarEnviando ? 'Enviando…' : 'Enviar'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

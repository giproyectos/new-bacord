import { useState } from 'react'
import { Panel } from '@/components/shared/Panel'
import { authApi } from '@/api/auth'

const PIN_RE = /^\d{4,8}$/

export function ConfigurarPinPage() {
  const [pinActual, setPinActual] = useState('')
  const [pinNuevo, setPinNuevo] = useState('')
  const [pinConfirmar, setPinConfirmar] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setOk('')
    if (!PIN_RE.test(pinNuevo)) { setError('El PIN debe tener entre 4 y 8 dígitos'); return }
    if (pinNuevo !== pinConfirmar) { setError('Los PIN no coinciden'); return }
    setLoading(true)
    try {
      const res = await authApi.configurarPin(pinNuevo, pinActual || undefined)
      if (!res.estado) { setError(res.mensaje); return }
      setOk(res.mensaje)
      setPinActual(''); setPinNuevo(''); setPinConfirmar('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al configurar el PIN')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Panel title={<><i className="fa fa-key" /> PIN de Firma Electrónica</>}>
      <p style={{ fontSize: 13.5, color: 'var(--ink-3)', maxWidth: 560, lineHeight: 1.6, marginBottom: 20 }}>
        El PIN de firma es un código corto, distinto de tu contraseña de acceso al sistema, que se te
        pedirá cada vez que firmes un paso del batch record o autorices la liberación de un lote.
        Solo tú debes conocerlo.
      </p>
      <form onSubmit={handleSubmit} style={{ maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 5 }}>
            PIN actual <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>(vacío si es la primera vez)</span>
          </label>
          <input type="password" inputMode="numeric" className="form-control" value={pinActual}
            onChange={e => setPinActual(e.target.value)} placeholder="••••••" />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 5 }}>
            PIN nuevo <span style={{ color: 'var(--orange)', fontWeight: 400 }}>(4 a 8 dígitos)</span>
          </label>
          <input type="password" inputMode="numeric" className="form-control" value={pinNuevo}
            onChange={e => setPinNuevo(e.target.value)} placeholder="••••••" autoFocus />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 5 }}>
            Confirmar PIN nuevo
          </label>
          <input type="password" inputMode="numeric" className="form-control" value={pinConfirmar}
            onChange={e => setPinConfirmar(e.target.value)} placeholder="••••••" />
        </div>
        {error && (
          <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 'var(--r-sm)', fontSize: 12.5, color: '#b91c1c' }}>
            <i className="fa fa-exclamation-circle" /> {error}
          </div>
        )}
        {ok && (
          <div style={{ padding: '8px 12px', background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 'var(--r-sm)', fontSize: 12.5, color: '#15803d' }}>
            <i className="fa fa-check-circle" /> {ok}
          </div>
        )}
        <button type="submit" className="btn btn-primary" disabled={loading || !pinNuevo || !pinConfirmar}>
          {loading ? <><i className="fa fa-spinner fa-spin" /> Guardando…</> : <><i className="fa fa-save" /> Guardar PIN</>}
        </button>
      </form>
    </Panel>
  )
}

import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320, padding: 40 }}>
          <div style={{ background: '#fff', border: '1.5px solid #FECACA', borderRadius: 16, padding: '32px 36px', maxWidth: 480, textAlign: 'center', boxShadow: '0 4px 24px rgba(220,38,38,.08)' }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: '#FEF2F2', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
              <i className="fa fa-exclamation-triangle" style={{ color: '#DC2626', fontSize: 22 }} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#0A1530', marginBottom: 8 }}>Ha ocurrido un error inesperado</div>
            <div style={{ fontSize: 12.5, color: '#64748B', marginBottom: 20, lineHeight: 1.6 }}>
              {this.state.error.message ?? 'Error desconocido. Por favor recargue la página.'}
            </div>
            <button
              style={{ background: '#0A2D63', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 24px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--f-sans)' }}
              onClick={() => this.setState({ error: null })}>
              <i className="fa fa-redo" style={{ marginRight: 6 }} />
              Reintentar
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

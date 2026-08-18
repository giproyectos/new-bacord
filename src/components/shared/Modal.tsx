import { useEffect } from 'react'
import { X } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  sub?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  footer?: React.ReactNode
}

const widths = { sm: '420px', md: '560px', lg: '760px' }

export function Modal({ open, onClose, title, sub, children, size = 'md', footer }: Props) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <style>{`
        .modal-overlay {
          position: fixed; inset: 0; z-index: 100;
          display: flex; align-items: center; justify-content: center; padding: 20px;
        }
        .modal-backdrop {
          position: absolute; inset: 0; background: rgba(10,21,48,0.45);
          backdrop-filter: blur(2px);
        }
        .modal-card {
          position: relative; z-index: 1;
          background: var(--white); border-radius: var(--r-xl);
          box-shadow: var(--sh-3); width: 100%;
          max-height: 90vh; display: flex; flex-direction: column;
          border: 1px solid var(--hair);
        }
        .modal-head {
          display: flex; align-items: flex-start; justify-content: space-between;
          padding: 22px 26px 18px; border-bottom: 1px solid var(--hair);
          flex-shrink: 0;
        }
        .modal-title { font-size: 16px; font-weight: 700; color: var(--ink); }
        .modal-sub { font-size: 12.5px; color: var(--ink-3); margin-top: 3px; }
        .modal-close {
          width: 28px; height: 28px; display: grid; place-items: center;
          border-radius: var(--r-sm); background: var(--paper);
          border: 1px solid var(--hair); color: var(--ink-4); cursor: pointer;
          flex-shrink: 0; transition: background 100ms;
        }
        .modal-close:hover { background: var(--paper-2); color: var(--ink-2); }
        .modal-close svg { width: 14px; height: 14px; }
        .modal-body { overflow-y: auto; padding: 22px 26px; flex: 1; }
        .modal-body::-webkit-scrollbar { width: 4px; }
        .modal-body::-webkit-scrollbar-thumb { background: var(--hair-2); border-radius: 2px; }
        .modal-footer {
          padding: 16px 26px; border-top: 1px solid var(--hair);
          display: flex; justify-content: flex-end; gap: 8px;
          flex-shrink: 0;
        }
      `}</style>
      <div className="modal-overlay">
        <div className="modal-backdrop" onClick={onClose} />
        <div className="modal-card" style={{ maxWidth: widths[size] }}>
          <div className="modal-head">
            <div>
              <div className="modal-title">{title}</div>
              {sub && <div className="modal-sub">{sub}</div>}
            </div>
            <button className="modal-close" onClick={onClose}><X /></button>
          </div>
          <div className="modal-body">{children}</div>
          {footer && <div className="modal-footer">{footer}</div>}
        </div>
      </div>
    </>
  )
}

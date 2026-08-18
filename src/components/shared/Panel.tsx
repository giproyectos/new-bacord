import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface PanelProps {
  title: React.ReactNode
  children: React.ReactNode
  collapsible?: boolean
  defaultOpen?: boolean
}

export function Panel({ title, children, collapsible = false, defaultOpen = true }: PanelProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div style={{
      background: '#fff',
      borderRadius: 'var(--r-md)',
      border: '1.5px solid var(--hair-2)',
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      marginBottom: 18,
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '11px 18px',
        background: '#FAFBFC',
        borderBottom: open ? '1.5px solid var(--hair-2)' : 'none',
        borderLeft: '3px solid var(--navy)',
      }}>
        <span style={{
          fontSize: 13.5, fontWeight: 700, color: 'var(--ink)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {title}
        </span>
        {collapsible && (
          <button
            onClick={() => setOpen(o => !o)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--ink-4)', padding: '3px 5px', borderRadius: 6,
              display: 'flex', alignItems: 'center', transition: 'background 80ms',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--hair-2)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none' }}
          >
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        )}
      </div>
      {open && <div style={{ padding: 18 }}>{children}</div>}
    </div>
  )
}

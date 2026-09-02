import { useEffect, useRef, useState } from 'react'
import { Search, ChevronDown, X } from 'lucide-react'

export interface SearchableOption {
  value: number | string
  label: string
  sublabel?: string
}

interface SearchableSelectProps {
  options: SearchableOption[]
  value: number | string | null | undefined
  onChange: (value: number | string | null) => void
  placeholder?: string
  emptyOptionLabel?: string
  disabled?: boolean
}

export function SearchableSelect({ options, value, onChange, placeholder = 'Buscar…', emptyOptionLabel = 'Sin selección', disabled }: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const selected = options.find(o => String(o.value) === String(value))
  const q = query.trim().toLowerCase()
  const filtered = q
    ? options.filter(o => o.label.toLowerCase().includes(q) || o.sublabel?.toLowerCase().includes(q))
    : options

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setOpen(o => !o); setQuery('') }}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
          padding: '9px 10px', border: '1.5px solid var(--hair-2)', borderRadius: 'var(--r-sm)',
          background: disabled ? 'var(--paper-2)' : '#fff', cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: 13.5, fontFamily: 'var(--f-sans)', color: selected ? 'var(--ink)' : 'var(--ink-4)',
        }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.label : emptyOptionLabel}
        </span>
        {selected && !disabled && (
          <X size={13} style={{ color: 'var(--ink-4)' }} onClick={e => { e.stopPropagation(); onChange(null) }} />
        )}
        <ChevronDown size={14} style={{ color: 'var(--ink-4)' }} />
      </button>

      {open && !disabled && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
          background: '#fff', border: '1.5px solid var(--hair-2)', borderRadius: 'var(--r-sm)',
          boxShadow: 'var(--sh-3, 0 8px 24px rgba(0,0,0,.14))', maxHeight: 280, display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ position: 'relative', padding: 8, borderBottom: '1.5px solid var(--hair-2)' }}>
            <Search size={13} style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-4)' }} />
            <input
              autoFocus
              style={{ width: '100%', padding: '7px 8px 7px 28px', border: '1px solid var(--hair-2)', borderRadius: 6, fontSize: 13, outline: 'none' }}
              placeholder={placeholder}
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <div style={{ overflowY: 'auto' }}>
            <div
              onClick={() => { onChange(null); setOpen(false) }}
              style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: 'var(--ink-4)', fontStyle: 'italic' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--paper-2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {emptyOptionLabel}
            </div>
            {filtered.length === 0 && (
              <div style={{ padding: '10px 12px', fontSize: 12.5, color: 'var(--ink-4)' }}>Sin resultados</div>
            )}
            {filtered.map(o => (
              <div
                key={o.value}
                onClick={() => { onChange(o.value); setOpen(false) }}
                style={{
                  padding: '8px 12px', cursor: 'pointer', fontSize: 13,
                  background: String(o.value) === String(value) ? 'rgba(10,45,99,.06)' : 'transparent',
                  color: String(o.value) === String(value) ? 'var(--navy)' : 'var(--ink)',
                  fontWeight: String(o.value) === String(value) ? 600 : 400,
                }}
                onMouseEnter={e => { if (String(o.value) !== String(value)) e.currentTarget.style.background = 'var(--paper-2)' }}
                onMouseLeave={e => { if (String(o.value) !== String(value)) e.currentTarget.style.background = 'transparent' }}
              >
                <div>{o.label}</div>
                {o.sublabel && <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 1 }}>{o.sublabel}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

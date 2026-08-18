const CONFIG: Record<string, { bg: string; color: string; dot: string }> = {
  'Activo':           { bg: 'rgba(45,93,74,0.10)',  color: '#1f4231', dot: '#2D5D4A' },
  'Inactivo':         { bg: 'rgba(90,100,120,0.10)', color: '#3a4055', dot: '#8A8F9F' },
  'Aprobado':         { bg: 'rgba(10,45,99,0.10)',  color: '#07173a', dot: '#0A2D63' },
  'Revisión':         { bg: 'rgba(247,201,46,0.15)', color: '#7a5a00', dot: '#F7C92E' },
  'Creación':         { bg: 'rgba(90,42,68,0.10)',  color: '#3a1028', dot: '#5A2A44' },
  'Rechazado':        { bg: 'rgba(230,78,24,0.10)', color: '#8a2600', dot: '#E64E18' },
  'En Tratamiento':   { bg: 'rgba(255,107,53,0.10)', color: '#7a2e00', dot: '#FF6B35' },
  'Finalizado':       { bg: 'rgba(45,93,74,0.10)',  color: '#1f4231', dot: '#2D5D4A' },
  'Cancelado':        { bg: 'rgba(230,78,24,0.10)', color: '#8a2600', dot: '#E64E18' },
}

export function StatusBadge({ estado }: { estado: string }) {
  const cfg = CONFIG[estado] ?? { bg: 'rgba(90,100,120,0.10)', color: '#3a4055', dot: '#8A8F9F' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 100,
      background: cfg.bg, color: cfg.color,
      fontSize: 11.5, fontWeight: 600, fontFamily: 'var(--f-mono)',
      letterSpacing: '0.04em', whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
      {estado}
    </span>
  )
}

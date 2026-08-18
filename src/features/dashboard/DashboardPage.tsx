import {
  Chart as ChartJS,
  ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  Filler, Title,
} from 'chart.js'
import { Doughnut, Bar } from 'react-chartjs-2'
import { mockBatchRecords, mockOrdenes, mockUsuarios, mockDesviaciones } from '@/api/mock'

ChartJS.register(
  ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  Filler, Title,
)

const C = {
  navy:   '#0A2D63',
  blue:   '#1D4ED8',
  teal:   '#0891B2',
  forest: '#059669',
  orange: '#EA580C',
  red:    '#DC2626',
  amber:  '#D97706',
  purple: '#7C3AED',
  slate:  '#475569', // raised from #64748B for 4.5:1 contrast compliance
}

const fontFamily  = "'Geist', 'Inter', sans-serif"
const lexend      = "'Lexend', 'Geist', sans-serif"
const tooltipDefaults = {
  backgroundColor: '#0F172A',
  titleFont: { family: fontFamily, weight: 'bold' as const, size: 12 },
  bodyFont:  { family: fontFamily, size: 12 },
  padding: 12, cornerRadius: 10, displayColors: true, boxPadding: 4,
}

function relTime(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days === 0) return 'Hoy'
  if (days === 1) return 'Ayer'
  if (days < 30) return `${days}d`
  return `${Math.floor(days / 30)}m`
}

function getPendientesFirma(avance: number, brId: number, material: string) {
  const base = { br: `BR-${brId}`, material }
  if (avance === 0)  return [{ ...base, etapa: 'Etapa 1 · Dispensación',         firma: 'Operador + Supervisor', urgente: false }]
  if (avance < 40)  return [{ ...base, etapa: 'Etapa 2 · Encapsulación',         firma: 'Operador de Producción', urgente: false }]
  if (avance < 70)  return [{ ...base, etapa: 'Etapa 3 · Empaque',               firma: 'Supervisor de Calidad',  urgente: false }]
  if (avance < 100) return [{ ...base, etapa: 'Etapa 3 · Cierre de Lote',        firma: 'Director de Calidad',    urgente: avance >= 85 }]
  return []
}

function progressGrad(avance: number) {
  if (avance >= 80) return { grad: 'linear-gradient(90deg,#059669,#34D399)', border: '#059669' }
  if (avance >= 50) return { grad: 'linear-gradient(90deg,#0891B2,#22D3EE)', border: '#0891B2' }
  if (avance >= 25) return { grad: 'linear-gradient(90deg,#EA580C,#FB923C)', border: '#EA580C' }
  return { grad: 'linear-gradient(90deg,#DC2626,#F87171)', border: '#DC2626' }
}

export function DashboardPage() {
  // ── Lotes activos ─────────────────────────────────────────────────────────
  const brsActivos = mockBatchRecords
    .filter(br => br.idEstado === 1)
    .map(br => {
      const op  = mockOrdenes.find(o => o.idOrdenProceso === br.idOrdenProceso)
      const dias = Math.floor((Date.now() - new Date(br.fechaModificacion ?? br.fechaCreacion).getTime()) / 86400000)
      const av  = br.porcentajeAvance ?? 0
      return {
        id: br.idBatchRecord,
        codigo: `BR-${br.idBatchRecord}`,
        material: op?.codigoMaterial ?? '—',
        producto: op?.descripcionMaterial?.split(' ').slice(0, 5).join(' ') ?? '—',
        avance: av,
        dias,
        etapa: av < 34 ? 'Etapa 1 · Dispensación' : av < 67 ? 'Etapa 2 · Encapsulación' : 'Etapa 3 · Empaque',
        fechaCreacion: br.fechaCreacion,
      }
    })
    .sort((a, b) => b.avance - a.avance)

  const avanceProm = brsActivos.length
    ? Math.round(brsActivos.reduce((s, b) => s + b.avance, 0) / brsActivos.length)
    : 0

  // ── Pendientes de firma ───────────────────────────────────────────────────
  const pendientes = brsActivos.flatMap(br => getPendientesFirma(br.avance, br.id, br.material))
  const urgentes   = pendientes.filter(p => p.urgente).length

  // ── Alertas ───────────────────────────────────────────────────────────────
  type Alerta = { nivel: 'alta' | 'media' | 'baja'; icon: string; titulo: string; detalle: string }
  const alertas: Alerta[] = []
  brsActivos.forEach(br => {
    if (br.avance >= 85)
      alertas.push({ nivel: 'alta',  icon: 'fa-pen-nib',         titulo: `${br.codigo} · Cierre pendiente de firma`, detalle: `${br.producto} · requiere Director de Calidad` })
    if (br.dias >= 10 && br.avance < 50)
      alertas.push({ nivel: 'media', icon: 'fa-clock',           titulo: `${br.codigo} · Sin actividad hace ${br.dias} días`, detalle: `${br.producto} · ${br.etapa}` })
    if (br.avance === 0 && br.dias >= 5)
      alertas.push({ nivel: 'baja',  icon: 'fa-hourglass-start', titulo: `${br.codigo} · Proceso no iniciado`, detalle: `${br.producto} · creado hace ${br.dias} días` })
  })
  mockBatchRecords.filter(br => br.idEstado === 3).forEach(br => {
    const op = mockOrdenes.find(o => o.idOrdenProceso === br.idOrdenProceso)
    alertas.push({ nivel: 'media', icon: 'fa-ban', titulo: `BR-${br.idBatchRecord} · Lote cancelado`, detalle: `${op?.codigoMaterial ?? '—'} · ${br.motivoEstado?.slice(0, 60) || 'sin motivo'}` })
  })
  mockDesviaciones.filter(d => d.estado === 'abierta').forEach(d => {
    alertas.push({ nivel: 'alta', icon: 'fa-triangle-exclamation', titulo: `BR-${d.idBatchRecord} · Desviación abierta — ${d.detalleCode}`, detalle: `${d.labelCampo} — valor registrado: ${d.valorIngresado}` })
  })

  // ── Donut ─────────────────────────────────────────────────────────────────
  const cnt = {
    trat: mockBatchRecords.filter(b => b.idEstado === 1).length,
    fin:  mockBatchRecords.filter(b => b.idEstado === 2).length,
    can:  mockBatchRecords.filter(b => b.idEstado === 3).length,
    lib:  mockBatchRecords.filter(b => b.idEstado === 4).length,
    tot:  mockBatchRecords.length,
  }

  // ── Bar ───────────────────────────────────────────────────────────────────
  const matMap: Record<string, number> = {}
  mockBatchRecords.forEach(br => {
    const op = mockOrdenes.find(o => o.idOrdenProceso === br.idOrdenProceso)
    if (op) matMap[op.codigoMaterial] = (matMap[op.codigoMaterial] ?? 0) + 1
  })
  const matEntries = Object.entries(matMap).sort((a, b) => b[1] - a[1]).slice(0, 6)
  const barGrads   = ['#1D4ED8', '#EA580C', '#0891B2', '#059669', '#7C3AED', '#DB2777']

  // ── Actividad ─────────────────────────────────────────────────────────────
  const recent = [...mockBatchRecords]
    .sort((a, b) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime())
    .slice(0, 6)
    .map(br => {
      const op   = mockOrdenes.find(o => o.idOrdenProceso === br.idOrdenProceso)
      const user = mockUsuarios.find(u => u.idUsuario === br.idUsuarioCreacion)
      const cfg  = { 1: { label: 'En proceso', color: C.teal }, 2: { label: 'Finalizado', color: C.forest }, 3: { label: 'Cancelado', color: C.red }, 4: { label: 'Liberado', color: C.purple } } as Record<number, {label:string;color:string}>
      return { br: `BR-${br.idBatchRecord}`, mat: op?.codigoMaterial ?? '—', estado: cfg[br.idEstado]?.label ?? '?', color: cfg[br.idEstado]?.color ?? C.slate, user: user?.login ?? 'sistema', tiempo: relTime(br.fechaCreacion) }
    })

  const nivCfg  = { alta: { c: C.red, bg: '#FFF1F1', lbl: 'Alta' }, media: { c: C.amber, bg: '#FFFBEB', lbl: 'Media' }, baja: { c: C.slate, bg: '#F8FAFC', lbl: 'Baja' } }

  const today = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
  const todayCap = today.charAt(0).toUpperCase() + today.slice(1)

  return (
    <>
      <style>{`
        /* ── reset / motion ── */
        @media (prefers-reduced-motion: reduce) {
          .db-kpi, .prog-fill, .db-card { transition: none !important; animation: none !important; }
        }

        .db { display: flex; flex-direction: column; gap: 18px; }

        /* ── header ── */
        .db-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 20px; background: #fff;
          border: 1px solid #E8EDF5; border-radius: 16px;
          box-shadow: 0 1px 3px rgba(10,21,48,.05);
        }
        .db-header-title {
          font-family: ${lexend};
          font-size: 21px; font-weight: 800; color: #0A2D63; letter-spacing: -.4px;
        }
        .db-header-date  { font-size: 12px; color: #64748B; font-family: var(--f-mono); margin-top: 2px; }
        .db-header-right { display: flex; align-items: center; gap: 10px; }
        .db-status-dot {
          width: 9px; height: 9px; border-radius: 50%;
          background: #22C55E; box-shadow: 0 0 0 3px #DCFCE7;
        }
        .db-status-lbl { font-size: 12px; color: #475569; font-family: var(--f-mono); }

        /* ── KPI row ── */
        .db-kpis { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; }
        .db-kpi  {
          background: #fff; border: 1px solid #E8EDF5; border-radius: 16px;
          padding: 0; overflow: hidden;
          box-shadow: 0 1px 3px rgba(10,21,48,.06), 0 4px 12px rgba(10,21,48,.04);
          transition: box-shadow .18s, transform .18s;
          cursor: default;
        }
        .db-kpi:focus-visible {
          outline: 3px solid #1D4ED8; outline-offset: 2px;
        }
        .db-kpi:hover { box-shadow: 0 6px 20px rgba(10,21,48,.13); transform: translateY(-2px); }
        .db-kpi-accent { height: 5px; }
        .db-kpi-body   { padding: 16px 18px 15px; }
        .db-kpi-top    { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 12px; }
        .db-kpi-icon   { width: 40px; height: 40px; border-radius: 11px; display: grid; place-items: center; font-size: 16px; }
        .db-kpi-badge  { font-size: 10px; font-weight: 700; padding: 3px 9px; border-radius: 100px; letter-spacing: .03em; }
        .db-kpi-val    { font-family: ${lexend}; font-size: 32px; font-weight: 800; color: #0F172A; line-height: 1; letter-spacing: -1px; }
        .db-kpi-label  { font-size: 12px; font-weight: 600; color: #475569; margin-top: 5px; }

        /* ── cards ── */
        .db-grid2  { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .db-grid32 { display: grid; grid-template-columns: 3fr 2fr; gap: 14px; }
        .db-grid23 { display: grid; grid-template-columns: 2fr 1fr; gap: 14px; }
        .db-card {
          background: #fff; border: 1px solid #E8EDF5; border-radius: 16px;
          padding: 18px 20px; overflow: hidden;
          box-shadow: 0 1px 3px rgba(10,21,48,.06), 0 4px 12px rgba(10,21,48,.04);
        }
        .db-card-head  { display: flex; align-items: center; gap: 10px; margin-bottom: 3px; }
        .db-card-icon  { width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; font-size: 13px; flex-shrink: 0; }
        .db-card-title { font-family: ${lexend}; font-size: 13px; font-weight: 700; color: #0F172A; letter-spacing: -.01em; }
        .db-card-sub   { font-size: 11.5px; color: #64748B; margin-bottom: 16px; padding-left: 40px; }

        /* ── lotes ── */
        .lote-list  { display: flex; flex-direction: column; gap: 10px; }
        .lote-item  {
          padding: 12px 14px 12px 16px; background: #F8FAFD;
          border-radius: 12px; border: 1px solid #EEF2F9;
          border-left: 4px solid;
          transition: box-shadow .15s;
        }
        .lote-item:hover { box-shadow: 0 2px 10px rgba(10,21,48,.08); }
        .lote-top   { display: flex; align-items: center; justify-content: space-between; margin-bottom: 9px; }
        .lote-codes { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .lote-br    { font-family: ${lexend}; font-size: 13px; font-weight: 800; color: #0F172A; }
        .lote-mat   { font-size: 11px; font-weight: 600; color: #475569; background: #E8EDF5; padding: 2px 8px; border-radius: 100px; }
        .lote-etapa { font-size: 11px; color: #64748B; font-family: var(--f-mono); }
        .lote-pct   { font-family: ${lexend}; font-size: 15px; font-weight: 800; font-variant-numeric: tabular-nums; flex-shrink: 0; }
        .prog-wrap  { position: relative; height: 10px; background: #E8EDF5; border-radius: 100px; overflow: hidden; }
        .prog-fill  { height: 100%; border-radius: 100px; transition: width .5s cubic-bezier(.4,0,.2,1); }
        .lote-bot   { display: flex; justify-content: space-between; align-items: center; margin-top: 7px; }
        .lote-prod  { font-size: 11px; color: #64748B; }
        .lote-warn  { font-size: 11px; display: flex; align-items: center; gap: 4px; font-weight: 600; }

        /* ── firmas ── */
        .firma-list { display: flex; flex-direction: column; gap: 8px; }
        .firma-item { display: flex; align-items: flex-start; gap: 10px; padding: 11px 13px; border-radius: 12px; border: 1px solid transparent; }
        .firma-dot  { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; font-size: 14px; flex-shrink: 0; }
        .firma-etapa { font-size: 12px; font-weight: 700; color: #1E293B; line-height: 1.4; }
        .firma-quien { font-size: 11px; color: #475569; margin-top: 3px; display: flex; align-items: center; gap: 4px; }
        .firma-urgente { font-size: 11px; font-weight: 700; color: #DC2626; margin-top: 4px; display: flex; align-items: center; gap: 4px; }

        /* ── alertas ── */
        .alerta-list { display: flex; flex-direction: column; gap: 8px; }
        .alerta-item { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border-radius: 12px; border-left: 4px solid; }
        .alerta-dot  { width: 32px; height: 32px; border-radius: 9px; display: grid; place-items: center; font-size: 13px; flex-shrink: 0; }
        .alerta-head { display: flex; align-items: center; gap: 7px; margin-bottom: 3px; flex-wrap: wrap; }
        .alerta-tit  { font-size: 12.5px; font-weight: 700; color: #1E293B; }
        .alerta-tag  { font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 100px; letter-spacing: .05em; text-transform: uppercase; }
        .alerta-det  { font-size: 11.5px; color: #475569; line-height: 1.45; }

        /* ── donut ── */
        .donut-wrap   { position: relative; max-width: 190px; margin: 0 auto; }
        .donut-center {
          position: absolute; top: 50%; left: 50%;
          transform: translate(-50%, -55%);
          text-align: center; pointer-events: none;
        }
        .donut-val    { font-family: ${lexend}; font-size: 24px; font-weight: 800; color: #0F172A; line-height: 1; }
        .donut-lbl    { font-size: 10px; color: #64748B; letter-spacing: .08em; text-transform: uppercase; font-family: var(--f-mono); margin-top: 2px; }
        .donut-pills  { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 14px; }
        .donut-pill   { display: flex; align-items: center; gap: 7px; padding: 8px 10px; background: #F8FAFD; border-radius: 10px; }
        .donut-pill-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
        .donut-pill-n   { font-family: ${lexend}; font-size: 16px; font-weight: 800; line-height: 1; }
        .donut-pill-l   { font-size: 10.5px; color: #64748B; margin-top: 1px; }

        /* ── activity ── */
        .act-list { display: flex; flex-direction: column; }
        .act-item { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-bottom: 1px solid #F1F5F9; }
        .act-item:last-child { border-bottom: none; }
        .act-dot  { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; font-size: 13px; flex-shrink: 0; }
        .act-body { flex: 1; min-width: 0; }
        .act-main { font-size: 12.5px; font-weight: 700; color: #1E293B; }
        .act-sub  { font-size: 11px; color: #475569; margin-top: 2px; }
        .act-time { font-size: 11px; font-family: var(--f-mono); color: #94A3B8; flex-shrink: 0; }

        /* ── empty ── */
        .empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 32px 0; color: #94A3B8; }
        .empty i { font-size: 26px; }
        .empty span { font-size: 13px; }

        /* ── responsive ── */
        @media (max-width: 900px) {
          .db-grid32, .db-grid23 { grid-template-columns: 1fr; }
          .db-kpis { grid-template-columns: repeat(2,1fr); }
        }
        @media (max-width: 540px) {
          .db-kpis { grid-template-columns: 1fr 1fr; gap: 10px; }
          .db-kpi-val { font-size: 26px; }
          .db-header-title { font-size: 17px; }
        }
      `}</style>

      <div className="db">

        {/* ── Header ── */}
        <div className="db-header">
          <div>
            <div className="db-header-title">Panel de Control EBR</div>
            <div className="db-header-date">{todayCap}</div>
          </div>
          <div className="db-header-right">
            <div className="db-status-dot" aria-hidden="true" />
            <span className="db-status-lbl">Sistema operativo</span>
          </div>
        </div>

        {/* ── KPIs del día ── */}
        <div className="db-kpis" role="list" aria-label="Indicadores clave del día">
          {([
            {
              label: 'Lotes en proceso',    val: brsActivos.length,
              badge: `${avanceProm}% prom`,
              badgeColor: C.teal,
              accentFrom: '#0891B2', accentTo: '#06B6D4',
              icon: 'fa-industry',   iconBg: '#E0F7FA', iconC: '#0891B2',
            },
            {
              label: 'Pendientes de firma', val: pendientes.length,
              badge: `${urgentes} urgente${urgentes !== 1 ? 's' : ''}`,
              badgeColor: urgentes > 0 ? C.red : C.slate,
              accentFrom: '#1D4ED8', accentTo: '#3B82F6',
              icon: 'fa-signature',  iconBg: '#EEF2FF', iconC: '#1D4ED8',
            },
            {
              label: 'Alertas activas',     val: alertas.length,
              badge: `${alertas.filter(a => a.nivel === 'alta').length} alta prior`,
              badgeColor: alertas.some(a => a.nivel === 'alta') ? C.red : C.amber,
              accentFrom: alertas.some(a => a.nivel === 'alta') ? '#DC2626' : '#D97706',
              accentTo:   alertas.some(a => a.nivel === 'alta') ? '#F87171' : '#FCD34D',
              icon: 'fa-exclamation-triangle',
              iconBg: alertas.some(a => a.nivel === 'alta') ? '#FEE2E2' : '#FEF3C7',
              iconC:  alertas.some(a => a.nivel === 'alta') ? C.red : C.amber,
            },
            {
              label: 'Avance promedio',     val: `${avanceProm}%`,
              badge: `${brsActivos.length} lote${brsActivos.length !== 1 ? 's' : ''} activo${brsActivos.length !== 1 ? 's' : ''}`,
              badgeColor: C.forest,
              accentFrom: '#059669', accentTo: '#34D399',
              icon: 'fa-chart-line', iconBg: '#ECFDF5', iconC: '#059669',
            },
          ] as const).map(k => (
            <div key={k.label} className="db-kpi" role="listitem" tabIndex={0} aria-label={`${k.label}: ${k.val}`}>
              <div className="db-kpi-accent" style={{ background: `linear-gradient(90deg, ${k.accentFrom}, ${k.accentTo})` }} />
              <div className="db-kpi-body">
                <div className="db-kpi-top">
                  <div className="db-kpi-icon" style={{ background: k.iconBg, color: k.iconC }} aria-hidden="true">
                    <i className={`fa ${k.icon}`} />
                  </div>
                  <div className="db-kpi-badge" style={{ background: k.badgeColor + '1A', color: k.badgeColor }}>{k.badge}</div>
                </div>
                <div className="db-kpi-val">{k.val}</div>
                <div className="db-kpi-label">{k.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Lotes en proceso + Pendientes de firma ── */}
        <div className="db-grid32">
          <div className="db-card">
            <div className="db-card-head">
              <div className="db-card-icon" style={{ background: '#E0F7FA', color: C.teal }} aria-hidden="true"><i className="fa fa-industry" /></div>
              <div className="db-card-title">Lotes en proceso</div>
            </div>
            <div className="db-card-sub">Batch Records activos · progreso por etapa</div>
            {brsActivos.length === 0 ? (
              <div className="empty"><i className="fa fa-industry" aria-hidden="true" /><span>Sin lotes en proceso</span></div>
            ) : (
              <div className="lote-list">
                {brsActivos.map(br => {
                  const { grad, border } = progressGrad(br.avance)
                  return (
                    <div key={br.id} className="lote-item" style={{ borderLeftColor: border }}>
                      <div className="lote-top">
                        <div className="lote-codes">
                          <span className="lote-br">{br.codigo}</span>
                          <span className="lote-mat">{br.material}</span>
                          <span className="lote-etapa">{br.etapa}</span>
                        </div>
                        <span className="lote-pct" style={{ color: border }}>{br.avance}%</span>
                      </div>
                      <div className="prog-wrap" role="progressbar" aria-valuenow={br.avance} aria-valuemin={0} aria-valuemax={100} aria-label={`Avance ${br.codigo}: ${br.avance}%`}>
                        <div className="prog-fill" style={{ width: `${br.avance}%`, background: grad }} />
                      </div>
                      <div className="lote-bot">
                        <span className="lote-prod">{br.producto}</span>
                        {br.dias >= 7 && (
                          <span className="lote-warn" style={{ color: C.amber }}>
                            <i className="fa fa-clock" aria-hidden="true" /> {br.dias}d sin actividad
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="db-card">
            <div className="db-card-head">
              <div className="db-card-icon" style={{ background: '#EEF2FF', color: C.blue }} aria-hidden="true"><i className="fa fa-signature" /></div>
              <div className="db-card-title">Pendientes de firma</div>
            </div>
            <div className="db-card-sub">Etapas esperando aprobación</div>
            {pendientes.length === 0 ? (
              <div className="empty">
                <i className="fa fa-check-circle" style={{ color: C.forest }} aria-hidden="true" />
                <span>Sin pendientes</span>
              </div>
            ) : (
              <div className="firma-list">
                {pendientes.map((p, i) => (
                  <div
                    key={i}
                    className="firma-item"
                    style={{ background: p.urgente ? '#FFF1F1' : '#F8FAFD', borderColor: p.urgente ? '#FECACA' : '#EEF2F9' }}
                  >
                    <div className="firma-dot" style={{ background: p.urgente ? '#FEE2E2' : '#EEF2FF', color: p.urgente ? C.red : C.blue }} aria-hidden="true">
                      <i className={`fa ${p.urgente ? 'fa-exclamation' : 'fa-pen-nib'}`} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#1E293B', fontFamily: 'var(--f-mono)' }}>{p.br}</span>
                        <span style={{ fontSize: 10, color: '#94A3B8' }}>·</span>
                        <span style={{ fontSize: 11, color: '#475569' }}>{p.material}</span>
                      </div>
                      <div className="firma-etapa">{p.etapa}</div>
                      <div className="firma-quien">
                        <i className="fa fa-user" style={{ fontSize: 9 }} aria-hidden="true" />
                        {p.firma}
                      </div>
                      {p.urgente && (
                        <div className="firma-urgente">
                          <i className="fa fa-triangle-exclamation" aria-hidden="true" /> Atención inmediata
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Alertas + Donut ── */}
        <div className="db-grid23">
          <div className="db-card">
            <div className="db-card-head">
              <div className="db-card-icon" style={{ background: '#FEE2E2', color: C.red }} aria-hidden="true"><i className="fa fa-bell" /></div>
              <div className="db-card-title">Alertas activas</div>
            </div>
            <div className="db-card-sub">
              {alertas.length} alerta{alertas.length !== 1 ? 's' : ''} · {alertas.filter(a => a.nivel === 'alta').length} de alta prioridad
            </div>
            {alertas.length === 0 ? (
              <div className="empty">
                <i className="fa fa-shield-alt" style={{ color: C.forest }} aria-hidden="true" />
                <span>Sin alertas — todo en orden</span>
              </div>
            ) : (
              <div className="alerta-list" role="list" aria-label="Alertas activas">
                {alertas.map((a, i) => {
                  const nc = nivCfg[a.nivel]
                  return (
                    <div key={i} className="alerta-item" role="listitem" style={{ background: nc.bg, borderLeftColor: nc.c }}>
                      <div className="alerta-dot" style={{ background: nc.c + '1A', color: nc.c }} aria-hidden="true">
                        <i className={`fa ${a.icon}`} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="alerta-head">
                          <span className="alerta-tit">{a.titulo}</span>
                          <span className="alerta-tag" style={{ background: nc.c + '20', color: nc.c }}>{nc.lbl}</span>
                        </div>
                        <div className="alerta-det">{a.detalle}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="db-card">
            <div className="db-card-head">
              <div className="db-card-icon" style={{ background: '#F5F3FF', color: C.purple }} aria-hidden="true"><i className="fa fa-circle-half-stroke" /></div>
              <div className="db-card-title">Estado de Batch Records</div>
            </div>
            <div className="db-card-sub">{cnt.tot} lotes en total</div>
            <div
              className="donut-wrap"
              role="img"
              aria-label={`Distribución: ${cnt.trat} en proceso, ${cnt.fin} finalizados, ${cnt.lib} liberados, ${cnt.can} cancelados`}
            >
              <Doughnut
                data={{
                  labels: ['En Proceso', 'Finalizado', 'Liberado', 'Cancelado'],
                  datasets: [{
                    data: [cnt.trat, cnt.fin, cnt.lib, cnt.can],
                    backgroundColor: [C.teal, C.forest, C.purple, C.red],
                    borderColor: '#fff', borderWidth: 3, hoverOffset: 8,
                  }],
                }}
                options={{ cutout: '70%', plugins: { legend: { display: false }, tooltip: { ...tooltipDefaults } } }}
              />
              <div className="donut-center">
                <div className="donut-val">{cnt.tot}</div>
                <div className="donut-lbl">Total</div>
              </div>
            </div>
            <div className="donut-pills">
              {([
                { lbl: 'En Proceso', val: cnt.trat, color: C.teal },
                { lbl: 'Finalizado', val: cnt.fin,  color: C.forest },
                { lbl: 'Liberado',   val: cnt.lib,  color: C.purple },
                { lbl: 'Cancelado',  val: cnt.can,  color: C.red },
              ] as const).map(({ lbl, val, color }) => (
                <div key={lbl} className="donut-pill">
                  <div className="donut-pill-dot" style={{ background: color }} aria-hidden="true" />
                  <div>
                    <div className="donut-pill-n" style={{ color }}>{val}</div>
                    <div className="donut-pill-l">{lbl}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Bar + Actividad ── */}
        <div className="db-grid23">
          <div className="db-card">
            <div className="db-card-head">
              <div className="db-card-icon" style={{ background: '#EEF2FF', color: C.blue }} aria-hidden="true"><i className="fa fa-chart-bar" /></div>
              <div className="db-card-title">Batch Records por material</div>
            </div>
            <div className="db-card-sub">Acumulado · todos los estados</div>
            <div role="img" aria-label="Gráfico de barras: cantidad de batch records por material">
              <Bar
                data={{
                  labels: matEntries.map(([k]) => k),
                  datasets: [{
                    label: 'Batch Records',
                    data: matEntries.map(([, v]) => v),
                    backgroundColor: barGrads.slice(0, matEntries.length),
                    borderRadius: 8, borderSkipped: false,
                  }],
                }}
                options={{
                  responsive: true,
                  plugins: { legend: { display: false }, tooltip: { ...tooltipDefaults } },
                  scales: {
                    x: { grid: { display: false }, ticks: { font: { family: fontFamily, size: 11 }, color: '#64748B' } },
                    y: { beginAtZero: true, grid: { color: '#F1F5F9' }, ticks: { font: { family: fontFamily, size: 11 }, color: '#94A3B8', stepSize: 1 } },
                  },
                }}
              />
            </div>
          </div>

          <div className="db-card">
            <div className="db-card-head">
              <div className="db-card-icon" style={{ background: '#F0FDF4', color: C.forest }} aria-hidden="true"><i className="fa fa-clock-rotate-left" /></div>
              <div className="db-card-title">Actividad reciente</div>
            </div>
            <div className="db-card-sub">Últimas acciones registradas</div>
            <div className="act-list" role="list" aria-label="Actividad reciente">
              {recent.map((a, i) => (
                <div key={i} className="act-item" role="listitem">
                  <div className="act-dot" style={{ background: a.color + '18', color: a.color }} aria-hidden="true">
                    <i className="fa fa-clipboard-list" />
                  </div>
                  <div className="act-body">
                    <div className="act-main">{a.br} · {a.mat}</div>
                    <div className="act-sub">{a.estado} · {a.user}</div>
                  </div>
                  <div className="act-time" aria-label={`Hace ${a.tiempo}`}>{a.tiempo}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </>
  )
}

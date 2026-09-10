import { useState, useMemo, useRef, useEffect } from 'react'
import { auditoriaApi } from '@/api/auditoria'
import type { AuditEntry, AuditAccion } from '@/types/audit'

// ── Config ────────────────────────────────────────────────────────────────
const ACCION_CFG: Record<AuditAccion, { label: string; bg: string; color: string; dot: string }> = {
  CREAR:          { label: 'Creación',       bg: '#D1FAE5', color: '#065F46', dot: '#10B981' },
  MODIFICAR:      { label: 'Modificación',   bg: '#DBEAFE', color: '#1D4ED8', dot: '#3B82F6' },
  CANCELAR:       { label: 'Cancelación',    bg: '#FEE2E2', color: '#991B1B', dot: '#EF4444' },
  FIRMAR_SECCION: { label: 'Firma Sección',  bg: '#EDE9FE', color: '#5B21B6', dot: '#7C3AED' },
  FIRMAR_CIERRE:  { label: 'Firma Cierre',   bg: '#EDE9FE', color: '#5B21B6', dot: '#7C3AED' },
  DEROGAR_FIRMA:  { label: 'Derogación',     bg: '#FEF3C7', color: '#92400E', dot: '#D97706' },
  LIBERAR_LOTE:   { label: 'Liberación',     bg: '#F0FDF4', color: '#065F46', dot: '#059669' },
  REGISTRAR_DESVIACION: { label: 'Desviación registrada', bg: '#FEF3C7', color: '#92400E', dot: '#D97706' },
  CERRAR_DESVIACION:    { label: 'Desviación cerrada',    bg: '#F0FDF4', color: '#065F46', dot: '#059669' },
  LOGIN:          { label: 'Acceso',         bg: '#F1F5F9', color: '#334155', dot: '#64748B' },
  LOGIN_FALLIDO:  { label: 'Acceso fallido', bg: '#FEE2E2', color: '#991B1B', dot: '#EF4444' },
  LOGOUT:         { label: 'Cierre sesión',  bg: '#F1F5F9', color: '#334155', dot: '#64748B' },
}

function fmtTs(ts: string) {
  const d = new Date(ts)
  const fecha = d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const hora  = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const dateStr = d.toISOString().split('T')[0]
  return { fecha, hora, dateStr }
}

function AccionBadge({ accion }: { accion: AuditAccion }) {
  const cfg = ACCION_CFG[accion]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 9px', borderRadius: 20,
      fontSize: 11, fontWeight: 700,
      background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} aria-hidden="true" />
      {cfg.label}
    </span>
  )
}

// ── Export CSV ────────────────────────────────────────────────────────────
// El detalle de cambios va en el propio archivo (no solo un conteo) para que el CSV sirva
// como evidencia autosuficiente — sin tener que volver a abrir cada evento en la pantalla.
function formatCambios(cambios: AuditEntry['cambios']): string {
  if (!cambios || cambios.length === 0) return ''
  return cambios
    .map(c => `${c.etiqueta}: "${c.valorAnterior || 'vacío'}" → "${c.valorNuevo || 'vacío'}"`)
    .join(' | ')
}

function exportCsv(entries: AuditEntry[]) {
  const headers = ['Fecha', 'Hora', 'Usuario', 'Nombre', 'Cargo', 'Acción', 'Entidad', 'ID', 'Descripción', 'Módulo', 'Motivo', 'N° Cambios', 'Detalle de Cambios']
  const rows = entries.map(e => {
    const { fecha, hora } = fmtTs(e.timestamp)
    return [
      fecha, hora,
      e.loginUsuario, e.nombreUsuario, e.cargo,
      ACCION_CFG[e.accion]?.label ?? e.accion,
      e.entidad, String(e.idEntidad), e.descripcionEntidad,
      e.modulo,
      e.motivo ?? '',
      String(e.cambios?.length ?? 0),
      formatCambios(e.cambios),
    ].map(v => `"${v.replace(/"/g, '""')}"`)
  })
  const csv = [headers, ...rows].map(r => r.join(',')).join('\r\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = `auditoria_${new Date().toISOString().split('T')[0]}.csv`
  a.click(); URL.revokeObjectURL(url)
}

// ── Detail modal ──────────────────────────────────────────────────────────
function DetalleModal({ entry, onClose }: { entry: AuditEntry; onClose: () => void }) {
  const { fecha, hora } = fmtTs(entry.timestamp)

  return (
    <div
      role="dialog" aria-modal="true" aria-labelledby="audit-modal-title"
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(10,21,48,.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--paper)', borderRadius: 14, boxShadow: 'var(--sh-3)',
          width: '100%', maxWidth: 680, maxHeight: '85vh', overflow: 'hidden',
          display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ background: 'var(--navy)', borderRadius: '14px 14px 0 0', padding: '14px 22px',
          display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(247,201,46,.15)',
            border: '1.5px solid rgba(247,201,46,.3)', display: 'grid', placeItems: 'center' }}>
            <i className="fa fa-history" style={{ color: 'var(--yellow)', fontSize: 13 }} aria-hidden="true" />
          </div>
          <div id="audit-modal-title" style={{ flex: 1, color: '#fff', fontWeight: 700, fontSize: 14 }}>
            Detalle del evento de auditoría
          </div>
          <button
            style={{ background: 'rgba(255,255,255,.1)', border: 'none', cursor: 'pointer',
              color: '#fff', width: 30, height: 30, borderRadius: 8, fontSize: 18, display: 'grid', placeItems: 'center' }}
            onClick={onClose} aria-label="Cerrar"
          >×</button>
        </div>

        {/* Meta strip */}
        <div style={{ padding: '14px 22px', background: 'var(--paper-2)',
          borderBottom: '1px solid var(--hair)', flexShrink: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 14 }}>
            {[
              { lbl: 'Fecha / Hora',  val: `${fecha} ${hora}` },
              { lbl: 'Usuario',       val: entry.loginUsuario },
              { lbl: 'Nombre',        val: entry.nombreUsuario },
              { lbl: 'Cargo',         val: entry.cargo },
              { lbl: 'Módulo',        val: entry.modulo },
              { lbl: 'Entidad',       val: `${entry.entidad} #${entry.idEntidad}` },
              { lbl: 'Descripción',   val: entry.descripcionEntidad },
            ].map(({ lbl, val }) => (
              <div key={lbl}>
                <div style={{ fontSize: 10.5, color: 'var(--ink-4)', textTransform: 'uppercase',
                  letterSpacing: '.06em', marginBottom: 3, fontWeight: 600 }}>{lbl}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', wordBreak: 'break-word' }}>{val}</div>
              </div>
            ))}
            <div>
              <div style={{ fontSize: 10.5, color: 'var(--ink-4)', textTransform: 'uppercase',
                letterSpacing: '.06em', marginBottom: 3, fontWeight: 600 }}>Acción</div>
              <AccionBadge accion={entry.accion} />
            </div>
          </div>
        </div>

        {/* Motivo */}
        {entry.motivo && (
          <div style={{ padding: '10px 22px', background: '#FFFBEB', borderBottom: '1px solid #FDE68A',
            display: 'flex', gap: 10, alignItems: 'flex-start', flexShrink: 0 }}>
            <i className="fa fa-comment-alt" style={{ color: '#D97706', marginTop: 3, flexShrink: 0 }} aria-hidden="true" />
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: '#92400E', textTransform: 'uppercase',
                letterSpacing: '.05em', marginBottom: 2 }}>Motivo / Justificación</div>
              <div style={{ fontSize: 13, color: '#78350F', lineHeight: 1.5 }}>{entry.motivo}</div>
            </div>
          </div>
        )}

        {/* Changes table */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {entry.cambios && entry.cambios.length > 0 ? (
            <div style={{ padding: '16px 22px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase',
                letterSpacing: '.08em', marginBottom: 12 }}>
                Campos modificados ({entry.cambios.length})
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--paper-2)' }}>
                    {['Campo', 'Valor anterior', 'Valor nuevo'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11,
                        fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase',
                        letterSpacing: '.06em', borderBottom: '2px solid var(--hair-2)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entry.cambios.map((c, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--hair)',
                      background: i % 2 === 0 ? 'transparent' : 'var(--paper-2)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--ink-2)' }}>{c.etiqueta}</td>
                      <td style={{ padding: '8px 12px', color: '#DC2626', fontSize: 12, whiteSpace: 'pre-line', verticalAlign: 'top' }}>
                        {c.valorAnterior || <span style={{ color: 'var(--ink-4)', fontStyle: 'italic' }}>vacío</span>}
                      </td>
                      <td style={{ padding: '8px 12px', color: '#059669', fontSize: 12, whiteSpace: 'pre-line', verticalAlign: 'top' }}>
                        {c.valorNuevo || <span style={{ color: 'var(--ink-4)', fontStyle: 'italic' }}>vacío</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '32px 22px', textAlign: 'center' }}>
              <i className="fa fa-check-circle" style={{ fontSize: 28, color: 'var(--hair-strong)', display: 'block', marginBottom: 10 }} aria-hidden="true" />
              <div style={{ fontSize: 13, color: 'var(--ink-4)' }}>Sin cambios de campo para este evento.</div>
            </div>
          )}
        </div>

        <div style={{ padding: '12px 22px', borderTop: '1px solid var(--hair)',
          display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
          <button className="btn btn-gray" onClick={onClose}>
            <i className="fa fa-times" aria-hidden="true" /> Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── LogTable ──────────────────────────────────────────────────────────────
const DATA_ACCIONES:  AuditAccion[] = ['CREAR', 'MODIFICAR', 'CANCELAR', 'FIRMAR_SECCION', 'FIRMAR_CIERRE', 'DEROGAR_FIRMA', 'LIBERAR_LOTE', 'REGISTRAR_DESVIACION', 'CERRAR_DESVIACION']
const SESION_ACCIONES: AuditAccion[] = ['LOGIN', 'LOGIN_FALLIDO', 'LOGOUT']

const PAGE = 25

function LogTable({ acciones, emptyMsg }: { acciones: AuditAccion[]; emptyMsg: string }) {
  const [allEntries, setAllEntries] = useState<AuditEntry[]>([])
  const searchRef   = useRef<HTMLInputElement>(null)

  useEffect(() => {
    auditoriaApi.consultar().then(setAllEntries).catch(() => setAllEntries([]))
  }, [])

  const [q, setQ]               = useState('')
  const [accionF, setAccionF]   = useState('')
  const [usuarioF, setUsuarioF] = useState('')
  const [entidadF, setEntidadF] = useState('')
  const [fechaIni, setFechaIni] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [page, setPage]         = useState(1)
  const [selected, setSelected] = useState<AuditEntry | null>(null)

  const base = useMemo(
    () => allEntries.filter(e => acciones.includes(e.accion)),
    [allEntries, acciones]
  )
  const usuarios  = useMemo(() => [...new Set(base.map(e => e.loginUsuario))].sort(), [base])
  const entidades = useMemo(() => [...new Set(base.map(e => e.entidad))].sort(), [base])

  const hasFilters = !!(q || accionF || usuarioF || entidadF || fechaIni || fechaFin)

  const filtered = useMemo(() => {
    const qLow = q.toLowerCase()
    return base.filter(e => {
      if (accionF  && e.accion      !== accionF)  return false
      if (usuarioF && e.loginUsuario !== usuarioF) return false
      if (entidadF && e.entidad      !== entidadF) return false
      const { dateStr } = fmtTs(e.timestamp)
      if (fechaIni && dateStr < fechaIni) return false
      if (fechaFin && dateStr > fechaFin) return false
      if (qLow && ![e.loginUsuario, e.nombreUsuario, e.descripcionEntidad, e.modulo, e.motivo ?? '', String(e.idEntidad)].join(' ').toLowerCase().includes(qLow)) return false
      return true
    })
  }, [base, q, accionF, usuarioF, entidadF, fechaIni, fechaFin])

  const pages     = Math.max(1, Math.ceil(filtered.length / PAGE))
  const safePage  = Math.min(page, pages)
  const pageSlice = filtered.slice((safePage - 1) * PAGE, safePage * PAGE)
  const from      = filtered.length === 0 ? 0 : (safePage - 1) * PAGE + 1
  const to        = Math.min(safePage * PAGE, filtered.length)

  function resetFilters() {
    setQ(''); setAccionF(''); setUsuarioF(''); setEntidadF(''); setFechaIni(''); setFechaFin('')
    setPage(1)
    searchRef.current?.focus()
  }

  // Summary counts
  const summary = useMemo(() => {
    const counts: Partial<Record<AuditAccion, number>> = {}
    for (const e of base) counts[e.accion] = (counts[e.accion] ?? 0) + 1
    return counts
  }, [base])

  const thSt: React.CSSProperties = {
    padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700,
    color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.07em',
    borderBottom: '2px solid var(--hair-2)', background: '#F8FAFC', whiteSpace: 'nowrap',
  }
  const tdSt: React.CSSProperties = { padding: '9px 12px', verticalAlign: 'middle', borderBottom: '1px solid var(--hair)' }

  return (
    <>
      <style>{`
        /* ── Audit log styles ── */
        .al-page { display: flex; flex-direction: column; gap: 14px; }

        /* Summary strip */
        .al-summary { display: flex; gap: 8px; flex-wrap: wrap; }
        .al-stat {
          display: flex; align-items: center; gap: 7px;
          padding: 7px 13px; border-radius: 10px; border: 1px solid;
          font-size: 12px; font-weight: 700; cursor: pointer;
          transition: opacity .15s; background: #fff;
        }
        .al-stat:hover { opacity: .8; }
        .al-stat-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .al-stat-n { font-size: 16px; font-weight: 800; font-family: var(--f-mono); line-height: 1; }

        /* Filter bar */
        .al-filters {
          background: #fff; border: 1.5px solid var(--hair-2);
          border-radius: var(--r-md); padding: 14px 16px;
        }
        .al-filter-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end; }
        .al-filter-group { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 140px; }
        .al-filter-group label { font-size: 11.5px; font-weight: 600; color: var(--ink-3); }
        .al-search-wrap { position: relative; flex: 2; min-width: 220px; }
        .al-search-wrap .ico { position: absolute; left: 11px; top: 50%; transform: translateY(-50%);
          color: var(--ink-4); font-size: 12px; pointer-events: none; }
        .al-search {
          width: 100%; height: 36px; padding: 0 12px 0 32px;
          border: 1.5px solid var(--hair-2); border-radius: var(--r-sm);
          font-size: 13px; font-family: var(--f-sans); outline: none;
          background: var(--paper); color: var(--ink); transition: border-color 120ms;
        }
        .al-search:focus { border-color: var(--navy); background: #fff; }
        .al-sel {
          height: 36px; padding: 0 10px; border: 1.5px solid var(--hair-2);
          border-radius: var(--r-sm); font-size: 12.5px; font-family: var(--f-sans);
          outline: none; background: var(--paper); color: var(--ink);
          cursor: pointer; transition: border-color 120ms; width: 100%;
        }
        .al-sel:focus { border-color: var(--navy); background: #fff; }
        .al-date {
          height: 36px; padding: 0 10px; border: 1.5px solid var(--hair-2);
          border-radius: var(--r-sm); font-size: 12.5px; font-family: var(--f-sans);
          outline: none; background: var(--paper); color: var(--ink);
          cursor: pointer; transition: border-color 120ms; width: 100%;
        }
        .al-date:focus { border-color: var(--navy); background: #fff; }

        /* Table card */
        .al-card {
          background: #fff; border: 1.5px solid var(--hair-2);
          border-radius: var(--r-md); overflow: hidden;
          box-shadow: 0 1px 4px rgba(0,0,0,.04);
        }
        .al-card-head {
          display: flex; align-items: center; gap: 10px;
          padding: 11px 16px; background: #FAFBFC;
          border-bottom: 1.5px solid var(--hair-2);
          border-left: 3px solid var(--navy);
        }
        .al-card-title { font-size: 13.5px; font-weight: 700; color: var(--ink); flex: 1; }

        /* Table rows */
        .al-row { transition: background 80ms; cursor: pointer; }
        .al-row:hover { background: #F8FAFC !important; }
        .al-row:focus-visible { outline: 2px solid var(--navy); outline-offset: -2px; }

        /* Pagination */
        .al-pgns { display: flex; gap: 3px; }
        .al-pgn {
          min-width: 30px; height: 30px; padding: 0 6px; display: grid; place-items: center;
          border: 1.5px solid var(--hair-2); border-radius: var(--r-sm); background: none;
          cursor: pointer; font-size: 12.5px; font-family: var(--f-sans); color: var(--ink-3);
          transition: background 80ms;
        }
        .al-pgn:hover:not(:disabled):not(.al-pgn-ell) { background: var(--paper-2); }
        .al-pgn:disabled { opacity: .35; cursor: not-allowed; }
        .al-pgn.cur { background: var(--navy); color: #fff; border-color: var(--navy); font-weight: 600; }
        .al-pgn.ell { border: none; cursor: default; }

        @media (prefers-reduced-motion: reduce) { .al-stat, .al-row { transition: none !important; } }
      `}</style>

      <div className="al-page">

        {/* ── Summary strip ── */}
        {base.length > 0 && (
          <div className="al-summary" role="region" aria-label="Resumen de eventos">
            {acciones
              .filter(a => (summary[a] ?? 0) > 0)
              .map(a => {
                const cfg = ACCION_CFG[a]
                const n   = summary[a] ?? 0
                const active = accionF === a
                return (
                  <button
                    key={a}
                    className="al-stat"
                    style={{ borderColor: active ? cfg.dot : 'var(--hair-2)', background: active ? cfg.bg : '#fff', color: cfg.color }}
                    aria-pressed={active}
                    onClick={() => { setAccionF(active ? '' : a); setPage(1) }}
                  >
                    <span className="al-stat-dot" style={{ background: cfg.dot }} aria-hidden="true" />
                    <div>
                      <div className="al-stat-n">{n}</div>
                      <div style={{ fontSize: 10.5, marginTop: 1 }}>{cfg.label}</div>
                    </div>
                  </button>
                )
              })}
          </div>
        )}

        {/* ── Filter bar ── */}
        <div className="al-filters" role="search" aria-label="Filtros de búsqueda">
          <div className="al-filter-row">
            <div className="al-search-wrap">
              <i className="fa fa-search ico" aria-hidden="true" />
              <input
                ref={searchRef}
                className="al-search"
                type="search"
                placeholder="Buscar usuario, descripción, BR, módulo…"
                value={q}
                onChange={e => { setQ(e.target.value); setPage(1) }}
                aria-label="Buscar en el historial"
              />
            </div>

            <div className="al-filter-group" style={{ maxWidth: 160 }}>
              <label htmlFor="f-accion">Acción</label>
              <select id="f-accion" className="al-sel" value={accionF}
                onChange={e => { setAccionF(e.target.value); setPage(1) }}>
                <option value="">Todas</option>
                {acciones.map(a => <option key={a} value={a}>{ACCION_CFG[a].label}</option>)}
              </select>
            </div>

            <div className="al-filter-group" style={{ maxWidth: 150 }}>
              <label htmlFor="f-usuario">Usuario</label>
              <select id="f-usuario" className="al-sel" value={usuarioF}
                onChange={e => { setUsuarioF(e.target.value); setPage(1) }}>
                <option value="">Todos</option>
                {usuarios.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>

            <div className="al-filter-group" style={{ maxWidth: 145 }}>
              <label htmlFor="f-entidad">Entidad</label>
              <select id="f-entidad" className="al-sel" value={entidadF}
                onChange={e => { setEntidadF(e.target.value); setPage(1) }}>
                <option value="">Todas</option>
                {entidades.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>

            <div className="al-filter-group" style={{ maxWidth: 138 }}>
              <label htmlFor="f-ini">Desde</label>
              <input id="f-ini" type="date" className="al-date" value={fechaIni}
                max={fechaFin || undefined}
                onChange={e => { setFechaIni(e.target.value); setPage(1) }} />
            </div>

            <div className="al-filter-group" style={{ maxWidth: 138 }}>
              <label htmlFor="f-fin">Hasta</label>
              <input id="f-fin" type="date" className="al-date" value={fechaFin}
                min={fechaIni || undefined}
                onChange={e => { setFechaFin(e.target.value); setPage(1) }} />
            </div>

            {hasFilters && (
              <button className="btn btn-gray" style={{ height: 36, padding: '0 12px', alignSelf: 'flex-end', flexShrink: 0 }}
                onClick={resetFilters} aria-label="Limpiar todos los filtros">
                <i className="fa fa-times" aria-hidden="true" /> Limpiar
              </button>
            )}
          </div>
        </div>

        {/* ── Table card ── */}
        <div className="al-card">
          <div className="al-card-head">
            <i className="fa fa-history" style={{ color: 'var(--navy)', fontSize: 13 }} aria-hidden="true" />
            <span className="al-card-title">
              {hasFilters
                ? <><b>{filtered.length}</b> resultado{filtered.length !== 1 ? 's' : ''} de {base.length} eventos</>
                : <><b>{base.length}</b> evento{base.length !== 1 ? 's' : ''} registrado{base.length !== 1 ? 's' : ''}</>}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              {filtered.length > 0 && (
                <button
                  className="btn btn-gray" style={{ fontSize: 12, padding: '5px 10px' }}
                  onClick={() => exportCsv(filtered)}
                  title="Exportar resultados a CSV"
                >
                  <i className="fa fa-download" aria-hidden="true" /> Exportar CSV
                </button>
              )}
            </div>
          </div>

          {/* Empty state */}
          {filtered.length === 0 && (
            <div style={{ padding: '52px 24px', textAlign: 'center' }}>
              <i className={`fa ${hasFilters ? 'fa-filter' : 'fa-history'}`}
                style={{ fontSize: 32, color: 'var(--hair-strong)', display: 'block', marginBottom: 14 }}
                aria-hidden="true" />
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 6 }}>
                {hasFilters ? 'Sin resultados para los filtros aplicados' : emptyMsg.split('.')[0]}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-4)', maxWidth: 380, margin: '0 auto', lineHeight: 1.6 }}>
                {hasFilters
                  ? 'Prueba ajustando los filtros o limpiando la búsqueda.'
                  : base.length === 0
                    ? emptyMsg
                    : 'Ajusta los filtros para ver eventos.'}
              </div>
              {hasFilters && (
                <button className="btn btn-gray" style={{ marginTop: 14 }} onClick={resetFilters}>
                  <i className="fa fa-undo" aria-hidden="true" /> Limpiar filtros
                </button>
              )}
            </div>
          )}

          {/* Table */}
          {filtered.length > 0 && (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }} role="grid">
                  <thead>
                    <tr>
                      <th style={thSt}>Fecha / Hora</th>
                      <th style={thSt}>Usuario</th>
                      <th style={thSt}>Cargo</th>
                      <th style={thSt}>Acción</th>
                      <th style={thSt}>Entidad</th>
                      <th style={thSt}>Descripción</th>
                      <th style={thSt}>Detalle</th>
                      <th style={{ ...thSt, width: 44, textAlign: 'center' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageSlice.map((e, i) => {
                      const { fecha, hora } = fmtTs(e.timestamp)
                      return (
                        <tr
                          key={e.id}
                          className="al-row"
                          style={{ background: i % 2 === 0 ? 'transparent' : 'var(--paper-2)' }}
                          tabIndex={0}
                          onClick={() => setSelected(e)}
                          onKeyDown={ev => ev.key === 'Enter' && setSelected(e)}
                          aria-label={`Ver detalle: ${ACCION_CFG[e.accion]?.label} — ${e.descripcionEntidad}`}
                        >
                          <td style={tdSt}>
                            <div style={{ fontFamily: 'var(--f-mono)', fontSize: 12, color: 'var(--ink-2)', fontWeight: 600 }}>{fecha}</div>
                            <div style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--ink-4)' }}>{hora}</div>
                          </td>
                          <td style={tdSt}>
                            <div style={{ fontWeight: 600, color: 'var(--ink)', fontFamily: 'var(--f-mono)', fontSize: 12 }}>{e.loginUsuario}</div>
                            <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{e.nombreUsuario}</div>
                          </td>
                          <td style={{ ...tdSt, fontSize: 11.5, color: 'var(--ink-3)', maxWidth: 120, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {e.cargo}
                          </td>
                          <td style={tdSt}><AccionBadge accion={e.accion} /></td>
                          <td style={{ ...tdSt }}>
                            <div style={{ fontFamily: 'var(--f-mono)', fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 600 }}>{e.entidad}</div>
                            <div style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--ink-4)' }}>#{e.idEntidad}</div>
                          </td>
                          <td style={{ ...tdSt, maxWidth: 220 }}>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink-2)' }}
                              title={e.descripcionEntidad}>
                              {e.descripcionEntidad}
                            </div>
                            {e.modulo && (
                              <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--f-mono)' }}>{e.modulo}</div>
                            )}
                          </td>
                          <td style={tdSt}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              {e.motivo && (
                                <span style={{ fontSize: 11, color: '#92400E', background: '#FEF3C7',
                                  borderRadius: 4, padding: '1px 7px', display: 'inline-flex', alignItems: 'center', gap: 4,
                                  maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                  title={e.motivo}>
                                  <i className="fa fa-comment-alt" style={{ fontSize: 9, flexShrink: 0 }} aria-hidden="true" />
                                  {e.motivo}
                                </span>
                              )}
                              {e.cambios && e.cambios.length > 0 && (
                                <span style={{ fontSize: 11, color: '#1D4ED8', background: '#DBEAFE',
                                  borderRadius: 4, padding: '1px 7px', display: 'inline-flex', alignItems: 'center', gap: 4, width: 'fit-content' }}>
                                  <i className="fa fa-edit" style={{ fontSize: 9 }} aria-hidden="true" />
                                  {e.cambios.length} campo{e.cambios.length !== 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ ...tdSt, textAlign: 'center' }}>
                            <button
                              className="dt-ab dt-ab-extra"
                              onClick={ev => { ev.stopPropagation(); setSelected(e) }}
                              aria-label="Ver detalle del evento"
                            >
                              <i className="fa fa-eye" aria-hidden="true" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination footer */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 16px', borderTop: '1px solid var(--hair)', background: '#FAFBFC' }}>
                <span style={{ fontSize: 12, color: 'var(--ink-4)' }} aria-live="polite">
                  {filtered.length > PAGE
                    ? `Mostrando ${from}–${to} de ${filtered.length} eventos`
                    : `${filtered.length} evento${filtered.length !== 1 ? 's' : ''}`}
                </span>
                {pages > 1 && (
                  <nav className="al-pgns" aria-label="Paginación">
                    <button className="al-pgn" disabled={safePage === 1}
                      onClick={() => setPage(p => p - 1)} aria-label="Página anterior">‹</button>
                    {Array.from({ length: pages }, (_, i) => i + 1)
                      .filter(n => n === 1 || n === pages || Math.abs(n - safePage) <= 1)
                      .reduce<(number|'…')[]>((acc, n, i, arr) => {
                        if (i > 0 && (n as number) - (arr[i-1] as number) > 1) acc.push('…')
                        acc.push(n); return acc
                      }, [])
                      .map((n, i) => n === '…'
                        ? <button key={`e${i}`} className="al-pgn ell" disabled aria-hidden="true">…</button>
                        : <button key={n} className={`al-pgn${safePage === n ? ' cur' : ''}`}
                            onClick={() => setPage(n as number)}
                            aria-label={`Página ${n}`} aria-current={safePage === n ? 'page' : undefined}>{n}</button>
                      )}
                    <button className="al-pgn" disabled={safePage === pages}
                      onClick={() => setPage(p => p + 1)} aria-label="Página siguiente">›</button>
                  </nav>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Detail modal */}
      {selected && <DetalleModal entry={selected} onClose={() => setSelected(null)} />}
    </>
  )
}

// ── Exports ───────────────────────────────────────────────────────────────
export function ConsultaLog() {
  return (
    <LogTable
      acciones={DATA_ACCIONES}
      emptyMsg="No hay eventos de auditoría registrados. Los eventos aparecen aquí al guardar, firmar, derogar o cancelar registros en el sistema."
    />
  )
}

export function LogAcceso() {
  return (
    <LogTable
      acciones={SESION_ACCIONES}
      emptyMsg="No hay eventos de sesión registrados. Los accesos y cierres de sesión aparecerán aquí automáticamente."
    />
  )
}

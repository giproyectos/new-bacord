import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  mockRecetas, mockMateriales, mockProcesosGlobal,
  mockDetallesCatalogo, mockRecetaEstructuras, mockEstrategiasFirma,
  type RecetaEstructura, type RecetaProcesoItem, type RecetaDetalleItem,
} from '@/api/mock'

const estadoLabel: Record<number, { text: string; bg: string; color: string }> = {
  1: { text: 'Activo',    bg: '#D1FAE5', color: '#065F46' },
  2: { text: 'Inactivo',  bg: '#F1F5F9', color: '#475569' },
  3: { text: 'Aprobado',  bg: '#DBEAFE', color: '#1D4ED8' },
  4: { text: 'Creación',  bg: '#FEF3C7', color: '#92400E' },
  5: { text: 'Revisión',  bg: '#EDE9FE', color: '#5B21B6' },
  6: { text: 'Rechazado', bg: '#FEE2E2', color: '#991B1B' },
}

let _nextId = 1000

function cloneEstructura(e: RecetaEstructura): RecetaEstructura {
  return JSON.parse(JSON.stringify(e))
}

function swap<T>(arr: T[], i: number, j: number): T[] {
  const n = [...arr]
  ;[n[i], n[j]] = [n[j], n[i]]
  return n
}

export function RecetaMaestraEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const idNum = Number(id)

  const receta = mockRecetas.find(r => r.idRecetaMaestra === idNum)
  const existing = mockRecetaEstructuras.find(e => e.idRecetaMaestra === idNum)
    ?? { idRecetaMaestra: idNum, idMaterial: 0, procesos: [] }

  const [est, setEst]           = useState<RecetaEstructura>(cloneEstructura(existing))
  const [openIds, setOpenIds]   = useState<Set<number>>(() => new Set(existing.procesos.map(p => p.id)))
  const [saved, setSaved]       = useState(false)
  const [modalPaso, setModalPaso]       = useState(false)
  const [modalDetalle, setModalDetalle] = useState<RecetaProcesoItem | null>(null)
  const [warnPaso, setWarnPaso]         = useState<RecetaProcesoItem | null>(null)

  const material = mockMateriales.find(m => m.id === est.idMaterial)
  const procesosDisponibles = mockProcesosGlobal.filter(p =>
    p.idMaterial === est.idMaterial &&
    !est.procesos.some(ep => ep.idProceso === p.id)
  )

  const toggleOpen = (id: number) =>
    setOpenIds(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  // ── Procesos ──────────────────────────────────────────────────────────────
  const agregarPaso = (idProceso: number) => {
    const maxOrden = Math.max(0, ...est.procesos.map(p => p.orden))
    const nuevo: RecetaProcesoItem = { id: ++_nextId, idProceso, orden: maxOrden + 1, detalles: [] }
    setEst(e => ({ ...e, procesos: [...e.procesos, nuevo].sort((a, b) => a.orden - b.orden) }))
    setOpenIds(s => new Set(s).add(nuevo.id))
    setModalPaso(false)
  }

  const eliminarPaso = (rp: RecetaProcesoItem) => {
    setEst(e => ({ ...e, procesos: e.procesos.filter(p => p.id !== rp.id) }))
    setWarnPaso(null)
  }

  const moverPaso = (idx: number, dir: -1 | 1) => {
    setEst(e => {
      const sorted = [...e.procesos].sort((a, b) => a.orden - b.orden)
      const swapped = swap(sorted, idx, idx + dir)
      return { ...e, procesos: swapped.map((p, i) => ({ ...p, orden: i + 1 })) }
    })
  }

  // ── Detalles ──────────────────────────────────────────────────────────────
  const agregarDetalle = (rp: RecetaProcesoItem, idDetalle: number) => {
    const maxOrden = Math.max(0, ...rp.detalles.map(d => d.orden))
    const nuevo: RecetaDetalleItem = { id: ++_nextId, idDetalle, orden: maxOrden + 1 }
    setEst(e => ({
      ...e,
      procesos: e.procesos.map(p =>
        p.id === rp.id ? { ...p, detalles: [...p.detalles, nuevo] } : p
      ),
    }))
    setModalDetalle(null)
  }

  const eliminarDetalle = (rpId: number, rdId: number) => {
    setEst(e => ({
      ...e,
      procesos: e.procesos.map(p =>
        p.id === rpId ? { ...p, detalles: p.detalles.filter(d => d.id !== rdId) } : p
      ),
    }))
  }

  const moverDetalle = (rpId: number, idx: number, dir: -1 | 1) => {
    setEst(e => ({
      ...e,
      procesos: e.procesos.map(p => {
        if (p.id !== rpId) return p
        const sorted = [...p.detalles].sort((a, b) => a.orden - b.orden)
        const swapped = swap(sorted, idx, idx + dir)
        return { ...p, detalles: swapped.map((d, i) => ({ ...d, orden: i + 1 })) }
      }),
    }))
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  const guardar = () => {
    const idx = mockRecetaEstructuras.findIndex(e => e.idRecetaMaestra === idNum)
    if (idx !== -1) mockRecetaEstructuras[idx] = cloneEstructura(est)
    else mockRecetaEstructuras.push(cloneEstructura(est))
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (!receta) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-4)' }}>
      Receta no encontrada.
      <button className="btn btn-gray" style={{ marginLeft: 12 }} onClick={() => navigate('/recetas-maestras')}>Volver</button>
    </div>
  )

  const sortedProcesos = [...est.procesos].sort((a, b) => a.orden - b.orden)
  const estado = estadoLabel[receta.idEstado] ?? estadoLabel[1]

  return (
    <>
      <style>{`
        .rme-header { display:flex; align-items:center; gap:12px; margin-bottom:20px; flex-wrap:wrap; }
        .rme-back { background:none; border:none; cursor:pointer; color:var(--ink-4); font-size:13px; font-family:var(--f-sans); display:flex; align-items:center; gap:5px; padding:5px 8px; border-radius:var(--r-sm); transition:background 80ms; }
        .rme-back:hover { background:var(--paper-2); color:var(--ink); }
        .rme-title { font-size:17px; font-weight:700; color:var(--ink); }
        .rme-badge { font-size:11px; font-weight:700; padding:3px 10px; border-radius:20px; }
        .rme-save { margin-left:auto; }

        .rme-info { background:#fff; border-radius:var(--r-md); border:1.5px solid var(--hair-2); padding:14px 18px; margin-bottom:20px; display:flex; align-items:center; gap:14px; box-shadow:0 1px 4px rgba(0,0,0,0.04); }
        .rme-info-icon { width:42px; height:42px; border-radius:11px; background:#EEF2FF; display:grid; place-items:center; flex-shrink:0; }
        .rme-info-icon i { color:#4F46E5; font-size:18px; }
        .rme-info-name { font-size:15px; font-weight:700; color:var(--ink); }
        .rme-info-sub  { font-size:12.5px; color:var(--ink-4); margin-top:2px; display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
        .rme-info-pill { font-family:var(--f-mono); font-size:11px; font-weight:700; color:#4F46E5; background:#EEF2FF; padding:2px 8px; border-radius:4px; }
        .rme-mat-sel { flex:1; max-width:320px; padding:7px 12px; border:1.5px solid var(--hair-2); border-radius:var(--r-sm); font-size:13px; font-family:var(--f-sans); color:var(--ink); outline:none; background:#fff; }
        .rme-mat-sel:focus { border-color:var(--navy); }

        .rme-section { background:#fff; border-radius:var(--r-md); border:1.5px solid var(--hair-2); box-shadow:0 1px 4px rgba(0,0,0,0.04); overflow:hidden; }
        .rme-section-hdr { display:flex; align-items:center; gap:10px; padding:13px 18px; background:#FAFBFC; border-bottom:1.5px solid var(--hair-2); }
        .rme-section-title { font-size:13.5px; font-weight:700; color:var(--ink); }
        .rme-section-desc  { font-size:12px; color:var(--ink-4); margin-top:1px; }

        .rme-paso { border-bottom:1.5px solid var(--hair-2); }
        .rme-paso:last-child { border-bottom:none; }
        .rme-paso-hdr {
          display:flex; align-items:center; gap:10px; padding:12px 18px;
          cursor:pointer; transition:background 80ms; user-select:none;
        }
        .rme-paso-hdr:hover { background:#F8FAFC; }
        .rme-caret { width:20px; height:20px; display:grid; place-items:center; color:var(--ink-4); font-size:11px; transition:transform 180ms; flex-shrink:0; }
        .rme-caret.open { transform:rotate(90deg); }
        .rme-paso-num { width:26px; height:26px; border-radius:50%; background:var(--navy); color:#fff; font-size:11.5px; font-weight:700; display:grid; place-items:center; flex-shrink:0; }
        .rme-paso-name { font-size:13.5px; font-weight:600; color:var(--ink); flex:1; min-width:0; }
        .rme-paso-code { font-family:var(--f-mono); font-size:10.5px; font-weight:700; color:var(--ink-4); background:var(--paper-2); border:1px solid var(--hair-2); padding:2px 7px; border-radius:4px; flex-shrink:0; }
        .rme-det-count { font-size:11px; color:var(--ink-4); flex-shrink:0; }
        .rme-iab { width:28px; height:28px; border:none; border-radius:7px; cursor:pointer; display:grid; place-items:center; font-size:11px; background:none; transition:background 100ms, color 100ms; color:var(--ink-4); flex-shrink:0; }
        .rme-iab:hover { background:var(--paper-2); color:var(--ink); }
        .rme-iab:disabled { opacity:.2; cursor:not-allowed; }
        .rme-iab.del:hover { background:#FEF2F2; color:#DC2626; }

        .rme-det-panel { background:#F8FAFC; border-top:1px solid var(--hair-2); padding:12px 24px 14px 52px; }
        .rme-det-row { display:flex; align-items:center; gap:10px; padding:8px 12px; background:#fff; border:1.5px solid var(--hair-2); border-radius:var(--r-sm); margin-bottom:8px; transition:box-shadow 100ms; }
        .rme-det-row:hover { box-shadow:var(--sh-1); }
        .rme-det-row:last-of-type { margin-bottom:10px; }
        .rme-det-ico { width:30px; height:30px; border-radius:8px; background:#EEF2FF; display:grid; place-items:center; flex-shrink:0; }
        .rme-det-ico i { color:#4F46E5; font-size:12px; }
        .rme-det-code { font-family:var(--f-mono); font-size:10.5px; font-weight:700; color:var(--ink-4); background:var(--paper-2); border:1px solid var(--hair-2); padding:2px 7px; border-radius:4px; flex-shrink:0; }
        .rme-det-name { font-size:13px; font-weight:500; color:var(--ink-2); flex:1; min-width:0; }
        .rme-ef-chip { font-size:10.5px; font-weight:600; padding:2px 8px; border-radius:20px; background:#EDE9FE; color:#5B21B6; flex-shrink:0; }
        .rme-add-det-btn { display:flex; align-items:center; gap:6px; background:none; border:1.5px dashed var(--hair-2); border-radius:var(--r-sm); padding:6px 12px; font-size:12.5px; font-family:var(--f-sans); color:var(--ink-4); cursor:pointer; transition:border-color 120ms, color 120ms; }
        .rme-add-det-btn:hover { border-color:var(--navy); color:var(--navy); }

        .rme-empty-pasos { padding:40px 20px; text-align:center; }
        .rme-empty-pasos i { font-size:28px; color:var(--hair-2); display:block; margin-bottom:10px; }
        .rme-empty-pasos p { font-size:13px; color:var(--ink-4); margin:0 0 14px; }

        .rme-add-paso-btn { display:flex; align-items:center; gap:7px; background:none; border:none; font-size:13px; font-family:var(--f-sans); color:var(--navy); font-weight:600; cursor:pointer; padding:12px 18px; width:100%; border-top:1px solid var(--hair-2); transition:background 80ms; }
        .rme-add-paso-btn:hover { background:#F0F4FF; }

        .rme-toast { position:fixed; bottom:24px; right:24px; background:#065F46; color:#fff; padding:10px 18px; border-radius:var(--r-md); font-size:13px; font-weight:600; display:flex; align-items:center; gap:8px; box-shadow:var(--sh-3); z-index:300; animation:rme-fadein 200ms; }
        @keyframes rme-fadein { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }

        .rme-mo { position:fixed; inset:0; z-index:200; background:rgba(10,21,48,.45); display:flex; align-items:center; justify-content:center; padding:20px; }
        .rme-mbox { background:var(--paper); border-radius:var(--r-xl); box-shadow:var(--sh-3); width:100%; max-width:500px; max-height:85vh; display:flex; flex-direction:column; }
        .rme-mhdr { background:var(--navy); border-radius:var(--r-xl) var(--r-xl) 0 0; padding:14px 22px; display:flex; align-items:center; gap:10px; flex-shrink:0; }
        .rme-mhdr-ico { width:34px; height:34px; border-radius:9px; background:rgba(255,255,255,.12); display:grid; place-items:center; flex-shrink:0; }
        .rme-mhdr-ico i { color:rgba(255,220,60,.9); font-size:14px; }
        .rme-mhdr-title { color:#fff; font-weight:700; font-size:14px; }
        .rme-mhdr-sub   { color:#8FA5C9; font-size:11px; margin-top:1px; }
        .rme-mhdr-close { margin-left:auto; background:rgba(255,255,255,.1); border:none; cursor:pointer; color:#fff; width:28px; height:28px; border-radius:7px; font-size:16px; display:grid; place-items:center; }
        .rme-mhdr-close:hover { background:rgba(255,255,255,.2); }
        .rme-mlist { flex:1; overflow-y:auto; padding:12px 16px; display:flex; flex-direction:column; gap:6px; }
        .rme-mlist::-webkit-scrollbar { width:4px; }
        .rme-mlist::-webkit-scrollbar-thumb { background:var(--hair-2); border-radius:2px; }
        .rme-mitem { display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:var(--r-sm); border:1.5px solid var(--hair-2); cursor:pointer; background:#fff; transition:border-color 120ms, background 80ms; }
        .rme-mitem:hover { border-color:var(--navy); background:#F0F4FF; }
        .rme-mitem-code { font-family:var(--f-mono); font-size:11px; font-weight:700; color:#4F46E5; background:#EEF2FF; padding:2px 7px; border-radius:4px; flex-shrink:0; }
        .rme-mitem-name { font-size:13px; color:var(--ink-2); flex:1; }
        .rme-mitem-ef   { font-size:11px; padding:2px 7px; background:#EDE9FE; color:#5B21B6; border-radius:20px; flex-shrink:0; }
        .rme-mfoot { padding:14px 22px; border-top:1px solid var(--hair); display:flex; justify-content:flex-end; flex-shrink:0; }
        .rme-empty-modal { padding:32px 20px; text-align:center; color:var(--ink-4); font-size:13px; }
      `}</style>

      {/* ── Header ── */}
      <div className="rme-header">
        <button className="rme-back" onClick={() => navigate('/recetas-maestras')}>
          <i className="fa fa-arrow-left" /> Recetas Maestras
        </button>
        <i className="fa fa-chevron-right" style={{ color: 'var(--hair-2)', fontSize: 11 }} />
        <span className="rme-title">{receta.codigo} · {receta.descripcion}</span>
        <span className="rme-badge" style={{ background: estado.bg, color: estado.color }}>{estado.text}</span>
        <span style={{ fontFamily: 'var(--f-mono)', fontSize: 11.5, color: 'var(--ink-4)', background: 'var(--paper-2)', border: '1px solid var(--hair-2)', padding: '2px 8px', borderRadius: 4 }}>{receta.version}</span>
        <button className="btn btn-primary rme-save" onClick={guardar}>
          <i className="fa fa-save" /> Guardar cambios
        </button>
      </div>

      {/* ── Info card ── */}
      <div className="rme-info">
        <div className="rme-info-icon"><i className="fa fa-pills" /></div>
        <div style={{ flex: 1 }}>
          <div className="rme-info-name">{receta.descripcion}</div>
          <div className="rme-info-sub">
            <span><i className="fa fa-building" style={{ marginRight: 5 }} />{receta.centro}</span>
            {material
              ? <><span className="rme-info-pill">{material.codigo}</span><span>{material.descripcion}</span></>
              : <span style={{ color: 'var(--orange)', fontWeight: 600 }}>Sin material asignado</span>}
          </div>
        </div>
        {!material && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>Producto:</label>
            <select className="rme-mat-sel" value={est.idMaterial || ''} onChange={e => setEst(x => ({ ...x, idMaterial: Number(e.target.value), procesos: [] }))}>
              <option value="">— Seleccione —</option>
              {mockMateriales.map(m => <option key={m.id} value={m.id}>{m.descripcion} ({m.codigo})</option>)}
            </select>
          </div>
        )}
      </div>

      {/* ── Accordion de procesos ── */}
      <div className="rme-section">
        <div className="rme-section-hdr">
          <div>
            <div className="rme-section-title">Procesos y Formularios</div>
            <div className="rme-section-desc">
              Define los pasos de manufactura y los formularios de registro para cada paso
            </div>
          </div>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--ink-4)' }}>
            {sortedProcesos.length} paso{sortedProcesos.length !== 1 ? 's' : ''} ·{' '}
            {sortedProcesos.reduce((s, p) => s + p.detalles.length, 0)} formulario{sortedProcesos.reduce((s, p) => s + p.detalles.length, 0) !== 1 ? 's' : ''}
          </span>
        </div>

        {sortedProcesos.length === 0 ? (
          <div className="rme-empty-pasos">
            <i className="fa fa-sitemap" />
            <p>{est.idMaterial ? 'No hay pasos definidos. Agrega el primer paso de proceso.' : 'Primero selecciona el producto en la tarjeta de información.'}</p>
            {est.idMaterial > 0 && (
              <button className="btn btn-primary" onClick={() => setModalPaso(true)}>
                <i className="fa fa-plus" /> Agregar primer paso
              </button>
            )}
          </div>
        ) : (
          <>
            {sortedProcesos.map((rp, idx) => {
              const proceso = mockProcesosGlobal.find(p => p.id === rp.idProceso)
              const isOpen = openIds.has(rp.id)
              const sortedDets = [...rp.detalles].sort((a, b) => a.orden - b.orden)
              return (
                <div key={rp.id} className="rme-paso">
                  <div className="rme-paso-hdr" onClick={() => toggleOpen(rp.id)}>
                    <span className={`rme-caret${isOpen ? ' open' : ''}`}><i className="fa fa-caret-right" /></span>
                    <span className="rme-paso-num">{rp.orden}</span>
                    <span className="rme-paso-name">{proceso?.descripcion ?? '—'}</span>
                    <span className="rme-paso-code">{proceso?.codigo ?? '—'}</span>
                    <span className="rme-det-count">
                      {rp.detalles.length > 0 ? `${rp.detalles.length} form.` : 'Sin formularios'}
                    </span>
                    <button className="rme-iab" title="Subir" disabled={idx === 0} onClick={e => { e.stopPropagation(); moverPaso(idx, -1) }}><i className="fa fa-chevron-up" /></button>
                    <button className="rme-iab" title="Bajar" disabled={idx === sortedProcesos.length - 1} onClick={e => { e.stopPropagation(); moverPaso(idx, 1) }}><i className="fa fa-chevron-down" /></button>
                    <button className="rme-iab del" title="Eliminar paso" onClick={e => { e.stopPropagation(); setWarnPaso(rp) }}><i className="fa fa-times" /></button>
                  </div>

                  {isOpen && (
                    <div className="rme-det-panel">
                      {sortedDets.length === 0 && (
                        <p style={{ fontSize: 12.5, color: 'var(--ink-4)', margin: '0 0 10px' }}>
                          No hay formularios asignados a este paso.
                        </p>
                      )}
                      {sortedDets.map((rd, di) => {
                        const det = mockDetallesCatalogo.find(d => d.id === rd.idDetalle)
                        const ef = det?.idEstrategiaFirma ? mockEstrategiasFirma.find(e => e.id === det.idEstrategiaFirma) : null
                        return (
                          <div key={rd.id} className="rme-det-row">
                            <div className="rme-det-ico"><i className="fa fa-wpforms" /></div>
                            <span className="rme-det-code">{det?.codigo ?? '—'}</span>
                            <span className="rme-det-name">{det?.descripcion ?? '—'}</span>
                            {ef && <span className="rme-ef-chip">{ef.codigo}</span>}
                            <button className="rme-iab" title="Subir" disabled={di === 0} onClick={() => moverDetalle(rp.id, di, -1)}><i className="fa fa-chevron-up" /></button>
                            <button className="rme-iab" title="Bajar" disabled={di === sortedDets.length - 1} onClick={() => moverDetalle(rp.id, di, 1)}><i className="fa fa-chevron-down" /></button>
                            <button className="rme-iab del" title="Quitar formulario" onClick={() => eliminarDetalle(rp.id, rd.id)}><i className="fa fa-times" /></button>
                          </div>
                        )
                      })}
                      <button className="rme-add-det-btn" onClick={() => setModalDetalle(rp)}>
                        <i className="fa fa-plus" /> Agregar formulario a este paso
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}

        {est.idMaterial > 0 && (
          <button className="rme-add-paso-btn" onClick={() => setModalPaso(true)}>
            <i className="fa fa-plus-circle" /> Agregar paso de proceso
          </button>
        )}
      </div>

      {/* ── Modal: Agregar paso ── */}
      {modalPaso && (
        <div className="rme-mo" onClick={() => setModalPaso(false)}>
          <div className="rme-mbox" onClick={e => e.stopPropagation()}>
            <div className="rme-mhdr">
              <div className="rme-mhdr-ico"><i className="fa fa-sitemap" /></div>
              <div>
                <div className="rme-mhdr-title">Agregar paso de proceso</div>
                <div className="rme-mhdr-sub">
                  Procesos disponibles para {material?.descripcion ?? '—'}
                </div>
              </div>
              <button className="rme-mhdr-close" onClick={() => setModalPaso(false)}>×</button>
            </div>
            <div className="rme-mlist">
              {procesosDisponibles.length === 0 ? (
                <div className="rme-empty-modal">
                  <i className="fa fa-check-circle" style={{ fontSize: 24, color: '#10B981', display: 'block', marginBottom: 8 }} />
                  Todos los pasos del catálogo ya están en esta receta.
                </div>
              ) : (
                procesosDisponibles.map(p => (
                  <div key={p.id} className="rme-mitem" onClick={() => agregarPaso(p.id)}>
                    <span className="rme-mitem-code">{p.codigo}</span>
                    <span className="rme-mitem-name">{p.descripcion}</span>
                    <i className="fa fa-plus" style={{ color: 'var(--ink-4)', fontSize: 12 }} />
                  </div>
                ))
              )}
            </div>
            <div className="rme-mfoot">
              <button className="btn btn-gray" onClick={() => setModalPaso(false)}><i className="fa fa-times" /> Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Agregar formulario ── */}
      {modalDetalle && (() => {
        const yaAsignados = new Set(modalDetalle.detalles.map(d => d.idDetalle))
        const disponibles = mockDetallesCatalogo.filter(d => !yaAsignados.has(d.id))
        return (
          <div className="rme-mo" onClick={() => setModalDetalle(null)}>
            <div className="rme-mbox" onClick={e => e.stopPropagation()}>
              <div className="rme-mhdr">
                <div className="rme-mhdr-ico"><i className="fa fa-wpforms" /></div>
                <div>
                  <div className="rme-mhdr-title">Agregar formulario</div>
                  <div className="rme-mhdr-sub">
                    Paso: {mockProcesosGlobal.find(p => p.id === modalDetalle.idProceso)?.descripcion}
                  </div>
                </div>
                <button className="rme-mhdr-close" onClick={() => setModalDetalle(null)}>×</button>
              </div>
              <div className="rme-mlist">
                {disponibles.length === 0 ? (
                  <div className="rme-empty-modal">Todos los formularios ya están asignados a este paso.</div>
                ) : (
                  disponibles.map(d => {
                    const ef = d.idEstrategiaFirma ? mockEstrategiasFirma.find(e => e.id === d.idEstrategiaFirma) : null
                    return (
                      <div key={d.id} className="rme-mitem" onClick={() => agregarDetalle(modalDetalle, d.id)}>
                        <span className="rme-mitem-code">{d.codigo}</span>
                        <span className="rme-mitem-name">{d.descripcion}</span>
                        {ef && <span className="rme-mitem-ef">{ef.codigo}</span>}
                        <i className="fa fa-plus" style={{ color: 'var(--ink-4)', fontSize: 12 }} />
                      </div>
                    )
                  })
                )}
              </div>
              <div className="rme-mfoot">
                <button className="btn btn-gray" onClick={() => setModalDetalle(null)}><i className="fa fa-times" /> Cerrar</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Modal: Confirmar eliminar paso ── */}
      {warnPaso && (
        <div className="rme-mo" onClick={() => setWarnPaso(null)}>
          <div style={{ background: 'var(--paper)', borderRadius: 'var(--r-xl)', boxShadow: 'var(--sh-3)', width: '100%', maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '22px 22px 14px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: '#FEF2F2', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <i className="fa fa-exclamation-triangle" style={{ color: '#DC2626', fontSize: 18 }} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', marginBottom: 6 }}>¿Quitar este paso?</div>
                <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5 }}>
                  Se quitará <strong>{mockProcesosGlobal.find(p => p.id === warnPaso.idProceso)?.descripcion}</strong> y sus {warnPaso.detalles.length} formulario{warnPaso.detalles.length !== 1 ? 's' : ''} asignado{warnPaso.detalles.length !== 1 ? 's' : ''}.
                </div>
              </div>
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid var(--hair)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-gray" onClick={() => setWarnPaso(null)}><i className="fa fa-undo" /> Cancelar</button>
              <button className="btn btn-danger" onClick={() => eliminarPaso(warnPaso)}><i className="fa fa-times" /> Quitar paso</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast de guardado ── */}
      {saved && (
        <div className="rme-toast">
          <i className="fa fa-check-circle" /> Cambios guardados correctamente
        </div>
      )}
    </>
  )
}

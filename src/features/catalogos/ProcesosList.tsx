import { useState } from 'react'
import { mockMateriales, mockProcesosGlobal, type ProcesoItem as Proceso } from '@/api/mock'

let mockProcesos = mockProcesosGlobal

const EMPTY_FORM = { codigo: '', descripcion: '', idMaterial: '' }

function reorder(list: Proceso[], id: number, dir: -1 | 1): Proceso[] {
  const sorted = [...list].sort((a, b) => a.orden - b.orden)
  const idx = sorted.findIndex(p => p.id === id)
  const target = idx + dir
  if (target < 0 || target >= sorted.length) return list
  const a = sorted[idx].orden
  const b = sorted[target].orden
  sorted[idx].orden = b
  sorted[target].orden = a
  return sorted
}

export function ProcesosList() {
  const [procesos, setProcesos] = useState<Proceso[]>([...mockProcesos])
  const [openIds, setOpenIds]   = useState<Set<number>>(() => {
    const ids = new Set<number>()
    mockProcesos.forEach(p => ids.add(p.idMaterial))
    return ids
  })
  const [modal, setModal]   = useState<{ mode: 'crear' | 'editar'; item?: Proceso; presetMat?: number } | null>(null)
  const [form, setForm]     = useState(EMPTY_FORM)
  const [warn, setWarn]     = useState<Proceso | null>(null)
  const [err, setErr]       = useState('')
  const [search, setSearch] = useState('')

  const toggleOpen = (id: number) =>
    setOpenIds(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const openCrear = (presetMat?: number) => {
    setForm({ ...EMPTY_FORM, idMaterial: presetMat ? String(presetMat) : '' })
    setErr(''); setModal({ mode: 'crear', presetMat })
  }
  const openEditar = (p: Proceso) => {
    setForm({ codigo: p.codigo, descripcion: p.descripcion, idMaterial: String(p.idMaterial) })
    setErr(''); setModal({ mode: 'editar', item: p })
  }

  const guardar = () => {
    if (!form.idMaterial)        { setErr('Seleccione un producto'); return }
    if (!form.codigo.trim())     { setErr('El código es requerido'); return }
    if (!form.descripcion.trim()){ setErr('La descripción es requerida'); return }

    const idMat = Number(form.idMaterial)
    if (modal?.mode === 'crear') {
      const maxOrden = Math.max(0, ...procesos.filter(p => p.idMaterial === idMat).map(p => p.orden))
      const nuevo: Proceso = {
        id: Math.max(0, ...procesos.map(p => p.id)) + 1,
        idMaterial: idMat,
        codigo: form.codigo.trim().toUpperCase(),
        descripcion: form.descripcion.trim(),
        orden: maxOrden + 1,
      }
      setProcesos(ps => [...ps, nuevo])
      mockProcesos.push(nuevo)
      setOpenIds(s => new Set(s).add(idMat))
    } else if (modal?.item) {
      const upd = { ...modal.item, codigo: form.codigo.trim().toUpperCase(), descripcion: form.descripcion.trim(), idMaterial: idMat }
      setProcesos(ps => ps.map(p => p.id === upd.id ? upd : p))
      const i = mockProcesos.findIndex(p => p.id === upd.id)
      if (i !== -1) mockProcesos[i] = upd
    }
    setModal(null)
  }

  const eliminar = (p: Proceso) => {
    setProcesos(ps => ps.filter(x => x.id !== p.id))
    mockProcesos = mockProcesos.filter(x => x.id !== p.id)
    setWarn(null)
  }

  const mover = (id: number, dir: -1 | 1, idMat: number) => {
    const lista = procesos.filter(p => p.idMaterial === idMat)
    const reordenada = reorder(lista, id, dir)
    setProcesos(ps => {
      const otros = ps.filter(p => p.idMaterial !== idMat)
      return [...otros, ...reordenada]
    })
    const otros = mockProcesos.filter(p => p.idMaterial !== idMat)
    mockProcesos = [...otros, ...reorder(mockProcesos.filter(p => p.idMaterial === idMat), id, dir)]
  }

  const q = search.toLowerCase()
  const materialesFiltrados = mockMateriales.filter(m =>
    !q || m.descripcion.toLowerCase().includes(q) || m.codigo.toLowerCase().includes(q) ||
    procesos.some(p => p.idMaterial === m.id && (p.descripcion.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q)))
  )

  return (
    <>
      <style>{`
        .pr-section { border-radius:var(--r-md); border:1.5px solid var(--hair-2); overflow:hidden; box-shadow:0 1px 4px rgba(0,0,0,0.04); margin-bottom:12px; background:#fff; }
        .pr-section-hdr {
          display:flex; align-items:center; gap:12px; padding:13px 18px;
          cursor:pointer; background:#FAFBFC; border-bottom:1.5px solid transparent;
          transition:background 100ms;
          user-select:none;
        }
        .pr-section-hdr:hover { background:#F1F5F9; }
        .pr-section-hdr.open { border-bottom-color:var(--hair-2); }
        .pr-caret { width:20px; height:20px; border-radius:5px; display:grid; place-items:center; color:var(--ink-4); font-size:11px; transition:transform 200ms; flex-shrink:0; }
        .pr-caret.open { transform:rotate(90deg); }
        .pr-mat-icon { width:34px; height:34px; border-radius:9px; background:#EEF2FF; display:grid; place-items:center; flex-shrink:0; }
        .pr-mat-icon i { color:#4F46E5; font-size:14px; }
        .pr-mat-name { font-size:14px; font-weight:700; color:var(--ink); }
        .pr-mat-code { font-family:var(--f-mono); font-size:10.5px; font-weight:700; color:#4F46E5; background:#EEF2FF; padding:2px 7px; border-radius:4px; }
        .pr-count { font-size:11.5px; color:var(--ink-4); padding:2px 9px; background:var(--paper-2); border-radius:20px; border:1px solid var(--hair-2); }
        .pr-add-btn { margin-left:auto; display:flex; align-items:center; gap:5px; background:none; border:1.5px dashed var(--hair-2); border-radius:var(--r-sm); padding:4px 10px; font-size:12px; font-family:var(--f-sans); color:var(--ink-4); cursor:pointer; transition:border-color 120ms, color 120ms; flex-shrink:0; }
        .pr-add-btn:hover { border-color:var(--navy); color:var(--navy); }

        .pr-rows { }
        .pr-row { display:flex; align-items:center; gap:10px; padding:10px 18px; border-bottom:1px solid var(--hair); transition:background 50ms; }
        .pr-row:last-child { border-bottom:none; }
        .pr-row:hover { background:#F8FAFC; }
        .pr-num { width:22px; text-align:center; font-size:11px; font-family:var(--f-mono); color:var(--ink-4); flex-shrink:0; }
        .pr-code { font-family:var(--f-mono); font-size:11px; font-weight:700; color:var(--ink-3); background:var(--paper-2); border:1px solid var(--hair-2); padding:2px 7px; border-radius:4px; flex-shrink:0; }
        .pr-desc { font-size:13.5px; color:var(--ink-2); flex:1; min-width:0; }
        .pr-acts { display:flex; align-items:center; gap:1px; flex-shrink:0; }
        .pr-ab { width:28px; height:28px; border:none; border-radius:7px; cursor:pointer; display:grid; place-items:center; font-size:11px; background:none; transition:background 100ms, color 100ms; color:var(--ink-4); }
        .pr-ab:hover { background:var(--paper-2); color:var(--ink); }
        .pr-ab.edit:hover { background:#EFF6FF; color:#2563EB; }
        .pr-ab.del:hover  { background:#FEF2F2; color:#DC2626; }
        .pr-ab:disabled { opacity:.25; cursor:not-allowed; }

        .pr-empty { padding:20px 18px; display:flex; align-items:center; gap:10px; color:var(--ink-4); font-size:13px; }
        .pr-empty i { font-size:18px; color:var(--hair-2); }

        .pr-mo   { position:fixed; inset:0; z-index:200; background:rgba(10,21,48,.45); display:flex; align-items:center; justify-content:center; padding:20px; }
        .pr-mbox { background:var(--paper); border-radius:var(--r-xl); box-shadow:var(--sh-3); width:100%; max-width:460px; }
        .pr-mhdr { background:var(--navy); border-radius:var(--r-xl) var(--r-xl) 0 0; padding:14px 22px; display:flex; align-items:center; gap:10px; }
        .pr-mhdr-ico { width:34px; height:34px; border-radius:9px; background:rgba(255,255,255,.12); display:grid; place-items:center; flex-shrink:0; }
        .pr-mhdr-ico i { color:rgba(255,220,60,.9); font-size:14px; }
        .pr-mhdr-title { color:#fff; font-weight:700; font-size:14px; }
        .pr-mhdr-sub   { color:#8FA5C9; font-size:11px; margin-top:1px; }
        .pr-mhdr-close { margin-left:auto; background:rgba(255,255,255,.1); border:none; cursor:pointer; color:#fff; width:28px; height:28px; border-radius:7px; font-size:16px; display:grid; place-items:center; }
        .pr-mhdr-close:hover { background:rgba(255,255,255,.2); }
        .pr-mbody { padding:20px 22px; display:flex; flex-direction:column; gap:14px; }
        .pr-mfoot { padding:14px 22px; border-top:1px solid var(--hair); display:flex; justify-content:flex-end; gap:8px; }
        .pr-field label { display:block; font-size:11.5px; font-weight:700; color:var(--ink-3); margin-bottom:5px; text-transform:uppercase; letter-spacing:0.05em; }
        .pr-field input, .pr-field select { width:100%; padding:8px 12px; border:1.5px solid var(--hair-2); border-radius:var(--r-sm); font-size:13.5px; font-family:var(--f-sans); color:var(--ink); outline:none; background:#fff; transition:border-color 120ms; }
        .pr-field input:focus, .pr-field select:focus { border-color:var(--navy); }
      `}</style>

      {/* Cabecera de página */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20, gap:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:40, height:40, borderRadius:10, background:'var(--navy)', display:'grid', placeItems:'center', flexShrink:0 }}>
            <i className="fa fa-sitemap" style={{ color:'rgba(255,255,255,.85)', fontSize:16 }} />
          </div>
          <div>
            <h2 style={{ margin:0, fontSize:19, fontWeight:700, color:'var(--ink)', letterSpacing:'-0.01em' }}>Procesos</h2>
            <p style={{ margin:'2px 0 0', fontSize:12.5, color:'var(--ink-4)' }}>Pasos de manufactura definidos por producto</p>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
          <div style={{ position:'relative' }}>
            <i className="fa fa-search" style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--ink-4)', fontSize:12, pointerEvents:'none' }} />
            <input
              placeholder="Buscar producto o proceso..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ padding:'7px 10px 7px 30px', border:'1.5px solid var(--hair-2)', borderRadius:'var(--r-sm)', fontSize:13, fontFamily:'var(--f-sans)', color:'var(--ink)', outline:'none', width:240, background:'#fff', transition:'border-color 120ms' }}
              onFocus={e => { (e.target as HTMLInputElement).style.borderColor = 'var(--navy)' }}
              onBlur={e => { (e.target as HTMLInputElement).style.borderColor = 'var(--hair-2)' }}
            />
          </div>
          <button className="btn btn-primary" onClick={() => openCrear()}>
            <i className="fa fa-plus" /> Nuevo proceso
          </button>
        </div>
      </div>

      {/* Acordeón por material */}
      {materialesFiltrados.map(mat => {
        const pasos = procesos
          .filter(p => p.idMaterial === mat.id)
          .sort((a, b) => a.orden - b.orden)
        const isOpen = openIds.has(mat.id)

        return (
          <div key={mat.id} className="pr-section">
            {/* Header del acordeón */}
            <div
              className={`pr-section-hdr${isOpen ? ' open' : ''}`}
              onClick={() => toggleOpen(mat.id)}
            >
              <span className={`pr-caret${isOpen ? ' open' : ''}`}>
                <i className="fa fa-caret-right" />
              </span>
              <div className="pr-mat-icon"><i className="fa fa-pills" /></div>
              <span className="pr-mat-name">{mat.descripcion}</span>
              <span className="pr-mat-code">{mat.codigo}</span>
              <span className="pr-count">
                {pasos.length > 0 ? `${pasos.length} paso${pasos.length !== 1 ? 's' : ''}` : 'Sin pasos'}
              </span>
              <button
                className="pr-add-btn"
                onClick={e => { e.stopPropagation(); openCrear(mat.id) }}
              >
                <i className="fa fa-plus" /> Agregar paso
              </button>
            </div>

            {/* Filas de procesos */}
            {isOpen && (
              <div className="pr-rows">
                {pasos.length === 0 ? (
                  <div className="pr-empty">
                    <i className="fa fa-info-circle" />
                    <span>No hay pasos definidos para este producto. <button style={{ background:'none', border:'none', cursor:'pointer', color:'var(--navy)', fontWeight:600, padding:0 }} onClick={() => openCrear(mat.id)}>Agregar el primero</button></span>
                  </div>
                ) : (
                  pasos.map((p, idx) => (
                    <div key={p.id} className="pr-row">
                      <span className="pr-num">{p.orden}</span>
                      <span className="pr-code">{p.codigo}</span>
                      <span className="pr-desc">{p.descripcion}</span>
                      <div className="pr-acts">
                        <button className="pr-ab" title="Subir" disabled={idx === 0} onClick={() => mover(p.id, -1, mat.id)}>
                          <i className="fa fa-chevron-up" />
                        </button>
                        <button className="pr-ab" title="Bajar" disabled={idx === pasos.length - 1} onClick={() => mover(p.id, 1, mat.id)}>
                          <i className="fa fa-chevron-down" />
                        </button>
                        <button className="pr-ab edit" title="Editar" onClick={() => openEditar(p)}>
                          <i className="fa fa-pencil-alt" />
                        </button>
                        <button className="pr-ab del" title="Eliminar" onClick={() => setWarn(p)}>
                          <i className="fa fa-trash-alt" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )
      })}

      {materialesFiltrados.length === 0 && (
        <div style={{ padding:'48px 20px', textAlign:'center', color:'var(--ink-4)' }}>
          <i className="fa fa-search" style={{ fontSize:28, display:'block', marginBottom:10, color:'var(--hair-2)' }} />
          <span style={{ fontSize:13 }}>No se encontraron productos que coincidan con "{search}"</span>
        </div>
      )}

      {/* Modal crear / editar */}
      {modal && (
        <div className="pr-mo" onClick={() => setModal(null)}>
          <div className="pr-mbox" onClick={e => e.stopPropagation()}>
            <div className="pr-mhdr">
              <div className="pr-mhdr-ico"><i className="fa fa-sitemap" /></div>
              <div>
                <div className="pr-mhdr-title">{modal.mode === 'crear' ? 'Nuevo paso de proceso' : 'Editar paso'}</div>
                <div className="pr-mhdr-sub">
                  {modal.mode === 'editar'
                    ? `Editando: ${modal.item?.codigo}`
                    : modal.presetMat
                      ? `Para: ${mockMateriales.find(m => m.id === modal.presetMat)?.descripcion}`
                      : 'Seleccione el producto y complete los datos'}
                </div>
              </div>
              <button className="pr-mhdr-close" onClick={() => setModal(null)}>×</button>
            </div>

            <div className="pr-mbody">
              <div className="pr-field">
                <label>Producto <span style={{ color:'var(--orange)' }}>*</span></label>
                <select value={form.idMaterial} onChange={e => { setForm(v => ({ ...v, idMaterial: e.target.value })); setErr('') }}>
                  <option value="">— Seleccione un producto —</option>
                  {mockMateriales.map(m => (
                    <option key={m.id} value={String(m.id)}>{m.descripcion} ({m.codigo})</option>
                  ))}
                </select>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:12 }}>
                <div className="pr-field">
                  <label>Código <span style={{ color:'var(--orange)' }}>*</span></label>
                  <input
                    value={form.codigo}
                    style={{ fontFamily:'var(--f-mono)', textTransform:'uppercase' }}
                    placeholder="P-XX-001"
                    onChange={e => { setForm(v => ({ ...v, codigo: e.target.value })); setErr('') }}
                  />
                </div>
                <div className="pr-field">
                  <label>Descripción del paso <span style={{ color:'var(--orange)' }}>*</span></label>
                  <input
                    value={form.descripcion}
                    placeholder="Ej: Pesaje de materiales activos"
                    onChange={e => { setForm(v => ({ ...v, descripcion: e.target.value })); setErr('') }}
                  />
                </div>
              </div>
              {err && (
                <div style={{ padding:'8px 12px', background:'#FEF2F2', border:'1.5px solid #FECACA', borderRadius:'var(--r-sm)', fontSize:12.5, color:'#B91C1C', display:'flex', alignItems:'center', gap:7 }}>
                  <i className="fa fa-exclamation-circle" /> {err}
                </div>
              )}
            </div>

            <div className="pr-mfoot">
              <button className="btn btn-gray" onClick={() => setModal(null)}><i className="fa fa-undo" /> Cancelar</button>
              <button className="btn btn-primary" onClick={guardar}><i className="fa fa-check" /> {modal.mode === 'editar' ? 'Guardar cambios' : 'Agregar paso'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Advertencia eliminar */}
      {warn && (
        <div className="pr-mo" onClick={() => setWarn(null)}>
          <div className="pr-mbox" style={{ maxWidth:400 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding:'22px 22px 14px', display:'flex', gap:14, alignItems:'flex-start' }}>
              <div style={{ width:40, height:40, borderRadius:10, background:'#FEF2F2', display:'grid', placeItems:'center', flexShrink:0 }}>
                <i className="fa fa-exclamation-triangle" style={{ color:'#DC2626', fontSize:18 }} />
              </div>
              <div>
                <div style={{ fontWeight:700, fontSize:14, color:'var(--ink)', marginBottom:6 }}>¿Eliminar este paso?</div>
                <div style={{ fontSize:13, color:'var(--ink-3)', lineHeight:1.5 }}>
                  Se eliminará <strong>{warn.codigo} — {warn.descripcion}</strong>. Esta acción no se puede deshacer.
                </div>
              </div>
            </div>
            <div style={{ padding:'14px 22px', borderTop:'1px solid var(--hair)', display:'flex', justifyContent:'flex-end', gap:8 }}>
              <button className="btn btn-gray" onClick={() => setWarn(null)}><i className="fa fa-undo" /> Cancelar</button>
              <button className="btn btn-danger" onClick={() => eliminar(warn)}><i className="fa fa-trash-alt" /> Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

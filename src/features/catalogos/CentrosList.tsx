import { useState } from 'react'
import { mockBatchRecords } from '@/api/mock'

interface Centro { id: number; codigo: string; descripcion: string; direccion?: string }

let mockCentros: Centro[] = [
  { id: 1, codigo: 'C001', descripcion: 'Planta Bogotá',   direccion: 'Calle 13 # 37-29, Bogotá' },
  { id: 2, codigo: 'C002', descripcion: 'Planta Medellín', direccion: 'Cra. 52 # 4-96, Medellín' },
]

function usageCount(idCentro: number) {
  return mockBatchRecords.filter(b => b.idCentro === idCentro).length
}

const EMPTY = { codigo: '', descripcion: '', direccion: '' }

export function CentrosList() {
  const [centros, setCentros] = useState<Centro[]>([...mockCentros])
  const [modal, setModal]     = useState<{ mode: 'crear' | 'editar'; item?: Centro } | null>(null)
  const [form, setForm]       = useState(EMPTY)
  const [warn, setWarn]       = useState<Centro | null>(null)
  const [err, setErr]         = useState('')

  const set = (k: keyof typeof EMPTY, v: string) => { setForm(f => ({ ...f, [k]: v })); setErr('') }

  const openCrear  = () => { setForm(EMPTY); setErr(''); setModal({ mode: 'crear' }) }
  const openEditar = (c: Centro) => {
    setForm({ codigo: c.codigo, descripcion: c.descripcion, direccion: c.direccion ?? '' })
    setErr(''); setModal({ mode: 'editar', item: c })
  }

  const guardar = () => {
    if (!form.codigo.trim())      { setErr('El código es requerido'); return }
    if (!form.descripcion.trim()) { setErr('El nombre es requerido'); return }
    const dup = centros.some(c =>
      c.codigo.toLowerCase() === form.codigo.trim().toLowerCase() &&
      (modal?.mode === 'crear' || c.id !== modal?.item?.id)
    )
    if (dup) { setErr('Ya existe un centro con ese código'); return }

    if (modal?.mode === 'crear') {
      const nuevo: Centro = {
        id: Math.max(0, ...centros.map(c => c.id)) + 1,
        codigo: form.codigo.trim().toUpperCase(),
        descripcion: form.descripcion.trim(),
        direccion: form.direccion.trim() || undefined,
      }
      setCentros(cs => [...cs, nuevo])
      mockCentros.push(nuevo)
    } else if (modal?.item) {
      const upd = { ...modal.item, codigo: form.codigo.trim().toUpperCase(), descripcion: form.descripcion.trim(), direccion: form.direccion.trim() || undefined }
      setCentros(cs => cs.map(c => c.id === upd.id ? upd : c))
      const i = mockCentros.findIndex(c => c.id === upd.id)
      if (i !== -1) mockCentros[i] = upd
    }
    setModal(null)
  }

  const pedirEliminar = (c: Centro) => usageCount(c.id) > 0 ? setWarn(c) : doEliminar(c)
  const doEliminar    = (c: Centro) => {
    setCentros(cs => cs.filter(x => x.id !== c.id))
    mockCentros = mockCentros.filter(x => x.id !== c.id)
    setWarn(null)
  }

  return (
    <>
      <style>{`
        .cn-card {
          background:var(--paper); border-radius:var(--r-md);
          border:1.5px solid var(--hair-2); overflow:hidden;
          display:flex; flex-direction:column;
          transition:box-shadow 150ms, border-color 150ms;
        }
        .cn-card:hover { box-shadow:var(--sh-1); border-color:var(--hair); }
        .cn-icn { background:none; border:none; cursor:pointer; padding:4px 7px; border-radius:6px; color:var(--ink-4); font-size:13px; transition:background 120ms,color 120ms; }
        .cn-icn:hover { background:var(--paper-2); color:var(--ink); }
        .cn-icn.del:hover { background:#FEF2F2; color:#DC2626; }
      `}</style>

      {/* Cabecera */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:40, height:40, borderRadius:10, background:'var(--navy)', display:'grid', placeItems:'center', flexShrink:0 }}>
            <i className="fa fa-industry" style={{ color:'rgba(255,255,255,.85)', fontSize:16 }} />
          </div>
          <div>
            <h2 style={{ margin:0, fontSize:19, fontWeight:700, color:'var(--ink)', letterSpacing:'-0.01em' }}>Centros de producción</h2>
            <p style={{ margin:'2px 0 0', fontSize:12.5, color:'var(--ink-4)' }}>Plantas y sedes donde se ejecutan los procesos de manufactura</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={openCrear} style={{ flexShrink:0 }}>
          <i className="fa fa-plus" /> Nuevo centro
        </button>
      </div>

      {/* Grid de tarjetas */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(270px,1fr))', gap:14 }}>
        {centros.map(c => {
          const uso = usageCount(c.id)
          return (
            <div key={c.id} className="cn-card">
              {/* Franja superior */}
              <div style={{ height:5, background:'var(--navy)' }} />

              {/* Cuerpo */}
              <div style={{ padding:'16px 18px 10px', flex:1 }}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:8 }}>
                  <div style={{ width:38, height:38, borderRadius:10, background:'#EEF2FF', display:'grid', placeItems:'center', flexShrink:0 }}>
                    <i className="fa fa-building" style={{ color:'#4F46E5', fontSize:15 }} />
                  </div>
                  <div style={{ minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:7, flexWrap:'wrap' }}>
                      <span style={{ fontSize:14.5, fontWeight:700, color:'var(--ink)', lineHeight:1.2 }}>{c.descripcion}</span>
                      <span style={{ fontFamily:'var(--f-mono)', fontSize:10.5, fontWeight:700, color:'#4F46E5', background:'#EEF2FF', padding:'1px 7px', borderRadius:4 }}>{c.codigo}</span>
                    </div>
                    {c.direccion && (
                      <div style={{ marginTop:4, fontSize:12, color:'var(--ink-4)', display:'flex', alignItems:'center', gap:5, lineHeight:1.3 }}>
                        <i className="fa fa-map-marker-alt" style={{ fontSize:10, flexShrink:0 }} />
                        {c.direccion}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Pie */}
              <div style={{ padding:'8px 14px', borderTop:'1px solid var(--hair)', display:'flex', alignItems:'center', justifyContent:'space-between', background:'var(--paper-2)' }}>
                <span style={{ fontSize:11.5, color:'var(--ink-4)', fontFamily:'var(--f-mono)', display:'flex', alignItems:'center', gap:5 }}>
                  {uso > 0
                    ? <><i className="fa fa-file-alt" style={{ color:'#4F46E5' }} />{uso} batch record{uso !== 1 ? 's' : ''}</>
                    : <span style={{ opacity:0.55 }}>Sin registros asociados</span>}
                </span>
                <div style={{ display:'flex', gap:2 }}>
                  <button className="cn-icn" title="Editar" onClick={() => openEditar(c)}><i className="fa fa-pencil-alt" /></button>
                  <button className="cn-icn del" title="Eliminar" onClick={() => pedirEliminar(c)}><i className="fa fa-trash-alt" /></button>
                </div>
              </div>
            </div>
          )
        })}

        {/* Tarjeta fantasma */}
        <button onClick={openCrear} style={{
          background:'none', border:'2px dashed var(--hair-2)', borderRadius:'var(--r-md)',
          cursor:'pointer', padding:'28px 16px', display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'center', gap:8, color:'var(--ink-4)',
          transition:'border-color 150ms, color 150ms', minHeight:140,
        }}
          onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor='var(--navy)'; el.style.color='var(--navy)' }}
          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor='var(--hair-2)'; el.style.color='var(--ink-4)' }}
        >
          <i className="fa fa-plus-circle" style={{ fontSize:24 }} />
          <span style={{ fontSize:13, fontWeight:600 }}>Nuevo centro</span>
        </button>
      </div>

      {/* Modal crear / editar */}
      {modal && (
        <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(10,21,48,.45)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
          onClick={() => setModal(null)}>
          <div style={{ background:'var(--paper)', borderRadius:'var(--r-xl)', boxShadow:'var(--sh-3)', width:'100%', maxWidth:440 }}
            onClick={e => e.stopPropagation()}>

            {/* Header navy */}
            <div style={{ background:'var(--navy)', borderRadius:'var(--r-xl) var(--r-xl) 0 0', padding:'14px 22px', display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:34, height:34, borderRadius:10, background:'rgba(255,255,255,.12)', display:'grid', placeItems:'center', flexShrink:0 }}>
                <i className="fa fa-industry" style={{ color:'rgba(255,220,60,.9)', fontSize:15 }} />
              </div>
              <div style={{ flex:1 }}>
                <div style={{ color:'#fff', fontWeight:700, fontSize:14 }}>
                  {modal.mode === 'crear' ? 'Nuevo centro de producción' : 'Editar centro'}
                </div>
                <div style={{ color:'#8FA5C9', fontSize:11 }}>
                  {modal.mode === 'editar' ? `Editando: ${modal.item?.descripcion}` : 'Código, nombre y ubicación'}
                </div>
              </div>
              <button style={{ background:'rgba(255,255,255,.1)', border:'none', cursor:'pointer', color:'#fff', width:28, height:28, borderRadius:7, fontSize:16, display:'grid', placeItems:'center' }}
                onClick={() => setModal(null)}>×</button>
            </div>

            <div style={{ padding:'20px 22px', display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:12 }}>
                <div>
                  <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--ink-3)', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.04em' }}>
                    Código <span style={{ color:'var(--orange)' }}>*</span>
                  </label>
                  <input className="form-control" value={form.codigo} autoFocus
                    style={{ fontFamily:'var(--f-mono)', textTransform:'uppercase' }}
                    onChange={e => set('codigo', e.target.value)}
                    placeholder="C001" />
                </div>
                <div>
                  <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--ink-3)', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.04em' }}>
                    Nombre del centro <span style={{ color:'var(--orange)' }}>*</span>
                  </label>
                  <input className="form-control" value={form.descripcion}
                    onChange={e => set('descripcion', e.target.value)}
                    placeholder="Planta Bogotá" />
                </div>
              </div>
              <div>
                <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--ink-3)', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.04em' }}>
                  Dirección <span style={{ color:'var(--ink-4)', fontWeight:400, textTransform:'none', fontSize:11 }}>(opcional)</span>
                </label>
                <input className="form-control" value={form.direccion}
                  onChange={e => set('direccion', e.target.value)}
                  placeholder="Calle 13 # 37-29, Bogotá" />
              </div>
              {err && (
                <div style={{ padding:'8px 12px', background:'#FEF2F2', border:'1.5px solid #FECACA', borderRadius:'var(--r-sm)', fontSize:12.5, color:'#B91C1C', display:'flex', alignItems:'center', gap:7 }}>
                  <i className="fa fa-exclamation-circle" /> {err}
                </div>
              )}
            </div>

            <div style={{ padding:'14px 22px', borderTop:'1px solid var(--hair)', display:'flex', justifyContent:'flex-end', gap:8 }}>
              <button className="btn btn-gray" onClick={() => setModal(null)}><i className="fa fa-undo" /> Cancelar</button>
              <button className="btn btn-primary" onClick={guardar}><i className="fa fa-check" /> Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Advertencia eliminar con batch records asociados */}
      {warn && (
        <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(10,21,48,.45)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
          onClick={() => setWarn(null)}>
          <div style={{ background:'var(--paper)', borderRadius:'var(--r-xl)', boxShadow:'var(--sh-3)', width:'100%', maxWidth:400 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding:'22px 22px 14px', display:'flex', gap:14, alignItems:'flex-start' }}>
              <div style={{ width:40, height:40, borderRadius:10, background:'#FEF2F2', display:'grid', placeItems:'center', flexShrink:0 }}>
                <i className="fa fa-exclamation-triangle" style={{ color:'#DC2626', fontSize:18 }} />
              </div>
              <div>
                <div style={{ fontWeight:700, fontSize:14, color:'var(--ink)', marginBottom:6 }}>Centro con registros asociados</div>
                <div style={{ fontSize:13, color:'var(--ink-3)', lineHeight:1.5 }}>
                  <strong>{warn.descripcion}</strong> tiene {usageCount(warn.id)} batch record{usageCount(warn.id) !== 1 ? 's' : ''} asociado{usageCount(warn.id) !== 1 ? 's' : ''}.
                  Al eliminarlo, esos registros quedarán sin centro asignado.
                </div>
              </div>
            </div>
            <div style={{ padding:'14px 22px', borderTop:'1px solid var(--hair)', display:'flex', justifyContent:'flex-end', gap:8 }}>
              <button className="btn btn-gray" onClick={() => setWarn(null)}><i className="fa fa-undo" /> Cancelar</button>
              <button className="btn btn-danger" onClick={() => doEliminar(warn)}><i className="fa fa-trash-alt" /> Eliminar igual</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

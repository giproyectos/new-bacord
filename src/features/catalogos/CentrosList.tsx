import { useEffect, useState } from 'react'
import { centrosApi, type Centro } from '@/api/centros'
import { usePuedeEditar } from '@/hooks/usePermisos'

const EMPTY = { codigo: '', descripcion: '', direccion: '' }

export function CentrosList() {
  const puedeEditar = usePuedeEditar('centros')
  const [centros, setCentros] = useState<Centro[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState<{ mode: 'crear' | 'editar'; item?: Centro } | null>(null)
  const [form, setForm]       = useState(EMPTY)
  const [warn, setWarn]       = useState<Centro | null>(null)
  const [err, setErr]         = useState('')

  const cargar = () => centrosApi.listar().then(setCentros).finally(() => setLoading(false))
  useEffect(() => { cargar() }, [])

  const set = (k: keyof typeof EMPTY, v: string) => { setForm(f => ({ ...f, [k]: v })); setErr('') }

  const openCrear  = () => { setForm(EMPTY); setErr(''); setModal({ mode: 'crear' }) }
  const openEditar = (c: Centro) => {
    setForm({ codigo: c.codigo, descripcion: c.descripcion, direccion: c.direccion ?? '' })
    setErr(''); setModal({ mode: 'editar', item: c })
  }

  const guardar = async () => {
    if (!form.codigo.trim())      { setErr('El código es requerido'); return }
    if (!form.descripcion.trim()) { setErr('El nombre es requerido'); return }

    const data = { codigo: form.codigo.trim().toUpperCase(), descripcion: form.descripcion.trim(), direccion: form.direccion.trim() || undefined }
    const res = modal?.mode === 'crear'
      ? await centrosApi.crear(data)
      : await centrosApi.actualizar(modal!.item!.id, data)
    if (!res.estado) { setErr(res.mensaje); return }
    setModal(null)
    cargar()
  }

  const doEliminar = async (c: Centro) => {
    await centrosApi.eliminar(c.id)
    setWarn(null)
    cargar()
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-4)' }}><i className="fa fa-spinner fa-spin" /></div>

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
        {puedeEditar && (
          <button className="btn btn-primary" onClick={openCrear} style={{ flexShrink:0 }}>
            <i className="fa fa-plus" /> Nuevo centro
          </button>
        )}
      </div>

      {centros.length === 0 && (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
          Aún no hay centros configurados. Crea el primero.
        </div>
      )}

      {/* Grid de tarjetas */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(270px,1fr))', gap:14 }}>
        {centros.map(c => (
          <div key={c.id} className="cn-card">
            <div style={{ height:5, background:'var(--navy)' }} />
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
            {puedeEditar && (
              <div style={{ padding:'8px 14px', borderTop:'1px solid var(--hair)', display:'flex', alignItems:'center', justifyContent:'flex-end', background:'var(--paper-2)' }}>
                <div style={{ display:'flex', gap:2 }}>
                  <button className="cn-icn" title="Editar" onClick={() => openEditar(c)}><i className="fa fa-pencil-alt" /></button>
                  <button className="cn-icn del" title="Eliminar" onClick={() => setWarn(c)}><i className="fa fa-trash-alt" /></button>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Tarjeta fantasma */}
        {puedeEditar && <button onClick={openCrear} style={{
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
        </button>}
      </div>

      {/* Modal crear / editar */}
      {modal && (
        <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(10,21,48,.45)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
          onClick={() => setModal(null)}>
          <div style={{ background:'var(--paper)', borderRadius:'var(--r-xl)', boxShadow:'var(--sh-3)', width:'100%', maxWidth:440 }}
            onClick={e => e.stopPropagation()}>

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

      {/* Confirmar eliminar */}
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
                <div style={{ fontWeight:700, fontSize:14, color:'var(--ink)', marginBottom:6 }}>Desactivar centro</div>
                <div style={{ fontSize:13, color:'var(--ink-3)', lineHeight:1.5 }}>
                  ¿Desactivar <strong>{warn.descripcion}</strong>? Dejará de estar disponible para nuevos registros.
                </div>
              </div>
            </div>
            <div style={{ padding:'14px 22px', borderTop:'1px solid var(--hair)', display:'flex', justifyContent:'flex-end', gap:8 }}>
              <button className="btn btn-gray" onClick={() => setWarn(null)}><i className="fa fa-undo" /> Cancelar</button>
              <button className="btn btn-danger" onClick={() => doEliminar(warn)}><i className="fa fa-trash-alt" /> Desactivar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

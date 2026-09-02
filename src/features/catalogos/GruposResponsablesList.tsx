import { useEffect, useState } from 'react'
import { gruposResponsablesApi } from '@/api/gruposResponsables'
import { GRUPO_PALETTE, colorForKey } from '@/utils/colorPalette'
import { usePuedeEditar } from '@/hooks/usePermisos'
import type { GrupoResponsable } from '@/types'

const PALETTE_KEYS = Object.keys(GRUPO_PALETTE)

function DotColor({ colorKey, size = 12 }: { colorKey: string; size?: number }) {
  const c = colorForKey(colorKey)
  return <span style={{ display: 'inline-block', width: size, height: size, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
}

function ColorPicker({ value, onChange }: { value: string; onChange: (k: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {PALETTE_KEYS.map(k => {
        const c = GRUPO_PALETTE[k]
        const sel = value === k
        return (
          <button key={k} type="button" onClick={() => onChange(k)} title={k}
            style={{
              width: 28, height: 28, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: c.dot, position: 'relative', display: 'grid', placeItems: 'center',
              outline: sel ? `3px solid ${c.dot}` : '2px solid transparent',
              outlineOffset: sel ? 2 : 0,
              boxShadow: sel ? `0 0 0 4px ${c.bg}` : 'none',
              transition: 'outline 120ms, box-shadow 120ms',
            }}>
            {sel && <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>✓</span>}
          </button>
        )
      })}
    </div>
  )
}

const EMPTY = { nombre: '', descripcion: '', colorKey: 'blue' }

export function GruposResponsablesList() {
  const puedeEditar = usePuedeEditar('grupos-responsables')
  const [grupos, setGrupos] = useState<GrupoResponsable[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]   = useState<{ mode: 'crear' | 'editar'; item?: GrupoResponsable } | null>(null)
  const [form,  setForm]    = useState(EMPTY)
  const [warn,  setWarn]    = useState<GrupoResponsable | null>(null)
  const [err,   setErr]     = useState('')

  const cargar = () => gruposResponsablesApi.listar().then(setGrupos).finally(() => setLoading(false))
  useEffect(() => { cargar() }, [])

  const set = (k: keyof typeof EMPTY, v: string) => { setForm(f => ({ ...f, [k]: v })); setErr('') }

  const openCrear  = () => { setForm(EMPTY); setErr(''); setModal({ mode: 'crear' }) }
  const openEditar = (g: GrupoResponsable) => { setForm({ nombre: g.nombre, descripcion: g.descripcion, colorKey: g.colorKey }); setErr(''); setModal({ mode: 'editar', item: g }) }

  const guardar = async () => {
    if (!form.nombre.trim()) { setErr('El nombre es requerido'); return }
    const data = { nombre: form.nombre.trim(), descripcion: form.descripcion.trim(), colorKey: form.colorKey }
    const res = modal?.mode === 'crear'
      ? await gruposResponsablesApi.crear(data)
      : await gruposResponsablesApi.actualizar(modal!.item!.id, data)
    if (!res.estado) { setErr(res.mensaje); return }
    setModal(null)
    cargar()
  }

  const doEliminar = async (g: GrupoResponsable) => {
    await gruposResponsablesApi.eliminar(g.id)
    setWarn(null)
    cargar()
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-4)' }}><i className="fa fa-spinner fa-spin" /></div>

  return (
    <>
      <style>{`
        .gr-card { background:var(--paper);border-radius:var(--r-md);border:1.5px solid var(--hair-2);overflow:hidden;display:flex;flex-direction:column;transition:box-shadow 150ms,border-color 150ms; }
        .gr-card:hover { box-shadow:var(--sh-1);border-color:var(--hair); }
        .gr-icn { background:none;border:none;cursor:pointer;padding:4px 7px;border-radius:6px;color:var(--ink-4);font-size:13px;transition:background 120ms,color 120ms; }
        .gr-icn:hover { background:var(--paper-2);color:var(--ink); }
        .gr-icn.del:hover { background:#FEF2F2;color:#DC2626; }
      `}</style>

      {/* Cabecera */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h2 style={{ margin:0, fontSize:20, fontWeight:700, color:'var(--ink)' }}>Grupos Responsables</h2>
          <p style={{ margin:'4px 0 0', fontSize:13, color:'var(--ink-4)' }}>
            Define los grupos de tu organización. El color se propaga automáticamente a Firmas, Usuarios y Estrategias.
          </p>
        </div>
        {puedeEditar && (
          <button className="btn btn-primary" onClick={openCrear} style={{ flexShrink:0 }}>
            <i className="fa fa-plus" /> Nuevo grupo
          </button>
        )}
      </div>

      {grupos.length === 0 && (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
          Aún no hay grupos responsables configurados. Crea el primero.
        </div>
      )}

      {/* Grid de tarjetas */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(250px,1fr))', gap:14 }}>
        {grupos.map(g => {
          const c = colorForKey(g.colorKey)
          return (
            <div key={g.id} className="gr-card">
              <div style={{ height:5, background:c.dot }} />
              <div style={{ padding:'14px 16px 10px', flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
                  <DotColor colorKey={g.colorKey} size={13} />
                  <span style={{ fontSize:14.5, fontWeight:700, color:c.text }}>{g.nombre}</span>
                </div>
                <p style={{ margin:0, fontSize:12.5, color:'var(--ink-4)', lineHeight:1.4, minHeight:34 }}>
                  {g.descripcion || <em>Sin descripción</em>}
                </p>
              </div>
              {puedeEditar && (
                <div style={{ padding:'8px 14px', borderTop:'1px solid var(--hair)', display:'flex', alignItems:'center', justifyContent:'flex-end', background:'var(--paper-2)' }}>
                  <div style={{ display:'flex', gap:2 }}>
                    <button className="gr-icn" title="Editar" onClick={() => openEditar(g)}><i className="fa fa-pencil-alt" /></button>
                    <button className="gr-icn del" title="Eliminar" onClick={() => setWarn(g)}><i className="fa fa-trash-alt" /></button>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* Tarjeta fantasma */}
        {puedeEditar && <button onClick={openCrear} style={{
          background:'none', border:'2px dashed var(--hair-2)', borderRadius:'var(--r-md)',
          cursor:'pointer', padding:'28px 16px', display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'center', gap:8, color:'var(--ink-4)',
          transition:'border-color 150ms,color 150ms', minHeight:130,
        }}
          onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor='var(--navy)'; el.style.color='var(--navy)' }}
          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor='var(--hair-2)'; el.style.color='var(--ink-4)' }}>
          <i className="fa fa-plus-circle" style={{ fontSize:24 }} />
          <span style={{ fontSize:13, fontWeight:600 }}>Nuevo grupo</span>
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
                <i className="fa fa-users" style={{ color:'var(--yellow)', fontSize:15 }} />
              </div>
              <div style={{ flex:1 }}>
                <div style={{ color:'#fff', fontWeight:700, fontSize:14 }}>
                  {modal.mode === 'crear' ? 'Nuevo grupo responsable' : 'Editar grupo'}
                </div>
                <div style={{ color:'#8FA5C9', fontSize:11 }}>
                  {modal.mode === 'crear' ? 'Nombre, descripción y color identificador' : `Editando: ${modal.item?.nombre}`}
                </div>
              </div>
              <button style={{ background:'rgba(255,255,255,.1)', border:'none', cursor:'pointer', color:'#fff', width:28, height:28, borderRadius:7, fontSize:16, display:'grid', placeItems:'center' }}
                onClick={() => setModal(null)}>×</button>
            </div>

            <div style={{ padding:'20px 22px', display:'flex', flexDirection:'column', gap:16 }}>
              <div>
                <label style={{ display:'block', fontSize:12.5, fontWeight:600, color:'var(--ink-2)', marginBottom:5 }}>
                  Nombre del grupo <span style={{ color:'var(--orange)' }}>(requerido)</span>
                </label>
                <input className="form-control" value={form.nombre} autoFocus
                  onChange={e => set('nombre', e.target.value)}
                  placeholder="Ej: Producción, Garantía de Calidad, Microbiología..." />
              </div>
              <div>
                <label style={{ display:'block', fontSize:12.5, fontWeight:600, color:'var(--ink-2)', marginBottom:5 }}>
                  Descripción <span style={{ color:'var(--ink-4)', fontWeight:400 }}>(opcional)</span>
                </label>
                <input className="form-control" value={form.descripcion}
                  onChange={e => set('descripcion', e.target.value)}
                  placeholder="Ej: Operadores de planta de producción" />
              </div>
              <div>
                <label style={{ display:'block', fontSize:12.5, fontWeight:600, color:'var(--ink-2)', marginBottom:10 }}>
                  Color identificador
                </label>
                <ColorPicker value={form.colorKey} onChange={k => set('colorKey', k)} />
                <div style={{ marginTop:12, display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:11.5, color:'var(--ink-4)' }}>Vista previa:</span>
                  <span style={{
                    display:'inline-flex', alignItems:'center', gap:6, padding:'3px 11px',
                    borderRadius:20, fontSize:12.5, fontWeight:600,
                    background: colorForKey(form.colorKey).bg,
                    color: colorForKey(form.colorKey).text,
                  }}>
                    <DotColor colorKey={form.colorKey} size={8} />
                    {form.nombre || 'Nombre del grupo'}
                  </span>
                </div>
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
                <div style={{ fontWeight:700, fontSize:14, color:'var(--ink)', marginBottom:6 }}>
                  Desactivar grupo
                </div>
                <div style={{ fontSize:13, color:'var(--ink-3)', lineHeight:1.5 }}>
                  ¿Desactivar <strong>{warn.nombre}</strong>? Las firmas o usuarios que lo referencien quedarán sin ese grupo.
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

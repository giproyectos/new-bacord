import { useState } from 'react'
import { mockGruposResponsables, mockFirmas, GRUPO_PALETTE } from '@/api/mock'
import { GRUPOS } from '@/types'
import type { GrupoResponsable } from '@/types'

const PALETTE_KEYS = Object.keys(GRUPO_PALETTE)

// Cuántas firmas del catálogo referencian este grupo
function usageCount(nombre: string): number {
  const entry = Object.entries(GRUPOS).find(([, v]) => v === nombre)
  if (!entry) return 0
  return mockFirmas.filter(f => f.idGrupo === Number(entry[0])).length
}

function DotColor({ colorKey, size = 12 }: { colorKey: string; size?: number }) {
  const c = GRUPO_PALETTE[colorKey] ?? GRUPO_PALETTE['slate']
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
  const [grupos, setGrupos] = useState<GrupoResponsable[]>([...mockGruposResponsables])
  const [modal, setModal]   = useState<{ mode: 'crear' | 'editar'; item?: GrupoResponsable } | null>(null)
  const [form,  setForm]    = useState(EMPTY)
  const [warn,  setWarn]    = useState<GrupoResponsable | null>(null)
  const [err,   setErr]     = useState('')

  const set = (k: keyof typeof EMPTY, v: string) => { setForm(f => ({ ...f, [k]: v })); setErr('') }

  const openCrear  = () => { setForm(EMPTY); setErr(''); setModal({ mode: 'crear' }) }
  const openEditar = (g: GrupoResponsable) => { setForm({ nombre: g.nombre, descripcion: g.descripcion, colorKey: g.colorKey }); setErr(''); setModal({ mode: 'editar', item: g }) }

  const guardar = () => {
    if (!form.nombre.trim()) { setErr('El nombre es requerido'); return }
    const dup = grupos.some(g => g.nombre.toLowerCase() === form.nombre.trim().toLowerCase() && (modal?.mode === 'crear' || g.id !== modal?.item?.id))
    if (dup) { setErr('Ya existe un grupo con ese nombre'); return }
    if (modal?.mode === 'crear') {
      const nuevo: GrupoResponsable = { id: Math.max(0, ...grupos.map(g => g.id)) + 1, nombre: form.nombre.trim(), descripcion: form.descripcion.trim(), colorKey: form.colorKey }
      setGrupos(gs => [...gs, nuevo])
      mockGruposResponsables.push(nuevo)
    } else if (modal?.item) {
      const upd = { ...modal.item, nombre: form.nombre.trim(), descripcion: form.descripcion.trim(), colorKey: form.colorKey }
      setGrupos(gs => gs.map(g => g.id === upd.id ? upd : g))
      const i = mockGruposResponsables.findIndex(g => g.id === upd.id)
      if (i !== -1) mockGruposResponsables[i] = upd
    }
    setModal(null)
  }

  const pedirEliminar = (g: GrupoResponsable) => usageCount(g.nombre) > 0 ? setWarn(g) : doEliminar(g)
  const doEliminar    = (g: GrupoResponsable) => {
    setGrupos(gs => gs.filter(x => x.id !== g.id))
    const i = mockGruposResponsables.findIndex(x => x.id === g.id)
    if (i !== -1) mockGruposResponsables.splice(i, 1)
    setWarn(null)
  }

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
        <button className="btn btn-primary" onClick={openCrear} style={{ flexShrink:0 }}>
          <i className="fa fa-plus" /> Nuevo grupo
        </button>
      </div>

      {/* Grid de tarjetas */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(250px,1fr))', gap:14 }}>
        {grupos.map(g => {
          const c   = GRUPO_PALETTE[g.colorKey] ?? GRUPO_PALETTE['slate']
          const uso = usageCount(g.nombre)
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
              <div style={{ padding:'8px 14px', borderTop:'1px solid var(--hair)', display:'flex', alignItems:'center', justifyContent:'space-between', background:'var(--paper-2)' }}>
                <span style={{ fontSize:11.5, color:'var(--ink-4)', fontFamily:'var(--f-mono)' }}>
                  {uso > 0
                    ? <><i className="fa fa-pen" style={{ marginRight:4, color:c.dot }} />{uso} firma{uso !== 1 ? 's' : ''}</>
                    : <span style={{ opacity:0.55 }}>Sin firmas asociadas</span>}
                </span>
                <div style={{ display:'flex', gap:2 }}>
                  <button className="gr-icn" title="Editar" onClick={() => openEditar(g)}><i className="fa fa-pencil-alt" /></button>
                  <button className="gr-icn del" title="Eliminar" onClick={() => pedirEliminar(g)}><i className="fa fa-trash-alt" /></button>
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
          transition:'border-color 150ms,color 150ms', minHeight:130,
        }}
          onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor='var(--navy)'; el.style.color='var(--navy)' }}
          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor='var(--hair-2)'; el.style.color='var(--ink-4)' }}>
          <i className="fa fa-plus-circle" style={{ fontSize:24 }} />
          <span style={{ fontSize:13, fontWeight:600 }}>Nuevo grupo</span>
        </button>
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
                    background:(GRUPO_PALETTE[form.colorKey] ?? GRUPO_PALETTE['slate']).bg,
                    color:(GRUPO_PALETTE[form.colorKey] ?? GRUPO_PALETTE['slate']).text,
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

      {/* Advertencia eliminar con firmas */}
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
                  Grupo con firmas asociadas
                </div>
                <div style={{ fontSize:13, color:'var(--ink-3)', lineHeight:1.5 }}>
                  <strong>{warn.nombre}</strong> está asignado a {usageCount(warn.nombre)} firma{usageCount(warn.nombre) !== 1 ? 's' : ''} del catálogo.
                  Al eliminarlo, esas firmas quedarán sin grupo responsable.
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

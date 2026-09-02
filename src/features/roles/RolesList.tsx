import { useEffect, useState } from 'react'
import { rolesApi } from '@/api/roles'
import { MODULOS } from '@/constants/modulos'
import type { Rol } from '@/types'

type Nivel = 'ninguno' | 'ver' | 'editar'

const EMPTY = { nombre: '', descripcion: '', modulos: [] as string[], modulosEdicion: [] as string[] }

function nivelDe(form: { modulos: string[]; modulosEdicion: string[] }, clave: string): Nivel {
  if (form.modulosEdicion.includes(clave)) return 'editar'
  if (form.modulos.includes(clave)) return 'ver'
  return 'ninguno'
}

export function RolesList() {
  const [roles, setRoles]   = useState<Rol[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]   = useState<{ mode: 'crear' | 'editar'; item?: Rol } | null>(null)
  const [form, setForm]     = useState(EMPTY)
  const [warn, setWarn]     = useState<{ rol: Rol; accion: 'activar' | 'desactivar' } | null>(null)
  const [err, setErr]       = useState('')

  const cargar = () => rolesApi.listar().then(setRoles).finally(() => setLoading(false))
  useEffect(() => { cargar() }, [])

  const openCrear  = () => { setForm(EMPTY); setErr(''); setModal({ mode: 'crear' }) }
  const openEditar = (r: Rol) => { setForm({ nombre: r.nombre, descripcion: r.descripcion, modulos: [...r.modulos], modulosEdicion: [...r.modulosEdicion] }); setErr(''); setModal({ mode: 'editar', item: r }) }

  const setNivel = (clave: string, nivel: Nivel) => {
    setForm(f => ({
      ...f,
      modulos: nivel === 'ninguno' ? f.modulos.filter(m => m !== clave) : [...f.modulos.filter(m => m !== clave), clave],
      modulosEdicion: nivel === 'editar' ? [...f.modulosEdicion.filter(m => m !== clave), clave] : f.modulosEdicion.filter(m => m !== clave),
    }))
  }

  const guardar = async () => {
    if (!form.nombre.trim()) { setErr('El nombre es requerido'); return }
    const data = { nombre: form.nombre.trim(), descripcion: form.descripcion.trim(), modulos: form.modulos, modulosEdicion: form.modulosEdicion }
    const res = modal?.mode === 'crear'
      ? await rolesApi.crear(data)
      : await rolesApi.actualizar(modal!.item!.id, data)
    if (!res.estado) { setErr(res.mensaje); return }
    setModal(null)
    cargar()
  }

  const cambiarEstado = async () => {
    if (!warn) return
    if (warn.accion === 'desactivar') await rolesApi.eliminar(warn.rol.id)
    else await rolesApi.actualizar(warn.rol.id, { activo: true })
    setWarn(null)
    cargar()
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-4)' }}><i className="fa fa-spinner fa-spin" /></div>

  return (
    <>
      <style>{`
        .rl-card { background:var(--paper);border-radius:var(--r-md);border:1.5px solid var(--hair-2);overflow:hidden;display:flex;flex-direction:column;transition:box-shadow 150ms,border-color 150ms; }
        .rl-card:hover { box-shadow:var(--sh-1);border-color:var(--hair); }
        .rl-icn { background:none;border:none;cursor:pointer;padding:4px 7px;border-radius:6px;color:var(--ink-4);font-size:13px;transition:background 120ms,color 120ms; }
        .rl-icn:hover { background:var(--paper-2);color:var(--ink); }
        .rl-icn.del:hover { background:#FEF2F2;color:#DC2626; }
        .rl-mod-chip { display:inline-flex;align-items:center;gap:4px;padding:2px 9px;border-radius:20px;font-size:11px;font-weight:600;background:var(--paper-2);color:var(--ink-3); }
        .rl-mod-chip.editar { background:#EFF6FF;color:#1D4ED8; }
        .rl-perm-row { display:flex; align-items:center; gap:10px; padding:7px 4px; border-bottom:1px solid var(--hair); font-size:13px; }
        .rl-perm-row:last-child { border-bottom:none; }
        .rl-perm-label { flex:1; color:var(--ink-2); }
        .rl-perm-opts { display:flex; gap:12px; flex-shrink:0; }
        .rl-perm-opt { display:flex; align-items:center; gap:4px; font-size:11.5px; color:var(--ink-3); cursor:pointer; white-space:nowrap; }
      `}</style>

      {/* Cabecera */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h2 style={{ margin:0, fontSize:20, fontWeight:700, color:'var(--ink)' }}>Roles</h2>
          <p style={{ margin:'4px 0 0', fontSize:13, color:'var(--ink-4)' }}>
            Define qué módulos puede ver o editar cada rol. Se asigna un rol a cada usuario no administrador desde su ficha.
          </p>
        </div>
        <button className="btn btn-primary" onClick={openCrear} style={{ flexShrink:0 }}>
          <i className="fa fa-plus" /> Nuevo rol
        </button>
      </div>

      {roles.length === 0 && (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
          Aún no hay roles configurados. Crea el primero.
        </div>
      )}

      {/* Grid de tarjetas */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:14 }}>
        {roles.map(r => (
          <div key={r.id} className="rl-card">
            <div style={{ padding:'14px 16px 10px', flex:1 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
                <span style={{ fontSize:14.5, fontWeight:700, color:'var(--ink)' }}>{r.nombre}</span>
                {!r.activo && <span style={{ fontSize:10.5, fontWeight:700, color:'#991B1B', background:'#FEE2E2', padding:'1px 7px', borderRadius:20 }}>Inactivo</span>}
              </div>
              <p style={{ margin:'0 0 10px', fontSize:12.5, color:'var(--ink-4)', lineHeight:1.4, minHeight:18 }}>
                {r.descripcion || <em>Sin descripción</em>}
              </p>
              <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                {r.modulos.length === 0
                  ? <span style={{ fontSize:11.5, color:'var(--ink-4)' }}>Sin módulos asignados</span>
                  : r.modulos.map(m => {
                      const editar = r.modulosEdicion.includes(m)
                      return (
                        <span key={m} className={`rl-mod-chip${editar ? ' editar' : ''}`} title={editar ? 'Ver y editar' : 'Solo ver'}>
                          {editar && <i className="fa fa-pencil-alt" style={{ fontSize: 8.5 }} />}
                          {MODULOS.find(x => x.clave === m)?.label ?? m}
                        </span>
                      )
                    })}
              </div>
            </div>
            <div style={{ padding:'8px 14px', borderTop:'1px solid var(--hair)', display:'flex', alignItems:'center', justifyContent:'flex-end', background:'var(--paper-2)' }}>
              <div style={{ display:'flex', gap:2 }}>
                <button className="rl-icn" title="Editar" onClick={() => openEditar(r)}><i className="fa fa-pencil-alt" /></button>
                {r.activo ? (
                  <button className="rl-icn del" title="Desactivar" onClick={() => setWarn({ rol: r, accion: 'desactivar' })}><i className="fa fa-user-slash" /></button>
                ) : (
                  <button className="rl-icn" title="Activar" onClick={() => setWarn({ rol: r, accion: 'activar' })}><i className="fa fa-user-check" /></button>
                )}
              </div>
            </div>
          </div>
        ))}

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
          <span style={{ fontSize:13, fontWeight:600 }}>Nuevo rol</span>
        </button>
      </div>

      {/* Modal crear / editar */}
      {modal && (
        <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(10,21,48,.45)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
          onClick={() => setModal(null)}>
          <div style={{ background:'var(--paper)', borderRadius:'var(--r-xl)', boxShadow:'var(--sh-3)', width:'100%', maxWidth:520 }}
            onClick={e => e.stopPropagation()}>

            <div style={{ background:'var(--navy)', borderRadius:'var(--r-xl) var(--r-xl) 0 0', padding:'14px 22px', display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:34, height:34, borderRadius:10, background:'rgba(255,255,255,.12)', display:'grid', placeItems:'center', flexShrink:0 }}>
                <i className="fa fa-user-shield" style={{ color:'var(--yellow)', fontSize:15 }} />
              </div>
              <div style={{ flex:1 }}>
                <div style={{ color:'#fff', fontWeight:700, fontSize:14 }}>
                  {modal.mode === 'crear' ? 'Nuevo rol' : 'Editar rol'}
                </div>
                <div style={{ color:'#8FA5C9', fontSize:11 }}>
                  {modal.mode === 'crear' ? 'Nombre y permisos por módulo' : `Editando: ${modal.item?.nombre}`}
                </div>
              </div>
              <button style={{ background:'rgba(255,255,255,.1)', border:'none', cursor:'pointer', color:'#fff', width:28, height:28, borderRadius:7, fontSize:16, display:'grid', placeItems:'center' }}
                onClick={() => setModal(null)}>×</button>
            </div>

            <div style={{ padding:'20px 22px', display:'flex', flexDirection:'column', gap:16, maxHeight:'70vh', overflowY:'auto' }}>
              <div>
                <label style={{ display:'block', fontSize:12.5, fontWeight:600, color:'var(--ink-2)', marginBottom:5 }}>
                  Nombre del rol <span style={{ color:'var(--orange)' }}>(requerido)</span>
                </label>
                <input className="form-control" value={form.nombre} autoFocus
                  onChange={e => { setForm(f => ({ ...f, nombre: e.target.value })); setErr('') }}
                  placeholder="Ej: Operario de Producción, Analista de Calidad..." />
              </div>
              <div>
                <label style={{ display:'block', fontSize:12.5, fontWeight:600, color:'var(--ink-2)', marginBottom:5 }}>
                  Descripción <span style={{ color:'var(--ink-4)', fontWeight:400 }}>(opcional)</span>
                </label>
                <input className="form-control" value={form.descripcion}
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Ej: Ejecuta y firma pasos del batch record" />
              </div>
              <div>
                <label style={{ display:'block', fontSize:12.5, fontWeight:600, color:'var(--ink-2)', marginBottom:8 }}>
                  Permisos por módulo
                </label>
                <div style={{ border:'1.5px solid var(--hair-2)', borderRadius:'var(--r-sm)', padding:'2px 10px' }}>
                  {MODULOS.map(m => {
                    const nivel = nivelDe(form, m.clave)
                    return (
                      <div key={m.clave} className="rl-perm-row">
                        <span className="rl-perm-label">{m.label}</span>
                        <div className="rl-perm-opts">
                          {([
                            ['ninguno', 'Sin acceso'],
                            ['ver', 'Ver'],
                            ['editar', 'Ver y editar'],
                          ] as [Nivel, string][]).map(([val, label]) => (
                            <label key={val} className="rl-perm-opt">
                              <input type="radio" name={`nivel-${m.clave}`} checked={nivel === val} onChange={() => setNivel(m.clave, val)} />
                              {label}
                            </label>
                          ))}
                        </div>
                      </div>
                    )
                  })}
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

      {/* Confirmar activar / desactivar */}
      {warn && (
        <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(10,21,48,.45)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
          onClick={() => setWarn(null)}>
          <div style={{ background:'var(--paper)', borderRadius:'var(--r-xl)', boxShadow:'var(--sh-3)', width:'100%', maxWidth:400 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding:'22px 22px 14px', display:'flex', gap:14, alignItems:'flex-start' }}>
              <div style={{ width:40, height:40, borderRadius:10, background: warn.accion === 'desactivar' ? '#FEF2F2' : '#ECFDF5', display:'grid', placeItems:'center', flexShrink:0 }}>
                <i className={`fa ${warn.accion === 'desactivar' ? 'fa-exclamation-triangle' : 'fa-check-circle'}`} style={{ color: warn.accion === 'desactivar' ? '#DC2626' : '#059669', fontSize:18 }} />
              </div>
              <div>
                <div style={{ fontWeight:700, fontSize:14, color:'var(--ink)', marginBottom:6 }}>
                  {warn.accion === 'desactivar' ? 'Desactivar rol' : 'Activar rol'}
                </div>
                <div style={{ fontSize:13, color:'var(--ink-3)', lineHeight:1.5 }}>
                  {warn.accion === 'desactivar'
                    ? <>¿Desactivar <strong>{warn.rol.nombre}</strong>? Los usuarios que lo tengan asignado perderán acceso a sus módulos hasta que se les asigne otro rol activo.</>
                    : <>¿Reactivar <strong>{warn.rol.nombre}</strong>? Los usuarios que lo tengan asignado recuperarán acceso a sus módulos.</>}
                </div>
              </div>
            </div>
            <div style={{ padding:'14px 22px', borderTop:'1px solid var(--hair)', display:'flex', justifyContent:'flex-end', gap:8 }}>
              <button className="btn btn-gray" onClick={() => setWarn(null)}><i className="fa fa-undo" /> Cancelar</button>
              <button className={warn.accion === 'desactivar' ? 'btn btn-danger' : 'btn btn-primary'} onClick={cambiarEstado}>
                <i className={`fa ${warn.accion === 'desactivar' ? 'fa-user-slash' : 'fa-user-check'}`} /> {warn.accion === 'desactivar' ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

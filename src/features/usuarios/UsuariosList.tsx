import { useState, useMemo } from 'react'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { mockUsuarios, mockGruposResponsables, getGrupoColor } from '@/api/mock'
import type { Usuario } from '@/types'

const CENTROS: Record<number, string> = { 1: 'Planta Bogotá', 2: 'Planta Medellín' }

function GrupoChip({ nombre }: { nombre: string }) {
  if (!nombre) return <span style={{ color: 'var(--ink-4)', fontSize: 12 }}>—</span>
  const c = getGrupoColor(nombre)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 9px', borderRadius: 20,
      fontSize: 11.5, fontWeight: 600, background: c.bg, color: c.text,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
      {nombre}
    </span>
  )
}

const EMPTY_FORM = { NumeroIdentificacion: '', Email: '', Nombres: '', Apellidos: '', IdCentro: '1', IdGrupos: '' }

export function UsuariosList() {
  const [data, setData]               = useState<Usuario[]>(mockUsuarios)
  const [search, setSearch]           = useState('')
  const [filtroGrupo, setFiltroGrupo] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('0')
  const [modalCrear, setModalCrear]   = useState(false)
  const [editando, setEditando]       = useState<Usuario | null>(null)
  const [modalPerfiles, setModalPerfiles] = useState<Usuario | null>(null)
  const [form, setForm]               = useState(EMPTY_FORM)
  const [errors, setErrors]           = useState<Record<string, string>>({})

  const openCrear = () => {
    setForm(EMPTY_FORM); setEditando(null); setErrors({}); setModalCrear(true)
  }
  const openEditar = (r: Usuario) => {
    setForm({ NumeroIdentificacion: r.numeroIdentificacion, Email: r.email, Nombres: r.nombres, Apellidos: r.apellidos, IdCentro: String(r.idCentro), IdGrupos: r.idGrupos ?? '' })
    setEditando(r); setErrors({}); setModalCrear(true)
  }

  const handleGuardar = () => {
    const errs: Record<string, string> = {}
    if (!form.NumeroIdentificacion.trim()) errs.NumeroIdentificacion = 'Requerido'
    if (!form.Nombres.trim()) errs.Nombres = 'Requerido'
    if (!form.Email.trim()) {
      errs.Email = 'Requerido'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.Email.trim())) {
      errs.Email = 'Correo electrónico inválido'
    } else {
      const dup = data.find(u => u.email.toLowerCase() === form.Email.trim().toLowerCase() && u.idUsuario !== editando?.idUsuario)
      if (dup) errs.Email = 'Ya existe un usuario con este correo'
    }
    if (Object.keys(errs).length) { setErrors(errs); return }

    const grupoNombre = mockGruposResponsables.find(g => String(g.id) === form.IdGrupos)?.nombre ?? ''

    if (editando) {
      setData(d => d.map(u => u.idUsuario === editando.idUsuario
        ? { ...u, numeroIdentificacion: form.NumeroIdentificacion.trim(), email: form.Email.trim(), nombres: form.Nombres.trim(), apellidos: form.Apellidos.trim(), idCentro: Number(form.IdCentro) || 1, idGrupos: form.IdGrupos, grupos: grupoNombre }
        : u
      ))
    } else {
      const newId = Math.max(0, ...data.map(u => u.idUsuario)) + 1
      setData(d => [...d, {
        idUsuario: newId,
        numeroIdentificacion: form.NumeroIdentificacion.trim(),
        nombres: form.Nombres.trim(), apellidos: form.Apellidos.trim(),
        login: form.Email.split('@')[0],
        email: form.Email.trim(),
        activo: 1, idCentro: Number(form.IdCentro) || 1,
        esAdministrador: 0, bloqueado: 0, intentosFallidos: 0,
        idGrupos: form.IdGrupos, grupos: grupoNombre,
        fechaCreacion: new Date().toISOString().slice(0, 10),
      }])
    }
    setModalCrear(false); setEditando(null)
  }

  const filtered = useMemo(() => {
    return data.filter(u => {
      const q = search.toLowerCase()
      if (q && !`${u.nombres} ${u.apellidos} ${u.email} ${u.numeroIdentificacion}`.toLowerCase().includes(q)) return false
      if (filtroGrupo && u.idGrupos !== filtroGrupo) return false
      if (filtroEstado === '1' && !u.activo) return false
      if (filtroEstado === '2' && u.activo) return false
      return true
    })
  }, [data, search, filtroGrupo, filtroEstado])

  const columns: Column<Usuario>[] = [
    { key: 'numeroIdentificacion', header: 'Documento', width: '12%', sortable: true },
    { key: 'nombres',              header: 'Nombres',   width: '18%', sortable: true },
    { key: 'apellidos',            header: 'Apellidos', width: '18%', sortable: true },
    { key: 'email',                header: 'Email',                   sortable: true },
    { key: 'grupos',               header: 'Grupo',     width: '14%', render: r => <GrupoChip nombre={r.grupos} /> },
    { key: 'activo',               header: 'Estado',    width: '8%',
      render: r => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: r.activo ? '#065F46' : 'var(--ink-4)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: r.activo ? '#10B981' : 'var(--hair-2)', flexShrink: 0 }} />
          {r.activo ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
    {
      key: '__acc', header: '', width: '7%', align: 'center',
      render: r => (
        <div className="dt-act">
          <button className="dt-ab dt-ab-edit" title="Editar" onClick={() => openEditar(r)}><i className="fa fa-pencil-alt" /></button>
          <button className="dt-ab dt-ab-extra" title="Administrar perfiles" onClick={() => setModalPerfiles(r)}><i className="fa fa-cogs" /></button>
        </div>
      ),
    },
  ]

  const limpiarFiltros = () => { setSearch(''); setFiltroGrupo(''); setFiltroEstado('0') }
  const hayFiltros = search || filtroGrupo || filtroEstado !== '0'

  return (
    <>
      <style>{`
        .ul-hdr { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:20px; gap:16px; }
        .ul-hdr-icon { width:40px; height:40px; border-radius:10px; background:var(--navy); display:grid; place-items:center; flex-shrink:0; }
        .ul-hdr-icon i { color:rgba(255,255,255,.85); font-size:16px; }
        .ul-hdr-title { font-size:19px; font-weight:700; color:var(--ink); margin:0; letter-spacing:-0.01em; }
        .ul-hdr-desc  { font-size:12.5px; color:var(--ink-4); margin:2px 0 0; }

        .ul-card { background:#fff; border-radius:var(--r-md); border:1.5px solid var(--hair-2); box-shadow:0 1px 4px rgba(0,0,0,0.04); overflow:hidden; }
        .ul-filters { display:flex; align-items:center; gap:10px; padding:12px 16px; border-bottom:1.5px solid var(--hair-2); background:#FAFBFC; flex-wrap:wrap; }
        .ul-search-wrap { position:relative; flex:1; min-width:200px; max-width:300px; }
        .ul-search-ico  { position:absolute; left:10px; top:50%; transform:translateY(-50%); color:var(--ink-4); font-size:12px; pointer-events:none; }
        .ul-search { width:100%; padding:7px 10px 7px 30px; border:1.5px solid var(--hair-2); border-radius:var(--r-sm); font-size:13px; font-family:var(--f-sans); color:var(--ink); outline:none; background:#fff; transition:border-color 120ms; }
        .ul-search:focus { border-color:var(--navy); }
        .ul-sel { padding:7px 10px; border:1.5px solid var(--hair-2); border-radius:var(--r-sm); font-size:13px; font-family:var(--f-sans); color:var(--ink); outline:none; background:#fff; cursor:pointer; transition:border-color 120ms; }
        .ul-sel:focus { border-color:var(--navy); }
        .ul-count { font-size:12px; color:var(--ink-4); margin-left:auto; white-space:nowrap; }
        .ul-table-body { padding:0 16px 14px; }

        .ul-field label { display:block; font-size:12px; font-weight:600; color:var(--ink-3); margin-bottom:5px; text-transform:uppercase; letter-spacing:0.04em; }
        .ul-field input, .ul-field select { width:100%; padding:8px 12px; border:1.5px solid var(--hair-2); border-radius:var(--r-sm); font-size:13.5px; font-family:var(--f-sans); color:var(--ink); outline:none; background:#fff; transition:border-color 120ms; }
        .ul-field input:focus, .ul-field select:focus { border-color:var(--navy); }
        .ul-field.has-err input, .ul-field.has-err select { border-color:#FCA5A5; background:#FFF5F5; }
        .ul-field-err { font-size:11.5px; color:#DC2626; margin-top:4px; display:flex; align-items:center; gap:4px; }
        .ul-grid2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; }

        .ul-mo   { position:fixed; inset:0; z-index:200; background:rgba(10,21,48,.45); display:flex; align-items:center; justify-content:center; padding:20px; }
        .ul-mbox { background:var(--paper); border-radius:var(--r-xl); box-shadow:var(--sh-3); width:100%; max-width:560px; }
        .ul-mhdr { background:var(--navy); border-radius:var(--r-xl) var(--r-xl) 0 0; padding:14px 20px; display:flex; align-items:center; gap:10px; }
        .ul-mhdr-icon { width:34px; height:34px; border-radius:9px; background:rgba(255,255,255,.12); display:grid; place-items:center; flex-shrink:0; }
        .ul-mhdr-icon i { color:rgba(255,220,60,.9); font-size:14px; }
        .ul-mhdr-title { color:#fff; font-weight:700; font-size:14px; }
        .ul-mhdr-sub   { color:#8FA5C9; font-size:11px; margin-top:1px; }
        .ul-mhdr-close { margin-left:auto; background:rgba(255,255,255,.1); border:none; cursor:pointer; color:#fff; width:28px; height:28px; border-radius:7px; font-size:16px; display:grid; place-items:center; }
        .ul-mhdr-close:hover { background:rgba(255,255,255,.2); }
        .ul-mbody { padding:20px 22px; display:flex; flex-direction:column; gap:14px; }
        .ul-mfoot { padding:14px 22px; border-top:1px solid var(--hair); display:flex; justify-content:flex-end; gap:8px; }

        .ul-perf-row { display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid var(--hair); font-size:13.5px; color:var(--ink-2); cursor:pointer; }
        .ul-perf-row:last-child { border-bottom:none; }
      `}</style>

      {/* Cabecera */}
      <div className="ul-hdr">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="ul-hdr-icon"><i className="fa fa-users" /></div>
          <div>
            <h2 className="ul-hdr-title">Usuarios</h2>
            <p className="ul-hdr-desc">Gestión de cuentas de usuario y asignación de grupos</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={openCrear} style={{ flexShrink: 0 }}>
          <i className="fa fa-plus" /> Nuevo usuario
        </button>
      </div>

      {/* Tabla */}
      <div className="ul-card">
        <div className="ul-filters">
          <div className="ul-search-wrap">
            <i className="fa fa-search ul-search-ico" />
            <input className="ul-search" placeholder="Buscar por nombre, email, documento..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="ul-sel" value={filtroGrupo} onChange={e => setFiltroGrupo(e.target.value)}>
            <option value="">Todos los grupos</option>
            {mockGruposResponsables.map(g => <option key={g.id} value={String(g.id)}>{g.nombre}</option>)}
          </select>
          <select className="ul-sel" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
            <option value="0">Todos los estados</option>
            <option value="1">Activos</option>
            <option value="2">Inactivos</option>
          </select>
          {hayFiltros && (
            <button onClick={limpiarFiltros} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-4)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
              <i className="fa fa-times" /> Limpiar
            </button>
          )}
          <span className="ul-count">
            {filtered.length !== data.length ? `${filtered.length} de ${data.length}` : `${data.length} total`}
          </span>
        </div>
        <div className="ul-table-body">
          <DataTable<Usuario> columns={columns} data={filtered} emptyMessage="No hay usuarios que coincidan con los filtros" />
        </div>
      </div>

      {/* Modal crear / editar */}
      {modalCrear && (
        <div className="ul-mo" onClick={() => { setModalCrear(false); setEditando(null) }}>
          <div className="ul-mbox" onClick={e => e.stopPropagation()}>
            <div className="ul-mhdr">
              <div className="ul-mhdr-icon"><i className="fa fa-user" /></div>
              <div>
                <div className="ul-mhdr-title">{editando ? 'Editar usuario' : 'Nuevo usuario'}</div>
                <div className="ul-mhdr-sub">{editando ? `Editando: ${editando.nombres} ${editando.apellidos}` : 'Completar los datos del nuevo usuario'}</div>
              </div>
              <button className="ul-mhdr-close" onClick={() => { setModalCrear(false); setEditando(null) }}>×</button>
            </div>
            <div className="ul-mbody">
              <div className="ul-grid2">
                {([
                  { key: 'Nombres',              label: 'Nombres',   req: true },
                  { key: 'Apellidos',            label: 'Apellidos', req: true },
                  { key: 'NumeroIdentificacion', label: 'N° Documento', req: true },
                  { key: 'Email',                label: 'Email',     req: true },
                ] as { key: string; label: string; req: boolean }[]).map(f => (
                  <div key={f.key} className={`ul-field${errors[f.key] ? ' has-err' : ''}`}>
                    <label>{f.label}{f.req && <span style={{ color: 'var(--orange)', marginLeft: 3 }}>*</span>}</label>
                    <input
                      value={form[f.key as keyof typeof form]}
                      onChange={e => { setForm(v => ({ ...v, [f.key]: e.target.value })); setErrors(err => ({ ...err, [f.key]: '' })) }}
                    />
                    {errors[f.key] && <div className="ul-field-err"><i className="fa fa-exclamation-circle" />{errors[f.key]}</div>}
                  </div>
                ))}
              </div>
              <div className="ul-grid2">
                <div className="ul-field">
                  <label>Centro</label>
                  <select value={form.IdCentro} onChange={e => setForm(v => ({ ...v, IdCentro: e.target.value }))}>
                    {Object.entries(CENTROS).map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
                  </select>
                </div>
                <div className="ul-field">
                  <label>Grupo responsable</label>
                  <select value={form.IdGrupos} onChange={e => setForm(v => ({ ...v, IdGrupos: e.target.value }))}>
                    <option value="">— Sin grupo —</option>
                    {mockGruposResponsables.map(g => <option key={g.id} value={String(g.id)}>{g.nombre}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="ul-mfoot">
              <button className="btn btn-gray" onClick={() => { setModalCrear(false); setEditando(null) }}><i className="fa fa-undo" /> Cancelar</button>
              <button className="btn btn-primary" onClick={handleGuardar}><i className="fa fa-check" /> {editando ? 'Guardar cambios' : 'Crear usuario'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal perfiles */}
      {modalPerfiles && (
        <div className="ul-mo" onClick={() => setModalPerfiles(null)}>
          <div className="ul-mbox" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="ul-mhdr">
              <div className="ul-mhdr-icon"><i className="fa fa-cogs" /></div>
              <div>
                <div className="ul-mhdr-title">Perfiles asignados</div>
                <div className="ul-mhdr-sub">{modalPerfiles.nombres} {modalPerfiles.apellidos}</div>
              </div>
              <button className="ul-mhdr-close" onClick={() => setModalPerfiles(null)}>×</button>
            </div>
            <div className="ul-mbody" style={{ gap: 0 }}>
              {['Administrador', 'Operador', 'Calidad', 'Supervisor', 'BatchRecord'].map(rol => (
                <label key={rol} className="ul-perf-row">
                  <input type="checkbox" defaultChecked={rol === 'Administrador' && modalPerfiles.email.includes('admin')} />
                  {rol}
                </label>
              ))}
            </div>
            <div className="ul-mfoot">
              <button className="btn btn-gray" onClick={() => setModalPerfiles(null)}><i className="fa fa-undo" /> Cancelar</button>
              <button className="btn btn-primary" onClick={() => setModalPerfiles(null)}><i className="fa fa-check" /> Guardar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

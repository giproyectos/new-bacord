import { useEffect, useMemo, useState } from 'react'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { usuariosApi } from '@/api/usuarios'
import { gruposResponsablesApi } from '@/api/gruposResponsables'
import { centrosApi, type Centro } from '@/api/centros'
import { rolesApi } from '@/api/roles'
import { authApi } from '@/api/auth'
import { colorForKey } from '@/utils/colorPalette'
import type { Usuario, GrupoResponsable, Rol } from '@/types'

function GrupoChip({ nombre, grupos }: { nombre: string; grupos: GrupoResponsable[] }) {
  if (!nombre) return <span style={{ color: 'var(--ink-4)', fontSize: 12 }}>—</span>
  const g = grupos.find(x => x.nombre === nombre)
  const c = colorForKey(g?.colorKey)
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

const EMPTY_FORM = {
  NumeroIdentificacion: '', Email: '', Login: '', Nombres: '', Apellidos: '', IdCentro: '', IdGrupo: '', IdRol: '',
  FechaCaducidad: '', EsAdministrador: false, LoginLocalDeshabilitado: false,
}

export function UsuariosList() {
  const [data, setData]               = useState<Usuario[]>([])
  const [grupos, setGrupos]           = useState<GrupoResponsable[]>([])
  const [centros, setCentros]         = useState<Centro[]>([])
  const [roles, setRoles]             = useState<Rol[]>([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [filtroGrupo, setFiltroGrupo] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('0')
  const [modalCrear, setModalCrear]   = useState(false)
  const [editando, setEditando]       = useState<Usuario | null>(null)
  const [form, setForm]               = useState(EMPTY_FORM)
  const [errors, setErrors]           = useState<Record<string, string>>({})
  const [aviso, setAviso]             = useState('')
  const [oidc, setOidc]               = useState<{ oidcEnabled: boolean; oidcLabel: string } | null>(null)

  const cargar = () => Promise.all([usuariosApi.listar(), gruposResponsablesApi.listar(), centrosApi.listar(), rolesApi.listar()]).then(([us, gs, cs, rs]) => {
    setData(us); setGrupos(gs); setCentros(cs); setRoles(rs)
  }).finally(() => setLoading(false))
  useEffect(() => {
    cargar()
    authApi.config().then(setOidc).catch(() => setOidc({ oidcEnabled: false, oidcLabel: '' }))
  }, [])

  const openCrear = () => {
    setForm({ ...EMPTY_FORM, IdCentro: centros[0] ? String(centros[0].id) : '' }); setEditando(null); setErrors({}); setModalCrear(true)
  }
  const openEditar = (r: Usuario) => {
    setForm({
      NumeroIdentificacion: r.numeroIdentificacion, Email: r.email, Login: r.login,
      Nombres: r.nombres, Apellidos: r.apellidos, IdCentro: String(r.idCentro),
      IdGrupo: (r.idGrupos ?? '').split(',')[0] ?? '', IdRol: r.idRol ? String(r.idRol) : '',
      FechaCaducidad: r.fechaCaducidad ? r.fechaCaducidad.slice(0, 10) : '',
      EsAdministrador: r.esAdministrador === 1,
      LoginLocalDeshabilitado: r.loginLocalDeshabilitado,
    })
    setEditando(r); setErrors({}); setModalCrear(true)
  }

  const handleGuardar = async () => {
    const errs: Record<string, string> = {}
    if (!form.NumeroIdentificacion.trim()) errs.NumeroIdentificacion = 'Requerido'
    if (!form.Nombres.trim()) errs.Nombres = 'Requerido'
    if (!form.Login.trim()) errs.Login = 'Requerido'
    if (!form.Email.trim()) {
      errs.Email = 'Requerido'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.Email.trim())) {
      errs.Email = 'Correo electrónico inválido'
    }
    if (!form.IdCentro) errs.IdCentro = 'Seleccione un centro'
    if (!form.EsAdministrador && !form.IdRol) errs.IdRol = 'Seleccione un rol, o marque Administrador'
    if (Object.keys(errs).length) { setErrors(errs); return }

    const idGrupos = form.IdGrupo ? [Number(form.IdGrupo)] : []
    const idRol = form.EsAdministrador ? null : (form.IdRol ? Number(form.IdRol) : null)
    const payload = {
      numeroIdentificacion: form.NumeroIdentificacion.trim(), email: form.Email.trim(), login: form.Login.trim(),
      nombres: form.Nombres.trim(), apellidos: form.Apellidos.trim(), idCentro: Number(form.IdCentro),
      idGrupos, idRol, esAdministrador: form.EsAdministrador,
      fechaCaducidad: form.FechaCaducidad || null,
      loginLocalDeshabilitado: form.LoginLocalDeshabilitado,
    }
    const res = editando
      ? await usuariosApi.actualizar(editando.idUsuario, payload)
      : await usuariosApi.crear(payload)
    if (!res.estado) { setErrors({ Email: res.mensaje }); return }
    setModalCrear(false); setEditando(null)
    setAviso(editando ? 'Usuario actualizado.' : 'Usuario creado — se envió un correo de invitación para que defina su contraseña.')
    cargar()
  }

  const desbloquear = async (u: Usuario) => { await usuariosApi.desbloquear(u.idUsuario); cargar() }
  const toggleActivo = async (u: Usuario) => {
    await usuariosApi.actualizar(u.idUsuario, { activo: !u.activo })
    cargar()
  }
  const reenviarInvitacion = async (u: Usuario) => {
    const res = await usuariosApi.reenviarInvitacion(u.idUsuario)
    setAviso(res.mensaje)
    cargar()
  }
  const reiniciarPin = async (u: Usuario) => {
    const res = await usuariosApi.resetPin(u.idUsuario)
    setAviso(res.mensaje)
    cargar()
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
    { key: 'numeroIdentificacion', header: 'Documento', width: '10%', sortable: true },
    { key: 'nombres',              header: 'Nombres',   width: '13%', sortable: true },
    { key: 'apellidos',            header: 'Apellidos', width: '13%', sortable: true },
    { key: 'email',                header: 'Email',                   sortable: true },
    { key: 'grupos',               header: 'Grupo',     width: '11%', render: r => <GrupoChip nombre={r.grupos} grupos={grupos} /> },
    { key: 'rolNombre',            header: 'Rol',       width: '11%', render: r => r.esAdministrador ? <em style={{ color: 'var(--ink-4)', fontSize: 12 }}>Administrador</em> : (r.rolNombre || <span style={{ color: 'var(--ink-4)', fontSize: 12 }}>—</span>) },
    { key: 'fechaCaducidad',       header: 'Caduca',    width: '9%',
      render: r => r.fechaCaducidad ? <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{r.fechaCaducidad.slice(0, 10)}</span> : <span style={{ color: 'var(--ink-4)', fontSize: 12 }}>—</span> },
    { key: 'activo',               header: 'Estado',    width: '12%',
      render: r => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: r.activo ? '#065F46' : 'var(--ink-4)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: r.activo ? '#10B981' : 'var(--hair-2)', flexShrink: 0 }} />
          {r.activo ? 'Activo' : 'Inactivo'}
          {!!r.bloqueado && <span style={{ marginLeft: 4, color: '#DC2626' }} title="Usuario bloqueado por intentos fallidos"><i className="fa fa-lock" /></span>}
          {r.activacionPendiente && <span style={{ marginLeft: 4, color: '#D97706' }} title="Aún no ha activado su cuenta"><i className="fa fa-hourglass-half" /></span>}
          {r.pinBloqueado && <span style={{ marginLeft: 4, color: '#DC2626' }} title="PIN de firma bloqueado por intentos fallidos"><i className="fa fa-key" /></span>}
          {!r.activacionPendiente && !r.pinConfigurado && <span style={{ marginLeft: 4, color: '#D97706' }} title="Aún no ha configurado su PIN de firma"><i className="fa fa-key" /></span>}
          {r.loginLocalDeshabilitado && <span style={{ marginLeft: 4, color: 'var(--navy)' }} title="Solo puede entrar con su cuenta corporativa (SSO)"><i className="fa fa-building" /></span>}
        </span>
      ),
    },
    {
      key: '__acc', header: '', width: '14%', align: 'center',
      render: r => (
        <div className="dt-act">
          <button className="dt-ab dt-ab-edit" title="Editar" onClick={() => openEditar(r)}><i className="fa fa-pencil-alt" /></button>
          {!!r.bloqueado && (
            <button className="dt-ab dt-ab-extra" title="Desbloquear" onClick={() => desbloquear(r)}><i className="fa fa-unlock" /></button>
          )}
          {(r.pinConfigurado || r.pinBloqueado) && (
            <button className="dt-ab dt-ab-extra" title="Reiniciar PIN de firma" onClick={() => reiniciarPin(r)}><i className="fa fa-key" /></button>
          )}
          {!r.loginLocalDeshabilitado && (
            <button
              className="dt-ab dt-ab-extra"
              title={r.activacionPendiente ? 'Reenviar invitación' : 'Enviar enlace para restablecer contraseña'}
              onClick={() => reenviarInvitacion(r)}
            >
              <i className="fa fa-envelope" />
            </button>
          )}
          <button
            className={`dt-ab ${r.activo ? 'dt-ab-del' : 'dt-ab-extra'}`}
            title={r.activo ? 'Desactivar usuario' : 'Activar usuario'}
            onClick={() => toggleActivo(r)}
          >
            <i className={`fa ${r.activo ? 'fa-user-slash' : 'fa-user-check'}`} />
          </button>
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
        <button className="btn btn-primary" onClick={openCrear} style={{ flexShrink: 0 }} disabled={centros.length === 0}>
          <i className="fa fa-plus" /> Nuevo usuario
        </button>
      </div>

      {centros.length === 0 && !loading && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: '#FFFBEB', border: '1.5px solid #FCD34D', borderRadius: 'var(--r-sm)', fontSize: 12.5, color: '#92400E' }}>
          <i className="fa fa-exclamation-triangle" style={{ marginRight: 6 }} />
          Primero crea un centro en el catálogo de Centros — cada usuario debe pertenecer a uno.
        </div>
      )}

      {aviso && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: '#ECFDF5', border: '1.5px solid #A7F3D0', borderRadius: 'var(--r-sm)', fontSize: 12.5, color: '#065F46', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span><i className="fa fa-check-circle" style={{ marginRight: 6 }} />{aviso}</span>
          <button onClick={() => setAviso('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#065F46' }}>×</button>
        </div>
      )}

      {/* Tabla */}
      <div className="ul-card">
        <div className="ul-filters">
          <div className="ul-search-wrap">
            <i className="fa fa-search ul-search-ico" />
            <input className="ul-search" placeholder="Buscar por nombre, email, documento..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="ul-sel" value={filtroGrupo} onChange={e => setFiltroGrupo(e.target.value)}>
            <option value="">Todos los grupos</option>
            {grupos.map(g => <option key={g.id} value={String(g.id)}>{g.nombre}</option>)}
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
          <DataTable<Usuario> columns={columns} data={filtered} loading={loading} emptyMessage="No hay usuarios que coincidan con los filtros" />
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
              {!editando && (
                <div style={{ padding: '8px 12px', background: '#EFF6FF', border: '1.5px solid #BFDBFE', borderRadius: 'var(--r-sm)', fontSize: 12, color: '#1D4ED8' }}>
                  <i className="fa fa-info-circle" style={{ marginRight: 6 }} />
                  Se enviará un correo a este usuario para que defina su propia contraseña — no se establece aquí.
                </div>
              )}
              <div className="ul-grid2">
                {([
                  { key: 'Nombres',              label: 'Nombres' },
                  { key: 'Apellidos',            label: 'Apellidos' },
                  { key: 'NumeroIdentificacion', label: 'N° Documento' },
                  { key: 'Email',                label: 'Email' },
                  { key: 'Login',                label: 'Login' },
                ] as { key: string; label: string }[]).map(f => (
                  <div key={f.key} className={`ul-field${errors[f.key] ? ' has-err' : ''}`}>
                    <label>{f.label}<span style={{ color: 'var(--orange)', marginLeft: 3 }}>*</span></label>
                    <input
                      type="text"
                      value={form[f.key as keyof typeof form] as string}
                      onChange={e => { setForm(v => ({ ...v, [f.key]: e.target.value })); setErrors(err => ({ ...err, [f.key]: '' })) }}
                    />
                    {errors[f.key] && <div className="ul-field-err"><i className="fa fa-exclamation-circle" />{errors[f.key]}</div>}
                  </div>
                ))}
              </div>
              <div className="ul-grid2">
                <div className={`ul-field${errors.IdCentro ? ' has-err' : ''}`}>
                  <label>Centro <span style={{ color: 'var(--orange)' }}>*</span></label>
                  <select value={form.IdCentro} onChange={e => setForm(v => ({ ...v, IdCentro: e.target.value }))}>
                    <option value="">— Seleccione —</option>
                    {centros.map(c => <option key={c.id} value={String(c.id)}>{c.descripcion}</option>)}
                  </select>
                  {errors.IdCentro && <div className="ul-field-err"><i className="fa fa-exclamation-circle" />{errors.IdCentro}</div>}
                </div>
                <div className="ul-field">
                  <label>Grupo responsable</label>
                  <select value={form.IdGrupo} onChange={e => setForm(v => ({ ...v, IdGrupo: e.target.value }))}>
                    <option value="">— Sin grupo —</option>
                    {grupos.map(g => <option key={g.id} value={String(g.id)}>{g.nombre}</option>)}
                  </select>
                </div>
              </div>
              <div className="ul-grid2">
                {!form.EsAdministrador && (
                  <div className={`ul-field${errors.IdRol ? ' has-err' : ''}`}>
                    <label>Rol <span style={{ color: 'var(--orange)' }}>*</span></label>
                    <select value={form.IdRol} onChange={e => { setForm(v => ({ ...v, IdRol: e.target.value })); setErrors(err => ({ ...err, IdRol: '' })) }}>
                      <option value="">— Seleccione —</option>
                      {roles.map(r => <option key={r.id} value={String(r.id)}>{r.nombre}</option>)}
                    </select>
                    {errors.IdRol && <div className="ul-field-err"><i className="fa fa-exclamation-circle" />{errors.IdRol}</div>}
                  </div>
                )}
                <div className="ul-field">
                  <label>Fecha de caducidad <span style={{ color: 'var(--ink-4)', fontWeight: 400, textTransform: 'none' }}>(opcional)</span></label>
                  <input type="date" value={form.FechaCaducidad} onChange={e => setForm(v => ({ ...v, FechaCaducidad: e.target.value }))} />
                </div>
              </div>
              {!form.EsAdministrador && roles.length === 0 && (
                <div style={{ fontSize: 11.5, color: 'var(--ink-4)' }}>
                  Aún no hay roles creados — ve a Administración › Roles para crear uno primero, o marca este usuario como Administrador.
                </div>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-2)', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.EsAdministrador} onChange={e => setForm(v => ({ ...v, EsAdministrador: e.target.checked, IdRol: e.target.checked ? '' : v.IdRol }))} />
                Administrador del sistema (acceso total, sin restricción por rol)
              </label>
              {oidc?.oidcEnabled && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-2)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.LoginLocalDeshabilitado}
                    onChange={e => setForm(v => ({ ...v, LoginLocalDeshabilitado: e.target.checked }))} />
                  Solo puede entrar con {oidc.oidcLabel} (deshabilita su contraseña local, si tenía una)
                </label>
              )}
            </div>
            <div className="ul-mfoot">
              <button className="btn btn-gray" onClick={() => { setModalCrear(false); setEditando(null) }}><i className="fa fa-undo" /> Cancelar</button>
              <button className="btn btn-primary" onClick={handleGuardar}><i className="fa fa-check" /> {editando ? 'Guardar cambios' : 'Crear usuario'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

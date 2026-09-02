import { useState, useMemo } from 'react'
import { DataTable, type Column } from './DataTable'

interface Field {
  key: string
  label: string
  required?: boolean
  type?: 'text' | 'select'
  options?: { value: string; label: string }[]
  placeholder?: string
}

interface Props<T> {
  panelTitle: string
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  fields: Field[]
  canCreate?: boolean
  /** false esconde los botones de editar/eliminar por fila (para usuarios con permiso de solo lectura). */
  canEdit?: boolean
  onSave?: (values: Record<string, string>, isEdit: boolean) => void
  onDelete?: (row: T) => void
  extraActions?: (row: T) => React.ReactNode
  icon?: string
  description?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function CatalogPage<T = any>({
  panelTitle, columns, data, loading, fields,
  canCreate = true, canEdit = true, onSave, onDelete, extraActions,
  icon = 'fa-list-alt', description,
}: Props<T>) {
  type ModalMode = 'create' | 'edit' | 'delete' | null
  const [mode, setMode]       = useState<ModalMode>(null)
  const [values, setValues]   = useState<Record<string, string>>({})
  const [editRow, setEditRow] = useState<T | null>(null)
  const [errors, setErrors]   = useState<Record<string, string>>({})
  const [search, setSearch]   = useState('')

  const entity = panelTitle.replace(/^Lista de /i, '')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return data
    return data.filter(row =>
      Object.values(row as Record<string, unknown>).some(v =>
        String(v ?? '').toLowerCase().includes(q)
      )
    )
  }, [data, search])

  const openCreate = () => {
    setValues({})
    setEditRow(null)
    setErrors({})
    setMode('create')
  }

  const openEdit = (row: T) => {
    const extracted: Record<string, string> = {}
    const r = row as Record<string, unknown>
    for (const f of fields) {
      const v = r[f.key]
      extracted[f.key] = v !== undefined && v !== null ? String(v) : ''
    }
    setValues(extracted)
    setEditRow(row)
    setErrors({})
    setMode('edit')
  }

  const openDelete = (row: T) => {
    setEditRow(row)
    setMode('delete')
  }

  const handleSave = () => {
    const errs: Record<string, string> = {}
    for (const f of fields) {
      if (f.required && !values[f.key]?.trim()) errs[f.key] = 'Campo requerido'
    }
    if (Object.keys(errs).length) { setErrors(errs); return }
    onSave?.(values, mode === 'edit')
    setMode(null)
    setValues({})
    setEditRow(null)
  }

  const handleDelete = () => {
    if (editRow) onDelete?.(editRow)
    setMode(null)
    setEditRow(null)
  }

  const allColumns: Column<T>[] = [
    ...columns,
    {
      key: '__acc', header: '', width: '6%', align: 'center',
      render: row => (
        <div className="dt-act">
          {canEdit && (
            <>
              <button className="dt-ab dt-ab-edit" title="Editar" onClick={() => openEdit(row)}>
                <i className="fa fa-pencil-alt" />
              </button>
              <button className="dt-ab dt-ab-del" title="Eliminar" onClick={() => openDelete(row)}>
                <i className="fa fa-trash-alt" />
              </button>
            </>
          )}
          {extraActions?.(row)}
        </div>
      ),
    },
  ]

  const deleteLabel = editRow
    ? (() => {
        const r = editRow as Record<string, unknown>
        return String(r['nombre'] ?? r['codigo'] ?? r['descripcion'] ?? r['login'] ?? Object.values(r)[0] ?? '')
      })()
    : ''

  const closeModal = () => { setMode(null); setValues({}); setEditRow(null); setErrors({}) }

  return (
    <>
      <style>{`
        .cp-hdr { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:20px; gap:16px; }
        .cp-hdr-left { display:flex; align-items:center; gap:12px; }
        .cp-hdr-icon { width:40px; height:40px; border-radius:10px; background:var(--navy); display:grid; place-items:center; flex-shrink:0; }
        .cp-hdr-icon i { color:rgba(255,255,255,.85); font-size:16px; }
        .cp-hdr-title { font-size:19px; font-weight:700; color:var(--ink); margin:0; letter-spacing:-0.01em; }
        .cp-hdr-desc  { font-size:12.5px; color:var(--ink-4); margin:2px 0 0; }

        .cp-table-card { background:#fff; border-radius:var(--r-md); border:1.5px solid var(--hair-2); box-shadow:0 1px 4px rgba(0,0,0,0.04); overflow:hidden; }
        .cp-table-bar  { display:flex; align-items:center; gap:10px; padding:12px 16px; border-bottom:1.5px solid var(--hair-2); background:#FAFBFC; }
        .cp-search-wrap { position:relative; flex:1; max-width:320px; }
        .cp-search-ico  { position:absolute; left:10px; top:50%; transform:translateY(-50%); color:var(--ink-4); font-size:12px; pointer-events:none; }
        .cp-search      { width:100%; padding:7px 10px 7px 30px; border:1.5px solid var(--hair-2); border-radius:var(--r-sm); font-size:13px; font-family:var(--f-sans); color:var(--ink); outline:none; background:#fff; transition:border-color 120ms; }
        .cp-search:focus { border-color:var(--navy); }
        .cp-count       { font-size:12px; color:var(--ink-4); margin-left:auto; }
        .cp-table-body  { padding:0 16px 14px; }

        .cp-mo { position:fixed; inset:0; z-index:200; background:rgba(10,21,48,.45); display:flex; align-items:center; justify-content:center; padding:20px; }
        .cp-mbox { background:var(--paper); border-radius:var(--r-xl); box-shadow:var(--sh-3); width:100%; max-width:460px; }
        .cp-mhdr { background:var(--navy); border-radius:var(--r-xl) var(--r-xl) 0 0; padding:14px 20px; display:flex; align-items:center; gap:10px; }
        .cp-mhdr-icon { width:34px; height:34px; border-radius:9px; background:rgba(255,255,255,.12); display:grid; place-items:center; flex-shrink:0; }
        .cp-mhdr-icon i { color:rgba(255,220,60,.9); font-size:14px; }
        .cp-mhdr-icon.del i { color:#FCA5A5; }
        .cp-mhdr-title { color:#fff; font-weight:700; font-size:14px; }
        .cp-mhdr-sub   { color:#8FA5C9; font-size:11px; margin-top:1px; }
        .cp-mhdr-close { margin-left:auto; background:rgba(255,255,255,.1); border:none; cursor:pointer; color:#fff; width:28px; height:28px; border-radius:7px; font-size:16px; display:grid; place-items:center; }
        .cp-mhdr-close:hover { background:rgba(255,255,255,.2); }
        .cp-mbody { padding:20px 22px; display:flex; flex-direction:column; gap:14px; }
        .cp-mfoot { padding:14px 22px; border-top:1px solid var(--hair); display:flex; justify-content:flex-end; gap:8px; }

        .cp-field label { display:block; font-size:12px; font-weight:600; color:var(--ink-3); margin-bottom:5px; text-transform:uppercase; letter-spacing:0.04em; }
        .cp-field input, .cp-field select {
          width:100%; padding:8px 12px; border:1.5px solid var(--hair-2); border-radius:var(--r-sm);
          font-size:13.5px; font-family:var(--f-sans); color:var(--ink); outline:none; background:#fff;
          transition:border-color 120ms;
        }
        .cp-field input:focus, .cp-field select:focus { border-color:var(--navy); }
        .cp-field.has-err input, .cp-field.has-err select { border-color:#FCA5A5; background:#FFF5F5; }
        .cp-field-err { font-size:11.5px; color:#DC2626; margin-top:4px; display:flex; align-items:center; gap:4px; }

        .cp-del-body { padding:20px 22px; display:flex; gap:14px; align-items:flex-start; }
        .cp-del-ico  { width:40px; height:40px; border-radius:10px; background:#FEF2F2; display:grid; place-items:center; flex-shrink:0; }
        .cp-del-ico i { color:#DC2626; font-size:18px; }
        .cp-del-title { font-weight:700; font-size:14px; color:var(--ink); margin-bottom:5px; }
        .cp-del-msg   { font-size:13px; color:var(--ink-3); line-height:1.5; }
      `}</style>

      {/* Cabecera de página */}
      <div className="cp-hdr">
        <div className="cp-hdr-left">
          <div className="cp-hdr-icon"><i className={`fa ${icon}`} /></div>
          <div>
            <h2 className="cp-hdr-title">{entity.charAt(0).toUpperCase() + entity.slice(1)}</h2>
            {description && <p className="cp-hdr-desc">{description}</p>}
          </div>
        </div>
        {canCreate && (
          <button className="btn btn-primary" onClick={openCreate} style={{ flexShrink: 0 }}>
            <i className="fa fa-plus" /> Nuevo
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="cp-table-card">
        <div className="cp-table-bar">
          <div className="cp-search-wrap">
            <i className="fa fa-search cp-search-ico" />
            <input
              className="cp-search"
              placeholder={`Buscar ${entity.toLowerCase()}...`}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-4)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <i className="fa fa-times" /> Limpiar
            </button>
          )}
          <span className="cp-count">
            {filtered.length !== data.length
              ? `${filtered.length} de ${data.length}`
              : `${data.length} total`}
          </span>
        </div>
        <div className="cp-table-body">
          <DataTable<T> columns={allColumns} data={filtered} loading={loading} />
        </div>
      </div>

      {/* Modal crear / editar */}
      {(mode === 'create' || mode === 'edit') && (
        <div className="cp-mo" onClick={closeModal}>
          <div className="cp-mbox" onClick={e => e.stopPropagation()}>
            <div className="cp-mhdr">
              <div className="cp-mhdr-icon"><i className={`fa ${icon}`} /></div>
              <div>
                <div className="cp-mhdr-title">
                  {mode === 'create' ? `Nuevo ${entity}` : `Editar ${entity}`}
                </div>
                <div className="cp-mhdr-sub">
                  {mode === 'edit' ? 'Modificar registro existente' : 'Completar los campos para crear'}
                </div>
              </div>
              <button className="cp-mhdr-close" onClick={closeModal}>×</button>
            </div>

            <div className="cp-mbody">
              {fields.map(f => (
                <div key={f.key} className={`cp-field${errors[f.key] ? ' has-err' : ''}`}>
                  <label>
                    {f.label}
                    {f.required && <span style={{ color: 'var(--orange)', marginLeft: 3 }}>*</span>}
                  </label>
                  {f.type === 'select' ? (
                    <select value={values[f.key] ?? ''} onChange={e => { setValues(v => ({ ...v, [f.key]: e.target.value })); setErrors(err => ({ ...err, [f.key]: '' })) }}>
                      <option value="">— Seleccione —</option>
                      {f.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <input
                      value={values[f.key] ?? ''}
                      placeholder={f.placeholder ?? ''}
                      onChange={e => { setValues(v => ({ ...v, [f.key]: e.target.value })); setErrors(err => ({ ...err, [f.key]: '' })) }}
                    />
                  )}
                  {errors[f.key] && (
                    <div className="cp-field-err"><i className="fa fa-exclamation-circle" />{errors[f.key]}</div>
                  )}
                </div>
              ))}
            </div>

            <div className="cp-mfoot">
              <button className="btn btn-gray" onClick={closeModal}><i className="fa fa-undo" /> Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave}>
                <i className="fa fa-check" /> {mode === 'edit' ? 'Guardar cambios' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal eliminar */}
      {mode === 'delete' && (
        <div className="cp-mo" onClick={closeModal}>
          <div className="cp-mbox" onClick={e => e.stopPropagation()}>
            <div className="cp-mhdr">
              <div className="cp-mhdr-icon del"><i className="fa fa-trash-alt" /></div>
              <div>
                <div className="cp-mhdr-title">Confirmar eliminación</div>
                <div className="cp-mhdr-sub">Esta acción no se puede deshacer</div>
              </div>
              <button className="cp-mhdr-close" onClick={closeModal}>×</button>
            </div>
            <div className="cp-del-body">
              <div className="cp-del-ico"><i className="fa fa-exclamation-triangle" /></div>
              <div>
                <div className="cp-del-title">¿Eliminar este registro?</div>
                <div className="cp-del-msg">
                  Se eliminará <strong>{deleteLabel}</strong> de forma permanente.
                </div>
              </div>
            </div>
            <div className="cp-mfoot">
              <button className="btn btn-gray" onClick={closeModal}><i className="fa fa-undo" /> Cancelar</button>
              <button className="btn btn-danger" onClick={handleDelete}><i className="fa fa-trash-alt" /> Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

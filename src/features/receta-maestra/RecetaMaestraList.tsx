import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { recetaMaestraApi } from '@/api/recetaMaestra'
import { centrosApi } from '@/api/centros'
import { materialesApi } from '@/api/materiales'
import { Panel } from '@/components/shared/Panel'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { usePuedeEditar } from '@/hooks/usePermisos'
import type { RecetaMaestra } from '@/types'

const estadoLabel: Record<number, string> = { 1: 'Activo', 2: 'Inactivo', 3: 'Aprobado', 4: 'Creación', 5: 'Revisión', 6: 'Rechazado' }
const siguienteEstado: Record<number, { id: number; label: string }> = {
  4: { id: 5, label: 'Enviar a Revisión' },
  5: { id: 3, label: 'Aprobar' },
  3: { id: 1, label: 'Activar' },
  1: { id: 2, label: 'Inactivar' },
}

const EMPTY_FORM = { codigo: '', descripcion: '', version: '', idCentro: '', idMaterial: '' }

export function RecetaMaestraList() {
  const puedeEditar = usePuedeEditar('recetas-maestras')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [modalCrear, setModalCrear] = useState(false)
  const [modalEstado, setModalEstado] = useState<{ receta: RecetaMaestra; sig: { id: number; label: string } } | null>(null)
  const [motivo, setMotivo] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [editando, setEditando] = useState<RecetaMaestra | null>(null)
  const [error, setError] = useState('')

  const { data: recetas = [], isLoading } = useQuery({
    queryKey: ['recetas-maestras'],
    queryFn: () => recetaMaestraApi.buscar(),
  })
  const { data: centros = [] } = useQuery({ queryKey: ['centros'], queryFn: () => centrosApi.listar() })
  const { data: materiales = [] } = useQuery({ queryKey: ['materiales'], queryFn: () => materialesApi.listar() })

  const cambiarEstado = useMutation({
    mutationFn: ({ id, idEstado, motivo }: { id: number; idEstado: number; motivo: string }) =>
      recetaMaestraApi.cambiarEstado(id, idEstado, motivo),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['recetas-maestras'] }); setModalEstado(null); setMotivo('') },
  })

  const openCrear = () => { setForm({ ...EMPTY_FORM, idCentro: centros[0] ? String(centros[0].id) : '' }); setEditando(null); setError(''); setModalCrear(true) }
  const openEditar = (r: RecetaMaestra) => {
    setForm({ codigo: r.codigo, descripcion: r.descripcion, version: r.version, idCentro: String(r.idCentro), idMaterial: r.idMateriales || '' })
    setEditando(r); setError(''); setModalCrear(true)
  }

  const guardar = async () => {
    if (!form.codigo.trim() || !form.descripcion.trim() || !form.version.trim()) { setError('Complete todos los campos requeridos'); return }
    if (!form.idCentro) { setError('Seleccione un centro'); return }
    if (!editando && !form.idMaterial) { setError('Seleccione un producto'); return }

    const data = { codigo: form.codigo.trim(), descripcion: form.descripcion.trim(), version: form.version.trim(), idCentro: Number(form.idCentro), idMaterial: Number(form.idMaterial) }
    const res = editando ? await recetaMaestraApi.guardar(editando.idRecetaMaestra, data) : await recetaMaestraApi.crear(data)
    if (!res.estado) { setError(res.mensaje); return }
    setModalCrear(false); setEditando(null)
    queryClient.invalidateQueries({ queryKey: ['recetas-maestras'] })
  }

  const columns: Column<RecetaMaestra>[] = [
    { key: 'codigo', header: 'Código', width: '10%' },
    { key: 'descripcion', header: 'Descripción' },
    { key: 'version', header: 'Versión', width: '8%' },
    { key: 'centro', header: 'Centro', width: '10%' },
    { key: 'idEstado', header: 'Estado', width: '10%', render: (r) => estadoLabel[r.idEstado] ?? '—' },
    { key: 'fechaModificacion', header: 'Últ. Modificación', width: '12%' },
    {
      key: 'acciones', header: '', width: '8%', align: 'center',
      render: (r) => {
        const sig = siguienteEstado[r.idEstado]
        return (
          <div className="dt-act">
            {puedeEditar && <button className="dt-ab dt-ab-edit" title="Editar datos básicos" onClick={() => openEditar(r)}><i className="fa fa-pencil-alt" /></button>}
            <button className="dt-ab dt-ab-extra" title="Configurar procesos y formularios" onClick={() => navigate(`/recetas-maestras/${r.idRecetaMaestra}/configurar`)} style={{ color: '#7C3AED' }}><i className="fa fa-sitemap" /></button>
            {puedeEditar && sig && (
              <button onClick={() => setModalEstado({ receta: r, sig })} style={{ fontSize: 10, padding: '2px 8px', background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontFamily: 'var(--f-sans)', whiteSpace: 'nowrap' }}>
                {sig.label}
              </button>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <>
      <style>{`
        .text-success { color: var(--forest); text-decoration: none; font-size: 15px; }
        .modal-overlay { position: fixed; inset: 0; z-index: 200; background: rgba(10,21,48,0.45); display: flex; align-items: center; justify-content: center; padding: 20px; }
        .modal-box { background: var(--paper); border-radius: var(--r-xl); box-shadow: var(--sh-3); width: 100%; max-width: 480px; }
        .modal-header-bar { padding: 16px 22px; border-bottom: 1px solid var(--hair); font-size: 15px; font-weight: 700; color: var(--ink); }
        .modal-body-area { padding: 18px 22px; }
        .modal-footer-bar { padding: 14px 22px; border-top: 1px solid var(--hair); display: flex; justify-content: flex-end; gap: 8px; }
        .field-label { display: block; font-size: 12.5px; font-weight: 600; color: var(--ink-2); margin-bottom: 5px; }
        .field-input { width: 100%; padding: 8px 12px; background: var(--white); border: 1.5px solid var(--hair-2); border-radius: var(--r-sm); font-size: 13.5px; color: var(--ink); font-family: var(--f-sans); outline: none; margin-bottom: 14px; }
        .field-input:focus { border-color: var(--navy); }
      `}</style>

      {(centros.length === 0 || materiales.length === 0) && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: '#FFFBEB', border: '1.5px solid #FCD34D', borderRadius: 'var(--r-sm)', fontSize: 12.5, color: '#92400E' }}>
          <i className="fa fa-exclamation-triangle" style={{ marginRight: 6 }} />
          Antes de crear una receta, configura al menos un Centro y un Material en sus respectivos catálogos.
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <Panel title="Lista de recetas maestras">
            <div className="table-responsive">
              <DataTable<RecetaMaestra> columns={columns} data={recetas} loading={isLoading} />
            </div>
          </Panel>
        </div>
        {puedeEditar && (
          <div style={{ paddingTop: 4 }}>
            <button className="btn btn-success" onClick={openCrear} disabled={centros.length === 0 || materiales.length === 0}>
              <i className="fa fa-plus" /> Crear
            </button>
          </div>
        )}
      </div>

      {/* Modal Crear / Modificar */}
      {modalCrear && (
        <div className="modal-overlay" onClick={() => { setModalCrear(false); setEditando(null) }}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header-bar" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span>{editando ? 'Modificar receta maestra' : 'Crear receta maestra'}</span>
              <button style={{ background:'none', border:'none', cursor:'pointer', color:'var(--ink-4)', fontSize:18 }} onClick={() => { setModalCrear(false); setEditando(null) }}>×</button>
            </div>
            <div className="modal-body-area">
              <label className="field-label">Código *</label>
              <input className="field-input" value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} placeholder="Ej: RM-005" />
              <label className="field-label">Descripción *</label>
              <input className="field-input" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Descripción de la receta" />
              <label className="field-label">Versión *</label>
              <input className="field-input" value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} placeholder="Ej: v1.0" />
              <label className="field-label">Centro *</label>
              <select className="field-input" value={form.idCentro} onChange={e => setForm(f => ({ ...f, idCentro: e.target.value }))}>
                <option value="">— Seleccione —</option>
                {centros.map(c => <option key={c.id} value={String(c.id)}>{c.descripcion}</option>)}
              </select>
              <label className="field-label">Producto {!editando && '*'}</label>
              <select className="field-input" value={form.idMaterial} onChange={e => setForm(f => ({ ...f, idMaterial: e.target.value }))} disabled={!!editando}>
                <option value="">— Seleccione —</option>
                {materiales
                  .filter(m => editando || m.tipo === 'PRODUCTO_TERMINADO')
                  .map(m => <option key={m.id} value={String(m.id)}>{m.descripcion} ({m.codigo})</option>)}
              </select>
              {!editando && (
                <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: -10, marginBottom: 14 }}>
                  Solo se listan materiales de tipo "Producto Terminado".
                </div>
              )}
              {editando && <div style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: -10, marginBottom: 14 }}>El producto no se puede cambiar una vez creada la receta.</div>}
              {error && (
                <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 'var(--r-sm)', fontSize: 12.5, color: '#B91C1C', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <i className="fa fa-exclamation-circle" /> {error}
                </div>
              )}
            </div>
            <div className="modal-footer-bar">
              <button className="btn btn-gray" onClick={() => { setModalCrear(false); setEditando(null) }}><i className="fa fa-undo" /> Cancelar</button>
              <button className="btn btn-primary" onClick={guardar}><i className="fa fa-check" /> {editando ? 'Guardar' : 'Crear'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cambiar Estado */}
      {modalEstado && (
        <div className="modal-overlay" onClick={() => setModalEstado(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header-bar">{modalEstado.sig.label}</div>
            <div className="modal-body-area">
              <p style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 14 }}>
                <strong>{modalEstado.receta.codigo}</strong> — {modalEstado.receta.descripcion}
              </p>
              <label className="field-label">Motivo <span style={{ color: 'var(--ink-4)', fontWeight: 400 }}>(opcional)</span></label>
              <textarea
                className="field-input"
                rows={3}
                style={{ resize: 'none' }}
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                placeholder="Ingrese el motivo..."
              />
            </div>
            <div className="modal-footer-bar">
              <button className="btn btn-gray" onClick={() => setModalEstado(null)}>Cancelar</button>
              <button
                className="btn btn-primary"
                disabled={cambiarEstado.isPending}
                onClick={() => cambiarEstado.mutate({ id: modalEstado.receta.idRecetaMaestra, idEstado: modalEstado.sig.id, motivo })}
              >
                {cambiarEstado.isPending ? 'Guardando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

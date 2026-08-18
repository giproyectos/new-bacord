import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Panel } from '@/components/shared/Panel'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { mockEstrategiasFirma, mockFirmas } from '@/api/mock'
import { GRUPOS } from '@/types'
import type { EstrategiaFirma, EstrategiaFirmaItem } from '@/types'

// ── helpers ───────────────────────────────────────────────────────────────────

function grupoBadge(grupo: string) {
  const colors: Record<string, { bg: string; color: string }> = {
    'Producción':     { bg: '#dbeafe', color: '#1d4ed8' },
    'Calidad':        { bg: '#d1fae5', color: '#065f46' },
    'Supervisión':    { bg: '#fef3c7', color: '#92400e' },
    'Administradores':{ bg: '#ede9fe', color: '#5b21b6' },
  }
  const c = colors[grupo] ?? { bg: '#f1f5f9', color: '#475569' }
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
      background: c.bg, color: c.color, fontFamily: 'var(--f-mono)', whiteSpace: 'nowrap' }}>
      {grupo}
    </span>
  )
}

// ── FirmasModal ───────────────────────────────────────────────────────────────

function FirmasModal({ estrategia, onClose, onSave }: {
  estrategia: EstrategiaFirma
  onClose: () => void
  onSave: (items: EstrategiaFirmaItem[]) => void
}) {
  const [items, setItems] = useState<EstrategiaFirmaItem[]>(
    estrategia.firmas.map(f => ({ ...f })).sort((a, b) => a.orden - b.orden)
  )

  const firmasDisponibles = mockFirmas.filter(
    f => f.activo && !items.find(i => i.idFirma === f.idFirma)
  )

  const agregar = (idFirma: number) => {
    const firma = mockFirmas.find(f => f.idFirma === idFirma)
    if (!firma) return
    setItems(prev => [
      ...prev,
      {
        idFirma: firma.idFirma,
        codigo: firma.codigo,
        texto: firma.descripcion,
        grupo: GRUPOS[firma.idGrupo] ?? 'Sin grupo',
        orden: prev.length + 1,
        activo: true,
      },
    ])
  }

  const eliminar = (idFirma: number) => {
    setItems(prev => {
      const filtered = prev.filter(i => i.idFirma !== idFirma)
      return filtered.map((f, idx) => ({ ...f, orden: idx + 1 }))
    })
  }

  const mover = (idx: number, dir: 'up' | 'down') => {
    setItems(prev => {
      const arr = [...prev]
      const swap = dir === 'up' ? idx - 1 : idx + 1
      if (swap < 0 || swap >= arr.length) return arr
      ;[arr[idx], arr[swap]] = [arr[swap], arr[idx]]
      return arr.map((f, i) => ({ ...f, orden: i + 1 }))
    })
  }

  const toggleActivo = (idFirma: number) => {
    setItems(prev => prev.map(i => i.idFirma === idFirma ? { ...i, activo: !i.activo } : i))
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(10,21,48,.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}>
      <div style={{ background: 'var(--paper)', borderRadius: 'var(--r-xl)', boxShadow: 'var(--sh-3)',
        width: '100%', maxWidth: 620 }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ background: 'var(--navy)', borderRadius: 'var(--r-xl) var(--r-xl) 0 0',
          padding: '14px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>
              <i className="fa fa-signature" style={{ marginRight: 8, color: 'var(--yellow)' }} />
              Firmas — {estrategia.descripcion}
            </div>
            <div style={{ color: '#8FA5C9', fontSize: 11, fontFamily: 'var(--f-mono)', marginTop: 2 }}>
              {estrategia.codigo}
            </div>
          </div>
          <button style={{ background: 'rgba(255,255,255,.1)', border: 'none', cursor: 'pointer',
            color: '#fff', width: 28, height: 28, borderRadius: 7, fontSize: 16,
            display: 'grid', placeItems: 'center' }} onClick={onClose}>×</button>
        </div>

        <div style={{ padding: '20px 22px', maxHeight: '70vh', overflowY: 'auto' }}>

          {/* Firmas configuradas */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase',
              letterSpacing: '0.08em', marginBottom: 10 }}>
              Firmas configuradas ({items.length})
            </div>

            {items.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--ink-4)',
                fontSize: 13, border: '2px dashed var(--hair-2)', borderRadius: 'var(--r-md)' }}>
                <i className="fa fa-pen" style={{ display: 'block', fontSize: 20, marginBottom: 8 }} />
                Sin firmas configuradas. Agrega desde la lista de abajo.
              </div>
            ) : (
              <div style={{ border: '1.5px solid var(--hair-2)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
                {items.map((item, idx) => (
                  <div key={item.idFirma} style={{ display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', borderBottom: idx < items.length - 1 ? '1px solid var(--hair)' : 'none',
                    background: item.activo ? '#fff' : 'var(--paper-2)',
                    opacity: item.activo ? 1 : 0.6 }}>

                    {/* Orden */}
                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--navy)',
                      color: '#fff', display: 'grid', placeItems: 'center', fontSize: 11,
                      fontWeight: 700, flexShrink: 0, fontFamily: 'var(--f-mono)' }}>
                      {item.orden}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 3 }}>
                        {item.texto}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--f-mono)' }}>
                          {item.codigo}
                        </span>
                        {grupoBadge(item.grupo)}
                      </div>
                    </div>

                    {/* Activo toggle */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer',
                      fontSize: 11.5, color: 'var(--ink-3)', flexShrink: 0 }}>
                      <input type="checkbox" checked={item.activo}
                        onChange={() => toggleActivo(item.idFirma)}
                        style={{ accentColor: 'var(--navy)', width: 14, height: 14 }} />
                      Activo
                    </label>

                    {/* Reorder */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                      <button onClick={() => mover(idx, 'up')} disabled={idx === 0}
                        style={{ width: 22, height: 22, border: '1.5px solid var(--hair-2)', borderRadius: 5,
                          background: '#fff', cursor: idx === 0 ? 'default' : 'pointer',
                          color: idx === 0 ? 'var(--hair-2)' : 'var(--ink-3)',
                          display: 'grid', placeItems: 'center', fontSize: 9, padding: 0 }}>
                        <i className="fa fa-chevron-up" />
                      </button>
                      <button onClick={() => mover(idx, 'down')} disabled={idx === items.length - 1}
                        style={{ width: 22, height: 22, border: '1.5px solid var(--hair-2)', borderRadius: 5,
                          background: '#fff', cursor: idx === items.length - 1 ? 'default' : 'pointer',
                          color: idx === items.length - 1 ? 'var(--hair-2)' : 'var(--ink-3)',
                          display: 'grid', placeItems: 'center', fontSize: 9, padding: 0 }}>
                        <i className="fa fa-chevron-down" />
                      </button>
                    </div>

                    {/* Eliminar */}
                    <button onClick={() => eliminar(item.idFirma)}
                      style={{ width: 26, height: 26, border: '1.5px solid #fecaca', borderRadius: 6,
                        background: '#fef2f2', cursor: 'pointer', color: '#dc2626',
                        display: 'grid', placeItems: 'center', fontSize: 11, flexShrink: 0 }}>
                      <i className="fa fa-times" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Firmas disponibles para agregar */}
          {firmasDisponibles.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase',
                letterSpacing: '0.08em', marginBottom: 10 }}>
                Agregar firma
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {firmasDisponibles.map(f => (
                  <div key={f.idFirma} style={{ display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 14px', border: '1.5px solid var(--hair-2)', borderRadius: 'var(--r-sm)',
                    background: '#fff' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{f.descripcion}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--f-mono)' }}>
                          {f.codigo}
                        </span>
                        {grupoBadge(GRUPOS[f.idGrupo] ?? 'Sin grupo')}
                      </div>
                    </div>
                    <button onClick={() => agregar(f.idFirma)}
                      style={{ padding: '4px 12px', borderRadius: 'var(--r-sm)', border: '1.5px solid var(--navy)',
                        background: 'var(--navy)', color: '#fff', cursor: 'pointer', fontSize: 12,
                        fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                      <i className="fa fa-plus" style={{ fontSize: 10 }} /> Agregar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--hair)',
          display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-gray" onClick={onClose}><i className="fa fa-undo" /> Cancelar</button>
          <button className="btn btn-primary" onClick={() => onSave(items)}>
            <i className="fa fa-check" /> Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── EstrategiaFirmasList ──────────────────────────────────────────────────────

export function EstrategiaFirmasList() {
  const [data, setData] = useState<EstrategiaFirma[]>(mockEstrategiasFirma)
  const [firmasModal, setFirmasModal] = useState<EstrategiaFirma | null>(null)
  const [modalCrear, setModalCrear] = useState(false)
  const [editando, setEditando] = useState<EstrategiaFirma | null>(null)
  const [form, setForm] = useState({ codigo: '', descripcion: '' })

  const openCrear = () => { setForm({ codigo: '', descripcion: '' }); setEditando(null); setModalCrear(true) }
  const openEditar = (r: EstrategiaFirma) => { setForm({ codigo: r.codigo, descripcion: r.descripcion }); setEditando(r); setModalCrear(true) }

  const handleSave = () => {
    if (!form.codigo.trim() || !form.descripcion.trim()) return
    if (editando) {
      // Sincronizar con el array del módulo para que otros componentes lo vean
      const idx = mockEstrategiasFirma.findIndex(x => x.id === editando.id)
      if (idx >= 0) Object.assign(mockEstrategiasFirma[idx], form)
      setData(d => d.map(x => x.id === editando.id ? { ...x, ...form } : x))
    } else {
      const newId = Math.max(0, ...data.map(d => d.id)) + 1
      const nueva: EstrategiaFirma = { id: newId, ...form, usuarioCreacion: 'admin', fechaCreacion: new Date().toISOString().slice(0, 10), activo: 1, firmas: [] }
      mockEstrategiasFirma.push(nueva)
      setData(d => [...d, nueva])
    }
    setModalCrear(false); setEditando(null)
  }

  const handleEliminar = (id: number) => {
    const idx = mockEstrategiasFirma.findIndex(x => x.id === id)
    if (idx >= 0) mockEstrategiasFirma.splice(idx, 1)
    setData(d => d.filter(x => x.id !== id))
  }

  const handleSaveFirmas = (items: EstrategiaFirmaItem[]) => {
    if (!firmasModal) return
    const idx = mockEstrategiasFirma.findIndex(x => x.id === firmasModal.id)
    if (idx >= 0) mockEstrategiasFirma[idx].firmas = items
    setData(d => d.map(x => x.id === firmasModal.id ? { ...x, firmas: items } : x))
    setFirmasModal(null)
  }

  const columns: Column<EstrategiaFirma>[] = [
    { key: 'codigo',          header: 'Código',   width: '10%',
      render: r => <span style={{ fontFamily: 'var(--f-mono)', fontSize: 12.5, color: 'var(--navy)', fontWeight: 600 }}>{r.codigo}</span> },
    { key: 'descripcion',     header: 'Descripción' },
    { key: 'firmas',          header: 'Firmas',   width: '28%',
      render: r => r.firmas.length === 0
        ? <span style={{ color: 'var(--ink-4)', fontSize: 12 }}>Sin firmas</span>
        : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {r.firmas.filter(f => f.activo).sort((a, b) => a.orden - b.orden).map(f => (
              <span key={f.idFirma} style={{ display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 11, padding: '2px 7px', borderRadius: 20,
                background: 'var(--navy-50)', color: 'var(--navy)', fontWeight: 500 }}>
                <span style={{ fontFamily: 'var(--f-mono)', opacity: 0.6 }}>{f.orden}.</span>
                {f.texto}
              </span>
            ))}
          </div>
    },
    { key: 'usuarioCreacion', header: 'Creado por', width: '10%' },
    { key: 'fechaCreacion',   header: 'Fecha',      width: '10%' },
    { key: 'activo',          header: 'Activo',     width: '7%',
      render: r => <span style={{ fontSize: 12, fontWeight: 600, color: r.activo ? 'var(--forest)' : 'var(--ink-4)' }}>
        {r.activo ? 'Sí' : 'No'}
      </span> },
    {
      key: '__acc', header: '', width: '9%', align: 'center',
      render: r => (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
          <button title="Modificar" onClick={() => openEditar(r)}
            style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'transparent',
              cursor: 'pointer', color: 'var(--forest)', fontSize: 13, display: 'grid', placeItems: 'center' }}>
            <i className="fa fa-edit" />
          </button>
          <button title="Administrar firmas" onClick={() => setFirmasModal(r)}
            style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'transparent',
              cursor: 'pointer', color: 'var(--orange)', fontSize: 13, display: 'grid', placeItems: 'center' }}>
            <i className="fa fa-signature" />
          </button>
          <button title="Eliminar" onClick={() => handleEliminar(r.id)}
            style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'transparent',
              cursor: 'pointer', color: '#dc2626', fontSize: 13, display: 'grid', placeItems: 'center' }}>
            <i className="fa fa-trash-alt" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <Panel title="Lista de estrategias de firma">
            <DataTable<EstrategiaFirma> columns={columns} data={data} />
          </Panel>
        </div>
        <div style={{ paddingTop: 4 }}>
          <button className="btn btn-success" onClick={openCrear}>
            <i className="fa fa-plus" /> Crear
          </button>
        </div>
      </div>

      {/* Modal Crear / Editar */}
      {modalCrear && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(10,21,48,.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setModalCrear(false)}>
          <div style={{ background: 'var(--paper)', borderRadius: 'var(--r-xl)', boxShadow: 'var(--sh-3)',
            width: '100%', maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--hair)',
              fontSize: 15, fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{editando ? 'Modificar estrategia' : 'Crear estrategia'}</span>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-4)', fontSize: 18 }}
                onClick={() => setModalCrear(false)}>×</button>
            </div>
            <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 5 }}>
                  Código <span style={{ color: 'var(--orange)' }}>*</span>
                </label>
                <input className="form-control" value={form.codigo} maxLength={10}
                  onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} placeholder="Ej: EF-003" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 5 }}>
                  Descripción <span style={{ color: 'var(--orange)' }}>*</span>
                </label>
                <input className="form-control" value={form.descripcion} maxLength={80}
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Descripción de la estrategia" />
              </div>
              {editando && (
                <div style={{ padding: '10px 14px', background: 'rgba(10,45,99,.06)',
                  border: '1.5px solid rgba(10,45,99,.14)', borderRadius: 'var(--r-sm)',
                  fontSize: 12.5, color: 'var(--ink-3)' }}>
                  <i className="fa fa-info-circle" style={{ marginRight: 6, color: 'var(--navy)' }} />
                  Para gestionar las firmas de esta estrategia usa el botón{' '}
                  <strong><i className="fa fa-signature" /> Administrar firmas</strong> en la tabla.
                </div>
              )}
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid var(--hair)',
              display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-gray" onClick={() => setModalCrear(false)}><i className="fa fa-undo" /> Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave}
                disabled={!form.codigo.trim() || !form.descripcion.trim()}>
                <i className="fa fa-check" /> {editando ? 'Guardar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de firmas */}
      {firmasModal && (
        <FirmasModal
          estrategia={firmasModal}
          onClose={() => setFirmasModal(null)}
          onSave={handleSaveFirmas}
        />
      )}
    </>
  )
}

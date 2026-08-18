import { useState } from 'react'
import { Panel } from '@/components/shared/Panel'
import { DataTable, type Column } from '@/components/shared/DataTable'

interface DetalleAInstruccion {
  id: number; detalle: string; instruccion: string; descripcion: string; orden: number
}

const mock: DetalleAInstruccion[] = [
  { id: 1, detalle: 'Verificación de equipos', instruccion: 'Verificar equipos limpios', descripcion: 'Verificación estándar', orden: 1 },
  { id: 2, detalle: 'Control de temperatura', instruccion: 'Registrar temperatura ambiente', descripcion: 'Registro obligatorio', orden: 1 },
  { id: 3, detalle: 'Pesaje de materiales', instruccion: 'Verificar peso de materiales', descripcion: 'Tolerancia ±0.5%', orden: 2 },
]

const INSTRUCCIONES = ['Verificar equipos limpios', 'Registrar temperatura ambiente', 'Verificar peso de materiales']

export function DetallesAInstruccionList() {
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ descripcion: '', orden: '', instruccion: '' })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const columns: Column<DetalleAInstruccion>[] = [
    { key: 'detalle',      header: 'Detalle' },
    { key: 'instruccion',  header: 'Instrucción' },
    { key: 'descripcion',  header: 'Descripción' },
    { key: 'orden',        header: 'Orden', width: '8%', align: 'center' },
    {
      key: '__acc', header: '', width: '7%', align: 'center',
      render: () => (
        <a href="#" className="text-danger" title="Eliminar" onClick={e => e.preventDefault()}>
          <i className="fa fa-trash-alt" />
        </a>
      ),
    },
  ]

  return (
    <>
      <style>{`
        .mo { position:fixed;inset:0;z-index:200;background:rgba(10,21,48,.45);display:flex;align-items:center;justify-content:center;padding:20px }
        .mb2 { background:var(--paper);border-radius:var(--r-xl);box-shadow:var(--sh-3);width:100%;max-width:460px }
        .mh2 { padding:16px 22px;border-bottom:1px solid var(--hair);font-size:15px;font-weight:700;display:flex;align-items:center;justify-content:space-between }
        .mc { padding:18px 22px }
        .mf2 { padding:14px 22px;border-top:1px solid var(--hair);display:flex;justify-content:flex-end;gap:8px }
        .fg { margin-bottom:14px }
        .fl { display:block;font-size:12.5px;font-weight:600;color:var(--ink-2);margin-bottom:5px }
        .fr { color:var(--orange);font-size:11px }
        .fi { width:100%;padding:8px 12px;background:#fff;border:1.5px solid var(--hair-2);border-radius:var(--r-sm);font-size:13.5px;color:var(--ink);font-family:var(--f-sans);outline:none }
        .fi:focus { border-color:var(--navy) }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <Panel title="Lista de detalles a instrucción">
            <DataTable<DetalleAInstruccion> columns={columns} data={mock} />
          </Panel>
        </div>
        <div style={{ paddingTop: 4 }}>
          <button className="btn btn-success" onClick={() => { setForm({ descripcion: '', orden: '', instruccion: '' }); setModal(true) }}>
            <i className="fa fa-plus" /> Crear
          </button>
        </div>
      </div>

      {modal && (
        <div className="mo" onClick={() => setModal(false)}>
          <div className="mb2" onClick={e => e.stopPropagation()}>
            <div className="mh2">
              <span>Asociar Detalle a Instrucción</span>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-4)', fontSize: 18 }} onClick={() => setModal(false)}>×</button>
            </div>
            <div className="mc">
              <div className="fg">
                <label className="fl">Descripción <span className="fr">(requerido)</span></label>
                <input className="fi" value={form.descripcion} onChange={e => set('descripcion', e.target.value)} maxLength={40} />
              </div>
              <div className="fg">
                <label className="fl">Orden <span className="fr">(requerido)</span></label>
                <input className="fi" type="number" value={form.orden} onChange={e => set('orden', e.target.value)} />
              </div>
              <div className="fg">
                <label className="fl">Instrucción <span className="fr">(requerido)</span></label>
                <select className="fi" value={form.instruccion} onChange={e => set('instruccion', e.target.value)}>
                  <option value="">-- Seleccione una instrucción --</option>
                  {INSTRUCCIONES.map(i => <option key={i}>{i}</option>)}
                </select>
              </div>
            </div>
            <div className="mf2">
              <button className="btn btn-gray" onClick={() => setModal(false)}><i className="fa fa-undo" /> Cancelar</button>
              <button className="btn btn-primary" onClick={() => setModal(false)}><i className="fa fa-check" /> Crear</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

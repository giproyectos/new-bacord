import { useState } from 'react'
import { Panel } from '@/components/shared/Panel'
import { DataTable, type Column } from '@/components/shared/DataTable'

interface Sesion { id: number; usuario: string; fechaAcceso: string; fechaExpira: string; abierta: string }

const mock: Sesion[] = [
  { id: 1, usuario: 'admin',  fechaAcceso: '2024-10-01 08:00:00', fechaExpira: '2024-10-01 10:00:00', abierta: 'Sí' },
  { id: 2, usuario: 'jborda', fechaAcceso: '2024-10-01 08:30:00', fechaExpira: '2024-10-01 10:30:00', abierta: 'Sí' },
]

export function Sesiones() {
  const today = new Date().toISOString().split('T')[0]
  const [filtros, setFiltros] = useState({ FechaInicialAcceso: today, FechaFinalAcceso: today, Cantidad: '100' })

  const cols: Column<Sesion>[] = [
    { key: 'usuario',     header: 'Usuario' },
    { key: 'fechaAcceso', header: 'Fecha Acceso' },
    { key: 'fechaExpira', header: 'Fecha Expira' },
    { key: 'abierta',     header: 'Abierta', width: '8%' },
    {
      key: '__cerrar', header: 'Cerrar Sesión', width: '10%', align: 'center',
      render: () => (
        <a href="#" className="text-danger" title="Cerrar Sesión" onClick={e => e.preventDefault()}>
          <i className="fa fa-sign-out-alt" /> Cerrar
        </a>
      ),
    },
  ]

  return (
    <>
      <Panel title={<><i className="fa fa-search" /> Buscar sesiones en el sistema</>} collapsible>
        <div className="form-horizontal">
          <div className="grid-row">
            <div className="form-group">
              <label>Fecha acceso desde</label>
              <input type="date" className="form-control input-sm" value={filtros.FechaInicialAcceso} onChange={e => setFiltros(f => ({ ...f, FechaInicialAcceso: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Fecha acceso hasta</label>
              <input type="date" className="form-control input-sm" value={filtros.FechaFinalAcceso} onChange={e => setFiltros(f => ({ ...f, FechaFinalAcceso: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Cantidad registros</label>
              <input type="text" className="form-control input-sm" value={filtros.Cantidad} onChange={e => setFiltros(f => ({ ...f, Cantidad: e.target.value }))} />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn btn-gray" onClick={() => setFiltros({ FechaInicialAcceso: today, FechaFinalAcceso: today, Cantidad: '100' })}><i className="fa fa-undo" /> Limpiar</button>
            <button className="btn btn-primary"><i className="fa fa-search" /> Buscar</button>
          </div>
        </div>
      </Panel>
      <Panel title="Resultado de la búsqueda">
        <DataTable<Sesion> columns={cols} data={mock} />
      </Panel>
    </>
  )
}

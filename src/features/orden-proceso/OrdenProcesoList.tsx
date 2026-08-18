import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ordenProcesoApi } from '@/api/ordenProceso'
import { Panel } from '@/components/shared/Panel'
import { DataTable, type Column } from '@/components/shared/DataTable'
import type { OrdenProceso } from '@/types'

const ESTADO_OP: Record<number, { label: string; bg: string; color: string }> = {
  1: { label: 'Liberada',    bg: '#D1FAE5', color: '#065F46' },
  2: { label: 'En Proceso',  bg: '#FEF3C7', color: '#92400E' },
  3: { label: 'Cerrada',     bg: '#F1F5F9', color: '#475569' },
}

export function OrdenProcesoList() {
  const navigate = useNavigate()
  const [filtros, setFiltros] = useState({ NumeroOrden: '', CodigoMaterial: '', IdEstado: '', FechaInicialCreacion: '', FechaFinalCreacion: '', FechaInicialFabricacion: '', FechaFinalFabricacion: '' })
  const [buscar, setBuscar] = useState(false)

  const { data = [], isLoading } = useQuery({
    queryKey: ['ordenes-proceso', buscar],
    queryFn: () => ordenProcesoApi.buscar(),
  })

  const columns: Column<OrdenProceso>[] = [
    { key: 'numeroOrdenProceso', header: 'N° Orden', width: '8%' },
    { key: 'codigoMaterial', header: 'Cód. Material', width: '8%' },
    { key: 'descripcionMaterial', header: 'Material' },
    { key: 'loteLogistico', header: 'Lote Logístico', width: '8%' },
    { key: 'loteInspeccion', header: 'Lote Inspección', width: '8%' },
    { key: 'cantidadOrden', header: 'Cantidad', width: '7%', align: 'right', render: r => r.cantidadOrden.toLocaleString() },
    { key: 'unidadMedida', header: 'UM', width: '5%' },
    { key: 'formaFarmaceutica', header: 'Forma Farmacéutica', width: '10%' },
    { key: 'registroSanitario', header: 'Reg. Sanitario', width: '9%' },
    { key: 'fechaFabricacion', header: 'Fec. Fabricación', width: '9%' },
    { key: 'fechaCaducidad', header: 'Fec. Caducidad', width: '9%' },
    { key: 'centro', header: 'Centro', width: '8%' },
    {
      key: 'idEstado', header: 'Estado', width: '9%',
      render: r => {
        const cfg = ESTADO_OP[r.idEstado] ?? ESTADO_OP[1]
        return (
          <span style={{ padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700,
            background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap' }}>
            {cfg.label}
          </span>
        )
      },
    },
    {
      key: 'ver', header: '', width: '5%', align: 'center',
      render: r => (
        <button onClick={() => navigate(`/ordenes-proceso/${r.idOrdenProceso}`)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0A2D63', fontSize: 14 }}
          title="Ver detalle">
          <i className="fa fa-eye" />
        </button>
      ),
    },
  ]

  return (
    <>
      {/* Búsqueda */}
      <Panel title={<><i className="fa fa-search" /> Buscar órdenes</>} collapsible>
        <div className="form-horizontal">
          <div className="grid-row">
            <div className="form-group">
              <label>Número Orden de Proceso</label>
              <input className="form-control input-sm" value={filtros.NumeroOrden} onChange={e => setFiltros(f => ({ ...f, NumeroOrden: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Código Material</label>
              <input className="form-control input-sm" value={filtros.CodigoMaterial} onChange={e => setFiltros(f => ({ ...f, CodigoMaterial: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Estado</label>
              <select className="form-control input-sm" value={filtros.IdEstado} onChange={e => setFiltros(f => ({ ...f, IdEstado: e.target.value }))}>
                <option value="">-- Seleccione --</option>
                <option value="1">Activo</option>
                <option value="2">Inactivo</option>
              </select>
            </div>
          </div>
          <div className="grid-row">
            <div className="form-group">
              <label>Fecha creación desde</label>
              <input type="date" className="form-control input-sm" value={filtros.FechaInicialCreacion} onChange={e => setFiltros(f => ({ ...f, FechaInicialCreacion: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Fecha creación hasta</label>
              <input type="date" className="form-control input-sm" value={filtros.FechaFinalCreacion} onChange={e => setFiltros(f => ({ ...f, FechaFinalCreacion: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Fecha fabricación desde</label>
              <input type="date" className="form-control input-sm" value={filtros.FechaInicialFabricacion} onChange={e => setFiltros(f => ({ ...f, FechaInicialFabricacion: e.target.value }))} />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn btn-gray" onClick={() => setFiltros({ NumeroOrden: '', CodigoMaterial: '', IdEstado: '', FechaInicialCreacion: '', FechaFinalCreacion: '', FechaInicialFabricacion: '', FechaFinalFabricacion: '' })}>
              <i className="fa fa-undo" /> Limpiar
            </button>
            <button className="btn btn-primary" onClick={() => setBuscar(b => !b)}>
              <i className="fa fa-search" /> Buscar
            </button>
          </div>
        </div>
      </Panel>

      <Panel title="Resultado de la búsqueda">
        <div className="table-responsive">
          <DataTable<OrdenProceso> columns={columns} data={data} loading={isLoading} />
        </div>
      </Panel>
    </>
  )
}

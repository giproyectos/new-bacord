import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ordenProcesoApi } from '@/api/ordenProceso'
import { Panel } from '@/components/shared/Panel'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { ORDEN_PROCESO_ESTADO_LABEL } from '@/constants/ordenProceso'
import type { OrdenProceso } from '@/types'

const ESTADO_OP_COLOR: Record<number, { bg: string; color: string }> = {
  1: { bg: '#F1F5F9', color: '#475569' },
  2: { bg: '#FEF3C7', color: '#92400E' },
  3: { bg: '#DBEAFE', color: '#1D4ED8' },
}

const FILTROS_VACIOS = { NumeroOrden: '', CodigoMaterial: '', IdEstado: '', FechaInicialFabricacion: '', FechaFinalFabricacion: '' }

export function OrdenProcesoList() {
  const navigate = useNavigate()
  const [filtros, setFiltros] = useState(FILTROS_VACIOS)
  // Solo cambia al hacer clic en "Buscar" (o "Limpiar") — separado de `filtros` para que la
  // búsqueda no se dispare en cada tecla, sino cuando el usuario confirma.
  const [filtrosAplicados, setFiltrosAplicados] = useState(FILTROS_VACIOS)

  const { data = [], isLoading } = useQuery({
    queryKey: ['ordenes-proceso', filtrosAplicados],
    queryFn: () => ordenProcesoApi.buscar({
      numeroOrden: filtrosAplicados.NumeroOrden || undefined,
      codigoMaterial: filtrosAplicados.CodigoMaterial || undefined,
      idEstado: filtrosAplicados.IdEstado ? Number(filtrosAplicados.IdEstado) : undefined,
      fechaFabricacionDesde: filtrosAplicados.FechaInicialFabricacion || undefined,
      fechaFabricacionHasta: filtrosAplicados.FechaFinalFabricacion || undefined,
    }),
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
        const color = ESTADO_OP_COLOR[r.idEstado] ?? ESTADO_OP_COLOR[1]
        return (
          <span style={{ padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700,
            background: color.bg, color: color.color, whiteSpace: 'nowrap' }}>
            {ORDEN_PROCESO_ESTADO_LABEL[r.idEstado] ?? ORDEN_PROCESO_ESTADO_LABEL[1]}
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
                {Object.entries(ORDEN_PROCESO_ESTADO_LABEL).map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid-row">
            <div className="form-group">
              <label>Fecha fabricación desde</label>
              <input type="date" className="form-control input-sm" value={filtros.FechaInicialFabricacion} onChange={e => setFiltros(f => ({ ...f, FechaInicialFabricacion: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Fecha fabricación hasta</label>
              <input type="date" className="form-control input-sm" value={filtros.FechaFinalFabricacion} onChange={e => setFiltros(f => ({ ...f, FechaFinalFabricacion: e.target.value }))} />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn btn-gray" onClick={() => { setFiltros(FILTROS_VACIOS); setFiltrosAplicados(FILTROS_VACIOS) }}>
              <i className="fa fa-undo" /> Limpiar
            </button>
            <button className="btn btn-primary" onClick={() => setFiltrosAplicados(filtros)}>
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

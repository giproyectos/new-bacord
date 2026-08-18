import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Panel } from '@/components/shared/Panel'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { formulaControlApi } from '@/api/formulaControl'
import { mockOrdenes, mockRecetas } from '@/api/mock'
import type { FormulaControl } from '@/types'

const ESTADO: Record<number, { label: string; bg: string; color: string }> = {
  1: { label: 'En Tratamiento',      bg: '#FEF3C7', color: '#92400E' },
  2: { label: 'Enviada a Producción', bg: '#D1FAE5', color: '#065F46' },
  3: { label: 'Cancelada',           bg: '#FEE2E2', color: '#991B1B' },
}

export function FormulaControlList() {
  const navigate = useNavigate()
  const [filtros, setFiltros] = useState({ OrdenProceso: '', IdEstado: '' })

  const { data = [], isLoading, refetch } = useQuery({
    queryKey: ['formulas-control'],
    queryFn: formulaControlApi.buscar,
  })

  const filtered = data.filter(fc => {
    const op = mockOrdenes.find(o => o.idOrdenProceso === fc.idOrdenProceso)
    if (filtros.OrdenProceso && !op?.numeroOrdenProceso.toLowerCase().includes(filtros.OrdenProceso.toLowerCase())) return false
    if (filtros.IdEstado && fc.idEstado !== Number(filtros.IdEstado)) return false
    return true
  })

  const columns: Column<FormulaControl>[] = [
    {
      key: 'idFormulaControl', header: 'FC', width: '6%',
      render: r => (
        <span style={{ fontFamily: 'var(--f-mono)', fontWeight: 800, color: '#0A2D63' }}>
          FC-{r.idFormulaControl}
        </span>
      ),
    },
    {
      key: 'idOrdenProceso', header: 'Orden de Proceso', width: '12%',
      render: r => {
        const op = mockOrdenes.find(o => o.idOrdenProceso === r.idOrdenProceso)
        return (
          <span style={{ fontFamily: 'var(--f-mono)', fontSize: 12, color: '#334155' }}>
            {op?.numeroOrdenProceso ?? `OP-${r.idOrdenProceso}`}
          </span>
        )
      },
    },
    {
      key: 'material', header: 'Material', width: '14%',
      render: r => {
        const op = mockOrdenes.find(o => o.idOrdenProceso === r.idOrdenProceso)
        return <span style={{ fontSize: 12 }}>{op?.codigoMaterial ?? '—'}</span>
      },
    },
    {
      key: 'idRecetaMaestra', header: 'Receta Maestra', width: '12%',
      render: r => {
        const rm = mockRecetas.find(rm => rm.idRecetaMaestra === r.idRecetaMaestra)
        return rm
          ? <span style={{ fontFamily: 'var(--f-mono)', fontSize: 12, color: '#2D5D4A' }}>{rm.codigo}</span>
          : <span style={{ color: '#94A3B8', fontSize: 12 }}>—</span>
      },
    },
    {
      key: 'idEstado', header: 'Estado', width: '14%',
      render: r => {
        const cfg = ESTADO[r.idEstado] ?? ESTADO[1]
        return (
          <span style={{ padding: '2px 9px', background: cfg.bg, color: cfg.color,
            borderRadius: 20, fontSize: 10.5, fontWeight: 700 }}>
            {cfg.label}
          </span>
        )
      },
    },
    {
      key: 'fechaCreacion', header: 'Creación', width: '10%',
      render: r => (
        <span style={{ fontSize: 12, color: '#64748B' }}>
          {new Date(r.fechaCreacion).toLocaleDateString('es-CO')}
        </span>
      ),
    },
    {
      key: 'ver', header: '', width: '5%', align: 'center',
      render: r => (
        <button onClick={() => navigate(`/formulas-control/${r.idFormulaControl}`)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0A2D63', fontSize: 14 }}
          title="Ver detalle">
          <i className="fa fa-eye" />
        </button>
      ),
    },
  ]

  return (
    <>
      <Panel title={<><i className="fa fa-search" /> Buscar fórmulas</>} collapsible>
        <div className="form-horizontal">
          <div className="grid-row">
            <div className="form-group">
              <label>Orden de Proceso</label>
              <input className="form-control input-sm" value={filtros.OrdenProceso}
                placeholder="Ej: OP-SNX-001"
                onChange={e => setFiltros(f => ({ ...f, OrdenProceso: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Estado</label>
              <select className="form-control input-sm" value={filtros.IdEstado}
                onChange={e => setFiltros(f => ({ ...f, IdEstado: e.target.value }))}>
                <option value="">-- Todos --</option>
                <option value="1">En Tratamiento</option>
                <option value="2">Enviada a Producción</option>
                <option value="3">Cancelada</option>
              </select>
            </div>
          </div>
          <div className="form-actions">
            <button className="btn btn-gray"
              onClick={() => setFiltros({ OrdenProceso: '', IdEstado: '' })}>
              <i className="fa fa-undo" /> Limpiar
            </button>
            <button className="btn btn-primary" onClick={() => refetch()}>
              <i className="fa fa-search" /> Buscar
            </button>
          </div>
        </div>
      </Panel>

      <Panel title="Resultado de la búsqueda">
        <DataTable<FormulaControl> columns={columns} data={filtered} loading={isLoading} />
      </Panel>
    </>
  )
}

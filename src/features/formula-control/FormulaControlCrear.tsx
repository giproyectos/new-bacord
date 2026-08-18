import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { formulaControlApi } from '@/api/formulaControl'
import { mockOrdenes, mockFormulasControl } from '@/api/mock'
import { Panel } from '@/components/shared/Panel'

const ESTADO_OP: Record<number, string> = { 1: 'Disponible', 2: 'En FC', 3: 'En Producción' }

export function FormulaControlCrear() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [idOrden, setIdOrden] = useState('')
  const [error, setError] = useState('')

  // Only show OPs without an active FC
  const opesDisponibles = mockOrdenes.filter(op => {
    const tieneFC = mockFormulasControl.some(
      fc => fc.idOrdenProceso === op.idOrdenProceso && fc.idEstado !== 3
    )
    return !tieneFC
  })

  const mutation = useMutation({
    mutationFn: (idOP: number) => formulaControlApi.crear(idOP),
    onSuccess: (fc) => {
      queryClient.invalidateQueries({ queryKey: ['formulas-control'] })
      navigate(`/formulas-control/${fc.idFormulaControl}`)
    },
    onError: (e: Error) => setError(e.message),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!idOrden) { setError('Seleccione una Orden de Proceso'); return }
    setError('')
    mutation.mutate(Number(idOrden))
  }

  const selected = mockOrdenes.find(o => o.idOrdenProceso === Number(idOrden))

  return (
    <Panel title="Nueva Fórmula de Control">
      <form onSubmit={handleSubmit} style={{ maxWidth: 560 }}>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 6 }}>
            Orden de Proceso <span style={{ color: '#DC2626' }}>*</span>
          </label>
          <select
            className="form-control"
            value={idOrden}
            onChange={e => { setIdOrden(e.target.value); setError('') }}
            required>
            <option value="">— Seleccione una orden —</option>
            {opesDisponibles.map(op => (
              <option key={op.idOrdenProceso} value={op.idOrdenProceso}>
                {op.numeroOrdenProceso} · {op.descripcionMaterial}
              </option>
            ))}
          </select>
          {opesDisponibles.length === 0 && (
            <div style={{ marginTop: 8, fontSize: 12.5, color: '#92400E', background: '#FEF3C7', borderRadius: 6, padding: '6px 10px' }}>
              No hay Órdenes de Proceso disponibles sin Fórmula de Control activa.
            </div>
          )}
        </div>

        {selected && (
          <div style={{ marginBottom: 20, padding: '14px 16px', background: '#EFF6FF', borderRadius: 10, border: '1px solid #BFDBFE' }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: '#1E40AF', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>
              Detalle de la Orden Seleccionada
            </div>
            {[
              ['Número OP',       selected.numeroOrdenProceso],
              ['Material',        selected.descripcionMaterial],
              ['Código',          selected.codigoMaterial],
              ['Lote Logístico',  selected.loteLogistico],
              ['Cantidad',        `${selected.cantidadOrden.toLocaleString('es-CO')} ${selected.unidadMedida}`],
              ['Fecha Fab.',      selected.fechaFabricacion],
              ['Fecha Cad.',      selected.fechaCaducidad],
              ['Estado OP',       ESTADO_OP[selected.idEstado] ?? '—'],
            ].map(([lbl, val]) => (
              <div key={lbl} style={{ display: 'flex', gap: 8, marginBottom: 4, fontSize: 12.5 }}>
                <span style={{ fontWeight: 600, color: '#1E40AF', minWidth: 120 }}>{lbl}:</span>
                <span style={{ color: '#1E3A8A', fontFamily: 'var(--f-mono)' }}>{val}</span>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div style={{ marginBottom: 14, padding: '8px 12px', background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 8, fontSize: 12.5, color: '#B91C1C', display: 'flex', gap: 7, alignItems: 'center' }}>
            <i className="fa fa-exclamation-circle" /> {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn btn-gray" onClick={() => navigate('/formulas-control')}>
            <i className="fa fa-undo" /> Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={!idOrden || mutation.isPending}>
            {mutation.isPending ? <><i className="fa fa-spinner fa-spin" /> Creando...</> : <><i className="fa fa-plus" /> Crear Fórmula de Control</>}
          </button>
        </div>
      </form>
    </Panel>
  )
}

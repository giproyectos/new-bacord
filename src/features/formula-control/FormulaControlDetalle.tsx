import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Panel } from '@/components/shared/Panel'
import { formulaControlApi } from '@/api/formulaControl'
import { ordenProcesoApi } from '@/api/ordenProceso'
import { mockRecetas, mockBatchRecords } from '@/api/mock'
import { Link } from 'react-router-dom'
import type { FormulaControl, OrdenProceso, ComponenteOrden, RecetaMaestra } from '@/types'

const ESTADO: Record<number, { label: string; bg: string; color: string }> = {
  1: { label: 'En Tratamiento', bg: '#FEF3C7', color: '#92400E' },
  2: { label: 'Enviada a Producción', bg: '#D1FAE5', color: '#065F46' },
  3: { label: 'Cancelada', bg: '#FEE2E2', color: '#991B1B' },
}

export function FormulaControlDetalle() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [fc, setFc] = useState<FormulaControl | null>(null)
  const [op, setOp] = useState<OrdenProceso | null>(null)
  const [receta, setReceta] = useState<RecetaMaestra | null>(null)
  const [componentes, setComponentes] = useState<ComponenteOrden[]>([])
  const [loading, setLoading] = useState(true)
  const [accion, setAccion] = useState<'enviar' | 'cancelar' | null>(null)
  const [procesando, setProcesando] = useState(false)

  useEffect(() => {
    if (!id) return
    formulaControlApi.find(Number(id)).then(async (fc) => {
      setFc(fc)
      const [op, comps] = await Promise.all([
        ordenProcesoApi.find(fc.idOrdenProceso),
        ordenProcesoApi.getComponentes(fc.idOrdenProceso),
      ])
      setOp(op)
      setComponentes(comps)
      setReceta(mockRecetas.find(r => r.idRecetaMaestra === fc.idRecetaMaestra) ?? null)
    }).finally(() => setLoading(false))
  }, [id])

  const ejecutar = async () => {
    if (!fc || !accion) return
    setProcesando(true)
    try {
      if (accion === 'enviar') {
        const br = await formulaControlApi.enviar(fc.idFormulaControl)
        navigate(`/batch-records/${br.idBatchRecord}/editar`)
      } else {
        await formulaControlApi.cancelar(fc.idFormulaControl)
        navigate('/formulas-control')
      }
    } finally {
      setProcesando(false)
      setAccion(null)
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
      <div style={{ width: 36, height: 36, border: '3px solid #E2E8F0', borderTopColor: '#0A2D63',
        borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (!fc) return <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>FC no encontrada.</div>

  const estadoCfg = ESTADO[fc.idEstado] ?? ESTADO[1]
  const activa = fc.idEstado === 1

  return (
    <>
      <style>{`
        .fc-det-card { background:#fff; border-radius:14px; border:1px solid rgba(10,21,48,0.08);
          box-shadow:0 2px 12px rgba(10,21,48,0.06); margin-bottom:16px; overflow:hidden; }
        .fc-comp-table { width:100%; border-collapse:collapse; font-size:12.5px; }
        .fc-comp-table th { background:#F4F3EE; padding:7px 12px; text-align:left;
          font-size:10px; font-weight:700; color:#94A3B8; text-transform:uppercase; letter-spacing:.07em; }
        .fc-comp-table td { padding:8px 12px; border-top:1px solid rgba(10,21,48,0.05); color:#334155; }
      `}</style>

      {/* Header strip */}
      <div className="fc-det-card" style={{ background: 'linear-gradient(135deg,#0A2D63 0%,#0D3575 100%)' }}>
        <div style={{ padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={() => navigate('/formulas-control')}
            style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 8, padding: '6px 14px', color: '#fff', fontSize: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <i className="fa fa-arrow-left" style={{ fontSize: 10 }} /> Volver
          </button>
          {(() => {
            const br = mockBatchRecords.find(b => b.idFormulaControl === fc.idFormulaControl)
            return br ? (
              <Link to={`/batch-records/${br.idBatchRecord}/editar`}
                style={{ background: 'rgba(247,201,46,0.18)', border: '1px solid rgba(247,201,46,0.35)',
                  borderRadius: 8, padding: '6px 14px', color: '#F7C92E', fontSize: 12, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, textDecoration: 'none', fontWeight: 700 }}>
                <i className="fa fa-file-alt" style={{ fontSize: 10 }} /> BR-{br.idBatchRecord}
              </Link>
            ) : null
          })()}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ fontFamily: 'var(--f-mono)', fontWeight: 800, fontSize: 16,
                color: '#FCD34D' }}>FC-{fc.idFormulaControl}</span>
              <span style={{ padding: '3px 10px', background: estadoCfg.bg,
                color: estadoCfg.color, borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                {estadoCfg.label}
              </span>
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
              Creada: {new Date(fc.fechaCreacion).toLocaleDateString('es-CO', { dateStyle: 'long' })}
            </div>
          </div>
          {activa && (
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button onClick={() => setAccion('cancelar')}
                style={{ background: 'rgba(220,38,38,0.2)', border: '1px solid rgba(220,38,38,0.4)',
                  borderRadius: 8, padding: '8px 16px', color: '#FCA5A5', fontSize: 12.5,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="fa fa-times-circle" /> Cancelar FC
              </button>
              <button onClick={() => setAccion('enviar')}
                style={{ background: '#2D5D4A', border: '1px solid #1E4535',
                  borderRadius: 8, padding: '8px 18px', color: '#fff', fontSize: 12.5,
                  cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="fa fa-paper-plane" /> Enviar a Producción
              </button>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        {/* OP Info */}
        <div className="fc-det-card" style={{ flex: 1 }}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(10,21,48,0.07)',
            fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.07em' }}>
            Orden de Proceso
          </div>
          <div style={{ padding: '14px 18px' }}>
            {op ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ fontFamily: 'var(--f-mono)', fontWeight: 800, color: '#0A2D63', fontSize: 14 }}>
                    {op.numeroOrdenProceso}
                  </span>
                  <span style={{ fontFamily: 'var(--f-mono)', fontSize: 12, color: '#475569',
                    background: '#F1F5F9', padding: '2px 8px', borderRadius: 6 }}>
                    {op.codigoMaterial}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: '#334155', marginBottom: 10 }}>{op.descripcionMaterial}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 20px' }}>
                  {[
                    ['Lote', op.loteLogistico],
                    ['Cantidad', `${op.cantidadOrden.toLocaleString('es-CO')} ${op.unidadMedida}`],
                    ['Fabricación', op.fechaFabricacion],
                    ['Caducidad', op.fechaCaducidad],
                    ['Reg. Sanitario', op.registroSanitario],
                    ['Centro', op.centro],
                  ].map(([lbl, val]) => (
                    <div key={lbl} style={{ fontSize: 11.5 }}>
                      <span style={{ color: '#94A3B8', fontWeight: 600 }}>{lbl}: </span>
                      <span style={{ color: '#334155', fontFamily: 'var(--f-mono)' }}>{val}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : <div style={{ color: '#94A3B8' }}>Cargando...</div>}
          </div>
        </div>

        {/* Receta Maestra */}
        <div className="fc-det-card" style={{ flex: 1 }}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(10,21,48,0.07)',
            fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.07em' }}>
            Receta Maestra
          </div>
          <div style={{ padding: '14px 18px' }}>
            {receta ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontFamily: 'var(--f-mono)', fontWeight: 800, color: '#0A2D63', fontSize: 14 }}>
                    {receta.codigo}
                  </span>
                  <span style={{ padding: '2px 8px', background: '#D1FAE5', color: '#065F46',
                    borderRadius: 20, fontSize: 10.5, fontWeight: 700 }}>v{receta.version} — {receta.estado}</span>
                </div>
                <div style={{ fontSize: 13, color: '#334155', marginBottom: 8 }}>{receta.descripcion}</div>
                <div style={{ fontSize: 11.5, color: '#64748B' }}>
                  <i className="fa fa-layer-group" style={{ marginRight: 5 }} />{receta.procesos}
                </div>
              </>
            ) : (
              <div style={{ color: '#F59E0B', fontSize: 13 }}>
                <i className="fa fa-exclamation-triangle" style={{ marginRight: 6 }} />Sin Receta Maestra
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Componentes de la OP */}
      <Panel title={<><i className="fa fa-cubes" /> Componentes / Materias Primas ({componentes.length})</>}>
        {componentes.length === 0 ? (
          <div style={{ color: '#94A3B8', fontSize: 13, fontStyle: 'italic' }}>
            Sin componentes registrados para esta orden.
          </div>
        ) : (
          <>
            <div style={{ padding: '8px 0 12px', fontSize: 12.5, color: '#64748B' }}>
              <i className="fa fa-info-circle" style={{ marginRight: 6, color: '#0A2D63' }} />
              Al enviar a producción, estos materiales se usarán para pre-llenar el formulario de pesaje (ET1-F2).
            </div>
            <table className="fc-comp-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descripción</th>
                  <th style={{ textAlign: 'right' }}>Cant. Teórica</th>
                  <th>UM</th>
                  <th>Lote</th>
                  <th>Lista Mat.</th>
                </tr>
              </thead>
              <tbody>
                {componentes.map(c => (
                  <tr key={c.idComponente}>
                    <td style={{ fontFamily: 'var(--f-mono)', fontWeight: 700, color: '#0A2D63' }}>
                      {c.codigoMaterialComponente}
                    </td>
                    <td>{c.descripcionMaterialComponente}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--f-mono)', fontWeight: 600 }}>
                      {c.cantidad.toLocaleString('es-CO', { maximumFractionDigits: 4 })}
                    </td>
                    <td>{c.unidadMedida}</td>
                    <td style={{ fontFamily: 'var(--f-mono)', color: '#64748B' }}>{c.loteComponente}</td>
                    <td style={{ fontFamily: 'var(--f-mono)', color: '#64748B' }}>{c.codigoListaMateriales}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Panel>

      {/* Modal de confirmación */}
      {accion && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(10,21,48,.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => !procesando && setAccion(null)}>
          <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 8px 40px rgba(10,21,48,.18)',
            width: '100%', maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(10,21,48,.08)',
              fontSize: 15, fontWeight: 700, color: '#0A1530', display: 'flex', justifyContent: 'space-between' }}>
              <span>
                {accion === 'enviar' ? '¿Enviar a Producción?' : '¿Cancelar Fórmula?'}
              </span>
              <button onClick={() => setAccion(null)} disabled={procesando}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#94A3B8' }}>×</button>
            </div>
            <div style={{ padding: '18px 24px', fontSize: 13.5, color: '#475569', lineHeight: 1.6 }}>
              {accion === 'enviar' ? (
                <>
                  Se creará un <strong>Batch Record</strong> vinculado a la FC-{fc.idFormulaControl}.
                  Los datos de la Orden de Proceso y los componentes se pre-llenarán automáticamente en
                  los formularios <strong>ET1-F1</strong> (Encabezado) y <strong>ET1-F2</strong> (Pesaje).
                </>
              ) : (
                <>¿Está seguro de cancelar la FC-{fc.idFormulaControl}? Esta acción no se puede deshacer.</>
              )}
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid rgba(10,21,48,.08)',
              display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-gray" onClick={() => setAccion(null)} disabled={procesando}>
                <i className="fa fa-undo" /> Cancelar
              </button>
              <button
                className={`btn ${accion === 'cancelar' ? 'btn-danger' : 'btn-primary'}`}
                onClick={ejecutar} disabled={procesando}>
                {procesando
                  ? <><i className="fa fa-spinner fa-spin" /> Procesando...</>
                  : accion === 'enviar'
                    ? <><i className="fa fa-paper-plane" /> Confirmar envío</>
                    : <><i className="fa fa-times-circle" /> Confirmar cancelación</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

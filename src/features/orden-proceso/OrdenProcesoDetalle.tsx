import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Panel } from '@/components/shared/Panel'
import { ordenProcesoApi } from '@/api/ordenProceso'
import { formulaControlApi } from '@/api/formulaControl'
import { recetaMaestraApi } from '@/api/recetaMaestra'
import { batchRecordApi } from '@/api/batchRecord'
import { usePuedeEditar } from '@/hooks/usePermisos'
import type { OrdenProceso, ComponenteOrden, FormulaControl, RecetaMaestra, BatchRecord } from '@/types'


const ESTADO_OP: Record<number, { label: string; bg: string; color: string }> = {
  1: { label: 'Liberada',   bg: 'rgba(209,250,229,0.15)', color: '#6EE7B7' },
  2: { label: 'En Proceso', bg: 'rgba(254,243,199,0.15)', color: '#FCD34D' },
  3: { label: 'Cerrada',    bg: 'rgba(241,245,249,0.15)', color: '#94A3B8' },
}

function MetaItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ padding: '10px 18px', borderRight: '1px solid rgba(10,21,48,0.06)', flexShrink: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase',
        letterSpacing: '0.08em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#0A1530',
        fontFamily: mono ? 'var(--f-mono)' : 'var(--f-sans)' }}>{value || '—'}</div>
    </div>
  )
}

export function OrdenProcesoDetalle() {
  const puedeEditarFC = usePuedeEditar('formulas-control')
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [op, setOp] = useState<OrdenProceso | null>(null)
  const [componentes, setComponetes] = useState<ComponenteOrden[]>([])
  const [receta, setReceta] = useState<RecetaMaestra | null>(null)
  const [fcExistente, setFcExistente] = useState<FormulaControl | null>(null)
  const [brExistente, setBrExistente] = useState<BatchRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [iniciando, setIniciando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    const idNum = Number(id)
    Promise.all([
      ordenProcesoApi.find(idNum),
      ordenProcesoApi.getComponentes(idNum),
      formulaControlApi.buscar(),
      batchRecordApi.buscar(),
    ]).then(([op, comps, fcs, brs]) => {
      setOp(op)
      setComponetes(comps)
      recetaMaestraApi.find(op.idRecetaMaestra).then(setReceta).catch(() => setReceta(null))
      const fc = fcs.find(f => f.idOrdenProceso === idNum && f.idEstado !== 3) ?? null
      setFcExistente(fc)
      setBrExistente(brs.find(b => b.idOrdenProceso === idNum) ?? null)
    }).finally(() => setLoading(false))
  }, [id])

  // Crea FC + envía (crea BR) en un solo paso y navega directo al BR
  const iniciarBatchRecord = async () => {
    if (!op) return
    setIniciando(true)
    setError('')
    try {
      let fc = fcExistente
      if (!fc) fc = await formulaControlApi.crear(op.idOrdenProceso)
      const br = await formulaControlApi.enviar(fc.idFormulaControl)
      navigate(`/batch-records/${br.idBatchRecord}/editar`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al iniciar el Batch Record')
      setIniciando(false)
    }
  }

  // Envía una FC ya existente (en tratamiento) y navega al BR
  const activarBatchRecord = async () => {
    if (!fcExistente) return
    setIniciando(true)
    setError('')
    try {
      const br = await formulaControlApi.enviar(fcExistente.idFormulaControl)
      navigate(`/batch-records/${br.idBatchRecord}/editar`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al activar el Batch Record')
      setIniciando(false)
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
      <div style={{ width: 36, height: 36, border: '3px solid #E2E8F0', borderTopColor: '#0A2D63',
        borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (!op) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>
      Orden de proceso no encontrada.
    </div>
  )


  return (
    <>
      <style>{`
        .op-det-card { background:#fff; border-radius:14px; border:1px solid rgba(10,21,48,0.08);
          box-shadow:0 2px 12px rgba(10,21,48,0.06); margin-bottom:16px; overflow:hidden; }
        .op-comp-table { width:100%; border-collapse:collapse; font-size:12.5px; }
        .op-comp-table th { background:#F4F3EE; padding:7px 12px; text-align:left;
          font-size:10px; font-weight:700; color:#94A3B8; text-transform:uppercase; letter-spacing:.07em; }
        .op-comp-table td { padding:8px 12px; border-top:1px solid rgba(10,21,48,0.05); color:#334155; }
        .op-comp-table tr:hover td { background:#FAFAF8; }
      `}</style>

      {/* Header strip */}
      <div className="op-det-card" style={{ background: 'linear-gradient(135deg,#0A2D63 0%,#0D3575 100%)', borderRadius: 14 }}>
        <div style={{ padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={() => navigate('/ordenes-proceso')}
            style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 8, padding: '6px 14px', color: '#fff', fontSize: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <i className="fa fa-arrow-left" style={{ fontSize: 10 }} /> Volver
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ fontFamily: 'var(--f-mono)', fontWeight: 800, fontSize: 15,
                color: '#FCD34D', letterSpacing: '0.04em' }}>{op.numeroOrdenProceso}</span>
              <span style={{ padding: '2px 10px', background: 'rgba(255,255,255,0.15)',
                borderRadius: 20, fontSize: 11, color: '#BAE6FD', fontWeight: 600 }}>
                {op.formaFarmaceutica}
              </span>
              {(() => { const cfg = ESTADO_OP[op.idEstado] ?? ESTADO_OP[1]; return (
                <span style={{ padding: '2px 10px', background: cfg.bg,
                  borderRadius: 20, fontSize: 11, color: cfg.color, fontWeight: 700,
                  border: `1px solid ${cfg.color}33` }}>
                  {cfg.label}
                </span>
              ) })()}
            </div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>
              {op.descripcionMaterial}
            </div>
          </div>
          <div style={{ flexShrink: 0, textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginBottom: 2 }}>Cantidad</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', fontFamily: 'var(--f-mono)' }}>
              {op.cantidadOrden.toLocaleString('es-CO')} <span style={{ fontSize: 13, fontWeight: 400 }}>{op.unidadMedida}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Metadata grid */}
      <div className="op-det-card">
        <div style={{ display: 'flex', flexWrap: 'wrap' }}>
          <MetaItem label="Código Material"    value={op.codigoMaterial}       mono />
          <MetaItem label="Lote Logístico"     value={op.loteLogistico}        mono />
          <MetaItem label="Lote Inspección"    value={op.loteInspeccion}       mono />
          <MetaItem label="Fecha Fabricación"  value={op.fechaFabricacion}     mono />
          <MetaItem label="Fecha Caducidad"    value={op.fechaCaducidad}       mono />
          <MetaItem label="Registro Sanitario" value={op.registroSanitario}    mono />
          <MetaItem label="Centro"             value={op.centro} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        {/* Receta Maestra */}
        <div className="op-det-card" style={{ flex: 1 }}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(10,21,48,0.07)',
            fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.07em' }}>
            Receta Maestra
          </div>
          {receta ? (
            <div style={{ padding: '14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontFamily: 'var(--f-mono)', fontWeight: 800, color: '#0A2D63', fontSize: 14 }}>
                  {receta.codigo}
                </span>
                <span style={{ padding: '2px 8px', background: '#D1FAE5', color: '#065F46',
                  borderRadius: 20, fontSize: 10.5, fontWeight: 700 }}>
                  v{receta.version}
                </span>
                <span style={{ padding: '2px 8px', background: '#D1FAE5', color: '#065F46',
                  borderRadius: 20, fontSize: 10.5, fontWeight: 700 }}>
                  {receta.estado}
                </span>
              </div>
              <div style={{ fontSize: 13, color: '#334155', marginBottom: 6 }}>{receta.descripcion}</div>
              <div style={{ fontSize: 11.5, color: '#64748B' }}>
                <i className="fa fa-layer-group" style={{ marginRight: 5 }} />{receta.procesos}
              </div>
              <Link to={`/recetas-maestras/${receta.idRecetaMaestra}/configurar`}
                style={{ fontSize: 11.5, color: '#0A2D63', marginTop: 8, display: 'inline-block' }}>
                Ver receta <i className="fa fa-external-link-alt" style={{ fontSize: 9 }} />
              </Link>
            </div>
          ) : (
            <div style={{ padding: '16px 18px', color: '#F59E0B', fontSize: 13 }}>
              <i className="fa fa-exclamation-triangle" style={{ marginRight: 6 }} />
              Sin Receta Maestra vinculada para <strong>{op.codigoMaterial}</strong>
            </div>
          )}
        </div>

        {/* Batch Record */}
        {(() => {
          const fcEnTratamiento = fcExistente && fcExistente.idEstado === 1 && !brExistente

          return (
            <div className="op-det-card" style={{ flex: 1 }}>
              <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(10,21,48,0.07)',
                fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.07em' }}>
                Batch Record
              </div>
              <div style={{ padding: '18px 18px' }}>

                {/* ── BR ya existe → acceso directo ── */}
                {brExistente ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontFamily: 'var(--f-mono)', fontWeight: 800, color: '#0A2D63', fontSize: 16 }}>
                        BR-{brExistente.idBatchRecord}
                      </span>
                      <span style={{ padding: '2px 9px', background: '#DBEAFE', color: '#1D4ED8',
                        borderRadius: 20, fontSize: 10.5, fontWeight: 700 }}>En Tratamiento</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#64748B', marginBottom: 16 }}>
                      Iniciado: {new Date(brExistente.fechaCreacion).toLocaleDateString('es-CO')}
                      {fcExistente && (
                        <> · <Link to={`/formulas-control/${fcExistente.idFormulaControl}`}
                          style={{ color: '#64748B', textDecoration: 'underline dotted' }}>
                          FC-{fcExistente.idFormulaControl}
                        </Link></>
                      )}
                    </div>
                    <Link
                      to={`/batch-records/${brExistente.idBatchRecord}/editar`}
                      className="btn btn-primary"
                      style={{ fontSize: 13, padding: '9px 20px', display: 'inline-flex', alignItems: 'center', gap: 8 }}
                    >
                      <i className="fa fa-file-alt" /> Abrir Batch Record
                    </Link>
                  </>
                ) : fcEnTratamiento ? (
                  /* ── FC existe pero BR no se ha generado aún ── */
                  <>
                    <div style={{ fontSize: 13, color: '#64748B', marginBottom: 6 }}>
                      Fórmula de Control preparada.
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                      <span style={{ fontFamily: 'var(--f-mono)', fontSize: 12, color: '#92400E' }}>
                        FC-{fcExistente!.idFormulaControl}
                      </span>
                      <span style={{ padding: '2px 8px', background: '#FEF3C7', color: '#92400E',
                        borderRadius: 20, fontSize: 10.5, fontWeight: 700 }}>En tratamiento</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <button
                        className="btn btn-primary"
                        onClick={activarBatchRecord}
                        disabled={iniciando || !puedeEditarFC}
                        style={{ fontSize: 13, padding: '9px 20px', display: 'inline-flex', alignItems: 'center', gap: 8 }}
                      >
                        {iniciando
                          ? <><i className="fa fa-spinner fa-spin" /> Iniciando...</>
                          : <><i className="fa fa-play" /> Iniciar Batch Record</>}
                      </button>
                      <Link to={`/formulas-control/${fcExistente!.idFormulaControl}`}
                        style={{ fontSize: 12, color: '#64748B' }}>
                        Ver FC <i className="fa fa-external-link-alt" style={{ fontSize: 9 }} />
                      </Link>
                    </div>
                  </>
                ) : (
                  /* ── Sin FC ni BR ── */
                  <>
                    <div style={{ fontSize: 13, color: '#64748B', marginBottom: 16, lineHeight: 1.6 }}>
                      {receta
                        ? 'Esta orden está lista para iniciar producción.'
                        : 'Se requiere una Receta Maestra vinculada antes de iniciar.'}
                    </div>
                    <button
                      className="btn btn-primary"
                      onClick={iniciarBatchRecord}
                      disabled={!receta || iniciando || !puedeEditarFC}
                      title={!puedeEditarFC ? 'No tiene permiso de edición en Fórmulas de Control' : !receta ? 'Requiere Receta Maestra vinculada' : ''}
                      style={{ fontSize: 13, padding: '9px 20px', display: 'inline-flex', alignItems: 'center', gap: 8 }}
                    >
                      {iniciando
                        ? <><i className="fa fa-spinner fa-spin" /> Iniciando...</>
                        : <><i className="fa fa-play" /> Iniciar Batch Record</>}
                    </button>
                  </>
                )}

                {error && (
                  <div style={{ fontSize: 12, color: '#991B1B', background: '#FEF2F2',
                    border: '1px solid #FECACA', borderRadius: 6, padding: '7px 10px', marginTop: 12,
                    display: 'flex', alignItems: 'center', gap: 6 }}>
                    <i className="fa fa-exclamation-circle" /> {error}
                  </div>
                )}
              </div>
            </div>
          )
        })()}
      </div>

      {/* Componentes */}
      <Panel title={
        <><i className="fa fa-cubes" /> Componentes ({componentes.length})</>
      }>
        {componentes.length === 0 ? (
          <div style={{ color: '#94A3B8', fontSize: 13, fontStyle: 'italic' }}>
            Sin componentes registrados para esta orden.
          </div>
        ) : (
          <table className="op-comp-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Descripción</th>
                <th style={{ textAlign: 'right' }}>Cant. Teórica</th>
                <th>UM</th>
                <th>Lote</th>
                <th>Lista Materiales</th>
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
        )}
      </Panel>
    </>
  )
}

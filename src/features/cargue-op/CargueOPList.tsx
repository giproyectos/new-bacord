import { useState, useCallback, useEffect } from 'react'
import { Panel } from '@/components/shared/Panel'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { mockRecetas, mockMateriales } from '@/api/mock'
import { ordenProcesoApi } from '@/api/ordenProceso'
import type { RecetaMaestra, CargueRegistro, OrdenProceso, ComponenteOrden } from '@/types'

// ── Internal parsed types ─────────────────────────────────────────────────────
interface ParsedComponente extends Omit<ComponenteOrden, 'idComponente' | 'idOrdenProceso'> {
  errors: string[]
}

interface ParsedOP {
  rowNum: number
  numeroOrdenProceso: string
  codigoMaterial: string
  descripcionMaterial: string
  centro: string
  loteLogistico: string
  cantidadOrden: number
  unidadMedida: string
  loteInspeccion: string
  fechaFabricacion: string
  fechaCaducidad: string
  registroSanitario: string
  formaFarmaceutica: string
  componentes: ParsedComponente[]
  errors: string[]
  recetaMatch: RecetaMaestra | null
}

interface ParseResult {
  ordenes: ParsedOP[]
  invalidas: { rowNum: number; mensaje: string }[]
}

// Handles "312.500,0000" (Spanish/Excel locale) and "312500.0000" (spec standard)
function parseNum(s: string): number {
  if (!s) return NaN
  const clean = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s
  return parseFloat(clean)
}

// RFC 4180-compliant CSV line splitter — handles quoted fields with commas inside
function splitCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current.trim())
  return fields
}

// ── Core parser (takes pre-split rows) ───────────────────────────────────────
function parsearFilas(filas: string[][]): ParseResult {
  const cabeceraMap: Record<string, ParsedOP> = {}
  const invalidas: { rowNum: number; mensaje: string }[] = []

  for (let i = 0; i < filas.length; i++) {
    const rowNum = i + 1
    const fields = filas[i]

    if (fields.length >= 9) {
      // ── CABECERA ──
      const [numOP, codMat, descMat, centro, loteLog, cantStr, um = '', loteInsp = '',
             fechaFab = '', fechaCad = '', regSan = '', formaFarm = ''] = fields
      const errors: string[] = []
      if (!numOP)    errors.push('Número de Orden requerido')
      if (!codMat)   errors.push('Código de Material requerido')
      if (!descMat)  errors.push('Descripción de Material requerida')
      if (!loteLog)  errors.push('Lote Logístico requerido')
      const cantidad = parseNum(cantStr)
      if (!cantStr || isNaN(cantidad)) errors.push('Cantidad inválida (debe ser numérico)')
      if (cabeceraMap[numOP]) errors.push(`OP "${numOP}" duplicada en el archivo`)

      cabeceraMap[numOP] = {
        rowNum, numeroOrdenProceso: numOP,
        codigoMaterial: codMat, descripcionMaterial: descMat,
        centro, loteLogistico: loteLog,
        cantidadOrden: isNaN(cantidad) ? 0 : cantidad,
        unidadMedida: um, loteInspeccion: loteInsp,
        fechaFabricacion: fechaFab, fechaCaducidad: fechaCad,
        registroSanitario: regSan, formaFarmaceutica: formaFarm,
        componentes: [], errors, recetaMatch: null,
      }

    } else if (fields.length >= 4) {
      // ── DETALLE ──
      const [numOP, codMatComp, descMatComp, cantStr, um = '', loteComp = '', codLista = ''] = fields
      const errors: string[] = []
      if (!numOP)       errors.push('Número de Orden requerido')
      if (!codMatComp)  errors.push('Código de componente requerido')
      if (!descMatComp) errors.push('Descripción de componente requerida')
      const cantidad = parseNum(cantStr)
      if (!cantStr || isNaN(cantidad)) errors.push('Cantidad inválida')

      if (numOP && !cabeceraMap[numOP]) {
        invalidas.push({ rowNum, mensaje: `Fila ${rowNum}: DETALLE referencia OP "${numOP}" que no aparece como CABECERA` })
      } else if (numOP && cabeceraMap[numOP]) {
        cabeceraMap[numOP].componentes.push({
          codigoMaterialComponente: codMatComp,
          descripcionMaterialComponente: descMatComp,
          cantidad: isNaN(cantidad) ? 0 : cantidad,
          unidadMedida: um, loteComponente: loteComp,
          codigoListaMateriales: codLista, errors,
        })
      }

    } else {
      invalidas.push({
        rowNum,
        mensaje: `Fila ${rowNum}: ${fields.length} campo${fields.length !== 1 ? 's' : ''} — mínimo 9 para CABECERA o 4 para DETALLE`,
      })
    }
  }

  // Match with RecetaMaestra by material code
  for (const op of Object.values(cabeceraMap)) {
    const mat = mockMateriales.find(m => m.codigo === op.codigoMaterial)
    if (mat) {
      op.recetaMatch = mockRecetas.find(r =>
        r.idMateriales.split(',').map(s => s.trim()).includes(String(mat.id))
      ) ?? null
    }
  }

  return { ordenes: Object.values(cabeceraMap), invalidas }
}

// ── CSV parser ────────────────────────────────────────────────────────────────
function parsearCSV(text: string): ParseResult {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0)
  return parsearFilas(lines.map(splitCSVLine))
}

// ── XLSX parser — first cell must be a code (no spaces, alphanumeric+hyphens) ──
const isDataCode = (v: unknown): boolean =>
  typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(v.trim())

async function parsearXLSX(data: ArrayBuffer): Promise<ParseResult> {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(data, { type: 'array', cellDates: true })
  const sheetName = wb.SheetNames.includes('Cargue_Ordenes') ? 'Cargue_Ordenes' : wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true }) as unknown[][]

  const filas: string[][] = rawRows
    .filter(row => isDataCode((row as unknown[])?.[0]))
    .map(row =>
      (row as unknown[]).map(cell => {
        if (cell === null || cell === undefined) return ''
        if (cell instanceof Date) {
          const m = String(cell.getMonth() + 1).padStart(2, '0')
          const d = String(cell.getDate()).padStart(2, '0')
          return `${m}/${d}/${cell.getFullYear()}`
        }
        return String(cell).trim()
      })
    )

  return parsearFilas(filas)
}

// ── Historial columns ─────────────────────────────────────────────────────────
const histCols: Column<CargueRegistro>[] = [
  { key: 'archivo',          header: 'Archivo' },
  { key: 'fechaCargue',      header: 'Fecha',       width: '11%' },
  { key: 'usuario',          header: 'Usuario',     width: '9%' },
  { key: 'totalOrdenes',     header: 'Órdenes',     width: '8%', align: 'center' },
  { key: 'totalComponentes', header: 'Componentes', width: '11%', align: 'center' },
  {
    key: 'errores', header: 'Errores', width: '8%', align: 'center',
    render: r => (
      <span style={{ color: r.errores > 0 ? '#DC2626' : '#2D5D4A', fontWeight: 700 }}>
        {r.errores}
      </span>
    ),
  },
  {
    key: 'estado', header: 'Estado', width: '12%',
    render: r => {
      const cfg = r.estado === 'Exitoso'
        ? { bg: '#D1FAE5', color: '#065F46' }
        : r.estado === 'Con errores'
          ? { bg: '#FEF3C7', color: '#92400E' }
          : { bg: '#FEE2E2', color: '#991B1B' }
      return (
        <span style={{ ...cfg, padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
          {r.estado}
        </span>
      )
    },
  },
]

// ── Component ─────────────────────────────────────────────────────────────────
export function CargueOPList() {
  const [step, setStep] = useState<'idle' | 'preview' | 'saving' | 'done'>('idle')
  const [file, setFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<ParseResult | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [dragOver, setDragOver] = useState(false)
  const [historial, setHistorial] = useState<CargueRegistro[]>([])

  useEffect(() => {
    ordenProcesoApi.buscarCargues().then(setHistorial)
  }, [])

  const procesar = useCallback(async (f: File) => {
    setFile(f)
    const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
    try {
      if (ext === 'xlsx' || ext === 'xls') {
        const buf = await f.arrayBuffer()
        setParsed(await parsearXLSX(buf))
      } else {
        setParsed(parsearCSV(await f.text()))
      }
      setStep('preview')
    } catch (err) {
      console.error('Error procesando archivo:', err)
    }
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) procesar(f)
  }, [procesar])

  const toggleExpand = (numOP: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(numOP) ? next.delete(numOP) : next.add(numOP)
      return next
    })
  }

  const resetear = () => {
    setStep('idle'); setFile(null); setParsed(null); setExpanded(new Set())
  }

  const confirmar = async () => {
    if (!parsed || !file) return
    setStep('saving')

    const ordenesPayload: Omit<OrdenProceso, 'idOrdenProceso'>[] = parsed.ordenes.map(op => ({
      idRecetaMaestra: op.recetaMatch?.idRecetaMaestra ?? 0,
      numeroOrdenProceso: op.numeroOrdenProceso,
      codigoMaterial: op.codigoMaterial,
      descripcionMaterial: op.descripcionMaterial,
      idCentro: 1, centro: op.centro,
      loteLogistico: op.loteLogistico,
      cantidadOrden: op.cantidadOrden,
      unidadMedida: op.unidadMedida,
      loteInspeccion: op.loteInspeccion,
      fechaFabricacion: op.fechaFabricacion,
      fechaCaducidad: op.fechaCaducidad,
      registroSanitario: op.registroSanitario,
      formaFarmaceutica: op.formaFarmaceutica,
      idEstado: 1,
    }))

    const compPayload: Omit<ComponenteOrden, 'idComponente' | 'idOrdenProceso'>[][] =
      parsed.ordenes.map(op => op.componentes.map(c => ({
        codigoMaterialComponente: c.codigoMaterialComponente,
        descripcionMaterialComponente: c.descripcionMaterialComponente,
        cantidad: c.cantidad,
        unidadMedida: c.unidadMedida,
        loteComponente: c.loteComponente,
        codigoListaMateriales: c.codigoListaMateriales,
      })))

    const res = await ordenProcesoApi.confirmarCargue(ordenesPayload, compPayload)

    if (res.estado) {
      const totalErrors = parsed.invalidas.length + parsed.ordenes.filter(o => o.errors.length > 0).length
      const nuevoRegistro: CargueRegistro = {
        id: Date.now(),
        archivo: file.name,
        fechaCargue: new Date().toISOString().split('T')[0],
        usuario: 'admin',
        totalOrdenes: parsed.ordenes.length,
        totalComponentes: res.datos?.totalComponentes ?? 0,
        errores: totalErrors,
        estado: totalErrors === 0 ? 'Exitoso' : 'Con errores',
      }
      setHistorial(h => [nuevoRegistro, ...h])
    }
    setStep('done')
  }

  // Derived counts
  const totalValidErrors = parsed
    ? parsed.invalidas.length + parsed.ordenes.filter(o => o.errors.length > 0).length
    : 0
  const totalComponentes = parsed?.ordenes.reduce((s, o) => s + o.componentes.length, 0) ?? 0
  const totalSinRM = parsed?.ordenes.filter(o => !o.recetaMatch).length ?? 0

  // ── Done ────────────────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div style={{ maxWidth: 560, margin: '64px auto', textAlign: 'center', padding: '40px 32px',
        background: '#fff', borderRadius: 16, border: '1px solid rgba(10,21,48,0.08)',
        boxShadow: '0 4px 24px rgba(10,21,48,0.08)' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#D1FAE5',
          display: 'grid', placeItems: 'center', margin: '0 auto 20px' }}>
          <i className="fa fa-check" style={{ fontSize: 26, color: '#2D5D4A' }} />
        </div>
        <h3 style={{ color: '#0A1530', marginBottom: 8, fontSize: 18 }}>Cargue completado</h3>
        <p style={{ color: '#64748B', marginBottom: 6, fontSize: 13.5 }}>
          <strong>{parsed?.ordenes.length}</strong> órdenes y{' '}
          <strong>{totalComponentes}</strong> componentes procesados.
        </p>
        {totalSinRM > 0 && (
          <p style={{ color: '#92400E', background: '#FEF3C7', borderRadius: 8, padding: '8px 14px',
            fontSize: 12.5, marginBottom: 16 }}>
            <i className="fa fa-exclamation-triangle" style={{ marginRight: 6 }} />
            {totalSinRM} orden{totalSinRM > 1 ? 'es' : ''} sin Receta Maestra vinculada — revísalas en el módulo de Órdenes de Proceso.
          </p>
        )}
        <button className="btn btn-primary" onClick={resetear}>
          <i className="fa fa-plus" /> Nuevo cargue
        </button>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        .cop-drop { border: 2px dashed rgba(10,21,48,0.18); border-radius: 12px; padding: 40px 24px;
          text-align: center; cursor: pointer; transition: all 140ms; background: #FAFAF8;
          display: block; }
        .cop-drop:hover, .cop-drop.drag-over { border-color: #0A2D63; background: rgba(10,45,99,0.04); }
        .cop-drop i.drop-icon { font-size: 34px; color: #C4CDD6; margin-bottom: 12px; display: block; }
        .cop-drop p { margin: 0; color: #64748B; }
        .cop-op-row { border: 1px solid rgba(10,21,48,0.09); border-radius: 9px; margin-bottom: 8px;
          overflow: hidden; background: #fff; }
        .cop-op-hdr { display: flex; align-items: center; gap: 12px; padding: 11px 14px;
          cursor: pointer; user-select: none; transition: background 100ms; }
        .cop-op-hdr:hover { background: #FAFAF8; }
        .cop-badge { padding: 2px 8px; border-radius: 20px; font-size: 10.5px; font-weight: 700;
          white-space: nowrap; flex-shrink: 0; }
        .cop-badge-ok   { background: #D1FAE5; color: #065F46; }
        .cop-badge-warn { background: #FEF3C7; color: #92400E; }
        .cop-badge-err  { background: #FEE2E2; color: #991B1B; }
        .cop-comp-table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .cop-comp-table th { background: #F4F3EE; padding: 6px 10px; text-align: left;
          font-size: 10px; font-weight: 700; color: #94A3B8; text-transform: uppercase;
          letter-spacing: 0.07em; }
        .cop-comp-table td { padding: 7px 10px; border-top: 1px solid rgba(10,21,48,0.05);
          color: #334155; }
        .cop-comp-table tr.has-err { background: #FFF5F5; }
      `}</style>

      {/* ── Upload / Preview panel ── */}
      <Panel title={
        step === 'preview'
          ? <><i className="fa fa-table" /> Vista previa del cargue</>
          : <><i className="fa fa-upload" /> Cargue de Órdenes de Proceso</>
      }>
        {/* ── IDLE: dropzone ── */}
        {step === 'idle' && (
          <label
            className={`cop-drop${dragOver ? ' drag-over' : ''}`}
            htmlFor="cop-file-input"
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            <i className="fa fa-cloud-upload-alt drop-icon" />
            <p style={{ fontSize: 14, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
              Arrastra el archivo aquí o haz clic para seleccionar
            </p>
            <p style={{ fontSize: 12, marginBottom: 4 }}>
              Formatos soportados: <strong>XLSX</strong> · <strong>CSV</strong> · <strong>TXT</strong>
            </p>
            <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 8 }}>
              CABECERA: 12 campos (OP, material, lote, cantidades, fechas)&nbsp;&nbsp;·&nbsp;&nbsp;
              DETALLE: 7 campos (componente, cantidad, lote)
            </p>
            <input
              id="cop-file-input" type="file" style={{ display: 'none' }}
              accept=".csv,.txt,.xlsx,.xls"
              onChange={e => { const f = e.target.files?.[0]; if (f) procesar(f) }}
            />
          </label>
        )}

        {/* ── SAVING: spinner ── */}
        {step === 'saving' && (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{ width: 44, height: 44, border: '4px solid #E2E8F0', borderTopColor: '#0A2D63',
              borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 16px' }} />
            <p style={{ color: '#64748B', fontSize: 13 }}>Procesando órdenes de proceso...</p>
          </div>
        )}

        {/* ── PREVIEW ── */}
        {step === 'preview' && parsed && (
          <>
            {/* Summary bar */}
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10,
              padding: '10px 14px', background: '#F8F7F2', borderRadius: 8, marginBottom: 14,
              border: '1px solid rgba(10,21,48,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="fa fa-file-csv" style={{ color: '#0A2D63', fontSize: 13 }} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: '#0A1530', fontFamily: 'var(--f-mono)' }}>
                  {file?.name}
                </span>
              </div>
              <span style={{ color: '#CBD5E1' }}>|</span>
              <span style={{ fontSize: 12, color: '#334155' }}>
                <strong>{parsed.ordenes.length}</strong> órdenes
              </span>
              <span style={{ fontSize: 12, color: '#334155' }}>
                <strong>{totalComponentes}</strong> componentes
              </span>
              {totalSinRM > 0 && (
                <span className="cop-badge cop-badge-warn">
                  <i className="fa fa-exclamation-triangle" /> {totalSinRM} sin RM
                </span>
              )}
              {totalValidErrors > 0
                ? <span className="cop-badge cop-badge-err">
                    <i className="fa fa-times-circle" /> {totalValidErrors} error{totalValidErrors > 1 ? 'es' : ''}
                  </span>
                : <span className="cop-badge cop-badge-ok">
                    <i className="fa fa-check" /> Sin errores
                  </span>
              }
              <button onClick={resetear}
                style={{ marginLeft: 'auto', background: 'none', border: '1px solid rgba(10,21,48,0.15)',
                  borderRadius: 6, padding: '4px 12px', fontSize: 11.5, cursor: 'pointer', color: '#64748B' }}>
                <i className="fa fa-undo" /> Cambiar archivo
              </button>
            </div>

            {/* Líneas inválidas */}
            {parsed.invalidas.length > 0 && (
              <div style={{ background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 8,
                padding: '10px 14px', marginBottom: 12 }}>
                <div style={{ fontWeight: 700, color: '#991B1B', marginBottom: 6, fontSize: 12.5 }}>
                  <i className="fa fa-exclamation-circle" /> {parsed.invalidas.length} línea{parsed.invalidas.length > 1 ? 's' : ''} no procesada{parsed.invalidas.length > 1 ? 's' : ''}
                </div>
                {parsed.invalidas.map((e, i) => (
                  <div key={i} style={{ color: '#7F1D1D', fontFamily: 'var(--f-mono)', fontSize: 11, lineHeight: 1.6 }}>
                    · {e.mensaje}
                  </div>
                ))}
              </div>
            )}

            {/* OP rows */}
            {parsed.ordenes.map(op => {
              const isOpen  = expanded.has(op.numeroOrdenProceso)
              const hasErrs = op.errors.length > 0
              const hasRM   = !!op.recetaMatch
              return (
                <div key={op.numeroOrdenProceso} className="cop-op-row">
                  {/* Header */}
                  <div className="cop-op-hdr" onClick={() => toggleExpand(op.numeroOrdenProceso)}>
                    <i className={`fa fa-chevron-${isOpen ? 'down' : 'right'}`}
                      style={{ fontSize: 10, color: '#94A3B8', flexShrink: 0 }} />

                    <span style={{ fontFamily: 'var(--f-mono)', fontWeight: 800, fontSize: 13,
                      color: '#0A2D63', flexShrink: 0 }}>
                      {op.numeroOrdenProceso}
                    </span>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 12.5, color: '#0A1530', fontWeight: 600 }}>
                        {op.codigoMaterial}
                      </span>
                      <span style={{ fontSize: 11.5, color: '#94A3B8', marginLeft: 8 }}>
                        {op.descripcionMaterial}
                      </span>
                    </div>

                    <span style={{ fontSize: 12, color: '#475569', fontFamily: 'var(--f-mono)',
                      flexShrink: 0 }}>
                      {op.cantidadOrden.toLocaleString('es-CO')} {op.unidadMedida}
                    </span>

                    <span style={{ fontSize: 11.5, color: '#64748B', flexShrink: 0 }}>
                      <i className="fa fa-cubes" style={{ marginRight: 4, color: '#94A3B8' }} />
                      {op.componentes.length}
                    </span>

                    {hasRM
                      ? <span className="cop-badge cop-badge-ok" title={op.recetaMatch!.descripcion}>
                          <i className="fa fa-link" /> {op.recetaMatch!.codigo}
                        </span>
                      : <span className="cop-badge cop-badge-warn">
                          <i className="fa fa-unlink" /> Sin Receta Maestra
                        </span>
                    }

                    {hasErrs && (
                      <span className="cop-badge cop-badge-err" title={op.errors.join(' | ')}>
                        <i className="fa fa-exclamation-circle" /> {op.errors.length} error{op.errors.length > 1 ? 'es' : ''}
                      </span>
                    )}
                  </div>

                  {/* Expanded content */}
                  {isOpen && (
                    <div style={{ borderTop: '1px solid rgba(10,21,48,0.07)' }}>
                      {/* Field grid */}
                      <div style={{ display: 'flex', flexWrap: 'wrap',
                        borderBottom: '1px solid rgba(10,21,48,0.07)' }}>
                        {([
                          ['Lote Logístico',    op.loteLogistico],
                          ['Lote Inspección',   op.loteInspeccion],
                          ['Fecha Fabricación', op.fechaFabricacion],
                          ['Fecha Caducidad',   op.fechaCaducidad],
                          ['Registro Sanitario', op.registroSanitario],
                          ['Forma Farmacéutica', op.formaFarmaceutica],
                          ['Centro',            op.centro],
                        ] as [string, string][]).filter(([, v]) => v).map(([lbl, val]) => (
                          <div key={lbl} style={{ padding: '8px 16px',
                            borderRight: '1px solid rgba(10,21,48,0.06)', flexShrink: 0 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8',
                              textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>{lbl}</div>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0A1530' }}>{val}</div>
                          </div>
                        ))}
                      </div>

                      {/* Error list */}
                      {op.errors.length > 0 && (
                        <div style={{ padding: '8px 16px', background: '#FEF2F2',
                          borderBottom: '1px solid #FECACA' }}>
                          {op.errors.map((err, i) => (
                            <div key={i} style={{ fontSize: 11.5, color: '#991B1B', lineHeight: 1.6 }}>
                              <i className="fa fa-times-circle" style={{ marginRight: 5 }} />{err}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Components table */}
                      {op.componentes.length > 0 ? (
                        <div style={{ padding: '10px 14px' }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B',
                            textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                            Componentes — {op.componentes.length}
                          </div>
                          <table className="cop-comp-table">
                            <thead>
                              <tr>
                                <th>Código</th>
                                <th>Descripción</th>
                                <th style={{ textAlign: 'right' }}>Cantidad</th>
                                <th>UM</th>
                                <th>Lote</th>
                                <th>Lista Mat.</th>
                              </tr>
                            </thead>
                            <tbody>
                              {op.componentes.map((c, ci) => (
                                <tr key={ci} className={c.errors.length > 0 ? 'has-err' : ''}>
                                  <td style={{ fontFamily: 'var(--f-mono)', fontWeight: 700, color: '#0A2D63' }}>
                                    {c.codigoMaterialComponente}
                                  </td>
                                  <td>{c.descripcionMaterialComponente}</td>
                                  <td style={{ textAlign: 'right', fontFamily: 'var(--f-mono)' }}>
                                    {c.cantidad.toLocaleString('es-CO')}
                                  </td>
                                  <td>{c.unidadMedida || '—'}</td>
                                  <td style={{ fontFamily: 'var(--f-mono)', color: '#64748B' }}>
                                    {c.loteComponente || '—'}
                                  </td>
                                  <td style={{ fontFamily: 'var(--f-mono)', color: '#64748B' }}>
                                    {c.codigoListaMateriales || '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div style={{ padding: '10px 16px', fontSize: 12, color: '#94A3B8',
                          fontStyle: 'italic' }}>
                          Sin componentes en el archivo para esta orden.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Action bar */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
              gap: 10, marginTop: 18, paddingTop: 16, borderTop: '1px solid rgba(10,21,48,0.07)' }}>
              {totalValidErrors > 0 && (
                <span style={{ fontSize: 12, color: '#991B1B', marginRight: 'auto' }}>
                  <i className="fa fa-exclamation-circle" style={{ marginRight: 4 }} />
                  Corrija los errores antes de confirmar
                </span>
              )}
              <button className="btn btn-gray" onClick={resetear}>
                <i className="fa fa-undo" /> Cancelar
              </button>
              <button
                className="btn btn-primary"
                disabled={totalValidErrors > 0}
                onClick={confirmar}
                title={totalValidErrors > 0 ? 'Corrija los errores para habilitar el cargue' : ''}
              >
                <i className="fa fa-check" /> Confirmar cargue — {parsed.ordenes.length} orden{parsed.ordenes.length !== 1 ? 'es' : ''}
              </button>
            </div>
          </>
        )}
      </Panel>

      {/* ── Historial ── */}
      {(step === 'idle' || step === 'preview') && (
        <Panel title={<><i className="fa fa-history" /> Historial de cargues</>} collapsible>
          <DataTable<CargueRegistro> columns={histCols} data={historial} />
        </Panel>
      )}
    </>
  )
}

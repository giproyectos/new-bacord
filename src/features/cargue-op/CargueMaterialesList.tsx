import { useState, useCallback, useEffect } from 'react'
import { Panel } from '@/components/shared/Panel'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { materialesApi, TIPO_MATERIAL_LABELS, type CargueMaterialRegistro, type TipoMaterial } from '@/api/materiales'
import { usePuedeEditar } from '@/hooks/usePermisos'
import { downloadTextFile } from '@/utils/downloadFile'

const PLANTILLA_MATERIALES = [
  'codigo,descripcion,tipo',
  'PT-0001,Tableta Analgésico 500mg,PRODUCTO_TERMINADO',
  'EMP-0001,Estuche plegadizo x30 tabletas,MATERIAL_EMPAQUE',
  'ENV-0001,Frasco ámbar 100ml,MATERIAL_ENVASE',
  'EXC-0001,Lactosa monohidratada,EXCIPIENTE',
  'API-0001,Paracetamol USP,PRINCIPIO_ACTIVO',
].join('\r\n')

interface ParsedMaterial {
  rowNum: number
  codigo: string
  descripcion: string
  tipo: TipoMaterial | null
  tipoTexto: string
  errors: string[]
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

// Acepta tanto la clave del enum (PRODUCTO_TERMINADO) como la etiqueta amigable
// (Producto Terminado), sin distinguir mayúsculas/acentos.
function resolverTipo(texto: string): TipoMaterial | null {
  const norm = (s: string) => s.trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const t = norm(texto)
  const porClave = (Object.keys(TIPO_MATERIAL_LABELS) as TipoMaterial[]).find(k => norm(k) === t || norm(k.replace(/_/g, ' ')) === t)
  if (porClave) return porClave
  const porLabel = (Object.keys(TIPO_MATERIAL_LABELS) as TipoMaterial[]).find(k => norm(TIPO_MATERIAL_LABELS[k]).startsWith(t) || t.startsWith(norm(TIPO_MATERIAL_LABELS[k]).split(' (')[0]))
  return porLabel ?? null
}

function parsearCSV(texto: string): ParsedMaterial[] {
  const lineas = texto.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (lineas.length === 0) return []
  // Si la primera línea parece un encabezado (contiene "codigo"/"código"), se salta.
  const primeraEsHeader = /c[oó]digo/i.test(lineas[0])
  const filas = primeraEsHeader ? lineas.slice(1) : lineas

  return filas.map((linea, i) => {
    const campos = splitCSVLine(linea)
    const [codigo = '', descripcion = '', tipoTexto = ''] = campos
    const errors: string[] = []
    if (!codigo) errors.push('Falta el código')
    if (!descripcion) errors.push('Falta la descripción')
    const tipo = tipoTexto ? resolverTipo(tipoTexto) : null
    if (!tipoTexto) errors.push('Falta el tipo')
    else if (!tipo) errors.push(`Tipo "${tipoTexto}" no reconocido`)
    return { rowNum: i + 1, codigo, descripcion, tipo, tipoTexto, errors }
  })
}

export function CargueMaterialesList() {
  const puedeEditar = usePuedeEditar('materiales')
  const [step, setStep] = useState<'idle' | 'preview' | 'saving' | 'done'>('idle')
  const [file, setFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<ParsedMaterial[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [historial, setHistorial] = useState<CargueMaterialRegistro[]>([])
  const [resultado, setResultado] = useState<{ total: number; creados: number; errores: number } | null>(null)

  useEffect(() => { materialesApi.buscarCargues().then(setHistorial) }, [])

  const procesar = useCallback(async (f: File) => {
    setFile(f)
    setParsed(parsearCSV(await f.text()))
    setStep('preview')
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) procesar(f)
  }, [procesar])

  const resetear = () => { setStep('idle'); setFile(null); setParsed([]); setResultado(null) }

  const totalErrores = parsed.filter(m => m.errors.length > 0).length
  const validos = parsed.filter(m => m.errors.length === 0)

  const confirmar = async () => {
    if (!file || validos.length === 0) return
    setStep('saving')
    const payload = validos.map(m => ({ codigo: m.codigo, descripcion: m.descripcion, tipo: m.tipo! }))
    const res = await materialesApi.cargar(file.name, payload)
    setResultado(res.datos ?? null)
    materialesApi.buscarCargues().then(setHistorial)
    setStep('done')
  }

  const cols: Column<ParsedMaterial>[] = [
    { key: 'rowNum', header: '#', width: '6%', align: 'center' },
    { key: 'codigo', header: 'Código', width: '18%' },
    { key: 'descripcion', header: 'Descripción' },
    { key: 'tipo', header: 'Tipo', width: '24%', render: r => r.tipo ? TIPO_MATERIAL_LABELS[r.tipo] : <span style={{ color: '#DC2626' }}>{r.tipoTexto || '—'}</span> },
    {
      key: 'errors', header: 'Estado', width: '18%', align: 'center',
      render: r => r.errors.length === 0
        ? <span style={{ color: '#16A34A', fontSize: 12 }}><i className="fa fa-check-circle" /> OK</span>
        : <span style={{ color: '#DC2626', fontSize: 11.5 }} title={r.errors.join('; ')}><i className="fa fa-exclamation-circle" /> {r.errors[0]}</span>,
    },
  ]

  const histCols: Column<CargueMaterialRegistro>[] = [
    { key: 'archivo', header: 'Archivo' },
    { key: 'fechaCargue', header: 'Fecha', render: r => new Date(r.fechaCargue).toLocaleString() },
    { key: 'usuario', header: 'Usuario' },
    { key: 'totalMateriales', header: 'Materiales', align: 'center' },
    { key: 'errores', header: 'Errores', align: 'center' },
    {
      key: 'estado', header: 'Estado', align: 'center',
      render: r => (
        <span style={{
          padding: '2px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600,
          background: r.estado === 'Exitoso' ? '#F0FDF4' : r.estado === 'Fallido' ? '#FEF2F2' : '#FFFBEB',
          color: r.estado === 'Exitoso' ? '#15803D' : r.estado === 'Fallido' ? '#B91C1C' : '#B45309',
        }}>{r.estado}</span>
      ),
    },
  ]

  return (
    <>
      <style>{`
        .cm-drop { display: block; border: 2px dashed var(--hair-2); border-radius: var(--r-lg); padding: 40px 20px; text-align: center; cursor: pointer; transition: all 120ms; color: var(--ink-4); }
        .cm-drop:hover, .cm-drop.drag-over { border-color: var(--navy); background: rgba(10,45,99,.03); }
        .cm-drop .drop-icon { font-size: 32px; color: var(--navy); margin-bottom: 10px; display: block; }
      `}</style>

      <Panel title={
        step === 'preview' ? <><i className="fa fa-table" /> Vista previa del cargue</>
          : <><i className="fa fa-upload" /> Cargue de Materiales</>
      }>
        {step === 'idle' && (
          <label className={`cm-drop${dragOver ? ' drag-over' : ''}`} htmlFor="cm-file-input"
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}>
            <i className="fa fa-cloud-upload-alt drop-icon" />
            <p style={{ fontSize: 14, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
              Arrastra el archivo aquí o haz clic para seleccionar
            </p>
            <p style={{ fontSize: 12, marginBottom: 4 }}>Formato: <strong>CSV</strong></p>
            <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 8 }}>
              Columnas: <strong>codigo, descripcion, tipo</strong> — el tipo acepta el nombre visible (ej: "Producto Terminado") o la clave interna.
            </p>
            <input id="cm-file-input" type="file" style={{ display: 'none' }} accept=".csv,.txt"
              onChange={e => { const f = e.target.files?.[0]; if (f) procesar(f) }} />
          </label>
        )}
        {step === 'idle' && (
          <div style={{ textAlign: 'center', marginTop: 14 }}>
            <button className="btn btn-gray" style={{ fontSize: 12.5 }}
              onClick={() => downloadTextFile('plantilla-materiales.csv', PLANTILLA_MATERIALES)}>
              <i className="fa fa-download" /> Descargar plantilla de ejemplo
            </button>
          </div>
        )}

        {step === 'preview' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14, padding: '10px 14px', background: '#F8FAFC', borderRadius: 'var(--r-md)', border: '1.5px solid var(--hair-2)' }}>
              <span style={{ fontSize: 13 }}><strong>{parsed.length}</strong> filas leídas</span>
              <span style={{ fontSize: 13, color: '#16A34A' }}><strong>{validos.length}</strong> válidas</span>
              {totalErrores > 0 && <span style={{ fontSize: 13, color: '#DC2626' }}><strong>{totalErrores}</strong> con error (no se cargarán)</span>}
            </div>
            <DataTable<ParsedMaterial> columns={cols} data={parsed} />
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button className="btn btn-gray" onClick={resetear}><i className="fa fa-undo" /> Cancelar</button>
              {puedeEditar && (
                <button className="btn btn-primary" disabled={validos.length === 0} onClick={confirmar}>
                  <i className="fa fa-check" /> Confirmar cargue ({validos.length})
                </button>
              )}
            </div>
          </>
        )}

        {step === 'saving' && (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{ width: 44, height: 44, border: '4px solid #E2E8F0', borderTopColor: '#0A2D63', borderRadius: '50%', margin: '0 auto 14px', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ color: '#64748B', fontSize: 13 }}>Guardando materiales…</p>
          </div>
        )}

        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <i className="fa fa-check-circle" style={{ fontSize: 36, color: '#16A34A', marginBottom: 12, display: 'block' }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Cargue completado</p>
            <p style={{ fontSize: 13, color: '#64748B', marginBottom: 18 }}>
              {resultado?.creados ?? 0} de {resultado?.total ?? 0} materiales creados
              {resultado && resultado.errores > 0 && ` — ${resultado.errores} fallaron (código duplicado)`}
            </p>
            <button className="btn btn-primary" onClick={resetear}><i className="fa fa-upload" /> Cargar otro archivo</button>
          </div>
        )}
      </Panel>

      <Panel title={<><i className="fa fa-history" /> Historial de cargues</>} collapsible defaultOpen={false}>
        <DataTable<CargueMaterialRegistro> columns={histCols} data={historial} />
      </Panel>
    </>
  )
}

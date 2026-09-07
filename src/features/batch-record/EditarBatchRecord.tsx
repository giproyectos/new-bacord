import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { batchRecordApi, type EstructuraDetalle, type EstructuraFirmaItem, type BatchRecordFirmaRegistrada } from '@/api/batchRecord'
import { recetaMaestraApi } from '@/api/recetaMaestra'
import { materialesApi, type Material } from '@/api/materiales'
import { desviacionesApi, type Desviacion } from '@/api/desviaciones'
import { auditoriaApi } from '@/api/auditoria'
import type { PreLlenadoBR, BatchRecord, RecetaMaestra } from '@/types'
import type { AuditEntry, AuditAccion } from '@/types/audit'
import { useAudit } from '@/hooks/useAudit'
import { usePuedeEditar } from '@/hooks/usePermisos'

// ── Schema component types ───────────────────────────────────────────────
type SchemaComp =
  | { type: 'heading';      text: string }
  | { type: 'divider' }
  | { type: 'textfield';    key: string; label: string; placeholder?: string }
  | { type: 'number';       key: string; label: string; unit?: string }
  | { type: 'select';       key: string; label: string; options: string[] }
  | { type: 'textarea';     key: string; label: string; rows?: number }
  | { type: 'datetime';     key: string; label: string }
  | { type: 'firma-seccion'; key: string; label: string; idEstrategiaFirma: number }

// ── Datos de firma ───────────────────────────────────────────────────────
interface FirmaInfo { idRegistro: number; nombre: string; grupo: string; fecha: string; hora: string; loginUsuario: string; idUsuario: number }

// firmados: clave `cie:${idDetalle}:${idFirma}` → FirmaInfo (undefined = aún no firmado)
type FirmaMap = { [key: string]: FirmaInfo | undefined }

function firmasToMap(firmas: BatchRecordFirmaRegistrada[]): FirmaMap {
  const map: FirmaMap = {}
  for (const f of firmas) {
    const d = new Date(f.firmadoEn)
    map[`cie:${f.idDetalle}:${f.idFirma}`] = {
      idRegistro: f.id,
      nombre: `${f.usuario.nombres} ${f.usuario.apellidos}`,
      grupo: f.firma.descripcion,
      fecha: d.toISOString().slice(0, 10),
      hora: d.toTimeString().slice(0, 5),
      loginUsuario: f.usuario.login,
      idUsuario: f.idUsuario,
    }
  }
  return map
}

// ── Cabecera dinámica ──────────────────────────────────────────────────────
function buildCabeceraItems(pl: PreLlenadoBR | null, receta: RecetaMaestra | null) {
  return [
    { label: 'Producto',          value: pl?.descripcionMaterial ?? '—' },
    { label: 'Código',            value: pl?.codigoMaterial      ?? '—' },
    { label: 'Lote No.',          value: pl?.loteLogistico       ?? '—' },
    { label: 'Receta Maestra',    value: receta ? `${receta.codigo} v${receta.version}` : '—' },
    { label: 'Orden de Proceso',  value: pl?.numeroOrdenProceso  ?? '—' },
    { label: 'Fecha Fabricación', value: pl?.fechaFabricacion    ?? '—' },
    { label: 'Fecha Caducidad',   value: pl?.fechaCaducidad      ?? '—' },
    { label: 'Tamaño de Lote',    value: pl ? `${pl.cantidadOrden.toLocaleString('es-CO')} ${pl.unidadMedida}` : '—' },
    { label: 'Centro',            value: pl?.centro              ?? '—' },
  ]
}

// Estructura de un proceso (etapa) tal como llega del backend, aplanada para uso local
interface ProcesoRow { id: number; codigo: string; descripcion: string; orden: number }
interface DetalleRow extends EstructuraDetalle { idProceso: number; orden: number }

// El separador decimal/miles de los campos número se elige una sola vez por formulario
// (ver DetallesList.tsx) y se guarda en jsonOptions — form.io lo aplica vía `language` a
// nivel de formulario completo, así que se traduce a un locale ICU aquí.
function languageOfDetalle(jsonOptions: string | null | undefined): string {
  try { return JSON.parse(jsonOptions || '{}').numberFormat === ',' ? 'es' : 'en' }
  catch { return 'en' }
}

// Traverses form.io schema JSON and returns { fieldKey → value } for every component
// that has an `opMapping` property, resolved against the given preLlenado object.
function extractOpMappings(schemaJson: string, preLlenado: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  try {
    const schema = JSON.parse(schemaJson) as Record<string, unknown>
    function walk(comps: unknown[]): void {
      for (const raw of comps) {
        const c = raw as Record<string, unknown>
        if (c.opMapping && c.key) {
          const val = preLlenado[c.opMapping as string]
          if (val !== undefined && val !== null && val !== '') out[c.key as string] = String(val)
        }
        if (Array.isArray(c.components)) walk(c.components)
        if (Array.isArray(c.columns)) {
          for (const col of c.columns as Record<string, unknown>[]) {
            if (Array.isArray(col.components)) walk(col.components)
          }
        }
      }
    }
    if (Array.isArray(schema?.components)) walk(schema.components)
  } catch {}
  return out
}

// Traverses form.io schema JSON and, for every 'select' component carrying a custom
// `materialSource` property (set in the form builder — see DetallesList.tsx), replaces its
// option list with the CURRENT Materiales catalog (optionally filtered by tipo). Unlike
// opMapping (which pre-fills a single value from this batch record's own OP data),
// this needs a live catalog lookup, so it mutates the schema itself rather than the
// submission data, before the schema is ever sent to the preview iframe.
function injectMaterialOptions(schemaJson: string, materiales: Material[]): string {
  try {
    const schema = JSON.parse(schemaJson) as Record<string, unknown>
    function walk(comps: unknown[]): void {
      for (const raw of comps) {
        const c = raw as Record<string, unknown>
        if (c.type === 'select' && typeof c.materialSource === 'string') {
          const filtro = c.materialSource
          const opciones = materiales
            .filter(m => m.activo && (filtro === 'ALL' || m.tipo === filtro))
            .map(m => ({ label: `${m.descripcion} (${m.codigo})`, value: m.codigo }))
          c.data = { values: opciones }
        }
        if (Array.isArray(c.components)) walk(c.components)
        if (Array.isArray(c.columns)) {
          for (const col of c.columns as Record<string, unknown>[]) {
            if (Array.isArray(col.components)) walk(col.components)
          }
        }
      }
    }
    if (Array.isArray(schema?.components)) walk(schema.components)
    return JSON.stringify(schema)
  } catch { return schemaJson }
}

// ── Helpers ───────────────────────────────────────────────────────────────
function parseSchema(jsonSchema: string): SchemaComp[] {
  if (!jsonSchema) return []
  try {
    const obj = JSON.parse(jsonSchema)
    return Array.isArray(obj?.components) ? (obj.components as SchemaComp[]) : []
  } catch { return [] }
}

function getFirmasDeEstrategia(detalle: { estrategiaFirma: { firmas: EstructuraFirmaItem[] } | null } | undefined): EstructuraFirmaItem[] {
  return detalle?.estrategiaFirma?.firmas ?? []
}

// ── Extractor de etiquetas del schema form.io ────────────────────────────
function extractFieldLabels(schema: string): Record<string, string> {
  const labels: Record<string, string> = {}
  try {
    const traverse = (comps: unknown[]) => {
      if (!Array.isArray(comps)) return
      for (const c of comps) {
        const comp = c as Record<string, unknown>
        if (typeof comp.key === 'string' && typeof comp.label === 'string') {
          labels[comp.key] = comp.label
        }
        if (Array.isArray(comp.components)) traverse(comp.components as unknown[])
        if (Array.isArray(comp.columns)) {
          ;(comp.columns as Record<string, unknown>[]).forEach(col => {
            if (Array.isArray(col.components)) traverse(col.components as unknown[])
          })
        }
      }
    }
    const obj = JSON.parse(schema)
    if (Array.isArray(obj?.components)) traverse(obj.components)
  } catch { /* schema inválido — ignorar */ }
  return labels
}

// Formatea un valor de form.io para mostrarlo de forma legible en auditoría / impresión
function formatAuditValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return ''
  if (typeof v === 'boolean') return v ? 'Sí' : 'No'
  if (typeof v !== 'object') return String(v)

  if (Array.isArray(v)) {
    const rows = (v as Record<string, unknown>[]).filter(r => r && typeof r === 'object')
    if (rows.length === 0) return '—'
    const lines = rows.map((row, i) => {
      const parts = Object.entries(row)
        .filter(([k, rv]) =>
          !k.startsWith('btn') &&
          rv !== '' && rv !== null && rv !== undefined && rv !== false && rv !== '—'
        )
        .map(([, rv]) => String(rv))
      return parts.length > 0 ? `[${i + 1}] ${parts.join(' · ')}` : null
    }).filter(Boolean)
    return lines.length > 0 ? lines.join('\n') : `${rows.length} fila(s)`
  }

  // Objeto plano
  return Object.entries(v as Record<string, unknown>)
    .filter(([k, ov]) => !k.startsWith('btn') && ov !== null && ov !== undefined && ov !== '')
    .map(([, ov]) => String(ov))
    .join(' · ') || '—'
}

// Diff plano entre dos snapshots de data form.io → cambios auditables
function diffFormData(
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
  labels: Record<string, string>
): { campo: string; etiqueta: string; valorAnterior: string; valorNuevo: string }[] {
  const cambios: { campo: string; etiqueta: string; valorAnterior: string; valorNuevo: string }[] = []
  const allKeys = new Set([...Object.keys(prev), ...Object.keys(next)])
  for (const key of allKeys) {
    if (key === 'submit' || key.startsWith('btn')) continue  // botones no son datos auditables
    const ant = prev[key]
    const nv  = next[key]
    const antJson = typeof ant === 'object' ? JSON.stringify(ant) : String(ant ?? '')
    const nvJson  = typeof nv  === 'object' ? JSON.stringify(nv)  : String(nv  ?? '')
    if (antJson !== nvJson) {
      cambios.push({
        campo: key,
        etiqueta: labels[key] ?? key,
        valorAnterior: formatAuditValue(ant),
        valorNuevo:    formatAuditValue(nv),
      })
    }
  }
  return cambios
}

// ── FirmaStamp ─────────────────────────────────────────────────────────────
function FirmaStamp({ info }: { info: FirmaInfo }) {
  return (
    <div style={{ textAlign: 'right', lineHeight: 1.4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end',
        fontSize: 11, fontWeight: 700, color: 'var(--forest)' }}>
        <i className="fa fa-check-circle" /> Firmado
      </div>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', marginTop: 3 }}>
        {info.nombre}
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--ink-4)', fontFamily: 'var(--f-mono)', marginTop: 1 }}>
        {info.grupo}
      </div>
      <div style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--f-mono)', marginTop: 1,
        display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
        <i className="fa fa-calendar" style={{ fontSize: 8 }} />{info.fecha}
        <i className="fa fa-clock" style={{ fontSize: 8, marginLeft: 4 }} />{info.hora}
      </div>
    </div>
  )
}

// ── DerogacionModal ───────────────────────────────────────────────────────
function DerogacionModal({ firmaInfo, texto, grupo, onConfirm, onClose }: {
  firmaInfo: FirmaInfo
  texto: string
  grupo: string
  onConfirm: (motivo: string) => void
  onClose: () => void
}) {
  const [motivo, setMotivo] = useState('')
  return (
    <div style={{ position:'fixed',inset:0,zIndex:300,background:'rgba(10,21,48,.55)',display:'flex',alignItems:'center',justifyContent:'center',padding:20 }}
      onClick={onClose}>
      <div style={{ background:'var(--paper)',borderRadius:'var(--r-xl)',boxShadow:'var(--sh-3)',width:'100%',maxWidth:440 }}
        onClick={e => e.stopPropagation()}>
        <div style={{ background:'#7C2D12',borderRadius:'var(--r-xl) var(--r-xl) 0 0',padding:'14px 22px',display:'flex',alignItems:'center',gap:10 }}>
          <div style={{ width:34,height:34,borderRadius:10,background:'rgba(255,255,255,.12)',display:'grid',placeItems:'center',flexShrink:0 }}>
            <i className="fa fa-undo" style={{ color:'#FCA5A5',fontSize:15 }} />
          </div>
          <div style={{ flex:1 }}>
            <div style={{ color:'#fff',fontWeight:700,fontSize:14 }}>Derogar Firma</div>
            <div style={{ color:'rgba(255,200,180,.7)',fontSize:11 }}>Esta acción revocará la firma y desbloqueará los campos</div>
          </div>
          <button style={{ background:'rgba(255,255,255,.1)',border:'none',cursor:'pointer',color:'#fff',width:28,height:28,borderRadius:7,fontSize:16,display:'grid',placeItems:'center' }} onClick={onClose}>×</button>
        </div>
        <div style={{ padding:'12px 22px',background:'var(--paper-2)',borderBottom:'1px solid var(--hair)' }}>
          <div style={{ fontSize:12.5,fontWeight:600,color:'var(--ink-2)',marginBottom:6 }}>{texto}</div>
          <div style={{ display:'flex',gap:12,flexWrap:'wrap' }}>
            <span style={{ fontSize:11.5,color:'var(--ink-4)' }}><i className="fa fa-user" style={{ marginRight:4 }}/>{firmaInfo.nombre}</span>
            <span style={{ fontSize:11.5,color:'var(--ink-4)',fontFamily:'var(--f-mono)' }}>{firmaInfo.fecha} · {firmaInfo.hora}</span>
            <span style={{ fontSize:11.5,padding:'1px 9px',borderRadius:20,background:'var(--navy)',color:'#fff' }}>{grupo}</span>
          </div>
        </div>
        <div style={{ padding:'18px 22px' }}>
          <label style={{ display:'block',fontSize:12.5,fontWeight:600,color:'var(--ink-2)',marginBottom:6 }}>
            Motivo de derogación <span style={{ color:'#DC2626',fontWeight:400 }}>(requerido)</span>
          </label>
          <textarea className="form-control" rows={3} value={motivo} autoFocus
            onChange={e => setMotivo(e.target.value)}
            placeholder="Describa el motivo para revocar esta firma…"
            style={{ resize:'vertical' }} />
          <div style={{ marginTop:8,fontSize:11.5,color:'#92400E',background:'#FEF3C7',borderRadius:6,padding:'6px 10px',display:'flex',gap:6,alignItems:'flex-start' }}>
            <i className="fa fa-exclamation-triangle" style={{ color:'#D97706',flexShrink:0,marginTop:1 }}/>
            <span>Se revocará esta firma. Los campos del formulario quedarán editables para corrección.</span>
          </div>
        </div>
        <div style={{ padding:'14px 22px',borderTop:'1px solid var(--hair)',display:'flex',justifyContent:'flex-end',gap:8 }}>
          <button className="btn btn-gray" onClick={onClose}><i className="fa fa-undo" /> Cancelar</button>
          <button className="btn btn-danger" disabled={!motivo.trim()}
            onClick={() => { if (motivo.trim()) onConfirm(motivo.trim()) }}>
            <i className="fa fa-undo" /> Derogar firma
          </button>
        </div>
      </div>
    </div>
  )
}

// ── FirmaModal — captura credenciales y delega la acción real (firmar o liberar) al backend ──
function FirmaModal({ titulo, subtitulo, texto, grupo, showObservacion, onSubmit, onClose }: {
  titulo: string
  subtitulo: string
  texto: string
  grupo?: string
  showObservacion?: boolean
  onSubmit: (login: string, pin: string, observacion?: string) => Promise<{ estado: boolean; mensaje: string }>
  onClose: () => void
}) {
  const sessionUser = useAuthStore(s => s.user)
  const [login,   setLogin]   = useState(sessionUser?.login ?? '')
  const [pin,     setPin]     = useState('')
  const [obs,     setObs]     = useState('')
  const [show,    setShow]    = useState(false)
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const result = await onSubmit(login.trim(), pin, showObservacion ? obs.trim() : undefined)
      if (!result.estado) { setError(result.mensaje); return }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar la solicitud')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ position:'fixed',inset:0,zIndex:300,background:'rgba(10,21,48,0.5)',display:'flex',alignItems:'center',justifyContent:'center',padding:20 }}
      onClick={onClose}>
      <div style={{ background:'var(--paper)',borderRadius:'var(--r-xl)',boxShadow:'var(--sh-3)',width:'100%',maxWidth:420 }}
        onClick={e => e.stopPropagation()}>
        <div style={{ background:'var(--navy)',borderRadius:'var(--r-xl) var(--r-xl) 0 0',padding:'14px 22px',display:'flex',alignItems:'center',gap:10 }}>
          <div style={{ width:34,height:34,borderRadius:10,background:'rgba(255,255,255,.12)',display:'grid',placeItems:'center',flexShrink:0 }}>
            <i className="fa fa-pen" style={{ color:'var(--yellow)',fontSize:15 }} />
          </div>
          <div style={{ flex:1 }}>
            <div style={{ color:'#fff',fontWeight:700,fontSize:14 }}>{titulo}</div>
            <div style={{ color:'#8FA5C9',fontSize:11 }}>{subtitulo}</div>
          </div>
          <button style={{ background:'rgba(255,255,255,.1)',border:'none',cursor:'pointer',color:'#fff',width:28,height:28,borderRadius:7,fontSize:16,display:'grid',placeItems:'center' }} onClick={onClose}>×</button>
        </div>
        <div style={{ padding:'12px 22px',background:'var(--paper-2)',borderBottom:'1px solid var(--hair)' }}>
          <div style={{ fontSize:13,fontWeight:600,color:'var(--ink-2)',marginBottom:4 }}>{texto}</div>
          {grupo && (
            <div style={{ display:'flex',alignItems:'center',gap:6 }}>
              <i className="fa fa-users" style={{ color:'var(--navy)',fontSize:11 }} />
              <span style={{ fontSize:11.5,color:'var(--ink-3)' }}>Grupo requerido:</span>
              <span style={{ fontSize:11.5,fontWeight:700,padding:'1px 9px',borderRadius:20,background:'var(--navy)',color:'#fff' }}>{grupo}</span>
            </div>
          )}
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ padding:'18px 22px',display:'flex',flexDirection:'column',gap:14 }}>
            <div>
              <label style={{ display:'block',fontSize:12.5,fontWeight:600,color:'var(--ink-2)',marginBottom:5 }}>
                Usuario <span style={{ color:'var(--orange)',fontWeight:400 }}>(requerido)</span>
              </label>
              <input className="form-control" value={login} autoFocus
                onChange={e => { setLogin(e.target.value); setError('') }}
                placeholder="login" />
            </div>
            <div>
              <label style={{ display:'block',fontSize:12.5,fontWeight:600,color:'var(--ink-2)',marginBottom:5 }}>
                PIN de firma <span style={{ color:'var(--orange)',fontWeight:400 }}>(requerido)</span>
              </label>
              <div style={{ position:'relative' }}>
                <input type={show ? 'text' : 'password'} inputMode="numeric" className="form-control" value={pin}
                  onChange={e => { setPin(e.target.value); setError('') }}
                  placeholder="••••••" style={{ paddingRight:36 }} />
                <button type="button"
                  style={{ position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'var(--ink-4)' }}
                  onClick={() => setShow(s => !s)}>
                  {show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            {showObservacion && (
              <div>
                <label style={{ display:'block',fontSize:12.5,fontWeight:600,color:'var(--ink-2)',marginBottom:5 }}>
                  Observación <span style={{ color:'var(--ink-4)',fontWeight:400 }}>(opcional)</span>
                </label>
                <textarea className="form-control" rows={2} value={obs} onChange={e => setObs(e.target.value)} style={{ resize:'vertical' }} />
              </div>
            )}
            {error && (
              <div style={{ padding:'8px 12px',background:'#fef2f2',border:'1.5px solid #fecaca',borderRadius:'var(--r-sm)',fontSize:12.5,color:'#b91c1c',display:'flex',alignItems:'center',gap:7 }}>
                <i className="fa fa-exclamation-circle" />{error}
              </div>
            )}
          </div>
          <div style={{ padding:'14px 22px',borderTop:'1px solid var(--hair)',display:'flex',justifyContent:'flex-end',gap:8 }}>
            <button type="button" className="btn btn-gray" onClick={onClose}><i className="fa fa-undo" /> Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={!login || !pin || loading}>
              {loading ? <><i className="fa fa-spinner fa-spin" /> Validando...</> : <><i className="fa fa-pen" /> Firmar</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── FormioFrame ───────────────────────────────────────────────────────────
interface FormioRangeError { key: string; label: string; message: string }

function FormioFrame({ schema, language = 'en', locked = false, lockedKeys, onDataChange, getInitialData, onValidation }: {
  schema: string
  language?: string
  locked?: boolean
  lockedKeys?: string[]
  onDataChange?: (data: Record<string, unknown>) => void
  getInitialData?: () => Record<string, unknown>
  onValidation?: (errors: FormioRangeError[]) => void
}) {
  const ref = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(500)
  const onDataChangeRef = useRef(onDataChange)
  const onValidationRef = useRef<((errors: FormioRangeError[]) => void) | undefined>(onValidation)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lockedRef = useRef(false)
  const getInitialDataRef = useRef(getInitialData)

  useEffect(() => { onDataChangeRef.current = onDataChange }, [onDataChange])
  useEffect(() => { onValidationRef.current = onValidation }, [onValidation])
  useEffect(() => { getInitialDataRef.current = getInitialData }, [getInitialData])

  useEffect(() => {
    if (locked && !lockedRef.current) {
      lockedRef.current = true
      ref.current?.contentWindow?.postMessage({ type: 'LOCK_FORM' }, window.location.origin)
    }
    if (!locked) {
      lockedRef.current = false
    }
  }, [locked])

  useEffect(() => {
    const frame = ref.current
    if (!frame) return

    const send = () => {
      const data = getInitialDataRef.current?.() ?? {}
      const hasData = Object.keys(data).length > 0
      if (hasData) {
        frame.contentWindow?.postMessage({
          type: 'RENDER_JSON_WITH_DATA',
          value: schema,
          data: JSON.stringify({ data }),
          lockedKeys: lockedKeys ?? [],
          language,
        }, window.location.origin)
      } else {
        frame.contentWindow?.postMessage({ type: 'RENDER_JSON', value: schema, language }, window.location.origin)
      }
    }

    frame.addEventListener('load', send)
    if (frame.contentDocument?.readyState === 'complete') send()

    const onMsg = (e: MessageEvent) => {
      if (e.source !== frame.contentWindow) return
      if (e.data?.type === 'HEIGTH') {
        setHeight(Math.max(200, parseInt(e.data.value, 10) || 500))
      }
      if (e.data?.type === 'GET_JSONDATA') {
        try {
          const submission = typeof e.data.value === 'string'
            ? JSON.parse(e.data.value)
            : e.data.value
          const data = (submission?.data ?? submission ?? {}) as Record<string, unknown>
          if (debounceRef.current) clearTimeout(debounceRef.current)
          debounceRef.current = setTimeout(() => {
            onDataChangeRef.current?.(data)
          }, 700)
        } catch { /* JSON inválido — ignorar */ }
      }
      if (e.data?.type === 'VALIDATION_STATUS') {
        onValidationRef.current?.(e.data.errors ?? [])
      }
    }
    window.addEventListener('message', onMsg)
    return () => {
      frame.removeEventListener('load', send)
      window.removeEventListener('message', onMsg)
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [schema, language])

  return (
    <iframe ref={ref} src="/formio/render.html" title="Formulario"
      style={{ width:'100%', height, border:'none', display:'block' }} />
  )
}

// ── Required-field validation ─────────────────────────────────────────────
type ReqField = { key: string; label: string; datagridKey?: string }
type ValidationError = { label: string; rows?: number[] }

const shortLabel = (raw: unknown) => {
  const s = typeof raw === 'string' ? raw : String(raw ?? '')
  return (s.split('/')[0]).trim()
}

const isEmpty = (v: unknown) =>
  v === undefined || v === null || v === '' || v === false || v === 'false'

function collectRequired(comps: unknown[]): ReqField[] {
  const out: ReqField[] = []
  for (const raw of comps) {
    const c = raw as Record<string, unknown>
    const validate = c.validate as Record<string, unknown> | undefined
    const type = c.type as string | undefined

    if (type === 'datagrid' && typeof c.key === 'string') {
      if (Array.isArray(c.components)) {
        for (const child of c.components as unknown[]) {
          const ch = child as Record<string, unknown>
          const chVal = ch.validate as Record<string, unknown> | undefined
          if ((ch.required || chVal?.required) && typeof ch.key === 'string' && ch.input !== false) {
            out.push({ key: ch.key, label: shortLabel(ch.label ?? ch.key), datagridKey: c.key })
          }
        }
      }
      continue
    }

    if ((c.required || validate?.required) && typeof c.key === 'string' && c.input !== false) {
      out.push({ key: c.key, label: shortLabel(c.label ?? c.key) })
    }
    if (Array.isArray(c.components)) out.push(...collectRequired(c.components as unknown[]))
    if (Array.isArray(c.columns)) {
      for (const col of c.columns as Record<string, unknown>[]) {
        if (Array.isArray(col.components)) out.push(...collectRequired(col.components as unknown[]))
      }
    }
  }
  return out
}

function missingRequired(jsonSchema: string, data: Record<string, unknown>): ValidationError[] {
  try {
    const schema = JSON.parse(jsonSchema)
    const comps = Array.isArray(schema?.components) ? schema.components : []
    const fields = collectRequired(comps)
    const errors: ValidationError[] = []

    for (const f of fields) {
      if (f.datagridKey) {
        const rows = data[f.datagridKey]
        if (!Array.isArray(rows) || rows.length === 0) continue
        const badRows = rows
          .map((r, i) => ({ r: r as Record<string, unknown>, i }))
          .filter(({ r }) => isEmpty(r[f.key]))
          .map(({ i }) => i + 1)
        if (badRows.length > 0) errors.push({ label: f.label, rows: badRows })
      } else {
        if (isEmpty(data[f.key])) errors.push({ label: f.label })
      }
    }

    return errors
  } catch { return [] }
}

// ── Desviación modal ─────────────────────────────────────────────────────
function DesviacionModal({ error, valorIngresado, detalleCode, onSubmit, onClose }: {
  error: FormioRangeError
  valorIngresado: string
  detalleCode: string
  onSubmit: (desc: string) => void
  onClose: () => void
}) {
  const user = useAuthStore(s => s.user)
  const [desc, setDesc] = useState('')
  const [done, setDone] = useState(false)

  const handleSubmit = () => {
    if (!desc.trim()) return
    onSubmit(desc.trim())
    setDone(true)
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.52)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => e.target === e.currentTarget && !done && onClose()}
    >
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520, boxShadow: '0 24px 48px rgba(0,0,0,0.28)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: '#FFFBEB', padding: '14px 18px', borderBottom: '1.5px solid #FCD34D', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: '#D97706', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <i className="fa fa-triangle-exclamation" style={{ fontSize: 13, color: '#fff' }} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#78350F' }}>Reportar Desviación GMP</div>
            <div style={{ fontSize: 11, color: '#92400E', marginTop: 1 }}>{detalleCode} · {error.label}</div>
          </div>
        </div>

        {done ? (
          <div style={{ padding: '32px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#D1FAE5', display: 'grid', placeItems: 'center' }}>
              <i className="fa fa-check" style={{ fontSize: 22, color: '#059669' }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#065F46' }}>Desviación registrada</div>
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
                Reportada por {user?.nombres ?? user?.login} · {new Date().toLocaleDateString('es-CO')}
              </div>
            </div>
            <button className="btn btn-primary" style={{ fontSize: 12, marginTop: 4 }} onClick={onClose}>Cerrar</button>
          </div>
        ) : (
          <>
            <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ background: '#F8FAFC', borderRadius: 9, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                {([['Campo', error.label], ['Valor ingresado', valorIngresado || '—'], ['Validación', error.message]] as [string, string][]).map(([lbl, val]) => (
                  <div key={lbl} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: '#94A3B8', minWidth: 120, textTransform: 'uppercase', letterSpacing: '.04em', paddingTop: 2 }}>{lbl}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: '#0F172A', flex: 1 }}>{val}</span>
                  </div>
                ))}
              </div>
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 }}>
                  Descripción y acción correctiva <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <textarea
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                  rows={4}
                  placeholder="Describa la causa de la desviación y la acción correctiva tomada..."
                  autoFocus
                  style={{
                    width: '100%', border: `1.5px solid ${desc.trim() ? '#E2E8F0' : '#FCD34D'}`, borderRadius: 8,
                    padding: '8px 11px', fontSize: 13, color: '#1E293B', resize: 'vertical', outline: 'none',
                    boxSizing: 'border-box', fontFamily: 'var(--f-sans)', background: desc.trim() ? '#fff' : '#FFFBEB',
                    transition: 'border-color .15s',
                  }}
                />
              </div>
              <div style={{ fontSize: 11.5, color: '#64748B' }}>
                <i className="fa fa-user" style={{ marginRight: 5 }} />
                Reportado por: <strong>{user?.nombres ?? user?.login}</strong> · {new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>
            <div style={{ padding: '12px 18px', borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#F8FAFC' }}>
              <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={onClose}>Cancelar</button>
              <button
                className="btn btn-warning"
                style={{ fontSize: 12, opacity: desc.trim() ? 1 : 0.5, cursor: desc.trim() ? 'pointer' : 'not-allowed' }}
                disabled={!desc.trim()}
                onClick={handleSubmit}
              >
                <i className="fa fa-triangle-exclamation" /> Registrar Desviación
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── DetalleCard ───────────────────────────────────────────────────────────
function DetalleCard({ detalle, readonly, firmados, desviaciones, onFirmar, initialValues, lockedKeys, onFormData, onRequestDerogar, onDesviacion, preLlenado }: {
  detalle: DetalleRow
  readonly: boolean
  firmados: FirmaMap
  desviaciones: Desviacion[]
  onFirmar: (firma: EstructuraFirmaItem) => void
  initialValues?: Record<string, unknown>
  lockedKeys?: string[]
  onFormData?: (detalleId: number, prev: Record<string,unknown>, next: Record<string,unknown>, labels: Record<string,string>) => void
  onRequestDerogar?: (firmaKey: string, detalleId: number, firmaInfo: FirmaInfo, texto: string, grupo: string) => void
  onDesviacion?: (detalleId: number, campo: string, labelCampo: string, valorIngresado: string, limiteInfo: string, descripcion: string) => void
  preLlenado?: PreLlenadoBR | null
}) {
  const user = useAuthStore(s => s.user)
  const [open, setOpen] = useState(false)
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const [rangeErrors,  setRangeErrors]  = useState<FormioRangeError[]>([])
  const [desviacionModal, setDesviacionModal] = useState<{ error: FormioRangeError; valorIngresado: string } | null>(null)

  const savedDataRef = useRef<Record<string, unknown>>({})

  const getInitialData = useCallback((): Record<string, unknown> => {
    if (Object.keys(savedDataRef.current).length > 0) return savedDataRef.current
    return initialValues ? { ...initialValues } : {}
  }, [initialValues])

  const prevDataRef    = useRef<Record<string, unknown>>(getInitialData())
  const labelsRef      = useRef<Record<string, string>>(extractFieldLabels(detalle.jsonSchema ?? ''))
  const onFormDataRef  = useRef(onFormData)
  useEffect(() => { onFormDataRef.current = onFormData }, [onFormData])

  const handleIframeData = useCallback((data: Record<string, unknown>) => {
    if (readonly) return
    savedDataRef.current = data
    setValidationErrors([])
    const prev = prevDataRef.current
    onFormDataRef.current?.(detalle.id, prev, data, labelsRef.current)
    prevDataRef.current = { ...data }
  }, [readonly, detalle.id])

  const firmasCierre = getFirmasDeEstrategia(detalle)
  const userGrupos = (user?.grupos ?? '').split(',').map(g => g.trim())
  const puedeDerogar = !readonly && !!(
    user?.esAdministrador ||
    (detalle.estrategiaFirma?.gruposDerogacion?.split(',').filter(Boolean) ?? []).some(g => userGrupos.includes(g))
  )

  const cierFirmadas = firmasCierre.filter(f => !!firmados[`cie:${detalle.id}:${f.idFirma}`]).length
  const allCierDone  = firmasCierre.length > 0 && cierFirmadas === firmasCierre.length

  const handleFirmar = (firma: EstructuraFirmaItem) => {
    const missing = missingRequired(detalle.jsonSchema ?? '', savedDataRef.current)
    if (missing.length > 0) {
      setValidationErrors(missing)
      return
    }
    setValidationErrors([])
    onFirmar(firma)
  }

  const detDesviaciones = desviaciones.filter(d => d.idDetalle === detalle.id)

  return (
    <div className={`det-card${open ? ' det-open' : ''}`}
      style={{ borderLeftColor: allCierDone ? '#2D5D4A' : cierFirmadas > 0 ? '#F59E0B' : 'rgba(10,21,48,0.1)' }}>

      {/* ── Header ── */}
      <div
        className="det-header"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={`${detalle.descripcion} — ${open ? 'Colapsar' : 'Expandir'}`}
        onClick={() => setOpen(!open)}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setOpen(!open))}
      >
        <div style={{
          width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
          background: allCierDone ? '#2D5D4A' : cierFirmadas > 0 ? '#F59E0B' : '#EEF2F9',
          color: allCierDone || cierFirmadas > 0 ? '#fff' : '#94A3B8',
          display: 'grid', placeItems: 'center', fontSize: 11,
        }}>
          {allCierDone
            ? <i className="fa fa-check" style={{ fontSize: 10 }} />
            : cierFirmadas > 0
              ? <i className="fa fa-pen" style={{ fontSize: 9 }} />
              : <i className="fa fa-minus" style={{ fontSize: 9 }} />}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0A1530' }}>{detalle.descripcion}</div>
          {allCierDone && (() => {
            const lastF    = firmasCierre[firmasCierre.length - 1]
            const lastInfo = lastF ? firmados[`cie:${detalle.id}:${lastF.idFirma}`] : undefined
            return lastInfo ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                <i className="fa fa-user-check" style={{ fontSize: 9, color: '#2D5D4A' }} />
                <span style={{ fontSize: 11, color: '#2D5D4A', fontWeight: 600 }}>{lastInfo.nombre}</span>
                <span style={{ fontSize: 10, color: '#94A3B8', fontFamily: 'var(--f-mono)' }}>
                  · {lastInfo.fecha} {lastInfo.hora}
                </span>
              </div>
            ) : null
          })()}
        </div>

        {firmasCierre.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {firmasCierre.map(f => (
              <div key={f.idFirma} title={f.texto} style={{
                width: 8, height: 8, borderRadius: '50%',
                background: firmados[`cie:${detalle.id}:${f.idFirma}`] ? '#2D5D4A' : 'rgba(10,21,48,0.15)',
              }} />
            ))}
          </div>
        )}

        {allCierDone && (
          <span style={{
            fontSize: 10.5, fontWeight: 700, letterSpacing: '0.03em',
            background: '#D1FAE5', color: '#065F46',
            padding: '2px 9px', borderRadius: 20, flexShrink: 0, fontFamily: 'var(--f-mono)',
          }}>
            ✓ FIRMADO
          </span>
        )}

        {open
          ? <ChevronUp size={14} style={{ color: '#94A3B8', flexShrink: 0 }} />
          : <ChevronDown size={14} style={{ color: '#94A3B8', flexShrink: 0 }} />}
      </div>

      {/* ── Content ── */}
      {open && (
        <div style={{ borderTop: '1px solid rgba(10,21,48,0.07)' }}>
          <FormioFrame schema={detalle.jsonSchema ?? ''} language={languageOfDetalle(detalle.jsonOptions)} locked={cierFirmadas > 0} lockedKeys={lockedKeys} onDataChange={handleIframeData} getInitialData={getInitialData} onValidation={setRangeErrors} />

          {/* ── Range errors from form.io ── */}
          {rangeErrors.length > 0 && (
            <div style={{
              margin: '0 16px 10px', padding: '10px 14px',
              background: '#FFFBEB', border: '1.5px solid #FCD34D',
              borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: 7, background: '#D97706',
                  display: 'grid', placeItems: 'center', flexShrink: 0,
                }}>
                  <i className="fa fa-exclamation-triangle" style={{ fontSize: 9, color: '#fff' }} />
                </div>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#92400E', flex: 1 }}>
                  Valor fuera de rango — revisa antes de firmar
                </span>
              </div>
              {rangeErrors.map((err, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: '#fff', borderRadius: 7, padding: '5px 10px',
                  border: '1px solid #FDE68A',
                }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: '#78350F', flex: 1 }}>
                    {err.label}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: '#D97706',
                    background: '#FEF3C7', borderRadius: 20,
                    padding: '2px 8px', letterSpacing: '0.04em', textTransform: 'uppercase',
                    flexShrink: 0,
                  }}>
                    fuera de rango
                  </span>
                  {!readonly && (
                    <button
                      style={{
                        fontSize: 11, fontWeight: 700, color: '#92400E',
                        background: '#FEF3C7', border: '1px solid #FCD34D',
                        borderRadius: 6, padding: '3px 10px', cursor: 'pointer', flexShrink: 0,
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}
                      onClick={() => setDesviacionModal({ error: err, valorIngresado: String(savedDataRef.current[err.key] ?? '') })}
                    >
                      <i className="fa fa-flag" style={{ fontSize: 9 }} /> Reportar
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Validation errors ── */}
          {validationErrors.length > 0 && (
            <div style={{
              margin: '0 16px 10px', padding: '12px 16px',
              background: '#FFF5F5', border: '1.5px solid #FCA5A5',
              borderRadius: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: 7, background: '#DC2626',
                  display: 'grid', placeItems: 'center', flexShrink: 0,
                }}>
                  <i className="fa fa-exclamation" style={{ fontSize: 10, color: '#fff' }} />
                </div>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#991B1B', letterSpacing: '0.01em' }}>
                  Completa estos campos antes de firmar
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {validationErrors.map((err, idx) => (
                  <div key={idx} style={{
                    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                    background: '#fff', borderRadius: 7, padding: '6px 10px',
                    border: '1px solid #FECACA',
                  }}>
                    <span style={{
                      fontSize: 12.5, fontWeight: 600, color: '#7F1D1D',
                      flex: 1, minWidth: 120,
                    }}>
                      {err.label}
                    </span>
                    {err.rows ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, color: '#B91C1C', fontWeight: 600, marginRight: 2 }}>
                          fila{err.rows.length > 1 ? 's' : ''}:
                        </span>
                        {err.rows.map(n => (
                          <span key={n} style={{
                            width: 22, height: 22, borderRadius: '50%',
                            background: '#DC2626', color: '#fff',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 700, fontFamily: 'var(--f-mono)', flexShrink: 0,
                          }}>{n}</span>
                        ))}
                      </div>
                    ) : (
                      <span style={{
                        fontSize: 10, fontWeight: 700, color: '#DC2626',
                        background: '#FEE2E2', borderRadius: 20,
                        padding: '2px 8px', letterSpacing: '0.04em', textTransform: 'uppercase',
                        flexShrink: 0,
                      }}>
                        requerido
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Desviaciones registradas ── */}
          {detDesviaciones.length > 0 && (
            <div style={{ margin: '0 16px 10px', border: '1.5px solid #FCD34D', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ background: '#FFFBEB', padding: '8px 14px', borderBottom: '1px solid #FDE68A', display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fa fa-triangle-exclamation" style={{ color: '#D97706', fontSize: 11 }} />
                <span style={{ fontSize: 11, fontWeight: 800, color: '#78350F', textTransform: 'uppercase', letterSpacing: '.06em', flex: 1 }}>
                  Desviaciones registradas ({detDesviaciones.length})
                </span>
              </div>
              {detDesviaciones.map((d, i) => (
                <div key={d.id} style={{ padding: '10px 14px', borderBottom: i < detDesviaciones.length - 1 ? '1px solid #FEF3C7' : 'none', background: '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: '#78350F' }}>{d.labelCampo}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 100, flexShrink: 0,
                      background: d.estado === 'abierta' ? '#FEF3C7' : '#D1FAE5',
                      color: d.estado === 'abierta' ? '#D97706' : '#065F46',
                      textTransform: 'uppercase', letterSpacing: '.04em',
                    }}>
                      {d.estado === 'abierta' ? 'Abierta' : 'Cerrada'}
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, color: '#92400E', marginBottom: 5 }}>
                    Valor: <strong>{d.valorIngresado}</strong> · {d.limiteInfo}
                  </div>
                  <div style={{ fontSize: 12, color: '#1E293B', lineHeight: 1.5, marginBottom: 6 }}>{d.descripcion}</div>
                  <div style={{ fontSize: 11, color: '#64748B', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <i className="fa fa-user" style={{ fontSize: 9 }} />
                    {d.usuarioReporta.nombres} {d.usuarioReporta.apellidos}
                    <span style={{ color: '#CBD5E1' }}>·</span>
                    {new Date(d.fechaHora).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                  {d.observacionCierre && (
                    <div style={{ marginTop: 7, padding: '6px 10px', background: '#F0FDF4', borderRadius: 7, border: '1px solid #BBF7D0' }}>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: '#15803D', marginBottom: 2 }}>
                        <i className="fa fa-check-circle" style={{ marginRight: 5 }} />Cierre{d.usuarioCierra ? ` · ${d.usuarioCierra.nombres} ${d.usuarioCierra.apellidos}` : ''}
                      </div>
                      <div style={{ fontSize: 11.5, color: '#166534' }}>{d.observacionCierre}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Firma block ── */}
          {firmasCierre.length > 0 && (
            <div className="firma-block">
              <div className="firma-block-hdr">
                <div style={{
                  width: 22, height: 22, borderRadius: 7, flexShrink: 0,
                  background: '#EEF2F9', display: 'grid', placeItems: 'center',
                }}>
                  <i className="fa fa-pen" style={{ fontSize: 9, color: '#0A2D63' }} />
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 800, color: '#0A2D63',
                  textTransform: 'uppercase', letterSpacing: '0.08em', flex: 1,
                }}>Firmas de aprobación</span>
                <span style={{
                  fontSize: 11, fontFamily: 'var(--f-mono)', fontWeight: 700,
                  background: allCierDone ? '#D1FAE5' : '#EEF2F9',
                  color: allCierDone ? '#065F46' : '#475569',
                  padding: '1px 9px', borderRadius: 12,
                }}>
                  {cierFirmadas}/{firmasCierre.length}
                </span>
              </div>

              {firmasCierre.map((firma, i) => {
                const firmaKey  = `cie:${detalle.id}:${firma.idFirma}`
                const firmaInfo = firmados[firmaKey]
                const prevOk    = i === 0 || !!firmados[`cie:${detalle.id}:${firmasCierre[i - 1].idFirma}`]
                const bloq      = !prevOk && !firmaInfo
                return (
                  <div key={firma.idFirma} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 14, padding: '12px 18px',
                    flexWrap: 'wrap',
                    borderTop: '1px solid rgba(10,21,48,0.05)',
                    background: firmaInfo ? 'rgba(45,93,74,0.03)' : 'transparent',
                    opacity: bloq ? 0.4 : 1, transition: 'opacity 200ms',
                  }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                      background: firmaInfo ? '#2D5D4A' : '#0A2D63',
                      color: '#fff', display: 'grid', placeItems: 'center',
                      fontSize: 10, fontWeight: 700, fontFamily: 'var(--f-mono)',
                    }}>
                      {firmaInfo ? <i className="fa fa-check" style={{ fontSize: 8 }} /> : firma.orden}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: firmaInfo ? '#2D5D4A' : '#0A1530' }}>
                        {firma.texto}
                      </div>
                      <div style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'var(--f-mono)', marginTop: 2 }}>
                        Grupo: {firma.firma.grupo.nombre}
                      </div>
                    </div>
                    {firmaInfo
                      ? (
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'flex-start' }}>
                          <FirmaStamp info={firmaInfo} />
                          {puedeDerogar && onRequestDerogar && (
                            <button title="Derogar firma"
                              style={{
                                marginTop: 2, background: '#FEF2F2', border: '1px solid #FECACA',
                                borderRadius: 6, padding: '4px 8px', cursor: 'pointer',
                                color: '#DC2626', fontSize: 11, flexShrink: 0,
                              }}
                              onClick={() => onRequestDerogar(firmaKey, detalle.id, firmaInfo, firma.texto, firma.firma.grupo.nombre)}>
                              <i className="fa fa-undo" />
                            </button>
                          )}
                        </div>
                      )
                      : (!readonly && !bloq && (
                          <button className="btn btn-warning" style={{ fontSize: 12, flexShrink: 0 }}
                            onClick={() => handleFirmar(firma)}>
                            <i className="fa fa-pen" /> Firmar
                          </button>
                        ))
                    }
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Modal de desviación ── */}
      {desviacionModal && (
        <DesviacionModal
          error={desviacionModal.error}
          valorIngresado={desviacionModal.valorIngresado}
          detalleCode={detalle.codigo}
          onSubmit={desc => {
            onDesviacion?.(detalle.id, desviacionModal.error.key, desviacionModal.error.label, desviacionModal.valorIngresado, desviacionModal.error.message, desc)
          }}
          onClose={() => setDesviacionModal(null)}
        />
      )}
    </div>
  )
}

// ── AuditPreviewPanel / AuditExpandedPanel ────────────────────────────────
const AUDIT_CFG: Record<string, { bg: string; color: string; border: string; label: string; icon: string }> = {
  CREAR:          { bg:'#D1FAE5', color:'#065F46', border:'#6EE7B7', label:'Creación',     icon:'fa-plus' },
  MODIFICAR:      { bg:'#DBEAFE', color:'#1D4ED8', border:'#93C5FD', label:'Modificación', icon:'fa-pencil-alt' },
  CANCELAR:       { bg:'#FEE2E2', color:'#991B1B', border:'#FCA5A5', label:'Cancelación',  icon:'fa-ban' },
  FIRMAR_SECCION: { bg:'#EDE9FE', color:'#5B21B6', border:'#C4B5FD', label:'Firma Sección',icon:'fa-pen' },
  FIRMAR_CIERRE:  { bg:'#EDE9FE', color:'#5B21B6', border:'#C4B5FD', label:'Firma Cierre', icon:'fa-check-circle' },
  DEROGAR_FIRMA:  { bg:'#FEF3C7', color:'#92400E', border:'#FDE68A', label:'Derogación',   icon:'fa-undo' },
  LIBERAR_LOTE:   { bg:'#D1FAE5', color:'#065F46', border:'#6EE7B7', label:'Liberación',   icon:'fa-unlock' },
}

function useBrAudit(brId: string | number | undefined, refreshKey: number) {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  useEffect(() => {
    if (!brId) return
    // idEntidad no es único entre tipos de entidad (un idUsuario de Sesion puede coincidir
    // numéricamente con un idBatchRecord) — se excluyen eventos de Sesion, que nunca pertenecen a un BR.
    auditoriaApi.consultar({ idEntidad: brId }).then(all => setEntries(all.filter(e => e.entidad !== 'Sesion'))).catch(() => setEntries([]))
  }, [brId, refreshKey])
  return entries
}

function AuditPreviewPanel({ brId, refreshKey }: { brId: string | number; refreshKey: number }) {
  const entries = useBrAudit(brId, refreshKey)
  const [busqueda, setBusqueda] = useState('')
  const [campoFiltro, setCampoFiltro] = useState('')

  // Etiquetas únicas de todos los campos que han cambiado en este BR — alimenta el selector
  // "ver historial de un campo". Se ordenan alfabéticamente para que sean fáciles de ubicar.
  const camposDisponibles = Array.from(
    new Set(entries.flatMap(e => (e.cambios ?? []).map(c => c.etiqueta)))
  ).sort((a, b) => a.localeCompare(b, 'es'))

  // Con un campo seleccionado: aplana todos los cambios de ESE campo (a través de todas las
  // entradas) en una sola línea de tiempo — así se ve solo la evolución de ese valor, en vez
  // de tener que buscarlo entrada por entrada entre cambios de otros campos.
  const historialCampo = campoFiltro
    ? entries.flatMap(e => (e.cambios ?? [])
        .filter(c => c.etiqueta === campoFiltro)
        .map(c => ({ entry: e, cambio: c })))
    : []

  const q = busqueda.trim().toLowerCase()
  const entriesFiltradas = !q ? entries : entries.filter(e =>
    e.descripcionEntidad?.toLowerCase().includes(q) ||
    e.nombreUsuario?.toLowerCase().includes(q) ||
    e.loginUsuario?.toLowerCase().includes(q) ||
    (e.cambios ?? []).some(c => c.etiqueta.toLowerCase().includes(q) || c.valorAnterior?.toLowerCase().includes(q) || c.valorNuevo?.toLowerCase().includes(q))
  )

  return (
    <div className="audit-panel">
      <style>{`
        .audit-panel { display: flex; flex-direction: column; background: #0E1E3F; border-radius: 14px; overflow: hidden; min-width: 280px; max-width: 320px; border: 1.5px solid rgba(255,255,255,0.08); }
        .audit-entry { padding: 10px 13px; border-bottom: 1px solid rgba(255,255,255,0.06); border-left: 3px solid transparent; transition: background 80ms; }
        .audit-entry:hover { background: rgba(255,255,255,0.04); }
        .audit-entry:last-child { border-bottom: none; }
        .audit-badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 700; }
        .audit-cambio { display: flex; gap: 6px; font-size: 10.5px; padding: 3px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .audit-cambio:last-child { border-bottom: none; }
        .audit-val { font-family: var(--f-mono); font-size: 10px; padding: 1px 5px; border-radius: 4px; max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .audit-val-ant { background: rgba(239,68,68,0.15); color: #FCA5A5; }
        .audit-val-nv  { background: rgba(16,185,129,0.15); color: #6EE7B7; }
        .audit-filters { padding: 9px 14px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; flex-direction: column; gap: 6px; }
        .audit-filters input, .audit-filters select {
          width: 100%; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 7px;
          padding: 6px 9px; font-size: 11.5px; color: #fff; outline: none; font-family: inherit;
        }
        .audit-filters input::placeholder { color: rgba(255,255,255,0.35); }
        .audit-filters select option { color: #0A1530; }
        .audit-filters input:focus, .audit-filters select:focus { border-color: #F7C92E; }
        .audit-field-row { display: flex; align-items: baseline; gap: 8px; padding: 8px 13px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .audit-field-row:last-child { border-bottom: none; }
        @media (prefers-reduced-motion: reduce) { .audit-entry { transition: none; } }
      `}</style>

      <div style={{ padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 9, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: 'rgba(247,201,46,0.15)', border: '1.5px solid rgba(247,201,46,0.3)', display: 'grid', placeItems: 'center' }}>
          <i className="fa fa-history" style={{ color: '#F7C92E', fontSize: 11 }} aria-hidden="true" />
        </div>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 13, flex: 1 }}>Historial de Auditoría</span>
        <span style={{ fontSize: 11, fontFamily: 'var(--f-mono)', fontWeight: 700, background: 'rgba(255,255,255,0.1)', color: entries.length > 0 ? '#F7C92E' : 'rgba(255,255,255,0.4)', padding: '2px 8px', borderRadius: 10 }}>
          {entries.length}
        </span>
      </div>

      {entries.length > 0 && (
        <div className="audit-filters">
          <input
            type="text"
            placeholder="Buscar por usuario, campo, valor…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
          {camposDisponibles.length > 0 && (
            <select value={campoFiltro} onChange={e => setCampoFiltro(e.target.value)}>
              <option value="">Ver todos los campos</option>
              {camposDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', maxHeight: 'calc(100vh - 260px)' }}>
        {entries.length === 0 ? (
          <div style={{ padding: '36px 16px', textAlign: 'center' }}>
            <i className="fa fa-history" style={{ fontSize: 28, color: 'rgba(255,255,255,0.1)', display: 'block', marginBottom: 12 }} aria-hidden="true" />
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,0.3)', marginBottom: 6 }}>Sin eventos registrados</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', lineHeight: 1.6 }}>
              Las firmas y cambios en campos<br />aparecen aquí en tiempo real.
            </div>
          </div>
        ) : campoFiltro ? (
          historialCampo.length === 0 ? (
            <div style={{ padding: '30px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>Sin cambios registrados para este campo.</div>
            </div>
          ) : historialCampo.map(({ entry: e, cambio: c }, i) => {
            const d = new Date(e.timestamp)
            const fecha = d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
            const hora  = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            return (
              <div key={`${e.id}-${i}`} className="audit-field-row">
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#F7C92E', flexShrink: 0, marginTop: 5 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span className="audit-val audit-val-ant" title={c.valorAnterior || '—'}>{c.valorAnterior || '—'}</span>
                    <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>→</span>
                    <span className="audit-val audit-val-nv" title={c.valorNuevo || '—'}>{c.valorNuevo || '—'}</span>
                  </div>
                  <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.6)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.nombreUsuario}
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--f-mono)' }}>
                    {fecha} · {hora}
                  </div>
                </div>
              </div>
            )
          })
        ) : entriesFiltradas.length === 0 ? (
          <div style={{ padding: '30px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>Ningún evento coincide con la búsqueda.</div>
          </div>
        ) : entriesFiltradas.map(e => {
          const d   = new Date(e.timestamp)
          const cfg = AUDIT_CFG[e.accion] ?? { bg:'#F1F5F9', color:'#475569', border:'#CBD5E1', label: e.accion, icon:'fa-circle' }
          const fecha = d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
          const hora  = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          return (
            <div key={e.id} className="audit-entry" style={{ borderLeftColor: cfg.border }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, flexWrap: 'wrap' }}>
                <span className="audit-badge" style={{ background: cfg.bg, color: cfg.color }}>
                  <i className={`fa ${cfg.icon}`} style={{ fontSize: 9 }} aria-hidden="true" />
                  {cfg.label}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginBottom: 5, fontWeight: 500, lineHeight: 1.3 }}>
                {e.descripcionEntidad}
              </div>

              {e.cambios && e.cambios.length > 0 && (
                <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 7, padding: '6px 8px', marginBottom: 6 }}>
                  <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.35)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 5 }}>
                    {e.cambios.length} campo{e.cambios.length !== 1 ? 's' : ''} modificado{e.cambios.length !== 1 ? 's' : ''}
                  </div>
                  {e.cambios.map((c, i) => (
                    <div key={i} className="audit-cambio">
                      <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.5)', flex: 1, minWidth: 0 }}>
                        <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.7)', display: 'block', marginBottom: 2 }}>{c.etiqueta}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                          <span className="audit-val audit-val-ant" title={c.valorAnterior || '—'}>{c.valorAnterior || '—'}</span>
                          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>→</span>
                          <span className="audit-val audit-val-nv" title={c.valorNuevo || '—'}>{c.valorNuevo || '—'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {e.motivo && (
                <div style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 6, padding: '4px 8px', marginBottom: 6, fontSize: 10.5, color: '#FDE68A', lineHeight: 1.4 }}>
                  <i className="fa fa-comment-alt" style={{ marginRight: 5, fontSize: 9 }} aria-hidden="true" />
                  {e.motivo}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 2 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.75)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.nombreUsuario}
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--f-mono)' }}>
                    {e.loginUsuario} · {e.cargo}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.45)', fontFamily: 'var(--f-mono)', fontWeight: 600 }}>{hora}</div>
                  <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--f-mono)' }}>{fecha}</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <a href="/admin/logs" style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)', textDecoration: 'none', fontWeight: 600 }}
          onMouseEnter={e => (e.currentTarget.style.color = '#F7C92E')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}>
          Ver auditoría completa →
        </a>
      </div>
    </div>
  )
}

const AT_TH: React.CSSProperties = {
  padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700,
  color: '#475569', textTransform: 'uppercase', letterSpacing: '.06em',
  borderBottom: '2px solid #E2E8F0', whiteSpace: 'nowrap', background: '#F8FAFC',
}
const AT_TD: React.CSSProperties = {
  padding: '9px 12px', verticalAlign: 'top', borderBottom: '1px solid #F1F5F9',
}

function AuditExpandedPanel({ brId, refreshKey }: { brId: string | number; refreshKey: number }) {
  const entries = useBrAudit(brId, refreshKey)
  const [open, setOpen] = useState(true)

  return (
    <div style={{ margin: '18px 0 0', border: '1.5px solid #E2E8F0', borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => e.key === 'Enter' && setOpen(o => !o)}
        style={{ cursor: 'pointer', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10, background: '#F8FAFC', borderBottom: open ? '1.5px solid #E2E8F0' : 'none' }}
      >
        <div style={{ width: 34, height: 34, borderRadius: 10, background: '#0A2D63', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <i className="fa fa-history" style={{ color: '#fff', fontSize: 13 }} aria-hidden="true" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#0A2D63', letterSpacing: '.01em' }}>
            Trazabilidad GMP / Audit Trail
          </div>
          <div style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>
            Registro completo de firmas, modificaciones y eventos GMP de este Batch Record
          </div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 800, background: entries.length > 0 ? '#0A2D63' : '#E2E8F0', color: entries.length > 0 ? '#fff' : '#94A3B8', padding: '2px 12px', borderRadius: 20 }}>
          {entries.length}
        </span>
        <i className={`fa fa-chevron-${open ? 'up' : 'down'}`} style={{ color: '#94A3B8', fontSize: 12, marginLeft: 4 }} aria-hidden="true" />
      </div>

      {open && (
        entries.length === 0 ? (
          <div style={{ padding: '44px 20px', textAlign: 'center' }}>
            <i className="fa fa-history" style={{ fontSize: 34, color: '#E2E8F0', display: 'block', marginBottom: 14 }} aria-hidden="true" />
            <div style={{ fontSize: 13, fontWeight: 700, color: '#94A3B8', marginBottom: 5 }}>Sin eventos de auditoría</div>
            <div style={{ fontSize: 11.5, color: '#CBD5E1', lineHeight: 1.6 }}>
              Realiza acciones en el BR (firmar, modificar datos, cerrar procesos)<br />para generar entradas de auditoría.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={AT_TH}>Fecha / Hora</th>
                  <th style={AT_TH}>Acción</th>
                  <th style={AT_TH}>Sección / Formulario</th>
                  <th style={AT_TH}>Usuario</th>
                  <th style={AT_TH}>Cargo</th>
                  <th style={{ ...AT_TH, width: '36%' }}>Detalle de cambios / Motivo</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => {
                  const cfg    = AUDIT_CFG[e.accion] ?? { bg:'#F1F5F9', color:'#475569', border:'#CBD5E1', label: e.accion, icon:'fa-circle' }
                  const d      = new Date(e.timestamp)
                  const fecha  = d.toLocaleDateString('es-CO', { day:'2-digit', month:'2-digit', year:'numeric' })
                  const hora   = d.toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit', second:'2-digit' })
                  return (
                    <tr key={e.id} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                      <td style={AT_TD}>
                        <div style={{ fontFamily: 'var(--f-mono)', fontSize: 11.5, fontWeight: 700, color: '#374151' }}>{hora}</div>
                        <div style={{ fontFamily: 'var(--f-mono)', fontSize: 10, color: '#94A3B8', marginTop: 2 }}>{fecha}</div>
                      </td>
                      <td style={AT_TD}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, fontWeight: 700, fontSize: 10.5, whiteSpace: 'nowrap' }}>
                          <i className={`fa ${cfg.icon}`} style={{ fontSize: 9 }} aria-hidden="true" />
                          {cfg.label}
                        </span>
                      </td>
                      <td style={AT_TD}>
                        <div style={{ fontSize: 11.5, color: '#374151', fontWeight: 500, maxWidth: 180 }}>{e.descripcionEntidad}</div>
                      </td>
                      <td style={AT_TD}>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: '#111827' }}>{e.nombreUsuario}</div>
                        <div style={{ fontSize: 10, color: '#94A3B8', fontFamily: 'var(--f-mono)', marginTop: 2 }}>{e.loginUsuario}</div>
                      </td>
                      <td style={AT_TD}>
                        <div style={{ fontSize: 11, color: '#64748B', maxWidth: 140 }}>{e.cargo}</div>
                      </td>
                      <td style={AT_TD}>
                        {e.cambios && e.cambios.length > 0 ? (
                          <div>
                            {e.cambios.map((c, ci) => (
                              <div key={ci} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3, fontSize: 10.5, flexWrap: 'wrap' }}>
                                <span style={{ color: '#64748B', fontWeight: 600, flexShrink: 0 }}>{c.etiqueta}:</span>
                                <span style={{ background: '#FEE2E2', color: '#991B1B', padding: '0 5px', borderRadius: 3, fontFamily: 'var(--f-mono)', fontSize: 10 }}>
                                  {c.valorAnterior || '—'}
                                </span>
                                <span style={{ color: '#CBD5E1', fontSize: 10 }}>→</span>
                                <span style={{ background: '#D1FAE5', color: '#065F46', padding: '0 5px', borderRadius: 3, fontFamily: 'var(--f-mono)', fontSize: 10 }}>
                                  {c.valorNuevo || '—'}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : e.motivo ? (
                          <div style={{ fontSize: 11, color: '#92400E', background: '#FEF3C7', padding: '3px 9px', borderRadius: 5, border: '1px solid #FDE68A', display: 'inline-block' }}>
                            <i className="fa fa-comment-alt" style={{ marginRight: 5, fontSize: 9 }} aria-hidden="true" />
                            {e.motivo}
                          </div>
                        ) : (
                          <span style={{ color: '#E2E8F0', fontSize: 11 }}>—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────
export function EditarBatchRecord({ readonly = false }: { readonly?: boolean }) {
  const { id } = useParams()
  const idNum = Number(id)
  const navigate = useNavigate()
  const { registrar } = useAudit()
  const authUser = useAuthStore(s => s.user)
  const puedeEditar = usePuedeEditar('batch-records')
  // El modo lectura se activa por ruta (/consultar) o porque el Rol del usuario no tiene
  // permiso de edición en Batch Records — ambos casos deben bloquear las mismas acciones.
  const soloLectura = readonly || !puedeEditar

  const [loading, setLoading] = useState(true)
  const [br, setBr] = useState<BatchRecord | null>(null)
  const [receta, setReceta] = useState<RecetaMaestra | null>(null)
  const [preLlenado, setPreLlenado] = useState<PreLlenadoBR | null>(null)
  const [estructura, setEstructura] = useState<ProcesoRow[]>([])
  const [detalleStruct, setDetalleStruct] = useState<DetalleRow[]>([])
  const [detalleDatos, setDetalleDatos] = useState<Record<number, Record<string, unknown>>>({})
  const [firmas, setFirmas] = useState<BatchRecordFirmaRegistrada[]>([])
  const [procesosCerrados, setProcesosCerrados] = useState<Set<number>>(new Set())
  const [liberacion, setLiberacion] = useState<{ nombre: string; grupo: string; fecha: string; hora: string } | null>(null)
  const [desviaciones, setDesviaciones] = useState<Desviacion[]>([])
  const [procesoActivo, setProcesoActivo] = useState<number | null>(null)
  const [materiales, setMateriales] = useState<Material[]>([])
  // Se incrementa cada vez que cargarTodo() corre, para forzar a los paneles de auditoría
  // (componentes hijos con su propio fetch) a refrescar tras firmar/derogar/liberar/cerrar etapa.
  const [auditVersion, setAuditVersion] = useState(0)

  const cargarTodo = useCallback(async () => {
    if (!idNum) return
    setAuditVersion(v => v + 1)
    const brData = await batchRecordApi.find(idNum)
    setBr(brData)
    const [pl, est, datos, firmasData, cierres, lib, desvs, rec, mats] = await Promise.all([
      batchRecordApi.getPreLlenado(idNum),
      batchRecordApi.getEstructura(idNum),
      batchRecordApi.getDetalles(idNum),
      batchRecordApi.getFirmas(idNum),
      batchRecordApi.getProcesosCerrados(idNum),
      batchRecordApi.getLiberacion(idNum),
      desviacionesApi.listar(idNum),
      recetaMaestraApi.find(brData.idRecetaMaestra).catch(() => null),
      materialesApi.listar(),
    ])
    setPreLlenado(pl)
    setReceta(rec)
    setMateriales(mats)
    setEstructura(est.map(ep => ({ id: ep.idProceso, codigo: ep.proceso.codigo, descripcion: ep.proceso.descripcion, orden: ep.orden })))
    const detalles: DetalleRow[] = est.flatMap(ep => ep.detalles.map(d => ({ ...d.detalle, idProceso: ep.idProceso, orden: d.orden })))
    setDetalleStruct(detalles)
    setDetalleDatos(Object.fromEntries(datos.map(d => {
      try { return [d.idDetalle, JSON.parse(d.jsonData) as Record<string, unknown>] } catch { return [d.idDetalle, {}] }
    })))
    setFirmas(firmasData)
    setProcesosCerrados(new Set(cierres.map(c => c.idProceso)))
    setLiberacion(lib ? {
      nombre: `${lib.usuario.nombres} ${lib.usuario.apellidos}`,
      grupo: lib.usuario.login,
      fecha: new Date(lib.liberadoEn).toISOString().slice(0, 10),
      hora: new Date(lib.liberadoEn).toTimeString().slice(0, 5),
    } : null)
    setDesviaciones(desvs)
    setProcesoActivo(prev => prev ?? est[0]?.idProceso ?? null)
    setLoading(false)
  }, [idNum])

  useEffect(() => { cargarTodo() }, [cargarTodo])

  const accessRegistered = useRef(false)
  useEffect(() => {
    if (readonly || !id || accessRegistered.current) return
    accessRegistered.current = true
    registrar({
      entidad: 'BatchRecord',
      idEntidad: idNum,
      descripcionEntidad: `Batch Record #${id}`,
      accion: 'CREAR',
      modulo: 'batch-record',
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, readonly])

  const firmados = firmasToMap(firmas)
  const [firmaTarget, setFirmaTarget] = useState<{ detalle: DetalleRow; firma: EstructuraFirmaItem } | null>(null)
  const [showAudit, setShowAudit] = useState(true)
  const [liberarModal, setLiberarModal] = useState(false)
  const [derogTarget, setDerogTarget] = useState<{ firmaKey: string; detalleId: number; firmaInfo: FirmaInfo; texto: string; grupo: string } | null>(null)

  const brFinalizado = detalleStruct.length > 0 && detalleStruct.every(d => {
    const fc = getFirmasDeEstrategia(d)
    return fc.length > 0 && fc.every(f => !!firmados[`cie:${d.id}:${f.idFirma}`])
  })

  const totalFirmasCierre = detalleStruct.reduce((n, d) => n + getFirmasDeEstrategia(d).length, 0)
  const doneFirmasCierre  = detalleStruct.reduce((n, d) =>
    n + getFirmasDeEstrategia(d).filter(f => !!firmados[`cie:${d.id}:${f.idFirma}`]).length, 0)
  const overallPct = totalFirmasCierre > 0 ? Math.round((doneFirmasCierre / totalFirmasCierre) * 100) : 0

  const ESTADO_BADGE = {
    1: { label: 'En Tratamiento', bg: 'rgba(59,130,246,0.22)',  color: '#93C5FD' },
    2: { label: 'Finalizado',     bg: 'rgba(16,185,129,0.22)',  color: '#6EE7B7' },
    3: { label: 'Cancelado',      bg: 'rgba(239,68,68,0.22)',   color: '#FCA5A5' },
    4: { label: 'Liberado',       bg: 'rgba(167,139,250,0.22)', color: '#C4B5FD' },
  } as const
  const estadoBadge = ESTADO_BADGE[(br?.idEstado ?? 1) as keyof typeof ESTADO_BADGE] ?? ESTADO_BADGE[1]

  const handleFormData = (
    detalleId: number,
    prev: Record<string, unknown>,
    next: Record<string, unknown>,
    labels: Record<string, string>
  ) => {
    setDetalleDatos(d => ({ ...d, [detalleId]: next }))
    if (!readonly) {
      batchRecordApi.guardarDetalle(idNum, detalleId, JSON.stringify(next)).catch(err => console.error('No se pudo guardar el formulario', err))
    }
    const cambios = diffFormData(prev, next, labels)
    if (!cambios.length) return
    const det = detalleStruct.find(d => d.id === detalleId)
    registrar({
      entidad: 'DetalleValores',
      idEntidad: idNum,
      descripcionEntidad: det?.descripcion ?? `Detalle ${detalleId}`,
      accion: 'MODIFICAR',
      modulo: 'batch-record',
      cambios,
    })
  }

  const handleDesviacion = async (detalleId: number, campo: string, labelCampo: string, valorIngresado: string, limiteInfo: string, descripcion: string) => {
    await desviacionesApi.crear({ idBatchRecord: idNum, idDetalle: detalleId, campo, labelCampo, valorIngresado, limiteInfo, descripcion })
    const desvs = await desviacionesApi.listar(idNum)
    setDesviaciones(desvs)
  }

  const handleDerogar = async (motivo: string) => {
    if (!derogTarget) return
    // El backend ya registra DEROGAR_FIRMA de forma atómica dentro de la misma transacción
    // (POST /batch-records/:id/firmas/:idFirmaRegistro/derogar) — no duplicar aquí.
    const res = await batchRecordApi.derogarFirma(idNum, derogTarget.firmaInfo.idRegistro, motivo)
    if (res.estado) {
      await cargarTodo()
    }
    setDerogTarget(null)
  }

  const detallesProceso = detalleStruct.filter(d => d.idProceso === procesoActivo)
  const procesoIdx  = estructura.findIndex(p => p.id === procesoActivo)
  const procesoInfo = estructura[procesoIdx]

  const handleCerrarProceso = async () => {
    if (procesoActivo == null) return
    const allDone = detallesProceso.every(d => {
      const fc = getFirmasDeEstrategia(d)
      return fc.length > 0 && fc.every(f => !!firmados[`cie:${d.id}:${f.idFirma}`])
    })
    if (!allDone) return
    const res = await batchRecordApi.cerrarProceso(idNum, procesoActivo)
    if (res.estado) {
      await cargarTodo()
      const nextIdx = procesoIdx + 1
      if (nextIdx < estructura.length) setProcesoActivo(estructura[nextIdx].id)
    }
  }

  const allDetallesCurrentDone = detallesProceso.length > 0 && detallesProceso.every(d => {
    const fc = getFirmasDeEstrategia(d)
    return fc.length > 0 && fc.every(f => !!firmados[`cie:${d.id}:${f.idFirma}`])
  })

  const handleCerrarBatch = () => {
    navigate('/batch-records')
  }

  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=1024,height=800')
    if (!win) { alert('Habilita ventanas emergentes en el navegador para imprimir'); return }

    const cab = buildCabeceraItems(preLlenado, receta)
    const now = new Date()
    const printDate = now.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
    const printTime = now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
    const brCode = `BR-${id ?? '—'}`
    const producto = preLlenado?.descripcionMaterial ?? '—'
    const userName = authUser ? `${authUser.nombres} ${authUser.apellidos}` : '—'

    const allFormData: Record<number, Record<string, unknown>> = {}
    detalleStruct.forEach(det => {
      allFormData[det.id] = {
        ...(preLlenado ? extractOpMappings(det.jsonSchema, preLlenado as unknown as Record<string, unknown>) : {}),
        ...(detalleDatos[det.id] ?? {}),
      }
    })

    const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')

    const renderScalarValue = (v: unknown): string => {
      if (v === null || v === undefined || v === '') return '<span class="empty">—</span>'
      if (typeof v === 'boolean') return v ? 'Sí' : 'No'
      return esc(String(v))
    }

    const renderDatagrid = (rows: Record<string, unknown>[], labels: Record<string, string>): string => {
      const valid = rows.filter(r => r && typeof r === 'object')
      if (!valid.length) return '<span class="empty">Sin datos</span>'
      const cols = Object.keys(valid[0]).filter(k => !k.startsWith('btn'))
      const thead = `<thead><tr>${cols.map(k => `<th>${esc(labels[k] ?? k)}</th>`).join('')}</tr></thead>`
      const tbody = `<tbody>${valid.map(row =>
        `<tr>${cols.map(k => {
          const v = row[k]
          return `<td>${v !== null && v !== undefined && v !== '' ? esc(String(v)) : '<span class="empty">—</span>'}</td>`
        }).join('')}</tr>`
      ).join('')}</tbody>`
      return `<div class="dg-wrap"><table class="dg-tbl">${thead}${tbody}</table></div>`
    }

    const renderFormData = (detalleId: number, labels: Record<string, string>): string => {
      const data = allFormData[detalleId] ?? {}
      const entries = Object.entries(data).filter(([k, v]) =>
        !k.startsWith('_') && !k.startsWith('btn') &&
        v !== '' && v !== null && v !== undefined && v !== false
      )
      if (!entries.length) return ''
      const scalars = entries.filter(([, v]) => !Array.isArray(v))
      const dgs = entries.filter(([, v]) => Array.isArray(v))
      const scalarHTML = scalars.length > 0
        ? `<table class="fields-tbl"><tbody>${
            scalars.map(([k, v]) => `<tr><td class="fl">${esc(labels[k] ?? k)}</td><td class="fv">${renderScalarValue(v)}</td></tr>`).join('')
          }</tbody></table>`
        : ''
      const dgHTML = dgs.map(([k, v]) =>
        `<div class="dg-section"><div class="dg-title">${esc(labels[k] ?? k)}</div>${renderDatagrid(v as Record<string, unknown>[], labels)}</div>`
      ).join('')
      return `<div class="det-content">${scalarHTML}${dgHTML}</div>`
    }

    const procsSections = estructura.map((proc, pi) => {
      const dets = detalleStruct.filter(d => d.idProceso === proc.id)
      const detsHTML = dets.map(det => {
        const labels = extractFieldLabels(det.jsonSchema)
        const fc = getFirmasDeEstrategia(det)
        const allSigned = fc.length > 0 && fc.every(f => !!firmados[`cie:${det.id}:${f.idFirma}`])
        const sigCards = fc.map(f => {
          const info = firmados[`cie:${det.id}:${f.idFirma}`]
          return info
            ? `<div class="sig-card signed">
                <div class="sig-card-top"><span class="sig-status">✓ Firmado</span><span class="sig-icon">✍</span></div>
                <div class="sig-card-body">
                  <div class="sig-role">${esc(f.texto)}</div>
                  <div class="sig-name">${esc(info.nombre)}</div>
                  <div class="sig-cargo">${esc(info.grupo)}</div>
                  <div class="sig-datetime">${esc(info.fecha)} · ${esc(info.hora)}</div>
                </div>
              </div>`
            : `<div class="sig-card pending">
                <div class="sig-card-top"><span class="sig-status">Pendiente</span><span class="sig-icon">○</span></div>
                <div class="sig-card-body">
                  <div class="sig-role">${esc(f.texto)}</div>
                  <div class="sig-name">Sin firmar</div>
                  <div class="sig-cargo">—</div>
                  <div class="sig-datetime">—</div>
                </div>
              </div>`
        }).join('')
        return `<div class="det-block">
          <div class="det-hdr">
            <div class="det-step">${det.orden}</div>
            <div class="det-name">${esc(det.descripcion)}</div>
            <div class="det-badge">${esc(det.codigo)}</div>
            <div class="det-status ${allSigned ? 'ok' : 'pend'}">${allSigned ? '✓ Conforme' : '⏳ Pendiente'}</div>
          </div>
          ${renderFormData(det.id, labels)}
          <div class="sig-block">
            <div class="sig-block-title">Firmas de Aprobación — ${esc(det.codigo)}</div>
            <div class="sig-cards">${sigCards}</div>
          </div>
        </div>`
      }).join('')
      return `<div class="etapa-block${pi > 0 ? ' page-break' : ''}">
        <div class="etapa-hdr">
          <span class="etapa-num">Etapa ${pi + 1}</span>
          <span class="etapa-nombre">${esc(proc.descripcion)}</span>
        </div>
        <div class="etapa-body">${detsHTML}</div>
      </div>`
    }).join('')

    const loteGridHTML = cab.map(it =>
      `<div class="lote-cell"><div class="lc-lbl">${esc(it.label)}</div><div class="lc-val">${esc(it.value)}</div></div>`
    ).join('')

    const stampHTML = brFinalizado
      ? `<div class="stamp approved">
          <div class="stamp-icon">✓</div>
          <div class="stamp-body">
            <div class="stamp-title">Batch Record Aprobado</div>
            <div class="stamp-sub">Todas las etapas completadas y firmadas conforme a Buenas Prácticas de Manufactura</div>
            <div class="stamp-date">Impreso: ${printDate} · ${printTime}</div>
          </div>
        </div>`
      : `<div class="stamp pending">
          <div class="stamp-icon pend">⏳</div>
          <div class="stamp-body">
            <div class="stamp-title">En Proceso — Pendiente de Aprobación</div>
            <div class="stamp-sub">${doneFirmasCierre} de ${totalFirmasCierre} firmas completadas</div>
            <div class="stamp-date">Impreso: ${printDate} · ${printTime}</div>
          </div>
        </div>`

    const etapaProgressHTML = estructura.map((proc, pi) => {
      const dets = detalleStruct.filter(d => d.idProceso === proc.id)
      const total = dets.reduce((n, d) => n + getFirmasDeEstrategia(d).length, 0)
      const done  = dets.reduce((n, d) =>
        n + getFirmasDeEstrategia(d).filter(f => !!firmados[`cie:${d.id}:${f.idFirma}`]).length, 0)
      const isDone = total > 0 && done === total
      return `<div class="ep-item ${isDone ? 'done' : 'pend'}">
        <div class="ep-num">${pi + 1}</div>
        <div class="ep-body">
          <div class="ep-name">${esc(proc.descripcion)}</div>
          <div class="ep-sigs">${done} de ${total} firmas</div>
        </div>
        ${isDone ? '<div class="ep-check">✓</div>' : ''}
      </div>`
    }).join('')

    const desvHTML = desviaciones.length === 0
      ? '<div class="desv-empty">Sin desviaciones registradas para este Batch Record.</div>'
      : desviaciones.map(d => {
          const fh = new Date(d.fechaHora)
          const fechaRep = fh.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
          const horaRep  = fh.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
          const det = detalleStruct.find(x => x.id === d.idDetalle)
          return `<div class="desv-card">
            <div class="desv-hdr">
              <span class="desv-badge ${d.estado === 'abierta' ? 'abierta' : 'cerrada'}">${d.estado === 'abierta' ? 'Abierta' : 'Cerrada'}</span>
              <span class="desv-campo">${esc(d.labelCampo)}</span>
              <span class="desv-code">${esc(det?.codigo ?? '')}</span>
            </div>
            <div class="desv-body">
              <div class="desv-valor">Valor ingresado: <strong>${esc(d.valorIngresado)}</strong> &nbsp;·&nbsp; ${esc(d.limiteInfo)}</div>
              <div class="desv-desc">${esc(d.descripcion)}</div>
              <div class="desv-meta">Reportado por ${esc(d.usuarioReporta.nombres + ' ' + d.usuarioReporta.apellidos)} · ${fechaRep} ${horaRep}</div>
              ${d.observacionCierre ? `<div class="desv-cierre">
                <div class="desv-cierre-title">Cierre${d.usuarioCierra ? ' · ' + esc(d.usuarioCierra.nombres + ' ' + d.usuarioCierra.apellidos) : ''}${d.fechaCierre ? ' · ' + new Date(d.fechaCierre).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''}</div>
                <div class="desv-cierre-text">${esc(d.observacionCierre)}</div>
              </div>` : ''}
            </div>
          </div>`
        }).join('')

    win.document.write(`<!DOCTYPE html><html lang="es"><head>
<meta charset="UTF-8">
<title>${brCode} — Registro de Fabricación</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:'Segoe UI',system-ui,Arial,sans-serif;font-size:9pt;line-height:1.45;color:#1E293B;background:#fff}
@page{size:A4 portrait;margin:20mm 15mm 18mm 15mm}
@media print{.no-print{display:none!important}.page-break{page-break-before:always}body{padding-top:12mm}.det-block{page-break-inside:avoid}.sig-block{page-break-inside:avoid}}
.run-hdr{position:fixed;top:0;left:0;right:0;height:10mm;background:#0A2D63;color:#fff;display:flex;align-items:center;padding:0 18px;gap:14px;font-size:7.5pt;z-index:100}
.rh-logo{font-size:11pt;font-weight:900;color:#F7C92E;letter-spacing:-.01em;white-space:nowrap}
.rh-logo em{color:#fff;font-style:normal;font-weight:300}
.rh-sep{width:1px;height:18px;background:rgba(255,255,255,.2);flex-shrink:0}
.rh-prod{flex:1;font-size:8pt;font-weight:600;opacity:.88;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rh-br{font-family:monospace;font-size:9pt;font-weight:800;background:rgba(247,201,46,.18);border:1px solid rgba(247,201,46,.4);color:#F7C92E;padding:2px 10px;border-radius:4px;white-space:nowrap}
.rh-ctrl{font-size:6pt;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:#FCA5A5;border:1px solid rgba(252,165,165,.4);padding:2px 7px;border-radius:3px;white-space:nowrap}
.cover{padding:6mm 0 5mm}
.cover-hero{display:flex;align-items:stretch;border:2px solid #CBD5E1;border-radius:10px;overflow:hidden;margin-bottom:5mm}
.cover-hero-left{flex:1;padding:16px 20px;background:linear-gradient(135deg,#F0F4FF 0%,#fff 100%)}
.cover-brand-row{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.cover-logo{font-size:20pt;font-weight:900;color:#0A2D63;letter-spacing:-.02em;line-height:1}
.cover-logo em{color:#1D4ED8;font-style:normal;font-weight:300;opacity:.5}
.cover-tagline{font-size:7pt;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#475569;padding-left:12px;border-left:2px solid #E2E8F0;line-height:1.4}
.cover-doc-title{font-size:15pt;font-weight:900;color:#0A2D63;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px}
.cover-doc-sub{font-size:8pt;color:#475569;line-height:1.5}
.cover-hero-right{width:155px;flex-shrink:0;background:#0A2D63;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px 12px;gap:6px}
.cover-br-label{font-size:7pt;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.5)}
.cover-br-num{font-family:monospace;font-size:20pt;font-weight:900;color:#F7C92E;letter-spacing:.04em;line-height:1}
.cover-status-chip{display:inline-flex;align-items:center;gap:5px;background:rgba(5,150,105,.25);border:1.5px solid rgba(167,243,208,.5);color:#6EE7B7;border-radius:20px;padding:3px 10px;font-size:7pt;font-weight:800;letter-spacing:.05em}
.cover-status-chip.pend{background:rgba(245,158,11,.15);border-color:rgba(245,158,11,.3);color:#FCD34D}
.section-lbl{font-size:7pt;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#0A2D63;border-bottom:2.5px solid #0A2D63;padding-bottom:3px;margin-bottom:5px}
.info-blk{margin-bottom:5mm}
.lote-grid{display:grid;grid-template-columns:repeat(3,1fr);border:1.5px solid #CBD5E1;border-radius:6px;overflow:hidden}
.lote-cell{padding:7px 12px;border-right:1px solid #E2E8F0;border-bottom:1px solid #E2E8F0}
.lote-cell:nth-child(3n){border-right:none}
.lote-cell:nth-last-child(-n+3){border-bottom:none}
.lc-lbl{font-size:6.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#64748B;margin-bottom:2px}
.lc-val{font-size:9.5pt;font-weight:700;color:#0A1530}
.stamp-row{margin-bottom:5mm}
.stamp{border-radius:8px;padding:12px 16px;display:flex;align-items:center;gap:14px;page-break-inside:avoid}
.stamp.approved{background:#ECFDF5;border:2px solid #059669}
.stamp.pending{background:#F8FAFC;border:2px dashed #CBD5E1}
.stamp-icon{font-size:26pt;line-height:1;flex-shrink:0;color:#059669}
.stamp-icon.pend{color:#CBD5E1;font-size:20pt}
.stamp-title{font-size:11pt;font-weight:900;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px}
.stamp.approved .stamp-title{color:#065F46}
.stamp.pending .stamp-title{color:#94A3B8;font-size:9pt}
.stamp-sub{font-size:7.5pt;color:#475569;line-height:1.4}
.stamp-date{font-size:8pt;font-weight:700;color:#1D4ED8;margin-top:4px;font-family:monospace}
.etapa-progress{display:flex;gap:0}
.ep-item{flex:1;padding:8px 10px;display:flex;align-items:center;gap:8px;border:1.5px solid #E2E8F0;border-right:none}
.ep-item:first-child{border-radius:6px 0 0 6px}
.ep-item:last-child{border-radius:0 6px 6px 0;border-right:1.5px solid #E2E8F0}
.ep-item.done{background:#ECFDF5;border-color:#A7F3D0}
.ep-item.pend{background:#F8FAFC}
.ep-num{width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:8pt;font-weight:800;flex-shrink:0}
.ep-item.done .ep-num{background:#059669;color:#fff}
.ep-item.pend .ep-num{background:#CBD5E1;color:#64748B}
.ep-body{flex:1;min-width:0}
.ep-name{font-size:7.5pt;font-weight:700;color:#1E293B;line-height:1.2}
.ep-sigs{font-size:6.5pt;color:#64748B;margin-top:1px}
.ep-check{font-size:12pt;color:#059669;font-weight:900;flex-shrink:0}
.etapa-block{margin-bottom:7mm}
.etapa-hdr{background:#0A2D63;color:#fff;padding:10px 16px;display:flex;align-items:center;gap:12px;border-radius:8px 8px 0 0}
.etapa-num{font-size:7pt;font-weight:800;text-transform:uppercase;letter-spacing:.08em;background:rgba(247,201,46,.22);border:1.5px solid rgba(247,201,46,.5);color:#F7C92E;padding:3px 10px;border-radius:20px;white-space:nowrap}
.etapa-nombre{font-size:11pt;font-weight:800;letter-spacing:.02em}
.etapa-body{border:1.5px solid #CBD5E1;border-top:none;border-radius:0 0 8px 8px;overflow:hidden}
.det-block{border-top:1.5px solid #E2E8F0}
.det-block:first-child{border-top:none}
.det-hdr{padding:9px 16px;background:#EFF6FF;border-bottom:1.5px solid #BFDBFE;display:flex;align-items:center;gap:10px}
.det-step{width:24px;height:24px;border-radius:50%;flex-shrink:0;background:#1D4ED8;color:#fff;display:flex;align-items:center;justify-content:center;font-size:8.5pt;font-weight:800}
.det-name{font-size:10pt;font-weight:700;color:#1E3A8A;flex:1}
.det-badge{font-family:monospace;font-size:7.5pt;color:#64748B;background:#fff;border:1px solid #CBD5E1;padding:2px 8px;border-radius:4px}
.det-status{display:inline-flex;align-items:center;gap:4px;font-size:7pt;font-weight:800;text-transform:uppercase;letter-spacing:.06em;padding:2px 8px;border-radius:10px}
.det-status.ok{color:#065F46;background:#ECFDF5;border:1px solid #A7F3D0}
.det-status.pend{color:#64748B;background:#F8FAFC;border:1px solid #E2E8F0}
.det-content{padding:10px 16px 8px}
.fields-tbl{width:100%;border-collapse:collapse;margin-bottom:8px;border:1px solid #E2E8F0;border-radius:6px;overflow:hidden}
.fields-tbl tr{border-bottom:1px solid #E2E8F0}
.fields-tbl tr:last-child{border-bottom:none}
.fields-tbl tr:nth-child(even) td{background:#FAFBFC}
.fl{padding:5px 10px;width:38%;font-size:7.5pt;font-weight:700;color:#475569;vertical-align:top;border-right:1px solid #E2E8F0;white-space:nowrap}
.fv{padding:5px 10px;font-size:8.5pt;font-weight:500;color:#0F172A;vertical-align:top}
.empty{color:#CBD5E1;font-style:italic}
.dg-section{margin-bottom:8px}
.dg-title{font-size:6.5pt;font-weight:800;text-transform:uppercase;letter-spacing:.09em;color:#1D4ED8;margin:8px 0 4px;display:flex;align-items:center;gap:6px}
.dg-title::before{content:'';display:block;width:3px;height:11px;background:#1D4ED8;border-radius:2px;flex-shrink:0}
.dg-wrap{border-radius:6px;overflow:hidden;border:1.5px solid #BFDBFE}
.dg-tbl{width:100%;border-collapse:collapse;font-size:8pt}
.dg-tbl thead tr{background:#0A2D63}
.dg-tbl th{padding:6px 8px;text-align:left;font-size:6.5pt;font-weight:800;color:#fff;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap}
.dg-tbl tbody tr:nth-child(odd) td{background:#fff}
.dg-tbl tbody tr:nth-child(even) td{background:#EFF6FF}
.dg-tbl td{padding:5px 8px;border-bottom:1px solid #BFDBFE;color:#0F172A;vertical-align:middle}
.dg-tbl tbody tr:last-child td{border-bottom:none}
.sig-block{background:#F1F5F9;border-top:2px solid #CBD5E1;padding:10px 16px 12px}
.sig-block-title{font-size:6.5pt;font-weight:800;text-transform:uppercase;letter-spacing:.09em;color:#64748B;margin-bottom:8px}
.sig-cards{display:flex;gap:8px;flex-wrap:wrap}
.sig-card{flex:1;min-width:160px;border-radius:8px;overflow:hidden;border:1.5px solid}
.sig-card.signed{border-color:#A7F3D0;background:#fff}
.sig-card.pending{border-color:#E2E8F0;background:#F8FAFC}
.sig-card-top{padding:5px 10px;display:flex;align-items:center;justify-content:space-between;gap:6px}
.sig-card.signed .sig-card-top{background:#ECFDF5}
.sig-card.pending .sig-card-top{background:#F8FAFC}
.sig-status{font-size:7pt;font-weight:800;text-transform:uppercase;letter-spacing:.06em}
.sig-card.signed .sig-status{color:#059669}
.sig-card.pending .sig-status{color:#CBD5E1}
.sig-icon{font-size:13pt;line-height:1}
.sig-card.signed .sig-icon{color:#059669}
.sig-card.pending .sig-icon{color:#CBD5E1;font-size:10pt}
.sig-card-body{padding:8px 10px}
.sig-role{font-size:7pt;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px;line-height:1.3}
.sig-name{font-size:9pt;font-weight:800;color:#0A1530;margin-bottom:1px}
.sig-cargo{font-size:7.5pt;color:#64748B;margin-bottom:5px}
.sig-datetime{font-family:monospace;font-size:8pt;color:#1D4ED8;font-weight:700}
.sig-card.pending .sig-name,.sig-card.pending .sig-cargo,.sig-card.pending .sig-role,.sig-card.pending .sig-datetime{color:#CBD5E1}
.desv-section{margin-bottom:7mm}
.desv-empty{padding:10px 14px;color:#94A3B8;font-style:italic;font-size:8pt;border:1px dashed #E2E8F0;border-radius:6px;text-align:center}
.desv-card{border:1.5px solid #FCD34D;border-radius:8px;overflow:hidden;margin-bottom:6px;page-break-inside:avoid}
.desv-hdr{background:#FFFBEB;padding:7px 12px;display:flex;align-items:center;gap:8px;border-bottom:1px solid #FEF08A}
.desv-badge{font-size:6.5pt;font-weight:800;text-transform:uppercase;letter-spacing:.06em;padding:2px 8px;border-radius:10px}
.desv-badge.abierta{background:#FEF3C7;color:#D97706;border:1px solid #FCD34D}
.desv-badge.cerrada{background:#D1FAE5;color:#065F46;border:1px solid #A7F3D0}
.desv-campo{font-size:8.5pt;font-weight:700;color:#92400E;flex:1}
.desv-code{font-family:monospace;font-size:8pt;color:#64748B;background:#fff;border:1px solid #E2E8F0;padding:2px 7px;border-radius:4px}
.desv-body{padding:8px 12px;display:flex;flex-direction:column;gap:4px}
.desv-valor{font-size:8pt;color:#78350F}
.desv-desc{font-size:8.5pt;color:#1E293B;line-height:1.4}
.desv-meta{font-size:7.5pt;color:#475569}
.desv-cierre{margin-top:4px;padding:5px 8px;background:#F0FDF4;border-radius:5px;border:1px solid #BBF7D0}
.desv-cierre-title{font-size:6.5pt;font-weight:800;color:#15803D;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px}
.desv-cierre-text{font-size:8pt;color:#166534}
.pg-footer{margin-top:8mm;padding-top:6px;border-top:1px solid #E2E8F0;display:flex;justify-content:space-between;align-items:center;font-size:7pt;color:#94A3B8;page-break-inside:avoid}
.ctrl-badge{font-size:6.5pt;font-weight:800;color:#DC2626;letter-spacing:.06em;text-transform:uppercase;border:1px solid #FCA5A5;padding:2px 7px;border-radius:3px}
.print-btn{display:block;width:fit-content;margin:14px auto 0;background:#0A2D63;color:#fff;border:none;border-radius:9px;padding:10px 26px;font-size:10.5pt;font-weight:700;cursor:pointer;text-decoration:none;font-family:inherit;letter-spacing:.02em}
</style>
</head><body>

<div class="run-hdr">
  <div class="rh-logo">BAC<em>ord</em></div>
  <div class="rh-sep"></div>
  <div class="rh-prod">${esc(producto)} · Lote ${esc(preLlenado?.loteLogistico ?? '—')}</div>
  <div class="rh-br">${brCode}</div>
  <div class="rh-ctrl">Documento Controlado</div>
</div>

<div class="cover">
  <div class="cover-hero">
    <div class="cover-hero-left">
      <div class="cover-brand-row">
        <div class="cover-logo">BAC<em>ord</em></div>
        <div class="cover-tagline">Sistema de Gestión<br>de Batch Records</div>
      </div>
      <div class="cover-doc-title">Registro de Fabricación</div>
      <div class="cover-doc-sub">
        Impreso: ${printDate} &nbsp;·&nbsp; ${printTime} &nbsp;·&nbsp; ${esc(userName)}
      </div>
    </div>
    <div class="cover-hero-right">
      <div class="cover-br-label">Batch Record</div>
      <div class="cover-br-num">${brCode}</div>
      <div class="cover-status-chip${brFinalizado ? '' : ' pend'}">${brFinalizado ? '✓ Aprobado' : '⏳ En Proceso'}</div>
    </div>
  </div>

  <div class="info-blk">
    <div class="section-lbl">Información del Lote</div>
    <div class="lote-grid">${loteGridHTML}</div>
  </div>

  <div class="stamp-row">${stampHTML}</div>

  <div class="info-blk">
    <div class="section-lbl">Progreso de Etapas</div>
    <div class="etapa-progress">${etapaProgressHTML}</div>
  </div>
</div>

${procsSections}

<div class="desv-section page-break">
  <div class="section-lbl">Desviaciones y No Conformidades</div>
  ${desvHTML}
</div>

<div class="pg-footer">
  <span class="ctrl-badge">Documento Controlado</span>
  <span>${brCode} · ${esc(preLlenado?.loteLogistico ?? '—')} · Impreso: ${printDate} ${printTime}</span>
  <span>BACord v1.0</span>
</div>

<button class="print-btn no-print" onclick="window.print()">🖨&nbsp; Imprimir / Guardar PDF</button>

</body></html>`)
    win.document.close()
  }

  if (loading || !br) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
        <i className="fa fa-spinner fa-spin" style={{ fontSize: 20, color: 'var(--ink-4)' }} />
      </div>
    )
  }

  return (
    <>
      <style>{`
        /* ── Batch Record page redesign ── */
        .br-card { background:#fff;border-radius:16px;border:1px solid rgba(10,21,48,0.08);
          overflow:hidden;margin-bottom:14px;box-shadow:0 2px 8px rgba(10,21,48,0.06); }
        .br-identity { background:linear-gradient(135deg,#0A2D63 0%,#0D3575 100%);
          padding:14px 20px;display:flex;align-items:center;gap:12px; }
        .br-doc-badge { width:38px;height:38px;border-radius:10px;flex-shrink:0;
          background:rgba(247,201,46,0.15);border:1.5px solid rgba(247,201,46,0.3);
          display:grid;place-items:center;font-size:11px;font-weight:800;color:#F7C92E;
          font-family:var(--f-mono);letter-spacing:0.05em; }
        .br-product-name { font-size:15px;font-weight:700;color:#fff;
          overflow:hidden;text-overflow:ellipsis; }
        .br-doc-ref { font-size:11px;color:rgba(255,255,255,0.65);
          font-family:var(--f-mono);margin-top:3px;display:flex;align-items:center;gap:8px;flex-wrap:wrap; }
        .br-identity-actions { display:flex;gap:8px;flex-shrink:0;margin-left:auto; }
        .br-btn-ghost { background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.18);
          color:#fff;border-radius:8px;padding:6px 14px;font-size:12px;font-weight:600;
          cursor:pointer;transition:background 120ms;display:inline-flex;align-items:center;
          gap:6px;font-family:var(--f-sans); }
        .br-btn-ghost:hover { background:rgba(255,255,255,0.2); }
        .br-btn-ghost:focus-visible { outline:2px solid rgba(247,201,46,0.9);outline-offset:1px; }
        .br-btn-ghost.br-btn-active { background:rgba(247,201,46,0.22);
          border-color:rgba(247,201,46,0.45);color:#F7C92E; }
        .br-meta-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));
          border-bottom:1px solid rgba(10,21,48,0.07); }
        .br-meta-item { padding:10px 18px;border-right:1px solid rgba(10,21,48,0.06);
          border-bottom:1px solid rgba(10,21,48,0.04); }
        .br-meta-lbl { font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase;
          letter-spacing:0.07em;margin-bottom:3px;font-family:var(--f-mono); }
        .br-meta-val { font-size:13px;font-weight:600;color:#0A1530; }
        .br-progress-bar { padding:8px 20px;display:flex;align-items:center;gap:12px;
          border-bottom:1px solid rgba(10,21,48,0.07);background:#fff; }
        .br-stages { display:flex;align-items:stretch;background:#F8F7F2;
          border-bottom:1px solid rgba(10,21,48,0.08);overflow-x:auto; }
        .br-stage-nav { padding:0 12px;background:none;border:none;cursor:pointer;
          color:rgba(10,21,48,0.45);flex-shrink:0;transition:color 120ms;
          display:flex;align-items:center; }
        .br-stage-nav:hover { color:#0A2D63; }
        .br-stage-nav:disabled { opacity:0.25;cursor:not-allowed; }
        .br-stage-nav:focus-visible { outline:2px solid var(--navy);outline-offset:1px; }
        .br-stage { flex:1;min-width:170px;padding:11px 18px;background:none;border:none;cursor:pointer;
          display:flex;align-items:center;gap:10px;border-right:1px solid rgba(10,21,48,0.07);
          border-bottom:3px solid transparent;transition:background 100ms,border-color 100ms;text-align:left;
          font-family:var(--f-sans); }
        .br-stage:last-of-type { border-right:none; }
        .br-stage:hover:not([aria-selected="true"]) { background:rgba(10,21,48,0.03); }
        .br-stage[aria-selected="true"] { background:#fff;border-bottom-color:#0A2D63; }
        .br-stage:focus-visible { outline:2px solid var(--navy);outline-offset:-2px; }
        .br-stage-num { width:26px;height:26px;border-radius:50%;background:rgba(10,21,48,0.09);
          color:#64748B;display:grid;place-items:center;font-size:11px;font-weight:800;
          font-family:var(--f-mono);flex-shrink:0;transition:background 150ms,color 150ms; }
        .br-stage[aria-selected="true"] .br-stage-num { background:#0A2D63;color:#fff; }
        .br-stage.done .br-stage-num { background:#2D5D4A;color:#fff; }
        .br-stage-lbl { font-size:12.5px;font-weight:500;color:#5B6478;line-height:1.3; }
        .br-stage[aria-selected="true"] .br-stage-lbl { color:#0A1530;font-weight:700; }
        .br-stage.done .br-stage-lbl { color:#2D5D4A;font-weight:600; }
        .br-layout { display:flex;gap:14px;align-items:flex-start;padding:16px;
          background:#F4F3EE; }
        .br-forms { flex:1;min-width:0; }
        .det-card { background:#fff;border-radius:10px;margin-bottom:10px;overflow:hidden;
          border:1px solid rgba(10,21,48,0.09);border-left-width:4px;
          box-shadow:0 1px 3px rgba(10,21,48,0.05);transition:box-shadow 150ms; }
        .det-card.det-open { box-shadow:0 4px 16px rgba(10,21,48,0.09); }
        .det-header { display:flex;align-items:center;gap:12px;padding:13px 16px;
          cursor:pointer;transition:background 100ms;user-select:none;border-radius:0; }
        .det-header:hover { background:rgba(10,21,48,0.03); }
        .det-header:focus-visible { outline:2px solid var(--navy);outline-offset:-2px; }
        .firma-block { background:#F8F7F2;border-top:1.5px solid rgba(10,21,48,0.08); }
        .firma-block-hdr { padding:10px 18px;display:flex;align-items:center;gap:8px;
          border-bottom:1px solid rgba(10,21,48,0.07); }
        .proc-closed { display:flex;align-items:center;gap:8px;padding:10px 14px;
          background:rgba(45,93,74,0.06);border:1.5px solid rgba(45,93,74,0.2);
          border-radius:10px;margin-bottom:12px;font-size:12.5px;color:#2D5D4A; }
        .br-footer { display:flex;align-items:center;justify-content:flex-end;gap:10px;
          padding:12px 20px;background:#fff;border-top:1px solid rgba(10,21,48,0.07); }
        .audit-panel { width:280px;flex-shrink:0;background:#fff;border-radius:12px;
          border:1px solid rgba(10,21,48,0.09);overflow:hidden;position:sticky;top:16px;
          box-shadow:0 1px 4px rgba(10,21,48,0.06); }
        @media (prefers-reduced-motion: reduce) {
          .br-btn-ghost,.br-stage,.br-stage-num,.br-stage-nav,.det-header,.det-card { transition:none !important; }
        }
      `}</style>

      <div className="br-card">
        {/* ── Identity strip ── */}
        <div className="br-identity">
          <div className="br-doc-badge">BR</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="br-product-name">
              {preLlenado?.descripcionMaterial ?? <span style={{ opacity: 0.5, fontWeight: 400 }}>Sin datos</span>}
            </div>
            <div className="br-doc-ref">
              <span>BR-{id}</span>
              <span style={{ opacity: 0.4 }}>·</span>
              <a href={`/ordenes-proceso/${br.idOrdenProceso}`}
                style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'none', fontWeight: 600 }}
                onMouseOver={e => (e.currentTarget.style.color = '#F7C92E')}
                onMouseOut={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.55)')}>
                {preLlenado?.numeroOrdenProceso ?? `OP-${br.idOrdenProceso}`}
              </a>
              <span style={{ opacity: 0.4 }}>·</span>
              <a href={`/formulas-control/${br.idFormulaControl}`}
                style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'none', fontWeight: 600 }}
                onMouseOver={e => (e.currentTarget.style.color = '#F7C92E')}
                onMouseOut={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.55)')}>
                FC-{br.idFormulaControl}
              </a>
            </div>
          </div>
          <div className="br-identity-actions">
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, flexShrink: 0,
              background: estadoBadge.bg, color: estadoBadge.color, letterSpacing: '.03em',
            }}>
              {estadoBadge.label}
            </span>
            {!readonly && (
              <button
                className={`br-btn-ghost${showAudit ? ' br-btn-active' : ''}`}
                aria-pressed={showAudit}
                aria-label={showAudit ? 'Ocultar historial de auditoría' : 'Mostrar historial de auditoría'}
                onClick={() => setShowAudit(s => !s)}
              >
                <i className="fa fa-history" aria-hidden="true" /> Historial
              </button>
            )}
            <button
              className="br-btn-ghost"
              aria-label="Volver al listado de Batch Records"
              onClick={() => navigate('/batch-records')}
            >
              <i className="fa fa-chevron-left" aria-hidden="true" /> Volver
            </button>
          </div>
        </div>

        {/* ── Metadata grid ── */}
        <div className="br-meta-grid">
          {buildCabeceraItems(preLlenado, receta).map((item, i) => (
            <div key={i} className="br-meta-item">
              <div className="br-meta-lbl">{item.label}</div>
              <div className="br-meta-val">{item.value}</div>
            </div>
          ))}
        </div>

        {/* ── Overall progress ── */}
        <div className="br-progress-bar">
          <div
            style={{ flex: 1, height: 6, background: 'rgba(10,21,48,0.07)', borderRadius: 3, overflow: 'hidden' }}
            role="progressbar"
            aria-valuenow={overallPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progreso total del batch record: ${overallPct}%`}
          >
            <div style={{
              height: '100%', width: `${overallPct}%`, borderRadius: 3,
              background: overallPct === 100
                ? 'linear-gradient(90deg,#059669,#34D399)'
                : overallPct >= 50
                  ? 'linear-gradient(90deg,#1D4ED8,#60A5FA)'
                  : 'linear-gradient(90deg,#D97706,#FCD34D)',
              transition: 'width 400ms',
            }} />
          </div>
          <span style={{ fontSize: 11.5, fontFamily: 'var(--f-mono)', fontWeight: 700, flexShrink: 0,
            color: overallPct === 100 ? '#059669' : overallPct >= 50 ? '#1D4ED8' : '#D97706' }}>
            {overallPct}%
          </span>
          <span style={{ fontSize: 11, color: '#94A3B8', flexShrink: 0 }}>
            {doneFirmasCierre}/{totalFirmasCierre} firmas de cierre
          </span>
        </div>

        {/* ── Stage tabs ── */}
        <div className="br-stages" role="tablist" aria-label="Etapas del proceso">
          {estructura.length > 1 && (
            <button
              className="br-stage-nav"
              aria-label="Etapa anterior"
              disabled={procesoIdx <= 0}
              onClick={() => { if (procesoIdx > 0) setProcesoActivo(estructura[procesoIdx - 1].id) }}
            >
              <ChevronLeft size={15} aria-hidden="true" />
            </button>
          )}
          {estructura.map((p, idx) => {
            const isDone     = procesosCerrados.has(p.id)
            const isUnlocked = idx === 0 || procesosCerrados.has(estructura[idx - 1].id)
            const isActive   = procesoActivo === p.id
            return (
              <button key={p.id}
                role="tab"
                aria-selected={isActive}
                aria-controls={`tabpanel-${p.id}`}
                id={`tab-${p.id}`}
                className={`br-stage${isDone ? ' done' : ''}`}
                title={!isUnlocked ? `Complete y cierre la etapa anterior primero` : undefined}
                aria-disabled={!isUnlocked}
                style={{ cursor: isUnlocked ? 'pointer' : 'not-allowed', opacity: isUnlocked ? 1 : 0.45 }}
                onClick={() => { if (isUnlocked) setProcesoActivo(p.id) }}
              >
                <div className="br-stage-num" aria-hidden="true">
                  {isDone
                    ? <i className="fa fa-check" style={{ fontSize: 9 }} />
                    : !isUnlocked
                      ? <i className="fa fa-lock" style={{ fontSize: 8 }} />
                      : idx + 1}
                </div>
                <span className="br-stage-lbl">{p.descripcion}</span>
                {isDone && (
                  <span style={{ fontSize: 10, fontFamily: 'var(--f-mono)', fontWeight: 700,
                    color: '#2D5D4A', background: 'rgba(45,93,74,0.1)',
                    padding: '1px 7px', borderRadius: 10, marginLeft: 'auto', flexShrink: 0 }}>
                    ✓
                  </span>
                )}
              </button>
            )
          })}
          {estructura.length > 1 && (
            <button
              className="br-stage-nav"
              aria-label="Etapa siguiente"
              disabled={procesoIdx === estructura.length - 1}
              onClick={() => { if (procesoIdx < estructura.length - 1) setProcesoActivo(estructura[procesoIdx + 1].id) }}
            >
              <ChevronRight size={15} aria-hidden="true" />
            </button>
          )}
        </div>

        {/* ── Content ── */}
        <div className="br-layout">
          <div
            className="br-forms"
            role="tabpanel"
            id={`tabpanel-${procesoActivo}`}
            aria-labelledby={`tab-${procesoActivo}`}
          >
            {procesoActivo != null && procesosCerrados.has(procesoActivo) && (
              <div className="proc-closed">
                <i className="fa fa-check-circle" style={{ fontSize: 15 }} />
                <strong>Proceso cerrado</strong> — todos los formularios y firmas completados. Solo lectura.
              </div>
            )}
            {detallesProceso.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#94A3B8', fontSize: 13, padding: '32px 0' }}>
                Sin instrucciones para este proceso.
              </p>
            ) : (
              detallesProceso.map(det => {
                const opMappings = preLlenado ? extractOpMappings(det.jsonSchema ?? '', preLlenado as unknown as Record<string, unknown>) : {}
                const detConMateriales = materiales.length
                  ? { ...det, jsonSchema: injectMaterialOptions(det.jsonSchema ?? '', materiales) }
                  : det
                return (
                  <DetalleCard
                    key={det.id}
                    detalle={detConMateriales}
                    firmados={firmados}
                    desviaciones={desviaciones}
                    readonly={(procesoActivo != null && procesosCerrados.has(procesoActivo)) || soloLectura}
                    onFirmar={firma => { if (!soloLectura) setFirmaTarget({ detalle: det, firma }) }}
                    initialValues={{ ...opMappings, ...(detalleDatos[det.id] ?? {}) }}
                    lockedKeys={Object.keys(opMappings)}
                    preLlenado={preLlenado}
                    onFormData={handleFormData}
                    onDesviacion={handleDesviacion}
                    onRequestDerogar={(fk, detalleId, fi, tx, gr) =>
                      setDerogTarget({ firmaKey: fk, detalleId, firmaInfo: fi, texto: tx, grupo: gr })
                    }
                  />
                )
              })
            )}
          </div>
          {!readonly && showAudit && (
            <AuditPreviewPanel brId={id ?? 0} refreshKey={auditVersion} />
          )}
        </div>

        {/* ── Audit trail expandido (solo modo Consultar) ── */}
        {readonly && <AuditExpandedPanel brId={id ?? 0} refreshKey={auditVersion} />}

        {/* ── BR finalizado banner ── */}
        {brFinalizado && (
          <div style={{
            margin: '0 0 12px', padding: '14px 20px',
            background: 'linear-gradient(135deg,#D1FAE5 0%,#A7F3D0 100%)',
            border: '1.5px solid #6EE7B7', borderRadius: 12,
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: 12, background: '#2D5D4A',
              display: 'grid', placeItems: 'center', flexShrink: 0,
            }}>
              <i className="fa fa-check" style={{ color: '#fff', fontSize: 16 }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: '#065F46', letterSpacing: '.01em' }}>
                Batch Record Finalizado
              </div>
              <div style={{ fontSize: 11.5, color: '#047857', marginTop: 2 }}>
                Todas las etapas completadas y firmadas. El documento está listo para imprimir.
              </div>
            </div>
            <button onClick={handlePrint}
              style={{
                background: '#065F46', color: '#fff', border: 'none', borderRadius: 10,
                padding: '10px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
                fontFamily: 'var(--f-sans)', letterSpacing: '.01em',
              }}>
              <i className="fa fa-print" /> Imprimir BR
            </button>
          </div>
        )}

        {/* ── Liberar Lote panel ── */}
        {brFinalizado && !soloLectura && (
          <div style={{ margin: '0 0 0', padding: '18px 20px', borderTop: '2px solid #DDD6FE', background: liberacion ? 'linear-gradient(135deg,#F5F3FF 0%,#EDE9FE 100%)' : '#FAFAF9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: liberacion ? '#7C3AED' : '#EDE9FE', display: 'grid', placeItems: 'center' }}>
                <i className="fa fa-certificate" style={{ color: liberacion ? '#fff' : '#7C3AED', fontSize: 16 }} />
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: liberacion ? '#5B21B6' : '#374151', letterSpacing: '.01em' }}>
                  {liberacion ? 'Lote Liberado por Control de Calidad' : 'Liberación de Lote — Aprobación Final'}
                </div>
                <div style={{ fontSize: 11.5, color: liberacion ? '#7C3AED' : '#94A3B8', marginTop: 2 }}>
                  {liberacion
                    ? `${liberacion.nombre} · ${liberacion.fecha} ${liberacion.hora}`
                    : 'Requiere re-autenticación del responsable para autorizar la distribución del lote.'}
                </div>
              </div>
              {liberacion ? (
                <span style={{ padding: '5px 16px', background: '#7C3AED', color: '#fff', borderRadius: 20, fontSize: 11, fontWeight: 800, letterSpacing: '.06em' }}>
                  ✓ LIBERADO
                </span>
              ) : (
                <button
                  className="btn"
                  style={{ background: '#7C3AED', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 20px', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0, fontFamily: 'var(--f-sans)' }}
                  onClick={() => setLiberarModal(true)}>
                  <i className="fa fa-certificate" /> Liberar Lote
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Footer actions ── */}
        <div className="br-footer">
          <span style={{ fontSize: 12, color: '#94A3B8', marginRight: 'auto', fontFamily: 'var(--f-mono)' }}>
            BR-{id} · {procesoInfo?.descripcion}
          </span>
          {procesoActivo != null && !allDetallesCurrentDone && !procesosCerrados.has(procesoActivo) && !soloLectura && (
            <span id="cerrar-hint" style={{ fontSize: 11.5, color: '#D97706', display: 'flex', alignItems: 'center', gap: 5 }}>
              <i className="fa fa-exclamation-triangle" style={{ fontSize: 10 }} aria-hidden="true" />
              Complete las firmas de todos los formularios para cerrar la etapa
            </span>
          )}
          {!soloLectura && procesoActivo != null && !procesosCerrados.has(procesoActivo) && (
            <button
              className="btn btn-warning"
              style={{ fontSize: 12 }}
              aria-describedby={!allDetallesCurrentDone ? 'cerrar-hint' : undefined}
              aria-disabled={!allDetallesCurrentDone}
              onClick={handleCerrarProceso}
              disabled={!allDetallesCurrentDone}
            >
              <i className="fa fa-lock" aria-hidden="true" /> Cerrar Proceso
            </button>
          )}
          {!soloLectura && brFinalizado && estructura.every(p => procesosCerrados.has(p.id)) && (
            <button className="btn btn-danger" style={{ fontSize: 12 }} onClick={handleCerrarBatch}>
              <i className="fa fa-times-circle" /> Cerrar Batch
            </button>
          )}
          {brFinalizado && (
            <button onClick={handlePrint} className="btn btn-gray" style={{ fontSize: 12 }}>
              <i className="fa fa-file-pdf" /> {readonly ? 'Paquete de Auditoría' : 'Imprimir'}
            </button>
          )}
        </div>
      </div>

      {firmaTarget && (
        <FirmaModal
          titulo="Firma Electrónica"
          subtitulo="Ingrese su usuario y PIN de firma"
          texto={firmaTarget.firma.texto}
          grupo={firmaTarget.firma.firma.grupo.nombre}
          onSubmit={async (login, pin) => {
            const res = await batchRecordApi.firmar(idNum, firmaTarget.detalle.id, firmaTarget.firma.idFirma, login, pin)
            if (res.estado) {
              await cargarTodo()
              setFirmaTarget(null)
            }
            return res
          }}
          onClose={() => setFirmaTarget(null)}
        />
      )}

      {liberarModal && !liberacion && (
        <FirmaModal
          titulo="Liberación de Lote"
          subtitulo="Ingrese su usuario y PIN de firma para autorizar"
          texto="Liberación oficial del lote para distribución"
          showObservacion
          onSubmit={async (login, pin, observacion) => {
            const res = await batchRecordApi.liberar(idNum, login, pin, observacion)
            if (res.estado) {
              await cargarTodo()
              setLiberarModal(false)
            }
            return res
          }}
          onClose={() => setLiberarModal(false)}
        />
      )}

      {derogTarget && (
        <DerogacionModal
          firmaInfo={derogTarget.firmaInfo}
          texto={derogTarget.texto}
          grupo={derogTarget.grupo}
          onConfirm={handleDerogar}
          onClose={() => setDerogTarget(null)}
        />
      )}
    </>
  )
}

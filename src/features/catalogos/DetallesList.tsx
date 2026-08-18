import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Panel } from '@/components/shared/Panel'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { mockEstrategiasFirma, mockUsuarios } from '@/api/mock'
import { getDetalles, setDetalles, bumpDetId, resetDetalles } from '@/stores/detallesStore'

// ─── Types ───────────────────────────────────────────────────────────────────

type CompType =
  | 'textfield' | 'textarea'  | 'number'  | 'currency'
  | 'checkbox'  | 'radio'     | 'select'
  | 'datetime'  | 'day'       | 'time'
  | 'survey'    | 'datagrid'  | 'button'
  | 'panel'     | 'columns'   | 'content'
  | 'heading'   | 'image'     | 'divider'
  | 'password'  | 'hidden'
  | 'firma-seccion'

interface FormComp {
  id: string; type: CompType; key: string; label: string
  placeholder?: string; description?: string
  required?: boolean; multiple?: boolean
  values?: { label: string; value: string }[]
  // survey-specific: rows = preguntas, surveyColumns = opciones de respuesta
  surveyRows?: { label: string; value: string }[]
  surveyColumns?: { label: string; value: string }[]
  // radio layout
  inline?: boolean
  action?: 'submit' | 'reset' | 'custom'
  theme?: string; title?: string; collapsible?: boolean
  html?: string; rows?: number
  headingLevel?: 'h1' | 'h2' | 'h3' | 'h4'
  textAlign?: 'left' | 'center' | 'right'
  imageUrl?: string; imageAlt?: string; imageWidth?: string
  minVal?: number; maxVal?: number
  custom?: string
  hideLabel?: boolean
  calculateValue?: string
  components?: FormComp[]
  columnCount?: number
  _colIdx?: number
  _raw?: Record<string, unknown>
  idEstrategiaFirma?: number
  opMapping?: string  // key of OrdenProceso / PreLlenadoBR field to auto-fill from
}

// Available OP fields the editor can map to
export const OP_MAPPING_OPTIONS: { value: string; label: string }[] = [
  { value: 'descripcionMaterial', label: 'Producto / Descripción Material' },
  { value: 'codigoMaterial',      label: 'Código Material' },
  { value: 'numeroOrdenProceso',  label: 'N° Orden de Proceso' },
  { value: 'loteLogistico',       label: 'Lote Logístico' },
  { value: 'loteInspeccion',      label: 'Lote de Inspección' },
  { value: 'cantidadOrden',       label: 'Cantidad de la Orden' },
  { value: 'unidadMedida',        label: 'Unidad de Medida' },
  { value: 'fechaFabricacion',    label: 'Fecha de Fabricación' },
  { value: 'fechaCaducidad',      label: 'Fecha de Caducidad' },
  { value: 'registroSanitario',   label: 'Registro Sanitario' },
  { value: 'formaFarmaceutica',   label: 'Forma Farmacéutica' },
  { value: 'centro',              label: 'Centro de Producción' },
]

interface Detalle {
  id: number; codigo: string; descripcion: string
  estado: 'Activo' | 'Inactivo'
  idEstrategiaFirma?: number
  jsonSchema: string; jsonData: string; jsonOptions: string
}

// ─── Palette ──────────────────────────────────────────────────────────────────

const PAL: { type: CompType; label: string; icon: string; color: string; bg: string; cat: string }[] = [
  { type: 'textfield', label: 'Texto',        icon: 'fa-font',          color: '#2563EB', bg: '#EFF6FF', cat: 'Campos' },
  { type: 'textarea',  label: 'Párrafo',      icon: 'fa-align-left',    color: '#0284C7', bg: '#F0F9FF', cat: 'Campos' },
  { type: 'number',    label: 'Número',       icon: 'fa-hashtag',       color: '#7C3AED', bg: '#F5F3FF', cat: 'Campos' },
  { type: 'currency',  label: 'Moneda',       icon: 'fa-dollar-sign',   color: '#059669', bg: '#ECFDF5', cat: 'Campos' },
  { type: 'checkbox',  label: 'Casilla',      icon: 'fa-check-square',  color: '#16A34A', bg: '#F0FDF4', cat: 'Campos' },
  { type: 'radio',     label: 'Opción única', icon: 'fa-dot-circle',    color: '#D97706', bg: '#FFFBEB', cat: 'Campos' },
  { type: 'select',    label: 'Selector',     icon: 'fa-list-alt',      color: '#DC2626', bg: '#FEF2F2', cat: 'Campos' },
  { type: 'datetime',  label: 'Fecha/Hora',   icon: 'fa-calendar-alt',  color: '#DB2777', bg: '#FDF4FF', cat: 'Campos' },
  { type: 'day',       label: 'Día',          icon: 'fa-calendar',      color: '#EA580C', bg: '#FFF7ED', cat: 'Campos' },
  { type: 'time',      label: 'Tiempo',       icon: 'fa-clock',         color: '#4F46E5', bg: '#EEF2FF', cat: 'Campos' },
  { type: 'survey',    label: 'Encuesta',     icon: 'fa-poll',          color: '#0891B2', bg: '#ECFEFF', cat: 'Campos' },
  { type: 'datagrid',  label: 'Grilla',       icon: 'fa-table',         color: '#0A2D63', bg: '#EFF6FF', cat: 'Campos' },
  { type: 'button',    label: 'Botón',        icon: 'fa-hand-pointer',  color: '#475569', bg: '#F8FAFC', cat: 'Campos' },
  { type: 'password',  label: 'Contraseña',   icon: 'fa-lock',          color: '#9333EA', bg: '#FAF5FF', cat: 'Campos' },
  { type: 'hidden',    label: 'Oculto',       icon: 'fa-eye-slash',     color: '#94A3B8', bg: '#F8FAFC', cat: 'Campos' },
  { type: 'panel',     label: 'Panel',        icon: 'fa-square',        color: '#64748B', bg: '#F1F5F9', cat: 'Diseño' },
  { type: 'columns',   label: 'Columnas',     icon: 'fa-columns',       color: '#64748B', bg: '#F1F5F9', cat: 'Diseño' },
  { type: 'heading',   label: 'Encabezado',   icon: 'fa-heading',       color: '#0F172A', bg: '#F1F5F9', cat: 'Diseño' },
  { type: 'content',   label: 'HTML',         icon: 'fa-code',          color: '#0891B2', bg: '#ECFEFF', cat: 'Diseño' },
  { type: 'image',     label: 'Imagen',       icon: 'fa-image',         color: '#8B5CF6', bg: '#F5F3FF', cat: 'Diseño' },
  { type: 'divider',      label: 'Separador',    icon: 'fa-minus',       color: '#94A3B8', bg: '#F8FAFC', cat: 'Diseño' },
  { type: 'firma-seccion', label: 'Firma sección', icon: 'fa-pen-square', color: '#7C3AED', bg: '#F5F3FF', cat: 'Firmas' },
]
const PAL_MAP = Object.fromEntries(PAL.map(p => [p.type, p]))
const PAL_KNOWN_TYPES = new Set(PAL.map(p => p.type))
const LAYOUT_TYPES = ['panel','columns','content','heading','image','divider','hidden','firma-seccion']
const CONTAINER_TYPES: CompType[] = ['panel','datagrid','columns']

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _uid = 0
const uid = () => `fc-${Date.now()}-${++_uid}`

// Contextual firmados state injected during toFormio calls for preview rendering
let _previewFirmados: Record<string, boolean> = {}

// Returns the set of component IDs that should be disabled because they precede a signed firma-seccion
// in a flat sibling list. Works at any nesting level.
function computeDisabledIds(cs: FormComp[], firmados: Record<string, boolean>): Set<string> {
  const disabled = new Set<string>()
  let pending: string[] = []
  for (const c of cs) {
    if (c.type === 'firma-seccion') {
      const ef = c.idEstrategiaFirma ? mockEstrategiasFirma.find(e => e.id === c.idEstrategiaFirma) : null
      const firmas = ef ? ef.firmas.filter(f => f.activo) : []
      const isSigned = firmas.some(f => firmados[`${c.key}__${f.idFirma}`])
      if (isSigned) pending.forEach(id => disabled.add(id))
      pending = []
    } else {
      pending.push(c.id)
    }
  }
  return disabled
}

// Serializes a flat component array applying lineal locking: components before a signed firma-seccion
// get disabled:true in the output JSON, preventing further edits to that section.
function applyLinealLocking(cs: FormComp[]): Record<string, unknown>[] {
  const disabledIds = computeDisabledIds(cs, _previewFirmados)
  return cs.map(c => {
    const b = compToJson(c)
    if (disabledIds.has(c.id)) b.disabled = true
    return b
  })
}
const toKey = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
   .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'campo'

function normalizeType(t: string): CompType {
  const aliases: Record<string, CompType> = {
    htmlelement: 'content',
    html: 'content',
    signature: 'textfield',
    address: 'textfield',
    phoneNumber: 'textfield',
    email: 'textfield',
    tags: 'textfield',
    file: 'textfield',
  }
  if (aliases[t]) return aliases[t]
  if (PAL_KNOWN_TYPES.has(t as CompType)) return t as CompType
  return 'textfield'
}

// ─── Tree helpers ─────────────────────────────────────────────────────────────

function findComp(comps: FormComp[], id: string): FormComp | undefined {
  for (const c of comps) {
    if (c.id === id) return c
    if (c.components) { const f = findComp(c.components, id); if (f) return f }
  }
  return undefined
}

function updateTree(comps: FormComp[], id: string, patch: Partial<FormComp>): FormComp[] {
  return comps.map(c => {
    if (c.id === id) return { ...c, ...patch }
    if (c.components) return { ...c, components: updateTree(c.components, id, patch) }
    return c
  })
}

function removeFromTree(comps: FormComp[], id: string): FormComp[] {
  return comps.filter(c => c.id !== id).map(c =>
    c.components ? { ...c, components: removeFromTree(c.components, id) } : c
  )
}

function addToParent(comps: FormComp[], parentId: string, child: FormComp): FormComp[] {
  return comps.map(c => {
    if (c.id === parentId) return { ...c, components: [...(c.components ?? []), child] }
    if (c.components) return { ...c, components: addToParent(c.components, parentId, child) }
    return c
  })
}

function removeFromParent(comps: FormComp[], parentId: string, childId: string): FormComp[] {
  return comps.map(c => {
    if (c.id === parentId) return { ...c, components: (c.components ?? []).filter(ch => ch.id !== childId) }
    if (c.components) return { ...c, components: removeFromParent(c.components, parentId, childId) }
    return c
  })
}

// ─── Serialization ────────────────────────────────────────────────────────────

function compToJson(c: FormComp): Record<string, unknown> {
  // Start from _raw to preserve logic, calculateValue, conditions, etc.
  const b: Record<string, unknown> = c._raw ? { ...c._raw } : {}

  b.key   = c.key || toKey(c.label)
  b.label = c.label

  if (c.type === 'heading') {
    const tag = c.headingLevel ?? 'h2'
    const al  = c.textAlign ? `text-align:${c.textAlign};` : ''
    b.type = 'content'; b.input = false
    b.html = `<${tag} class="bacord-heading" style="${al}margin:0">${c.label || 'Encabezado'}</${tag}>`
  } else if (c.type === 'image') {
    b.type = 'content'; b.input = false
    const marg = c.textAlign === 'center' ? 'margin:0 auto;display:block' : c.textAlign === 'right' ? 'margin-left:auto;display:block' : ''
    b.html = `<img src="${c.imageUrl ?? ''}" alt="${c.imageAlt ?? ''}" style="max-width:${c.imageWidth ?? '100%'};border-radius:6px;${marg}" />`
  } else if (c.type === 'divider') {
    b.type = 'content'; b.input = false
    b.html = '<hr style="border:none;border-top:2px solid rgba(10,21,48,0.12);margin:4px 0" />'
  } else if (c.type === 'firma-seccion') {
    // Render as HTML for form.io (custom type unknown to form.io). Buttons post messages to parent.
    b.type = 'content'; b.input = false
    if (c.idEstrategiaFirma !== undefined) b.idEstrategiaFirma = c.idEstrategiaFirma
    const ef  = c.idEstrategiaFirma ? mockEstrategiasFirma.find(e => e.id === c.idEstrategiaFirma) : null
    const firmas = ef ? ef.firmas.filter(f => f.activo).sort((a, b) => a.orden - b.orden) : []
    const firmados = _previewFirmados
    const firmasHtml = firmas.map((f, i) => {
      const fk        = `${c.key}__${f.idFirma}`
      const signed    = firmados[fk] ?? false
      const prevOk    = i === 0 || (firmados[`${c.key}__${firmas[i - 1].idFirma}`] ?? false)
      const blocked   = !signed && !prevOk
      const txEsc     = f.texto.replace(/&/g,'&amp;').replace(/"/g,'&quot;')
      const grEsc     = f.grupo.replace(/&/g,'&amp;').replace(/"/g,'&quot;')
      const rightCell = signed
        ? `<span style="display:flex;align-items:center;gap:4px;color:#16A34A;font-size:11px;font-weight:600">&#10003; Firmado</span>`
        : blocked
          ? `<div style="width:72px;height:26px;border-radius:5px;border:1.5px solid #E2E8F0;display:flex;align-items:center;justify-content:center;font-size:11px;color:#CBD5E1">Firmar</div>`
          : `<button class="firma-preview-btn" data-fk="${fk}" data-tx="${txEsc}" data-gr="${grEsc}" style="width:72px;height:26px;border-radius:5px;border:1.5px solid #7C3AED;background:#F5F3FF;cursor:pointer;font-size:11px;color:#7C3AED;font-weight:600">Firmar</button>`
      return `<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-top:1px solid #EDE9FE;background:${signed?'#F0FDF4':blocked?'#FAFAFA':'#FAFAFF'}">` +
        `<div style="width:20px;height:20px;border-radius:50%;background:${signed?'#16A34A':'#7C3AED'};color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0">${signed?'&#10003;':f.orden}</div>` +
        `<div style="flex:1;font-size:13px;color:${blocked?'#9CA3AF':'#374151'}">${f.texto}</div>` +
        `<span style="font-size:10px;padding:1px 7px;border-radius:20px;background:#EDE9FE;color:#7C3AED;font-weight:600">${f.grupo}</span>` +
        rightCell + `</div>`
    }).join('')
    const allSigned = firmas.length > 0 && firmas.every(f => firmados[`${c.key}__${f.idFirma}`])
    const doneCount = firmas.filter(f => firmados[`${c.key}__${f.idFirma}`]).length
    b.html =
      `<div style="border:1.5px solid ${allSigned?'#86EFAC':'#DDD6FE'};border-radius:8px;overflow:hidden;margin:4px 0">` +
        `<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:${allSigned?'#F0FDF4':'#F5F3FF'};border-bottom:1px solid ${allSigned?'#86EFAC':'#EDE9FE'}">` +
          `<div style="width:22px;height:22px;border-radius:50%;background:${allSigned?'#16A34A':'#7C3AED'};color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0">${allSigned?'&#10003;':'&#9999;'}</div>` +
          `<div><div style="font-size:12.5px;font-weight:700;color:${allSigned?'#16A34A':'#5B21B6'}">${c.label||'Firma de sección'}</div>` +
          (ef ? `<div style="font-size:10.5px;color:#9CA3AF;font-family:monospace">${ef.codigo} &middot; ${doneCount}/${firmas.length} firma${firmas.length!==1?'s':''}</div>`
              : `<div style="font-size:10.5px;color:#F59E0B">Sin estrategia configurada</div>`) +
          `</div></div>` +
        (firmas.length>0 ? firmasHtml : `<div style="padding:10px 12px;font-size:12px;color:#9CA3AF;text-align:center">Sin firmas activas</div>`) +
      `</div>`
  } else {
    b.type  = c.type
    b.input = !LAYOUT_TYPES.includes(c.type)
    if (c.placeholder) b.placeholder = c.placeholder
    if (c.description) b.description = c.description
    // Always write booleans — omitting them leaves _raw values intact when user turns them off
    b.hideLabel = !!c.hideLabel
    b.multiple  = !!c.multiple
    if (c.calculateValue) b.calculateValue = c.calculateValue
    if (c.custom)         b.custom         = c.custom
    if (c.opMapping)      b.opMapping      = c.opMapping
    const existingValidate = (b.validate as Record<string, unknown>) ?? {}
    b.validate = {
      ...existingValidate,
      required: !!c.required,
      ...(c.minVal !== undefined ? { min: c.minVal } : {}),
      ...(c.maxVal !== undefined ? { max: c.maxVal } : {}),
    }
    if (c.type === 'textarea')  b.rows = c.rows ?? 3
    if (c.type === 'currency')  { b.currency = 'USD'; b.inputFormat = 'plain' }
    if (c.type === 'select') {
      b.data = { values: (c.values ?? []).length ? c.values : [{ label: 'Opción 1', value: 'opcion1' }] }
      b.widget = 'choicesjs'
    }
    if (c.type === 'radio') {
      b.values = (c.values ?? []).length ? c.values : [{ label: 'Opción 1', value: 'opcion1' }, { label: 'Opción 2', value: 'opcion2' }]
      if (c.inline) b.inline = true
    }
    if (c.type === 'survey') {
      b.questions = (c.surveyRows    ?? []).length ? c.surveyRows    : [{ label: 'Pregunta 1', value: 'pregunta1' }]
      b.values    = (c.surveyColumns ?? []).length ? c.surveyColumns : [{ label: 'Opción A', value: 'opcion_a' }, { label: 'Opción B', value: 'opcion_b' }]
    }
    if (c.type === 'button')  { b.action = c.action ?? 'submit'; b.theme = c.theme ?? 'primary' }
    if (c.type === 'panel')   { b.input = false; b.title = c.title ?? c.label; b.collapsible = c.collapsible ?? false }
    if (c.type === 'columns') { b.input = false }
    if (c.type === 'content') { b.input = false; b.html = c.html ?? '<p>Contenido</p>' }
  }

  // Recurse into children
  if (c.components && c.components.length > 0) {
    if (c.type === 'columns') {
      const colCount = c.columnCount ?? 2
      const colWidth = Math.floor(12 / colCount)
      // Group children by their assigned column index
      const grouped: FormComp[][] = Array.from({ length: colCount }, () => [])
      c.components!.forEach(ch => {
        const idx = Math.min(ch._colIdx ?? 0, colCount - 1)
        grouped[idx].push(ch)
      })
      const rawCols = b.columns as Record<string, unknown>[] | undefined
      if (rawCols && rawCols.length === colCount) {
        b.columns = rawCols.map((col, i) => ({ ...col, components: applyLinealLocking(grouped[i]) }))
      } else {
        b.columns = grouped.map(group => ({
          width: colWidth, offset: 0, push: 0, pull: 0, size: 'sm',
          currentWidth: colWidth, components: applyLinealLocking(group),
        }))
      }
      // columns must never have a top-level components[] — form.io uses columns[].components
      delete (b as Record<string, unknown>).components
    } else {
      b.components = applyLinealLocking(c.components)
    }
  } else if (CONTAINER_TYPES.includes(c.type)) {
    if (c.type === 'columns') {
      const colCount = c.columnCount ?? 2
      const colWidth = Math.floor(12 / colCount)
      const rawCols = b.columns as Record<string, unknown>[] | undefined
      if (!rawCols || rawCols.length !== colCount) {
        b.columns = Array.from({ length: colCount }, () => ({
          width: colWidth, offset: 0, push: 0, pull: 0, size: 'sm', currentWidth: colWidth, components: [],
        }))
      }
      delete (b as Record<string, unknown>).components
    } else if (!b.components) {
      b.components = []
    }
  }

  return b
}

function toFormio(cs: FormComp[], firmados?: Record<string, boolean>): string {
  _previewFirmados = firmados ?? {}
  const result = JSON.stringify({ components: applyLinealLocking(cs) }, null, 2)
  _previewFirmados = {}
  return result
}

function parseComp(c: Record<string, unknown>): FormComp {
  const rawType = (c.type as string) ?? 'textfield'
  const type = normalizeType(rawType)
  const validate = (c.validate as Record<string, unknown>) ?? {}

  const comp: FormComp = {
    id: uid(),
    type,
    key: (c.key as string) ?? '',
    label: (c.label as string) ?? '',
    placeholder: c.placeholder as string | undefined,
    description: c.description as string | undefined,
    required: !!(validate.required),
    multiple: !!(c.multiple),
    inline: !!(c.inline),
    values: rawType === 'radio'
      ? (c.values as { label: string; value: string }[] | undefined)
      : ((c.data as Record<string, unknown>)?.values as { label: string; value: string }[] | undefined),
    surveyRows:    rawType === 'survey' ? (c.questions as { label: string; value: string }[] | undefined) : undefined,
    surveyColumns: rawType === 'survey' ? (c.values as { label: string; value: string }[] | undefined) : undefined,
    action: c.action as 'submit' | 'reset' | 'custom' | undefined,
    theme: c.theme as string | undefined,
    title: (c.title as string) ?? undefined,
    collapsible: !!(c.collapsible),
    html: (c.html as string | undefined) ?? (c.content as string | undefined),
    rows: c.rows as number | undefined,
    hideLabel: !!(c.hideLabel),
    minVal: validate.min as number | undefined,
    maxVal: validate.max as number | undefined,
    custom: c.custom as string | undefined,
    calculateValue: c.calculateValue as string | undefined,
    idEstrategiaFirma: c.idEstrategiaFirma as number | undefined,
    opMapping: c.opMapping as string | undefined,
    _raw: c,
  }

  // Recurse
  if (Array.isArray(c.components)) {
    comp.components = (c.components as Record<string, unknown>[]).map(parseComp)
  } else if (Array.isArray(c.columns)) {
    const cols = c.columns as Record<string, unknown>[]
    comp.columnCount = cols.length || 2
    comp.components = cols.flatMap((col, idx) =>
      Array.isArray(col.components)
        ? (col.components as Record<string, unknown>[]).map(ch => {
            const parsed = parseComp(ch)
            parsed._colIdx = idx
            return parsed
          })
        : []
    )
  }

  return comp
}

function fromFormio(json: string): FormComp[] {
  try {
    const obj = JSON.parse(json)
    if (!Array.isArray(obj?.components)) return []
    return (obj.components as Record<string, unknown>[]).map(parseComp)
  } catch { return [] }
}

function loadComps(detalle: Detalle): FormComp[] {
  if (detalle.jsonData) {
    try {
      const p = JSON.parse(detalle.jsonData)
      if (Array.isArray(p)) return p.map((c: FormComp) => ({ ...c, id: c.id || uid() }))
    } catch {}
  }
  return fromFormio(detalle.jsonSchema)
}

// ─── Initial data ─────────────────────────────────────────────────────────────

// Detalle data now lives in @/stores/detallesStore — shared with EditarBatchRecord

function countComps(json: string) {
  try {
    function countDeep(arr: unknown[]): number {
      return arr.reduce<number>((n, c) => {
        const cc = c as Record<string,unknown>
        return n + 1 + (Array.isArray(cc.components) ? countDeep(cc.components) : 0) +
          (Array.isArray(cc.columns) ? (cc.columns as Record<string,unknown>[]).reduce((s, col) => s + (Array.isArray(col.components) ? countDeep(col.components) : 0), 0) : 0)
      }, 0)
    }
    const o = JSON.parse(json)
    return Array.isArray(o?.components) ? countDeep(o.components) : 0
  } catch { return 0 }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const INP: React.CSSProperties = {
  width:'100%', padding:'8px 11px', background:'#fff',
  border:'1.5px solid var(--hair-2)', borderRadius:'var(--r-sm)',
  fontSize:13, color:'var(--ink)', fontFamily:'var(--f-sans)', outline:'none',
}
const PROP_INP: React.CSSProperties = {
  width:'100%', padding:'7px 10px', border:'1.5px solid #E2E8F0',
  borderRadius:6, fontSize:13, fontFamily:'var(--f-sans)',
  outline:'none', color:'#374151', background:'#fff', boxSizing:'border-box',
}
const PROP_LABEL: React.CSSProperties = {
  display:'block', fontSize:11, fontWeight:700, color:'#94A3B8',
  textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:5,
}
const SEC_TITLE: React.CSSProperties = {
  borderTop:'2px solid #EEF2F8', paddingTop:10, marginTop:8, marginBottom:10,
  fontSize:10, fontWeight:700, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'0.08em',
}
const BTN_COLORS: Record<string, string> = { primary:'#2563EB', secondary:'#6B7280', success:'#16A34A', danger:'#DC2626', warning:'#D97706' }

// ─── FieldPreview ─────────────────────────────────────────────────────────────

function FieldPreview({ c }: { c: FormComp }) {
  const opLabel = c.opMapping ? OP_MAPPING_OPTIONS.find(o => o.value === c.opMapping)?.label : undefined
  const lbl = (
    <div style={{ fontSize:12.5, fontWeight:600, color:'#1E293B', marginBottom:5, display:'flex', alignItems:'center', gap:4, flexWrap:'wrap' }}>
      {!c.hideLabel && c.label}
      {c.required && <span style={{ color:'#EF4444', fontSize:10 }}>*</span>}
      {c.description && <span style={{ color:'#94A3B8', fontWeight:400, fontSize:11 }}>— {c.description}</span>}
      {opLabel && (
        <span style={{ fontSize:9.5, fontWeight:700, color:'#1D4ED8', background:'#DBEAFE',
          border:'1px solid #BFDBFE', borderRadius:20, padding:'1px 7px',
          display:'inline-flex', alignItems:'center', gap:4 }}>
          <i className="fa fa-link" /> OP: {opLabel}
        </span>
      )}
    </div>
  )
  const base: React.CSSProperties = { width:'100%', padding:'6px 10px', border:'1.5px solid #E2E8F0', borderRadius:6, fontSize:13, color:'#94A3B8', background:'#F8FAFC', pointerEvents:'none', boxSizing:'border-box' }

  switch (c.type) {
    case 'textfield': return <div>{lbl}<input style={base} placeholder={c.placeholder || 'Ingrese texto...'} readOnly /></div>
    case 'password':  return <div>{lbl}<input style={base} type="password" placeholder="••••••••" readOnly /></div>
    case 'number':    return <div>{lbl}<input style={base} placeholder={`${c.minVal ?? 0}${c.maxVal !== undefined ? ` – ${c.maxVal}` : ''}`} readOnly /></div>
    case 'currency':  return <div>{lbl}<div style={{ position:'relative' }}><span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#94A3B8', fontSize:13 }}>$</span><input style={{ ...base, paddingLeft:22 }} placeholder="0.00" readOnly /></div></div>
    case 'textarea':  return <div>{lbl}<textarea style={{ ...base, height:60, resize:'none', display:'block' }} placeholder={c.placeholder || 'Ingrese texto...'} readOnly /></div>
    case 'checkbox':  return <div style={{ display:'flex', alignItems:'center', gap:8 }}><div style={{ width:16, height:16, borderRadius:4, border:'2px solid #D1D5DB', background:'#F9FAFB', flexShrink:0 }} /><span style={{ fontSize:13, color:'#374151' }}>{c.label}</span></div>
    case 'radio':     return <div>{lbl}{(c.values ?? [{ label:'Opción 1', value:'o1' },{ label:'Opción 2', value:'o2' }]).slice(0,3).map(v=><div key={v.value} style={{ display:'flex', alignItems:'center', gap:7, marginBottom:3 }}><div style={{ width:14, height:14, borderRadius:'50%', border:'2px solid #D1D5DB', background:'#F9FAFB', flexShrink:0 }} /><span style={{ fontSize:12.5, color:'#6B7280' }}>{v.label}</span></div>)}</div>
    case 'select':    return <div>{lbl}<div style={{ ...base, display:'flex', alignItems:'center', justifyContent:'space-between' }}><span>{c.values?.[0]?.label ?? 'Seleccione...'}</span><i className="fa fa-chevron-down" style={{ fontSize:10 }} /></div></div>
    case 'datetime':  return <div>{lbl}<div style={{ display:'flex', border:'1.5px solid #E2E8F0', borderRadius:6, overflow:'hidden' }}><input style={{ ...base, border:'none', borderRadius:0, flex:1, minWidth:0, width:'auto' }} placeholder="dd/mm/aaaa  hh:mm" readOnly /><div style={{ display:'grid', placeItems:'center', width:34, flexShrink:0, background:'#F1F5F9', borderLeft:'1px solid #E2E8F0' }}><i className="fa fa-calendar-alt" style={{ color:'#6B7280', fontSize:12 }} /></div></div></div>
    case 'day':       return <div>{lbl}<div style={{ display:'flex', border:'1.5px solid #E2E8F0', borderRadius:6, overflow:'hidden' }}><input style={{ ...base, border:'none', borderRadius:0, flex:1, minWidth:0, width:'auto' }} placeholder="dd / mm / aaaa" readOnly /><div style={{ display:'grid', placeItems:'center', width:34, flexShrink:0, background:'#F1F5F9', borderLeft:'1px solid #E2E8F0' }}><i className="fa fa-calendar" style={{ color:'#6B7280', fontSize:12 }} /></div></div></div>
    case 'time':      return <div>{lbl}<input style={{ ...base, maxWidth:120 }} placeholder="hh:mm" readOnly /></div>
    case 'hidden':    return <div style={{ display:'flex', alignItems:'center', gap:7, padding:'4px 8px', background:'#F8FAFC', border:'1.5px dashed #CBD5E1', borderRadius:6 }}><i className="fa fa-eye-slash" style={{ color:'#94A3B8', fontSize:11 }} /><span style={{ fontSize:11.5, color:'#94A3B8', fontFamily:'var(--f-mono)' }}>{c.key} <span style={{ opacity:.6 }}>(oculto)</span></span></div>
    case 'button': {
      const col = BTN_COLORS[c.theme ?? 'primary'] ?? '#2563EB'
      return <button style={{ padding:'8px 20px', background:col, color:'#fff', border:'none', borderRadius:7, fontSize:13, fontWeight:600, cursor:'default', opacity:0.9 }}>{c.label}</button>
    }
    case 'panel': return (
      <div style={{ border:'1.5px solid #E2E8F0', borderRadius:8, overflow:'hidden' }}>
        <div style={{ background:'#F1F5F9', padding:'8px 14px', fontSize:12.5, fontWeight:700, color:'#374151', borderBottom:'1px solid #E2E8F0', display:'flex', alignItems:'center', gap:6 }}>
          {c.collapsible && <i className="fa fa-chevron-down" style={{ fontSize:10, color:'#94A3B8' }} />}
          {(c.title ?? c.label) || <em style={{ fontWeight:400, color:'#94A3B8' }}>Panel sin título</em>}
          <span style={{ marginLeft:'auto', fontSize:10, fontFamily:'var(--f-mono)', color:'#94A3B8', flexShrink:0 }}>
            {c.components?.length ? `${c.components.length} campo${c.components.length!==1?'s':''}` : 'vacío'}
          </span>
        </div>
        {c.components?.length ? (
          <div style={{ padding:'10px 14px', display:'flex', flexDirection:'column', gap:12, background:'#fff' }}>
            {c.components.map(child => <FieldPreview key={child.id} c={child} />)}
          </div>
        ) : (
          <div style={{ padding:'14px', fontSize:11.5, color:'#94A3B8', fontStyle:'italic', textAlign:'center' }}>
            Panel vacío — expande y arrastra campos aquí
          </div>
        )}
      </div>
    )
    case 'columns': {
      const n = c.columnCount ?? 2
      return <div style={{ display:'grid', gridTemplateColumns:`repeat(${n}, 1fr)`, gap:8 }}>{Array.from({length:n}).map((_,i)=><div key={i} style={{ border:'2px dashed #E2E8F0', borderRadius:7, padding:'10px 8px', fontSize:11, color:'#94A3B8', textAlign:'center', minHeight:32, display:'flex', alignItems:'center', justifyContent:'center' }}>Col. {i+1}</div>)}</div>
    }
    case 'content':   return <div style={{ padding:'4px 2px', minHeight:20, fontSize:13.5, lineHeight:1.65, wordBreak:'break-word', overflow:'hidden' }} dangerouslySetInnerHTML={{ __html: c.html || '<em style="color:#94A3B8;font-size:12px;font-style:italic">Bloque HTML vacío</em>' }} />
    case 'heading': {
      const sz: Record<string, number> = { h1:20, h2:16, h3:13.5, h4:11.5 }
      const level = c.headingLevel ?? 'h2'
      const isH4 = level === 'h4'
      const barH = { h1:20, h2:16, h3:14, h4:11 }
      return (
        <div style={{ display:'flex', alignItems:'flex-start', gap:8, paddingBottom:6, borderBottom:'1.5px solid #EEF2F9', margin:'2px 0 6px', textAlign:c.textAlign ?? 'left' }}>
          <div style={{ width:3, minHeight:barH[level], borderRadius:2, background:isH4?'#94A3B8':'#0A2D63', flexShrink:0, marginTop:3 }} />
          <div style={{ fontSize:sz[level], fontWeight:700, color:isH4?'#64748B':'#0A1530', lineHeight:1.25, textTransform:isH4?'uppercase':'none', letterSpacing:isH4?'0.07em':'normal' }}>
            {c.label || 'Encabezado'}
          </div>
        </div>
      )
    }
    case 'image':
      return c.imageUrl
        ? <div style={{ textAlign:c.textAlign ?? 'left' }}><img src={c.imageUrl} alt={c.imageAlt ?? ''} style={{ maxWidth:c.imageWidth ?? '100%', borderRadius:6, display:'inline-block', maxHeight:120, objectFit:'cover' }} /></div>
        : <div style={{ background:'#F1F5F9', border:'2px dashed #CBD5E1', borderRadius:8, padding:'18px 16px', textAlign:'center', color:'#94A3B8' }}><i className="fa fa-image" style={{ fontSize:22, display:'block', marginBottom:6 }} /><span style={{ fontSize:11.5 }}>Configura la URL en propiedades</span></div>
    case 'divider':   return <div style={{ padding:'6px 0' }}><hr style={{ border:'none', borderTop:'2px solid #E2E8F0', margin:0 }} /></div>
    case 'survey': {
      const sRows = c.surveyRows    ?? [{ label: 'Pregunta 1', value: 'p1' }]
      const sCols = c.surveyColumns ?? [{ label: 'Opción A',   value: 'a'  }, { label: 'Opción B', value: 'b' }]
      const gridCols = `2fr ${sCols.map(() => '1fr').join(' ')}`
      return (
        <div>{lbl}
          <div style={{ border:'1px solid #E2E8F0', borderRadius:6, overflow:'hidden', fontSize:11 }}>
            {/* Header row */}
            <div style={{ display:'grid', gridTemplateColumns:gridCols, background:'#F8FAFC', borderBottom:'1px solid #E2E8F0' }}>
              <div style={{ padding:'4px 8px', fontWeight:700, color:'#64748B', borderRight:'1px solid #E2E8F0' }}>Pregunta</div>
              {sCols.map(col => (
                <div key={col.value} style={{ padding:'4px 8px', fontWeight:700, color:'#64748B', borderRight:'1px solid #E2E8F0', textAlign:'center' }}>{col.label}</div>
              ))}
            </div>
            {/* Data rows */}
            {sRows.slice(0, 3).map((row, ri) => (
              <div key={row.value} style={{ display:'grid', gridTemplateColumns:gridCols, borderBottom: ri < sRows.length - 1 ? '1px solid #F1F5F9' : 'none', background: ri % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                <div style={{ padding:'5px 8px', color:'#374151', borderRight:'1px solid #F1F5F9' }}>{row.label}</div>
                {sCols.map(col => (
                  <div key={col.value} style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'5px 0', borderRight:'1px solid #F1F5F9' }}>
                    <div style={{ width:13, height:13, borderRadius:'50%', border:'2px solid #CBD5E1', background:'#F9FAFB' }} />
                  </div>
                ))}
              </div>
            ))}
            {sRows.length > 3 && (
              <div style={{ padding:'4px 8px', color:'#94A3B8', textAlign:'center', background:'#F8FAFC' }}>
                +{sRows.length - 3} más...
              </div>
            )}
          </div>
        </div>
      )
    }
    case 'datagrid':  return (
      <div>
        {lbl}
        <div style={{ border:'1px solid #E2E8F0', borderRadius:6, overflow:'hidden' }}>
          <div style={{ background:'#F1F5F9', padding:'5px 10px', fontSize:11.5, fontWeight:600, color:'#475569', borderBottom:'1px solid #E2E8F0', display:'flex', justifyContent:'space-between' }}>
            <span>Grilla de datos</span>
            <span style={{ color:'#94A3B8', fontWeight:400 }}>{c.components?.length ?? 0} columnas</span>
          </div>
          {c.components?.length ? (
            <div style={{ display:'flex', gap:0, overflowX:'auto' }}>
              {c.components.slice(0,5).map(col => (
                <div key={col.id} style={{ flex:1, padding:'4px 8px', fontSize:11, borderRight:'1px solid #F1F5F9', color:'#374151', fontWeight:500, minWidth:80, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{col.label}</div>
              ))}
              {c.components.length > 5 && <div style={{ padding:'4px 6px', fontSize:11, color:'#94A3B8' }}>+{c.components.length - 5}</div>}
            </div>
          ) : <div style={{ padding:'6px 10px', fontSize:11.5, color:'#2563EB', cursor:'default' }}>+ Agregar fila</div>}
        </div>
      </div>
    )
    case 'firma-seccion': {
      const ef = c.idEstrategiaFirma ? mockEstrategiasFirma.find(e => e.id === c.idEstrategiaFirma) : null
      const firmas = ef ? ef.firmas.filter(f => f.activo).sort((a, b) => a.orden - b.orden) : []
      return (
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
            <div style={{ width:22, height:22, borderRadius:6, background:'#F5F3FF', display:'grid', placeItems:'center' }}>
              <i className="fa fa-pen-square" style={{ color:'#7C3AED', fontSize:10 }} />
            </div>
            <span style={{ fontSize:12.5, fontWeight:700, color:'#7C3AED' }}>{c.label || 'Firma de sección'}</span>
            {ef && <span style={{ fontSize:10.5, color:'#7C3AED', background:'#F5F3FF', padding:'1px 7px', borderRadius:20, fontFamily:'var(--f-mono)' }}>{ef.codigo}</span>}
          </div>
          {firmas.length === 0 ? (
            <div style={{ padding:'8px 10px', background:'#F5F3FF', border:'1.5px dashed #DDD6FE', borderRadius:6, fontSize:11.5, color:'#9CA3AF', textAlign:'center' }}>
              {ef ? 'Sin firmas activas en esta estrategia' : 'Configura la estrategia en propiedades →'}
            </div>
          ) : (
            <div style={{ border:'1.5px solid #DDD6FE', borderRadius:8, overflow:'hidden' }}>
              {firmas.map((f, i) => (
                <div key={f.idFirma} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px', borderBottom: i < firmas.length - 1 ? '1px solid #EDE9FE' : 'none', background:'#FAFAFF' }}>
                  <div style={{ width:18, height:18, borderRadius:'50%', background:'#7C3AED', color:'#fff', fontSize:9, fontWeight:700, display:'grid', placeItems:'center', flexShrink:0, fontFamily:'var(--f-mono)' }}>{f.orden}</div>
                  <span style={{ fontSize:11.5, color:'#374151', flex:1 }}>{f.texto}</span>
                  <span style={{ fontSize:10, padding:'1px 6px', borderRadius:20, background:'#EDE9FE', color:'#7C3AED', fontWeight:600 }}>{f.grupo}</span>
                  <div style={{ width:60, height:22, borderRadius:5, border:'1.5px solid #DDD6FE', background:'#fff', display:'grid', placeItems:'center', fontSize:10, color:'#9CA3AF', flexShrink:0 }}>Firmar</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }
    default: return <div>{lbl}<input style={base} readOnly /></div>
  }
}

// ─── NestedCompList ────────────────────────────────────────────────────────────

function NestedCompList({ comps, selectedId, onSelect, parentId, onRemove, onAdd, onReorder, onAddToColumn, onMoveToCol, onReorderInColumn }: {
  comps: FormComp[]
  selectedId: string | null
  onSelect: (id: string) => void
  parentId: string
  onRemove: (parentId: string, childId: string) => void
  onAdd: (parentId: string, type: CompType) => void
  onReorder: (parentId: string, childId: string, dir: 'up' | 'down') => void
  onAddToColumn?: (parentId: string, type: CompType, colIdx: number) => void
  onMoveToCol?: (childId: string, colIdx: number) => void
  onReorderInColumn?: (parentId: string, childId: string, dir: 'up' | 'down', colIdx: number) => void
}) {
  const [adding, setAdding] = useState(false)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const dragSrcId = useRef<string | null>(null)
  const quickTypes: CompType[] = ['textfield','number','textarea','checkbox','radio','select','datetime','button','panel','columns','firma-seccion']

  const handleDragStart = (id: string) => { dragSrcId.current = id }
  const handleDrop = (targetId: string) => {
    const src = dragSrcId.current
    if (!src || src === targetId) { setDragOverId(null); return }
    const srcIdx = comps.findIndex(c => c.id === src)
    const tgtIdx = comps.findIndex(c => c.id === targetId)
    if (srcIdx < 0 || tgtIdx < 0) { setDragOverId(null); return }
    const dir = srcIdx < tgtIdx ? 'down' : 'up'
    // Reorder by calling up/down repeatedly — simpler: just bubble to parent via repeated calls
    // Instead, use a dedicated swap approach via onReorder chains or expose onReorderDirect
    // For now, use repeated onReorder calls to move src to target position
    const steps = Math.abs(tgtIdx - srcIdx)
    for (let s = 0; s < steps; s++) onReorder(parentId, src, dir)
    setDragOverId(null)
    dragSrcId.current = null
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {comps.map((c, idx) => {
        const p = PAL_MAP[c.type] ?? { icon:'fa-cube', color:'#94A3B8', bg:'#F8FAFC', label:String(c.type) }
        const isSel     = selectedId === c.id
        const isDragOvr = dragOverId === c.id
        const isColumns = c.type === 'columns'
        const isFirst   = idx === 0
        const isLast    = idx === comps.length - 1
        return (
          <div key={c.id}
            onDragOver={e => { e.preventDefault(); setDragOverId(c.id) }}
            onDragLeave={() => setDragOverId(null)}
            onDrop={() => handleDrop(c.id)}
            onDragEnd={() => { setDragOverId(null); dragSrcId.current = null }}
            onClick={e => { e.stopPropagation(); onSelect(c.id) }}
            style={{
              background: isSel ? '#F0F7FF' : '#fff',
              border: `1.5px solid ${isDragOvr ? '#2563EB' : isSel ? '#2563EB' : '#E2E8F0'}`,
              boxShadow: isDragOvr ? '0 0 0 3px rgba(37,99,235,.15)' : isSel ? '0 0 0 3px rgba(37,99,235,.1)' : '0 1px 4px rgba(0,0,0,.04)',
              borderRadius: 8,
              overflow: 'hidden',
              cursor: 'pointer',
              transition: 'all 100ms',
            }}>
            {/* Toolbar del ítem — drag + tipo + key + acciones */}
            <div style={{ display:'flex', alignItems:'center', gap:5, padding:'3px 8px', background: isSel ? '#EFF6FF' : isDragOvr ? '#EFF6FF' : '#F8FAFC', borderBottom:`1px solid ${isSel ? '#BFDBFE' : '#EEF0F3'}`, userSelect:'none' }}>
              <span
                draggable
                onDragStart={e => { e.stopPropagation(); handleDragStart(c.id) }}
                style={{ color:'#CBD5E1', fontSize:11, cursor:'grab', flexShrink:0, lineHeight:1 }}>⋮⋮</span>
              <div style={{ width:16, height:16, borderRadius:4, background:p.bg, display:'grid', placeItems:'center', flexShrink:0 }}>
                <i className={`fa ${p.icon}`} style={{ color:p.color, fontSize:7 }} />
              </div>
              <span style={{ fontSize:10, fontWeight:600, color:isSel?'#1D4ED8':'#64748B', flexShrink:0 }}>
                {p.label ?? String(c.type)}
              </span>
              <span style={{ fontSize:9.5, color:'#94A3B8', fontFamily:'var(--f-mono)', background:'#F1F5F9', padding:'0 4px', borderRadius:3, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {c.key}
              </span>
              {/* Up / Down arrows */}
              <button onClick={e => { e.stopPropagation(); onReorder(parentId, c.id, 'up') }} disabled={isFirst} title="Subir"
                style={{ width:16, height:16, border:'none', background:'transparent', color:isFirst?'#E2E8F0':'#94A3B8', cursor:isFirst?'default':'pointer', fontSize:7, display:'grid', placeItems:'center', padding:0, flexShrink:0 }}>
                <i className="fa fa-chevron-up" />
              </button>
              <button onClick={e => { e.stopPropagation(); onReorder(parentId, c.id, 'down') }} disabled={isLast} title="Bajar"
                style={{ width:16, height:16, border:'none', background:'transparent', color:isLast?'#E2E8F0':'#94A3B8', cursor:isLast?'default':'pointer', fontSize:7, display:'grid', placeItems:'center', padding:0, flexShrink:0 }}>
                <i className="fa fa-chevron-down" />
              </button>
              <button onClick={e => { e.stopPropagation(); onRemove(parentId, c.id) }}
                style={{ width:18, height:18, border:'none', background:'transparent', color:'#CBD5E1', cursor:'pointer', fontSize:10, display:'grid', placeItems:'center', flexShrink:0, borderRadius:3 }}
                onMouseEnter={e => e.currentTarget.style.color = '#DC2626'}
                onMouseLeave={e => e.currentTarget.style.color = '#CBD5E1'}>
                <i className="fa fa-times" />
              </button>
            </div>
            {/* Vista previa del campo */}
            <div style={{ padding:'8px 10px' }}>
              {isColumns && onAddToColumn && onMoveToCol && onReorderInColumn
                ? <ColumnsEditor
                    comp={c}
                    selectedId={selectedId}
                    onSelect={onSelect}
                    onRemove={onRemove}
                    onAdd={onAddToColumn}
                    onMoveToCol={onMoveToCol}
                    onReorder={onReorderInColumn}
                  />
                : isColumns
                  ? <ColumnsPreview comp={c} selectedId={selectedId} onSelect={onSelect} />
                  : <div style={{ pointerEvents:'none' }}><FieldPreview c={c} /></div>
              }
            </div>
          </div>
        )
      })}

      {adding ? (
        <div style={{ display:'flex', flexWrap:'wrap', gap:5, padding:'8px 10px', background:'#F8FAFC', borderRadius:8, border:'1.5px dashed #CBD5E1' }}>
          {quickTypes.map(t => {
            const p = PAL_MAP[t]
            return (
              <button key={t} onClick={() => { onAdd(parentId, t); setAdding(false) }}
                style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 10px', borderRadius:6, border:'1.5px solid #E2E8F0', background:'#fff', cursor:'pointer', fontSize:11.5, color:'#374151', transition:'all 80ms' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = p.color; e.currentTarget.style.background = p.bg }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.background = '#fff' }}>
                <i className={`fa ${p.icon}`} style={{ color:p.color, fontSize:10 }} />{p.label}
              </button>
            )
          })}
          <button onClick={() => setAdding(false)}
            style={{ padding:'5px 10px', borderRadius:6, border:'1.5px solid #E2E8F0', background:'transparent', cursor:'pointer', fontSize:11, color:'#94A3B8' }}>
            ✕ Cancelar
          </button>
        </div>
      ) : (
        <button onClick={e => { e.stopPropagation(); setAdding(true) }}
          style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'9px', borderRadius:8, border:'1.5px dashed #CBD5E1', background:'transparent', cursor:'pointer', fontSize:12, color:'#94A3B8', transition:'all 80ms', width:'100%' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#2563EB'; e.currentTarget.style.color = '#2563EB'; e.currentTarget.style.background = '#F0F7FF' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.color = '#94A3B8'; e.currentTarget.style.background = 'transparent' }}>
          <i className="fa fa-plus" style={{ fontSize:10 }} /> Agregar campo al panel
        </button>
      )}
    </div>
  )
}

// ─── ColumnsPreview ───────────────────────────────────────────────────────────
// Read-only view of a columns component's children — used when columns appears
// inside a NestedCompList (i.e., as a child of a panel).

function ColumnsPreview({ comp, selectedId, onSelect }: {
  comp: FormComp
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const colCount = comp.columnCount ?? 2
  const childrenByCol = Array.from({ length: colCount }, (_, i) =>
    (comp.components ?? []).filter(ch => Math.min(ch._colIdx ?? 0, colCount - 1) === i)
  )
  return (
    <div style={{ display:'grid', gridTemplateColumns:`repeat(${colCount}, 1fr)`, gap:6 }}>
      {childrenByCol.map((children, colIdx) => (
        <div key={colIdx}
          style={{ border:'1.5px solid #E2E8F0', borderRadius:7, padding:'6px 8px', background:'#F8FAFC', minHeight:40 }}>
          <div style={{ fontSize:9, fontWeight:700, color:'#94A3B8', textTransform:'uppercase',
            letterSpacing:'.1em', marginBottom:5, textAlign:'center' }}>
            Col. {colIdx + 1}
          </div>
          {children.length === 0
            ? <div style={{ textAlign:'center', color:'#CBD5E1', fontSize:10, fontStyle:'italic' }}>Vacía</div>
            : children.map(ch => (
              <div key={ch.id}
                onClick={e => { e.stopPropagation(); onSelect(ch.id) }}
                style={{ borderRadius:6, padding:'5px 7px', marginBottom:4, cursor:'pointer',
                  background: selectedId === ch.id ? '#EFF6FF' : '#fff',
                  border:`1.5px solid ${selectedId === ch.id ? '#2563EB' : '#E2E8F0'}`,
                  boxShadow: selectedId === ch.id ? '0 0 0 3px rgba(37,99,235,.1)' : 'none',
                  transition:'all 80ms' }}>
                <div style={{ pointerEvents:'none' }}>
                  <FieldPreview c={ch} />
                </div>
              </div>
            ))
          }
        </div>
      ))}
    </div>
  )
}

// ─── ColumnsEditor ────────────────────────────────────────────────────────────

function ColumnsEditor({ comp, selectedId, onSelect, onRemove, onAdd, onMoveToCol, onReorder }: {
  comp: FormComp
  selectedId: string | null
  onSelect: (id: string) => void
  onRemove: (parentId: string, childId: string) => void
  onAdd: (parentId: string, type: CompType, colIdx: number) => void
  onMoveToCol: (childId: string, colIdx: number) => void
  onReorder: (parentId: string, childId: string, dir: 'up' | 'down', colIdx: number) => void
}) {
  const colCount = comp.columnCount ?? 2
  const quickTypes: CompType[] = ['textfield','number','textarea','checkbox','radio','select','datetime','button','panel','firma-seccion']
  const [addingIn, setAddingIn] = useState<number | null>(null)
  const [hovCh, setHovCh] = useState<string | null>(null)

  const childrenByCol = Array.from({ length: colCount }, (_, i) =>
    (comp.components ?? []).filter(ch => Math.min(ch._colIdx ?? 0, colCount - 1) === i)
  )

  const colBtnSt: React.CSSProperties = {
    width:20, height:20, border:'none', background:'transparent',
    cursor:'pointer', fontSize:9, display:'grid', placeItems:'center',
    padding:0, color:'#94A3B8', borderRadius:3, flexShrink:0,
  }

  return (
    <div style={{ display:'grid', gridTemplateColumns:`repeat(${colCount}, 1fr)`, gap:10, marginTop:8 }}>
      {Array.from({ length: colCount }).map((_, colIdx) => (
        <div key={colIdx} style={{
          border:'1.5px solid #E2E8F0', borderRadius:10, overflow:'hidden',
          background:'#F8FAFC', minHeight:60, display:'flex', flexDirection:'column',
        }}>
          {/* Column header */}
          <div style={{ padding:'5px 10px', background:'#EEF2F7', borderBottom:'1px solid #E2E8F0',
            fontSize:9.5, fontWeight:700, color:'#64748B', textTransform:'uppercase',
            letterSpacing:'.08em', display:'flex', alignItems:'center', gap:4 }}>
            <i className="fa fa-columns" style={{ fontSize:8, color:'#94A3B8' }} />
            Columna {colIdx + 1}
            <span style={{ marginLeft:'auto', fontWeight:400, color:'#94A3B8', fontFamily:'var(--f-mono)', fontSize:9 }}>
              {childrenByCol[colIdx].length} campo{childrenByCol[colIdx].length!==1?'s':''}
            </span>
          </div>

          {/* Fields */}
          <div style={{ flex:1, padding:'6px', display:'flex', flexDirection:'column', gap:4 }}>
            {childrenByCol[colIdx].map((ch, idxInCol) => {
              const isSel = selectedId === ch.id
              const isChHov = hovCh === ch.id
              const isFirst = idxInCol === 0
              const isLast  = idxInCol === childrenByCol[colIdx].length - 1
              const active  = isSel || isChHov
              const p = PAL_MAP[ch.type] ?? { icon:'fa-cube', color:'#94A3B8', bg:'#F8FAFC', label: String(ch.type) }
              return (
                <div key={ch.id}
                  onClick={e => { e.stopPropagation(); onSelect(ch.id) }}
                  onMouseEnter={() => setHovCh(ch.id)}
                  onMouseLeave={() => setHovCh(null)}
                  style={{
                    borderRadius:7, border:`1.5px solid ${isSel?'#2563EB':isChHov?'#94A3B8':'#E2E8F0'}`,
                    background:isSel?'#F0F7FF':'#fff', overflow:'hidden',
                    transition:'all 80ms', cursor:'pointer',
                    boxShadow: isSel?'0 0 0 3px rgba(37,99,235,.1)':'0 1px 3px rgba(0,0,0,.04)',
                  }}>
                  {/* Mini toolbar — slides in on hover/select */}
                  <div style={{
                    display:'flex', alignItems:'center', gap:3, padding:'2px 6px',
                    background:isSel?'#EFF6FF':'#F1F5F9',
                    borderBottom:`1px solid ${isSel?'#BFDBFE':'#E8EDF2'}`,
                    opacity: active?1:0, transition:'opacity 80ms',
                    minHeight:22,
                  }}>
                    <div style={{ width:14, height:14, borderRadius:3, background:p.bg, display:'grid', placeItems:'center', flexShrink:0 }}>
                      <i className={`fa ${p.icon}`} style={{ color:p.color, fontSize:7 }} />
                    </div>
                    <span style={{ fontSize:9.5, fontWeight:600, color:isSel?'#1D4ED8':'#475569', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {p.label}
                    </span>
                    {/* Up/down */}
                    <button onClick={e => { e.stopPropagation(); onReorder(comp.id, ch.id, 'up', colIdx) }}
                      disabled={isFirst} title="Subir"
                      style={{ ...colBtnSt, color:isFirst?'#E2E8F0':'#94A3B8', cursor:isFirst?'default':'pointer' }}>
                      <i className="fa fa-chevron-up" />
                    </button>
                    <button onClick={e => { e.stopPropagation(); onReorder(comp.id, ch.id, 'down', colIdx) }}
                      disabled={isLast} title="Bajar"
                      style={{ ...colBtnSt, color:isLast?'#E2E8F0':'#94A3B8', cursor:isLast?'default':'pointer' }}>
                      <i className="fa fa-chevron-down" />
                    </button>
                    {/* Move between columns */}
                    {colIdx > 0 && (
                      <button onClick={e => { e.stopPropagation(); onMoveToCol(ch.id, colIdx - 1) }}
                        title="Mover a columna anterior" style={colBtnSt}>
                        <i className="fa fa-arrow-left" />
                      </button>
                    )}
                    {colIdx < colCount - 1 && (
                      <button onClick={e => { e.stopPropagation(); onMoveToCol(ch.id, colIdx + 1) }}
                        title="Mover a columna siguiente" style={colBtnSt}>
                        <i className="fa fa-arrow-right" />
                      </button>
                    )}
                    {/* Delete */}
                    <button onClick={e => { e.stopPropagation(); onRemove(comp.id, ch.id) }}
                      title="Eliminar"
                      style={{ ...colBtnSt, color:'#FCA5A5' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#DC2626'}
                      onMouseLeave={e => e.currentTarget.style.color = '#FCA5A5'}>
                      <i className="fa fa-times" />
                    </button>
                  </div>
                  {/* Field preview */}
                  <div style={{ padding:'8px 9px', pointerEvents:'none' }}>
                    <FieldPreview c={ch} />
                  </div>
                </div>
              )
            })}

            {/* Add button */}
            {addingIn === colIdx ? (
              <div style={{ display:'flex', flexWrap:'wrap', gap:4, padding:'6px', background:'#fff', borderRadius:7, border:'1.5px dashed #CBD5E1' }}>
                {quickTypes.map(t => {
                  const p = PAL_MAP[t]
                  return (
                    <button key={t} onClick={() => { onAdd(comp.id, t, colIdx); setAddingIn(null) }}
                      style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 8px', borderRadius:5, border:'1.5px solid #E2E8F0', background:'#fff', cursor:'pointer', fontSize:10.5, color:'#374151', transition:'all 80ms' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = p.color; e.currentTarget.style.background = p.bg }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.background = '#fff' }}>
                      <i className={`fa ${p.icon}`} style={{ color:p.color, fontSize:9 }} />{p.label}
                    </button>
                  )
                })}
                <button onClick={() => setAddingIn(null)}
                  style={{ padding:'3px 8px', borderRadius:5, border:'1.5px solid #E2E8F0', background:'transparent', cursor:'pointer', fontSize:10.5, color:'#94A3B8' }}>
                  ✕
                </button>
              </div>
            ) : (
              <button onClick={e => { e.stopPropagation(); setAddingIn(colIdx) }}
                style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:5, padding:'6px', borderRadius:7, border:'1.5px dashed #CBD5E1', background:'transparent', cursor:'pointer', fontSize:11, color:'#94A3B8', width:'100%', transition:'all 80ms', marginTop: childrenByCol[colIdx].length ? 2 : 0 }}
                onMouseEnter={e => { e.currentTarget.style.borderColor='#2563EB'; e.currentTarget.style.color='#2563EB'; e.currentTarget.style.background='#F0F7FF' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor='#CBD5E1'; e.currentTarget.style.color='#94A3B8'; e.currentTarget.style.background='transparent' }}>
                <i className="fa fa-plus" style={{ fontSize:9 }} /> Agregar campo
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── RichTextEditor ───────────────────────────────────────────────────────────

function RichTextEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [showRaw, setShowRaw] = useState(false)
  const [rawHtml, setRawHtml] = useState(value)

  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = value || ''
  }, []) // mount-only; parent keys this component per comp.id

  const exec = (cmd: string, val?: string) => {
    editorRef.current?.focus()
    document.execCommand(cmd, false, val ?? undefined)
    flush()
  }
  const flush = () => {
    if (!editorRef.current) return
    const h = editorRef.current.innerHTML
    setRawHtml(h); onChange(h)
  }
  const switchToRaw = () => {
    if (editorRef.current) setRawHtml(editorRef.current.innerHTML)
    setShowRaw(true)
  }
  const switchToWysiwyg = () => {
    if (editorRef.current) editorRef.current.innerHTML = rawHtml
    setShowRaw(false); onChange(rawHtml)
  }

  const tbBtn = (active = false): React.CSSProperties => ({
    width: 26, height: 26, flexShrink: 0,
    border: `1.5px solid ${active ? '#2563EB' : '#E2E8F0'}`,
    borderRadius: 5, background: active ? '#EFF6FF' : '#fff',
    cursor: 'pointer', color: active ? '#2563EB' : '#374151',
    fontSize: 11.5, display: 'grid', placeItems: 'center', padding: 0,
  })
  const div = <div style={{ width:1, height:16, background:'#E2E8F0', margin:'0 1px', flexShrink:0 }} />

  return (
    <div style={{ border:'1.5px solid #E2E8F0', borderRadius:8, overflow:'hidden', background:'#fff' }}>
      {/* Toolbar */}
      <div style={{ background:'#F8FAFC', borderBottom:'1px solid #E2E8F0', padding:'5px 7px', display:'flex', flexWrap:'wrap', gap:3, alignItems:'center' }}>
        {/* Block format */}
        <select onChange={e => { exec('formatBlock', e.target.value); (e.target as HTMLSelectElement).blur() }}
          style={{ height:26, padding:'0 5px', border:'1.5px solid #E2E8F0', borderRadius:5, fontSize:11.5, background:'#fff', cursor:'pointer', color:'#374151', outline:'none' }}>
          <option value="p">Párrafo</option>
          <option value="h1">H1</option><option value="h2">H2</option>
          <option value="h3">H3</option><option value="h4">H4</option>
        </select>
        {div}
        {/* Bold / Italic / Underline / Strike */}
        {(['bold','italic','underline','strikeThrough'] as const).map((cmd, i) => (
          <button key={cmd} onMouseDown={e => { e.preventDefault(); exec(cmd) }} style={tbBtn()}
            title={['Negrita','Cursiva','Subrayado','Tachado'][i]}>
            <i className={`fa fa-${['bold','italic','underline','strikethrough'][i]}`} />
          </button>
        ))}
        {div}
        {/* Alignment */}
        {(['justifyLeft','justifyCenter','justifyRight'] as const).map((cmd, i) => (
          <button key={cmd} onMouseDown={e => { e.preventDefault(); exec(cmd) }} style={tbBtn()}
            title={['Izquierda','Centro','Derecha'][i]}>
            <i className={`fa fa-align-${['left','center','right'][i]}`} />
          </button>
        ))}
        {div}
        {/* Lists */}
        <button onMouseDown={e => { e.preventDefault(); exec('insertUnorderedList') }} style={tbBtn()} title="Lista">
          <i className="fa fa-list-ul" />
        </button>
        <button onMouseDown={e => { e.preventDefault(); exec('insertOrderedList') }} style={tbBtn()} title="Lista numerada">
          <i className="fa fa-list-ol" />
        </button>
        {div}
        {/* Text color */}
        <div title="Color de texto" style={{ ...tbBtn(), position:'relative', overflow:'hidden' }}>
          <i className="fa fa-font" style={{ fontSize:10, position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', pointerEvents:'none', color:'#374151' }} />
          <input type="color" defaultValue="#000000" onChange={e => exec('foreColor', e.target.value)}
            style={{ position:'absolute', inset:0, opacity:0, cursor:'pointer', width:'100%', height:'100%', border:'none' }} />
        </div>
        {/* Highlight color */}
        <div title="Color de fondo" style={{ ...tbBtn(), position:'relative', overflow:'hidden' }}>
          <i className="fa fa-fill-drip" style={{ fontSize:10, position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', pointerEvents:'none', color:'#374151' }} />
          <input type="color" defaultValue="#FFFF00" onChange={e => exec('hiliteColor', e.target.value)}
            style={{ position:'absolute', inset:0, opacity:0, cursor:'pointer', width:'100%', height:'100%', border:'none' }} />
        </div>
        {/* Remove format */}
        <button onMouseDown={e => { e.preventDefault(); exec('removeFormat') }} style={tbBtn()} title="Limpiar formato">
          <i className="fa fa-eraser" />
        </button>
        {/* Raw HTML toggle */}
        <button onClick={showRaw ? switchToWysiwyg : switchToRaw}
          style={{ ...tbBtn(showRaw), width:'auto', padding:'0 8px', gap:4, marginLeft:'auto', display:'flex', alignItems:'center', fontSize:11 }}>
          <i className={`fa fa-${showRaw ? 'eye' : 'code'}`} style={{ fontSize:10 }} />
          {showRaw ? 'Visual' : 'HTML'}
        </button>
      </div>
      {/* Editor area */}
      {showRaw ? (
        <textarea value={rawHtml} onChange={e => { setRawHtml(e.target.value); onChange(e.target.value) }}
          spellCheck={false}
          style={{ display:'block', width:'100%', minHeight:130, padding:'10px 12px', fontFamily:'var(--f-mono)', fontSize:12, lineHeight:1.5, border:'none', outline:'none', resize:'vertical', color:'#374151', boxSizing:'border-box' }} />
      ) : (
        <div ref={editorRef} contentEditable suppressContentEditableWarning onInput={flush}
          style={{ minHeight:130, padding:'10px 12px', fontSize:13.5, lineHeight:1.65, outline:'none', color:'#0A1530', wordBreak:'break-word' }} />
      )}
    </div>
  )
}

// ─── PropertiesPanel ──────────────────────────────────────────────────────────

function PropertiesPanel({ comp, onChange, onDelete, onColumnCountChange }: {
  comp: FormComp
  onChange: (p: Partial<FormComp>) => void
  onDelete: () => void
  onColumnCountChange?: (n: number) => void
}) {
  const [valTxt, setValTxt] = useState(() => (comp.values ?? []).map(v=>v.label).join('\n'))
  const [surveyRowsTxt, setSurveyRowsTxt] = useState(() => (comp.surveyRows ?? []).map(v=>v.label).join('\n'))
  const [surveyColsTxt, setSurveyColsTxt] = useState(() => (comp.surveyColumns ?? []).map(v=>v.label).join('\n'))
  const prevIdRef = useRef(comp.id)
  useEffect(() => {
    if (comp.id !== prevIdRef.current) {
      prevIdRef.current = comp.id
      setValTxt((comp.values ?? []).map(v=>v.label).join('\n'))
      setSurveyRowsTxt((comp.surveyRows ?? []).map(v=>v.label).join('\n'))
      setSurveyColsTxt((comp.surveyColumns ?? []).map(v=>v.label).join('\n'))
    }
  })
  const updateVals = (txt: string) => {
    setValTxt(txt)
    onChange({ values: txt.split('\n').filter(Boolean).map(l=>({ label:l.trim(), value:toKey(l.trim())||l.trim() })) })
  }
  const pi = (label: string, value: string, onChg: (v:string)=>void, placeholder?: string, type='text') => (
    <div style={{ marginBottom:12 }}>
      <label style={PROP_LABEL}>{label}</label>
      <input type={type} style={PROP_INP} value={value} placeholder={placeholder} onChange={e=>onChg(e.target.value)}
        onFocus={e=>e.target.style.borderColor='#2563EB'} onBlur={e=>e.target.style.borderColor='#E2E8F0'} />
    </div>
  )
  const p = PAL_MAP[comp.type] ?? { icon:'fa-cube', color:'#94A3B8', bg:'#F8FAFC', label: comp.type }
  const noBasic = LAYOUT_TYPES.includes(comp.type)
  const hasVals = ['select','radio'].includes(comp.type)

  const alignBtn = (v: 'left'|'center'|'right', icon: string) => (
    <button key={v} onClick={()=>onChange({textAlign:v})}
      style={{ flex:1, padding:'5px 0', borderRadius:6, border:`1.5px solid ${(comp.textAlign??'left')===v?'#0A2D63':'#E2E8F0'}`, background:(comp.textAlign??'left')===v?'#0A2D63':'#fff', color:(comp.textAlign??'left')===v?'#fff':'#64748B', fontSize:12, cursor:'pointer', transition:'all 100ms' }}>
      <i className={`fa ${icon}`} />
    </button>
  )

  return (
    <div style={{ padding:'14px 16px', overflowY:'auto', height:'100%', background:'#FAFBFC', boxSizing:'border-box' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 10px', borderRadius:20, background:p.bg, color:p.color, fontSize:11.5, fontWeight:700 }}>
          <i className={`fa ${p.icon}`} />{p.label}
        </div>
        <button onClick={onDelete} style={{ marginLeft:'auto', width:28, height:28, border:'1.5px solid #FECACA', borderRadius:7, background:'#FEF2F2', color:'#DC2626', cursor:'pointer', fontSize:11, display:'grid', placeItems:'center' }}>
          <i className="fa fa-trash-alt" />
        </button>
      </div>

      {/* Heading */}
      {comp.type === 'heading' && (
        <>
          <div style={{ fontSize:10, fontWeight:700, color:'#CBD5E1', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Encabezado</div>
          {pi('Texto', comp.label, v=>onChange({label:v,key:toKey(v)}), 'Título...')}
          <div style={{ marginBottom:12 }}>
            <label style={PROP_LABEL}>Nivel</label>
            <div style={{ display:'flex', gap:4 }}>
              {(['h1','h2','h3','h4'] as const).map(l => (
                <button key={l} onClick={()=>onChange({headingLevel:l})}
                  style={{ flex:1, padding:'5px 0', borderRadius:6, border:`1.5px solid ${(comp.headingLevel??'h2')===l?'#0A2D63':'#E2E8F0'}`, background:(comp.headingLevel??'h2')===l?'#0A2D63':'#fff', color:(comp.headingLevel??'h2')===l?'#fff':'#374151', fontSize:11.5, fontWeight:700, cursor:'pointer', transition:'all 100ms' }}>{l.toUpperCase()}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom:12 }}>
            <label style={PROP_LABEL}>Alineación</label>
            <div style={{ display:'flex', gap:4 }}>{alignBtn('left','fa-align-left')}{alignBtn('center','fa-align-center')}{alignBtn('right','fa-align-right')}</div>
          </div>
        </>
      )}

      {/* Image */}
      {comp.type === 'image' && (
        <>
          <div style={{ fontSize:10, fontWeight:700, color:'#CBD5E1', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Imagen</div>
          {pi('URL', comp.imageUrl??'', v=>onChange({imageUrl:v}), 'https://...')}
          {pi('Texto alternativo', comp.imageAlt??'', v=>onChange({imageAlt:v}), 'Descripción...')}
          {pi('Ancho', comp.imageWidth??'100%', v=>onChange({imageWidth:v}), '100%, 50%, 300px...')}
          <div style={{ marginBottom:12 }}>
            <label style={PROP_LABEL}>Alineación</label>
            <div style={{ display:'flex', gap:4 }}>{alignBtn('left','fa-align-left')}{alignBtn('center','fa-align-center')}{alignBtn('right','fa-align-right')}</div>
          </div>
        </>
      )}

      {/* Content HTML — rich text editor */}
      {comp.type === 'content' && (
        <>
          <div style={{ fontSize:10, fontWeight:700, color:'#CBD5E1', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>CONTENIDO</div>
          <div style={{ marginBottom:12 }}>
            <RichTextEditor key={comp.id} value={comp.html??''} onChange={v=>onChange({html:v})} />
          </div>
        </>
      )}

      {/* Divider */}
      {comp.type === 'divider' && (
        <div style={{ padding:'20px 0', textAlign:'center', color:'#94A3B8', fontSize:12 }}>
          <i className="fa fa-minus" style={{ display:'block', fontSize:18, marginBottom:8 }} />Sin propiedades configurables
        </div>
      )}

      {/* Firma de sección */}
      {comp.type === 'firma-seccion' && (
        <>
          <div style={{ fontSize:10, fontWeight:700, color:'#CBD5E1', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Firma de sección</div>
          {pi('Etiqueta', comp.label, v => onChange({ label: v, key: toKey(v) }), 'Ej: Revisión de condiciones...')}
          <div style={{ marginBottom:12 }}>
            <label style={PROP_LABEL}>Estrategia de firma</label>
            <select style={{ ...PROP_INP, borderColor: comp.idEstrategiaFirma ? '#7C3AED' : '#E2E8F0' }}
              value={comp.idEstrategiaFirma ?? ''}
              onChange={e => onChange({ idEstrategiaFirma: e.target.value ? Number(e.target.value) : undefined })}
              onFocus={e => e.target.style.borderColor = '#7C3AED'}
              onBlur={e => e.target.style.borderColor = comp.idEstrategiaFirma ? '#7C3AED' : '#E2E8F0'}>
              <option value="">— Sin estrategia —</option>
              {mockEstrategiasFirma.filter(e => e.activo).map(ef => (
                <option key={ef.id} value={ef.id}>{ef.codigo} — {ef.descripcion}</option>
              ))}
            </select>
          </div>
        </>
      )}

      {/* Hidden */}
      {comp.type === 'hidden' && (
        <>
          <div style={{ fontSize:10, fontWeight:700, color:'#CBD5E1', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Campo oculto</div>
          {pi('Propiedad (key)', comp.key, v=>onChange({key:v}), 'clave_oculta')}
        </>
      )}

      {/* Standard fields */}
      {!noBasic && !['hidden','button','divider'].includes(comp.type) && comp.type !== 'panel' && (
        <>
          <div style={{ fontSize:10, fontWeight:700, color:'#CBD5E1', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>General</div>
          {pi('Etiqueta', comp.label, v=>onChange({label:v,key:toKey(v)}))}
          {pi('Propiedad (key)', comp.key, v=>onChange({key:v}), 'auto_generado')}
          {!['checkbox','radio','survey','image','datetime','day','time'].includes(comp.type) && pi('Marcador', comp.placeholder??'', v=>onChange({placeholder:v}), 'Texto de ayuda...')}
          {pi('Descripción', comp.description??'', v=>onChange({description:v}), 'Descripción opcional...')}
          {comp.type === 'textarea' && pi('Filas', String(comp.rows??3), v=>onChange({rows:parseInt(v)||3}), '3', 'number')}
          {comp.type === 'number' && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <div style={{ marginBottom:12 }}>
                <label style={PROP_LABEL}>Mínimo</label>
                <input type="number" style={PROP_INP} value={comp.minVal??''} onChange={e=>onChange({minVal:e.target.value===''?undefined:Number(e.target.value)})}
                  onFocus={e=>e.target.style.borderColor='#2563EB'} onBlur={e=>e.target.style.borderColor='#E2E8F0'} />
              </div>
              <div style={{ marginBottom:12 }}>
                <label style={PROP_LABEL}>Máximo</label>
                <input type="number" style={PROP_INP} value={comp.maxVal??''} onChange={e=>onChange({maxVal:e.target.value===''?undefined:Number(e.target.value)})}
                  onFocus={e=>e.target.style.borderColor='#2563EB'} onBlur={e=>e.target.style.borderColor='#E2E8F0'} />
              </div>
            </div>
          )}

          {/* OP Mapping — only for input fields, not layout/firma/content types */}
          {!['firma-seccion','columns','content','heading','image','divider','checkbox','radio','survey','button'].includes(comp.type) && (
            <div style={{ marginTop:8 }}>
              <div style={SEC_TITLE}>Pre-llenado desde Orden de Proceso</div>
              <label style={PROP_LABEL}>Llenar automáticamente con</label>
              <select
                style={{ ...PROP_INP, borderColor: comp.opMapping ? '#2563EB' : '#E2E8F0',
                  color: comp.opMapping ? '#1E40AF' : '#374151' }}
                value={comp.opMapping ?? ''}
                onChange={e => onChange({ opMapping: e.target.value || undefined })}
                onFocus={e => e.target.style.borderColor = '#2563EB'}
                onBlur={e => { e.target.style.borderColor = comp.opMapping ? '#2563EB' : '#E2E8F0' }}>
                <option value="">— Sin mapeo (manual) —</option>
                {OP_MAPPING_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {comp.opMapping && (
                <div style={{ marginTop:7, fontSize:11.5, color:'#1D4ED8', background:'#EFF6FF',
                  border:'1px solid #BFDBFE', borderRadius:7, padding:'7px 10px',
                  display:'flex', alignItems:'center', gap:7 }}>
                  <i className="fa fa-link" style={{ fontSize:12 }} />
                  <span>
                    Este campo se pre-llenará con <strong>
                      {OP_MAPPING_OPTIONS.find(o => o.value === comp.opMapping)?.label}
                    </strong> cuando se abra el Batch Record desde una Orden de Proceso.
                  </span>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {comp.type === 'panel' && (
        <>
          <div style={{ fontSize:10, fontWeight:700, color:'#CBD5E1', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Panel</div>
          {pi('Etiqueta', comp.label, v=>onChange({label:v,key:toKey(v)}))}
          {pi('Título', comp.title??'', v=>onChange({title:v}))}
        </>
      )}

      {comp.type === 'columns' && (
        <>
          <div style={{ fontSize:10, fontWeight:700, color:'#CBD5E1', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Columnas</div>
          <div style={{ marginBottom:14 }}>
            <label style={PROP_LABEL}>Número de columnas</label>
            <div style={{ display:'flex', gap:6 }}>
              {[2, 3, 4].map(n => (
                <button key={n} onClick={() => onColumnCountChange?.(n)}
                  style={{ flex:1, padding:'6px 0', borderRadius:6, border:`1.5px solid ${(comp.columnCount??2)===n?'#2563EB':'#E2E8F0'}`, background:(comp.columnCount??2)===n?'#EFF6FF':'#fff', color:(comp.columnCount??2)===n?'#2563EB':'#374151', cursor:'pointer', fontSize:12.5, fontWeight:(comp.columnCount??2)===n?700:400, transition:'all 100ms' }}>
                  {n} col.
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {hasVals && (
        <div style={{ marginBottom:12 }}>
          <label style={PROP_LABEL}>Opciones (una por línea)</label>
          <textarea style={{ ...PROP_INP, resize:'vertical', minHeight:80, fontFamily:'var(--f-mono)', fontSize:12.5 }}
            value={valTxt} onChange={e=>updateVals(e.target.value)}
            placeholder={'Opción 1\nOpción 2'} onFocus={e=>e.target.style.borderColor='#2563EB'} onBlur={e=>e.target.style.borderColor='#E2E8F0'} />
        </div>
      )}

      {/* Radio: inline toggle */}
      {comp.type === 'radio' && (
        <div style={{ marginBottom:12 }}>
          <label style={PROP_LABEL}>Disposición</label>
          <div style={{ display:'flex', gap:6 }}>
            {([{ v: false, icon: 'fa-list', label: 'Vertical' }, { v: true, icon: 'fa-grip-horizontal', label: 'Horizontal' }] as { v: boolean; icon: string; label: string }[]).map(opt => (
              <button key={String(opt.v)} onClick={() => onChange({ inline: opt.v })}
                style={{ flex:1, padding:'5px 0', borderRadius:6, border:`1.5px solid ${(comp.inline??false)===opt.v?'#D97706':'#E2E8F0'}`, background:(comp.inline??false)===opt.v?'#FFFBEB':'#fff', color:(comp.inline??false)===opt.v?'#D97706':'#64748B', fontSize:11.5, fontWeight:(comp.inline??false)===opt.v?700:400, cursor:'pointer', transition:'all 100ms', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                <i className={`fa ${opt.icon}`} />{opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Survey: rows and columns */}
      {comp.type === 'survey' && (
        <>
          <div style={SEC_TITLE}>Preguntas y Opciones</div>
          <div style={{ marginBottom:12 }}>
            <label style={PROP_LABEL}>Preguntas (una por línea)</label>
            <textarea style={{ ...PROP_INP, resize:'vertical', minHeight:80, fontFamily:'var(--f-mono)', fontSize:12.5 }}
              value={surveyRowsTxt}
              onChange={e => {
                setSurveyRowsTxt(e.target.value)
                onChange({ surveyRows: e.target.value.split('\n').filter(Boolean).map(l => ({ label: l.trim(), value: toKey(l.trim()) || l.trim() })) })
              }}
              placeholder={'¿Cómo evalúa la limpieza?\n¿El operario usa EPP?\n¿Se verificó temperatura?'}
              onFocus={e=>e.target.style.borderColor='#0891B2'} onBlur={e=>e.target.style.borderColor='#E2E8F0'} />
          </div>
          <div style={{ marginBottom:12 }}>
            <label style={PROP_LABEL}>Opciones de respuesta (una por línea)</label>
            <textarea style={{ ...PROP_INP, resize:'vertical', minHeight:60, fontFamily:'var(--f-mono)', fontSize:12.5 }}
              value={surveyColsTxt}
              onChange={e => {
                setSurveyColsTxt(e.target.value)
                onChange({ surveyColumns: e.target.value.split('\n').filter(Boolean).map(l => ({ label: l.trim(), value: toKey(l.trim()) || l.trim() })) })
              }}
              placeholder={'Conforme\nNo conforme\nN/A'}
              onFocus={e=>e.target.style.borderColor='#0891B2'} onBlur={e=>e.target.style.borderColor='#E2E8F0'} />
          </div>
        </>
      )}

      {comp.type === 'button' && (
        <>
          <div style={{ fontSize:10, fontWeight:700, color:'#CBD5E1', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Botón</div>
          {pi('Etiqueta', comp.label, v=>onChange({label:v,key:toKey(v)}))}
          <div style={{ marginBottom:12 }}>
            <label style={PROP_LABEL}>Acción</label>
            <select style={PROP_INP} value={comp.action??'submit'} onChange={e=>onChange({action:e.target.value as 'submit'|'reset'|'custom'})}>
              <option value="submit">Enviar formulario</option>
              <option value="reset">Limpiar campos</option>
              <option value="custom">Código personalizado</option>
            </select>
          </div>
          <div style={{ marginBottom:12 }}>
            <label style={PROP_LABEL}>Estilo</label>
            <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
              {Object.entries(BTN_COLORS).map(([k,col])=>(
                <button key={k} onClick={()=>onChange({theme:k})}
                  style={{ padding:'4px 10px', borderRadius:6, border:`2px solid ${(comp.theme??'primary')===k?col:'#E2E8F0'}`, background:(comp.theme??'primary')===k?col:'#fff', color:(comp.theme??'primary')===k?'#fff':col, fontSize:11, fontWeight:700, cursor:'pointer', transition:'all 100ms' }}>{k}</button>
              ))}
            </div>
          </div>
          {(comp.action === 'custom' || comp.custom) && (
            <div style={{ marginBottom:12 }}>
              <label style={PROP_LABEL}>Código JavaScript</label>
              <textarea style={{ ...PROP_INP, fontFamily:'var(--f-mono)', fontSize:11.5, minHeight:100, resize:'vertical', lineHeight:1.5 }}
                value={comp.custom??''} onChange={e=>onChange({custom:e.target.value})}
                placeholder="// Tu código aquí..." onFocus={e=>e.target.style.borderColor='#2563EB'} onBlur={e=>e.target.style.borderColor='#E2E8F0'} />
            </div>
          )}
        </>
      )}

      {/* Validation */}
      {!['panel','columns','content','button','heading','image','divider','hidden'].includes(comp.type) && (
        <>
          <div style={SEC_TITLE}>Validación</div>
          {[
            { chk:comp.required??false, label:'Campo requerido', key:'required' },
            ...(!['checkbox','radio','select','datetime','day','time','survey','datagrid'].includes(comp.type)
              ? [{ chk:comp.multiple??false, label:'Valores múltiples', key:'multiple' }]
              : []),
          ].map(row=>(
            <label key={row.key} style={{ display:'flex', alignItems:'center', gap:9, cursor:'pointer', marginBottom:9 }}>
              <input type="checkbox" checked={row.chk} onChange={e=>onChange({[row.key]:e.target.checked})} style={{ accentColor:'#2563EB', width:15, height:15 }} />
              <span style={{ fontSize:13, color:'#374151', fontWeight:500 }}>{row.label}</span>
            </label>
          ))}
        </>
      )}

      {comp.type === 'panel' && (
        <label style={{ display:'flex', alignItems:'center', gap:9, cursor:'pointer', marginTop:8 }}>
          <input type="checkbox" checked={comp.collapsible??false} onChange={e=>onChange({collapsible:e.target.checked})} style={{ accentColor:'#2563EB', width:15, height:15 }} />
          <span style={{ fontSize:13, color:'#374151', fontWeight:500 }}>Colapsable</span>
        </label>
      )}

      {/* General options — skip for types that don't need hideLabel */}
      {!['image','divider','heading','columns','button'].includes(comp.type) && (
        <>
          <div style={SEC_TITLE}>Opciones</div>
          <label style={{ display:'flex', alignItems:'center', gap:9, cursor:'pointer', marginBottom:9 }}>
            <input type="checkbox" checked={comp.hideLabel??false} onChange={e=>onChange({hideLabel:e.target.checked})} style={{ accentColor:'#2563EB', width:15, height:15 }} />
            <span style={{ fontSize:13, color:'#374151', fontWeight:500 }}>Ocultar etiqueta</span>
          </label>
        </>
      )}

      {/* Raw props indicator */}
      {comp._raw && Object.keys(comp._raw).length > 0 && (
        <div style={{ marginTop:10, padding:'6px 10px', background:'#F0F9FF', border:'1px solid #BAE6FD', borderRadius:6, fontSize:11, color:'#0369A1' }}>
          <i className="fa fa-shield-alt" style={{ marginRight:5 }} />
          Propiedades avanzadas preservadas ({Object.keys(comp._raw).length} campos)
        </div>
      )}
    </div>
  )
}

// ─── JsonTab ──────────────────────────────────────────────────────────────────

function JsonTab({ comps, onApply }: { comps: FormComp[]; onApply: (cs: FormComp[]) => void }) {
  const [json, setJson] = useState(() => toFormio(comps))
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [formatted, setFormatted] = useState(true)

  const handleApply = () => {
    try {
      const parsed = fromFormio(json)
      if (parsed.length === 0) { setError('JSON sin componentes válidos'); return }
      onApply(parsed)
    } catch { setError('JSON inválido — verifica la sintaxis') }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(json).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  const toggleFormat = () => {
    try {
      if (formatted) {
        setJson(j => JSON.stringify(JSON.parse(j)))
        setFormatted(false)
      } else {
        setJson(j => JSON.stringify(JSON.parse(j), null, 2))
        setFormatted(true)
      }
    } catch {}
  }

  const lineCount = json.split('\n').length

  return (
    <div style={{ padding:24, background:'#F4F6FA', flex:1, display:'flex', flexDirection:'column', minHeight:480 }}>
      <div style={{ maxWidth:860, margin:'0 auto', flex:1, display:'flex', flexDirection:'column', gap:12, width:'100%' }}>

        {/* Toolbar */}
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:7 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:'#4ADE80' }} />
            <span style={{ fontSize:13, fontWeight:600, color:'#374151' }}>form.io JSON</span>
            <span style={{ fontSize:11.5, color:'#94A3B8', fontFamily:'var(--f-mono)' }}>{lineCount} líneas</span>
          </div>
          <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
            <button onClick={toggleFormat}
              style={{ padding:'5px 10px', borderRadius:6, border:'1.5px solid #E2E8F0', background:'#fff', cursor:'pointer', fontSize:11.5, color:'#64748B', display:'flex', alignItems:'center', gap:5 }}>
              <i className="fa fa-indent" />{formatted ? 'Compactar' : 'Formatear'}
            </button>
            <button onClick={handleCopy}
              style={{ padding:'5px 12px', borderRadius:6, border:'1.5px solid #E2E8F0', background:'#fff', cursor:'pointer', fontSize:11.5, color: copied ? '#16A34A' : '#374151', display:'flex', alignItems:'center', gap:5, transition:'color 200ms' }}>
              <i className={`fa fa-${copied?'check':'copy'}`} />{copied ? 'Copiado' : 'Copiar'}
            </button>
            <button onClick={handleApply}
              style={{ padding:'5px 14px', borderRadius:6, border:'1.5px solid #0A2D63', background:'#0A2D63', cursor:'pointer', fontSize:11.5, color:'#fff', display:'flex', alignItems:'center', gap:5 }}>
              <i className="fa fa-check" /> Aplicar al diseñador
            </button>
          </div>
        </div>

        {error && (
          <div style={{ padding:'8px 12px', background:'#FEF2F2', border:'1.5px solid #FECACA', borderRadius:8, fontSize:12, color:'#DC2626', display:'flex', alignItems:'center', gap:8 }}>
            <i className="fa fa-exclamation-circle" />{error}
            <button onClick={()=>setError('')} style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color:'#DC2626', fontSize:14, lineHeight:1 }}>×</button>
          </div>
        )}

        {/* Editor */}
        <div style={{ flex:1, position:'relative', minHeight:440 }}>
          {/* Line numbers */}
          <div style={{ position:'absolute', left:0, top:0, bottom:0, width:44, background:'#F1F5F9', borderRadius:'10px 0 0 10px', border:'1.5px solid #E2E8F0', borderRight:'none', overflowY:'hidden', padding:'14px 0', display:'flex', flexDirection:'column', alignItems:'flex-end', paddingRight:8, boxSizing:'border-box', userSelect:'none', pointerEvents:'none' }}>
            {Array.from({ length: lineCount }, (_, i) => (
              <div key={i} style={{ fontSize:11, lineHeight:'1.6', color:'#94A3B8', fontFamily:'var(--f-mono)', whiteSpace:'nowrap' }}>{i+1}</div>
            ))}
          </div>
          <textarea
            value={json}
            onChange={e=>{setJson(e.target.value);setError('')}}
            spellCheck={false}
            style={{ width:'100%', height:'100%', minHeight:440, fontFamily:'var(--f-mono)', fontSize:12.5, lineHeight:1.6, padding:'14px 16px 14px 52px', border:'1.5px solid #E2E8F0', borderRadius:10, background:'#fff', outline:'none', resize:'vertical', color:'#1E293B', boxSizing:'border-box', boxShadow:'0 2px 8px rgba(0,0,0,.04)' }}
            onFocus={e=>e.target.style.borderColor='#0A2D63'}
            onBlur={e=>e.target.style.borderColor='#E2E8F0'}
          />
        </div>

        <div style={{ fontSize:11.5, color:'#94A3B8', textAlign:'center' }}>
          Edita el JSON directamente y pulsa <strong>"Aplicar al diseñador"</strong> para actualizar el formulario
        </div>
      </div>
    </div>
  )
}

// ─── ImportJsonModal ──────────────────────────────────────────────────────────

function ImportJsonModal({ onClose, onImport }: {
  onClose: () => void
  onImport: (comps: FormComp[], mode: 'replace'|'append') => void
}) {
  const [json, setJson] = useState('')
  const [mode, setMode] = useState<'replace'|'append'>('replace')
  const [error, setError] = useState('')

  const handle = () => {
    const txt = json.trim()
    if (!txt) { setError('Pega un JSON válido de form.io'); return }
    const parsed = fromFormio(txt)
    if (parsed.length === 0) { setError('El JSON no contiene componentes válidos'); return }
    onImport(parsed, mode)
  }

  return createPortal(
    <div style={{ position:'fixed', inset:0, zIndex:1100, background:'rgba(10,21,48,.5)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }} onClick={onClose}>
      <div style={{ background:'var(--paper)', borderRadius:'var(--r-xl)', boxShadow:'var(--sh-3)', width:'100%', maxWidth:580 }} onClick={e=>e.stopPropagation()}>
        <div style={{ background:'var(--navy)', borderRadius:'var(--r-xl) var(--r-xl) 0 0', padding:'16px 22px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:'rgba(255,255,255,.12)', display:'grid', placeItems:'center' }}>
              <i className="fa fa-file-import" style={{ color:'var(--yellow)', fontSize:14 }} />
            </div>
            <div>
              <div style={{ color:'#fff', fontWeight:700, fontSize:14 }}>Importar JSON de form.io</div>
              <div style={{ color:'#8FA5C9', fontSize:11 }}>Soporta componentes anidados, lógica, y propiedades avanzadas</div>
            </div>
          </div>
          <button style={{ background:'rgba(255,255,255,.1)', border:'none', cursor:'pointer', color:'#fff', width:28, height:28, borderRadius:7, fontSize:16, display:'grid', placeItems:'center' }} onClick={onClose}>×</button>
        </div>
        <div style={{ padding:'20px 22px' }}>
          <div style={{ marginBottom:12 }}>
            <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>JSON del formulario</label>
            <textarea style={{ ...PROP_INP, fontFamily:'var(--f-mono)', fontSize:12, minHeight:200, resize:'vertical', lineHeight:1.5, borderColor:error?'#DC2626':'#E2E8F0' }}
              value={json} onChange={e=>{setJson(e.target.value);setError('')}}
              placeholder={'{\n  "components": [...]\n}'}
              onFocus={e=>e.target.style.borderColor='#2563EB'} onBlur={e=>e.target.style.borderColor=error?'#DC2626':'#E2E8F0'} />
            {error && <div style={{ fontSize:11.5, color:'#DC2626', marginTop:4 }}>{error}</div>}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            {(['replace','append'] as const).map(m=>(
              <label key={m} style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', flex:1, padding:'8px 14px', borderRadius:8, border:`1.5px solid ${mode===m?'var(--navy)':'#E2E8F0'}`, background:mode===m?'rgba(10,45,99,.06)':'#fff', transition:'all 120ms' }}>
                <input type="radio" checked={mode===m} onChange={()=>setMode(m)} style={{ accentColor:'var(--navy)' }} />
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:mode===m?'var(--navy)':'#374151' }}>{m==='replace'?'Reemplazar':'Agregar al final'}</div>
                  <div style={{ fontSize:11, color:'#94A3B8' }}>{m==='replace'?'Borra los campos actuales':'Mantiene los existentes'}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
        <div style={{ padding:'14px 22px', borderTop:'1px solid var(--hair)', display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button className="btn btn-gray" onClick={onClose}><i className="fa fa-undo" /> Cancelar</button>
          <button className="btn btn-primary" onClick={handle}><i className="fa fa-file-import" /> Importar</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ─── PreviewFirmaModal ────────────────────────────────────────────────────────

function validateFirmaCredentials(loginInput: string, pwd: string, grupoRequerido: string): string | null {
  const u = mockUsuarios.find(x => x.login === loginInput.trim() || x.email === loginInput.trim())
  if (!u)        return 'Usuario no encontrado'
  if (!u.activo) return 'Usuario inactivo'
  if (u.bloqueado) return 'Usuario bloqueado'
  if (pwd !== 'bacord2025') return 'Contraseña incorrecta'
  if (u.esAdministrador !== 1) {
    const grupos = u.grupos.split(',').map(g => g.trim()).filter(Boolean)
    if (!grupos.includes(grupoRequerido))
      return `"${u.nombres} ${u.apellidos}" no pertenece al grupo "${grupoRequerido}"`
  }
  return null
}

function PreviewFirmaModal({ firma, onConfirm, onClose }: {
  firma: { firmaKey: string; texto: string; grupo: string }
  onConfirm: () => void
  onClose: () => void
}) {
  const [login, setLogin] = useState('')
  const [pwd,   setPwd]   = useState('')
  const [show,  setShow]  = useState(false)
  const [err,   setErr]   = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const msg = validateFirmaCredentials(login, pwd, firma.grupo)
    if (msg) { setErr(msg); return }
    onConfirm()
  }

  const INP_S: React.CSSProperties = { width:'100%', padding:'8px 11px', border:'1.5px solid var(--hair-2)', borderRadius:'var(--r-sm)', fontSize:13, color:'var(--ink)', fontFamily:'var(--f-sans)', outline:'none', boxSizing:'border-box' }

  return createPortal(
    <div style={{ position:'fixed', inset:0, zIndex:1200, background:'rgba(10,21,48,.55)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }} onClick={onClose}>
      <div style={{ background:'var(--paper)', borderRadius:'var(--r-xl)', boxShadow:'var(--sh-3)', width:'100%', maxWidth:400 }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ background:'var(--navy)', borderRadius:'var(--r-xl) var(--r-xl) 0 0', padding:'14px 20px', display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:9, background:'rgba(255,255,255,.12)', display:'grid', placeItems:'center', flexShrink:0 }}>
            <i className="fa fa-pen-square" style={{ color:'var(--yellow)', fontSize:14 }} />
          </div>
          <div style={{ flex:1 }}>
            <div style={{ color:'#fff', fontWeight:700, fontSize:14 }}>Firma Electrónica</div>
            <div style={{ color:'#8FA5C9', fontSize:11 }}>Vista previa — validación real de credenciales</div>
          </div>
          <button style={{ background:'rgba(255,255,255,.1)', border:'none', cursor:'pointer', color:'#fff', width:28, height:28, borderRadius:7, fontSize:16, display:'grid', placeItems:'center' }} onClick={onClose}>×</button>
        </div>

        {/* Firma info */}
        <div style={{ padding:'12px 20px', background:'var(--paper-2)', borderBottom:'1px solid var(--hair)', display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:600, color:'var(--ink-2)', marginBottom:3 }}>{firma.texto}</div>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <i className="fa fa-users" style={{ color:'var(--navy)', fontSize:11 }} />
              <span style={{ fontSize:11.5, color:'var(--ink-3)' }}>Grupo requerido:</span>
              <span style={{ fontSize:11.5, fontWeight:700, padding:'1px 9px', borderRadius:20, background:'var(--navy)', color:'#fff' }}>{firma.grupo}</span>
            </div>
          </div>
        </div>

        <form onSubmit={submit}>
          <div style={{ padding:'18px 20px', display:'flex', flexDirection:'column', gap:12 }}>
            <div>
              <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--ink-2)', marginBottom:5 }}>
                Usuario <span style={{ color:'var(--orange)' }}>*</span>
              </label>
              <input style={INP_S} value={login} autoFocus placeholder="login o correo electrónico"
                onChange={e => { setLogin(e.target.value); setErr('') }} />
            </div>
            <div>
              <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--ink-2)', marginBottom:5 }}>
                Contraseña <span style={{ color:'var(--orange)' }}>*</span>
              </label>
              <div style={{ position:'relative' }}>
                <input type={show ? 'text' : 'password'} style={{ ...INP_S, paddingRight:36 }} value={pwd}
                  placeholder="••••••••" onChange={e => { setPwd(e.target.value); setErr('') }} />
                <button type="button" onClick={() => setShow(s => !s)}
                  style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--ink-4)', fontSize:13 }}>
                  <i className={`fa fa-${show ? 'eye-slash' : 'eye'}`} />
                </button>
              </div>
            </div>
            {err && (
              <div style={{ padding:'8px 12px', background:'#fef2f2', border:'1.5px solid #fecaca', borderRadius:'var(--r-sm)', fontSize:12.5, color:'#b91c1c', display:'flex', alignItems:'center', gap:7 }}>
                <i className="fa fa-exclamation-circle" />{err}
              </div>
            )}
          </div>
          <div style={{ padding:'12px 20px', borderTop:'1px solid var(--hair)', display:'flex', justifyContent:'flex-end', gap:8 }}>
            <button type="button" className="btn btn-gray" onClick={onClose}><i className="fa fa-undo" /> Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={!login || !pwd}><i className="fa fa-pen" /> Firmar</button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}

// ─── FormularioPanel ──────────────────────────────────────────────────────────

function FormularioPanel({ detalle, onClose, onSave }: {
  detalle: Detalle; onClose: () => void
  onSave: (jsonSchema: string, jsonData: string, jsonOptions: string) => void
}) {
  const [comps, setComps]       = useState<FormComp[]>(() => loadComps(detalle))
  const [selected, setSelected] = useState<string | null>(null)
  const [tab, setTab]           = useState<'builder'|'preview'|'json'>('builder')
  const [search, setSearch]     = useState('')
  const [hovered, setHovered]   = useState<string | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const [showImport, setShowImport]   = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [renderH, setRenderH]   = useState(480)
  const [firmadosPreview, setFirmadosPreview] = useState<Record<string, boolean>>({})
  const [savedToast, setSavedToast] = useState(false)
  const [firmaPreview, setFirmaPreview] = useState<{ firmaKey: string; texto: string; grupo: string } | null>(null)
  const [undoDelete, setUndoDelete] = useState<{ comp: FormComp; idx: number; label: string } | null>(null)
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const renderRef  = useRef<HTMLIFrameElement>(null)
  const dragSrcRef = useRef<{ from:'palette'; type: CompType } | { from:'canvas'; id: string } | null>(null)
  const compsRef   = useRef(comps)
  compsRef.current = comps

  const selComp = selected ? findComp(comps, selected) : undefined

  useEffect(() => {
    const handler = (ev: MessageEvent) => {
      if (ev.data?.type === 'HEIGTH') {
        const h = parseInt(ev.data.value); if (!isNaN(h) && h > 80) setRenderH(h + 32)
      }
      if (ev.data?.type === 'FIRMA_PREVIEW') {
        setFirmaPreview({ firmaKey: ev.data.firmaKey, texto: ev.data.texto, grupo: ev.data.grupo })
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  const sendToPreview = (f?: Record<string, boolean>) => {
    const next = f ?? firmadosPreview
    renderRef.current?.contentWindow?.postMessage({ type: 'RENDER_JSON', value: toFormio(compsRef.current, next) }, '*')
  }

  const switchPreview = () => {
    setTab('preview')
    setTimeout(() => sendToPreview(), 200)
  }

  const confirmFirmaPreview = () => {
    if (!firmaPreview) return
    const next = { ...firmadosPreview, [firmaPreview.firmaKey]: true }
    setFirmadosPreview(next)
    setFirmaPreview(null)
    setTimeout(() => sendToPreview(next), 50)
  }

  const makeComp = (type: CompType): FormComp => {
    const p = PAL_MAP[type]
    const n = comps.filter(c=>c.type===type).length
    const label = n ? `${p.label} ${n+1}` : p.label
    const defs: Partial<FormComp> = {}
    if (type==='radio'||type==='select') defs.values=[{label:'Opción 1',value:'opcion1'},{label:'Opción 2',value:'opcion2'}]
    if (type==='button')  { defs.action='submit'; defs.theme='primary' }
    if (type==='textarea') defs.rows=3
    if (type==='heading') { defs.headingLevel='h2'; defs.textAlign='left' }
    if (type==='image')   { defs.imageWidth='100%'; defs.textAlign='left' }
    if (type==='content') defs.html='<p>Escribe tu contenido aquí</p>'
    if (CONTAINER_TYPES.includes(type)) defs.components=[]
    if (type === 'columns') defs.columnCount = 2
    return { id:uid(), type, key:toKey(label), label, ...defs }
  }

  const addComp = (type: CompType, atIdx?: number) => {
    const nc = makeComp(type)
    setComps(cs => {
      if (atIdx !== undefined) { const a=[...cs]; a.splice(atIdx,0,nc); return a }
      return [...cs, nc]
    })
    setSelected(nc.id)
  }

  const addToContainer = (parentId: string, type: CompType) => {
    const nc = makeComp(type)
    setComps(cs => addToParent(cs, parentId, nc))
    setSelected(nc.id)
    setExpandedIds(s => new Set([...s, parentId]))
  }

  const addToColumnContainer = (parentId: string, type: CompType, colIdx: number) => {
    const nc = { ...makeComp(type), _colIdx: colIdx }
    setComps(cs => addToParent(cs, parentId, nc))
    setSelected(nc.id)
    setExpandedIds(s => new Set([...s, parentId]))
  }

  const moveChildToCol = (childId: string, colIdx: number) => {
    setComps(cs => updateTree(cs, childId, { _colIdx: colIdx }))
  }

  const reorderInPanel = (parentId: string, childId: string, dir: 'up' | 'down') => {
    setComps(cs => {
      const patch = (comps: FormComp[]): FormComp[] => comps.map(c => {
        if (c.id === parentId) {
          const children = [...(c.components ?? [])]
          const idx = children.findIndex(ch => ch.id === childId)
          if (idx < 0 || (dir === 'up' && idx === 0) || (dir === 'down' && idx === children.length - 1)) return c
          const swapIdx = dir === 'up' ? idx - 1 : idx + 1
          ;[children[idx], children[swapIdx]] = [children[swapIdx], children[idx]]
          return { ...c, components: children }
        }
        if (c.components) return { ...c, components: patch(c.components) }
        return c
      })
      return patch(cs)
    })
  }

  const reorderInColumn = (parentId: string, childId: string, dir: 'up' | 'down', colIdx: number) => {
    setComps(cs => {
      const patch = (comps: FormComp[]): FormComp[] => comps.map(c => {
        if (c.id === parentId) {
          const colChildren = (c.components ?? []).filter(ch => Math.min(ch._colIdx ?? 0, (c.columnCount ?? 2) - 1) === colIdx)
          const idx = colChildren.findIndex(ch => ch.id === childId)
          if (idx < 0 || (dir === 'up' && idx === 0) || (dir === 'down' && idx === colChildren.length - 1)) return c
          const swapId = colChildren[dir === 'up' ? idx - 1 : idx + 1].id
          const flat = [...(c.components ?? [])]
          const aIdx = flat.findIndex(ch => ch.id === childId)
          const bIdx = flat.findIndex(ch => ch.id === swapId)
          ;[flat[aIdx], flat[bIdx]] = [flat[bIdx], flat[aIdx]]
          return { ...c, components: flat }
        }
        if (c.components) return { ...c, components: patch(c.components) }
        return c
      })
      return patch(cs)
    })
  }

  const changeColumnsCount = (compId: string, n: number) => {
    setComps(cs => {
      const patch = (comps: FormComp[]): FormComp[] => comps.map(c => {
        if (c.id === compId) return {
          ...c, columnCount: n,
          components: (c.components ?? []).map(ch => ({ ...ch, _colIdx: Math.min(ch._colIdx ?? 0, n - 1) }))
        }
        if (c.components) return { ...c, components: patch(c.components) }
        return c
      })
      return patch(cs)
    })
  }

  const removeComp = (id: string) => {
    setComps(cs => {
      const idx = cs.findIndex(c => c.id === id)
      const comp = idx >= 0 ? cs[idx] : undefined
      if (comp) {
        if (undoTimer.current) clearTimeout(undoTimer.current)
        const label = comp.label || PAL_MAP[comp.type]?.label || comp.type
        setUndoDelete({ comp, idx, label })
        undoTimer.current = setTimeout(() => setUndoDelete(null), 4000)
      }
      return removeFromTree(cs, id)
    })
    if (selected === id) setSelected(null)
  }
  const handleUndoDelete = () => {
    if (!undoDelete) return
    if (undoTimer.current) { clearTimeout(undoTimer.current); undoTimer.current = null }
    setComps(cs => {
      const a = [...cs]
      a.splice(Math.min(undoDelete.idx, cs.length), 0, undoDelete.comp)
      return a
    })
    setUndoDelete(null)
  }
  const removeChild = (parentId: string, childId: string) => { setComps(cs => removeFromParent(cs, parentId, childId)); if (selected===childId) setSelected(null) }

  const dupComp = (id: string) => {
    const c = comps.find(x=>x.id===id); if (!c) return
    const i = comps.indexOf(c)
    const nc: FormComp = { ...c, id:uid(), key:c.key+'_copia', label:c.label+' (copia)' }
    setComps(cs => { const a=[...cs]; a.splice(i+1,0,nc); return a })
    setSelected(nc.id)
  }
  const updComp = (id: string, patch: Partial<FormComp>) => setComps(cs => updateTree(cs, id, patch))

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedIds(s => { const n=new Set(s); n.has(id)?n.delete(id):n.add(id); return n })
  }

  const onPalDragStart  = (type: CompType) => { dragSrcRef.current = { from:'palette', type } }
  const onItemDragStart = (id: string) => { dragSrcRef.current = { from:'canvas', id } }
  const onItemDragOver  = (e: React.DragEvent, idx: number) => { e.preventDefault(); setDragOverIdx(idx) }
  const onItemDrop      = (e: React.DragEvent, idx: number) => {
    e.preventDefault(); setDragOverIdx(null)
    const src = dragSrcRef.current; if (!src) return
    if (src.from==='palette') { addComp(src.type, idx) }
    else {
      setComps(cs => {
        const from = cs.findIndex(c=>c.id===src.id); if (from<0) return cs
        const a=[...cs]; const [item]=a.splice(from,1)
        a.splice(idx>from?idx-1:idx,0,item); return a
      })
    }
    dragSrcRef.current = null
  }
  const onCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOverIdx(null)
    const src = dragSrcRef.current; if (!src) return
    if (src.from==='palette') addComp(src.type)
    dragSrcRef.current = null
  }

  const handleImport = (parsed: FormComp[], mode: 'replace'|'append') => {
    if (mode==='replace') { setComps(parsed); setSelected(null) }
    else setComps(cs=>[...cs,...parsed])
    // Auto-expand top-level containers
    const containers = parsed.filter(c => CONTAINER_TYPES.includes(c.type) && c.components?.length)
    setExpandedIds(new Set(containers.map(c=>c.id)))
    setShowImport(false); setTab('builder')
  }

  const filtered = PAL.filter(p => !search || p.label.toLowerCase().includes(search.toLowerCase()))
  const cats = ['Campos','Diseño','Firmas'].map(cat => ({ cat, items: filtered.filter(p=>p.cat===cat) }))

  const tabSt = (active: boolean): React.CSSProperties => ({
    padding:'5px 14px', borderRadius:6, border:'none', cursor:'pointer',
    fontFamily:'var(--f-sans)', fontSize:12.5, fontWeight:600, transition:'all 120ms',
    background: active ? 'rgba(255,255,255,.18)' : 'transparent',
    color: active ? '#fff' : 'rgba(255,255,255,.45)',
  })

  // Count total components including nested
  const totalCount = (() => {
    function count(arr: FormComp[]): number { return arr.reduce((n,c) => n+1+(c.components?count(c.components):0), 0) }
    return count(comps)
  })()

  return (
    <div style={{ display:'flex', flexDirection:'column', background:'#fff', border:'1.5px solid var(--hair-2)', borderRadius:'var(--r-lg)', overflow:'hidden', boxShadow:'var(--sh-2)', marginTop:16 }}>

      {/* Header */}
      <div style={{ background:'var(--navy)', padding:'12px 20px', display:'flex', alignItems:'center', gap:12, flexShrink:0, flexWrap:'wrap' }}>
        <div style={{ width:34, height:34, borderRadius:10, background:'rgba(255,255,255,.12)', display:'grid', placeItems:'center', flexShrink:0 }}>
          <i className="fa fa-wpforms" style={{ color:'var(--yellow)', fontSize:16 }} />
        </div>
        <div>
          <div style={{ color:'#fff', fontWeight:700, fontSize:14 }}>Editor de formulario</div>
          <div style={{ color:'#8FA5C9', fontSize:11, fontFamily:'var(--f-mono)' }}>{detalle.codigo} · {detalle.descripcion}</div>
        </div>
        <div style={{ padding:'3px 10px', borderRadius:20, background:'rgba(255,255,255,.1)', color:'rgba(255,255,255,.65)', fontSize:11.5, fontFamily:'var(--f-mono)', marginLeft:4 }}>
          {totalCount} elemento{totalCount!==1?'s':''}
        </div>
        <div style={{ marginLeft:'auto', display:'flex', gap:2, background:'rgba(0,0,0,.2)', borderRadius:9, padding:2 }}>
          <button style={tabSt(tab==='builder')} onClick={()=>setTab('builder')}><i className="fa fa-th-large" style={{ marginRight:5 }} />Diseñador</button>
          <button style={tabSt(tab==='preview')} onClick={switchPreview}><i className="fa fa-eye" style={{ marginRight:5 }} />Vista Previa</button>
          <button style={tabSt(tab==='json')} onClick={()=>setTab('json')}><i className="fa fa-code" style={{ marginRight:5 }} />JSON</button>
        </div>
        <div style={{ display:'flex', gap:6, marginLeft:8 }}>
          <button className="btn btn-gray" style={{ fontSize:12, padding:'6px 12px', background:'rgba(255,255,255,.1)', color:'rgba(255,255,255,.8)', border:'1.5px solid rgba(255,255,255,.2)' }} onClick={()=>setShowImport(true)}>
            <i className="fa fa-file-import" /> Importar JSON
          </button>
          <button className="btn btn-primary" style={{ fontSize:12, padding:'6px 16px' }} onClick={() => { try { onSave(toFormio(comps), JSON.stringify(comps), '{}'); setSavedToast(true); setTimeout(() => setSavedToast(false), 2500) } catch(e) { console.error('Error al guardar detalle:', e) } }}>
            <i className="fa fa-save" /> Grabar
          </button>
          <button className="btn btn-gray" style={{ fontSize:12, padding:'6px 14px' }} onClick={onClose}>
            <i className="fa fa-arrow-left" /> Retornar
          </button>
        </div>
      </div>

      {/* Builder */}
      {tab==='builder' && (
        <div style={{ display:'grid', gridTemplateColumns:'196px 1fr 256px', height:'calc(100vh - 178px)', overflow:'hidden' }}>

          {/* Palette */}
          <div style={{ background:'#F8FAFC', borderRight:'1px solid #E2E8F0', display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <div style={{ padding:'10px', borderBottom:'1px solid #E2E8F0' }}>
              <div style={{ position:'relative' }}>
                <i className="fa fa-search" style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'#94A3B8', fontSize:11, pointerEvents:'none' }} />
                <input style={{ width:'100%', padding:'6px 8px 6px 27px', border:'1.5px solid #E2E8F0', borderRadius:7, fontSize:12.5, outline:'none', background:'#fff', boxSizing:'border-box', color:'#374151', fontFamily:'var(--f-sans)' }}
                  placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)}
                  onFocus={e=>e.target.style.borderColor='#2563EB'} onBlur={e=>e.target.style.borderColor='#E2E8F0'} />
              </div>
            </div>
            <div style={{ overflowY:'auto', flex:1, padding:'10px' }}>
              {/* Más usados — quick access (shown when no search active) */}
              {!search && (
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:9.5, fontWeight:700, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:7, paddingLeft:2 }}>
                    ★ Más usados
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    {(['textfield','number','select','firma-seccion','panel'] as const).map(type => {
                      const p = PAL_MAP[type]
                      return (
                        <div key={type} draggable onDragStart={()=>onPalDragStart(type)} onClick={()=>addComp(type)}
                          title={`Agregar ${p.label}`}
                          style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 8px', borderRadius:8, border:`1.5px solid ${p.color}28`, background:p.bg, cursor:'grab', transition:'all 100ms', userSelect:'none' }}
                          onMouseEnter={e=>{const b=e.currentTarget;b.style.borderColor=p.color;b.style.transform='translateX(2px)';b.style.boxShadow='0 2px 8px rgba(0,0,0,.1)'}}
                          onMouseLeave={e=>{const b=e.currentTarget;b.style.borderColor=p.color+'28';b.style.transform='none';b.style.boxShadow='none'}}>
                          <div style={{ width:24, height:24, borderRadius:6, background:'rgba(255,255,255,.7)', display:'grid', placeItems:'center', flexShrink:0 }}>
                            <i className={`fa ${p.icon}`} style={{ color:p.color, fontSize:10 }} />
                          </div>
                          <span style={{ fontSize:11, fontWeight:600, color:p.color }}>{p.label}</span>
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ borderBottom:'1px solid #E8ECF2', margin:'10px 0 4px' }} />
                </div>
              )}

              {cats.filter(g=>g.items.length>0).map(g => (
                <div key={g.cat} style={{ marginBottom:16 }}>
                  <div style={{ fontSize:9.5, fontWeight:700, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:7, paddingLeft:2, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    {g.cat}
                    <span style={{ fontSize:9, fontWeight:700, color:'#CBD5E1', background:'#F1F5F9', borderRadius:100, padding:'1px 6px' }}>{g.items.length}</span>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5 }}>
                    {g.items.map(p => (
                      <div key={p.type} draggable onDragStart={()=>onPalDragStart(p.type)} onClick={()=>addComp(p.type)}
                        title={`Agregar ${p.label}`}
                        style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5, padding:'8px 4px', borderRadius:8, border:'1.5px solid #E2E8F0', background:'#fff', cursor:'grab', transition:'all 120ms', userSelect:'none' }}
                        onMouseEnter={e=>{const b=e.currentTarget;b.style.borderColor=p.color;b.style.background=p.bg;b.style.transform='translateY(-1px)';b.style.boxShadow='0 4px 12px rgba(0,0,0,.1)'}}
                        onMouseLeave={e=>{const b=e.currentTarget;b.style.borderColor='#E2E8F0';b.style.background='#fff';b.style.transform='none';b.style.boxShadow='none'}}>
                        <div style={{ width:30, height:30, borderRadius:8, background:p.bg, display:'grid', placeItems:'center' }}>
                          <i className={`fa ${p.icon}`} style={{ color:p.color, fontSize:12 }} />
                        </div>
                        <span style={{ fontSize:10.5, fontWeight:600, color:'#374151', textAlign:'center', lineHeight:1.2 }}>{p.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Canvas */}
          <div style={{ background:'#F4F6FA', overflowY:'auto', padding:24, backgroundImage:'radial-gradient(#D1D5DB 1px, transparent 1px)', backgroundSize:'20px 20px' }}
            onDragOver={e=>e.preventDefault()} onDrop={onCanvasDrop}>
            {comps.length === 0 ? (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:360, gap:14, color:'#94A3B8' }}>
                <div style={{ width:72, height:72, borderRadius:20, background:'#fff', boxShadow:'0 4px 24px rgba(0,0,0,.08)', display:'grid', placeItems:'center' }}>
                  <i className="fa fa-plus" style={{ fontSize:26, color:'#2563EB' }} />
                </div>
                <div style={{ fontWeight:700, fontSize:16, color:'#374151' }}>Formulario vacío</div>
                <div style={{ fontSize:13, textAlign:'center', maxWidth:260, lineHeight:1.6, color:'#64748B' }}>Arrastra componentes desde la izquierda, o importa un JSON existente.</div>
                <div style={{ display:'flex', gap:8 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'#3B82F6', padding:'6px 14px', background:'#EFF6FF', borderRadius:20, border:'1px solid #BFDBFE' }}>
                    <i className="fa fa-arrow-left" /> Elige un componente
                  </div>
                  <button onClick={()=>setShowImport(true)} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--navy)', padding:'6px 14px', background:'rgba(10,45,99,.06)', borderRadius:20, border:'1px solid rgba(10,45,99,.14)', cursor:'pointer' }}>
                    <i className="fa fa-file-import" /> Importar JSON
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ maxWidth:860, margin:'0 auto' }}>
                {dragOverIdx===0 && <div style={{ height:3, background:'#2563EB', borderRadius:2, marginBottom:8 }} />}
                {comps.map((c, i) => {
                  const pp = PAL_MAP[c.type] ?? { icon:'fa-cube', color:'#94A3B8', bg:'#F8FAFC', label: String(c.type) }
                  const isSel       = selected === c.id
                  const isHov       = hovered === c.id
                  const isContainer = CONTAINER_TYPES.includes(c.type)
                  const isExpanded  = expandedIds.has(c.id)
                  const childCount  = c.components?.length ?? 0
                  const active      = isSel || isHov
                  const hasChildren = isContainer && isExpanded && childCount >= 0
                  return (
                    <div key={c.id} style={{ marginBottom: hasChildren ? 0 : 8 }}>
                      <div draggable
                        onDragStart={()=>onItemDragStart(c.id)}
                        onDragOver={e=>onItemDragOver(e,i)}
                        onDrop={e=>onItemDrop(e,i)}
                        onDragLeave={()=>setDragOverIdx(null)}
                        onClick={()=>setSelected(c.id)}
                        onMouseEnter={()=>setHovered(c.id)}
                        onMouseLeave={()=>setHovered(null)}
                        style={{
                          background:'#fff',
                          borderRadius: hasChildren ? '10px 10px 0 0' : 10,
                          border:`2px solid ${isSel?'#2563EB':isHov?'#94A3B8':'#E2E8F0'}`,
                          boxShadow: isSel
                            ? `0 0 0 4px rgba(37,99,235,.1), inset 3px 0 0 ${pp.color}`
                            : `0 1px 4px rgba(0,0,0,.05), inset 3px 0 0 ${pp.color}`,
                          cursor:'pointer', transition:'all 120ms', overflow:'hidden',
                        }}>

                        {/* Contextual toolbar — always visible but subtle; activates on hover/select */}
                        <div style={{
                          display:'flex', alignItems:'center', gap:5, padding:'4px 10px',
                          background: isSel?'#EFF6FF' : isHov?'#F4F6FA' : '#F8FAFC',
                          borderBottom:`1px solid ${isSel?'#BFDBFE':'#EEF0F3'}`,
                          transition:'background 120ms', userSelect:'none',
                        }}>
                          {/* Drag handle */}
                          <span style={{ color:active?'#94A3B8':'#D1D5DB', fontSize:12, cursor:'grab', flexShrink:0, lineHeight:1, transition:'color 120ms' }}>⋮⋮</span>

                          {/* Type icon */}
                          <div style={{ width:18, height:18, borderRadius:4, background:pp.bg, display:'grid', placeItems:'center', flexShrink:0 }}>
                            <i className={`fa ${pp.icon}`} style={{ color:pp.color, fontSize:8 }} />
                          </div>
                          {/* Type label */}
                          <span style={{ fontSize:10.5, fontWeight:600, color:isSel?'#1D4ED8':'#64748B', flexShrink:0 }}>{pp.label}</span>
                          {/* Key pill */}
                          <span style={{ fontSize:9.5, color:'#94A3B8', fontFamily:'var(--f-mono)', background:'#F1F5F9', padding:'1px 5px', borderRadius:3, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.key}</span>

                          {/* Actions — visible on hover/select */}
                          <div style={{ display:'flex', gap:3, opacity:active?1:0, transition:'opacity 120ms', flexShrink:0 }}>
                            {isContainer && (
                              <button title={isExpanded?'Colapsar':'Expandir'} onClick={e=>toggleExpand(c.id,e)}
                                style={{ width:22, height:22, border:`1.5px solid ${isExpanded?'#BFDBFE':'#E2E8F0'}`, borderRadius:5, background:isExpanded?'#EFF6FF':'#fff', cursor:'pointer', color:isExpanded?'#2563EB':'#64748B', fontSize:9, display:'grid', placeItems:'center', transition:'all 100ms' }}>
                                <i className={`fa fa-chevron-${isExpanded?'up':'down'}`} />
                              </button>
                            )}
                            <button title="Duplicar" onClick={e=>{e.stopPropagation();dupComp(c.id)}}
                              style={{ width:22, height:22, border:'1.5px solid #E2E8F0', borderRadius:5, background:'#fff', cursor:'pointer', color:'#64748B', fontSize:10, display:'grid', placeItems:'center' }}>
                              <i className="fa fa-copy" />
                            </button>
                            <button title="Eliminar" onClick={e=>{e.stopPropagation();removeComp(c.id)}}
                              style={{ width:22, height:22, border:'1.5px solid #FCA5A5', borderRadius:5, background:'#FEF2F2', cursor:'pointer', color:'#EF4444', fontSize:10, display:'grid', placeItems:'center' }}>
                              <i className="fa fa-times" />
                            </button>
                          </div>
                        </div>

                        {/* Field preview — full-width, looks like a real form */}
                        <div style={{ padding:'10px 14px', pointerEvents:'none' }}>
                          <FieldPreview c={c} />
                        </div>
                      </div>

                      {/* Nested children */}
                      {hasChildren && (
                        <div style={{ marginBottom:8, background:'#fff', border:`2px solid ${isSel?'#2563EB':'#E2E8F0'}`, borderTop:'none', borderRadius:'0 0 10px 10px', padding:'10px 14px 12px', boxShadow:isSel?'0 0 0 4px rgba(37,99,235,.1)':'0 1px 4px rgba(0,0,0,.05)' }}>
                          {c.type === 'columns' ? (
                            <ColumnsEditor
                              comp={c}
                              selectedId={selected}
                              onSelect={setSelected}
                              onRemove={removeChild}
                              onAdd={addToColumnContainer}
                              onMoveToCol={moveChildToCol}
                              onReorder={reorderInColumn} />
                          ) : (
                            <NestedCompList
                              comps={c.components ?? []}
                              selectedId={selected}
                              onSelect={setSelected}
                              parentId={c.id}
                              onRemove={removeChild}
                              onAdd={addToContainer}
                              onReorder={reorderInPanel}
                              onAddToColumn={addToColumnContainer}
                              onMoveToCol={moveChildToCol}
                              onReorderInColumn={reorderInColumn} />
                          )}
                        </div>
                      )}

                      {dragOverIdx===i+1 && <div style={{ height:3, background:'#2563EB', borderRadius:2, marginBottom:8, marginTop: hasChildren?0:0 }} />}
                    </div>
                  )
                })}
                <div style={{ width:'100%', padding:'12px', background:'transparent', border:'2px dashed #CBD5E1', borderRadius:10, color:'#94A3B8', fontSize:12.5, textAlign:'center', marginTop:4, transition:'all 120ms' }}
                  onDragOver={e=>{e.preventDefault();e.currentTarget.style.borderColor='#2563EB';e.currentTarget.style.background='#EFF6FF';e.currentTarget.style.color='#2563EB'}}
                  onDragLeave={e=>{e.currentTarget.style.borderColor='#CBD5E1';e.currentTarget.style.background='transparent';e.currentTarget.style.color='#94A3B8'}}
                  onDrop={e=>{e.currentTarget.style.borderColor='#CBD5E1';e.currentTarget.style.background='transparent';onCanvasDrop(e)}}>
                  <i className="fa fa-plus" style={{ marginRight:6 }} />Arrastra un componente aquí
                </div>
              </div>
            )}
          </div>

          {/* Properties */}
          <div style={{ borderLeft:'1px solid #E2E8F0', display:'flex', flexDirection:'column', overflow:'hidden', background:'#fff' }}>
            {!selComp ? (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:10, color:'#94A3B8', padding:24, textAlign:'center' }}>
                <div style={{ width:48, height:48, borderRadius:14, background:'#F1F5F9', display:'grid', placeItems:'center' }}>
                  <i className="fa fa-sliders-h" style={{ fontSize:20, color:'#CBD5E1' }} />
                </div>
                <div style={{ fontWeight:700, fontSize:13.5, color:'#475569' }}>Propiedades</div>
                <div style={{ fontSize:12, lineHeight:1.6, color:'#94A3B8' }}>Selecciona un campo para editar sus propiedades</div>
              </div>
            ) : (
              <>
                <div style={{ padding:'10px 14px', borderBottom:'1px solid #E2E8F0', flexShrink:0, background:'#F8FAFC' }}>
                  {(() => {
                    const pp2 = PAL_MAP[selComp.type] ?? { icon:'fa-cube', color:'#94A3B8', bg:'#F8FAFC', label: selComp.type }
                    return (
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:28, height:28, borderRadius:7, background:pp2.bg, border:`1.5px solid ${pp2.color}28`, display:'grid', placeItems:'center', flexShrink:0 }}>
                          <i className={`fa ${pp2.icon}`} style={{ color:pp2.color, fontSize:11 }} />
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:12, fontWeight:700, color:'#0F172A' }}>{pp2.label}</div>
                          <div style={{ fontSize:10.5, color:'#94A3B8', fontFamily:'var(--f-mono)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{selComp.key || toKey(selComp.label)}</div>
                        </div>
                      </div>
                    )
                  })()}
                </div>
                <div style={{ flex:1, overflow:'auto' }}>
                  <PropertiesPanel comp={selComp} onChange={p=>updComp(selComp.id,p)} onDelete={()=>removeComp(selComp.id)}
                    onColumnCountChange={selComp.type==='columns' ? n=>changeColumnsCount(selComp.id,n) : undefined} />
                </div>
              </>
            )}
          </div>

        </div>
      )}

      {/* Preview */}
      {tab==='preview' && (
        <div style={{ padding:20, background:'#F0F2F5', flex:1, minHeight:480, overflow:'auto' }}>
          <div style={{ maxWidth:'100%', margin:'0 auto' }}>
            <div style={{ background:'#E8EAED', borderRadius:'12px 12px 0 0', padding:'10px 14px', display:'flex', alignItems:'center', gap:8, border:'1px solid #D1D5DB', borderBottom:'none' }}>
              <div style={{ display:'flex', gap:5 }}>
                {['#F87171','#FCD34D','#4ADE80'].map(c=><div key={c} style={{ width:11, height:11, borderRadius:'50%', background:c }} />)}
              </div>
              <div style={{ flex:1, background:'#fff', borderRadius:20, padding:'3px 12px', fontSize:11.5, color:'#6B7280', border:'1px solid #D1D5DB', textAlign:'center' }}>Vista previa</div>
              <button onClick={() => sendToPreview()}
                title="Actualizar vista previa"
                style={{ padding:'3px 10px', border:'1px solid #D1D5DB', borderRadius:6, background:'#fff', color:'#6B7280', fontSize:11, cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
                <i className="fa fa-sync" />
              </button>
              {Object.keys(firmadosPreview).length > 0 && (
                <button onClick={() => { setFirmadosPreview({}); setTimeout(() => sendToPreview({}), 50) }}
                  title="Reiniciar firmas de prueba"
                  style={{ padding:'3px 10px', border:'1px solid #DDD6FE', borderRadius:6, background:'#F5F3FF', color:'#7C3AED', fontSize:11, cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
                  <i className="fa fa-undo" /> Reiniciar firmas
                </button>
              )}
            </div>
            <div style={{ background:'#fff', border:'1px solid #D1D5DB', borderTop:'none', borderRadius:'0 0 12px 12px', overflow:'hidden', boxShadow:'0 8px 32px rgba(0,0,0,.08)' }}>
              <iframe ref={renderRef} src="/formio/render.html" title="Form Preview"
                style={{ width:'100%', height:renderH, border:'none', display:'block', minHeight:220 }} />
            </div>
          </div>
        </div>
      )}

      {/* JSON tab */}
      {tab==='json' && (
        <JsonTab comps={comps} onApply={newComps=>{ setComps(newComps); setSelected(null); setTab('builder') }} />
      )}

      {showImport && <ImportJsonModal onClose={()=>setShowImport(false)} onImport={handleImport} />}

      {firmaPreview && (
        <PreviewFirmaModal
          firma={firmaPreview}
          onConfirm={confirmFirmaPreview}
          onClose={() => setFirmaPreview(null)}
        />
      )}

      {savedToast && (
        <div style={{ position:'fixed', bottom:24, right:24, background:'#065F46', color:'#fff', padding:'10px 18px', borderRadius:8, fontSize:13, fontWeight:600, display:'flex', alignItems:'center', gap:8, boxShadow:'0 4px 24px rgba(0,0,0,.18)', zIndex:9999 }}>
          <i className="fa fa-check-circle" /> Detalle guardado correctamente
        </div>
      )}

      {undoDelete && (
        <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', background:'#0F172A', color:'#fff', padding:'11px 18px', borderRadius:10, fontSize:13, fontWeight:500, display:'flex', alignItems:'center', gap:12, boxShadow:'0 4px 24px rgba(0,0,0,.28)', zIndex:9999, minWidth:300 }}>
          <i className="fa fa-trash-alt" style={{ color:'#F87171', fontSize:12 }} />
          <span style={{ flex:1 }}>
            <strong>"{undoDelete.label}"</strong> eliminado
          </span>
          <button onClick={handleUndoDelete}
            style={{ padding:'5px 14px', background:'#FFDF64', color:'#0A1530', border:'none', borderRadius:6, fontWeight:700, fontSize:12, cursor:'pointer', flexShrink:0 }}>
            Deshacer
          </button>
        </div>
      )}
    </div>
  )
}

// ─── EstadoBadge ──────────────────────────────────────────────────────────────

function EstadoBadge({ estado }: { estado: string }) {
  const ok = estado==='Activo'
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'2px 10px', borderRadius:100, fontSize:11.5, fontWeight:600, fontFamily:'var(--f-mono)', background:ok?'#dcfce7':'#f1f5f9', color:ok?'#166534':'#64748b' }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background:ok?'#16a34a':'#94a3b8', display:'inline-block' }} />
      {estado}
    </span>
  )
}

// ─── DetallesList ─────────────────────────────────────────────────────────────

type ModalMode = 'crear' | 'modificar' | 'copiar' | 'eliminar' | null

export function DetallesList() {
  const [data,       setData]      = useState<Detalle[]>(() => [...getDetalles()])
  const [busqueda,   setBusqueda]  = useState('')
  const [mode,       setMode]      = useState<ModalMode>(null)
  const [selected,   setSelected]  = useState<Detalle | null>(null)
  const [formulario, setFormulario] = useState<Detalle | null>(null)
  const [copiarInst, setCopiarInst] = useState(false)
  const [form,   setForm]   = useState({ codigo:'', descripcion:'', estado:'Activo' as 'Activo'|'Inactivo', idEstrategiaFirma: undefined as number | undefined })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const filtered = data.filter(d => !busqueda || d.codigo.toLowerCase().includes(busqueda.toLowerCase()) || d.descripcion.toLowerCase().includes(busqueda.toLowerCase()))
  const set = (k: string, v: string) => { setForm(f=>({...f,[k]:v})); setErrors(e=>({...e,[k]:''})) }

  const openCrear  = () => { setForm({codigo:'',descripcion:'',estado:'Activo',idEstrategiaFirma:undefined}); setSelected(null); setErrors({}); setMode('crear') }
  const openMod    = (r: Detalle) => { setForm({codigo:r.codigo,descripcion:r.descripcion,estado:r.estado,idEstrategiaFirma:r.idEstrategiaFirma}); setSelected(r); setErrors({}); setMode('modificar') }
  const openCopiar = (r: Detalle) => { setForm({codigo:r.codigo+'-C',descripcion:r.descripcion+' (copia)',estado:r.estado,idEstrategiaFirma:r.idEstrategiaFirma}); setSelected(r); setCopiarInst(false); setErrors({}); setMode('copiar') }
  const openElim   = (r: Detalle) => { setSelected(r); setMode('eliminar') }

  const validate = () => {
    const e: Record<string,string> = {}
    if (!form.codigo.trim())      e.codigo      = 'El código es requerido'
    if (!form.descripcion.trim()) e.descripcion = 'La descripción es requerida'
    if (mode!=='modificar' && data.find(d=>d.codigo.toLowerCase()===form.codigo.trim().toLowerCase())) e.codigo = 'Este código ya existe'
    setErrors(e); return !Object.keys(e).length
  }

  const persist = (next: Detalle[]) => { setDetalles(next); setData(next) }

  const handleSave = () => {
    if (!validate()) return
    if (mode==='crear') persist([...data,{id:bumpDetId(),codigo:form.codigo.trim(),descripcion:form.descripcion.trim(),estado:form.estado,idEstrategiaFirma:form.idEstrategiaFirma,jsonSchema:'',jsonData:'',jsonOptions:''}])
    else if (mode==='modificar'&&selected) persist(data.map(x=>x.id===selected.id?{...x,...form}:x))
    else if (mode==='copiar'&&selected)    persist([...data,{id:bumpDetId(),codigo:form.codigo.trim(),descripcion:form.descripcion.trim(),estado:form.estado,idEstrategiaFirma:form.idEstrategiaFirma,jsonSchema:copiarInst?selected.jsonSchema:'',jsonData:copiarInst?selected.jsonData:'',jsonOptions:''}])
    setMode(null)
  }

  const handleElim = () => { if (selected) persist(data.filter(x=>x.id!==selected.id)); setMode(null) }
  const handleSaveForm = (jsonSchema: string, jsonData: string, jsonOptions: string) => {
    if (formulario) {
      const next = data.map(x => x.id===formulario.id ? {...x,jsonSchema,jsonData,jsonOptions} : x)
      persist(next)
      setFormulario(f => f ? {...f,jsonSchema,jsonData,jsonOptions} : null)
    }
  }

  const cols: Column<Detalle>[] = [
    { key:'id',          header:'Id',          width:'6%',  align:'center' },
    { key:'codigo',      header:'Código',       width:'16%', render:r=><span style={{ fontFamily:'var(--f-mono)', fontSize:12.5, color:'var(--navy)', fontWeight:600 }}>{r.codigo}</span> },
    { key:'descripcion', header:'Descripción' },
    { key:'estado',      header:'Estado',       width:'12%', render:r=><EstadoBadge estado={r.estado} /> },
    { key:'campos',      header:'Campos',       width:'9%',  align:'center',
      render:r=>{ const n=countComps(r.jsonSchema); return <span style={{ fontFamily:'var(--f-mono)', fontSize:11.5, background:n>0?'#EFF6FF':'var(--paper-2)', padding:'2px 9px', borderRadius:6, color:n>0?'var(--navy)':'var(--ink-4)', fontWeight:n>0?700:400 }}>{n>0?n:'—'}</span> }},
    { key:'idEstrategiaFirma', header:'Estrategia cierre', width:'16%',
      render: r => {
        const ef = r.idEstrategiaFirma ? mockEstrategiasFirma.find(e => e.id === r.idEstrategiaFirma) : null
        return ef
          ? <div><span style={{ fontFamily:'var(--f-mono)', fontSize:11, color:'var(--navy)', fontWeight:600 }}>{ef.codigo}</span><div style={{ fontSize:11, color:'var(--ink-4)', marginTop:1 }}>{ef.descripcion}</div></div>
          : <span style={{ color:'var(--ink-4)', fontSize:12 }}>—</span>
      }
    },
    { key:'__acc', header:'Acciones', width:'20%', align:'center',
      render:r=>(
        <div style={{ display:'flex', gap:6, justifyContent:'center', alignItems:'center' }}>
          {/* Utility pill: edit / copy / delete grouped together */}
          <div style={{ display:'flex', alignItems:'center', gap:1, padding:3, background:'#F1F5F9', borderRadius:9, border:'1px solid #E2E8F0' }}>
            <button title="Editar metadatos" onClick={()=>openMod(r)}
              style={{ width:27, height:27, borderRadius:6, border:'none', background:'transparent', cursor:'pointer', color:'#94A3B8', fontSize:12, display:'grid', placeItems:'center', transition:'all 80ms' }}
              onMouseEnter={e=>{e.currentTarget.style.background='#fff';e.currentTarget.style.color='#16A34A';e.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,.08)'}}
              onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color='#94A3B8';e.currentTarget.style.boxShadow='none'}}>
              <i className="fa fa-pen" style={{ fontSize:11 }} />
            </button>
            <button title="Duplicar formulario" onClick={()=>openCopiar(r)}
              style={{ width:27, height:27, borderRadius:6, border:'none', background:'transparent', cursor:'pointer', color:'#94A3B8', fontSize:12, display:'grid', placeItems:'center', transition:'all 80ms' }}
              onMouseEnter={e=>{e.currentTarget.style.background='#fff';e.currentTarget.style.color='#EA580C';e.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,.08)'}}
              onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color='#94A3B8';e.currentTarget.style.boxShadow='none'}}>
              <i className="fa fa-clone" style={{ fontSize:11 }} />
            </button>
            {/* Visual divider before destructive action */}
            <div style={{ width:1, height:16, background:'#E2E8F0', margin:'0 2px' }} />
            <button title="Eliminar formulario" onClick={()=>openElim(r)}
              style={{ width:27, height:27, borderRadius:6, border:'none', background:'transparent', cursor:'pointer', color:'#CBD5E1', fontSize:11, display:'grid', placeItems:'center', transition:'all 80ms' }}
              onMouseEnter={e=>{e.currentTarget.style.background='#FEF2F2';e.currentTarget.style.color='#DC2626';e.currentTarget.style.boxShadow='0 1px 4px rgba(220,38,38,.1)'}}
              onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color='#CBD5E1';e.currentTarget.style.boxShadow='none'}}>
              <i className="fa fa-trash" style={{ fontSize:11 }} />
            </button>
          </div>
          {/* Primary CTA */}
          <button onClick={()=>{ setFormulario(r); window.scrollTo({top:0,behavior:'smooth'}) }}
            style={{ padding:'5px 13px', borderRadius:7, border:'none', background:'var(--navy)', cursor:'pointer', color:'#fff', fontSize:11.5, fontWeight:600, transition:'all 100ms', whiteSpace:'nowrap', letterSpacing:'0.01em' }}
            onMouseEnter={e=>e.currentTarget.style.background='#0E3A7A'}
            onMouseLeave={e=>e.currentTarget.style.background='var(--navy)'}>
            Diseñar
          </button>
        </div>
      ),
    },
  ]

  const modalTitle = mode==='crear'?'Crear Detalle':mode==='modificar'?'Modificar Detalle':'Copiar Detalle'

  const statsItems = [
    { label:'Total formularios', count:data.length,                                     color:'var(--navy)',  bg:'rgba(10,45,99,.07)',  icon:'fa-wpforms' },
    { label:'Activos',           count:data.filter(d=>d.estado==='Activo').length,       color:'#16A34A',     bg:'#F0FDF4',              icon:'fa-check-circle' },
    { label:'Inactivos',         count:data.filter(d=>d.estado==='Inactivo').length,     color:'#64748B',     bg:'#F1F5F9',              icon:'fa-pause-circle' },
    { label:'Con campos',        count:data.filter(d=>countComps(d.jsonSchema)>0).length,color:'#2563EB',     bg:'#EFF6FF',              icon:'fa-list-alt' },
  ]

  return (
    <>
      {!formulario && (
        <>
          {/* Stats summary bar */}
          <div style={{ display:'flex', gap:10, marginBottom:16 }}>
            {statsItems.map(s => (
              <div key={s.label} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 16px', background:s.bg, border:`1.5px solid ${s.color}22`, borderRadius:'var(--r-md)', flex:1, minWidth:0 }}>
                <div style={{ width:34, height:34, borderRadius:9, background:s.color+'18', display:'grid', placeItems:'center', flexShrink:0 }}>
                  <i className={`fa ${s.icon}`} style={{ color:s.color, fontSize:14 }} />
                </div>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:22, fontWeight:800, color:s.color, lineHeight:1 }}>{s.count}</div>
                  <div style={{ fontSize:11, color:s.color+'AA', marginTop:2, fontWeight:500, whiteSpace:'nowrap' }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
            <div style={{ flex:1, position:'relative' }}>
              <i className="fa fa-search" style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--ink-4)', fontSize:13, pointerEvents:'none' }} />
              <input style={{ width:'100%', padding:'9px 12px 9px 36px', background:'#fff', border:'1.5px solid var(--hair-2)', borderRadius:'var(--r-md)', fontSize:13.5, color:'var(--ink)', fontFamily:'var(--f-sans)', outline:'none' }}
                placeholder="Buscar por código o descripción…" value={busqueda} onChange={e=>setBusqueda(e.target.value)}
                onFocus={e=>e.target.style.borderColor='var(--navy)'} onBlur={e=>e.target.style.borderColor='var(--hair-2)'} />
            </div>
            <button className="btn btn-success" onClick={openCrear}><i className="fa fa-plus" /> Crear detalle</button>
            <button className="btn btn-gray" title="Eliminar cambios guardados y restaurar schemas originales"
              onClick={() => { if (confirm('¿Restaurar todos los schemas a sus valores originales? Se perderán los cambios guardados.')) { resetDetalles(); setData([...getDetalles()]) } }}>
              <i className="fa fa-undo" /> Restaurar defaults
            </button>
          </div>
          <Panel title={`Lista de detalles · ${filtered.length} registro${filtered.length!==1?'s':''}`}>
            <DataTable<Detalle> columns={cols} data={filtered} />
          </Panel>
        </>
      )}

      {formulario && <FormularioPanel detalle={formulario} onClose={()=>setFormulario(null)} onSave={handleSaveForm} />}

      {(mode==='crear'||mode==='modificar'||mode==='copiar') && createPortal(
        <div style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(10,21,48,.45)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }} onClick={()=>setMode(null)}>
          <div style={{ background:'var(--paper)', borderRadius:'var(--r-xl)', boxShadow:'var(--sh-3)', width:'100%', maxWidth:520 }} onClick={e=>e.stopPropagation()}>
            <div style={{ background:'var(--navy)', borderRadius:'var(--r-xl) var(--r-xl) 0 0', padding:'16px 22px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ color:'#fff', fontWeight:700, fontSize:15 }}>{modalTitle}</span>
              <button style={{ background:'rgba(255,255,255,.1)', border:'none', cursor:'pointer', color:'#fff', width:28, height:28, borderRadius:7, fontSize:16, display:'grid', placeItems:'center' }} onClick={()=>setMode(null)}>×</button>
            </div>
            <div style={{ padding:'20px 22px 6px' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
                <div>
                  <label style={{ display:'block', fontSize:12.5, fontWeight:600, color:'var(--ink-2)', marginBottom:5 }}>Código <span style={{ color:'var(--orange)' }}>*</span></label>
                  <input style={{ ...INP, borderColor:errors.codigo?'#dc2626':'var(--hair-2)' }} value={form.codigo} onChange={e=>set('codigo',e.target.value)} maxLength={10} />
                  {errors.codigo && <div style={{ fontSize:11, color:'#dc2626', marginTop:3 }}>{errors.codigo}</div>}
                </div>
                <div>
                  <label style={{ display:'block', fontSize:12.5, fontWeight:600, color:'var(--ink-2)', marginBottom:5 }}>Descripción <span style={{ color:'var(--orange)' }}>*</span></label>
                  <input style={{ ...INP, borderColor:errors.descripcion?'#dc2626':'var(--hair-2)' }} value={form.descripcion} onChange={e=>set('descripcion',e.target.value)} maxLength={40} />
                  {errors.descripcion && <div style={{ fontSize:11, color:'#dc2626', marginTop:3 }}>{errors.descripcion}</div>}
                </div>
              </div>
              <div style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:12.5, fontWeight:600, color:'var(--ink-2)', marginBottom:5 }}>Estado <span style={{ color:'var(--orange)' }}>*</span></label>
                <div style={{ display:'flex', gap:10 }}>
                  {(['Activo','Inactivo'] as const).map(s=>(
                    <label key={s} style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', padding:'8px 16px', borderRadius:'var(--r-sm)', border:`1.5px solid ${form.estado===s?'var(--navy)':'var(--hair-2)'}`, background:form.estado===s?'rgba(10,45,99,.06)':'#fff', fontSize:13, fontWeight:form.estado===s?600:400, color:form.estado===s?'var(--navy)':'var(--ink-3)', transition:'all 120ms' }}>
                      <input type="radio" name="estado" value={s} checked={form.estado===s} onChange={()=>set('estado',s)} style={{ accentColor:'var(--navy)' }} />{s}
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:12.5, fontWeight:600, color:'var(--ink-2)', marginBottom:5 }}>
                  Estrategia de firma
                </label>
                <select style={{ ...INP }}
                  value={form.idEstrategiaFirma ?? ''}
                  onChange={e => setForm(f => ({ ...f, idEstrategiaFirma: e.target.value ? Number(e.target.value) : undefined }))}>
                  <option value="">Sin estrategia</option>
                  {mockEstrategiasFirma.filter(e => e.activo).map(ef => (
                    <option key={ef.id} value={ef.id}>{ef.codigo} — {ef.descripcion}</option>
                  ))}
                </select>
                {form.idEstrategiaFirma && (() => {
                  const ef = mockEstrategiasFirma.find(e => e.id === form.idEstrategiaFirma)
                  if (!ef) return null
                  const activas = ef.firmas.filter(f => f.activo).sort((a, b) => a.orden - b.orden)
                  return (
                    <div style={{ marginTop:6, padding:'8px 12px', background:'rgba(10,45,99,.05)', border:'1.5px solid rgba(10,45,99,.15)', borderRadius:'var(--r-sm)', fontSize:12 }}>
                      <div style={{ fontWeight:600, color:'var(--navy)', marginBottom:4 }}>
                        <i className="fa fa-signature" style={{ marginRight:5 }} />{activas.length} firma{activas.length !== 1 ? 's' : ''}
                      </div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                        {activas.map(f => (
                          <span key={f.idFirma} style={{ fontSize:11, padding:'1px 7px', borderRadius:20, background:'var(--navy)', color:'#fff', fontWeight:500 }}>
                            {f.orden}. {f.texto}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </div>
              {mode==='copiar' && (
                <div style={{ padding:'10px 14px', background:'rgba(255,223,100,.1)', border:'1.5px solid rgba(255,223,100,.4)', borderRadius:'var(--r-sm)', marginBottom:14 }}>
                  <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', fontSize:13, color:'var(--ink-2)' }}>
                    <input type="checkbox" checked={copiarInst} onChange={e=>setCopiarInst(e.target.checked)} style={{ accentColor:'var(--navy)', width:16, height:16 }} />
                    <span><strong>Copiar campos del formulario</strong> — incluye todos los campos configurados</span>
                  </label>
                </div>
              )}
            </div>
            <div style={{ padding:'14px 22px', borderTop:'1px solid var(--hair)', display:'flex', justifyContent:'flex-end', gap:8 }}>
              <button className="btn btn-gray" onClick={()=>setMode(null)}><i className="fa fa-undo" /> Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave}><i className="fa fa-check" /> {mode==='copiar'?'Copiar':mode==='modificar'?'Guardar':'Crear'}</button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {mode==='eliminar' && selected && createPortal(
        <div style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(10,21,48,.45)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }} onClick={()=>setMode(null)}>
          <div style={{ background:'var(--paper)', borderRadius:'var(--r-xl)', boxShadow:'var(--sh-3)', width:'100%', maxWidth:400 }} onClick={e=>e.stopPropagation()}>
            <div style={{ padding:'20px 22px', display:'flex', flexDirection:'column', alignItems:'center', gap:12, textAlign:'center' }}>
              <div style={{ width:52, height:52, borderRadius:'50%', background:'#fef2f2', display:'grid', placeItems:'center' }}><i className="fa fa-trash-alt" style={{ color:'#dc2626', fontSize:20 }} /></div>
              <div>
                <div style={{ fontSize:16, fontWeight:700, color:'var(--ink)', marginBottom:6 }}>¿Eliminar detalle?</div>
                <div style={{ fontSize:13.5, color:'var(--ink-3)', lineHeight:1.5 }}>Vas a eliminar <strong style={{ color:'var(--ink)' }}>{selected.codigo}</strong> — {selected.descripcion}.<br />Esta acción no se puede deshacer.</div>
              </div>
            </div>
            <div style={{ padding:'0 22px 20px', display:'flex', gap:8, justifyContent:'center' }}>
              <button className="btn btn-gray" style={{ minWidth:100 }} onClick={()=>setMode(null)}><i className="fa fa-undo" /> Cancelar</button>
              <button className="btn btn-danger" style={{ minWidth:100 }} onClick={handleElim}><i className="fa fa-trash-alt" /> Eliminar</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

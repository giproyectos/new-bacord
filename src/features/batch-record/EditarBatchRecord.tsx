import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { mockEstrategiasFirma, mockUsuarios, mockBatchRecords, mockFirmadosBR, mockDesviaciones, type Desviacion } from '@/api/mock'
import { formulaControlApi } from '@/api/formulaControl'
import { batchRecordApi } from '@/api/batchRecord'
import type { PreLlenadoBR } from '@/types'
import { getDetalleById } from '@/stores/detallesStore'
import type { EstrategiaFirmaItem } from '@/types'
import { useAudit } from '@/hooks/useAudit'
import { useAuditStore } from '@/stores/auditStore'
import { diffValores } from '@/utils/auditDiff'

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

function buildSchema(...comps: SchemaComp[]) { return JSON.stringify({ components: comps }) }

const mkH   = (text: string): SchemaComp                                     => ({ type: 'heading', text })
const mkDiv = (): SchemaComp                                                  => ({ type: 'divider' })
const mkTF  = (key: string, label: string, ph?: string): SchemaComp          => ({ type: 'textfield', key, label, placeholder: ph })
const mkNum = (key: string, label: string, unit?: string): SchemaComp        => ({ type: 'number', key, label, unit })
const mkSel = (key: string, label: string, options: string[]): SchemaComp    => ({ type: 'select', key, label, options })
const mkTA  = (key: string, label: string, rows = 2): SchemaComp             => ({ type: 'textarea', key, label, rows })
const mkDT  = (key: string, label: string): SchemaComp                       => ({ type: 'datetime', key, label })
const mkFS  = (key: string, label: string, idEF: number): SchemaComp         => ({ type: 'firma-seccion', key, label, idEstrategiaFirma: idEF })

// ── Datos de firma ───────────────────────────────────────────────────────
interface FirmaInfo { nombre: string; cargo: string; fecha: string; hora: string; loginUsuario: string; idUsuario: number }

// Mapa detalle id → código corto
const DETALLE_CODE: Record<number, string> = {
  101: 'ET1-F1', 102: 'ET1-F2', 103: 'ET1-F3',
  201: 'ET2-F1', 202: 'ET2-F2', 203: 'ET2-F3',
  301: 'ET3-F1', 302: 'ET3-F2', 303: 'ET3-F3',
}

// Mapa grupo → cargo oficial en el sistema
const GRUPO_CARGO: Record<string, string> = {
  'Producción':     'Operario de Producción',
  'Calidad':        'Analista de Control de Calidad',
  'Supervisión':    'Supervisor de Producción',
  'Administradores':'Administrador del Sistema',
  'Dirección':      'Director Técnico de Planta',
}

// firmados: clave → FirmaInfo (undefined = aún no firmado)
type FirmaMap = { [key: string]: FirmaInfo | undefined }

// ── Cabecera dinámica ──────────────────────────────────────────────────────
function buildCabeceraItems(pl: PreLlenadoBR | null) {
  return [
    { label: 'Producto',          value: pl?.descripcionMaterial ?? '—' },
    { label: 'Código',            value: pl?.codigoMaterial      ?? '—' },
    { label: 'Lote No.',          value: pl?.loteLogistico       ?? '—' },
    { label: 'Receta Maestra',    value: 'RM-SYN-001 v1.0' },
    { label: 'Orden de Proceso',  value: pl?.numeroOrdenProceso  ?? '—' },
    { label: 'Fecha Fabricación', value: pl?.fechaFabricacion    ?? '—' },
    { label: 'Fecha Caducidad',   value: pl?.fechaCaducidad      ?? '—' },
    { label: 'Tamaño de Lote',    value: pl ? `${pl.cantidadOrden.toLocaleString('es-CO')} ${pl.unidadMedida}` : '—' },
    { label: 'Centro',            value: pl?.centro              ?? '—' },
  ]
}

interface ProcesoRow { id: number; descripcion: string; cerrado: boolean }
const mockProcesos: ProcesoRow[] = [
  { id: 1, descripcion: 'Etapa 1 — Dispensación de Materias Primas', cerrado: false },
  { id: 2, descripcion: 'Etapa 2 — Encapsulación',                   cerrado: false },
  { id: 3, descripcion: 'Etapa 3 — Inspección Visual y Empaque',     cerrado: false },
]

interface DetalleRow {
  id: number; idProceso: number; orden: number
  descripcion: string; firmado: boolean; tieneFirma: boolean
  idEstrategiaFirma: number; jsonSchema?: string
}

// Structural BR data — schema and idEstrategiaFirma are resolved at render time from the shared store
const DETALLE_STRUCT: Omit<DetalleRow, 'jsonSchema'>[] = [
  // ── Etapa 1: Dispensación de Materias Primas ──────────────────────────
  { id: 101, idProceso: 1, orden: 1, descripcion: 'Encabezado e Identificación del Lote',      firmado: false, tieneFirma: true, idEstrategiaFirma: 1 },
  { id: 102, idProceso: 1, orden: 2, descripcion: 'Pesaje de Materias Primas',                 firmado: false, tieneFirma: true, idEstrategiaFirma: 1 },
  { id: 103, idProceso: 1, orden: 3, descripcion: 'Verificación y Cierre de Dispensación',     firmado: false, tieneFirma: true, idEstrategiaFirma: 1 },
  // ── Etapa 2: Encapsulación ────────────────────────────────────────────
  { id: 201, idProceso: 2, orden: 1, descripcion: 'Configuración y Arranque de Encapsuladora', firmado: false, tieneFirma: true, idEstrategiaFirma: 1 },
  { id: 202, idProceso: 2, orden: 2, descripcion: 'Control en Proceso de Encapsulación (CIP)', firmado: false, tieneFirma: true, idEstrategiaFirma: 1 },
  { id: 203, idProceso: 2, orden: 3, descripcion: 'Rendimiento de Encapsulación y Cierre',     firmado: false, tieneFirma: true, idEstrategiaFirma: 1 },
  // ── Etapa 3: Inspección Visual y Empaque ─────────────────────────────
  { id: 301, idProceso: 3, orden: 1, descripcion: 'Inspección Visual AQL',                     firmado: false, tieneFirma: true, idEstrategiaFirma: 1 },
  { id: 302, idProceso: 3, orden: 2, descripcion: 'Empaque Primario y Secundario',             firmado: false, tieneFirma: true, idEstrategiaFirma: 1 },
  { id: 303, idProceso: 3, orden: 3, descripcion: 'Cierre de Lote y Aprobación Final',         firmado: false, tieneFirma: true, idEstrategiaFirma: 2 },
]

const PREFILLED: Record<number, Record<string, string>> = {}

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

// Builds per-detalle initial values for form.io iframe pre-population from OP data
function buildDetalleInitialValues(detalleId: number, pl: PreLlenadoBR | null | undefined): Record<string, unknown> {
  if (!pl) return {}
  const kgComps   = pl.componentes.filter(c => c.unidadMedida === 'kg')
  const totalKg   = kgComps.reduce((s, c) => s + c.cantidad, 0)
  const capsComp  = pl.componentes.find(c => /CAP|caps/i.test(c.codigoMaterialComponente))
  const batchUnits = capsComp ? capsComp.cantidad : pl.cantidadOrden * 1000
  const aqlSample = batchUnits > 150000 ? 800 : batchUnits > 35000 ? 500 : batchUnits > 10000 ? 315 : batchUnits > 3200 ? 200 : batchUnits > 1200 ? 125 : 80

  switch (detalleId) {
    case 101: return {
      txtProducto:    pl.descripcionMaterial,
      txtCodigo:      pl.codigoMaterial,
      txtLote:        pl.loteLogistico,
      txtOrden:       pl.numeroOrdenProceso,
      numTamanoLote:  pl.cantidadOrden,
    }
    case 102: return {
      numTotalTeorico: parseFloat(totalKg.toFixed(3)),
      dgPesaje: pl.componentes.map(c => ({
        txtMaterial:      c.descripcionMaterialComponente,
        txtCodigoMP:      c.codigoMaterialComponente,
        txtLoteProveedor: c.loteComponente,
        numCantTeorica:   c.cantidad,
      })),
    }
    case 103: return {}
    case 201: return {
      txtProducto:    pl.descripcionMaterial,
      txtCodigo:      pl.codigoMaterial,
      txtLote:        pl.loteLogistico,
      numProdTeorica: capsComp ? Math.round(capsComp.cantidad / 1000) : pl.cantidadOrden,
    }
    case 202: return {
      txtProducto: pl.descripcionMaterial,
      txtCodigo:   pl.codigoMaterial,
      txtLote:     pl.loteLogistico,
    }
    case 203: return {
      numProdTeorRef: capsComp ? Math.round(capsComp.cantidad / 1000) : pl.cantidadOrden,
    }
    case 301: return {
      numTamLoteInsp: Math.round(batchUnits),
      numMuestraAQL:  aqlSample,
    }
    case 302: return {
      numCapsIngreso: pl.unidadMedida === 'kg' ? pl.cantidadOrden : Math.round(batchUnits / 1000),
    }
    case 303: return {
      txtProducto:      pl.descripcionMaterial,
      txtCodigo:        pl.codigoMaterial,
      txtLote:          pl.loteLogistico,
      txtLoteInspCierre: pl.loteInspeccion,
    }
    default: return {}
  }
}

// Mock data for operator-entered fields (ambient conditions, equipment IDs, measurements, etc.)
// Merged into initialValues (iframe) and handlePrint fallback so forms look filled-in.
function buildMockManualData(detalleId: number, pl: PreLlenadoBR | null | undefined, brNum: number): Record<string, unknown> {
  if (!pl) return {}
  // Only populate mock data for detalles that have been signed in this BR
  const brFirmados = mockFirmadosBR[brNum] ?? {}
  if (!Object.keys(brFirmados).some(k => k.startsWith(`cie:${detalleId}:`))) return {}
  const brDates: Record<number, [string, string, string]> = {
    1: ['2025-11-05', '2025-11-05', '2025-11-06'],
    2: ['2025-12-14', '2025-12-15', '2025-12-16'],
    3: ['2026-01-22', '2026-01-23', '2026-01-24'],
    4: ['2026-02-05', '2026-02-06', '2026-02-07'],
    5: ['2026-03-12', '2026-03-12', '2026-03-12'],
  }
  const [d1, d2, d3] = brDates[brNum] ?? ['2026-01-01', '2026-01-02', '2026-01-03']

  switch (detalleId) {
    case 101: return {
      selSala:        'D01',
      txtResponsable: 'Operario Producción',
      txtBalanzaId:   'BAL-001',
      numTemperatura: 22.5,
      numHumedad:     48,
      dtInicioEtapa1: `${d1} 07:30:00`,
    }
    case 102: {
      const rows = pl.componentes.map((c, i) => ({
        txtMaterial:      c.descripcionMaterialComponente,
        txtCodigoMP:      c.codigoMaterialComponente,
        txtLoteProveedor: c.loteComponente,
        numCantTeorica:   c.cantidad,
        numCantPesada:    Math.round((c.cantidad * (1 + [0.0015, -0.001, 0.002, -0.0005, 0.0018][i % 5])) * 1000) / 1000,
        txtHoraPesaje:    ['08:45', '09:20', '09:55', '10:30', '11:05', '11:40'][i % 6],
      }))
      return {
        txtBalanzaPesaje:  'BAL-001',
        dtCalibBalanza:    '2025-06-15',
        dtVigenciaBalanza: '2026-06-15',
        dgPesaje: rows,
      }
    }
    case 103: return {
      dgChecklist: [
        { txtItem: '1', txtDescripcion: 'Las materias primas pesadas corresponden a la fórmula aprobada / Weighed raw materials correspond to the approved formula', selEstado: 'SI' },
        { txtItem: '2', txtDescripcion: 'Los contenedores de materias primas están correctamente identificados y etiquetados / RM containers are correctly identified and labeled', selEstado: 'SI' },
        { txtItem: '3', txtDescripcion: 'La balanza utilizada tiene calibración vigente / The scale used has a valid calibration', selEstado: 'SI' },
        { txtItem: '4', txtDescripcion: 'El área de dispensación fue limpiada y verificada antes del inicio / Dispensing area was cleaned and verified before start', selEstado: 'SI' },
        { txtItem: '5', txtDescripcion: 'Las condiciones ambientales cumplen especificaciones (T: 18–25°C, HR: 30–60%) / Environmental conditions meet specs', selEstado: 'SI' },
        { txtItem: '6', txtDescripcion: 'El rendimiento de dispensación está dentro del rango aceptado (99.0–101.0%) / Dispensing yield is within accepted range', selEstado: 'SI' },
        { txtItem: '7', txtDescripcion: 'El material IFA fue pesado en doble verificación / IFA was weighed with double check', selEstado: 'SI' },
        { txtItem: '8', txtDescripcion: 'Los recipientes dispensados fueron sellados y trasladados a producción / Dispensed containers were sealed and transferred to production', selEstado: 'SI' },
      ],
      dtCierreET1: `${d1} 11:30:00`,
    }
    case 201: return {
      selEquipo:            'CAP01',
      txtSerieEquipo:       '2022-GKF-001',
      selSalaProduccion:    'P01',
      txtOperadorPrincipal: 'Operario Producción',
      selTamanoCap:         '0',
      numVelocidadObj:      1500,
      numPesoObjetivo:      320,
      numLimiteAcept:       5,
      dgPreArranque: [
        { txtCheckItem: 'Máquina encapsuladora limpia (registro de limpieza disponible) / Clean encapsulator (cleaning record available)', selCheckRes: 'OK' },
        { txtCheckItem: 'Partes de contacto de producto instaladas correctamente / Product-contact parts correctly installed', selCheckRes: 'OK' },
        { txtCheckItem: 'Sistema de alimentación de cápsulas cargado y funcionando / Capsule feeding system loaded and running', selCheckRes: 'OK' },
        { txtCheckItem: 'Sistema de alimentación de polvo cargado / Powder feeding system loaded', selCheckRes: 'OK' },
        { txtCheckItem: 'Verificación de peso inicial con patrón / Initial weight verification with standard', selCheckRes: 'OK' },
        { txtCheckItem: 'Sistema de cierre y bandeja de rechazo funcionando / Closing system and rejection tray operational', selCheckRes: 'OK' },
      ],
      dtInicioEncap: `${d2} 07:00:00`,
    }
    case 202: return {
      numRSDMax: 2.0,
      dgCIP: [
        { txtHoraMuestreo: '08:00', numC1: 321.2, numC2: 319.8, numC3: 320.5, numC4: 318.9, numC5: 322.1, numC6: 319.4, numC7: 321.8, numC8: 320.2, numC9: 319.6, numC10: 320.8, numVelocidadActual: 1480 },
        { txtHoraMuestreo: '08:30', numC1: 320.4, numC2: 321.1, numC3: 319.7, numC4: 320.9, numC5: 318.5, numC6: 321.3, numC7: 320.0, numC8: 319.8, numC9: 321.6, numC10: 320.2, numVelocidadActual: 1500 },
        { txtHoraMuestreo: '09:00', numC1: 319.6, numC2: 320.3, numC3: 321.5, numC4: 319.2, numC5: 320.7, numC6: 321.9, numC7: 319.8, numC8: 320.5, numC9: 321.1, numC10: 320.0, numVelocidadActual: 1510 },
        { txtHoraMuestreo: '09:30', numC1: 321.0, numC2: 319.5, numC3: 320.8, numC4: 321.4, numC5: 319.9, numC6: 320.3, numC7: 321.7, numC8: 319.1, numC9: 320.6, numC10: 321.2, numVelocidadActual: 1495 },
      ],
    }
    case 203: return {
      dtFinEncap:      `${d2} 20:30:00`,
      numCapsulasProd: 312,
      numRechazos:     0.8,
    }
    case 301: return {
      selNivelInsp: 'II',
      txtInspector:  'Analista Calidad',
      dgInspeccion: [
        { txtSubLote: 'SL-001', txtHoraInsp: '09:00', numUnidInsp: 200, numDefCrit: 0, numDefMayor: 1, numDefMenor: 2 },
        { txtSubLote: 'SL-002', txtHoraInsp: '10:30', numUnidInsp: 200, numDefCrit: 0, numDefMayor: 0, numDefMenor: 3 },
        { txtSubLote: 'SL-003', txtHoraInsp: '12:00', numUnidInsp: 200, numDefCrit: 0, numDefMayor: 2, numDefMenor: 1 },
      ],
    }
    case 302: return {
      numBlistProd:  22320,
      numBlistRech:  12,
      numCajasProd:  22308,
      numCajasRech:  8,
      dgMatEmpaque: [
        { txtMatNombre: 'Lámina de Aluminio / Aluminum Foil', txtMatCodigo: 'EMP-001', txtMatLote: 'AL-2025-128', txtMatUnidad: 'm²',  numMatCantTeo: 580,   numMatCantUsada: 576  },
        { txtMatNombre: 'PVC Transparente / Clear PVC',       txtMatCodigo: 'EMP-002', txtMatLote: 'PV-2025-044', txtMatUnidad: 'm²',  numMatCantTeo: 580,   numMatCantUsada: 575  },
        { txtMatNombre: 'Caja Unitaria / Unit Box',           txtMatCodigo: 'EMP-003', txtMatLote: 'CB-2025-391', txtMatUnidad: 'unid', numMatCantTeo: 22400, numMatCantUsada: 22350 },
        { txtMatNombre: 'Prospecto / Package Insert',         txtMatCodigo: 'EMP-004', txtMatLote: 'PI-2025-200', txtMatUnidad: 'unid', numMatCantTeo: 22400, numMatCantUsada: 22340 },
      ],
      dtInicioEmpaque: `${d3} 07:30:00`,
      dtFinEmpaque:    `${d3} 17:00:00`,
      // Control de Pesos chart state (stored outside form.io)
      peso_min_spec: '9.5',
      peso_opt_spec: '10.0',
      peso_max_spec: '10.5',
      peso_ctrl_1: '9.98',  peso_ctrl_2:  '10.02', peso_ctrl_3: '9.95',
      peso_ctrl_4: '10.05', peso_ctrl_5:  '9.97',  peso_ctrl_6: '10.01',
      peso_ctrl_7: '10.03', peso_ctrl_8:  '9.96',  peso_ctrl_9: '10.00',
      peso_ctrl_10: '10.04',
    }
    case 303: return {
      dgCheckCierre: [
        { txtCheckCierreItem: 'Todos los formularios del batch record están completamente diligenciados / All batch record forms are fully completed', selCheckCierreRes: 'SI' },
        { txtCheckCierreItem: 'Las desviaciones detectadas tienen número asignado y están bajo investigación / Detected deviations have assigned numbers and are under investigation', selCheckCierreRes: 'NA' },
        { txtCheckCierreItem: 'El rendimiento global se encuentra dentro del rango especificado / Overall yield is within the specified range', selCheckCierreRes: 'SI' },
        { txtCheckCierreItem: 'Las muestras de retención fueron tomadas y enviadas a archivo / Retention samples were taken and sent to archive', selCheckCierreRes: 'SI' },
        { txtCheckCierreItem: 'Las muestras para control de calidad fueron enviadas al laboratorio / Quality control samples were sent to the laboratory', selCheckCierreRes: 'SI' },
        { txtCheckCierreItem: 'Los materiales sobrantes fueron devueltos correctamente etiquetados / Remaining materials were returned with correct labels', selCheckCierreRes: 'SI' },
        { txtCheckCierreItem: 'Las áreas de producción fueron limpiadas y liberadas para el próximo lote / Production areas were cleaned and released for next batch', selCheckCierreRes: 'SI' },
        { txtCheckCierreItem: 'El producto terminado fue cuarentenado pendiente liberación por Calidad / Finished product was quarantined pending Quality release', selCheckCierreRes: 'SI' },
      ],
      txtObsFinales: 'Lote fabricado sin incidencias significativas. Todas las etapas completadas conforme a Buenas Prácticas de Manufactura.',
    }
    default: return {}
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────
function parseSchema(jsonSchema: string): SchemaComp[] {
  if (!jsonSchema) return []
  try {
    const obj = JSON.parse(jsonSchema)
    return Array.isArray(obj?.components) ? (obj.components as SchemaComp[]) : []
  } catch { return [] }
}

function getFirmasDeEstrategia(idEF: number | undefined): EstrategiaFirmaItem[] {
  if (!idEF) return []
  const ef = mockEstrategiasFirma.find(e => e.id === idEF)
  return ef ? ef.firmas.filter(f => f.activo).sort((a, b) => a.orden - b.orden) : []
}

function buildInitialFirmados(): FirmaMap { return {} }

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
    // Comparación con JSON para detectar cambio real; display con formato legible
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
        {info.cargo}
      </div>
      <div style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--f-mono)', marginTop: 1,
        display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
        <i className="fa fa-calendar" style={{ fontSize: 8 }} />{info.fecha}
        <i className="fa fa-clock" style={{ fontSize: 8, marginLeft: 4 }} />{info.hora}
      </div>
    </div>
  )
}

// ── FormField ─────────────────────────────────────────────────────────────
function FormField({ comp, value, onChange, onCommit, locked }: {
  comp: SchemaComp
  value?: string
  onChange?: (v: string) => void
  onCommit?: (v: string) => void
  locked: boolean
}) {
  const [focused, setFocused] = useState(false)
  // onCommit fires on blur for text inputs; called directly on change for selects/radios
  const fp = {
    onFocus: () => setFocused(true),
    onBlur:  () => { setFocused(false); onCommit?.(value ?? '') },
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '9px 12px', boxSizing: 'border-box',
    border: `1.5px solid ${locked ? '#E9EAED' : focused ? 'var(--navy)' : '#CBD5E1'}`,
    borderRadius: 8, fontSize: 13.5, fontFamily: 'var(--f-sans)', outline: 'none',
    color: locked ? '#9CA3AF' : 'var(--ink)',
    background: locked ? '#F8FAFC' : '#fff',
    cursor: locked ? 'not-allowed' : 'text',
    transition: 'border-color 120ms, box-shadow 120ms',
    boxShadow: focused && !locked ? '0 0 0 3px rgba(10,45,99,0.09)' : 'none',
  }

  // ── Layout / structural types ──────────────────────────────────────────
  if (comp.type === 'heading') return (
    <div style={{ display:'flex', alignItems:'center', gap:10,
      marginTop:16, marginBottom:12, paddingBottom:10, borderBottom:'2px solid #EEF2F9' }}>
      <div style={{ width:3, height:18, borderRadius:2, background:'var(--navy)', flexShrink:0 }} />
      <span style={{ fontSize:12.5, fontWeight:700, color:'var(--navy)',
        textTransform:'uppercase', letterSpacing:'0.08em' }}>
        {comp.text}
      </span>
    </div>
  )

  if (comp.type === 'divider') return (
    <div style={{ margin:'6px 0 16px' }}>
      <hr style={{ border:'none', borderTop:'1.5px solid #EEF2F9', margin:0 }} />
    </div>
  )

  // form.io `content` type — headings, HTML blocks, images emitted by DetallesList builder
  const rawType = (comp as { type: string }).type
  if (rawType === 'content') {
    const html = (comp as { html?: string }).html ?? ''
    return (
      <div style={{ marginBottom:12, lineHeight:1.65, fontSize:13.5,
        color:'var(--ink)', fontFamily:'var(--f-sans)' }}
        dangerouslySetInnerHTML={{ __html: html }} />
    )
  }

  // ── Shared field meta ──────────────────────────────────────────────────
  const c    = comp as Record<string, unknown>
  const lbl  = c.label as string | undefined
  const key  = (c.key  as string | undefined) ?? ''
  const desc = c.description as string | undefined
  const req  = !!(c.required)

  const LBL = (
    <label style={{ display:'flex', alignItems:'center', gap:5, marginBottom:5,
      fontSize:12, fontWeight:600, letterSpacing:'0.01em',
      color: locked ? '#9CA3AF' : '#374151' }}>
      {lbl}
      {req  && <span style={{ color:'#EF4444', fontWeight:700, lineHeight:1 }}>*</span>}
      {locked && <i className="fa fa-lock" style={{ fontSize:8, color:'#D1D5DB', marginLeft:1 }} />}
    </label>
  )
  const DESC = desc
    ? <div style={{ fontSize:11.5, color:'#64748B', marginBottom:7, lineHeight:1.5 }}>{desc}</div>
    : null

  // ── Radio ──────────────────────────────────────────────────────────────
  if (rawType === 'radio') {
    const opts = (c.values as { label: string; value: string }[] | undefined) ?? []
    const inln = !!(c.inline)
    return (
      <div style={{ marginBottom:14 }}>
        {LBL}{DESC}
        <div style={{ display:'flex', flexDirection: inln ? 'row' : 'column',
          gap: inln ? 10 : 6, flexWrap:'wrap' }}>
          {opts.map(opt => (
            <label key={opt.value}
              style={{ display:'flex', alignItems:'center', gap:9,
                padding:'8px 13px', borderRadius:8, cursor: locked ? 'not-allowed' : 'pointer',
                border:`1.5px solid ${value===opt.value ? 'var(--navy)' : '#E2E8F0'}`,
                background: value===opt.value ? 'rgba(10,45,99,0.05)' : '#fff',
                transition:'border-color 100ms, background 100ms' }}>
              <input type="radio" name={key} value={opt.value}
                checked={value === opt.value} disabled={locked}
                onChange={() => { if (!locked) { onChange?.(opt.value); onCommit?.(opt.value) } }}
                style={{ accentColor:'var(--navy)', width:14, height:14,
                  cursor: locked ? 'not-allowed' : 'pointer', flexShrink:0 }} />
              <span style={{ fontSize:13.5, color: locked ? '#9CA3AF' : 'var(--ink)',
                fontWeight: value===opt.value ? 600 : 400 }}>
                {opt.label}
              </span>
            </label>
          ))}
        </div>
      </div>
    )
  }

  // ── Checkbox ───────────────────────────────────────────────────────────
  if (rawType === 'checkbox') {
    return (
      <div style={{ marginBottom:14 }}>
        <label style={{ display:'flex', alignItems:'center', gap:10,
          padding:'10px 13px', borderRadius:8, cursor: locked ? 'not-allowed' : 'pointer',
          border:`1.5px solid ${value==='true' ? 'var(--navy)' : '#E2E8F0'}`,
          background: value==='true' ? 'rgba(10,45,99,0.05)' : '#fff',
          transition:'border-color 100ms, background 100ms' }}>
          <input type="checkbox" checked={value === 'true'} disabled={locked}
            onChange={e => { if (!locked) { const v = e.target.checked ? 'true' : 'false'; onChange?.(v); onCommit?.(v) } }}
            style={{ accentColor:'var(--navy)', width:15, height:15,
              cursor: locked ? 'not-allowed' : 'pointer', flexShrink:0 }} />
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13.5, fontWeight:500, color: locked ? '#9CA3AF' : 'var(--ink)' }}>
              {lbl}{req && <span style={{ color:'#EF4444', marginLeft:3 }}>*</span>}
            </div>
            {desc && <div style={{ fontSize:11.5, color:'#64748B', marginTop:2 }}>{desc}</div>}
          </div>
          {locked && <i className="fa fa-lock" style={{ fontSize:9, color:'#D1D5DB', flexShrink:0 }} />}
        </label>
      </div>
    )
  }

  // ── Standard inputs ────────────────────────────────────────────────────
  const input = (() => {
    if (comp.type === 'textfield') return (
      <input type="text" style={inp} value={value ?? ''} readOnly={locked}
        placeholder={(c.placeholder as string | undefined)}
        onChange={e => !locked && onChange?.(e.target.value)} {...fp} />
    )
    if (comp.type === 'number') {
      const unit = (c.unit as string | undefined) ?? comp.unit
      return (
        <div style={{ display:'flex', alignItems:'stretch' }}>
          <input type="number" style={{ ...inp, flex:1, width:'auto',
            borderRadius: unit ? '8px 0 0 8px' : 8,
            borderRight: unit ? 'none' : undefined }}
            value={value ?? ''} readOnly={locked}
            onChange={e => !locked && onChange?.(e.target.value)} {...fp} />
          {unit && (
            <span style={{ display:'flex', alignItems:'center', padding:'0 14px',
              fontSize:12.5, color:'#64748B', fontFamily:'var(--f-mono)',
              background:'#F6F4EE', border:'1.5px solid #CBD5E1',
              borderRadius:'0 8px 8px 0', whiteSpace:'nowrap', flexShrink:0 }}>
              {unit}
            </span>
          )}
        </div>
      )
    }
    if (comp.type === 'select') return (
      <div style={{ position:'relative' }}>
        <select style={{ ...inp, appearance:'none', paddingRight:36,
          cursor: locked ? 'not-allowed' : 'pointer' }}
          value={value ?? ''} disabled={locked}
          onChange={e => { if (!locked) { onChange?.(e.target.value); onCommit?.(e.target.value) } }} {...fp}>
          <option value="">— seleccione —</option>
          {comp.options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <i className="fa fa-chevron-down"
          style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)',
            fontSize:10, color:'#94A3B8', pointerEvents:'none' }} />
      </div>
    )
    if (comp.type === 'textarea') return (
      <textarea style={{ ...inp, resize:'vertical', minHeight: Math.max((comp.rows ?? 2) * 28, 72) }}
        value={value ?? ''} readOnly={locked}
        onChange={e => !locked && onChange?.(e.target.value)} {...fp} />
    )
    if (comp.type === 'datetime') return (
      <input type="datetime-local" style={{ ...inp, cursor: locked ? 'not-allowed' : 'default' }}
        value={value ?? ''} readOnly={locked}
        onChange={e => { if (!locked) { onChange?.(e.target.value); onCommit?.(e.target.value) } }} {...fp} />
    )
    return null
  })()

  if (!input) return null

  return (
    <div style={{ marginBottom:14 }}>
      {LBL}
      {DESC}
      {input}
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
            <span>Se revocarán todas las firmas de esta sección y el cierre del detalle. Los campos quedarán editables para corrección.</span>
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

// ── FirmaModal ────────────────────────────────────────────────────────────
function FirmaModal({ firma, onConfirm, onClose }: {
  firma: { texto: string; grupo: string }
  onConfirm: (info: FirmaInfo) => void
  onClose: () => void
}) {
  const sessionUser = useAuthStore(s => s.user)
  const [login,   setLogin]   = useState(sessionUser?.login ?? '')
  const [pwd,     setPwd]     = useState('')
  const [show,    setShow]    = useState(false)
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const u = mockUsuarios.find(x => x.login === login.trim() || x.email === login.trim())
    if (!u)          { setError('Usuario no encontrado'); return }
    if (!u.activo)   { setError('Usuario inactivo'); return }
    if (u.bloqueado) { setError('Usuario bloqueado'); return }
    setLoading(true)
    try {
      const result = await batchRecordApi.validarFirma(u.login, pwd)
      if (!result.estado) { setError(result.mensaje); setLoading(false); return }
    } catch {
      setError('Error al validar credenciales'); setLoading(false); return
    }
    setLoading(false)
    if (u.esAdministrador !== 1) {
      const grupos = u.grupos.split(',').map(g => g.trim()).filter(Boolean)
      if (!grupos.includes(firma.grupo)) {
        setError(`"${u.nombres} ${u.apellidos}" no pertenece al grupo "${firma.grupo}"`)
        return
      }
    }
    const now = new Date()
    onConfirm({
      nombre: `${u.nombres} ${u.apellidos}`,
      cargo:  GRUPO_CARGO[firma.grupo] ?? firma.grupo,
      fecha:  now.toISOString().slice(0, 10),
      hora:   now.toTimeString().slice(0, 5),
      loginUsuario: u.login,
      idUsuario: u.idUsuario,
    })
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
            <div style={{ color:'#fff',fontWeight:700,fontSize:14 }}>Firma Electrónica</div>
            <div style={{ color:'#8FA5C9',fontSize:11 }}>Ingrese sus credenciales para firmar</div>
          </div>
          <button style={{ background:'rgba(255,255,255,.1)',border:'none',cursor:'pointer',color:'#fff',width:28,height:28,borderRadius:7,fontSize:16,display:'grid',placeItems:'center' }} onClick={onClose}>×</button>
        </div>
        <div style={{ padding:'12px 22px',background:'var(--paper-2)',borderBottom:'1px solid var(--hair)' }}>
          <div style={{ fontSize:13,fontWeight:600,color:'var(--ink-2)',marginBottom:4 }}>{firma.texto}</div>
          <div style={{ display:'flex',alignItems:'center',gap:6 }}>
            <i className="fa fa-users" style={{ color:'var(--navy)',fontSize:11 }} />
            <span style={{ fontSize:11.5,color:'var(--ink-3)' }}>Grupo requerido:</span>
            <span style={{ fontSize:11.5,fontWeight:700,padding:'1px 9px',borderRadius:20,background:'var(--navy)',color:'#fff' }}>{firma.grupo}</span>
            <span style={{ fontSize:11,color:'var(--ink-4)',marginLeft:4 }}>({GRUPO_CARGO[firma.grupo] ?? firma.grupo})</span>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ padding:'18px 22px',display:'flex',flexDirection:'column',gap:14 }}>
            <div>
              <label style={{ display:'block',fontSize:12.5,fontWeight:600,color:'var(--ink-2)',marginBottom:5 }}>
                Usuario <span style={{ color:'var(--orange)',fontWeight:400 }}>(requerido)</span>
              </label>
              <input className="form-control" value={login} autoFocus
                onChange={e => { setLogin(e.target.value); setError('') }}
                placeholder="login o correo electrónico" />
            </div>
            <div>
              <label style={{ display:'block',fontSize:12.5,fontWeight:600,color:'var(--ink-2)',marginBottom:5 }}>
                Contraseña <span style={{ color:'var(--orange)',fontWeight:400 }}>(requerida)</span>
              </label>
              <div style={{ position:'relative' }}>
                <input type={show ? 'text' : 'password'} className="form-control" value={pwd}
                  onChange={e => { setPwd(e.target.value); setError('') }}
                  placeholder="••••••••" style={{ paddingRight:36 }} />
                <button type="button"
                  style={{ position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'var(--ink-4)' }}
                  onClick={() => setShow(s => !s)}>
                  {show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            {error && (
              <div style={{ padding:'8px 12px',background:'#fef2f2',border:'1.5px solid #fecaca',borderRadius:'var(--r-sm)',fontSize:12.5,color:'#b91c1c',display:'flex',alignItems:'center',gap:7 }}>
                <i className="fa fa-exclamation-circle" />{error}
              </div>
            )}
          </div>
          <div style={{ padding:'14px 22px',borderTop:'1px solid var(--hair)',display:'flex',justifyContent:'flex-end',gap:8 }}>
            <button type="button" className="btn btn-gray" onClick={onClose}><i className="fa fa-undo" /> Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={!login || !pwd || loading}>
              {loading ? <><i className="fa fa-spinner fa-spin" /> Validando...</> : <><i className="fa fa-pen" /> Firmar</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── FirmaSeccionBlockPanel ────────────────────────────────────────────────
function FirmaSeccionBlockPanel({ block, blockIdx, detalleId, firmados, readonly, onFirmar, onRequestDerogar }: {
  block: SchemaComp & { type: 'firma-seccion' }
  blockIdx: number
  detalleId: number
  firmados: FirmaMap
  readonly: boolean
  onFirmar: (tipo: 'seccion' | 'cierre', firmaKey: string, texto: string, grupo: string) => void
  onRequestDerogar?: (firmaKey: string, blockKey: string, firmaInfo: FirmaInfo, texto: string, grupo: string) => void
}) {
  const user = useAuthStore(s => s.user)
  const ef = mockEstrategiasFirma.find(e => e.id === block.idEstrategiaFirma)
  const userGrupos = (user?.grupos ?? '').split(',').map(g => g.trim())
  const puedeDerog = !readonly && !!(
    user?.esAdministrador ||
    (ef?.gruposDerogacion ?? []).some(g => userGrupos.includes(g))
  )

  const firmas = getFirmasDeEstrategia(block.idEstrategiaFirma)
  const firmadas = firmas.filter(f => !!firmados[`sec:${detalleId}:${block.key}:${f.idFirma}`]).length
  const todasFirmadas = firmas.length > 0 && firmadas === firmas.length

  return (
    <div style={{ border:'1.5px solid #DDD6FE',borderRadius:8,overflow:'hidden',marginBottom:12 }}>
      <div style={{ display:'flex',alignItems:'center',gap:8,padding:'7px 12px',
        background: todasFirmadas ? 'rgba(52,211,153,.08)' : '#F5F3FF',
        borderBottom:'1px solid #EDE9FE' }}>
        <div style={{ width:22,height:22,borderRadius:'50%',flexShrink:0,
          background: todasFirmadas ? 'var(--forest)' : '#7C3AED',
          color:'#fff',display:'grid',placeItems:'center',fontSize:10,fontWeight:700,fontFamily:'var(--f-mono)' }}>
          {todasFirmadas ? <i className="fa fa-check" style={{ fontSize:9 }} /> : blockIdx + 1}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:12.5,fontWeight:700,color: todasFirmadas ? 'var(--forest)' : '#5B21B6' }}>{block.label}</div>
          <div style={{ fontSize:10.5,color:'#9CA3AF',fontFamily:'var(--f-mono)' }}>{firmadas}/{firmas.length} firma{firmas.length !== 1 ? 's' : ''}</div>
        </div>
      </div>
      {firmas.map((firma, i) => {
        const firmaKey  = `sec:${detalleId}:${block.key}:${firma.idFirma}`
        const firmaInfo = firmados[firmaKey]
        const prevOk    = i === 0 || !!firmados[`sec:${detalleId}:${block.key}:${firmas[i - 1].idFirma}`]
        const bloqueado = !prevOk && !firmaInfo
        return (
          <div key={firma.idFirma} style={{ display:'flex',alignItems:'flex-start',gap:12,padding:'10px 12px',
            flexWrap:'wrap',
            borderTop: i > 0 ? '1px solid #EDE9FE' : 'none',
            background: firmaInfo ? 'rgba(52,211,153,.04)' : bloqueado ? 'rgba(0,0,0,.02)' : '#fff',
            opacity: bloqueado ? 0.5 : 1,transition:'opacity 200ms' }}>
            <div style={{ width:20,height:20,borderRadius:'50%',flexShrink:0,marginTop:1,
              background: firmaInfo ? 'var(--forest)' : '#7C3AED',
              color:'#fff',display:'grid',placeItems:'center',fontSize:10,fontWeight:700,fontFamily:'var(--f-mono)' }}>
              {firmaInfo ? <i className="fa fa-check" style={{ fontSize:8 }} /> : firma.orden}
            </div>
            <div style={{ flex:1,minWidth:0 }}>
              <div style={{ fontSize:12.5,fontWeight:600,color: firmaInfo ? 'var(--forest)' : 'var(--ink-2)' }}>{firma.texto}</div>
              <div style={{ fontSize:10.5,color:'var(--ink-4)',fontFamily:'var(--f-mono)' }}>
                Grupo: {firma.grupo} · {GRUPO_CARGO[firma.grupo] ?? firma.grupo}
              </div>
            </div>
            {firmaInfo
              ? (
                <div style={{ display:'flex',alignItems:'flex-start',gap:6,flexShrink:0 }}>
                  <FirmaStamp info={firmaInfo} />
                  {puedeDerog && onRequestDerogar && (
                    <button title="Derogar firma"
                      style={{ marginTop:2,background:'#FEE2E2',border:'1px solid #FECACA',borderRadius:6,padding:'4px 7px',cursor:'pointer',color:'#DC2626',fontSize:11,flexShrink:0 }}
                      onClick={() => onRequestDerogar(firmaKey, block.key, firmaInfo, firma.texto, firma.grupo)}>
                      <i className="fa fa-undo" />
                    </button>
                  )}
                </div>
              )
              : (!readonly && !bloqueado && (
                  <button className="btn btn-warning" style={{ fontSize:12,flexShrink:0 }}
                    onClick={() => onFirmar('seccion', firmaKey, firma.texto, firma.grupo)}>
                    <i className="fa fa-pen" /> Firmar
                  </button>
                ))
            }
          </div>
        )
      })}
    </div>
  )
}

// ── FormioFrame ───────────────────────────────────────────────────────────
interface FormioRangeError { key: string; label: string; message: string }

function FormioFrame({ schema, locked = false, lockedKeys, onDataChange, getInitialData, onValidation }: {
  schema: string
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
  // Siempre apunta a la versión más reciente del callback — se actualiza con re-renders
  const getInitialDataRef = useRef(getInitialData)

  useEffect(() => { onDataChangeRef.current = onDataChange }, [onDataChange])
  useEffect(() => { onValidationRef.current = onValidation }, [onValidation])
  useEffect(() => { getInitialDataRef.current = getInitialData }, [getInitialData])

  // Enviar LOCK_FORM cuando locked cambia a true (solo una vez)
  useEffect(() => {
    if (locked && !lockedRef.current) {
      lockedRef.current = true
      ref.current?.contentWindow?.postMessage({ type: 'LOCK_FORM' }, '*')
    }
    if (!locked) {
      lockedRef.current = false
    }
  }, [locked])

  useEffect(() => {
    const frame = ref.current
    if (!frame) return

    const send = () => {
      // Leer en el momento en que el iframe termina de cargar — siempre tiene los datos más recientes
      const data = getInitialDataRef.current?.() ?? {}
      const hasData = Object.keys(data).length > 0
      if (hasData) {
        frame.contentWindow?.postMessage({
          type: 'RENDER_JSON_WITH_DATA',
          value: schema,
          data: JSON.stringify({ data }),
          lockedKeys: lockedKeys ?? [],
        }, '*')
      } else {
        frame.contentWindow?.postMessage({ type: 'RENDER_JSON', value: schema }, '*')
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
  }, [schema])

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
      // Required fields inside a datagrid must be validated per-row, not flat
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
function DesviacionModal({ error, valorIngresado, brId, detalleId, detalleCode, onSubmit, onClose }: {
  error: FormioRangeError
  valorIngresado: string
  brId: number
  detalleId: number
  detalleCode: string
  onSubmit: (desc: string) => void
  onClose: () => void
}) {
  // detalleId used for future server-side logging
  void detalleId
  void brId
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
        {/* Header */}
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
function DetalleCard({ detalle, readonly, firmados, onFirmar, initialValues, lockedKeys, onSave, onRequestDerogar, onFormData, preLlenado, brId }: {
  detalle: DetalleRow
  readonly: boolean
  firmados: FirmaMap
  onFirmar: (tipo: 'seccion' | 'cierre', firmaKey: string, texto: string, grupo: string) => void
  initialValues?: Record<string, unknown>
  lockedKeys?: string[]
  onSave?: (detalleId: number, prev: Record<string,string>, next: Record<string,string>, labels: Record<string,string>) => void
  onRequestDerogar?: (firmaKey: string, blockKey: string, detalleId: number, firmaInfo: FirmaInfo, texto: string, grupo: string) => void
  onFormData?: (detalleId: number, prev: Record<string,unknown>, next: Record<string,unknown>, labels: Record<string,string>) => void
  preLlenado?: PreLlenadoBR | null
  brId?: string | number
}) {
  const user = useAuthStore(s => s.user)
  const [open, setOpen] = useState(false)
  const scalarInitial = Object.fromEntries(
    Object.entries(initialValues ?? {}).filter(([, v]) => typeof v === 'string' || typeof v === 'number')
      .map(([k, v]) => [k, String(v)])
  ) as Record<string, string>
  const [values,       setValues]       = useState<Record<string, string>>(scalarInitial)
  const [committed,    setCommitted]    = useState<Record<string, string>>(scalarInitial)
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const [rangeErrors,  setRangeErrors]  = useState<FormioRangeError[]>([])
  const [desviacionModal, setDesviacionModal] = useState<{ error: FormioRangeError; valorIngresado: string } | null>(null)
  const [localDesviaciones, setLocalDesviaciones] = useState<Desviacion[]>([])
  const numBrId = typeof brId === 'string' ? parseInt(brId, 10) : (brId ?? 0)

  const lsKey = null  // datos del batch record no se persisten entre sesiones
  const savedDataRef = useRef<Record<string, unknown>>({})

  // Callback que FormioFrame llama al cargar: prioriza datos guardados, cae a initialValues
  const getInitialData = useCallback((): Record<string, unknown> => {
    if (Object.keys(savedDataRef.current).length > 0) return savedDataRef.current
    return initialValues
      ? Object.fromEntries(Object.entries(initialValues)) as Record<string, unknown>
      : {}
  }, [initialValues])

  // ── Control de Pesos (detalle 302 only) ─────────────────────────────────
  const PESO_N = 10
  const [pesoSpec, setPesoSpec] = useState<{ min: string; opt: string; max: string }>({
    min: String(savedDataRef.current.peso_min_spec ?? ''),
    opt: String(savedDataRef.current.peso_opt_spec ?? ''),
    max: String(savedDataRef.current.peso_max_spec ?? ''),
  })
  const [pesos, setPesos] = useState<string[]>(
    Array.from({ length: PESO_N }, (_, i) => String(savedDataRef.current[`peso_ctrl_${i + 1}`] ?? ''))
  )

  // Sync peso states from initialValues when savedDataRef is empty (first load with mock data)
  useEffect(() => {
    if (detalle.id !== 302) return
    if (Object.keys(savedDataRef.current).length > 0) return
    if (!initialValues?.peso_min_spec) return
    setPesoSpec({
      min: String(initialValues.peso_min_spec ?? ''),
      opt: String(initialValues.peso_opt_spec ?? ''),
      max: String(initialValues.peso_max_spec ?? ''),
    })
    setPesos(Array.from({ length: PESO_N }, (_, i) =>
      String(initialValues[`peso_ctrl_${i + 1}`] ?? '')
    ))
  }, [initialValues, detalle.id])

  const savePesoData = (spec: typeof pesoSpec, vals: string[]) => {
    Object.assign(savedDataRef.current, {
      peso_min_spec: spec.min,
      peso_opt_spec: spec.opt,
      peso_max_spec: spec.max,
      ...Object.fromEntries(vals.map((v, i) => [`peso_ctrl_${i + 1}`, v])),
    })
    if (lsKey) try { localStorage.setItem(lsKey, JSON.stringify(savedDataRef.current)) } catch {}
  }

  // Tracking de datos del iframe para audit trail.
  // El baseline se fija desde el dato real inicial (guardado o {}), NO desde el primer
  // mensaje recibido del iframe — un formulario en blanco nunca emite un "eco" inicial,
  // por lo que tratar el primer mensaje como baseline descartaba silenciosamente el
  // primer valor que el usuario realmente ingresaba.
  const prevDataRef    = useRef<Record<string, unknown>>(getInitialData())
  const labelsRef      = useRef<Record<string, string>>(extractFieldLabels(detalle.jsonSchema ?? ''))
  const onFormDataRef  = useRef(onFormData)
  useEffect(() => { onFormDataRef.current = onFormData }, [onFormData])

  const handleIframeData = useCallback((data: Record<string, unknown>) => {
    if (readonly) return
    savedDataRef.current = data
    setValidationErrors([])
    const prev = prevDataRef.current
    // Siempre notificar al padre para mantener el snapshot de print actualizado
    onFormDataRef.current?.(detalle.id, prev, data, labelsRef.current)
    const cambios = diffFormData(prev, data, labelsRef.current)
    if (cambios.length > 0) {
      prevDataRef.current = { ...data }
    }
  }, [readonly, detalle.id, detalle.jsonSchema])

  const efCierre = mockEstrategiasFirma.find(e => e.id === detalle.idEstrategiaFirma)
  const userGruposCierre = (user?.grupos ?? '').split(',').map(g => g.trim())
  const puedeDerogCierre = !readonly && !!(
    user?.esAdministrador ||
    (efCierre?.gruposDerogacion ?? []).some(g => userGruposCierre.includes(g))
  )

  const firmasCierre = getFirmasDeEstrategia(detalle.idEstrategiaFirma)
  const comps = parseSchema(detalle.jsonSchema ?? '')

  // Segmentos separados por firma-seccion
  type Seg = { fields: SchemaComp[]; fs: (SchemaComp & { type: 'firma-seccion' }) | null }
  const segments: Seg[] = []
  let cur: SchemaComp[] = []
  for (const c of comps) {
    if (c.type === 'firma-seccion') { segments.push({ fields: cur, fs: c }); cur = [] }
    else cur.push(c)
  }
  if (cur.length > 0 || segments.length === 0) segments.push({ fields: cur, fs: null })

  const isFSDone = (fs: SchemaComp & { type: 'firma-seccion' }) => {
    const f = getFirmasDeEstrategia(fs.idEstrategiaFirma)
    return f.length > 0 && f.every(x => !!firmados[`sec:${detalle.id}:${fs.key}:${x.idFirma}`])
  }
  const isSegLocked = (segIdx: number) => {
    if (readonly) return true
    const thisFS = segments[segIdx].fs
    return thisFS ? isFSDone(thisFS) : false
  }

  const allFS      = comps.filter((c): c is SchemaComp & { type: 'firma-seccion' } => c.type === 'firma-seccion')
  const totalSecF  = allFS.reduce((n, fs) => n + getFirmasDeEstrategia(fs.idEstrategiaFirma).length, 0)
  const doneSecF   = allFS.reduce((n, fs) =>
    n + getFirmasDeEstrategia(fs.idEstrategiaFirma).filter(f => !!firmados[`sec:${detalle.id}:${fs.key}:${f.idFirma}`]).length, 0)
  const allSecDone = totalSecF === 0 || doneSecF === totalSecF

  const cierFirmadas = firmasCierre.filter(f => !!firmados[`cie:${detalle.id}:${f.idFirma}`]).length
  const allCierDone  = firmasCierre.length > 0 && cierFirmadas === firmasCierre.length

  const handleFirmar = (tipo: 'seccion' | 'cierre', firmaKey: string, texto: string, grupo: string) => {
    // Block cierre if yield is out of spec on ET2-F3
    if (tipo === 'cierre' && detalle.id === 203) {
      const rawReal = savedDataRef.current['rendimiento_real'] as string | undefined
      const real    = rawReal ? parseFloat(rawReal) : NaN
      const teorico = (savedDataRef.current['_teorico'] as number | undefined) ?? 0
      if (!isNaN(real) && teorico > 0 && (real / teorico) * 100 < 95) {
        setValidationErrors([{ label: 'Rendimiento < 95% — registre nota de desviación antes de firmar' }])
        return
      }
    }
    const missing = missingRequired(detalle.jsonSchema ?? '', savedDataRef.current)
    if (missing.length > 0) {
      setValidationErrors(missing)
      return
    }
    setValidationErrors([])
    onFirmar(tipo, firmaKey, texto, grupo)
  }

  const handleFieldCommit = (key: string, val: string, label: string) => {
    if (readonly) return
    const prev = committed[key] ?? ''
    if (val === prev) return
    onSave?.(detalle.id, { [key]: prev }, { [key]: val }, { [key]: label })
    setCommitted(c => ({ ...c, [key]: val }))
  }

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
        {/* Status circle */}
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

        {/* Title + signed sub */}
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

        {/* Pip dots — one per firma */}
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

        {/* Firmado badge */}
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

          {/* Pre-llenado ET1-F1: Encabezado */}
          {preLlenado && detalle.id === 101 && (
            <div style={{ margin: '12px 14px', padding: '12px 16px', background: '#EFF6FF',
              borderRadius: 10, border: '1px solid #BFDBFE' }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: '#1E40AF', textTransform: 'uppercase',
                letterSpacing: '.07em', marginBottom: 10 }}>
                <i className="fa fa-database" style={{ marginRight: 6 }} />
                Datos pre-llenados desde la Orden de Proceso
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                {([
                  ['Orden de Proceso',   preLlenado.numeroOrdenProceso],
                  ['Producto',           preLlenado.descripcionMaterial],
                  ['Código Material',    preLlenado.codigoMaterial],
                  ['Número de Lote',     preLlenado.loteLogistico],
                  ['Lote Inspección',    preLlenado.loteInspeccion],
                  ['Fecha Fabricación',  preLlenado.fechaFabricacion],
                  ['Fecha Caducidad',    preLlenado.fechaCaducidad],
                  ['Reg. Sanitario',     preLlenado.registroSanitario],
                  ['Forma Farmacéutica', preLlenado.formaFarmaceutica],
                  ['Tamaño de Lote',     `${preLlenado.cantidadOrden.toLocaleString('es-CO')} ${preLlenado.unidadMedida}`],
                  ['Centro',             preLlenado.centro],
                ] as [string, string][]).map(([lbl, val]) => (
                  <div key={lbl} style={{ padding: '6px 14px', borderRight: '1px solid #BFDBFE', flexShrink: 0 }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: '#60A5FA',
                      textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>{lbl}</div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1E3A8A',
                      fontFamily: 'var(--f-mono)' }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pre-llenado ET1-F2: Pesaje */}
          {preLlenado && detalle.id === 102 && preLlenado.componentes.length > 0 && (
            <div style={{ margin: '12px 14px', padding: '12px 16px', background: '#EFF6FF',
              borderRadius: 10, border: '1px solid #BFDBFE' }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: '#1E40AF', textTransform: 'uppercase',
                letterSpacing: '.07em', marginBottom: 10 }}>
                <i className="fa fa-database" style={{ marginRight: 6 }} />
                Materias primas pre-llenadas desde la OP — {preLlenado.componentes.length} componentes
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {['Código', 'Descripción', 'Cant. Teórica', 'UM', 'Lote'].map(h => (
                      <th key={h} style={{ background: '#DBEAFE', padding: '5px 10px', textAlign: 'left',
                        fontSize: 9.5, fontWeight: 700, color: '#1E40AF',
                        textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preLlenado.componentes.map(c => (
                    <tr key={c.idComponente}>
                      <td style={{ padding: '5px 10px', borderTop: '1px solid #BFDBFE',
                        fontFamily: 'var(--f-mono)', fontWeight: 700, color: '#1E3A8A', fontSize: 11.5 }}>
                        {c.codigoMaterialComponente}
                      </td>
                      <td style={{ padding: '5px 10px', borderTop: '1px solid #BFDBFE', color: '#334155' }}>
                        {c.descripcionMaterialComponente}
                      </td>
                      <td style={{ padding: '5px 10px', borderTop: '1px solid #BFDBFE',
                        textAlign: 'right', fontFamily: 'var(--f-mono)', fontWeight: 600, color: '#1E3A8A' }}>
                        {c.cantidad.toLocaleString('es-CO', { maximumFractionDigits: 4 })}
                      </td>
                      <td style={{ padding: '5px 10px', borderTop: '1px solid #BFDBFE', color: '#64748B' }}>
                        {c.unidadMedida}
                      </td>
                      <td style={{ padding: '5px 10px', borderTop: '1px solid #BFDBFE',
                        fontFamily: 'var(--f-mono)', color: '#64748B', fontSize: 11 }}>
                        {c.loteComponente}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pre-llenado ET1-F3: resumen de dispensación */}
          {preLlenado && detalle.id === 103 && (() => {
            const kgComps   = preLlenado.componentes.filter(c => c.unidadMedida === 'kg')
            const unComps   = preLlenado.componentes.filter(c => c.unidadMedida === 'un')
            const otherComps = preLlenado.componentes.filter(c => c.unidadMedida !== 'kg' && c.unidadMedida !== 'un')
            const totalKg   = kgComps.reduce((s, c) => s + c.cantidad, 0)
            return (
              <div style={{ margin: '12px 14px', padding: '12px 16px', background: '#F0FDF4', borderRadius: 10, border: '1px solid #BBF7D0' }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#15803D', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>
                  <i className="fa fa-check-circle" style={{ marginRight: 6 }} />
                  Resumen de Dispensación — Verificar vs. cantidades pesadas
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                  {[
                    ['Total Comp. (kg)', `${kgComps.length} mat.`],
                    ['Masa Total Teórica', `${totalKg.toLocaleString('es-CO', { maximumFractionDigits: 3 })} kg`],
                    ...(unComps.length > 0 ? [['Comp. Unitarios', `${unComps.reduce((s, c) => s + c.cantidad, 0).toLocaleString('es-CO')} un`]] : []),
                    ...(otherComps.length > 0 ? [['Otros Comp.', `${otherComps.length} ítem(s)`]] : []),
                    ['Lote Logístico', preLlenado.loteLogistico],
                    ['Lote Inspección', preLlenado.loteInspeccion],
                    ['Centro', preLlenado.centro],
                  ].map(([lbl, val]) => (
                    <div key={lbl} style={{ padding: '6px 14px', borderRight: '1px solid #BBF7D0', flexShrink: 0 }}>
                      <div style={{ fontSize: 9.5, fontWeight: 700, color: '#15803D', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>{lbl}</div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#14532D', fontFamily: 'var(--f-mono)' }}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* Pre-llenado ET2-F1: datos de producto para configuración de encapsuladora */}
          {preLlenado && detalle.id === 201 && (() => {
            const capsComp = preLlenado.componentes.find(c => /CAP|caps/i.test(c.codigoMaterialComponente))
            const capsulas = capsComp ? capsComp.cantidad.toLocaleString('es-CO') + ' un' : `~${(preLlenado.cantidadOrden * 1000).toLocaleString('es-CO')} un`
            return (
              <div style={{ margin: '12px 14px', padding: '12px 16px', background: '#EFF6FF', borderRadius: 10, border: '1px solid #BFDBFE' }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#1E40AF', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>
                  <i className="fa fa-cog" style={{ marginRight: 6 }} />
                  Datos del Producto para Configuración de Encapsuladora
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                  {[
                    ['Producto',              preLlenado.descripcionMaterial],
                    ['Forma Farmacéutica',    preLlenado.formaFarmaceutica],
                    ['Tamaño de Lote',        `${preLlenado.cantidadOrden.toLocaleString('es-CO')} ${preLlenado.unidadMedida}`],
                    ['Cápsulas Teóricas',     capsulas],
                    ['Lote Logístico',        preLlenado.loteLogistico],
                    ['Lote Inspección',       preLlenado.loteInspeccion],
                    ['Registro Sanitario',    preLlenado.registroSanitario],
                  ].map(([lbl, val]) => (
                    <div key={lbl} style={{ padding: '6px 14px', borderRight: '1px solid #BFDBFE', flexShrink: 0 }}>
                      <div style={{ fontSize: 9.5, fontWeight: 700, color: '#60A5FA', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>{lbl}</div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1E3A8A', fontFamily: 'var(--f-mono)' }}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* Pre-llenado ET2-F2: Control en Proceso — referencia de parámetros */}
          {preLlenado && detalle.id === 202 && (() => {
            const capsComp = preLlenado.componentes.find(c => /CAP|caps/i.test(c.codigoMaterialComponente))
            const capsulas = capsComp ? capsComp.cantidad.toLocaleString('es-CO') : `~${(preLlenado.cantidadOrden * 1000).toLocaleString('es-CO')}`
            return (
              <div style={{ margin: '12px 14px', padding: '12px 16px', background: '#FFF7ED', borderRadius: 10, border: '1px solid #FED7AA' }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#C2410C', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>
                  <i className="fa fa-tasks" style={{ marginRight: 6 }} />
                  Control en Proceso — Datos de Referencia
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                  {[
                    ['Producto',            preLlenado.descripcionMaterial],
                    ['Forma Farmacéutica',  preLlenado.formaFarmaceutica],
                    ['Lote',                preLlenado.loteLogistico],
                    ['Cápsulas a Producir', `${capsulas} un`],
                    ['Lote Inspección',     preLlenado.loteInspeccion],
                  ].map(([lbl, val]) => (
                    <div key={lbl} style={{ padding: '6px 14px', borderRight: '1px solid #FED7AA', flexShrink: 0 }}>
                      <div style={{ fontSize: 9.5, fontWeight: 700, color: '#EA580C', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>{lbl}</div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#7C2D12', fontFamily: 'var(--f-mono)' }}>{val}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 10, padding: '7px 10px', background: '#FEF3C7', borderRadius: 7, fontSize: 11.5, color: '#92400E', display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                  <i className="fa fa-info-circle" style={{ marginTop: 1 }} />
                  <span>Los parámetros de peso objetivo y límites (numPesoObjetivo, numLimInfCIP, numLimSupCIP) se toman automáticamente del formulario ET2-F1 mediante <code>calculateValue</code>. Registre muestras cada 30 min durante el proceso.</span>
                </div>
              </div>
            )
          })()}

          {/* Pre-llenado ET2-F3 lote inspección (antes del yield calculator) */}
          {preLlenado && detalle.id === 203 && (
            <div style={{ margin: '12px 14px 0', padding: '8px 16px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0', display: 'flex', gap: 0, flexWrap: 'wrap' }}>
              {[
                ['Producto',       preLlenado.descripcionMaterial],
                ['Lote',           preLlenado.loteLogistico],
                ['Lote Insp.',     preLlenado.loteInspeccion],
                ['Cant. Teórica', `${preLlenado.cantidadOrden.toLocaleString('es-CO')} ${preLlenado.unidadMedida}`],
              ].map(([lbl, val]) => (
                <div key={lbl} style={{ padding: '5px 12px', borderRight: '1px solid #E2E8F0', flexShrink: 0 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 1 }}>{lbl}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', fontFamily: 'var(--f-mono)' }}>{val}</div>
                </div>
              ))}
            </div>
          )}

          {/* ── Yield calculator ET2-F3 ── */}
          {preLlenado && detalle.id === 203 && !readonly && (() => {
            const teorico = preLlenado.cantidadOrden
            const um      = preLlenado.unidadMedida
            const rawReal = savedDataRef.current['rendimiento_real'] as string | undefined
            const real    = rawReal ? parseFloat(rawReal) : NaN
            const pct     = !isNaN(real) && teorico > 0 ? (real / teorico) * 100 : null
            const bgColor = pct === null ? '#F8FAFC' : pct >= 98 ? '#F0FDF4' : pct >= 95 ? '#FFFBEB' : '#FEF2F2'
            const bdColor = pct === null ? '#E2E8F0' : pct >= 98 ? '#BBF7D0' : pct >= 95 ? '#FDE68A' : '#FECACA'
            const txColor = pct === null ? '#64748B' : pct >= 98 ? '#15803D' : pct >= 95 ? '#92400E' : '#991B1B'
            const label   = pct === null ? '—' : pct >= 98 ? '✓ CONFORME' : pct >= 95 ? '⚠ REVISAR' : '✕ FUERA DE SPEC'
            const blocked = pct !== null && pct < 95
            return (
              <div style={{ margin: '12px 14px', padding: '14px 16px', background: bgColor, borderRadius: 10, border: `1.5px solid ${bdColor}` }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: txColor, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 12 }}>
                  <i className="fa fa-chart-bar" style={{ marginRight: 6 }} />
                  Cálculo de Rendimiento de Encapsulación
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>
                      Cant. Teórica ({um})
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', fontFamily: 'var(--f-mono)' }}>
                      {teorico.toLocaleString('es-CO')}
                    </div>
                  </div>
                  <div style={{ fontSize: 20, color: '#CBD5E1', fontWeight: 300, paddingBottom: 4 }}>→</div>
                  <div>
                    <label style={{ display: 'block', fontSize: 9.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>
                      Cant. Real ({um}) <span style={{ color: '#DC2626' }}>*</span>
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      min={0}
                      max={teorico * 1.05}
                      style={{ width: 140, padding: '8px 12px', border: `1.5px solid ${bdColor}`, borderRadius: 8, fontSize: 14, fontFamily: 'var(--f-mono)', fontWeight: 700, outline: 'none', background: '#fff' }}
                      value={rawReal ?? ''}
                      onChange={e => {
                        savedDataRef.current = { ...savedDataRef.current, rendimiento_real: e.target.value, _teorico: teorico }
                        if (lsKey) { try { localStorage.setItem(lsKey, JSON.stringify(savedDataRef.current)) } catch {} }
                        setValidationErrors([]) // trigger re-render
                      }}
                      placeholder={`0 – ${teorico}`}
                    />
                  </div>
                  <div style={{ fontSize: 20, color: '#CBD5E1', fontWeight: 300, paddingBottom: 4 }}>=</div>
                  <div>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: txColor, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Rendimiento %</div>
                    <div style={{ fontSize: 26, fontWeight: 900, color: txColor, fontFamily: 'var(--f-mono)', lineHeight: 1 }}>
                      {pct !== null ? `${pct.toFixed(2)}%` : '—'}
                    </div>
                  </div>
                  {pct !== null && (
                    <div style={{ padding: '6px 14px', borderRadius: 20, background: bgColor, border: `1.5px solid ${bdColor}`, fontSize: 11.5, fontWeight: 800, color: txColor, letterSpacing: '.04em', alignSelf: 'flex-end', marginBottom: 4 }}>
                      {label}
                    </div>
                  )}
                </div>
                {blocked && (
                  <div style={{ marginTop: 12, padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 12, color: '#991B1B', display: 'flex', gap: 7, alignItems: 'center' }}>
                    <i className="fa fa-exclamation-triangle" />
                    Rendimiento &lt; 95% — Se requiere nota de desviación antes de firmar el cierre.
                  </div>
                )}
                {blocked && (
                  <input type="hidden" data-yield-blocked="true" />
                )}
              </div>
            )
          })()}

          {/* Pre-llenado ET3-F1: nivel AQL calculado dinámicamente */}
          {preLlenado && detalle.id === 301 && (() => {
            const capsComp  = preLlenado.componentes.find(c => /CAP|caps/i.test(c.codigoMaterialComponente))
            const batchUnits = capsComp ? capsComp.cantidad : preLlenado.cantidadOrden * 1000
            const sampleSize = batchUnits > 150000 ? 800 : batchUnits > 35000 ? 500 : batchUnits > 10000 ? 315 : batchUnits > 3200 ? 200 : batchUnits > 1200 ? 125 : 80
            const aqlLetter  = batchUnits > 150000 ? 'P' : batchUnits > 35000 ? 'N' : batchUnits > 10000 ? 'M' : batchUnits > 3200 ? 'L' : batchUnits > 1200 ? 'K' : 'J'
            return (
              <div style={{ margin: '12px 14px', padding: '12px 16px', background: '#EFF6FF', borderRadius: 10, border: '1px solid #BFDBFE' }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#1E40AF', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>
                  <i className="fa fa-search" style={{ marginRight: 6 }} />
                  Parámetros de Inspección AQL — ISO 2859-1 Nivel II Normal
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                  {[
                    ['Producto',          preLlenado.descripcionMaterial],
                    ['Código',            preLlenado.codigoMaterial],
                    ['Lote',              preLlenado.loteLogistico],
                    ['Lote Inspección',   preLlenado.loteInspeccion],
                    ['Tamaño Lote (un)', Math.round(batchUnits).toLocaleString('es-CO')],
                    ['Letra Código',      aqlLetter],
                    ['Tamaño Muestra',    `${sampleSize} un`],
                    ['Nivel AQL',         '0.65 %'],
                  ].map(([lbl, val]) => (
                    <div key={lbl} style={{ padding: '6px 14px', borderRight: '1px solid #BFDBFE', flexShrink: 0 }}>
                      <div style={{ fontSize: 9.5, fontWeight: 700, color: '#60A5FA', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>{lbl}</div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1E3A8A', fontFamily: 'var(--f-mono)' }}>{val}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 10, padding: '6px 10px', background: '#DBEAFE', borderRadius: 7, fontSize: 11, color: '#1E40AF' }}>
                  <i className="fa fa-info-circle" style={{ marginRight: 5 }} />
                  Criterio de Aceptación 0.65% AQL: máx. <strong>0</strong> defectos críticos · máx. <strong>{Math.floor(sampleSize * 0.01)}</strong> defectos mayores · máx. <strong>{Math.floor(sampleSize * 0.04)}</strong> defectos menores.
                </div>
              </div>
            )
          })()}

          {/* Pre-llenado ET3-F2: identificación del lote para empaque */}
          {preLlenado && detalle.id === 302 && (
            <div style={{ margin: '12px 14px 0', padding: '10px 16px', background: '#F0FDF4', borderRadius: 10, border: '1px solid #BBF7D0', display: 'flex', flexWrap: 'wrap' }}>
              <div style={{ width: '100%', fontSize: 10.5, fontWeight: 700, color: '#15803D', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>
                <i className="fa fa-box" style={{ marginRight: 6 }} />
                Identificación del Lote — Empaque Primario y Secundario
              </div>
              {[
                ['Producto',          preLlenado.descripcionMaterial],
                ['Código',            preLlenado.codigoMaterial],
                ['Forma Farmacéutica',preLlenado.formaFarmaceutica],
                ['Lote Logístico',    preLlenado.loteLogistico],
                ['Lote Inspección',   preLlenado.loteInspeccion],
                ['Fecha Fab.',        preLlenado.fechaFabricacion],
                ['Fecha Cad.',        preLlenado.fechaCaducidad],
                ['Reg. Sanitario',    preLlenado.registroSanitario],
              ].map(([lbl, val]) => (
                <div key={lbl} style={{ padding: '4px 14px', borderRight: '1px solid #BBF7D0', flexShrink: 0 }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: '#15803D', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 1 }}>{lbl}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#14532D', fontFamily: 'var(--f-mono)' }}>{val}</div>
                </div>
              ))}
            </div>
          )}

          {/* ── Control de Pesos ET3-F2 ── */}
          {detalle.id === 302 && (() => {
            const minV = parseFloat(pesoSpec.min)
            const optV = parseFloat(pesoSpec.opt)
            const maxV = parseFloat(pesoSpec.max)
            const specsOk = !isNaN(minV) && !isNaN(optV) && !isNaN(maxV) && minV < optV && optV < maxV

            const parsed = pesos.map(p => parseFloat(p))
            const valid  = parsed.filter(v => !isNaN(v))
            const promedio = valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : NaN

            // ── SVG chart geometry ────────────────────────────────────────────
            const W = 700, H = 220
            const PL = 62, PR = 24, PT = 18, PB = 36
            const innerW = W - PL - PR
            const innerH = H - PT - PB

            const chartYMin = specsOk ? minV - (maxV - minV) * 0.3 : 490
            const chartYMax = specsOk ? maxV + (maxV - minV) * 0.3 : 540

            const toSvgY = (v: number) => PT + (1 - (v - chartYMin) / (chartYMax - chartYMin)) * innerH
            const toSvgX = (i: number) => PL + (i / (PESO_N - 1)) * innerW

            const refLines = specsOk ? [
              { v: maxV, label: `MÁX ${maxV}g`, color: '#DC2626', dash: '5,4' },
              { v: optV, label: `ÓPT ${optV}g`, color: '#1D4ED8', dash: '' },
              { v: minV, label: `MÍN ${minV}g`, color: '#DC2626', dash: '5,4' },
            ] : []

            // Grid Y lines (5 evenly spaced)
            const gridYVals = Array.from({ length: 6 }, (_, i) =>
              chartYMin + (i / 5) * (chartYMax - chartYMin)
            )

            // Points that have valid values
            const pts = parsed.map((v, i) => (!isNaN(v) ? { x: toSvgX(i), y: toSvgY(v), v, i } : null))
            const validPts = pts.filter((p): p is NonNullable<typeof p> => p !== null)
            const polyline = validPts.map(p => `${p.x},${p.y}`).join(' ')

            const stateOf = (v: number) =>
              !specsOk ? null : v < minV || v > maxV ? 'NC' : v < optV - 1 || v > optV + 1 ? 'AC' : 'OK'

            return (
              <div style={{ margin: '12px 14px 0', padding: '14px 16px 16px', background: '#F8FAFC', borderRadius: 12, border: '1.5px solid #E2E8F0' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#0A2D63', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <i className="fa fa-chart-line" style={{ fontSize: 13 }} />
                  Control de Pesos — Envasado
                </div>

                {/* Spec limit inputs */}
                {!readonly && (
                  <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                    {(['min', 'opt', 'max'] as const).map(k => (
                      <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                        <span style={{ fontWeight: 700, color: k === 'opt' ? '#1D4ED8' : '#DC2626', minWidth: 60 }}>
                          {k === 'min' ? 'Mínimo' : k === 'opt' ? 'Óptimo' : 'Máximo'} (g)
                        </span>
                        <input
                          type="number" step="0.1"
                          style={{ width: 80, padding: '4px 8px', border: '1.5px solid #CBD5E1', borderRadius: 6, fontSize: 12, fontFamily: 'var(--f-mono)', fontWeight: 700 }}
                          value={pesoSpec[k]}
                          onChange={e => {
                            const next = { ...pesoSpec, [k]: e.target.value }
                            setPesoSpec(next)
                            savePesoData(next, pesos)
                          }}
                          placeholder="0"
                        />
                      </label>
                    ))}
                    {specsOk && (
                      <span style={{ fontSize: 11, color: '#10B981', fontWeight: 700, alignSelf: 'center' }}>
                        <i className="fa fa-check-circle" style={{ marginRight: 4 }} />
                        Especificaciones configuradas
                      </span>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  {/* Weight entry table */}
                  <div style={{ minWidth: 220 }}>
                    <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%' }}>
                      <thead>
                        <tr style={{ background: '#0A2D63' }}>
                          <th style={{ padding: '5px 10px', color: '#fff', fontWeight: 700, fontSize: 11, letterSpacing: '.04em', textAlign: 'center' }}>Muestra</th>
                          <th style={{ padding: '5px 10px', color: '#fff', fontWeight: 700, fontSize: 11, letterSpacing: '.04em', textAlign: 'center' }}>Peso (g)</th>
                          {specsOk && <th style={{ padding: '5px 10px', color: '#fff', fontWeight: 700, fontSize: 11, letterSpacing: '.04em', textAlign: 'center' }}>Estado</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {pesos.map((p, i) => {
                          const pv = parseFloat(p)
                          const st = isNaN(pv) ? null : stateOf(pv)
                          const stColor = st === 'NC' ? '#DC2626' : st === 'AC' ? '#D97706' : st === 'OK' ? '#10B981' : '#94A3B8'
                          return (
                            <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                              <td style={{ padding: '4px 10px', textAlign: 'center', color: '#475569', fontWeight: 600, fontFamily: 'var(--f-mono)', borderBottom: '1px solid #F1F5F9' }}>
                                {i + 1}
                              </td>
                              <td style={{ padding: '3px 6px', borderBottom: '1px solid #F1F5F9' }}>
                                {readonly ? (
                                  <span style={{ fontFamily: 'var(--f-mono)', fontWeight: 700, color: '#0A1530', padding: '2px 6px', display: 'block', textAlign: 'center' }}>{p || '—'}</span>
                                ) : (
                                  <input
                                    type="number" step="0.01"
                                    style={{ width: '100%', padding: '4px 8px', border: '1.5px solid #E2E8F0', borderRadius: 6, fontSize: 12.5, fontFamily: 'var(--f-mono)', fontWeight: 700, background: 'transparent', textAlign: 'center', outline: 'none' }}
                                    value={p}
                                    onChange={e => {
                                      const next = pesos.map((v, j) => j === i ? e.target.value : v)
                                      setPesos(next)
                                      savePesoData(pesoSpec, next)
                                    }}
                                    placeholder="0.00"
                                  />
                                )}
                              </td>
                              {specsOk && (
                                <td style={{ padding: '4px 10px', textAlign: 'center', borderBottom: '1px solid #F1F5F9' }}>
                                  {st && (
                                    <span style={{ fontSize: 10, fontWeight: 800, color: stColor, letterSpacing: '.05em' }}>{st}</span>
                                  )}
                                </td>
                              )}
                            </tr>
                          )
                        })}
                        <tr style={{ background: '#EFF6FF', borderTop: '2px solid #BFDBFE' }}>
                          <td style={{ padding: '5px 10px', fontWeight: 800, fontSize: 11.5, color: '#1E40AF', textAlign: 'center', letterSpacing: '.04em' }}>PROM.</td>
                          <td style={{ padding: '5px 10px', fontFamily: 'var(--f-mono)', fontWeight: 800, fontSize: 13, color: '#1E40AF', textAlign: 'center' }}>
                            {!isNaN(promedio) ? promedio.toFixed(2) : '—'}
                          </td>
                          {specsOk && (
                            <td style={{ padding: '5px 10px', textAlign: 'center' }}>
                              {!isNaN(promedio) && (() => {
                                const st = stateOf(promedio)
                                const c = st === 'NC' ? '#DC2626' : st === 'AC' ? '#D97706' : '#10B981'
                                return <span style={{ fontSize: 10, fontWeight: 800, color: c }}>{st}</span>
                              })()}
                            </td>
                          )}
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* SVG chart */}
                  <div style={{ flex: 1, minWidth: 340, overflowX: 'auto' }}>
                    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, display: 'block', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8 }}>
                      {/* Grid lines Y */}
                      {gridYVals.map((v, i) => (
                        <line key={i} x1={PL} y1={toSvgY(v)} x2={W - PR} y2={toSvgY(v)}
                          stroke="#F1F5F9" strokeWidth={1} />
                      ))}
                      {/* Grid lines X */}
                      {Array.from({ length: PESO_N }, (_, i) => (
                        <line key={i} x1={toSvgX(i)} y1={PT} x2={toSvgX(i)} y2={H - PB}
                          stroke="#F1F5F9" strokeWidth={1} />
                      ))}

                      {/* Y-axis labels */}
                      {gridYVals.map((v, i) => (
                        <text key={i} x={PL - 6} y={toSvgY(v) + 4} textAnchor="end"
                          fontSize={9} fill="#94A3B8" fontFamily="monospace">
                          {v.toFixed(0)}
                        </text>
                      ))}

                      {/* X-axis labels */}
                      {Array.from({ length: PESO_N }, (_, i) => (
                        <text key={i} x={toSvgX(i)} y={H - PB + 14} textAnchor="middle"
                          fontSize={9} fill="#64748B" fontFamily="monospace">
                          {i + 1}
                        </text>
                      ))}
                      <text x={W / 2} y={H - 2} textAnchor="middle" fontSize={9} fill="#94A3B8" fontFamily="sans-serif">Muestra</text>

                      {/* Axes */}
                      <line x1={PL} y1={PT} x2={PL} y2={H - PB} stroke="#CBD5E1" strokeWidth={1.5} />
                      <line x1={PL} y1={H - PB} x2={W - PR} y2={H - PB} stroke="#CBD5E1" strokeWidth={1.5} />

                      {/* Reference lines */}
                      {refLines.map(({ v, label, color, dash }) => {
                        const y = toSvgY(v)
                        return (
                          <g key={label}>
                            <line x1={PL} y1={y} x2={W - PR} y2={y}
                              stroke={color} strokeWidth={1.5} strokeDasharray={dash || undefined} />
                            <text x={W - PR + 3} y={y + 4} fontSize={8.5} fill={color} fontFamily="monospace" fontWeight="bold">
                              {label}
                            </text>
                          </g>
                        )
                      })}

                      {/* Data polyline */}
                      {validPts.length >= 2 && (
                        <polyline points={polyline} fill="none" stroke="#0A2D63" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                      )}

                      {/* Data points */}
                      {pts.map((p, i) => p && (
                        <g key={i}>
                          <circle cx={p.x} cy={p.y} r={5} fill="#0A2D63" stroke="#fff" strokeWidth={2} />
                          {specsOk && (p.v < minV || p.v > maxV) && (
                            <circle cx={p.x} cy={p.y} r={7} fill="none" stroke="#DC2626" strokeWidth={1.5} />
                          )}
                          <title>{`Muestra ${i + 1}: ${p.v}g`}</title>
                        </g>
                      ))}

                      {/* "No data" label */}
                      {validPts.length === 0 && (
                        <text x={W / 2} y={H / 2} textAnchor="middle" fontSize={12} fill="#CBD5E1" fontFamily="sans-serif">
                          Ingrese pesos para ver la gráfica
                        </text>
                      )}

                      {/* Legend */}
                      {specsOk && (
                        <g>
                          <circle cx={PL + 10} cy={PT - 6} r={3} fill="#0A2D63" />
                          <text x={PL + 17} y={PT - 3} fontSize={8.5} fill="#0A2D63" fontFamily="sans-serif">Peso medido</text>
                          <line x1={PL + 90} y1={PT - 6} x2={PL + 100} y2={PT - 6} stroke="#DC2626" strokeWidth={1.5} strokeDasharray="4,3" />
                          <text x={PL + 104} y={PT - 3} fontSize={8.5} fill="#DC2626" fontFamily="sans-serif">Límites</text>
                          <line x1={PL + 148} y1={PT - 6} x2={PL + 158} y2={PT - 6} stroke="#1D4ED8" strokeWidth={1.5} />
                          <text x={PL + 162} y={PT - 3} fontSize={8.5} fill="#1D4ED8" fontFamily="sans-serif">Óptimo</text>
                        </g>
                      )}
                    </svg>
                  </div>
                </div>

                {/* Out-of-spec warning */}
                {specsOk && valid.some(v => v < minV || v > maxV) && (
                  <div style={{ marginTop: 10, padding: '7px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 12, color: '#991B1B', display: 'flex', gap: 7, alignItems: 'center' }}>
                    <i className="fa fa-exclamation-triangle" />
                    {valid.filter(v => v < minV || v > maxV).length} muestra(s) fuera de especificación — requieren acción correctiva.
                  </div>
                )}
              </div>
            )
          })()}

          {/* Pre-llenado ET3-F3: resumen completo para cierre de lote */}
          {preLlenado && detalle.id === 303 && (() => {
            // Pull yield from ET2-F3 localStorage if available
            const d203key = brId ? `br_data_${brId}_203` : null
            let rendPct: number | null = null
            if (d203key) {
              try {
                const raw = localStorage.getItem(d203key)
                if (raw) {
                  const d203 = JSON.parse(raw) as Record<string, unknown>
                  const real = parseFloat(String(d203.rendimiento_real ?? ''))
                  const teo  = preLlenado.cantidadOrden
                  if (!isNaN(real) && teo > 0) rendPct = Math.round((real / teo) * 100 * 100) / 100
                }
              } catch {}
            }
            return (
              <div style={{ margin: '12px 14px', padding: '12px 16px', background: '#F0FDF4', borderRadius: 10, border: '1px solid #BBF7D0' }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#15803D', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>
                  <i className="fa fa-clipboard-check" style={{ marginRight: 6 }} />
                  Resumen de Lote — Cierre Final
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                  {([
                    ['Producto',         preLlenado.descripcionMaterial],
                    ['Código',           preLlenado.codigoMaterial],
                    ['Lote Logístico',   preLlenado.loteLogistico],
                    ['Lote Inspección',  preLlenado.loteInspeccion],
                    ['Fecha Fab.',       preLlenado.fechaFabricacion],
                    ['Fecha Cad.',       preLlenado.fechaCaducidad],
                    ['Reg. Sanitario',   preLlenado.registroSanitario],
                    ['Cantidad',        `${preLlenado.cantidadOrden.toLocaleString('es-CO')} ${preLlenado.unidadMedida}`],
                    ['Forma Farmac.',    preLlenado.formaFarmaceutica],
                    ['Centro',           preLlenado.centro],
                  ] as [string, string][]).map(([lbl, val]) => (
                    <div key={lbl} style={{ padding: '6px 14px', borderRight: '1px solid #BBF7D0', flexShrink: 0 }}>
                      <div style={{ fontSize: 9.5, fontWeight: 700, color: '#15803D', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>{lbl}</div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#14532D', fontFamily: 'var(--f-mono)' }}>{val}</div>
                    </div>
                  ))}
                </div>
                {rendPct !== null && (
                  <div style={{ marginTop: 10, padding: '7px 12px', background: rendPct >= 95 ? '#D1FAE5' : '#FEF2F2', border: `1px solid ${rendPct >= 95 ? '#6EE7B7' : '#FECACA'}`, borderRadius: 7, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <i className={`fa fa-${rendPct >= 95 ? 'check-circle' : 'exclamation-triangle'}`} style={{ color: rendPct >= 95 ? '#059669' : '#DC2626', fontSize: 14 }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: rendPct >= 95 ? '#065F46' : '#991B1B' }}>
                      Rendimiento registrado en ET2-F3: <span style={{ fontFamily: 'var(--f-mono)', fontSize: 14 }}>{rendPct}%</span>
                      {rendPct < 95 && ' — Requiere nota de desviación'}
                    </span>
                  </div>
                )}
              </div>
            )
          })()}

          <FormioFrame schema={detalle.jsonSchema ?? ''} locked={cierFirmadas > 0} lockedKeys={lockedKeys} onDataChange={handleIframeData} getInitialData={getInitialData} onValidation={setRangeErrors} />

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
              {/* Header */}
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

              {/* Field list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {validationErrors.map((err, idx) => (
                  <div key={idx} style={{
                    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                    background: '#fff', borderRadius: 7, padding: '6px 10px',
                    border: '1px solid #FECACA',
                  }}>
                    {/* Field name */}
                    <span style={{
                      fontSize: 12.5, fontWeight: 600, color: '#7F1D1D',
                      flex: 1, minWidth: 120,
                    }}>
                      {err.label}
                    </span>

                    {/* Row chips for datagrid fields, or a simple "requerido" tag */}
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
          {(() => {
            const persisted = mockDesviaciones.filter(d => d.idBatchRecord === numBrId && d.idDetalle === detalle.id)
            const allDevs   = [...persisted, ...localDesviaciones]
            if (allDevs.length === 0) return null
            return (
              <div style={{ margin: '0 16px 10px', border: '1.5px solid #FCD34D', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ background: '#FFFBEB', padding: '8px 14px', borderBottom: '1px solid #FDE68A', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <i className="fa fa-triangle-exclamation" style={{ color: '#D97706', fontSize: 11 }} />
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#78350F', textTransform: 'uppercase', letterSpacing: '.06em', flex: 1 }}>
                    Desviaciones registradas ({allDevs.length})
                  </span>
                </div>
                {allDevs.map((d, i) => (
                  <div key={d.id ?? `local-${i}`} style={{ padding: '10px 14px', borderBottom: i < allDevs.length - 1 ? '1px solid #FEF3C7' : 'none', background: '#fff' }}>
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
                      {d.usuario} · {d.cargo}
                      <span style={{ color: '#CBD5E1' }}>·</span>
                      {new Date(d.fechaHora).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                    {d.observacionCierre && (
                      <div style={{ marginTop: 7, padding: '6px 10px', background: '#F0FDF4', borderRadius: 7, border: '1px solid #BBF7D0' }}>
                        <div style={{ fontSize: 10.5, fontWeight: 700, color: '#15803D', marginBottom: 2 }}>
                          <i className="fa fa-check-circle" style={{ marginRight: 5 }} />Cierre · {d.usuarioCierre}
                        </div>
                        <div style={{ fontSize: 11.5, color: '#166534' }}>{d.observacionCierre}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          })()}

          {/* ── Firma block ── */}
          {firmasCierre.length > 0 && (
            <div className="firma-block" style={{ opacity: allSecDone ? 1 : 0.45, transition: 'opacity 200ms' }}>
              {/* Header */}
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

              {/* Warning if sections pending */}
              {!allSecDone && (
                <div style={{
                  padding: '7px 18px', background: '#FFFBEB', fontSize: 11.5, color: '#92400E',
                  display: 'flex', gap: 6, alignItems: 'center', borderBottom: '1px solid #FDE68A',
                }}>
                  <i className="fa fa-exclamation-triangle" style={{ fontSize: 10 }} />
                  Complete las secciones del formulario antes de firmar el cierre.
                </div>
              )}

              {/* Firma rows */}
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
                        {firma.grupo} · {GRUPO_CARGO[firma.grupo] ?? firma.grupo}
                      </div>
                    </div>
                    {firmaInfo
                      ? (
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'flex-start' }}>
                          <FirmaStamp info={firmaInfo} />
                          {puedeDerogCierre && onRequestDerogar && (
                            <button title="Derogar firma"
                              style={{
                                marginTop: 2, background: '#FEF2F2', border: '1px solid #FECACA',
                                borderRadius: 6, padding: '4px 8px', cursor: 'pointer',
                                color: '#DC2626', fontSize: 11, flexShrink: 0,
                              }}
                              onClick={() => onRequestDerogar(firmaKey, '', detalle.id, firmaInfo, firma.texto, firma.grupo)}>
                              <i className="fa fa-undo" />
                            </button>
                          )}
                        </div>
                      )
                      : (!readonly && allSecDone && !bloq && (
                          <button className="btn btn-warning" style={{ fontSize: 12, flexShrink: 0 }}
                            onClick={() => handleFirmar('cierre', firmaKey, firma.texto, firma.grupo)}>
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
          brId={numBrId}
          detalleId={detalle.id}
          detalleCode={DETALLE_CODE[detalle.id] ?? detalle.descripcion.slice(0, 10)}
          onSubmit={desc => {
            const now = new Date().toISOString()
            const newDev: Desviacion = {
              id: Date.now(),
              idBatchRecord: numBrId,
              idDetalle: detalle.id,
              detalleCode: DETALLE_CODE[detalle.id] ?? '',
              campo: desviacionModal.error.key,
              labelCampo: desviacionModal.error.label,
              valorIngresado: desviacionModal.valorIngresado,
              limiteInfo: desviacionModal.error.message,
              descripcion: desc,
              estado: 'abierta',
              usuario: user?.nombres ?? user?.login ?? 'Operario',
              cargo: GRUPO_CARGO[user?.grupos?.split(',')[0]?.trim() ?? ''] ?? 'Usuario',
              fechaHora: now,
            }
            mockDesviaciones.push(newDev)
            setLocalDesviaciones(prev => [...prev, newDev])
          }}
          onClose={() => setDesviacionModal(null)}
        />
      )}
    </div>
  )
}

// ── AuditPreviewPanel ─────────────────────────────────────────────────────
const AUDIT_CFG: Record<string, { bg: string; color: string; border: string; label: string; icon: string }> = {
  CREAR:          { bg:'#D1FAE5', color:'#065F46', border:'#6EE7B7', label:'Creación',     icon:'fa-plus' },
  MODIFICAR:      { bg:'#DBEAFE', color:'#1D4ED8', border:'#93C5FD', label:'Modificación', icon:'fa-pencil-alt' },
  CANCELAR:       { bg:'#FEE2E2', color:'#991B1B', border:'#FCA5A5', label:'Cancelación',  icon:'fa-ban' },
  FIRMAR_SECCION: { bg:'#EDE9FE', color:'#5B21B6', border:'#C4B5FD', label:'Firma Sección',icon:'fa-pen' },
  FIRMAR_CIERRE:  { bg:'#EDE9FE', color:'#5B21B6', border:'#C4B5FD', label:'Firma Cierre', icon:'fa-check-circle' },
  DEROGAR_FIRMA:  { bg:'#FEF3C7', color:'#92400E', border:'#FDE68A', label:'Derogación',   icon:'fa-undo' },
  LIBERAR_LOTE:   { bg:'#D1FAE5', color:'#065F46', border:'#6EE7B7', label:'Liberación',   icon:'fa-unlock' },
}

const ALL_DETALLE_IDS = DETALLE_STRUCT.map(d => d.id)
const DETALLE_LABEL   = Object.fromEntries(DETALLE_STRUCT.map(d => [d.id, d.descripcion]))

function AuditPreviewPanel({ brId }: { brId: string | number }) {
  const allEntries = useAuditStore(s => s.entries)
  const brIdNum    = Number(brId)

  const relevant = allEntries.filter(e =>
    Object.keys(AUDIT_CFG).includes(e.accion) &&
    (ALL_DETALLE_IDS.includes(Number(e.idEntidad)) || Number(e.idEntidad) === brIdNum)
  )
  const totalStore = allEntries.length

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
        @media (prefers-reduced-motion: reduce) { .audit-entry { transition: none; } }
      `}</style>

      {/* Header */}
      <div style={{ padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 9, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: 'rgba(247,201,46,0.15)', border: '1.5px solid rgba(247,201,46,0.3)', display: 'grid', placeItems: 'center' }}>
          <i className="fa fa-history" style={{ color: '#F7C92E', fontSize: 11 }} aria-hidden="true" />
        </div>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 13, flex: 1 }}>Historial de Auditoría</span>
        <span style={{ fontSize: 11, fontFamily: 'var(--f-mono)', fontWeight: 700, background: 'rgba(255,255,255,0.1)', color: relevant.length > 0 ? '#F7C92E' : 'rgba(255,255,255,0.4)', padding: '2px 8px', borderRadius: 10 }}
          title={`${totalStore} evento${totalStore !== 1 ? 's' : ''} en total en el sistema`}>
          {relevant.length}
        </span>
      </div>

      {/* Entries */}
      <div style={{ flex: 1, overflowY: 'auto', maxHeight: 'calc(100vh - 260px)' }}>
        {relevant.length === 0 ? (
          <div style={{ padding: '36px 16px', textAlign: 'center' }}>
            <i className="fa fa-history" style={{ fontSize: 28, color: 'rgba(255,255,255,0.1)', display: 'block', marginBottom: 12 }} aria-hidden="true" />
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,0.3)', marginBottom: 6 }}>Sin eventos registrados</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', lineHeight: 1.6 }}>
              Las firmas y cambios en campos<br />aparecen aquí en tiempo real.
            </div>
          </div>
        ) : relevant.map(e => {
          const d   = new Date(e.timestamp)
          const cfg = AUDIT_CFG[e.accion] ?? { bg:'#F1F5F9', color:'#475569', border:'#CBD5E1', label: e.accion, icon:'fa-circle' }
          const fecha = d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
          const hora  = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          const seccion = DETALLE_LABEL[Number(e.idEntidad)] ?? e.descripcionEntidad
          return (
            <div key={e.id} className="audit-entry" style={{ borderLeftColor: cfg.border }}>
              {/* Action + section */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, flexWrap: 'wrap' }}>
                <span className="audit-badge" style={{ background: cfg.bg, color: cfg.color }}>
                  <i className={`fa ${cfg.icon}`} style={{ fontSize: 9 }} aria-hidden="true" />
                  {cfg.label}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginBottom: 5, fontWeight: 500, lineHeight: 1.3 }}>
                {seccion}
              </div>

              {/* Field changes — ALL of them, never truncated */}
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

              {/* Motivo */}
              {e.motivo && (
                <div style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 6, padding: '4px 8px', marginBottom: 6, fontSize: 10.5, color: '#FDE68A', lineHeight: 1.4 }}>
                  <i className="fa fa-comment-alt" style={{ marginRight: 5, fontSize: 9 }} aria-hidden="true" />
                  {e.motivo}
                </div>
              )}

              {/* Who + when */}
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
        <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.2)', fontFamily: 'var(--f-mono)' }}>
          {totalStore} evento{totalStore !== 1 ? 's' : ''} en store · {relevant.length} en este BR
        </span>
      </div>
    </div>
  )
}

// ── AuditExpandedPanel — tabla full-width para vista Consultar ───────────
const AT_TH: React.CSSProperties = {
  padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700,
  color: '#475569', textTransform: 'uppercase', letterSpacing: '.06em',
  borderBottom: '2px solid #E2E8F0', whiteSpace: 'nowrap', background: '#F8FAFC',
}
const AT_TD: React.CSSProperties = {
  padding: '9px 12px', verticalAlign: 'top', borderBottom: '1px solid #F1F5F9',
}

function AuditExpandedPanel({ brId }: { brId: string | number }) {
  const allEntries = useAuditStore(s => s.entries)
  const brIdNum    = Number(brId)
  const [open, setOpen] = useState(true)

  const relevant = [...allEntries]
    .filter(e =>
      Object.keys(AUDIT_CFG).includes(e.accion) &&
      (ALL_DETALLE_IDS.includes(Number(e.idEntidad)) || Number(e.idEntidad) === brIdNum)
    )
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return (
    <div style={{ margin: '18px 0 0', border: '1.5px solid #E2E8F0', borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
      {/* Header */}
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
        <span style={{ fontSize: 11, fontWeight: 800, background: relevant.length > 0 ? '#0A2D63' : '#E2E8F0', color: relevant.length > 0 ? '#fff' : '#94A3B8', padding: '2px 12px', borderRadius: 20 }}>
          {relevant.length}
        </span>
        <i className={`fa fa-chevron-${open ? 'up' : 'down'}`} style={{ color: '#94A3B8', fontSize: 12, marginLeft: 4 }} aria-hidden="true" />
      </div>

      {open && (
        relevant.length === 0 ? (
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
                {relevant.map((e, i) => {
                  const cfg    = AUDIT_CFG[e.accion] ?? { bg:'#F1F5F9', color:'#475569', border:'#CBD5E1', label: e.accion, icon:'fa-circle' }
                  const d      = new Date(e.timestamp)
                  const fecha  = d.toLocaleDateString('es-CO', { day:'2-digit', month:'2-digit', year:'numeric' })
                  const hora   = d.toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit', second:'2-digit' })
                  const seccion = DETALLE_LABEL[Number(e.idEntidad)] ?? e.descripcionEntidad
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
                        <div style={{ fontSize: 11.5, color: '#374151', fontWeight: 500, maxWidth: 180 }}>{seccion}</div>
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
  const navigate = useNavigate()
  const { registrar } = useAudit()
  const authUser = useAuthStore(s => s.user)
  const allAuditEntries = useAuditStore(s => s.entries)
  const [preLlenado, setPreLlenado] = useState<PreLlenadoBR | null>(null)
  const [procesoActivo, setProcesoActivo] = useState(mockProcesos[0]?.id ?? 0)

  useEffect(() => {
    if (id) formulaControlApi.getPreLlenado(Number(id)).then(setPreLlenado)
  }, [id])

  // Register an access event every time a batch record is opened in edit mode.
  // This fires immediately on mount so the audit panel shows at least one entry
  // and proves the entire store → display chain is working.
  const accessRegistered = useRef(false)
  useEffect(() => {
    if (readonly || !id || accessRegistered.current) return
    accessRegistered.current = true
    registrar({
      entidad: 'BatchRecord',
      idEntidad: Number(id),
      descripcionEntidad: `Batch Record #${id}`,
      accion: 'CREAR',
      modulo: 'batch-record',
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, readonly])
  const [firmaModal, setFirmaModal] = useState<{ tipo: 'seccion'|'cierre'; firmaKey: string; texto: string; grupo: string } | null>(null)
  const [firmados, setFirmados] = useState<FirmaMap>(() => {
    try {
      const saved = localStorage.getItem(`br_firmados_${id}`)
      if (saved) return JSON.parse(saved) as FirmaMap
      const brNum = Number(id)
      return (mockFirmadosBR[brNum] ?? {}) as FirmaMap
    } catch {
      const brNum = Number(id)
      return (mockFirmadosBR[brNum] ?? {}) as FirmaMap
    }
  })
  const [showAudit, setShowAudit] = useState(true)
  const [cerradosProcesos, setCerradosProcesos] = useState<Set<number>>(() => {
    try {
      const saved = localStorage.getItem(`br_cerrados_${id}`)
      return saved ? new Set(JSON.parse(saved) as number[]) : new Set()
    } catch { return new Set() }
  })
  const [liberadoInfo, setLiberadoInfo] = useState<FirmaInfo | null>(() => {
    try {
      const saved = localStorage.getItem(`br_liberado_${id}`)
      return saved ? (JSON.parse(saved) as FirmaInfo) : null
    } catch { return null }
  })
  const [liberarModal, setLiberarModal] = useState(false)

  const brFinalizado = DETALLE_STRUCT.every(d => {
    const fc = getFirmasDeEstrategia(d.idEstrategiaFirma)
    return fc.length > 0 && fc.every(f => !!firmados[`cie:${d.id}:${f.idFirma}`])
  })

  // Overall progress — based on cierre signatures across all detalles
  const totalFirmasCierre = DETALLE_STRUCT.reduce((n, d) => n + getFirmasDeEstrategia(d.idEstrategiaFirma).length, 0)
  const doneFirmasCierre  = DETALLE_STRUCT.reduce((n, d) =>
    n + getFirmasDeEstrategia(d.idEstrategiaFirma).filter(f => !!firmados[`cie:${d.id}:${f.idFirma}`]).length, 0)
  const overallPct = totalFirmasCierre > 0 ? Math.round((doneFirmasCierre / totalFirmasCierre) * 100) : 0

  // Status badge config
  const brRec = mockBatchRecords.find(b => b.idBatchRecord === Number(id))
  const ESTADO_BADGE = {
    1: { label: 'En Tratamiento', bg: 'rgba(59,130,246,0.22)',  color: '#93C5FD' },
    2: { label: 'Finalizado',     bg: 'rgba(16,185,129,0.22)',  color: '#6EE7B7' },
    3: { label: 'Cancelado',      bg: 'rgba(239,68,68,0.22)',   color: '#FCA5A5' },
    4: { label: 'Liberado',       bg: 'rgba(167,139,250,0.22)', color: '#C4B5FD' },
  } as const
  const estadoBadge = ESTADO_BADGE[(brRec?.idEstado ?? 1) as keyof typeof ESTADO_BADGE] ?? ESTADO_BADGE[1]

  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=1024,height=800')
    if (!win) { alert('Habilita ventanas emergentes en el navegador para imprimir'); return }

    const cab = buildCabeceraItems(preLlenado)
    const now = new Date()
    const printDate = now.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
    const printTime = now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
    const brCode = `BR-${id ?? '—'}`
    const producto = preLlenado?.descripcionMaterial ?? '—'
    const userName = authUser ? `${authUser.nombres} ${authUser.apellidos}` : '—'

    const allFormData: Record<number, Record<string, unknown>> = {}
    DETALLE_STRUCT.forEach(det => {
      const schema = getDetalleById(det.id)?.jsonSchema ?? ''
      const base: Record<string, unknown> = {
        ...(preLlenado ? extractOpMappings(schema, preLlenado as unknown as Record<string, unknown>) : {}),
        ...(PREFILLED[det.id] ?? {}),
        ...buildDetalleInitialValues(det.id, preLlenado),
        ...buildMockManualData(det.id, preLlenado, Number(id)),
      }
      // Overlay user-entered data, but only non-empty values so mock fills the blanks
      const userSnap = formDataMapRef.current[det.id]
      if (userSnap) {
        for (const [k, v] of Object.entries(userSnap)) {
          if (Array.isArray(v)) {
            // For datagrid: prefer user rows only if they contain actual content
            const hasContent = (v as Record<string, unknown>[]).some(row =>
              Object.values(row).some(rv => rv !== null && rv !== undefined && rv !== '' && rv !== false)
            )
            if (hasContent) base[k] = v
          } else if (v !== null && v !== undefined && v !== '') {
            base[k] = v
          }
        }
      }
      allFormData[det.id] = base
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

    const renderPesoChart = (data: Record<string, unknown>): string => {
      const minV = parseFloat(String(data.peso_min_spec ?? ''))
      const optV = parseFloat(String(data.peso_opt_spec ?? ''))
      const maxV = parseFloat(String(data.peso_max_spec ?? ''))
      const specsOk = !isNaN(minV) && !isNaN(optV) && !isNaN(maxV) && minV < optV && optV < maxV
      const PESO_N = 10
      const pesosArr = Array.from({ length: PESO_N }, (_, i) => parseFloat(String(data[`peso_ctrl_${i + 1}`] ?? '')))
      const valid = pesosArr.filter(v => !isNaN(v))
      const promedio = valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : NaN

      const W = 700, H = 220
      const PL = 62, PR = 24, PT = 18, PB = 36
      const innerW = W - PL - PR, innerH = H - PT - PB
      const chartYMin = specsOk ? minV - (maxV - minV) * 0.3 : 490
      const chartYMax = specsOk ? maxV + (maxV - minV) * 0.3 : 540
      const toY = (v: number) => PT + (1 - (v - chartYMin) / (chartYMax - chartYMin)) * innerH
      const toX = (i: number) => PL + (i / (PESO_N - 1)) * innerW

      const gridYVals = Array.from({ length: 6 }, (_, i) => chartYMin + (i / 5) * (chartYMax - chartYMin))
      const pts = pesosArr.map((v, i) => (!isNaN(v) ? { x: toX(i), y: toY(v), v, i } : null))
      const validPts = pts.filter((p): p is NonNullable<typeof p> => p !== null)
      const polyline = validPts.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')
      const stateOf = (v: number) => !specsOk ? null : v < minV || v > maxV ? 'NC' : v < optV - 1 || v > optV + 1 ? 'AC' : 'OK'
      const stColor = (st: string | null) => st === 'NC' ? '#DC2626' : st === 'AC' ? '#D97706' : st === 'OK' ? '#10B981' : '#94A3B8'

      const tableRows = pesosArr.map((pv, i) => {
        const st = isNaN(pv) ? null : stateOf(pv)
        const c = stColor(st)
        const bgRow = i % 2 === 0 ? '#fff' : '#F8FAFC'
        return `<tr style="background:${bgRow}">
          <td style="padding:4px 10px;text-align:center;color:#475569;font-weight:600;font-family:monospace;border-bottom:1px solid #F1F5F9">${i + 1}</td>
          <td style="padding:4px 10px;text-align:center;font-family:monospace;font-weight:700;color:#0A1530;border-bottom:1px solid #F1F5F9">${isNaN(pv) ? '—' : pv.toFixed(2)}</td>
          ${specsOk ? `<td style="padding:4px 10px;text-align:center;border-bottom:1px solid #F1F5F9"><span style="font-size:10px;font-weight:800;color:${c}">${st ?? ''}</span></td>` : ''}
        </tr>`
      }).join('')

      const refLinesHTML = specsOk ? [
        { v: maxV, label: `MÁX ${maxV}g`, color: '#DC2626', dash: '5,4' },
        { v: optV, label: `ÓPT ${optV}g`, color: '#1D4ED8', dash: '' },
        { v: minV, label: `MÍN ${minV}g`, color: '#DC2626', dash: '5,4' },
      ].map(({ v, label, color, dash }) => {
        const y = toY(v).toFixed(2)
        return `<line x1="${PL}" y1="${y}" x2="${W - PR}" y2="${y}" stroke="${color}" stroke-width="1.5" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`
          + `<text x="${W - PR + 3}" y="${(parseFloat(y) + 4).toFixed(2)}" font-size="8.5" fill="${color}" font-family="monospace" font-weight="bold">${label}</text>`
      }).join('') : ''

      const gridLinesY = gridYVals.map((v, i) =>
        `<line key="${i}" x1="${PL}" y1="${toY(v).toFixed(2)}" x2="${W - PR}" y2="${toY(v).toFixed(2)}" stroke="#F1F5F9" stroke-width="1"/>`
      ).join('')
      const gridLabelsY = gridYVals.map((v, i) =>
        `<text x="${PL - 6}" y="${(toY(v) + 4).toFixed(2)}" text-anchor="end" font-size="9" fill="#94A3B8" font-family="monospace">${v.toFixed(1)}</text>`
      ).join('')
      const gridLinesX = Array.from({ length: PESO_N }, (_, i) =>
        `<line x1="${toX(i).toFixed(2)}" y1="${PT}" x2="${toX(i).toFixed(2)}" y2="${H - PB}" stroke="#F1F5F9" stroke-width="1"/>`
      ).join('')
      const xLabels = Array.from({ length: PESO_N }, (_, i) =>
        `<text x="${toX(i).toFixed(2)}" y="${H - PB + 14}" text-anchor="middle" font-size="9" fill="#64748B" font-family="monospace">${i + 1}</text>`
      ).join('')
      const dotsHTML = pts.map((p, i) => !p ? '' :
        `<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="5" fill="#0A2D63" stroke="#fff" stroke-width="2"/>`
        + (specsOk && (p.v < minV || p.v > maxV) ? `<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="7" fill="none" stroke="#DC2626" stroke-width="1.5"/>` : '')
      ).join('')

      return `<div style="margin:12px 0 0;padding:14px 16px 16px;background:#F8FAFC;border-radius:12px;border:1.5px solid #E2E8F0;page-break-inside:avoid">
        <div style="font-size:11px;font-weight:800;color:#0A2D63;text-transform:uppercase;letter-spacing:.07em;margin-bottom:12px">Control de Pesos — Envasado</div>
        <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start">
          <div style="min-width:220px">
            <table style="border-collapse:collapse;font-size:12px;width:100%">
              <thead>
                <tr style="background:#0A2D63">
                  <th style="padding:5px 10px;color:#fff;font-weight:700;font-size:11px;text-align:center">Muestra</th>
                  <th style="padding:5px 10px;color:#fff;font-weight:700;font-size:11px;text-align:center">Peso (g)</th>
                  ${specsOk ? '<th style="padding:5px 10px;color:#fff;font-weight:700;font-size:11px;text-align:center">Estado</th>' : ''}
                </tr>
              </thead>
              <tbody>
                ${tableRows}
                <tr style="background:#EFF6FF;border-top:2px solid #BFDBFE">
                  <td style="padding:5px 10px;font-weight:800;font-size:11.5px;color:#1E40AF;text-align:center">PROM.</td>
                  <td style="padding:5px 10px;font-family:monospace;font-weight:800;font-size:13px;color:#1E40AF;text-align:center">${!isNaN(promedio) ? promedio.toFixed(2) : '—'}</td>
                  ${specsOk && !isNaN(promedio) ? `<td style="padding:5px 10px;text-align:center"><span style="font-size:10px;font-weight:800;color:${stColor(stateOf(promedio))}">${stateOf(promedio)}</span></td>` : (specsOk ? '<td></td>' : '')}
                </tr>
              </tbody>
            </table>
          </div>
          <div style="flex:1;min-width:340px;overflow-x:auto">
            <svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${W}px;display:block;background:#fff;border:1px solid #E2E8F0;border-radius:8px">
              ${gridLinesY}${gridLinesX}${gridLabelsY}${xLabels}
              <text x="${W / 2}" y="${H - 2}" text-anchor="middle" font-size="9" fill="#94A3B8" font-family="sans-serif">Muestra</text>
              <line x1="${PL}" y1="${PT}" x2="${PL}" y2="${H - PB}" stroke="#CBD5E1" stroke-width="1.5"/>
              <line x1="${PL}" y1="${H - PB}" x2="${W - PR}" y2="${H - PB}" stroke="#CBD5E1" stroke-width="1.5"/>
              ${refLinesHTML}
              ${validPts.length >= 2 ? `<polyline points="${polyline}" fill="none" stroke="#0A2D63" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>` : ''}
              ${dotsHTML}
              ${validPts.length === 0 ? `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" font-size="12" fill="#CBD5E1" font-family="sans-serif">Sin datos</text>` : ''}
              ${specsOk ? `<g>
                <circle cx="${PL + 10}" cy="${PT - 6}" r="3" fill="#0A2D63"/>
                <text x="${PL + 17}" y="${PT - 3}" font-size="8.5" fill="#0A2D63" font-family="sans-serif">Peso medido</text>
                <line x1="${PL + 90}" y1="${PT - 6}" x2="${PL + 100}" y2="${PT - 6}" stroke="#DC2626" stroke-width="1.5" stroke-dasharray="4,3"/>
                <text x="${PL + 104}" y="${PT - 3}" font-size="8.5" fill="#DC2626" font-family="sans-serif">Límites</text>
                <line x1="${PL + 148}" y1="${PT - 6}" x2="${PL + 158}" y2="${PT - 6}" stroke="#1D4ED8" stroke-width="1.5"/>
                <text x="${PL + 162}" y="${PT - 3}" font-size="8.5" fill="#1D4ED8" font-family="sans-serif">Óptimo</text>
              </g>` : ''}
            </svg>
          </div>
        </div>
      </div>`
    }

    const renderFormData = (detalleId: number, labels: Record<string, string>): string => {
      const data = allFormData[detalleId] ?? {}
      const entries = Object.entries(data).filter(([k, v]) =>
        !k.startsWith('_') && !k.startsWith('btn') && !k.startsWith('peso_') &&
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

    const totalFirmas = DETALLE_STRUCT.reduce((n, d) => n + getFirmasDeEstrategia(d.idEstrategiaFirma).length, 0)
    const doneFirmas  = DETALLE_STRUCT.reduce((n, d) =>
      n + getFirmasDeEstrategia(d.idEstrategiaFirma).filter(f => !!firmados[`cie:${d.id}:${f.idFirma}`]).length, 0)

    const procsSections = mockProcesos.map((proc, pi) => {
      const dets = DETALLE_STRUCT.filter(d => d.idProceso === proc.id)
      const detsHTML = dets.map(det => {
        const schema = getDetalleById(det.id)?.jsonSchema ?? ''
        const labels = extractFieldLabels(schema)
        const fc = getFirmasDeEstrategia(det.idEstrategiaFirma)
        const allSigned = fc.length > 0 && fc.every(f => !!firmados[`cie:${det.id}:${f.idFirma}`])
        const detCode = `ET${pi + 1}-F${det.orden}`
        const sigCards = fc.map(f => {
          const info = firmados[`cie:${det.id}:${f.idFirma}`]
          return info
            ? `<div class="sig-card signed">
                <div class="sig-card-top"><span class="sig-status">✓ Firmado</span><span class="sig-icon">✍</span></div>
                <div class="sig-card-body">
                  <div class="sig-role">${esc(f.texto)}</div>
                  <div class="sig-name">${esc(info.nombre)}</div>
                  <div class="sig-cargo">${esc(info.cargo)}</div>
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
            <div class="det-badge">${detCode}</div>
            <div class="det-status ${allSigned ? 'ok' : 'pend'}">${allSigned ? '✓ Conforme' : '⏳ Pendiente'}</div>
          </div>
          ${renderFormData(det.id, labels)}
          ${det.id === 302 ? renderPesoChart(allFormData[302] ?? {}) : ''}
          <div class="sig-block">
            <div class="sig-block-title">Firmas de Aprobación — ${detCode}</div>
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
            <div class="stamp-sub">${doneFirmas} de ${totalFirmas} firmas completadas</div>
            <div class="stamp-date">Impreso: ${printDate} · ${printTime}</div>
          </div>
        </div>`

    const etapaProgressHTML = mockProcesos.map((proc, pi) => {
      const dets = DETALLE_STRUCT.filter(d => d.idProceso === proc.id)
      const total = dets.reduce((n, d) => n + getFirmasDeEstrategia(d.idEstrategiaFirma).length, 0)
      const done  = dets.reduce((n, d) =>
        n + getFirmasDeEstrategia(d.idEstrategiaFirma).filter(f => !!firmados[`cie:${d.id}:${f.idFirma}`]).length, 0)
      const isDone = total > 0 && done === total
      const shortName = proc.descripcion.replace(/^Etapa \d+ — /, '')
      return `<div class="ep-item ${isDone ? 'done' : 'pend'}">
        <div class="ep-num">${pi + 1}</div>
        <div class="ep-body">
          <div class="ep-name">${esc(shortName)}</div>
          <div class="ep-sigs">${done} de ${total} firmas</div>
        </div>
        ${isDone ? '<div class="ep-check">✓</div>' : ''}
      </div>`
    }).join('')

    // ── Desviaciones para este BR ──────────────────────────────────────────
    const brDesviaciones = mockDesviaciones.filter(d => d.idBatchRecord === Number(id))
    const desvHTML = brDesviaciones.length === 0
      ? '<div class="desv-empty">Sin desviaciones registradas para este Batch Record.</div>'
      : brDesviaciones.map(d => {
          const fh = new Date(d.fechaHora)
          const fechaRep = fh.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
          const horaRep  = fh.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
          return `<div class="desv-card">
            <div class="desv-hdr">
              <span class="desv-badge ${d.estado === 'abierta' ? 'abierta' : 'cerrada'}">${d.estado === 'abierta' ? 'Abierta' : 'Cerrada'}</span>
              <span class="desv-campo">${esc(d.labelCampo)}</span>
              <span class="desv-code">${esc(d.detalleCode)}</span>
            </div>
            <div class="desv-body">
              <div class="desv-valor">Valor ingresado: <strong>${esc(d.valorIngresado)}</strong> &nbsp;·&nbsp; ${esc(d.limiteInfo)}</div>
              <div class="desv-desc">${esc(d.descripcion)}</div>
              <div class="desv-meta">Reportado por ${esc(d.usuario)} (${esc(d.cargo)}) · ${fechaRep} ${horaRep}</div>
              ${d.observacionCierre ? `<div class="desv-cierre">
                <div class="desv-cierre-title">Cierre · ${esc(d.usuarioCierre ?? '')}${d.fechaCierre ? ' · ' + new Date(d.fechaCierre).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''}</div>
                <div class="desv-cierre-text">${esc(d.observacionCierre)}</div>
              </div>` : ''}
            </div>
          </div>`
        }).join('')

    // ── Audit trail ────────────────────────────────────────────────────────
    const relevantAudit = [...allAuditEntries]
      .filter(e => Object.keys(AUDIT_CFG).includes(e.accion) &&
        (ALL_DETALLE_IDS.includes(Number(e.idEntidad)) || Number(e.idEntidad) === Number(id)))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    const auditHTML = relevantAudit.length === 0
      ? '<div class="at-empty">Sin eventos de auditoría registrados. Interactúa con el BR para generar entradas.</div>'
      : `<table class="audit-tbl">
          <thead><tr><th>Fecha / Hora</th><th>Acción</th><th>Sección</th><th>Usuario</th><th>Detalle</th></tr></thead>
          <tbody>${relevantAudit.map(e => {
            const cfg = AUDIT_CFG[e.accion] ?? { bg: '#F1F5F9', color: '#475569', label: e.accion }
            const d   = new Date(e.timestamp)
            const fec = d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
            const hor = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            const sec = DETALLE_LABEL[Number(e.idEntidad)] ?? e.descripcionEntidad
            const det = e.cambios?.length
              ? e.cambios.slice(0, 3).map(c => `${esc(c.etiqueta)}: ${esc(c.valorAnterior || '—')} → ${esc(c.valorNuevo || '—')}`).join('<br>')
              : (e.motivo ? esc(e.motivo) : '—')
            return `<tr>
              <td style="white-space:nowrap;font-family:monospace;font-size:7.5pt">${fec}<br>${hor}</td>
              <td><span class="at-badge" style="background:${cfg.bg};color:${cfg.color}">${esc(cfg.label)}</span></td>
              <td style="font-size:7.5pt;color:#475569;max-width:140px">${esc(sec)}</td>
              <td style="font-size:7.5pt;font-weight:700">${esc(e.nombreUsuario ?? '—')}<br><span style="font-size:6.5pt;color:#94A3B8;font-weight:400;font-family:monospace">${esc(e.loginUsuario ?? '')}</span></td>
              <td style="font-size:7pt;color:#475569;max-width:180px">${det}</td>
            </tr>`
          }).join('')}</tbody>
        </table>`

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
.audit-section{margin-bottom:7mm}
.at-empty{padding:10px 14px;color:#94A3B8;font-style:italic;font-size:8pt;border:1px dashed #E2E8F0;border-radius:6px;text-align:center}
.audit-tbl{width:100%;border-collapse:collapse;font-size:8pt;border:1.5px solid #CBD5E1;border-radius:6px;overflow:hidden}
.audit-tbl thead tr{background:#0A2D63}
.audit-tbl th{padding:6px 8px;color:#fff;font-size:6.5pt;font-weight:800;text-transform:uppercase;letter-spacing:.05em;text-align:left;white-space:nowrap}
.audit-tbl tbody tr:nth-child(even) td{background:#F8FAFC}
.audit-tbl td{padding:5px 8px;border-bottom:1px solid #E2E8F0;color:#1E293B;vertical-align:top}
.audit-tbl tbody tr:last-child td{border-bottom:none}
.at-badge{display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:10px;font-size:6.5pt;font-weight:800;text-transform:uppercase;letter-spacing:.04em}
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
        Módulo de Producción Farmacéutica &nbsp;·&nbsp; Receta Maestra RM-SYN-001 v1.0<br>
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

<div class="audit-section">
  <div class="section-lbl">Historial de Auditoría — Trazabilidad GMP</div>
  ${auditHTML}
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

  const userGruposMain = (authUser?.grupos ?? '').split(',').map(g => g.trim())
  const canViewAudit = true || authUser?.esAdministrador || ['Calidad','Supervisión','Administradores','Dirección'].some(g => userGruposMain.includes(g))
  const [derogTarget, setDerogTarget] = useState<{
    firmaKey: string; blockKey: string; detalleId: number
    firmaInfo: FirmaInfo; texto: string; grupo: string
  } | null>(null)

  const handleDerogar = (motivo: string) => {
    if (!derogTarget) return
    const { firmaKey, blockKey, detalleId, texto } = derogTarget
    setFirmados(prev => {
      const next = { ...prev }
      delete next[firmaKey]
      if (firmaKey.startsWith('sec:')) {
        Object.keys(next).forEach(k => {
          if (k.startsWith(`sec:${detalleId}:${blockKey}:`) || k.startsWith(`cie:${detalleId}:`)) delete next[k]
        })
      } else {
        Object.keys(next).forEach(k => { if (k.startsWith(`cie:${detalleId}:`)) delete next[k] })
      }
      try { localStorage.setItem(`br_firmados_${id}`, JSON.stringify(next)) } catch {}
      return next
    })
    registrar({
      entidad: firmaKey.startsWith('cie:') ? 'FirmaCierre' : 'FirmaSeccion',
      idEntidad: detalleId,
      descripcionEntidad: texto,
      accion: 'DEROGAR_FIRMA',
      modulo: 'batch-record',
      motivo,
    })
    setDerogTarget(null)
  }

  const handleSaveDetalle = (
    detalleId: number,
    prev: Record<string, string>,
    next: Record<string, string>,
    labels: Record<string, string>
  ) => {
    const cambios = diffValores(prev, next, labels)
    if (!cambios.length) return
    const det = DETALLE_STRUCT.find(d => d.id === detalleId)
    registrar({
      entidad: 'DetalleValores',
      idEntidad: detalleId,
      descripcionEntidad: det?.descripcion ?? `Detalle ${detalleId}`,
      accion: 'MODIFICAR',
      modulo: 'batch-record',
      cambios,
    })
  }

  // Snapshot de datos actuales por detalle — alimenta handlePrint
  const formDataMapRef = useRef<Record<number, Record<string, unknown>>>({})

  const handleFormData = (
    detalleId: number,
    prev: Record<string, unknown>,
    next: Record<string, unknown>,
    labels: Record<string, string>
  ) => {
    formDataMapRef.current[detalleId] = next   // siempre actualizar snapshot para print
    const cambios = diffFormData(prev, next, labels)
    if (!cambios.length) return
    const det = DETALLE_STRUCT.find(d => d.id === detalleId)
    registrar({
      entidad: 'DetalleValores',
      idEntidad: detalleId,
      descripcionEntidad: det?.descripcion ?? `Detalle ${detalleId}`,
      accion: 'MODIFICAR',
      modulo: 'batch-record',
      cambios,
    })
  }

  const detallesProceso = DETALLE_STRUCT
    .filter(d => d.idProceso === procesoActivo)
    .map(d => {
      const stored = getDetalleById(d.id)
      return { ...d, jsonSchema: stored?.jsonSchema ?? '', idEstrategiaFirma: stored?.idEstrategiaFirma ?? d.idEstrategiaFirma }
    })
  const procesoIdx  = mockProcesos.findIndex(p => p.id === procesoActivo)
  const procesoInfo = mockProcesos[procesoIdx]

  const handleCerrarProceso = () => {
    const allDone = detallesProceso.every(d => {
      const fc = getFirmasDeEstrategia(d.idEstrategiaFirma)
      return fc.length > 0 && fc.every(f => !!firmados[`cie:${d.id}:${f.idFirma}`])
    })
    if (!allDone) return
    setCerradosProcesos(prev => {
      const next = new Set([...prev, procesoActivo])
      try { localStorage.setItem(`br_cerrados_${id}`, JSON.stringify([...next])) } catch {}
      return next
    })
    const nextIdx = procesoIdx + 1
    if (nextIdx < mockProcesos.length) setProcesoActivo(mockProcesos[nextIdx].id)
  }

  const allDetallesCurrentDone = detallesProceso.every(d => {
    const fc = getFirmasDeEstrategia(d.idEstrategiaFirma)
    return fc.length > 0 && fc.every(f => !!firmados[`cie:${d.id}:${f.idFirma}`])
  })

  const handleCerrarBatch = () => {
    const allCerrados = mockProcesos.every(p => cerradosProcesos.has(p.id))
    if (!allCerrados) return
    const brIdx = mockBatchRecords.findIndex(b => b.idBatchRecord === Number(id))
    if (brIdx >= 0) {
      mockBatchRecords[brIdx].idEstado = 2
      mockBatchRecords[brIdx].porcentajeAvance = 100
      mockBatchRecords[brIdx].fechaModificacion = new Date().toISOString()
    }
    try {
      localStorage.removeItem(`br_firmados_${id}`)
      localStorage.removeItem(`br_cerrados_${id}`)
    } catch {}
    navigate('/batch-records')
  }

  return (
    <>
      <style>{`
        /* ── Batch Record page redesign ── */
        .br-card { background:#fff;border-radius:16px;border:1px solid rgba(10,21,48,0.08);
          overflow:hidden;margin-bottom:14px;box-shadow:0 2px 8px rgba(10,21,48,0.06); }
        /* Identity strip */
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
        /* Metadata grid */
        .br-meta-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));
          border-bottom:1px solid rgba(10,21,48,0.07); }
        .br-meta-item { padding:10px 18px;border-right:1px solid rgba(10,21,48,0.06);
          border-bottom:1px solid rgba(10,21,48,0.04); }
        .br-meta-lbl { font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase;
          letter-spacing:0.07em;margin-bottom:3px;font-family:var(--f-mono); }
        .br-meta-val { font-size:13px;font-weight:600;color:#0A1530; }
        /* Overall progress bar */
        .br-progress-bar { padding:8px 20px;display:flex;align-items:center;gap:12px;
          border-bottom:1px solid rgba(10,21,48,0.07);background:#fff; }
        /* Stage tabs */
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
        /* Content layout */
        .br-layout { display:flex;gap:14px;align-items:flex-start;padding:16px;
          background:#F4F3EE; }
        .br-forms { flex:1;min-width:0; }
        /* Det cards */
        .det-card { background:#fff;border-radius:10px;margin-bottom:10px;overflow:hidden;
          border:1px solid rgba(10,21,48,0.09);border-left-width:4px;
          box-shadow:0 1px 3px rgba(10,21,48,0.05);transition:box-shadow 150ms; }
        .det-card.det-open { box-shadow:0 4px 16px rgba(10,21,48,0.09); }
        .det-header { display:flex;align-items:center;gap:12px;padding:13px 16px;
          cursor:pointer;transition:background 100ms;user-select:none;border-radius:0; }
        .det-header:hover { background:rgba(10,21,48,0.03); }
        .det-header:focus-visible { outline:2px solid var(--navy);outline-offset:-2px; }
        /* Firma block */
        .firma-block { background:#F8F7F2;border-top:1.5px solid rgba(10,21,48,0.08); }
        .firma-block-hdr { padding:10px 18px;display:flex;align-items:center;gap:8px;
          border-bottom:1px solid rgba(10,21,48,0.07); }
        /* Closed process banner */
        .proc-closed { display:flex;align-items:center;gap:8px;padding:10px 14px;
          background:rgba(45,93,74,0.06);border:1.5px solid rgba(45,93,74,0.2);
          border-radius:10px;margin-bottom:12px;font-size:12.5px;color:#2D5D4A; }
        /* Footer */
        .br-footer { display:flex;align-items:center;justify-content:flex-end;gap:10px;
          padding:12px 20px;background:#fff;border-top:1px solid rgba(10,21,48,0.07); }
        /* Audit panel */
        .audit-panel { width:280px;flex-shrink:0;background:#fff;border-radius:12px;
          border:1px solid rgba(10,21,48,0.09);overflow:hidden;position:sticky;top:16px;
          box-shadow:0 1px 4px rgba(10,21,48,0.06); }
        /* Reduced motion */
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
              {preLlenado?.descripcionMaterial ?? (
                <span style={{ opacity: 0.5, fontWeight: 400 }}>Cargando…</span>
              )}
            </div>
            <div className="br-doc-ref">
              <span>BR-{id}</span>
              {preLlenado && <>
                <span style={{ opacity: 0.4 }}>·</span>
                <a href={`/ordenes-proceso/${mockBatchRecords.find(b => b.idBatchRecord === Number(id))?.idOrdenProceso}`}
                  style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'none', fontWeight: 600 }}
                  onMouseOver={e => (e.currentTarget.style.color = '#F7C92E')}
                  onMouseOut={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.55)')}>
                  {preLlenado.numeroOrdenProceso}
                </a>
                <span style={{ opacity: 0.4 }}>·</span>
                <a href={`/formulas-control/${mockBatchRecords.find(b => b.idBatchRecord === Number(id))?.idFormulaControl}`}
                  style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'none', fontWeight: 600 }}
                  onMouseOver={e => (e.currentTarget.style.color = '#F7C92E')}
                  onMouseOut={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.55)')}>
                  FC-{mockBatchRecords.find(b => b.idBatchRecord === Number(id))?.idFormulaControl}
                </a>
              </>}
            </div>
          </div>
          <div className="br-identity-actions">
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, flexShrink: 0,
              background: estadoBadge.bg, color: estadoBadge.color, letterSpacing: '.03em',
            }}>
              {estadoBadge.label}
            </span>
            {canViewAudit && !readonly && (
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
          {buildCabeceraItems(preLlenado).map((item, i) => (
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
          {mockProcesos.length > 1 && (
            <button
              className="br-stage-nav"
              aria-label="Etapa anterior"
              disabled={procesoIdx === 0}
              onClick={() => { if (procesoIdx > 0) setProcesoActivo(mockProcesos[procesoIdx - 1].id) }}
            >
              <ChevronLeft size={15} aria-hidden="true" />
            </button>
          )}
          {mockProcesos.map((p, idx) => {
            const isDone     = cerradosProcesos.has(p.id)
            const isUnlocked = idx === 0 || cerradosProcesos.has(mockProcesos[idx - 1].id)
            const isActive   = procesoActivo === p.id
            return (
              <button key={p.id}
                role="tab"
                aria-selected={isActive}
                aria-controls={`tabpanel-${p.id}`}
                id={`tab-${p.id}`}
                className={`br-stage${isDone ? ' done' : ''}`}
                title={!isUnlocked ? `Complete y cierre la Etapa ${idx} primero` : undefined}
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
          {mockProcesos.length > 1 && (
            <button
              className="br-stage-nav"
              aria-label="Etapa siguiente"
              disabled={procesoIdx === mockProcesos.length - 1}
              onClick={() => { if (procesoIdx < mockProcesos.length - 1) setProcesoActivo(mockProcesos[procesoIdx + 1].id) }}
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
            {cerradosProcesos.has(procesoActivo) && (
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
              detallesProceso.map(det => (
                <DetalleCard
                  key={det.id}
                  detalle={det}
                  firmados={firmados}
                  readonly={cerradosProcesos.has(procesoActivo) || readonly}
                  onFirmar={(tipo, firmaKey, texto, grupo) => {
                    if (!readonly) setFirmaModal({ tipo, firmaKey, texto, grupo })
                  }}
                  initialValues={{
                    ...(preLlenado ? extractOpMappings(det.jsonSchema ?? '', preLlenado as unknown as Record<string, unknown>) : {}),
                    ...(PREFILLED[det.id] ?? {}),
                    ...buildDetalleInitialValues(det.id, preLlenado),
                    ...buildMockManualData(det.id, preLlenado, Number(id)),
                  }}
                  lockedKeys={preLlenado ? Array.from(new Set([
                    ...Object.keys(extractOpMappings(det.jsonSchema ?? '', preLlenado as unknown as Record<string, unknown>)),
                    ...Object.entries(buildDetalleInitialValues(det.id, preLlenado)).filter(([, v]) => !Array.isArray(v)).map(([k]) => k),
                  ])) : []}
                  preLlenado={preLlenado}
                  onSave={handleSaveDetalle}
                  onFormData={handleFormData}
                  onRequestDerogar={(fk, bk, detalleId, fi, tx, gr) =>
                    setDerogTarget({ firmaKey: fk, blockKey: bk, detalleId, firmaInfo: fi, texto: tx, grupo: gr })
                  }
                  brId={id}
                />
              ))
            )}
          </div>
          {!readonly && showAudit && canViewAudit && (
            <AuditPreviewPanel brId={id ?? 0} />
          )}
        </div>

        {/* ── Audit trail expandido (solo modo Consultar) ── */}
        {readonly && <AuditExpandedPanel brId={id ?? 0} />}

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
        {brFinalizado && !readonly && (
          <div style={{ margin: '0 0 0', padding: '18px 20px', borderTop: '2px solid #DDD6FE', background: liberadoInfo ? 'linear-gradient(135deg,#F5F3FF 0%,#EDE9FE 100%)' : '#FAFAF9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: liberadoInfo ? '#7C3AED' : '#EDE9FE', display: 'grid', placeItems: 'center' }}>
                <i className="fa fa-certificate" style={{ color: liberadoInfo ? '#fff' : '#7C3AED', fontSize: 16 }} />
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: liberadoInfo ? '#5B21B6' : '#374151', letterSpacing: '.01em' }}>
                  {liberadoInfo ? 'Lote Liberado por Control de Calidad' : 'Liberación de Lote — Aprobación Final QA'}
                </div>
                <div style={{ fontSize: 11.5, color: liberadoInfo ? '#7C3AED' : '#94A3B8', marginTop: 2 }}>
                  {liberadoInfo
                    ? `${liberadoInfo.nombre} · ${liberadoInfo.cargo} · ${liberadoInfo.fecha} ${liberadoInfo.hora}`
                    : 'Requiere firma del Director de Calidad para autorizar la distribución del lote.'}
                </div>
              </div>
              {liberadoInfo ? (
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
          {!allDetallesCurrentDone && !cerradosProcesos.has(procesoActivo) && !readonly && (
            <span id="cerrar-hint" style={{ fontSize: 11.5, color: '#D97706', display: 'flex', alignItems: 'center', gap: 5 }}>
              <i className="fa fa-exclamation-triangle" style={{ fontSize: 10 }} aria-hidden="true" />
              Complete las firmas de todos los formularios para cerrar la etapa
            </span>
          )}
          {!readonly && !cerradosProcesos.has(procesoActivo) && (
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
          {!readonly && brFinalizado && mockProcesos.every(p => cerradosProcesos.has(p.id)) && (
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

      {firmaModal && (
        <FirmaModal
          firma={{ texto: firmaModal.texto, grupo: firmaModal.grupo }}
          onConfirm={(info) => {
            const nextFirmados = { ...firmados, [firmaModal.firmaKey]: info }
            setFirmados(nextFirmados)
            try { localStorage.setItem(`br_firmados_${id}`, JSON.stringify(nextFirmados)) } catch {}
            // Recalculate progress and update the mock BR entry
            const totalFirmas = DETALLE_STRUCT.reduce((n, d) => n + getFirmasDeEstrategia(d.idEstrategiaFirma).length, 0)
            const doneFirmas  = DETALLE_STRUCT.reduce((n, d) =>
              n + getFirmasDeEstrategia(d.idEstrategiaFirma).filter(f => !!nextFirmados[`cie:${d.id}:${f.idFirma}`]).length, 0)
            const pct = totalFirmas > 0 ? Math.round((doneFirmas / totalFirmas) * 100) : 0
            const brIdx = mockBatchRecords.findIndex(b => b.idBatchRecord === Number(id))
            if (brIdx >= 0) mockBatchRecords[brIdx].porcentajeAvance = pct
            const detalleId = Number(firmaModal.firmaKey.split(':')[1])
            const det = DETALLE_STRUCT.find(d => d.id === detalleId)
            registrar({
              entidad: firmaModal.tipo === 'cierre' ? 'FirmaCierre' : 'FirmaSeccion',
              idEntidad: detalleId,
              descripcionEntidad: det?.descripcion ?? `Detalle ${detalleId}`,
              accion: firmaModal.tipo === 'cierre' ? 'FIRMAR_CIERRE' : 'FIRMAR_SECCION',
              modulo: 'batch-record',
              firmante: {
                idUsuario: info.idUsuario,
                nombreUsuario: info.nombre,
                loginUsuario: info.loginUsuario,
                cargo: info.cargo,
              },
            })
            setFirmaModal(null)
          }}
          onClose={() => setFirmaModal(null)}
        />
      )}

      {liberarModal && !liberadoInfo && (
        <FirmaModal
          firma={{ texto: 'Liberación oficial del lote para distribución. Director de Control de Calidad', grupo: 'Director de Calidad' }}
          onConfirm={(info) => {
            setLiberadoInfo(info)
            try { localStorage.setItem(`br_liberado_${id}`, JSON.stringify(info)) } catch {}
            const brIdx = mockBatchRecords.findIndex(b => b.idBatchRecord === Number(id))
            if (brIdx >= 0) mockBatchRecords[brIdx].idEstado = 4
            registrar({
              entidad: 'BatchRecord',
              idEntidad: Number(id),
              descripcionEntidad: `BR-${id}`,
              accion: 'LIBERAR_LOTE',
              modulo: 'batch-record',
              firmante: { idUsuario: info.idUsuario, nombreUsuario: info.nombre, loginUsuario: info.loginUsuario, cargo: info.cargo },
            })
            setLiberarModal(false)
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
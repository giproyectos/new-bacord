import {
  SCHEMA_ET1_F1, SCHEMA_ET1_F2, SCHEMA_ET1_F3,
  SCHEMA_ET2_F1, SCHEMA_ET2_F2, SCHEMA_ET2_F3,
  SCHEMA_ET3_F1, SCHEMA_ET3_F2, SCHEMA_ET3_F3,
} from '@/api/demoSchemas'

export interface DetalleStore {
  id: number
  codigo: string
  descripcion: string
  estado: 'Activo' | 'Inactivo'
  idEstrategiaFirma?: number
  jsonSchema: string
  jsonData: string
  jsonOptions: string
}

const STORAGE_KEY   = 'bacord_detalles_store'
const VERSION_KEY   = 'bacord_schema_version'
const SCHEMA_VERSION = 4  // bump when any bundled schema changes

const DEFAULTS: DetalleStore[] = [
  { id: 101, codigo: 'ET1-F1', descripcion: 'Encabezado e Identificación del Lote',      estado: 'Activo', idEstrategiaFirma: 1, jsonSchema: SCHEMA_ET1_F1, jsonData: '', jsonOptions: '' },
  { id: 102, codigo: 'ET1-F2', descripcion: 'Pesaje de Materias Primas',                 estado: 'Activo', idEstrategiaFirma: 1, jsonSchema: SCHEMA_ET1_F2, jsonData: '', jsonOptions: '' },
  { id: 103, codigo: 'ET1-F3', descripcion: 'Verificación y Cierre de Dispensación',     estado: 'Activo', idEstrategiaFirma: 1, jsonSchema: SCHEMA_ET1_F3, jsonData: '', jsonOptions: '' },
  { id: 201, codigo: 'ET2-F1', descripcion: 'Configuración y Arranque de Encapsuladora', estado: 'Activo', idEstrategiaFirma: 1, jsonSchema: SCHEMA_ET2_F1, jsonData: '', jsonOptions: '' },
  { id: 202, codigo: 'ET2-F2', descripcion: 'Control en Proceso de Encapsulación (CIP)', estado: 'Activo', idEstrategiaFirma: 1, jsonSchema: SCHEMA_ET2_F2, jsonData: '', jsonOptions: '' },
  { id: 203, codigo: 'ET2-F3', descripcion: 'Rendimiento de Encapsulación y Cierre',     estado: 'Activo', idEstrategiaFirma: 1, jsonSchema: SCHEMA_ET2_F3, jsonData: '', jsonOptions: '' },
  { id: 301, codigo: 'ET3-F1', descripcion: 'Inspección Visual AQL',                     estado: 'Activo', idEstrategiaFirma: 1, jsonSchema: SCHEMA_ET3_F1, jsonData: '', jsonOptions: '' },
  { id: 302, codigo: 'ET3-F2', descripcion: 'Empaque Primario y Secundario',             estado: 'Activo', idEstrategiaFirma: 1, jsonSchema: SCHEMA_ET3_F2, jsonData: '', jsonOptions: '' },
  { id: 303, codigo: 'ET3-F3', descripcion: 'Cierre de Lote y Aprobación Final',         estado: 'Activo', idEstrategiaFirma: 2, jsonSchema: SCHEMA_ET3_F3, jsonData: '', jsonOptions: '' },
]

function loadFromStorage(): DetalleStore[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as DetalleStore[]) : null
  } catch { return null }
}

function schemaHasComponents(jsonSchema: string): boolean {
  try {
    const obj = JSON.parse(jsonSchema)
    const comps: unknown[] = Array.isArray(obj?.components) ? obj.components : []
    return comps.length > 0
  } catch { return false }
}

function mergeWithDefaults(stored: DetalleStore[]): DetalleStore[] {
  const storedIds   = new Set(stored.map(d => d.id))
  const defaultIds  = new Set(DEFAULTS.map(d => d.id))
  const storedVer   = parseInt(localStorage.getItem(VERSION_KEY) ?? '0')
  const needsReset  = storedVer < SCHEMA_VERSION

  const merged = stored.map(s => {
    const def = DEFAULTS.find(d => d.id === s.id)
    // For standard schemas: reset when version bumped, or restore if empty
    if (def && (needsReset || !schemaHasComponents(s.jsonSchema))) {
      return { ...s, jsonSchema: def.jsonSchema }
    }
    return s  // custom user-created schemas preserved as-is
  })

  // Add default IDs not yet in stored snapshot
  DEFAULTS.forEach(def => { if (!storedIds.has(def.id)) merged.push(def) })

  if (needsReset) {
    try { localStorage.setItem(VERSION_KEY, String(SCHEMA_VERSION)) } catch {}
  }

  return merged.sort((a, b) => a.id - b.id)
}

const _stored = loadFromStorage()
let _store: DetalleStore[] = _stored ? mergeWithDefaults(_stored) : DEFAULTS
let _nextId = Math.max(9, ..._store.map(d => d.id)) + 1

export function getDetalles(): DetalleStore[]           { return _store }
export function getDetalleById(id: number): DetalleStore | undefined { return _store.find(d => d.id === id) }
export function bumpDetId(): number                     { return _nextId++ }

export function setDetalles(next: DetalleStore[]): void {
  _store = next
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
}

export function resetDetalles(): void {
  _store = DEFAULTS
  _nextId = 10
  try { localStorage.removeItem(STORAGE_KEY) } catch {}
}

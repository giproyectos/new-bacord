import type { BatchRecord, RecetaMaestra, OrdenProceso, Usuario, Firma, FormulaControl, EstrategiaFirma, GrupoResponsable, ComponenteOrden, CargueRegistro, PreLlenadoBR } from '@/types'
import { GRUPOS } from '@/types'

export interface Material { id: number; codigo: string; descripcion: string }
export let mockMateriales: Material[] = [
  { id: 1, codigo: 'SYN-250-CL',  descripcion: 'SYNAPTOMAX 250 mg — Cápsulas de Liberación Modificada' },
  { id: 2, codigo: 'SNX-CAP-250', descripcion: 'SynaptoMax 250 mg — Cápsulas de Liberación Modificada' },
  { id: 3, codigo: 'CAR-500-TLI', descripcion: 'CARBOPLEX 500 mg — Tabletas de Liberación Inmediata' },
  { id: 4, codigo: 'INF-20-SO',   descripcion: 'INFLACORT 20 mg — Suspensión Oral' },
]

// ── Proceso catalog (shared with ProcesosList and RecetaMaestraEditor) ─────────
export interface ProcesoItem { id: number; idMaterial: number; codigo: string; descripcion: string; orden: number }
export let mockProcesosGlobal: ProcesoItem[] = [
  { id: 1, idMaterial: 1, codigo: 'ET1-DISP',  descripcion: 'Etapa 1 — Dispensación de Materias Primas', orden: 1 },
  { id: 2, idMaterial: 1, codigo: 'ET2-ENCAP', descripcion: 'Etapa 2 — Encapsulación',                   orden: 2 },
  { id: 3, idMaterial: 1, codigo: 'ET3-INSP',  descripcion: 'Etapa 3 — Inspección Visual y Empaque',     orden: 3 },
]

// ── Detalle catalog lightweight (for selection in editors) ─────────────────────
export interface DetalleCatalogo { id: number; codigo: string; descripcion: string; idEstrategiaFirma?: number }
export const mockDetallesCatalogo: DetalleCatalogo[] = [
  { id: 101, codigo: 'ET1-F1', descripcion: 'Encabezado e Identificación del Lote',          idEstrategiaFirma: 1 },
  { id: 102, codigo: 'ET1-F2', descripcion: 'Pesaje de Materias Primas',                     idEstrategiaFirma: 1 },
  { id: 103, codigo: 'ET1-F3', descripcion: 'Verificación y Cierre de Dispensación',         idEstrategiaFirma: 1 },
  { id: 201, codigo: 'ET2-F1', descripcion: 'Configuración y Arranque de Encapsuladora',     idEstrategiaFirma: 1 },
  { id: 202, codigo: 'ET2-F2', descripcion: 'Control en Proceso de Encapsulación (CIP)',     idEstrategiaFirma: 1 },
  { id: 203, codigo: 'ET2-F3', descripcion: 'Rendimiento de Encapsulación y Cierre',         idEstrategiaFirma: 1 },
  { id: 301, codigo: 'ET3-F1', descripcion: 'Inspección Visual AQL',                         idEstrategiaFirma: 1 },
  { id: 302, codigo: 'ET3-F2', descripcion: 'Empaque Primario y Secundario',                 idEstrategiaFirma: 1 },
  { id: 303, codigo: 'ET3-F3', descripcion: 'Cierre de Lote y Aprobación Final',             idEstrategiaFirma: 2 },
]

// ── Receta Maestra structure (processes + forms per recipe) ────────────────────
export interface RecetaDetalleItem { id: number; idDetalle: number; orden: number }
export interface RecetaProcesoItem { id: number; idProceso: number; orden: number; detalles: RecetaDetalleItem[] }
export interface RecetaEstructura  { idRecetaMaestra: number; idMaterial: number; procesos: RecetaProcesoItem[] }

export let mockRecetaEstructuras: RecetaEstructura[] = [
  {
    idRecetaMaestra: 1, idMaterial: 1,
    procesos: [
      { id: 1, idProceso: 1, orden: 1, detalles: [
        { id: 1, idDetalle: 101, orden: 1 },
        { id: 2, idDetalle: 102, orden: 2 },
        { id: 3, idDetalle: 103, orden: 3 },
      ]},
      { id: 2, idProceso: 2, orden: 2, detalles: [
        { id: 4, idDetalle: 201, orden: 1 },
        { id: 5, idDetalle: 202, orden: 2 },
        { id: 6, idDetalle: 203, orden: 3 },
      ]},
      { id: 3, idProceso: 3, orden: 3, detalles: [
        { id: 7, idDetalle: 301, orden: 1 },
        { id: 8, idDetalle: 302, orden: 2 },
        { id: 9, idDetalle: 303, orden: 3 },
      ]},
    ],
  },
]

export const delay = (ms = 400) => new Promise((r) => setTimeout(r, ms))

export const GRUPO_PALETTE: Record<string, { bg: string; text: string; dot: string }> = {
  blue:   { bg: '#DBEAFE', text: '#1D4ED8', dot: '#3B82F6' },
  green:  { bg: '#D1FAE5', text: '#065F46', dot: '#10B981' },
  yellow: { bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B' },
  purple: { bg: '#EDE9FE', text: '#5B21B6', dot: '#7C3AED' },
  pink:   { bg: '#FCE7F3', text: '#9D174D', dot: '#EC4899' },
  orange: { bg: '#FFEDD5', text: '#C2410C', dot: '#F97316' },
  red:    { bg: '#FEE2E2', text: '#991B1B', dot: '#EF4444' },
  slate:  { bg: '#F1F5F9', text: '#475569', dot: '#64748B' },
}

export let mockGruposResponsables: GrupoResponsable[] = [
  { id: 1, nombre: 'Producción',      descripcion: 'Operarios de Producción',          colorKey: 'blue'   },
  { id: 2, nombre: 'Supervisión',     descripcion: 'Supervisores de Producción',        colorKey: 'green'  },
  { id: 3, nombre: 'Calidad',         descripcion: 'Control de Calidad',                colorKey: 'purple' },
  { id: 4, nombre: 'Dirección',       descripcion: 'Dirección Técnica de Planta',       colorKey: 'orange' },
  { id: 5, nombre: 'Administradores', descripcion: 'Administradores del Sistema',       colorKey: 'slate'  },
]

export function getGrupoColor(nombre: string) {
  const g = mockGruposResponsables.find(x => x.nombre === nombre)
  return GRUPO_PALETTE[g?.colorKey ?? 'slate'] ?? GRUPO_PALETTE['slate']
}

export const mockUsuarios: Usuario[] = [
  {
    idUsuario: 1, numeroIdentificacion: '10000001',
    nombres: 'Operario', apellidos: 'Producción',
    login: 'operario', email: 'operario@demo.com',
    activo: 1, idCentro: 1, esAdministrador: 0,
    bloqueado: 0, intentosFallidos: 0,
    grupos: 'Producción', idGrupos: '2',
    fechaCreacion: '2024-01-01T00:00:00',
  },
  {
    idUsuario: 2, numeroIdentificacion: '10000002',
    nombres: 'Supervisor', apellidos: 'Producción',
    login: 'supervisor', email: 'supervisor@demo.com',
    activo: 1, idCentro: 1, esAdministrador: 0,
    bloqueado: 0, intentosFallidos: 0,
    grupos: 'Supervisión', idGrupos: '4',
    fechaCreacion: '2024-01-01T00:00:00',
  },
  {
    idUsuario: 3, numeroIdentificacion: '10000003',
    nombres: 'Analista', apellidos: 'Calidad',
    login: 'calidad', email: 'calidad@demo.com',
    activo: 1, idCentro: 1, esAdministrador: 0,
    bloqueado: 0, intentosFallidos: 0,
    grupos: 'Calidad', idGrupos: '3',
    fechaCreacion: '2024-01-01T00:00:00',
  },
  {
    idUsuario: 4, numeroIdentificacion: '10000004',
    nombres: 'Director', apellidos: 'Calidad',
    login: 'director', email: 'director@demo.com',
    activo: 1, idCentro: 1, esAdministrador: 0,
    bloqueado: 0, intentosFallidos: 0,
    grupos: 'Dirección', idGrupos: '5',
    fechaCreacion: '2024-01-01T00:00:00',
  },
  {
    idUsuario: 5, numeroIdentificacion: '10000005',
    nombres: 'Administrador', apellidos: 'Sistema',
    login: 'admin', email: 'admin@demo.com',
    activo: 1, idCentro: 1, esAdministrador: 1,
    bloqueado: 0, intentosFallidos: 0,
    grupos: 'Administradores', idGrupos: '1',
    fechaCreacion: '2024-01-01T00:00:00',
  },
]

export const mockRecetas: RecetaMaestra[] = [
  {
    idRecetaMaestra: 1,
    codigo: 'RM-SYN-001',
    descripcion: 'SYNAPTOMAX 250 mg — Cápsulas de Liberación Modificada',
    version: '1.0',
    idCentro: 1, centro: 'Planta Principal',
    idEstado: 2, estado: 'Aprobada',
    procesos: 'Dispensación, Encapsulación, Inspección y Empaque',
    materiales: 'SYNAPTOMAX 250 mg — Cápsulas de Liberación Modificada',
    idMateriales: '1,2',
    motivo: 'Receta inicial validada para producción de cápsulas de liberación modificada',
    usuarioCreacion: 'admin', fechaCreacion: '2024-01-15T09:00:00',
    usuarioModificacion: 'admin', fechaModificacion: '2024-01-15T09:00:00',
  },
  {
    idRecetaMaestra: 2,
    codigo: 'RM-CAR-002',
    descripcion: 'CARBOPLEX 500 mg — Tabletas de Liberación Inmediata',
    version: '2.1',
    idCentro: 1, centro: 'Planta Principal',
    idEstado: 2, estado: 'Aprobada',
    procesos: 'Dispensación, Granulación, Compresión, Recubrimiento, Empaque',
    materiales: 'CARBOPLEX 500 mg — Tabletas de Liberación Inmediata',
    idMateriales: '3',
    motivo: 'Versión 2.1 con ajuste de excipientes aprobada por Dirección Técnica',
    usuarioCreacion: 'admin', fechaCreacion: '2024-03-10T10:00:00',
    usuarioModificacion: 'admin', fechaModificacion: '2024-03-10T10:00:00',
  },
  {
    idRecetaMaestra: 3,
    codigo: 'RM-INF-003',
    descripcion: 'INFLACORT 20 mg — Suspensión Oral',
    version: '1.2',
    idCentro: 1, centro: 'Planta Principal',
    idEstado: 2, estado: 'Aprobada',
    procesos: 'Dispensación, Preparación de Suspensión, Envasado, Etiquetado',
    materiales: 'INFLACORT 20 mg — Suspensión Oral',
    idMateriales: '4',
    motivo: 'Receta aprobada tras validación de proceso de suspensión acuosa',
    usuarioCreacion: 'calidad', fechaCreacion: '2024-05-20T08:30:00',
    usuarioModificacion: 'calidad', fechaModificacion: '2024-05-20T08:30:00',
  },
]

export const mockOrdenes: OrdenProceso[] = [
  {
    idOrdenProceso: 1, idRecetaMaestra: 1,
    numeroOrdenProceso: 'OP-2024-001',
    codigoMaterial: 'SYN-250-CL',
    descripcionMaterial: 'SYNAPTOMAX 250 mg — Cápsulas de Liberación Modificada',
    idCentro: 1, centro: 'Planta Principal',
    loteLogistico: 'LL-2024-001',
    cantidadOrden: 100, unidadMedida: 'kg',
    loteInspeccion: 'LI-2024-001',
    fechaFabricacion: '2024-08-05', fechaCaducidad: '2026-08-05',
    registroSanitario: 'RS-MED-001-2024',
    formaFarmaceutica: 'Cápsulas de Liberación Modificada',
    idEstado: 3,
  },
  {
    idOrdenProceso: 2, idRecetaMaestra: 2,
    numeroOrdenProceso: 'OP-2024-002',
    codigoMaterial: 'CAR-500-TLI',
    descripcionMaterial: 'CARBOPLEX 500 mg — Tabletas de Liberación Inmediata',
    idCentro: 1, centro: 'Planta Principal',
    loteLogistico: 'LL-2024-002',
    cantidadOrden: 250, unidadMedida: 'kg',
    loteInspeccion: 'LI-2024-002',
    fechaFabricacion: '2024-10-12', fechaCaducidad: '2026-10-12',
    registroSanitario: 'RS-MED-002-2024',
    formaFarmaceutica: 'Tabletas Recubiertas',
    idEstado: 3,
  },
  {
    idOrdenProceso: 3, idRecetaMaestra: 3,
    numeroOrdenProceso: 'OP-2024-003',
    codigoMaterial: 'INF-20-SO',
    descripcionMaterial: 'INFLACORT 20 mg — Suspensión Oral',
    idCentro: 1, centro: 'Planta Principal',
    loteLogistico: 'LL-2024-003',
    cantidadOrden: 500, unidadMedida: 'L',
    loteInspeccion: 'LI-2024-003',
    fechaFabricacion: '2024-11-20', fechaCaducidad: '2026-05-20',
    registroSanitario: 'RS-MED-003-2023',
    formaFarmaceutica: 'Suspensión Oral',
    idEstado: 3,
  },
  {
    idOrdenProceso: 4, idRecetaMaestra: 1,
    numeroOrdenProceso: 'OP-2024-004',
    codigoMaterial: 'SYN-250-CL',
    descripcionMaterial: 'SYNAPTOMAX 250 mg — Cápsulas de Liberación Modificada',
    idCentro: 1, centro: 'Planta Principal',
    loteLogistico: 'LL-2024-004',
    cantidadOrden: 120, unidadMedida: 'kg',
    loteInspeccion: 'LI-2024-004',
    fechaFabricacion: '2024-12-03', fechaCaducidad: '2026-12-03',
    registroSanitario: 'RS-MED-001-2024',
    formaFarmaceutica: 'Cápsulas de Liberación Modificada',
    idEstado: 3,
  },
  {
    idOrdenProceso: 5, idRecetaMaestra: 2,
    numeroOrdenProceso: 'OP-2025-001',
    codigoMaterial: 'CAR-500-TLI',
    descripcionMaterial: 'CARBOPLEX 500 mg — Tabletas de Liberación Inmediata',
    idCentro: 1, centro: 'Planta Principal',
    loteLogistico: 'LL-2025-001',
    cantidadOrden: 300, unidadMedida: 'kg',
    loteInspeccion: 'LI-2025-001',
    fechaFabricacion: '2025-02-10', fechaCaducidad: '2027-02-10',
    registroSanitario: 'RS-MED-002-2024',
    formaFarmaceutica: 'Tabletas Recubiertas',
    idEstado: 3,
  },
  {
    idOrdenProceso: 6, idRecetaMaestra: 1,
    numeroOrdenProceso: 'OP-2025-002',
    codigoMaterial: 'SYN-250-CL',
    descripcionMaterial: 'SYNAPTOMAX 250 mg — Cápsulas de Liberación Modificada',
    idCentro: 1, centro: 'Planta Principal',
    loteLogistico: 'LL-2025-002',
    cantidadOrden: 80, unidadMedida: 'kg',
    loteInspeccion: 'LI-2025-002',
    fechaFabricacion: '2025-06-01', fechaCaducidad: '2027-06-01',
    registroSanitario: 'RS-MED-001-2024',
    formaFarmaceutica: 'Cápsulas de Liberación Modificada',
    idEstado: 1,
  },
]

export const mockFirmas: Firma[] = [
  { idFirma: 1, codigo: 'F-PROD', descripcion: 'Firma Operario de Producción',     texto: 'Realizado por — Operario de Producción',      activo: 1, idGrupo: 2 },
  { idFirma: 2, codigo: 'F-SUP',  descripcion: 'Firma Supervisor de Producción',   texto: 'Verificado por — Supervisor de Producción',    activo: 1, idGrupo: 4 },
  { idFirma: 3, codigo: 'F-CAL',  descripcion: 'Firma Analista de Calidad',        texto: 'Aprobado por — Analista de Control de Calidad', activo: 1, idGrupo: 3 },
  { idFirma: 4, codigo: 'F-DIR',  descripcion: 'Firma Director de Calidad',        texto: 'Autorizado por — Director de Calidad',          activo: 1, idGrupo: 5 },
]

export const mockEstrategiasFirma: EstrategiaFirma[] = [
  {
    id: 1, codigo: 'EF-01',
    descripcion: 'Verificación Estándar — Operario + Supervisor',
    usuarioCreacion: 'admin', fechaCreacion: '2024-01-01T00:00:00', activo: 1,
    firmas: [
      { idFirma: 1, codigo: 'F-PROD', texto: 'Realizado por — Operario de Producción',    grupo: 'Producción',  orden: 1, activo: true },
      { idFirma: 2, codigo: 'F-SUP',  texto: 'Verificado por — Supervisor de Producción', grupo: 'Supervisión', orden: 2, activo: true },
    ],
    gruposDerogacion: ['Calidad', 'Supervisión', 'Administradores'],
  },
  {
    id: 2, codigo: 'EF-02',
    descripcion: 'Cierre de Lote — Triple Aprobación (Supervisión + Calidad + Dirección)',
    usuarioCreacion: 'admin', fechaCreacion: '2024-01-01T00:00:00', activo: 1,
    firmas: [
      { idFirma: 2, codigo: 'F-SUP', texto: 'Jefe de Producción',                          grupo: 'Supervisión', orden: 1, activo: true },
      { idFirma: 3, codigo: 'F-CAL', texto: 'Analista de Control de Calidad',               grupo: 'Calidad',     orden: 2, activo: true },
      { idFirma: 4, codigo: 'F-DIR', texto: 'Director de Calidad',                          grupo: 'Dirección',   orden: 3, activo: true },
    ],
    gruposDerogacion: ['Calidad', 'Dirección', 'Administradores'],
  },
]

export const mockFormulasControl: FormulaControl[] = [
  {
    idFormulaControl: 1, idRecetaMaestra: 1, idOrdenProceso: 1,
    motivoEstado: 'Fórmula de control aprobada para lote demo',
    idEstado: 2, idCentro: 1,
    idUsuarioCreacion: 1, fechaCreacion: '2025-11-01T08:00:00',
  },
  {
    idFormulaControl: 2, idRecetaMaestra: 2, idOrdenProceso: 2,
    motivoEstado: 'FC aprobada — CARBOPLEX lote diciembre 2025',
    idEstado: 2, idCentro: 1,
    idUsuarioCreacion: 1, fechaCreacion: '2025-12-10T09:00:00',
  },
  {
    idFormulaControl: 3, idRecetaMaestra: 3, idOrdenProceso: 3,
    motivoEstado: 'FC aprobada — INFLACORT suspensión enero 2026',
    idEstado: 2, idCentro: 1,
    idUsuarioCreacion: 2, fechaCreacion: '2026-01-18T08:30:00',
  },
  {
    idFormulaControl: 4, idRecetaMaestra: 1, idOrdenProceso: 4,
    motivoEstado: 'FC aprobada — SYNAPTOMAX segunda corrida febrero 2026',
    idEstado: 2, idCentro: 1,
    idUsuarioCreacion: 1, fechaCreacion: '2026-02-01T07:00:00',
  },
  {
    idFormulaControl: 5, idRecetaMaestra: 2, idOrdenProceso: 5,
    motivoEstado: 'FC cancelada por desviación en proceso de compresión',
    idEstado: 3, idCentro: 1,
    idUsuarioCreacion: 2, fechaCreacion: '2026-03-08T09:00:00',
  },
  {
    idFormulaControl: 6, idRecetaMaestra: 1, idOrdenProceso: 6,
    motivoEstado: '',
    idEstado: 2, idCentro: 1,
    idUsuarioCreacion: 1, fechaCreacion: '2026-05-28T08:00:00',
  },
]

export let mockComponentes: ComponenteOrden[] = [
  { idComponente: 1, idOrdenProceso: 1, codigoMaterialComponente: 'MP-SYN-01',  descripcionMaterialComponente: 'Synaptozina HCl (Principio Activo)',       cantidad: 25.5,   unidadMedida: 'kg', loteComponente: 'LC-SYN-001', codigoListaMateriales: 'BOM-SYN-001' },
  { idComponente: 2, idOrdenProceso: 1, codigoMaterialComponente: 'MP-HPMC-02', descripcionMaterialComponente: 'HPMC K15M (Polímero de Liberación Retard)', cantidad: 18.0,   unidadMedida: 'kg', loteComponente: 'LC-HPM-002', codigoListaMateriales: 'BOM-SYN-001' },
  { idComponente: 3, idOrdenProceso: 1, codigoMaterialComponente: 'MP-CAP-03',  descripcionMaterialComponente: 'Cápsulas Gelatina Dura #00',                cantidad: 105000, unidadMedida: 'un', loteComponente: 'LC-CAP-003', codigoListaMateriales: 'BOM-SYN-001' },
  { idComponente: 4, idOrdenProceso: 1, codigoMaterialComponente: 'MP-MCC-04',  descripcionMaterialComponente: 'Celulosa Microcristalina PH-102',            cantidad: 8.75,   unidadMedida: 'kg', loteComponente: 'LC-MCC-004', codigoListaMateriales: 'BOM-SYN-001' },
  { idComponente: 5, idOrdenProceso: 1, codigoMaterialComponente: 'MP-EST-05',  descripcionMaterialComponente: 'Estearato de Magnesio',                     cantidad: 0.5,    unidadMedida: 'kg', loteComponente: 'LC-EST-005', codigoListaMateriales: 'BOM-SYN-001' },
]

export let mockPreLlenados: PreLlenadoBR[] = [
  {
    idBatchRecord: 1,
    numeroOrdenProceso: 'OP-2024-001',
    codigoMaterial: 'SYN-250-CL',
    descripcionMaterial: 'SYNAPTOMAX 250 mg — Cápsulas de Liberación Modificada',
    loteLogistico: 'LL-2024-001', loteInspeccion: 'LI-2024-001',
    fechaFabricacion: '2024-08-05', fechaCaducidad: '2026-08-05',
    registroSanitario: 'RS-MED-001-2024', formaFarmaceutica: 'Cápsulas de Liberación Modificada',
    cantidadOrden: 100, unidadMedida: 'kg', centro: 'Planta Principal',
    componentes: [
      { idComponente: 1, idOrdenProceso: 1, codigoMaterialComponente: 'MP-SYN-01',  descripcionMaterialComponente: 'Synaptozina HCl (Principio Activo)',       cantidad: 25.5,   unidadMedida: 'kg', loteComponente: 'LC-SYN-001', codigoListaMateriales: 'BOM-SYN-001' },
      { idComponente: 2, idOrdenProceso: 1, codigoMaterialComponente: 'MP-HPMC-02', descripcionMaterialComponente: 'HPMC K15M (Polímero de Liberación Retard)', cantidad: 18.0,   unidadMedida: 'kg', loteComponente: 'LC-HPM-002', codigoListaMateriales: 'BOM-SYN-001' },
      { idComponente: 3, idOrdenProceso: 1, codigoMaterialComponente: 'MP-CAP-03',  descripcionMaterialComponente: 'Cápsulas Gelatina Dura #00',                cantidad: 105000, unidadMedida: 'un', loteComponente: 'LC-CAP-003', codigoListaMateriales: 'BOM-SYN-001' },
      { idComponente: 4, idOrdenProceso: 1, codigoMaterialComponente: 'MP-MCC-04',  descripcionMaterialComponente: 'Celulosa Microcristalina PH-102',            cantidad: 8.75,   unidadMedida: 'kg', loteComponente: 'LC-MCC-004', codigoListaMateriales: 'BOM-SYN-001' },
      { idComponente: 5, idOrdenProceso: 1, codigoMaterialComponente: 'MP-EST-05',  descripcionMaterialComponente: 'Estearato de Magnesio',                     cantidad: 0.5,    unidadMedida: 'kg', loteComponente: 'LC-EST-005', codigoListaMateriales: 'BOM-SYN-001' },
    ],
  },
  {
    idBatchRecord: 2,
    numeroOrdenProceso: 'OP-2024-002',
    codigoMaterial: 'CAR-500-TLI',
    descripcionMaterial: 'CARBOPLEX 500 mg — Tabletas de Liberación Inmediata',
    loteLogistico: 'LL-2024-002', loteInspeccion: 'LI-2024-002',
    fechaFabricacion: '2024-10-12', fechaCaducidad: '2026-10-12',
    registroSanitario: 'RS-MED-002-2024', formaFarmaceutica: 'Tabletas Recubiertas',
    cantidadOrden: 250, unidadMedida: 'kg', centro: 'Planta Principal',
    componentes: [
      { idComponente: 10, idOrdenProceso: 2, codigoMaterialComponente: 'MP-CAR-01', descripcionMaterialComponente: 'Carboplosina Base (Principio Activo)',    cantidad: 125.0,  unidadMedida: 'kg', loteComponente: 'LC-CAR-010', codigoListaMateriales: 'BOM-CAR-002' },
      { idComponente: 11, idOrdenProceso: 2, codigoMaterialComponente: 'MP-LAC-02', descripcionMaterialComponente: 'Lactosa Monohidrato (Diluyente)',           cantidad: 87.5,   unidadMedida: 'kg', loteComponente: 'LC-LAC-011', codigoListaMateriales: 'BOM-CAR-002' },
      { idComponente: 12, idOrdenProceso: 2, codigoMaterialComponente: 'MP-ALM-03', descripcionMaterialComponente: 'Almidón de Maíz (Disgregante)',             cantidad: 25.0,   unidadMedida: 'kg', loteComponente: 'LC-ALM-012', codigoListaMateriales: 'BOM-CAR-002' },
      { idComponente: 13, idOrdenProceso: 2, codigoMaterialComponente: 'MP-HPC-04', descripcionMaterialComponente: 'HPC-SL (Aglutinante)',                     cantidad: 10.0,   unidadMedida: 'kg', loteComponente: 'LC-HPC-013', codigoListaMateriales: 'BOM-CAR-002' },
      { idComponente: 14, idOrdenProceso: 2, codigoMaterialComponente: 'MP-EST-05', descripcionMaterialComponente: 'Estearato de Magnesio',                    cantidad: 2.5,    unidadMedida: 'kg', loteComponente: 'LC-EST-014', codigoListaMateriales: 'BOM-CAR-002' },
    ],
  },
  {
    idBatchRecord: 3,
    numeroOrdenProceso: 'OP-2024-003',
    codigoMaterial: 'INF-20-SO',
    descripcionMaterial: 'INFLACORT 20 mg — Suspensión Oral',
    loteLogistico: 'LL-2024-003', loteInspeccion: 'LI-2024-003',
    fechaFabricacion: '2024-11-20', fechaCaducidad: '2026-05-20',
    registroSanitario: 'RS-MED-003-2023', formaFarmaceutica: 'Suspensión Oral',
    cantidadOrden: 500, unidadMedida: 'L', centro: 'Planta Principal',
    componentes: [
      { idComponente: 20, idOrdenProceso: 3, codigoMaterialComponente: 'MP-INF-01', descripcionMaterialComponente: 'Inflacortisona Micronizada (PA)',           cantidad: 10.0,   unidadMedida: 'kg', loteComponente: 'LC-INF-020', codigoListaMateriales: 'BOM-INF-003' },
      { idComponente: 21, idOrdenProceso: 3, codigoMaterialComponente: 'MP-CMC-02', descripcionMaterialComponente: 'Carboximetilcelulosa Sódica (Viscosante)', cantidad: 5.0,    unidadMedida: 'kg', loteComponente: 'LC-CMC-021', codigoListaMateriales: 'BOM-INF-003' },
      { idComponente: 22, idOrdenProceso: 3, codigoMaterialComponente: 'MP-SOR-03', descripcionMaterialComponente: 'Sorbitol 70% (Edulcorante)',                cantidad: 50.0,   unidadMedida: 'L',  loteComponente: 'LC-SOR-022', codigoListaMateriales: 'BOM-INF-003' },
      { idComponente: 23, idOrdenProceso: 3, codigoMaterialComponente: 'MP-PAR-04', descripcionMaterialComponente: 'Metilparabeno (Conservante)',               cantidad: 0.5,    unidadMedida: 'kg', loteComponente: 'LC-PAR-023', codigoListaMateriales: 'BOM-INF-003' },
    ],
  },
  {
    idBatchRecord: 4,
    numeroOrdenProceso: 'OP-2024-004',
    codigoMaterial: 'SYN-250-CL',
    descripcionMaterial: 'SYNAPTOMAX 250 mg — Cápsulas de Liberación Modificada',
    loteLogistico: 'LL-2024-004', loteInspeccion: 'LI-2024-004',
    fechaFabricacion: '2024-12-03', fechaCaducidad: '2026-12-03',
    registroSanitario: 'RS-MED-001-2024', formaFarmaceutica: 'Cápsulas de Liberación Modificada',
    cantidadOrden: 120, unidadMedida: 'kg', centro: 'Planta Principal',
    componentes: [
      { idComponente: 30, idOrdenProceso: 4, codigoMaterialComponente: 'MP-SYN-01',  descripcionMaterialComponente: 'Synaptozina HCl (Principio Activo)',       cantidad: 30.6,   unidadMedida: 'kg', loteComponente: 'LC-SYN-030', codigoListaMateriales: 'BOM-SYN-001' },
      { idComponente: 31, idOrdenProceso: 4, codigoMaterialComponente: 'MP-HPMC-02', descripcionMaterialComponente: 'HPMC K15M (Polímero de Liberación Retard)', cantidad: 21.6,  unidadMedida: 'kg', loteComponente: 'LC-HPM-031', codigoListaMateriales: 'BOM-SYN-001' },
      { idComponente: 32, idOrdenProceso: 4, codigoMaterialComponente: 'MP-CAP-03',  descripcionMaterialComponente: 'Cápsulas Gelatina Dura #00',                cantidad: 126000, unidadMedida: 'un', loteComponente: 'LC-CAP-032', codigoListaMateriales: 'BOM-SYN-001' },
      { idComponente: 33, idOrdenProceso: 4, codigoMaterialComponente: 'MP-MCC-04',  descripcionMaterialComponente: 'Celulosa Microcristalina PH-102',            cantidad: 10.5,  unidadMedida: 'kg', loteComponente: 'LC-MCC-033', codigoListaMateriales: 'BOM-SYN-001' },
      { idComponente: 34, idOrdenProceso: 4, codigoMaterialComponente: 'MP-EST-05',  descripcionMaterialComponente: 'Estearato de Magnesio',                     cantidad: 0.6,   unidadMedida: 'kg', loteComponente: 'LC-EST-034', codigoListaMateriales: 'BOM-SYN-001' },
    ],
  },
  {
    idBatchRecord: 5,
    numeroOrdenProceso: 'OP-2025-001',
    codigoMaterial: 'CAR-500-TLI',
    descripcionMaterial: 'CARBOPLEX 500 mg — Tabletas de Liberación Inmediata',
    loteLogistico: 'LL-2025-001', loteInspeccion: 'LI-2025-001',
    fechaFabricacion: '2025-02-10', fechaCaducidad: '2027-02-10',
    registroSanitario: 'RS-MED-002-2024', formaFarmaceutica: 'Tabletas Recubiertas',
    cantidadOrden: 300, unidadMedida: 'kg', centro: 'Planta Principal',
    componentes: [
      { idComponente: 40, idOrdenProceso: 5, codigoMaterialComponente: 'MP-CAR-01', descripcionMaterialComponente: 'Carboplosina Base (Principio Activo)',    cantidad: 150.0, unidadMedida: 'kg', loteComponente: 'LC-CAR-040', codigoListaMateriales: 'BOM-CAR-002' },
      { idComponente: 41, idOrdenProceso: 5, codigoMaterialComponente: 'MP-LAC-02', descripcionMaterialComponente: 'Lactosa Monohidrato (Diluyente)',          cantidad: 105.0, unidadMedida: 'kg', loteComponente: 'LC-LAC-041', codigoListaMateriales: 'BOM-CAR-002' },
      { idComponente: 42, idOrdenProceso: 5, codigoMaterialComponente: 'MP-ALM-03', descripcionMaterialComponente: 'Almidón de Maíz (Disgregante)',            cantidad: 30.0,  unidadMedida: 'kg', loteComponente: 'LC-ALM-042', codigoListaMateriales: 'BOM-CAR-002' },
      { idComponente: 43, idOrdenProceso: 5, codigoMaterialComponente: 'MP-EST-05', descripcionMaterialComponente: 'Estearato de Magnesio',                   cantidad: 3.0,   unidadMedida: 'kg', loteComponente: 'LC-EST-043', codigoListaMateriales: 'BOM-CAR-002' },
    ],
  },
  {
    idBatchRecord: 6,
    numeroOrdenProceso: 'OP-2025-002',
    codigoMaterial: 'SYN-250-CL',
    descripcionMaterial: 'SYNAPTOMAX 250 mg — Cápsulas de Liberación Modificada',
    loteLogistico: 'LL-2025-002', loteInspeccion: 'LI-2025-002',
    fechaFabricacion: '2025-06-01', fechaCaducidad: '2027-06-01',
    registroSanitario: 'RS-MED-001-2024', formaFarmaceutica: 'Cápsulas de Liberación Modificada',
    cantidadOrden: 80, unidadMedida: 'kg', centro: 'Planta Principal',
    componentes: [
      { idComponente: 50, idOrdenProceso: 6, codigoMaterialComponente: 'MP-SYN-01',  descripcionMaterialComponente: 'Synaptozina HCl (Principio Activo)',       cantidad: 20.4,  unidadMedida: 'kg', loteComponente: 'LC-SYN-050', codigoListaMateriales: 'BOM-SYN-001' },
      { idComponente: 51, idOrdenProceso: 6, codigoMaterialComponente: 'MP-HPMC-02', descripcionMaterialComponente: 'HPMC K15M (Polímero de Liberación Retard)', cantidad: 14.4, unidadMedida: 'kg', loteComponente: 'LC-HPM-051', codigoListaMateriales: 'BOM-SYN-001' },
      { idComponente: 52, idOrdenProceso: 6, codigoMaterialComponente: 'MP-CAP-03',  descripcionMaterialComponente: 'Cápsulas Gelatina Dura #00',                cantidad: 84000, unidadMedida: 'un', loteComponente: 'LC-CAP-052', codigoListaMateriales: 'BOM-SYN-001' },
      { idComponente: 53, idOrdenProceso: 6, codigoMaterialComponente: 'MP-MCC-04',  descripcionMaterialComponente: 'Celulosa Microcristalina PH-102',            cantidad: 7.0,  unidadMedida: 'kg', loteComponente: 'LC-MCC-053', codigoListaMateriales: 'BOM-SYN-001' },
      { idComponente: 54, idOrdenProceso: 6, codigoMaterialComponente: 'MP-EST-05',  descripcionMaterialComponente: 'Estearato de Magnesio',                     cantidad: 0.4,  unidadMedida: 'kg', loteComponente: 'LC-EST-054', codigoListaMateriales: 'BOM-SYN-001' },
    ],
  },
]

export let mockCarguesOP: CargueRegistro[] = [
  { id: 1, archivo: 'ordenes_agosto_2024.csv',    fechaCargue: '2024-08-01', usuario: 'admin',  totalOrdenes: 3, totalComponentes: 12, errores: 0, estado: 'Exitoso'    },
  { id: 2, archivo: 'ordenes_septiembre_2024.csv', fechaCargue: '2024-09-15', usuario: 'jborda', totalOrdenes: 5, totalComponentes: 18, errores: 3, estado: 'Con errores' },
]

export const mockBatchRecords: BatchRecord[] = [
  {
    idBatchRecord: 1, idFormulaControl: 1, idRecetaMaestra: 1,
    idOrdenProceso: 1, motivoEstado: '',
    idEstado: 1, idCentro: 1,
    idUsuarioCreacion: 1, fechaCreacion: '2025-11-05T07:00:00',
    idUsuarioModificacion: 1, fechaModificacion: '2025-11-12T14:30:00',
    porcentajeAvance: 33,
  },
  {
    idBatchRecord: 2, idFormulaControl: 2, idRecetaMaestra: 2,
    idOrdenProceso: 2, motivoEstado: '',
    idEstado: 1, idCentro: 1,
    idUsuarioCreacion: 2, fechaCreacion: '2025-12-14T08:00:00',
    idUsuarioModificacion: 2, fechaModificacion: '2025-12-18T11:00:00',
    porcentajeAvance: 67,
  },
  {
    idBatchRecord: 3, idFormulaControl: 3, idRecetaMaestra: 3,
    idOrdenProceso: 3, motivoEstado: '',
    idEstado: 1, idCentro: 1,
    idUsuarioCreacion: 1, fechaCreacion: '2026-01-22T09:30:00',
    idUsuarioModificacion: 3, fechaModificacion: '2026-01-25T16:45:00',
    porcentajeAvance: 89,
  },
  {
    idBatchRecord: 4, idFormulaControl: 4, idRecetaMaestra: 1,
    idOrdenProceso: 4, motivoEstado: '',
    idEstado: 2, idCentro: 1,
    idUsuarioCreacion: 2, fechaCreacion: '2026-02-05T07:00:00',
    idUsuarioModificacion: 4, fechaModificacion: '2026-02-09T17:00:00',
    porcentajeAvance: 100,
  },
  {
    idBatchRecord: 5, idFormulaControl: 5, idRecetaMaestra: 2,
    idOrdenProceso: 5, motivoEstado: 'Desviación crítica en peso de tabletas — fuera de especificación ±5%',
    idEstado: 3, idCentro: 1,
    idUsuarioCreacion: 1, fechaCreacion: '2026-03-12T08:00:00',
    idUsuarioModificacion: 1, fechaModificacion: '2026-03-13T10:15:00',
    porcentajeAvance: 22,
  },
  {
    idBatchRecord: 6, idFormulaControl: 6, idRecetaMaestra: 1,
    idOrdenProceso: 6, motivoEstado: '',
    idEstado: 1, idCentro: 1,
    idUsuarioCreacion: 1, fechaCreacion: '2026-05-02T07:00:00',
    idUsuarioModificacion: 1, fechaModificacion: '2026-05-02T07:00:00',
    porcentajeAvance: 0,
  },
]

// Pre-populated firmados (cierre signatures) for mock BRs, keyed by idBatchRecord.
// Format: cie:${detalleId}:${idFirma}
// EF-01 (detalles 101-302): idFirma 1 (Operario) + idFirma 2 (Supervisor)
// EF-02 (detalle 303 only): idFirma 2 (Jefe Prod) + idFirma 3 (Calidad) + idFirma 4 (Director)
type MockFirma = { nombre: string; cargo: string; fecha: string; hora: string; loginUsuario: string; idUsuario: number }
export const mockFirmadosBR: Record<number, Record<string, MockFirma>> = {
  // BR1 — 33% — Etapa 1 completa (6/19 firmas)
  1: {
    'cie:101:1': { nombre: 'Operario Producción',   cargo: 'Técnico de Producción',       fecha: '2025-11-05', hora: '08:15', loginUsuario: 'operario',   idUsuario: 1 },
    'cie:101:2': { nombre: 'Supervisor Producción', cargo: 'Supervisor de Turno',          fecha: '2025-11-05', hora: '08:42', loginUsuario: 'supervisor', idUsuario: 2 },
    'cie:102:1': { nombre: 'Operario Producción',   cargo: 'Técnico de Producción',       fecha: '2025-11-05', hora: '10:05', loginUsuario: 'operario',   idUsuario: 1 },
    'cie:102:2': { nombre: 'Supervisor Producción', cargo: 'Supervisor de Turno',          fecha: '2025-11-05', hora: '10:28', loginUsuario: 'supervisor', idUsuario: 2 },
    'cie:103:1': { nombre: 'Operario Producción',   cargo: 'Técnico de Producción',       fecha: '2025-11-05', hora: '11:03', loginUsuario: 'operario',   idUsuario: 1 },
    'cie:103:2': { nombre: 'Supervisor Producción', cargo: 'Supervisor de Turno',          fecha: '2025-11-05', hora: '11:18', loginUsuario: 'supervisor', idUsuario: 2 },
  },
  // BR2 — 67% — Etapas 1+2 completas (12/19 firmas)
  2: {
    'cie:101:1': { nombre: 'Operario Producción',   cargo: 'Técnico de Producción',       fecha: '2025-12-14', hora: '07:45', loginUsuario: 'operario',   idUsuario: 1 },
    'cie:101:2': { nombre: 'Supervisor Producción', cargo: 'Supervisor de Turno',          fecha: '2025-12-14', hora: '08:10', loginUsuario: 'supervisor', idUsuario: 2 },
    'cie:102:1': { nombre: 'Operario Producción',   cargo: 'Técnico de Producción',       fecha: '2025-12-14', hora: '09:55', loginUsuario: 'operario',   idUsuario: 1 },
    'cie:102:2': { nombre: 'Supervisor Producción', cargo: 'Supervisor de Turno',          fecha: '2025-12-14', hora: '10:22', loginUsuario: 'supervisor', idUsuario: 2 },
    'cie:103:1': { nombre: 'Operario Producción',   cargo: 'Técnico de Producción',       fecha: '2025-12-14', hora: '11:08', loginUsuario: 'operario',   idUsuario: 1 },
    'cie:103:2': { nombre: 'Supervisor Producción', cargo: 'Supervisor de Turno',          fecha: '2025-12-14', hora: '11:30', loginUsuario: 'supervisor', idUsuario: 2 },
    'cie:201:1': { nombre: 'Operario Producción',   cargo: 'Técnico de Producción',       fecha: '2025-12-15', hora: '07:30', loginUsuario: 'operario',   idUsuario: 1 },
    'cie:201:2': { nombre: 'Supervisor Producción', cargo: 'Supervisor de Turno',          fecha: '2025-12-15', hora: '07:55', loginUsuario: 'supervisor', idUsuario: 2 },
    'cie:202:1': { nombre: 'Operario Producción',   cargo: 'Técnico de Producción',       fecha: '2025-12-15', hora: '19:40', loginUsuario: 'operario',   idUsuario: 1 },
    'cie:202:2': { nombre: 'Supervisor Producción', cargo: 'Supervisor de Turno',          fecha: '2025-12-15', hora: '20:05', loginUsuario: 'supervisor', idUsuario: 2 },
    'cie:203:1': { nombre: 'Operario Producción',   cargo: 'Técnico de Producción',       fecha: '2025-12-15', hora: '20:48', loginUsuario: 'operario',   idUsuario: 1 },
    'cie:203:2': { nombre: 'Supervisor Producción', cargo: 'Supervisor de Turno',          fecha: '2025-12-15', hora: '21:05', loginUsuario: 'supervisor', idUsuario: 2 },
  },
  // BR3 — 89% — Etapas 1+2+3 excepto ET3-F3 (16/19 firmas)
  3: {
    'cie:101:1': { nombre: 'Operario Producción',   cargo: 'Técnico de Producción',       fecha: '2026-01-22', hora: '08:00', loginUsuario: 'operario',   idUsuario: 1 },
    'cie:101:2': { nombre: 'Supervisor Producción', cargo: 'Supervisor de Turno',          fecha: '2026-01-22', hora: '08:25', loginUsuario: 'supervisor', idUsuario: 2 },
    'cie:102:1': { nombre: 'Operario Producción',   cargo: 'Técnico de Producción',       fecha: '2026-01-22', hora: '10:10', loginUsuario: 'operario',   idUsuario: 1 },
    'cie:102:2': { nombre: 'Supervisor Producción', cargo: 'Supervisor de Turno',          fecha: '2026-01-22', hora: '10:35', loginUsuario: 'supervisor', idUsuario: 2 },
    'cie:103:1': { nombre: 'Operario Producción',   cargo: 'Técnico de Producción',       fecha: '2026-01-22', hora: '11:15', loginUsuario: 'operario',   idUsuario: 1 },
    'cie:103:2': { nombre: 'Supervisor Producción', cargo: 'Supervisor de Turno',          fecha: '2026-01-22', hora: '11:40', loginUsuario: 'supervisor', idUsuario: 2 },
    'cie:201:1': { nombre: 'Operario Producción',   cargo: 'Técnico de Producción',       fecha: '2026-01-23', hora: '07:00', loginUsuario: 'operario',   idUsuario: 1 },
    'cie:201:2': { nombre: 'Supervisor Producción', cargo: 'Supervisor de Turno',          fecha: '2026-01-23', hora: '07:22', loginUsuario: 'supervisor', idUsuario: 2 },
    'cie:202:1': { nombre: 'Operario Producción',   cargo: 'Técnico de Producción',       fecha: '2026-01-23', hora: '17:10', loginUsuario: 'operario',   idUsuario: 1 },
    'cie:202:2': { nombre: 'Supervisor Producción', cargo: 'Supervisor de Turno',          fecha: '2026-01-23', hora: '17:35', loginUsuario: 'supervisor', idUsuario: 2 },
    'cie:203:1': { nombre: 'Operario Producción',   cargo: 'Técnico de Producción',       fecha: '2026-01-23', hora: '18:20', loginUsuario: 'operario',   idUsuario: 1 },
    'cie:203:2': { nombre: 'Supervisor Producción', cargo: 'Supervisor de Turno',          fecha: '2026-01-23', hora: '18:45', loginUsuario: 'supervisor', idUsuario: 2 },
    'cie:301:1': { nombre: 'Operario Producción',   cargo: 'Técnico de Producción',       fecha: '2026-01-24', hora: '08:30', loginUsuario: 'operario',   idUsuario: 1 },
    'cie:301:2': { nombre: 'Supervisor Producción', cargo: 'Supervisor de Turno',          fecha: '2026-01-24', hora: '09:00', loginUsuario: 'supervisor', idUsuario: 2 },
    'cie:302:1': { nombre: 'Operario Producción',   cargo: 'Técnico de Producción',       fecha: '2026-01-24', hora: '15:20', loginUsuario: 'operario',   idUsuario: 1 },
    'cie:302:2': { nombre: 'Supervisor Producción', cargo: 'Supervisor de Turno',          fecha: '2026-01-24', hora: '15:50', loginUsuario: 'supervisor', idUsuario: 2 },
  },
  // BR4 — 100% — Todo firmado (19/19 firmas)
  4: {
    'cie:101:1': { nombre: 'Operario Producción',   cargo: 'Técnico de Producción',       fecha: '2026-02-05', hora: '07:15', loginUsuario: 'operario',   idUsuario: 1 },
    'cie:101:2': { nombre: 'Supervisor Producción', cargo: 'Supervisor de Turno',          fecha: '2026-02-05', hora: '07:40', loginUsuario: 'supervisor', idUsuario: 2 },
    'cie:102:1': { nombre: 'Operario Producción',   cargo: 'Técnico de Producción',       fecha: '2026-02-05', hora: '09:50', loginUsuario: 'operario',   idUsuario: 1 },
    'cie:102:2': { nombre: 'Supervisor Producción', cargo: 'Supervisor de Turno',          fecha: '2026-02-05', hora: '10:15', loginUsuario: 'supervisor', idUsuario: 2 },
    'cie:103:1': { nombre: 'Operario Producción',   cargo: 'Técnico de Producción',       fecha: '2026-02-05', hora: '11:00', loginUsuario: 'operario',   idUsuario: 1 },
    'cie:103:2': { nombre: 'Supervisor Producción', cargo: 'Supervisor de Turno',          fecha: '2026-02-05', hora: '11:20', loginUsuario: 'supervisor', idUsuario: 2 },
    'cie:201:1': { nombre: 'Operario Producción',   cargo: 'Técnico de Producción',       fecha: '2026-02-06', hora: '07:00', loginUsuario: 'operario',   idUsuario: 1 },
    'cie:201:2': { nombre: 'Supervisor Producción', cargo: 'Supervisor de Turno',          fecha: '2026-02-06', hora: '07:25', loginUsuario: 'supervisor', idUsuario: 2 },
    'cie:202:1': { nombre: 'Operario Producción',   cargo: 'Técnico de Producción',       fecha: '2026-02-06', hora: '20:10', loginUsuario: 'operario',   idUsuario: 1 },
    'cie:202:2': { nombre: 'Supervisor Producción', cargo: 'Supervisor de Turno',          fecha: '2026-02-06', hora: '20:35', loginUsuario: 'supervisor', idUsuario: 2 },
    'cie:203:1': { nombre: 'Operario Producción',   cargo: 'Técnico de Producción',       fecha: '2026-02-06', hora: '21:05', loginUsuario: 'operario',   idUsuario: 1 },
    'cie:203:2': { nombre: 'Supervisor Producción', cargo: 'Supervisor de Turno',          fecha: '2026-02-06', hora: '21:30', loginUsuario: 'supervisor', idUsuario: 2 },
    'cie:301:1': { nombre: 'Operario Producción',   cargo: 'Técnico de Producción',       fecha: '2026-02-07', hora: '08:15', loginUsuario: 'operario',   idUsuario: 1 },
    'cie:301:2': { nombre: 'Supervisor Producción', cargo: 'Supervisor de Turno',          fecha: '2026-02-07', hora: '08:48', loginUsuario: 'supervisor', idUsuario: 2 },
    'cie:302:1': { nombre: 'Operario Producción',   cargo: 'Técnico de Producción',       fecha: '2026-02-07', hora: '15:00', loginUsuario: 'operario',   idUsuario: 1 },
    'cie:302:2': { nombre: 'Supervisor Producción', cargo: 'Supervisor de Turno',          fecha: '2026-02-07', hora: '15:25', loginUsuario: 'supervisor', idUsuario: 2 },
    'cie:303:2': { nombre: 'Supervisor Producción', cargo: 'Jefe de Producción',           fecha: '2026-02-09', hora: '09:05', loginUsuario: 'supervisor', idUsuario: 2 },
    'cie:303:3': { nombre: 'Analista Calidad',      cargo: 'Analista de Laboratorio CQ',  fecha: '2026-02-09', hora: '10:18', loginUsuario: 'calidad',    idUsuario: 3 },
    'cie:303:4': { nombre: 'Director Calidad',      cargo: 'Director Técnico de Planta',  fecha: '2026-02-09', hora: '11:42', loginUsuario: 'director',   idUsuario: 4 },
  },
  // BR5 — 22% — Solo ET1-F1 y ET1-F2 (4/19 firmas, cancelado por desviación crítica)
  5: {
    'cie:101:1': { nombre: 'Operario Producción',   cargo: 'Técnico de Producción',       fecha: '2026-03-12', hora: '08:00', loginUsuario: 'operario',   idUsuario: 1 },
    'cie:101:2': { nombre: 'Supervisor Producción', cargo: 'Supervisor de Turno',          fecha: '2026-03-12', hora: '08:30', loginUsuario: 'supervisor', idUsuario: 2 },
    'cie:102:1': { nombre: 'Operario Producción',   cargo: 'Técnico de Producción',       fecha: '2026-03-12', hora: '10:15', loginUsuario: 'operario',   idUsuario: 1 },
    'cie:102:2': { nombre: 'Supervisor Producción', cargo: 'Supervisor de Turno',          fecha: '2026-03-12', hora: '10:40', loginUsuario: 'supervisor', idUsuario: 2 },
  },
  // BR6 — 0% — Sin firmas (objeto vacío implícito, no incluido)
}

// ── Desviaciones ──────────────────────────────────────────────────────────────
export interface Desviacion {
  id: number
  idBatchRecord: number
  idDetalle: number
  detalleCode: string
  campo: string
  labelCampo: string
  valorIngresado: string
  limiteInfo: string
  descripcion: string
  estado: 'abierta' | 'cerrada'
  usuario: string
  cargo: string
  fechaHora: string
  observacionCierre?: string
  fechaCierre?: string
  usuarioCierre?: string
}

export const mockDesviaciones: Desviacion[] = [
  {
    id: 1,
    idBatchRecord: 3,
    idDetalle: 201,
    detalleCode: 'ET2-F1',
    campo: 'numVelocidadObj',
    labelCampo: 'Velocidad Objetivo (cáps/min)',
    valorIngresado: '3250',
    limiteInfo: 'min: 100 – max: 3000',
    descripcion: 'Velocidad programada en encapsuladora superó el límite máximo durante configuración del turno. Se corrigió a 2900 cáps/min dentro del rango aceptado.',
    estado: 'abierta',
    usuario: 'Carlos Mendoza',
    cargo: 'Operario de Producción',
    fechaHora: '2026-01-16T09:45:00.000Z',
  },
  {
    id: 2,
    idBatchRecord: 5,
    idDetalle: 101,
    detalleCode: 'ET1-F1',
    campo: 'numTemperatura',
    labelCampo: 'Temperatura (°C)',
    valorIngresado: '32',
    limiteInfo: 'min: 15 – max: 30',
    descripcion: 'Temperatura de sala superó el límite permitido (32 °C vs. máximo 30 °C). Lote cancelado preventivamente por el Supervisor de Calidad hasta restablecer condiciones ambientales.',
    estado: 'cerrada',
    usuario: 'Ana Torres',
    cargo: 'Operario de Producción',
    fechaHora: '2026-03-12T08:45:00.000Z',
    observacionCierre: 'Lote cancelado. Condiciones ambientales restablecidas. Área habilitada para nuevo batch.',
    fechaCierre: '2026-03-12T10:30:00.000Z',
    usuarioCierre: 'Supervisor de Producción',
  },
]

// Keep GRUPOS re-export so consumers don't need to import from @/types directly
export { GRUPOS }

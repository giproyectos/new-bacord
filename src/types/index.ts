export interface Resultado<T = unknown> {
  estado: boolean; mensaje: string; datos?: T
}
export interface AuthUser {
  idUsuario: number; nombres: string; apellidos: string; login: string
  email: string; idCentro: number | null; esAdministrador: boolean
  roles: string[]; modulos: string[]; moduloEdicion: string[]; token?: string
  grupos?: string; idGrupos?: string
}
export interface Usuario {
  idUsuario: number; numeroIdentificacion: string; nombres: string; apellidos: string
  login: string; email: string; activo: number; idCentro: number
  esAdministrador: number; bloqueado: number; intentosFallidos: number
  idRol: number | null; rolNombre: string
  fechaCaducidad: string | null; activacionPendiente: boolean
  pinConfigurado: boolean; pinBloqueado: boolean
  grupos: string; idGrupos: string; fechaCreacion: string
}
export interface Rol {
  id: number; nombre: string; descripcion: string; modulos: string[]; modulosEdicion: string[]; activo: boolean; creadoEn: string
}
export interface RecetaMaestra {
  idRecetaMaestra: number; codigo: string; descripcion: string; version: string
  idCentro: number; centro: string; idEstado: number; estado: string
  procesos: string; materiales: string; idMateriales: string; motivo: string
  usuarioCreacion: string; fechaCreacion: string; usuarioModificacion: string; fechaModificacion: string
}
export interface OrdenProceso {
  idOrdenProceso: number; idRecetaMaestra: number; numeroOrdenProceso: string
  codigoMaterial: string; descripcionMaterial: string; idCentro: number; centro: string
  loteLogistico: string; cantidadOrden: number; unidadMedida: string; loteInspeccion: string
  fechaFabricacion: string; fechaCaducidad: string; registroSanitario: string
  formaFarmaceutica: string; idEstado: number
}
export interface FormulaControl {
  idFormulaControl: number; idRecetaMaestra: number; idOrdenProceso: number
  motivoEstado: string; idEstado: number; idCentro: number
  idUsuarioCreacion: number; fechaCreacion: string
}
export interface BatchRecord {
  idBatchRecord: number; idFormulaControl: number; idRecetaMaestra: number
  idOrdenProceso: number; motivoEstado: string; idEstado: number; idCentro: number
  idUsuarioCreacion: number; fechaCreacion: string; idUsuarioModificacion: number
  fechaModificacion: string; porcentajeAvance?: number
}
export interface Firma {
  idFirma: number; codigo: string; descripcion: string; texto: string; activo: number; idGrupo: number
}
export interface EstrategiaFirmaItem {
  idFirma: number; codigo: string; texto: string; grupo: string; orden: number; activo: boolean
}
export interface FirmaSeccion {
  id: number; orden: number; descripcion: string; idFirma: number
}
export interface EstrategiaFirma {
  id: number; codigo: string; descripcion: string
  usuarioCreacion: string; fechaCreacion: string; activo: number
  firmas: EstrategiaFirmaItem[]
  gruposDerogacion?: string[]
}
export const GRUPOS: Record<number, string> = {
  1: 'Administradores', 2: 'Producción', 3: 'Calidad', 4: 'Supervisión',
}
export interface GrupoResponsable {
  id: number; nombre: string; descripcion: string; colorKey: string
}
export interface DatosFirma {
  idBatchRecord: number; idDetalleFirma: number; codigo: string; cierraProceso: number; cierraBatch: number
}
export interface ComponenteOrden {
  idComponente: number
  idOrdenProceso: number
  codigoMaterialComponente: string
  descripcionMaterialComponente: string
  cantidad: number
  unidadMedida: string
  loteComponente: string
  codigoListaMateriales: string
}
export interface CargueRegistro {
  id: number
  archivo: string
  fechaCargue: string
  usuario: string
  totalOrdenes: number
  totalComponentes: number
  errores: number
  estado: 'Exitoso' | 'Con errores' | 'Fallido'
}
export interface PreLlenadoBR {
  idBatchRecord: number
  // OP header fields — all keys must match OP_MAPPING_OPTIONS values
  numeroOrdenProceso: string
  codigoMaterial: string
  descripcionMaterial: string
  loteLogistico: string
  loteInspeccion: string
  fechaFabricacion: string
  fechaCaducidad: string
  registroSanitario: string
  formaFarmaceutica: string
  cantidadOrden: number
  unidadMedida: string
  centro: string
  componentes: ComponenteOrden[]
}
export interface BusquedaBatchRecord { idEstado?: number; idCentro?: number }
export interface BusquedaRecetaMaestra { codigo?: string; descripcion?: string; idEstado?: number }
export interface BusquedaOrdenProceso { numeroOrden?: string; codigoMaterial?: string; idEstado?: number }

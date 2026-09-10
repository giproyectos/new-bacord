export type AuditAccion =
  | 'CREAR' | 'MODIFICAR' | 'CANCELAR'
  | 'FIRMAR_SECCION' | 'FIRMAR_CIERRE' | 'DEROGAR_FIRMA' | 'LIBERAR_LOTE'
  | 'REGISTRAR_DESVIACION' | 'CERRAR_DESVIACION'
  | 'LOGIN' | 'LOGIN_FALLIDO' | 'LOGOUT'

export type AuditEntidad =
  | 'BatchRecord' | 'DetalleValores' | 'FirmaSeccion' | 'FirmaCierre' | 'Sesion'
  | 'Centro' | 'Material' | 'Proceso' | 'Firma' | 'EstrategiaFirma' | 'Detalle'
  | 'GrupoResponsable' | 'Parametro' | 'RecetaMaestra' | 'OrdenProceso' | 'FormulaControl'
  | 'Usuario' | 'Rol' | 'Desviacion'

export interface AuditCambio {
  campo: string
  etiqueta: string
  valorAnterior: string
  valorNuevo: string
}

export interface AuditEntry {
  id: string
  timestamp: string
  idUsuario: number
  nombreUsuario: string
  loginUsuario: string
  cargo: string
  entidad: AuditEntidad
  idEntidad: string | number
  descripcionEntidad: string
  accion: AuditAccion
  modulo: string
  cambios?: AuditCambio[]
  motivo?: string
}

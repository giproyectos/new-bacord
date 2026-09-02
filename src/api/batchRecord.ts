import { http } from './http'
import { authApi } from './auth'
import type { BatchRecord, BusquedaBatchRecord, PreLlenadoBR, Resultado } from '@/types'

export interface BatchRecordDetalleData {
  id: number
  idBatchRecord: number
  idDetalle: number
  jsonData: string
  actualizadoEn: string
}

export interface BatchRecordFirmaRegistrada {
  id: number
  idBatchRecord: number
  idDetalle: number
  bloqueKey: string
  idFirma: number
  idUsuario: number
  firmadoEn: string
  usuario: { nombres: string; apellidos: string; login: string }
  firma: { idFirma: number; codigo: string; descripcion: string; texto: string; idGrupo: number; grupo: { nombre: string } }
}

export interface BatchRecordLiberacionInfo {
  idBatchRecord: number
  idUsuario: number
  observacion: string | null
  liberadoEn: string
  usuario: { nombres: string; apellidos: string; login: string }
}

export interface BatchRecordProcesoCierre {
  id: number
  idBatchRecord: number
  idProceso: number
  idUsuario: number
  cerradoEn: string
}

export interface EstructuraFirmaItem {
  idFirma: number
  texto: string
  orden: number
  activo: boolean
  firma: { codigo: string; descripcion: string; grupo: { nombre: string } }
}
export interface EstructuraDetalle {
  id: number
  codigo: string
  descripcion: string
  estado: 'Activo' | 'En creación' | 'Obsoleto'
  idEstrategiaFirma: number | null
  jsonSchema: string
  jsonOptions?: string | null
  estrategiaFirma: { id: number; gruposDerogacion: string | null; firmas: EstructuraFirmaItem[] } | null
}
export interface EstructuraProceso {
  id: number
  idProceso: number
  orden: number
  proceso: { id: number; codigo: string; descripcion: string }
  detalles: { id: number; idDetalle: number; orden: number; detalle: EstructuraDetalle }[]
}

export const batchRecordApi = {
  buscar: async (f?: BusquedaBatchRecord): Promise<BatchRecord[]> =>
    (await http.get<BatchRecord[]>('/batch-records', { params: f })).data,

  find: async (id: number): Promise<BatchRecord> => (await http.get<BatchRecord>(`/batch-records/${id}`)).data,

  getPreLlenado: async (idBatchRecord: number): Promise<PreLlenadoBR | null> => {
    try {
      return (await http.get<PreLlenadoBR>(`/batch-records/${idBatchRecord}/prellenado`)).data
    } catch {
      return null
    }
  },

  getEstructura: async (idBatchRecord: number): Promise<EstructuraProceso[]> =>
    (await http.get<EstructuraProceso[]>(`/batch-records/${idBatchRecord}/estructura`)).data,

  getDetalles: async (idBatchRecord: number): Promise<BatchRecordDetalleData[]> =>
    (await http.get<BatchRecordDetalleData[]>(`/batch-records/${idBatchRecord}/detalles`)).data,

  guardarDetalle: async (idBatchRecord: number, idDetalle: number, jsonData: string): Promise<Resultado<BatchRecordDetalleData>> =>
    (await http.put<Resultado<BatchRecordDetalleData>>(`/batch-records/${idBatchRecord}/detalles/${idDetalle}`, { jsonData })).data,

  getProcesosCerrados: async (idBatchRecord: number): Promise<BatchRecordProcesoCierre[]> =>
    (await http.get<BatchRecordProcesoCierre[]>(`/batch-records/${idBatchRecord}/procesos-cerrados`)).data,

  cerrarProceso: async (idBatchRecord: number, idProceso: number): Promise<Resultado<BatchRecordProcesoCierre>> =>
    (await http.post<Resultado<BatchRecordProcesoCierre>>(`/batch-records/${idBatchRecord}/procesos/${idProceso}/cerrar`)).data,

  getFirmas: async (idBatchRecord: number): Promise<BatchRecordFirmaRegistrada[]> =>
    (await http.get<BatchRecordFirmaRegistrada[]>(`/batch-records/${idBatchRecord}/firmas`)).data,

  firmar: async (idBatchRecord: number, idDetalle: number, idFirma: number, login: string, clave: string, bloqueKey = '') =>
    (await http.post<Resultado<BatchRecordFirmaRegistrada>>(`/batch-records/${idBatchRecord}/firmas`, { idDetalle, idFirma, login, clave, bloqueKey })).data,

  derogarFirma: async (idBatchRecord: number, idFirmaRegistro: number, motivo: string): Promise<Resultado> =>
    (await http.post<Resultado>(`/batch-records/${idBatchRecord}/firmas/${idFirmaRegistro}/derogar`, { motivo })).data,

  getLiberacion: async (idBatchRecord: number): Promise<BatchRecordLiberacionInfo | null> =>
    (await http.get<BatchRecordLiberacionInfo | null>(`/batch-records/${idBatchRecord}/liberacion`)).data,

  liberar: async (idBatchRecord: number, login: string, clave: string, observacion?: string): Promise<Resultado<BatchRecordLiberacionInfo>> =>
    (await http.post<Resultado<BatchRecordLiberacionInfo>>(`/batch-records/${idBatchRecord}/liberar`, { login, clave, observacion })).data,

  cancelar: async (idBatchRecord: number, motivo: string): Promise<Resultado> =>
    (await http.post<Resultado>(`/batch-records/${idBatchRecord}/cancelar`, { motivo })).data,

  // Compatibilidad: el flujo de firma en pantalla valida la clave del firmante antes de registrarla.
  validarFirma: (login: string, codigo: string) => authApi.validarFirma(login, codigo),
}

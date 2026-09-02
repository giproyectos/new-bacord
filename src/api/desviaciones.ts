import { http } from './http'
import type { Resultado } from '@/types'

export interface Desviacion {
  id: number
  idBatchRecord: number
  idDetalle: number
  campo: string
  labelCampo: string
  valorIngresado: string
  limiteInfo: string
  descripcion: string
  estado: 'abierta' | 'cerrada'
  idUsuarioReporta: number
  fechaHora: string
  observacionCierre?: string | null
  fechaCierre?: string | null
  idUsuarioCierre?: number | null
  usuarioReporta: { nombres: string; apellidos: string; login: string }
  usuarioCierra?: { nombres: string; apellidos: string; login: string } | null
}

export const desviacionesApi = {
  listar: async (idBatchRecord?: number): Promise<Desviacion[]> =>
    (await http.get<Desviacion[]>('/desviaciones', { params: idBatchRecord ? { idBatchRecord } : undefined })).data,
  crear: async (data: {
    idBatchRecord: number; idDetalle: number; campo: string; labelCampo: string
    valorIngresado: string; limiteInfo: string; descripcion: string
  }): Promise<Resultado<Desviacion>> => (await http.post<Resultado<Desviacion>>('/desviaciones', data)).data,
  cerrar: async (id: number, observacionCierre: string): Promise<Resultado<Desviacion>> =>
    (await http.post<Resultado<Desviacion>>(`/desviaciones/${id}/cerrar`, { observacionCierre })).data,
}

import { http } from './http'
import type { Resultado } from '@/types'

export interface FirmaApi {
  idFirma: number
  codigo: string
  descripcion: string
  texto: string
  activo: boolean
  idGrupo: number
  grupo: { id: number; nombre: string; colorKey: string }
}

export const firmasApi = {
  listar: async (): Promise<FirmaApi[]> => (await http.get<FirmaApi[]>('/firmas')).data,
  crear: async (data: { codigo: string; descripcion: string; texto: string; idGrupo: number }): Promise<Resultado<FirmaApi>> =>
    (await http.post<Resultado<FirmaApi>>('/firmas', data)).data,
  actualizar: async (id: number, data: Partial<{ codigo: string; descripcion: string; texto: string; idGrupo: number; activo: boolean }>): Promise<Resultado<FirmaApi>> =>
    (await http.put<Resultado<FirmaApi>>(`/firmas/${id}`, data)).data,
  eliminar: async (id: number): Promise<Resultado> => (await http.delete<Resultado>(`/firmas/${id}`)).data,
}

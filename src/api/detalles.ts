import { http } from './http'
import type { Resultado } from '@/types'

export interface DetalleApi {
  id: number
  codigo: string
  descripcion: string
  estado: 'Activo' | 'En creación' | 'Obsoleto'
  idEstrategiaFirma?: number | null
  jsonSchema: string
  jsonData?: string | null
  jsonOptions?: string | null
}

export const detallesApi = {
  listar: async (): Promise<DetalleApi[]> => (await http.get<DetalleApi[]>('/detalles')).data,
  find: async (id: number): Promise<DetalleApi> => (await http.get<DetalleApi>(`/detalles/${id}`)).data,
  crear: async (data: Omit<DetalleApi, 'id'>): Promise<Resultado<DetalleApi>> =>
    (await http.post<Resultado<DetalleApi>>('/detalles', data)).data,
  actualizar: async (id: number, data: Partial<Omit<DetalleApi, 'id'>>): Promise<Resultado<DetalleApi>> =>
    (await http.put<Resultado<DetalleApi>>(`/detalles/${id}`, data)).data,
  eliminar: async (id: number): Promise<Resultado> => (await http.delete<Resultado>(`/detalles/${id}`)).data,
}

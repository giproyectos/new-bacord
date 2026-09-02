import { http } from './http'
import type { Resultado } from '@/types'

export interface ProcesoItem {
  id: number
  idMaterial: number
  codigo: string
  descripcion: string
  orden: number
  activo: boolean
}

export const procesosApi = {
  listar: async (idMaterial?: number): Promise<ProcesoItem[]> =>
    (await http.get<ProcesoItem[]>('/procesos', { params: idMaterial ? { idMaterial } : undefined })).data,
  crear: async (data: Omit<ProcesoItem, 'id' | 'activo'>): Promise<Resultado<ProcesoItem>> =>
    (await http.post<Resultado<ProcesoItem>>('/procesos', data)).data,
  actualizar: async (id: number, data: Partial<Omit<ProcesoItem, 'id'>>): Promise<Resultado<ProcesoItem>> =>
    (await http.put<Resultado<ProcesoItem>>(`/procesos/${id}`, data)).data,
  eliminar: async (id: number): Promise<Resultado> => (await http.delete<Resultado>(`/procesos/${id}`)).data,
}

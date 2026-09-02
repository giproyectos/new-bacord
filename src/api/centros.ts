import { http } from './http'
import type { Resultado } from '@/types'

export interface Centro {
  id: number
  codigo: string
  descripcion: string
  direccion?: string | null
  activo: boolean
}

export const centrosApi = {
  listar: async (): Promise<Centro[]> => (await http.get<Centro[]>('/centros')).data,
  crear: async (data: Omit<Centro, 'id' | 'activo'>): Promise<Resultado<Centro>> =>
    (await http.post<Resultado<Centro>>('/centros', data)).data,
  actualizar: async (id: number, data: Partial<Omit<Centro, 'id'>>): Promise<Resultado<Centro>> =>
    (await http.put<Resultado<Centro>>(`/centros/${id}`, data)).data,
  eliminar: async (id: number): Promise<Resultado> => (await http.delete<Resultado>(`/centros/${id}`)).data,
}

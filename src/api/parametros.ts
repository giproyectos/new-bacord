import { http } from './http'
import type { Resultado } from '@/types'

export interface Parametro {
  id: number
  nombre: string
  valor: string
  descripcion?: string | null
}

export const parametrosApi = {
  listar: async (): Promise<Parametro[]> => (await http.get<Parametro[]>('/parametros')).data,
  crear: async (data: Omit<Parametro, 'id'>): Promise<Resultado<Parametro>> =>
    (await http.post<Resultado<Parametro>>('/parametros', data)).data,
  actualizar: async (id: number, data: Partial<Omit<Parametro, 'id'>>): Promise<Resultado<Parametro>> =>
    (await http.put<Resultado<Parametro>>(`/parametros/${id}`, data)).data,
  eliminar: async (id: number): Promise<Resultado> => (await http.delete<Resultado>(`/parametros/${id}`)).data,
}

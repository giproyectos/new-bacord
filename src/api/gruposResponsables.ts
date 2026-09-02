import { http } from './http'
import type { GrupoResponsable, Resultado } from '@/types'

export const gruposResponsablesApi = {
  listar: async (): Promise<GrupoResponsable[]> => (await http.get<GrupoResponsable[]>('/grupos-responsables')).data,
  crear: async (data: Omit<GrupoResponsable, 'id'>): Promise<Resultado<GrupoResponsable>> =>
    (await http.post<Resultado<GrupoResponsable>>('/grupos-responsables', data)).data,
  actualizar: async (id: number, data: Partial<Omit<GrupoResponsable, 'id'>>): Promise<Resultado<GrupoResponsable>> =>
    (await http.put<Resultado<GrupoResponsable>>(`/grupos-responsables/${id}`, data)).data,
  eliminar: async (id: number): Promise<Resultado> => (await http.delete<Resultado>(`/grupos-responsables/${id}`)).data,
}

import { http } from './http'
import type { GrupoResponsable, Resultado } from '@/types'

type GrupoResponsableInput = Pick<GrupoResponsable, 'nombre' | 'descripcion' | 'colorKey'>

export const gruposResponsablesApi = {
  listar: async (): Promise<GrupoResponsable[]> => (await http.get<GrupoResponsable[]>('/grupos-responsables')).data,
  crear: async (data: GrupoResponsableInput): Promise<Resultado<GrupoResponsable>> =>
    (await http.post<Resultado<GrupoResponsable>>('/grupos-responsables', data)).data,
  actualizar: async (id: number, data: Partial<GrupoResponsableInput>): Promise<Resultado<GrupoResponsable>> =>
    (await http.put<Resultado<GrupoResponsable>>(`/grupos-responsables/${id}`, data)).data,
  eliminar: async (id: number): Promise<Resultado> => (await http.delete<Resultado>(`/grupos-responsables/${id}`)).data,
}

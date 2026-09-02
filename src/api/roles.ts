import { http } from './http'
import type { Rol, Resultado } from '@/types'

export interface RolInput {
  nombre: string
  descripcion?: string
  modulos: string[]
  modulosEdicion?: string[]
  activo?: boolean
}

export const rolesApi = {
  listar: async (): Promise<Rol[]> => (await http.get<Rol[]>('/roles')).data,
  crear: async (data: RolInput): Promise<Resultado<Rol>> => (await http.post<Resultado<Rol>>('/roles', data)).data,
  actualizar: async (id: number, data: Partial<RolInput>): Promise<Resultado<Rol>> =>
    (await http.put<Resultado<Rol>>(`/roles/${id}`, data)).data,
  eliminar: async (id: number): Promise<Resultado> => (await http.delete<Resultado>(`/roles/${id}`)).data,
}

import { http } from './http'
import type { Usuario, Resultado } from '@/types'

export interface UsuarioInput {
  numeroIdentificacion: string
  nombres: string
  apellidos: string
  login: string
  email: string
  idCentro: number
  esAdministrador?: boolean
  activo?: boolean
  idGrupos?: number[]
  idRol?: number | null
  fechaCaducidad?: string | null
  loginLocalDeshabilitado?: boolean
}

export const usuariosApi = {
  listar: async (): Promise<Usuario[]> => (await http.get<Usuario[]>('/usuarios')).data,
  crear: async (data: UsuarioInput): Promise<Resultado<Usuario>> =>
    (await http.post<Resultado<Usuario>>('/usuarios', data)).data,
  actualizar: async (id: number, data: Partial<UsuarioInput>): Promise<Resultado<Usuario>> =>
    (await http.put<Resultado<Usuario>>(`/usuarios/${id}`, data)).data,
  desbloquear: async (id: number): Promise<Resultado> => (await http.post<Resultado>(`/usuarios/${id}/desbloquear`)).data,
  eliminar: async (id: number): Promise<Resultado> => (await http.delete<Resultado>(`/usuarios/${id}`)).data,
  reenviarInvitacion: async (id: number): Promise<Resultado> => (await http.post<Resultado>(`/usuarios/${id}/reenviar-invitacion`)).data,
  resetPin: async (id: number): Promise<Resultado> => (await http.post<Resultado>(`/usuarios/${id}/reset-pin`)).data,
}

import { http } from './http'
import type { AuthUser, Resultado } from '@/types'

export const authApi = {
  login: async (login: string, clave: string): Promise<AuthUser> => {
    const { data } = await http.post<AuthUser>('/auth/login', { login, clave })
    return data
  },
  validarFirma: async (login: string, pin: string) => {
    const { data } = await http.post<{ estado: boolean; mensaje: string }>('/auth/validar-firma', { login, pin })
    return data
  },
  olvideClave: async (email: string): Promise<Resultado> =>
    (await http.post<Resultado>('/auth/olvide-clave', { email })).data,
  validarTokenActivacion: async (token: string): Promise<{ valido: boolean; nombre?: string }> =>
    (await http.get<{ valido: boolean; nombre?: string }>('/auth/activar-cuenta', { params: { token } })).data,
  activarCuenta: async (token: string, password: string): Promise<Resultado> =>
    (await http.post<Resultado>('/auth/activar-cuenta', { token, password })).data,
  configurarPin: async (pinNuevo: string, pinActual?: string): Promise<Resultado> =>
    (await http.post<Resultado>('/auth/pin', { pinNuevo, pinActual })).data,
}

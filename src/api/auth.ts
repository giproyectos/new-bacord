import { http } from './http'
import type { AuthUser, Resultado } from '@/types'

/** URL base de la API sin el sufijo `/api` — para navegaciones de página completa (no XHR). */
const apiOrigin = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api').replace(/\/api\/?$/, '')

export const authApi = {
  login: async (login: string, clave: string): Promise<AuthUser> => {
    const { data } = await http.post<AuthUser>('/auth/login', { login, clave })
    return data
  },
  config: async (): Promise<{ oidcEnabled: boolean; oidcLabel: string }> =>
    (await http.get<{ oidcEnabled: boolean; oidcLabel: string }>('/auth/config')).data,
  /** No es una llamada XHR — el navegador debe navegar de verdad a esta URL para que el
   * proveedor OIDC pueda hacer sus propias redirecciones. */
  oidcLoginUrl: (): string => `${apiOrigin}/api/auth/oidc/login`,
  validarFirma: async (login: string, clave: string) => {
    const { data } = await http.post<{ estado: boolean; mensaje: string }>('/auth/validar-firma', { login, clave })
    return data
  },
  olvideClave: async (email: string): Promise<Resultado> =>
    (await http.post<Resultado>('/auth/olvide-clave', { email })).data,
  validarTokenActivacion: async (token: string): Promise<{ valido: boolean; nombre?: string }> =>
    (await http.get<{ valido: boolean; nombre?: string }>('/auth/activar-cuenta', { params: { token } })).data,
  activarCuenta: async (token: string, password: string): Promise<Resultado> =>
    (await http.post<Resultado>('/auth/activar-cuenta', { token, password })).data,
}

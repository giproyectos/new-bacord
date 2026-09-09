import { http } from './http'
import type { AuthUser, Resultado } from '@/types'

/** URL base de la API sin el sufijo `/api` — para navegaciones de página completa (no XHR). */
const apiOrigin = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api').replace(/\/api\/?$/, '')

export interface PoliticaPassword {
  minCaracteres: number
  requiereMayuscula: boolean
  requiereMinuscula: boolean
  requiereEspecial: boolean
}

export interface AuthConfig {
  oidcEnabled: boolean
  oidcLabel: string
  passwordPolitica: PoliticaPassword
}

export const authApi = {
  login: async (login: string, clave: string): Promise<AuthUser> => {
    const { data } = await http.post<AuthUser>('/auth/login', { login, clave })
    return data
  },
  config: async (): Promise<AuthConfig> =>
    (await http.get<AuthConfig>('/auth/config')).data,
  sesionConfig: async (): Promise<{ inactividadMinutos: number }> =>
    (await http.get<{ inactividadMinutos: number }>('/auth/sesion-config')).data,
  /** No es una llamada XHR — el navegador debe navegar de verdad a esta URL para que el
   * proveedor OIDC pueda hacer sus propias redirecciones. */
  oidcLoginUrl: (): string => `${apiOrigin}/api/auth/oidc/login`,
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

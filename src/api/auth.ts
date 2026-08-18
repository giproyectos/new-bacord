import { delay, mockUsuarios } from './mock'
import type { AuthUser } from '@/types'
export const authApi = {
  login: async (login: string, clave: string): Promise<AuthUser> => {
    await delay(600)
    const user = mockUsuarios.find((u) => u.login === login)
    if (!user || clave !== 'bacord2025') throw new Error('Usuario o contraseña incorrectos')
    return {
      idUsuario: user.idUsuario, nombres: user.nombres, apellidos: user.apellidos,
      login: user.login, email: user.email, idCentro: user.idCentro,
      esAdministrador: user.esAdministrador === 1,
      roles: user.esAdministrador === 1 ? ['Admin', 'BatchRecord', 'RecetaMaestra'] : ['BatchRecord'],
      token: `mock-token-${user.idUsuario}`,
      grupos: user.grupos,
      idGrupos: user.idGrupos,
    }
  },
}

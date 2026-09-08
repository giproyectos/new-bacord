import { signToken } from '../../src/middleware/auth.js'
import { MODULO_CLAVES } from '../../src/constants/modulos.js'

/** Token válido para el usuario administrador de un escenario — administrador se salta los
 * chequeos de módulo/grupo, así que basta un único usuario para autenticar la request HTTP
 * (el Bearer) y para ser el firmante (login+pin en el body) en la mayoría de los casos. */
export function tokenPara(usuario: { idUsuario: number; login: string; esAdministrador: boolean }) {
  return signToken({
    idUsuario: usuario.idUsuario,
    login: usuario.login,
    esAdministrador: usuario.esAdministrador,
    modulos: usuario.esAdministrador ? MODULO_CLAVES.join(',') : '',
    modulosEdicion: usuario.esAdministrador ? MODULO_CLAVES.join(',') : '',
  })
}

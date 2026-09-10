import type { NextFunction, Request, Response } from 'express'
import jwt, { type SignOptions } from 'jsonwebtoken'
import { prisma } from '../db/prisma.js'
import { modulosDe, modulosEdicionDe } from '../services/permisos.js'
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js'

export interface AuthTokenPayload {
  idUsuario: number
  login: string
  esAdministrador: boolean
  /** CSV de claves de módulo con acceso de lectura, según el Rol del usuario (vacío si no tiene rol o el rol está inactivo). Ignorado si esAdministrador. */
  modulos: string
  /** CSV de claves de módulo (subconjunto de `modulos`) con permiso de edición. Ignorado si esAdministrador. */
  modulosEdicion: string
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthTokenPayload
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) throw new Error('JWT_SECRET no está definido en .env')

export function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET as string, { expiresIn: '12h' })
}

/**
 * Firma un valor corto de un solo uso (p. ej. el `state`/PKCE del flujo OIDC) con el mismo
 * secreto de sesión — evita necesitar cookies o un almacén de sesión aparte para ese dato.
 */
export function signState<T extends object>(payload: T, expiresIn: SignOptions['expiresIn']): string {
  return jwt.sign(payload, JWT_SECRET as string, { expiresIn })
}

export function verifyState<T>(token: string): T {
  return jwt.verify(token, JWT_SECRET as string) as T
}

// El token dura hasta 12h, pero sus claims (esAdministrador, modulos, modulosEdicion) son una
// foto del momento del login — sin esta revalidación, desactivar/bloquear una cuenta o
// cambiarle el Rol no tenía ningún efecto hasta que el token expirara por su cuenta. Cada
// solicitud vuelve a consultar el estado real del usuario, igual que ya hacen firmar/liberar/
// cancelar/derogar/cerrar-desviación con quien provee el PIN.
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return next(new UnauthorizedError('Falta el token de autenticación'))

  const token = header.slice('Bearer '.length)
  let payload: AuthTokenPayload
  try {
    payload = jwt.verify(token, JWT_SECRET as string) as AuthTokenPayload
  } catch {
    return next(new UnauthorizedError('Token inválido o expirado'))
  }

  try {
    const usuario = await prisma.usuario.findUnique({
      where: { idUsuario: payload.idUsuario },
      select: {
        login: true, activo: true, bloqueado: true, esAdministrador: true,
        rol: { select: { activo: true, modulos: true, modulosEdicion: true } },
      },
    })
    if (!usuario || !usuario.activo || usuario.bloqueado) {
      return next(new UnauthorizedError('La sesión ya no es válida — la cuenta fue desactivada o bloqueada'))
    }
    req.auth = {
      idUsuario: payload.idUsuario,
      login: usuario.login,
      esAdministrador: usuario.esAdministrador,
      modulos: modulosDe(usuario).join(','),
      modulosEdicion: modulosEdicionDe(usuario).join(','),
    }
    next()
  } catch (err) {
    next(err)
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth?.esAdministrador) return next(new ForbiddenError('Requiere permisos de administrador'))
  next()
}

/** Permite el paso a administradores, o a usuarios cuyo Rol incluya la clave de módulo dada (lectura). */
export function requireModulo(clave: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (req.auth?.esAdministrador) return next()
    const modulos = (req.auth?.modulos ?? '').split(',').map((s) => s.trim())
    if (!modulos.includes(clave)) return next(new ForbiddenError(`No tiene acceso al módulo "${clave}"`))
    next()
  }
}

/** Permite el paso a administradores, o a usuarios cuyo Rol tenga permiso de EDICIÓN sobre ese módulo. */
export function requireModuloEditar(clave: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (req.auth?.esAdministrador) return next()
    const modulosEdicion = (req.auth?.modulosEdicion ?? '').split(',').map((s) => s.trim())
    if (!modulosEdicion.includes(clave)) return next(new ForbiddenError(`No tiene permiso de edición en el módulo "${clave}"`))
    next()
  }
}

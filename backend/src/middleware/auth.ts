import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
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

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return next(new UnauthorizedError('Falta el token de autenticación'))

  const token = header.slice('Bearer '.length)
  try {
    const payload = jwt.verify(token, JWT_SECRET as string) as AuthTokenPayload
    req.auth = payload
    next()
  } catch {
    next(new UnauthorizedError('Token inválido o expirado'))
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

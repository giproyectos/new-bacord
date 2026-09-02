import type { NextFunction, Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { AppError } from '../utils/errors.js'

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ estado: false, mensaje: err.message })
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : String(err.meta?.target ?? '')
      return res.status(409).json({ estado: false, mensaje: `Ya existe un registro con ese valor (${target})` })
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ estado: false, mensaje: 'No encontrado' })
    }
  }

  console.error(err)
  return res.status(500).json({ estado: false, mensaje: 'Error interno del servidor' })
}

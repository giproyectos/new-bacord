import type { NextFunction, Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { AppError } from '../utils/errors.js'

// Nombres legibles para el mensaje de "ya existe" (ver mensajeDuplicado) — no hace falta que
// cubran todos los modelos/campos: lo que no está aquí cae de vuelta a su nombre técnico, que
// sigue siendo mejor que el nombre completo de la restricción (p. ej. "Material_codigo_key").
const MODELOS_LEGIBLES: Record<string, string> = {
  Material: 'Material', Centro: 'Centro', GrupoResponsable: 'Grupo Responsable',
  Firma: 'Firma', EstrategiaFirma: 'Estrategia de Firma', Detalle: 'Formulario',
  Proceso: 'Proceso', RecetaMaestra: 'Receta Maestra', OrdenProceso: 'Orden de Proceso',
  Usuario: 'Usuario', Rol: 'Rol', Parametro: 'Parámetro',
}
const CAMPOS_LEGIBLES: Record<string, string> = {
  codigo: 'código', nombre: 'nombre', descripcion: 'descripción', email: 'correo',
  login: 'usuario', numeroIdentificacion: 'número de identificación',
}

// Prisma/MySQL nombra la restricción de un `@unique` de un solo campo como
// "<Modelo>_<campo>_key" — se intenta volver eso un mensaje legible en vez de mostrar ese
// nombre técnico tal cual, que es justo lo que veía el usuario al duplicar un código
// (p. ej. "Ya existe un registro con ese valor (Material_codigo_key)").
function mensajeDuplicado(target: string): string {
  const m = target.match(/^([A-Za-z]+)_([A-Za-z0-9]+)_key$/)
  if (!m) return `Ya existe un registro con ese valor (${target}).`
  const modelo = MODELOS_LEGIBLES[m[1]] ?? m[1]
  const campo = CAMPOS_LEGIBLES[m[2]] ?? m[2]
  return `Ya existe un registro de ${modelo} con ese ${campo}.`
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ estado: false, mensaje: err.message })
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : String(err.meta?.target ?? '')
      return res.status(409).json({ estado: false, mensaje: mensajeDuplicado(target) })
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ estado: false, mensaje: 'No encontrado' })
    }
  }

  console.error(err)
  return res.status(500).json({ estado: false, mensaje: 'Error interno del servidor' })
}

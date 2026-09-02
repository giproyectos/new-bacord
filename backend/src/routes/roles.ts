import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db/prisma.js'
import { requireAdmin } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { NotFoundError, ValidationError } from '../utils/errors.js'
import { MODULO_CLAVES } from '../constants/modulos.js'
import { logAudit, actorDe, diffObjetos, type AuditCambio } from '../services/audit.js'

export const rolesRouter = Router()

const ETIQUETAS = { nombre: 'Nombre', descripcion: 'Descripción', activo: 'Activo' }

function toDto(rol: { id: number; nombre: string; descripcion: string | null; modulos: string; modulosEdicion: string | null; activo: boolean; creadoEn: Date }) {
  return {
    ...rol,
    modulos: rol.modulos ? rol.modulos.split(',').filter(Boolean) : [],
    modulosEdicion: rol.modulosEdicion ? rol.modulosEdicion.split(',').filter(Boolean) : [],
  }
}

rolesRouter.get(
  '/',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const roles = await prisma.rol.findMany({ orderBy: { nombre: 'asc' } })
    res.json(roles.map(toDto))
  })
)

const claveModulo = z.enum(MODULO_CLAVES as [string, ...string[]])

const rolSchema = z.object({
  nombre: z.string().min(1),
  descripcion: z.string().optional(),
  modulos: z.array(claveModulo),
  // Debe ser subconjunto de `modulos` — editar sin poder ver no tiene sentido.
  modulosEdicion: z.array(claveModulo).optional(),
  activo: z.boolean().optional(),
})

function edicionValida(modulos: string[], modulosEdicion: string[] | undefined): string[] {
  return (modulosEdicion ?? []).filter((m) => modulos.includes(m))
}

rolesRouter.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = rolSchema.safeParse(req.body)
    if (!parsed.success) throw new ValidationError(parsed.error.message)
    const { modulos, modulosEdicion, ...rest } = parsed.data
    const rol = await prisma.$transaction(async (tx) => {
      const creado = await tx.rol.create({
        data: { ...rest, modulos: modulos.join(','), modulosEdicion: edicionValida(modulos, modulosEdicion).join(',') },
      })
      await logAudit(tx, {
        entidad: 'Rol', idEntidad: creado.id, descripcionEntidad: creado.nombre,
        accion: 'CREAR', modulo: 'roles',
        cambios: [{ campo: 'modulos', etiqueta: 'Módulos', valorAnterior: '—', valorNuevo: modulos.join(', ') || '—' }],
        actor: await actorDe(tx, req.auth!.idUsuario),
      })
      return creado
    })
    res.status(201).json({ estado: true, mensaje: 'Rol creado', datos: toDto(rol) })
  })
)

rolesRouter.put(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = rolSchema.partial().safeParse(req.body)
    if (!parsed.success) throw new ValidationError(parsed.error.message)
    const { modulos, modulosEdicion, ...rest } = parsed.data
    const id = Number(req.params.id)
    const anterior = await prisma.rol.findUnique({ where: { id } })
    if (!anterior) throw new NotFoundError('Rol no encontrado')

    const rol = await prisma.$transaction(async (tx) => {
      const modulosFinal = modulos ?? anterior.modulos.split(',').filter(Boolean)
      const modulosEdicionFinal = edicionValida(modulosFinal, modulosEdicion)
      const actualizado = await tx.rol.update({
        where: { id },
        data: {
          ...rest,
          ...(modulos ? { modulos: modulos.join(',') } : {}),
          ...(modulosEdicion !== undefined ? { modulosEdicion: modulosEdicionFinal.join(',') } : {}),
        },
      })

      const cambios: AuditCambio[] = diffObjetos(anterior, rest, ETIQUETAS)
      const antesModulos = anterior.modulos.split(',').filter(Boolean).join(', ') || '—'
      const despuesModulos = modulosFinal.join(', ') || '—'
      if (antesModulos !== despuesModulos) {
        cambios.push({ campo: 'modulos', etiqueta: 'Módulos (ver)', valorAnterior: antesModulos, valorNuevo: despuesModulos })
      }
      const antesEdicion = (anterior.modulosEdicion ?? '').split(',').filter(Boolean).join(', ') || '—'
      const despuesEdicion = modulosEdicionFinal.join(', ') || '—'
      if (antesEdicion !== despuesEdicion) {
        cambios.push({ campo: 'modulosEdicion', etiqueta: 'Módulos (editar)', valorAnterior: antesEdicion, valorNuevo: despuesEdicion })
      }
      if (cambios.length > 0) {
        await logAudit(tx, {
          entidad: 'Rol', idEntidad: id, descripcionEntidad: actualizado.nombre,
          accion: 'MODIFICAR', modulo: 'roles', cambios, actor: await actorDe(tx, req.auth!.idUsuario),
        })
      }
      return actualizado
    })
    res.json({ estado: true, mensaje: 'Rol actualizado', datos: toDto(rol) })
  })
)

rolesRouter.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id)
    const anterior = await prisma.rol.findUnique({ where: { id } })
    if (!anterior) throw new NotFoundError('Rol no encontrado')

    await prisma.$transaction(async (tx) => {
      await tx.rol.update({ where: { id }, data: { activo: false } })
      await logAudit(tx, {
        entidad: 'Rol', idEntidad: id, descripcionEntidad: anterior.nombre,
        accion: 'MODIFICAR', modulo: 'roles',
        cambios: [{ campo: 'activo', etiqueta: 'Activo', valorAnterior: 'true', valorNuevo: 'false' }],
        actor: await actorDe(tx, req.auth!.idUsuario),
      })
    })
    res.json({ estado: true, mensaje: 'Rol desactivado' })
  })
)

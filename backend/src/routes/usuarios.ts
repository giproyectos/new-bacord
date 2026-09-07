import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db/prisma.js'
import { requireAdmin } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { NotFoundError, ValidationError } from '../utils/errors.js'
import { generarYEnviarInvitacion } from '../services/invitacion.js'
import { logAudit, actorDe, diffObjetos } from '../services/audit.js'

export const usuariosRouter = Router()

// Deliberadamente NO incluye passwordHash/tokenActivacion — nunca deben aparecer en el audit trail.
const ETIQUETAS = {
  numeroIdentificacion: 'N° Documento', nombres: 'Nombres', apellidos: 'Apellidos', login: 'Login',
  email: 'Email', idCentro: 'Centro', esAdministrador: 'Administrador', activo: 'Activo',
  idRol: 'Rol', fechaCaducidad: 'Fecha de caducidad',
}

const publicSelect = {
  idUsuario: true, numeroIdentificacion: true, nombres: true, apellidos: true,
  login: true, email: true, activo: true, idCentro: true, esAdministrador: true,
  bloqueado: true, intentosFallidos: true, fechaCreacion: true, fechaCaducidad: true,
  passwordHash: true, pinHash: true, pinBloqueado: true,
  idRol: true, rol: { select: { id: true, nombre: true } },
  grupos: { select: { grupo: { select: { id: true, nombre: true } } } },
} as const

function toDto(u: Awaited<ReturnType<typeof findAll>>[number]) {
  const { passwordHash, pinHash, ...rest } = u
  return {
    ...rest,
    activacionPendiente: passwordHash === null,
    pinConfigurado: pinHash !== null,
    rolNombre: u.rol?.nombre ?? '',
    grupos: u.grupos.map((g) => g.grupo.nombre).join(','),
    idGrupos: u.grupos.map((g) => g.grupo.id).join(','),
  }
}

async function desactivarCaducados() {
  await prisma.usuario.updateMany({
    where: { activo: true, fechaCaducidad: { lt: new Date() } },
    data: { activo: false },
  })
}

function findAll() {
  return prisma.usuario.findMany({ select: publicSelect, orderBy: { nombres: 'asc' } })
}

usuariosRouter.get(
  '/',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    await desactivarCaducados()
    const usuarios = await findAll()
    res.json(usuarios.map(toDto))
  })
)

const usuarioSchema = z.object({
  numeroIdentificacion: z.string().min(1),
  nombres: z.string().min(1),
  apellidos: z.string().min(1),
  login: z.string().min(3),
  email: z.string().email(),
  idCentro: z.number().int(),
  esAdministrador: z.boolean().optional(),
  activo: z.boolean().optional(),
  idGrupos: z.array(z.number().int()).optional(),
  idRol: z.number().int().nullable().optional(),
  fechaCaducidad: z.string().nullable().optional(),
})

usuariosRouter.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = usuarioSchema.safeParse(req.body)
    if (!parsed.success) throw new ValidationError(parsed.error.message)
    const { idGrupos, fechaCaducidad, ...rest } = parsed.data

    const usuario = await prisma.$transaction(async (tx) => {
      const creado = await tx.usuario.create({
        data: {
          ...rest,
          fechaCaducidad: fechaCaducidad ? new Date(fechaCaducidad) : null,
          grupos: idGrupos ? { create: idGrupos.map((idGrupo) => ({ idGrupo })) } : undefined,
        },
        select: publicSelect,
      })
      await logAudit(tx, {
        entidad: 'Usuario', idEntidad: creado.idUsuario, descripcionEntidad: `${creado.login} — ${creado.nombres} ${creado.apellidos}`,
        accion: 'CREAR', modulo: 'usuarios', actor: await actorDe(tx, req.auth!.idUsuario),
      })
      return creado
    })
    // La cuenta queda sin contraseña hasta que el usuario la defina desde el enlace de invitación.
    await generarYEnviarInvitacion(usuario.idUsuario, usuario.email, usuario.nombres, false)
    res.status(201).json({ estado: true, mensaje: 'Usuario creado — se envió un correo de invitación', datos: toDto(usuario) })
  })
)

const usuarioUpdateSchema = usuarioSchema.partial()

usuariosRouter.put(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = usuarioUpdateSchema.safeParse(req.body)
    if (!parsed.success) throw new ValidationError(parsed.error.message)
    const { idGrupos, fechaCaducidad, ...rest } = parsed.data
    const idUsuario = Number(req.params.id)

    const anterior = await prisma.usuario.findUnique({
      where: { idUsuario },
      include: { grupos: { include: { grupo: true } } },
    })
    if (!anterior) throw new NotFoundError('Usuario no encontrado')

    const usuario = await prisma.$transaction(async (tx) => {
      if (idGrupos) {
        await tx.usuarioGrupo.deleteMany({ where: { idUsuario } })
      }
      const actualizado = await tx.usuario.update({
        where: { idUsuario },
        data: {
          ...rest,
          ...(fechaCaducidad !== undefined ? { fechaCaducidad: fechaCaducidad ? new Date(fechaCaducidad) : null } : {}),
          ...(idGrupos ? { grupos: { create: idGrupos.map((idGrupo) => ({ idGrupo })) } } : {}),
        },
        select: publicSelect,
      })

      const payloadDiff: Record<string, unknown> = { ...rest }
      if (fechaCaducidad !== undefined) payloadDiff.fechaCaducidad = fechaCaducidad
      const cambios = diffObjetos(anterior, payloadDiff, ETIQUETAS)
      if (idGrupos) {
        const antesTxt = anterior.grupos.map((g) => g.grupo.nombre).join(', ') || '—'
        const despuesTxt = actualizado.grupos.map((g) => g.grupo.nombre).join(', ') || '—'
        if (antesTxt !== despuesTxt) cambios.push({ campo: 'grupos', etiqueta: 'Grupos responsables', valorAnterior: antesTxt, valorNuevo: despuesTxt })
      }
      if (cambios.length > 0) {
        await logAudit(tx, {
          entidad: 'Usuario', idEntidad: idUsuario, descripcionEntidad: `${actualizado.login} — ${actualizado.nombres} ${actualizado.apellidos}`,
          accion: 'MODIFICAR', modulo: 'usuarios', cambios, actor: await actorDe(tx, req.auth!.idUsuario),
        })
      }
      return actualizado
    })
    res.json({ estado: true, mensaje: 'Usuario actualizado', datos: toDto(usuario) })
  })
)

usuariosRouter.post(
  '/:id/reenviar-invitacion',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const usuario = await prisma.usuario.findUnique({ where: { idUsuario: Number(req.params.id) } })
    if (!usuario) throw new NotFoundError('Usuario no encontrado')
    const esReenvio = usuario.passwordHash !== null
    await generarYEnviarInvitacion(usuario.idUsuario, usuario.email, usuario.nombres, esReenvio)
    await logAudit(prisma, {
      entidad: 'Usuario', idEntidad: usuario.idUsuario, descripcionEntidad: `${usuario.login} — ${usuario.nombres} ${usuario.apellidos}`,
      accion: 'MODIFICAR', modulo: 'usuarios',
      motivo: esReenvio ? 'Enlace de restablecimiento de contraseña reenviado' : 'Invitación de activación reenviada',
      actor: await actorDe(prisma, req.auth!.idUsuario),
    })
    res.json({
      estado: true,
      mensaje: esReenvio ? 'Enlace de restablecimiento enviado' : 'Invitación reenviada',
    })
  })
)

usuariosRouter.post(
  '/:id/desbloquear',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const idUsuario = Number(req.params.id)
    const usuario = await prisma.usuario.findUnique({ where: { idUsuario } })
    if (!usuario) throw new NotFoundError('Usuario no encontrado')

    await prisma.$transaction(async (tx) => {
      await tx.usuario.update({ where: { idUsuario }, data: { bloqueado: false, intentosFallidos: 0 } })
      await logAudit(tx, {
        entidad: 'Usuario', idEntidad: idUsuario, descripcionEntidad: `${usuario.login} — ${usuario.nombres} ${usuario.apellidos}`,
        accion: 'MODIFICAR', modulo: 'usuarios',
        cambios: [{ campo: 'bloqueado', etiqueta: 'Bloqueado', valorAnterior: 'true', valorNuevo: 'false' }],
        actor: await actorDe(tx, req.auth!.idUsuario),
      })
    })
    res.json({ estado: true, mensaje: 'Usuario desbloqueado' })
  })
)

usuariosRouter.post(
  '/:id/reset-pin',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const idUsuario = Number(req.params.id)
    const usuario = await prisma.usuario.findUnique({ where: { idUsuario } })
    if (!usuario) throw new NotFoundError('Usuario no encontrado')

    await prisma.$transaction(async (tx) => {
      await tx.usuario.update({ where: { idUsuario }, data: { pinHash: null, pinBloqueado: false, pinIntentosFallidos: 0 } })
      await logAudit(tx, {
        entidad: 'Usuario', idEntidad: idUsuario, descripcionEntidad: `${usuario.login} — ${usuario.nombres} ${usuario.apellidos}`,
        accion: 'MODIFICAR', modulo: 'usuarios', motivo: 'PIN de firma reiniciado por el administrador — debe configurar uno nuevo',
        actor: await actorDe(prisma, req.auth!.idUsuario),
      })
    })
    res.json({ estado: true, mensaje: 'PIN de firma reiniciado. El usuario debe configurar uno nuevo al ingresar' })
  })
)

usuariosRouter.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const idUsuario = Number(req.params.id)
    const usuario = await prisma.usuario.findUnique({ where: { idUsuario } })
    if (!usuario) throw new NotFoundError('Usuario no encontrado')

    await prisma.$transaction(async (tx) => {
      await tx.usuario.update({ where: { idUsuario }, data: { activo: false } })
      await logAudit(tx, {
        entidad: 'Usuario', idEntidad: idUsuario, descripcionEntidad: `${usuario.login} — ${usuario.nombres} ${usuario.apellidos}`,
        accion: 'MODIFICAR', modulo: 'usuarios',
        cambios: [{ campo: 'activo', etiqueta: 'Activo', valorAnterior: 'true', valorNuevo: 'false' }],
        actor: await actorDe(tx, req.auth!.idUsuario),
      })
    })
    res.json({ estado: true, mensaje: 'Usuario desactivado' })
  })
)

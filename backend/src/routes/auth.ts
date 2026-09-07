import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../db/prisma.js'
import { signToken, signState, verifyState, requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { NotFoundError, UnauthorizedError, ValidationError } from '../utils/errors.js'
import { cargoDeGrupos, logAudit } from '../services/audit.js'
import { MODULO_CLAVES } from '../constants/modulos.js'
import { generarYEnviarInvitacion } from '../services/invitacion.js'
import { verificarPin } from '../services/pin.js'
import * as oidc from '../services/oidc.js'

export const authRouter = Router()

const loginSchema = z.object({
  login: z.string().min(1),
  clave: z.string().min(1),
})

type RolAuth = { nombre: string; activo: boolean; modulos: string; modulosEdicion: string | null } | null

function modulosDe(usuario: { esAdministrador: boolean; rol: RolAuth }): string[] {
  if (usuario.esAdministrador) return [...MODULO_CLAVES]
  if (!usuario.rol || !usuario.rol.activo) return []
  return usuario.rol.modulos.split(',').map((s) => s.trim()).filter(Boolean)
}

function modulosEdicionDe(usuario: { esAdministrador: boolean; rol: RolAuth }): string[] {
  if (usuario.esAdministrador) return [...MODULO_CLAVES]
  if (!usuario.rol || !usuario.rol.activo) return []
  return (usuario.rol.modulosEdicion ?? '').split(',').map((s) => s.trim()).filter(Boolean)
}

async function buildAuthUser(usuario: {
  idUsuario: number
  nombres: string
  apellidos: string
  login: string
  email: string
  idCentro: number | null
  esAdministrador: boolean
  grupos: { grupo: { id: number; nombre: string } }[]
  rol: RolAuth
}) {
  const grupoNombres = usuario.grupos.map((g) => g.grupo.nombre)
  const grupoIds = usuario.grupos.map((g) => g.grupo.id)
  return {
    idUsuario: usuario.idUsuario,
    nombres: usuario.nombres,
    apellidos: usuario.apellidos,
    login: usuario.login,
    email: usuario.email,
    idCentro: usuario.idCentro,
    esAdministrador: usuario.esAdministrador,
    roles: [usuario.esAdministrador ? 'Administrador' : (usuario.rol?.nombre ?? 'Sin rol asignado')],
    modulos: modulosDe(usuario),
    moduloEdicion: modulosEdicionDe(usuario),
    grupos: grupoNombres.join(','),
    idGrupos: grupoIds.join(','),
  }
}

function findUsableUser(login: string) {
  return prisma.usuario.findUnique({
    where: { login },
    include: {
      grupos: { include: { grupo: true } },
      rol: { select: { id: true, nombre: true, activo: true, modulos: true, modulosEdicion: true } },
    },
  })
}

function findUsableUserByEmail(email: string) {
  return prisma.usuario.findUnique({
    where: { email },
    include: {
      grupos: { include: { grupo: true } },
      rol: { select: { id: true, nombre: true, activo: true, modulos: true, modulosEdicion: true } },
    },
  })
}

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) throw new ValidationError('login y clave son requeridos')
    const { login, clave } = parsed.data

    const usuario = await findUsableUser(login)

    // La caducidad se revisa primero y de forma independiente de `activo`: si ya pasó la fecha,
    // el usuario debe enterarse de que caducó — incluso si un chequeo perezoso anterior (p. ej.
    // GET /usuarios) ya lo había marcado `activo: false` por su cuenta, lo que de otro modo haría
    // que cayera en el mensaje genérico de "usuario inactivo" y ocultara la razón real.
    if (usuario?.fechaCaducidad && usuario.fechaCaducidad < new Date()) {
      if (usuario.activo) await prisma.usuario.update({ where: { idUsuario: usuario.idUsuario }, data: { activo: false } })
      await logAudit(prisma, {
        entidad: 'Sesion', idEntidad: usuario.idUsuario, descripcionEntidad: `Intento de acceso fallido — usuario: "${login}"`,
        accion: 'LOGIN_FALLIDO', modulo: 'autenticacion', motivo: 'Cuenta caducada',
        actor: { idUsuario: usuario.idUsuario, nombreUsuario: `${usuario.nombres} ${usuario.apellidos}`, loginUsuario: usuario.login, cargo: '—' },
      })
      throw new UnauthorizedError('Esta cuenta caducó. Contacte al administrador')
    }

    if (!usuario || !usuario.activo) {
      await logAudit(prisma, {
        entidad: 'Sesion', idEntidad: 0, descripcionEntidad: `Intento de acceso fallido — usuario: "${login}"`,
        accion: 'LOGIN_FALLIDO', modulo: 'autenticacion', motivo: 'Usuario no existe o inactivo',
        actor: { idUsuario: 0, nombreUsuario: 'Desconocido', loginUsuario: login, cargo: '—' },
      })
      throw new UnauthorizedError('Usuario o contraseña incorrectos')
    }
    if (usuario.bloqueado) throw new UnauthorizedError('Usuario bloqueado. Contacte al administrador')

    if (!usuario.passwordHash) throw new UnauthorizedError('Cuenta pendiente de activación — revise su correo para definir su contraseña')

    const cargo = cargoDeGrupos(usuario.grupos.map((g) => g.grupo.nombre), usuario.esAdministrador)
    const actor = { idUsuario: usuario.idUsuario, nombreUsuario: `${usuario.nombres} ${usuario.apellidos}`, loginUsuario: usuario.login, cargo }

    const passwordOk = await bcrypt.compare(clave, usuario.passwordHash)
    if (!passwordOk) {
      await prisma.usuario.update({
        where: { idUsuario: usuario.idUsuario },
        data: {
          intentosFallidos: { increment: 1 },
          bloqueado: usuario.intentosFallidos + 1 >= 5,
        },
      })
      await logAudit(prisma, {
        entidad: 'Sesion', idEntidad: usuario.idUsuario, descripcionEntidad: `Intento de acceso fallido — usuario: "${login}"`,
        accion: 'LOGIN_FALLIDO', modulo: 'autenticacion', motivo: 'Contraseña incorrecta', actor,
      })
      throw new UnauthorizedError('Usuario o contraseña incorrectos')
    }

    if (usuario.intentosFallidos > 0) {
      await prisma.usuario.update({ where: { idUsuario: usuario.idUsuario }, data: { intentosFallidos: 0 } })
    }

    await logAudit(prisma, {
      entidad: 'Sesion', idEntidad: usuario.idUsuario, descripcionEntidad: `Inicio de sesión exitoso — ${usuario.login}`,
      accion: 'LOGIN', modulo: 'autenticacion', actor,
    })

    const authUser = await buildAuthUser(usuario)
    const token = signToken({
      idUsuario: usuario.idUsuario, login: usuario.login, esAdministrador: usuario.esAdministrador,
      modulos: modulosDe(usuario).join(','), modulosEdicion: modulosEdicionDe(usuario).join(','),
    })
    res.json({ ...authUser, token })
  })
)

// ── Inicio de sesión con proveedor externo (OIDC) ───────────────────────────
// Genérico por diseño: funciona contra cualquier proveedor que cumpla el estándar OIDC
// (Microsoft Entra ID, Google, Okta, Auth0, Keycloak...), configurado por variables de
// entorno. Nunca crea un Usuario nuevo — la cuenta (con su Centro/Rol/Grupo Responsable) la
// tiene que crear antes un administrador desde el módulo Usuarios, igual que hoy.

authRouter.get(
  '/config',
  (_req, res) => {
    res.json({
      oidcEnabled: oidc.isOidcConfigured(),
      oidcLabel: process.env.OIDC_LABEL || 'tu cuenta corporativa',
    })
  }
)

type OidcState = { cv: string }

authRouter.get(
  '/oidc/login',
  asyncHandler(async (_req, res) => {
    if (!oidc.isOidcConfigured()) throw new NotFoundError('El inicio de sesión con proveedor externo no está configurado')
    const codeVerifier = oidc.randomCodeVerifier()
    const codeChallenge = await oidc.codeChallengeFor(codeVerifier)
    const state = signState<OidcState>({ cv: codeVerifier }, '10m')
    const url = await oidc.getAuthorizationUrl(state, codeChallenge)
    res.redirect(url)
  })
)

authRouter.get(
  '/oidc/callback',
  asyncHandler(async (req, res) => {
    const frontend = process.env.CORS_ORIGIN ?? 'http://localhost:5173'
    if (!oidc.isOidcConfigured()) throw new NotFoundError('El inicio de sesión con proveedor externo no está configurado')

    const stateParam = typeof req.query.state === 'string' ? req.query.state : ''
    let codeVerifier: string
    try {
      codeVerifier = verifyState<OidcState>(stateParam).cv
    } catch {
      return res.redirect(`${frontend}/login?oidcError=estado_invalido`)
    }

    const callbackUrl = new URL(req.originalUrl, `${req.protocol}://${req.get('host')}`)
    let identidad: Awaited<ReturnType<typeof oidc.exchangeCode>>
    try {
      identidad = await oidc.exchangeCode(callbackUrl, codeVerifier, stateParam)
    } catch (err) {
      console.error('[oidc] Error al canjear el código de autorización:', err)
      return res.redirect(`${frontend}/login?oidcError=proveedor`)
    }

    const usuario = await findUsableUserByEmail(identidad.email)

    const rechazar = async (motivo: string) => {
      await logAudit(prisma, {
        entidad: 'Sesion', idEntidad: usuario?.idUsuario ?? 0,
        descripcionEntidad: `Intento de acceso fallido (OIDC) — correo: "${identidad.email}"`,
        accion: 'LOGIN_FALLIDO', modulo: 'autenticacion', motivo,
        actor: usuario
          ? { idUsuario: usuario.idUsuario, nombreUsuario: `${usuario.nombres} ${usuario.apellidos}`, loginUsuario: usuario.login, cargo: '—' }
          : { idUsuario: 0, nombreUsuario: 'Desconocido', loginUsuario: identidad.email, cargo: '—' },
      })
      res.redirect(`${frontend}/login?oidcError=no_registrado`)
    }

    // Nunca se crea un Usuario aquí — si el correo no está registrado en Bacord, se rechaza y
    // queda en el log de accesos para que el administrador lo revise.
    if (!usuario) return rechazar('Correo no registrado en Bacord')

    if (usuario.fechaCaducidad && usuario.fechaCaducidad < new Date()) {
      if (usuario.activo) await prisma.usuario.update({ where: { idUsuario: usuario.idUsuario }, data: { activo: false } })
      return rechazar('Cuenta caducada')
    }
    if (!usuario.activo) return rechazar('Usuario inactivo')
    if (usuario.bloqueado) return rechazar('Usuario bloqueado')

    const cargo = cargoDeGrupos(usuario.grupos.map((g) => g.grupo.nombre), usuario.esAdministrador)
    await logAudit(prisma, {
      entidad: 'Sesion', idEntidad: usuario.idUsuario, descripcionEntidad: `Inicio de sesión exitoso (OIDC) — ${usuario.login}`,
      accion: 'LOGIN', modulo: 'autenticacion',
      actor: { idUsuario: usuario.idUsuario, nombreUsuario: `${usuario.nombres} ${usuario.apellidos}`, loginUsuario: usuario.login, cargo },
    })

    const authUser = await buildAuthUser(usuario)
    const token = signToken({
      idUsuario: usuario.idUsuario, login: usuario.login, esAdministrador: usuario.esAdministrador,
      modulos: modulosDe(usuario).join(','), modulosEdicion: modulosEdicionDe(usuario).join(','),
    })
    const session = encodeURIComponent(JSON.stringify({ ...authUser, token }))
    res.redirect(`${frontend}/auth/callback#session=${session}`)
  })
)

const validarFirmaSchema = z.object({
  login: z.string().min(1),
  pin: z.string().min(1),
})

authRouter.post(
  '/validar-firma',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = validarFirmaSchema.safeParse(req.body)
    if (!parsed.success) throw new ValidationError('login y pin son requeridos')
    const { login, pin } = parsed.data

    const usuario = await prisma.usuario.findUnique({ where: { login } })
    if (!usuario || !usuario.activo || usuario.bloqueado) {
      return res.json({ estado: false, mensaje: 'Usuario no válido para firmar' })
    }

    const pinCheck = await verificarPin(prisma, usuario, pin)
    if (!pinCheck.ok) return res.json({ estado: false, mensaje: pinCheck.mensaje })

    res.json({ estado: true, mensaje: 'Firma válida', datos: { idUsuario: usuario.idUsuario, login: usuario.login } })
  })
)

const configurarPinSchema = z.object({
  pinActual: z.string().optional(),
  pinNuevo: z.string().regex(/^\d{4,8}$/, 'El PIN debe tener entre 4 y 8 dígitos'),
})

authRouter.post(
  '/pin',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = configurarPinSchema.safeParse(req.body)
    if (!parsed.success) return res.json({ estado: false, mensaje: parsed.error.errors[0]?.message ?? 'Datos inválidos' })
    const { pinActual, pinNuevo } = parsed.data

    const usuario = await prisma.usuario.findUniqueOrThrow({ where: { idUsuario: req.auth!.idUsuario } })

    // Para configurarlo por primera vez basta con tener sesión activa; para cambiar uno ya
    // existente se exige el PIN actual — evita que alguien con la sesión abierta de otro
    // (equipo compartido en planta) le cambie el PIN de firma sin su consentimiento.
    if (usuario.pinHash) {
      if (!pinActual) return res.json({ estado: false, mensaje: 'Debe indicar el PIN actual para cambiarlo' })
      const actualOk = await bcrypt.compare(pinActual, usuario.pinHash)
      if (!actualOk) return res.json({ estado: false, mensaje: 'El PIN actual no es correcto' })
    }

    const pinHash = await bcrypt.hash(pinNuevo, 12)
    await prisma.usuario.update({
      where: { idUsuario: usuario.idUsuario },
      data: { pinHash, pinIntentosFallidos: 0, pinBloqueado: false },
    })
    await logAudit(prisma, {
      entidad: 'Sesion', idEntidad: usuario.idUsuario,
      descripcionEntidad: `PIN de firma ${usuario.pinHash ? 'actualizado' : 'configurado'} — ${usuario.login}`,
      accion: 'MODIFICAR', modulo: 'autenticacion',
      actor: { idUsuario: usuario.idUsuario, nombreUsuario: `${usuario.nombres} ${usuario.apellidos}`, loginUsuario: usuario.login, cargo: '—' },
    })
    res.json({ estado: true, mensaje: usuario.pinHash ? 'PIN actualizado' : 'PIN configurado' })
  })
)

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const usuario = await findUsableUser(req.auth!.login)
    if (!usuario) throw new UnauthorizedError()
    res.json(await buildAuthUser(usuario))
  })
)

const olvideClaveSchema = z.object({ email: z.string().email() })

authRouter.post(
  '/olvide-clave',
  asyncHandler(async (req, res) => {
    const parsed = olvideClaveSchema.safeParse(req.body)
    if (!parsed.success) throw new ValidationError('Correo inválido')
    const usuario = await prisma.usuario.findUnique({ where: { email: parsed.data.email } })
    // Respuesta genérica siempre, exista o no el correo — evita revelar qué cuentas existen.
    if (usuario && usuario.activo) {
      await generarYEnviarInvitacion(usuario.idUsuario, usuario.email, usuario.nombres, usuario.passwordHash !== null)
    }
    res.json({ estado: true, mensaje: 'Si el correo está registrado, se envió un enlace para restablecer la contraseña.' })
  })
)

// ── Activación de cuenta / restablecimiento de contraseña por enlace ────────
// Endpoints públicos (sin requireAuth): el usuario aún no tiene sesión cuando los usa.

authRouter.get(
  '/activar-cuenta',
  asyncHandler(async (req, res) => {
    const token = typeof req.query.token === 'string' ? req.query.token : ''
    if (!token) return res.json({ valido: false })
    const usuario = await prisma.usuario.findUnique({ where: { tokenActivacion: token } })
    const valido = !!usuario && !!usuario.tokenActivacionExpira && usuario.tokenActivacionExpira > new Date()
    res.json({ valido, nombre: valido ? usuario!.nombres : undefined })
  })
)

const activarCuentaSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(6),
})

authRouter.post(
  '/activar-cuenta',
  asyncHandler(async (req, res) => {
    const parsed = activarCuentaSchema.safeParse(req.body)
    if (!parsed.success) throw new ValidationError('Datos inválidos')
    const { token, password } = parsed.data

    const usuario = await prisma.usuario.findUnique({ where: { tokenActivacion: token } })
    if (!usuario || !usuario.tokenActivacionExpira || usuario.tokenActivacionExpira < new Date()) {
      return res.json({ estado: false, mensaje: 'El enlace es inválido o venció. Solicite uno nuevo al administrador.' })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    await prisma.usuario.update({
      where: { idUsuario: usuario.idUsuario },
      data: { passwordHash, tokenActivacion: null, tokenActivacionExpira: null, bloqueado: false, intentosFallidos: 0 },
    })
    await logAudit(prisma, {
      entidad: 'Sesion', idEntidad: usuario.idUsuario, descripcionEntidad: `Cuenta activada — ${usuario.login}`,
      accion: 'MODIFICAR', modulo: 'autenticacion',
      actor: { idUsuario: usuario.idUsuario, nombreUsuario: `${usuario.nombres} ${usuario.apellidos}`, loginUsuario: usuario.login, cargo: '—' },
    })
    res.json({ estado: true, mensaje: 'Contraseña definida. Ya puede iniciar sesión.' })
  })
)

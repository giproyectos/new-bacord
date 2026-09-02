import crypto from 'node:crypto'
import { prisma } from '../db/prisma.js'
import { enviarInvitacionCuenta, enviarRestablecerContrasena } from './email.js'

const TOKEN_VIGENCIA_MS = 48 * 60 * 60 * 1000 // 48h

function linkActivacion(token: string): string {
  const base = process.env.CORS_ORIGIN ?? 'http://localhost:5173'
  return `${base}/activar-cuenta?token=${token}`
}

/** Genera un token de un solo uso y envía el correo de invitación (cuenta nueva) o de restablecimiento (contraseña ya definida). */
export async function generarYEnviarInvitacion(idUsuario: number, email: string, nombres: string, esReenvio: boolean) {
  const token = crypto.randomBytes(32).toString('hex')
  await prisma.usuario.update({
    where: { idUsuario },
    data: { tokenActivacion: token, tokenActivacionExpira: new Date(Date.now() + TOKEN_VIGENCIA_MS) },
  })
  const link = linkActivacion(token)
  if (esReenvio) await enviarRestablecerContrasena(email, nombres, link)
  else await enviarInvitacionCuenta(email, nombres, link)
}

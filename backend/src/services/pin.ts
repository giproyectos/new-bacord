import bcrypt from 'bcryptjs'
import type { PrismaClient } from '@prisma/client'

const MAX_INTENTOS_PIN = 5

interface UsuarioPin {
  idUsuario: number
  pinHash: string | null
  pinBloqueado: boolean
  pinIntentosFallidos: number
}

// Valida el PIN de firma electrónica — secreto corto, independiente de la contraseña de acceso,
// que confirma el acto de firmar/liberar un lote. Aplica el mismo bloqueo por intentos fallidos
// que ya existe para la contraseña de login (backend/src/routes/auth.ts), pero en un contador
// separado: un PIN bloqueado no afecta el login normal del usuario, y viceversa.
export async function verificarPin(prisma: PrismaClient, usuario: UsuarioPin, pinIngresado: string): Promise<{ ok: boolean; mensaje?: string }> {
  if (!usuario.pinHash) {
    return { ok: false, mensaje: 'Este usuario no ha configurado su PIN de firma. Debe configurarlo antes de firmar' }
  }
  if (usuario.pinBloqueado) {
    return { ok: false, mensaje: 'PIN de firma bloqueado por intentos fallidos. Contacte al administrador' }
  }

  const pinOk = await bcrypt.compare(pinIngresado, usuario.pinHash)
  if (!pinOk) {
    await prisma.usuario.update({
      where: { idUsuario: usuario.idUsuario },
      data: {
        pinIntentosFallidos: { increment: 1 },
        pinBloqueado: usuario.pinIntentosFallidos + 1 >= MAX_INTENTOS_PIN,
      },
    })
    return { ok: false, mensaje: 'PIN incorrecto' }
  }

  if (usuario.pinIntentosFallidos > 0) {
    await prisma.usuario.update({ where: { idUsuario: usuario.idUsuario }, data: { pinIntentosFallidos: 0 } })
  }
  return { ok: true }
}

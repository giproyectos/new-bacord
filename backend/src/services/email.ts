import nodemailer from 'nodemailer'

let transporter: nodemailer.Transporter | null = null
let warned = false

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env
  if (!SMTP_HOST) {
    if (!warned) {
      console.warn('[email] SMTP_HOST no está configurado en .env — los correos se omitirán (solo se registrarán en consola).')
      warned = true
    }
    return null
  }
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  })
  return transporter
}

async function enviarCorreo(to: string, subject: string, html: string, link: string) {
  const t = getTransporter()
  if (!t) {
    // Sin SMTP configurado no hay forma de que el destinatario reciba el enlace por otro medio,
    // así que se deja completo en el log del backend para poder seguir probando/operando igual.
    console.log(`[email] (SMTP no configurado) Para: ${to} — "${subject}"\n[email] Enlace: ${link}`)
    return
  }
  const from = process.env.SMTP_FROM ?? 'BACord EBR <no-reply@bacord.local>'
  try {
    await t.sendMail({ from, to, subject, html })
  } catch (err) {
    // El envío de correo nunca debe tumbar la operación que lo dispara (crear usuario, etc).
    console.error(`[email] Falló el envío a ${to}:`, err)
  }
}

export async function enviarInvitacionCuenta(to: string, nombre: string, link: string) {
  await enviarCorreo(
    to,
    'Activa tu cuenta en BACord',
    `<p>Hola ${nombre},</p>
     <p>Se creó una cuenta para ti en BACord. Ingresa al siguiente enlace para definir tu contraseña y activarla:</p>
     <p><a href="${link}">${link}</a></p>
     <p>Este enlace vence en 48 horas.</p>`,
    link
  )
}

export async function enviarRestablecerContrasena(to: string, nombre: string, link: string) {
  await enviarCorreo(
    to,
    'Restablecer tu contraseña — BACord',
    `<p>Hola ${nombre},</p>
     <p>Se solicitó restablecer tu contraseña en BACord. Ingresa al siguiente enlace para definir una nueva:</p>
     <p><a href="${link}">${link}</a></p>
     <p>Este enlace vence en 48 horas. Si no solicitaste esto, ignora este correo — tu contraseña actual sigue funcionando.</p>`,
    link
  )
}

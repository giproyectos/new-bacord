import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const login = process.env.SEED_ADMIN_LOGIN ?? 'admin'
  const password = process.env.SEED_ADMIN_PASSWORD
  if (!password) throw new Error('SEED_ADMIN_PASSWORD no está definido en .env')

  // Arranque limpio: lo único que existe por defecto es el usuario administrador.
  // Centros, grupos, materiales, recetas, etc. los crea el propio admin desde la UI.
  const passwordHash = await bcrypt.hash(password, 12)

  const admin = await prisma.usuario.upsert({
    where: { login },
    update: {},
    create: {
      numeroIdentificacion: '00000000',
      nombres: 'Administrador',
      apellidos: 'Sistema',
      login,
      email: `${login}@bacord.local`,
      passwordHash,
      passwordCambiadaEn: new Date(),
      esAdministrador: true,
    },
  })

  // Parámetros de sesión/contraseña — configurables por cliente desde el módulo Parámetros.
  // Se crean solo si no existen, para no pisar un valor que el cliente ya haya ajustado.
  const parametrosPorDefecto = [
    { nombre: 'sesion_inactividad_minutos', valor: '5', descripcion: 'Minutos de inactividad antes del bloqueo automático de sesión.' },
    { nombre: 'password_rotacion_dias', valor: '60', descripcion: 'Días que puede vivir una contraseña antes de exigir su renovación.' },
    { nombre: 'password_min_caracteres', valor: '8', descripcion: 'Cantidad mínima de caracteres exigida al definir una contraseña.' },
    { nombre: 'password_requiere_mayuscula', valor: 'true', descripcion: 'Si la contraseña debe incluir al menos una letra mayúscula (true/false).' },
    { nombre: 'password_requiere_minuscula', valor: 'true', descripcion: 'Si la contraseña debe incluir al menos una letra minúscula (true/false).' },
    { nombre: 'password_requiere_especial', valor: 'true', descripcion: 'Si la contraseña debe incluir al menos un carácter especial (true/false).' },
    { nombre: 'desviaciones_grupo_cierre', valor: 'Calidad', descripcion: 'Grupos Responsables (separados por coma) autorizados a cerrar una desviación, además de los administradores.' },
  ]
  for (const p of parametrosPorDefecto) {
    await prisma.parametro.upsert({ where: { nombre: p.nombre }, update: {}, create: p })
  }

  console.log(`Seed listo. Usuario admin: ${admin.login} (idUsuario=${admin.idUsuario})`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

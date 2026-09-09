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
  await prisma.parametro.upsert({
    where: { nombre: 'sesion_inactividad_minutos' },
    update: {},
    create: {
      nombre: 'sesion_inactividad_minutos',
      valor: '5',
      descripcion: 'Minutos de inactividad antes del bloqueo automático de sesión.',
    },
  })
  await prisma.parametro.upsert({
    where: { nombre: 'password_rotacion_dias' },
    update: {},
    create: {
      nombre: 'password_rotacion_dias',
      valor: '60',
      descripcion: 'Días que puede vivir una contraseña antes de exigir su renovación.',
    },
  })

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

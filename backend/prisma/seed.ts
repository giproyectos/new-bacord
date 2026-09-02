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
      esAdministrador: true,
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

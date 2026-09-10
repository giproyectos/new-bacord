import type { PrismaClient } from '@prisma/client'

/**
 * Lee un `Parametro` como entero positivo, con valor de repliegue si no existe o no es válido.
 * Sostiene los valores configurables por cliente (p. ej. `sesion_inactividad_minutos`,
 * `password_rotacion_dias`) sin necesitar una variable de entorno ni un despliegue.
 */
export async function getParametroNumero(
  prisma: PrismaClient,
  nombre: string,
  valorPorDefecto: number
): Promise<number> {
  const parametro = await prisma.parametro.findUnique({ where: { nombre } })
  if (!parametro) return valorPorDefecto
  const numero = Number(parametro.valor)
  if (!Number.isFinite(numero) || numero <= 0) return valorPorDefecto
  return numero
}

/** Lee un `Parametro` como booleano ('true'/'false'), con valor de repliegue si no existe. */
export async function getParametroBooleano(
  prisma: PrismaClient,
  nombre: string,
  valorPorDefecto: boolean
): Promise<boolean> {
  const parametro = await prisma.parametro.findUnique({ where: { nombre } })
  if (!parametro) return valorPorDefecto
  return parametro.valor.trim().toLowerCase() === 'true'
}

/** Lee un `Parametro` como CSV de nombres de Grupo Responsable (p. ej. gruposDerogacion). */
export async function getParametroGrupos(
  prisma: PrismaClient,
  nombre: string,
  valorPorDefecto: string
): Promise<string[]> {
  const parametro = await prisma.parametro.findUnique({ where: { nombre } })
  const valor = parametro?.valor ?? valorPorDefecto
  return valor.split(',').map((g) => g.trim()).filter(Boolean)
}

export interface PoliticaPassword {
  minCaracteres: number
  requiereMayuscula: boolean
  requiereMinuscula: boolean
  requiereEspecial: boolean
}

/**
 * Política de complejidad de contraseña — igual que la rotación por antigüedad, configurable
 * por cliente vía `Parametro` en lugar de estar fija en el código (puntos 6 y 7 del checklist
 * GxP/21 CFR 11).
 */
export async function getPoliticaPassword(prisma: PrismaClient): Promise<PoliticaPassword> {
  const [minCaracteres, requiereMayuscula, requiereMinuscula, requiereEspecial] = await Promise.all([
    getParametroNumero(prisma, 'password_min_caracteres', 8),
    getParametroBooleano(prisma, 'password_requiere_mayuscula', true),
    getParametroBooleano(prisma, 'password_requiere_minuscula', true),
    getParametroBooleano(prisma, 'password_requiere_especial', true),
  ])
  return { minCaracteres, requiereMayuscula, requiereMinuscula, requiereEspecial }
}

/** Valida una contraseña contra la política vigente. Devuelve el primer mensaje de error, o null si cumple. */
export function validarPassword(password: string, politica: PoliticaPassword): string | null {
  if (password.length < politica.minCaracteres) return `La contraseña debe tener al menos ${politica.minCaracteres} caracteres`
  if (politica.requiereMayuscula && !/[A-Z]/.test(password)) return 'La contraseña debe incluir al menos una mayúscula'
  if (politica.requiereMinuscula && !/[a-z]/.test(password)) return 'La contraseña debe incluir al menos una minúscula'
  if (politica.requiereEspecial && !/[^A-Za-z0-9]/.test(password)) return 'La contraseña debe incluir al menos un carácter especial'
  return null
}

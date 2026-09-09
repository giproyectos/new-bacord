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

import { defineConfig } from 'vitest/config'
import dotenv from 'dotenv'

// Se carga acá (no en un setupFile) para que las variables ya estén en process.env antes de
// que Vitest importe app.ts/prisma.ts — ambos leen configuración de entorno al cargarse.
dotenv.config({ path: '.env.test' })

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 20000,
    // Todas las pruebas comparten una sola base de datos real (bacord_test) — correrlas en
    // paralelo produciría condiciones de carrera falsas entre archivos de prueba distintos.
    fileParallelism: false,
  },
})

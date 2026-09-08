import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { authRouter } from './routes/auth.js'
import { centrosRouter } from './routes/centros.js'
import { gruposResponsablesRouter } from './routes/gruposResponsables.js'
import { materialesRouter } from './routes/materiales.js'
import { procesosRouter } from './routes/procesos.js'
import { firmasRouter } from './routes/firmas.js'
import { estrategiasFirmaRouter } from './routes/estrategiasFirma.js'
import { detallesRouter } from './routes/detalles.js'
import { usuariosRouter } from './routes/usuarios.js'
import { rolesRouter } from './routes/roles.js'
import { recetasMaestrasRouter } from './routes/recetasMaestras.js'
import { ordenesProcesoRouter } from './routes/ordenesProceso.js'
import { formulasControlRouter } from './routes/formulasControl.js'
import { batchRecordsRouter } from './routes/batchRecords.js'
import { desviacionesRouter } from './routes/desviaciones.js'
import { auditoriaRouter } from './routes/auditoria.js'
import { parametrosRouter } from './routes/parametros.js'
import { requireAuth, requireModulo } from './middleware/auth.js'
import { errorHandler } from './middleware/errorHandler.js'

/** La app de Express en sí, separada de `server.ts` (que solo la pone a escuchar en un puerto)
 * para poder montarla directo en pruebas de integración (supertest) sin abrir un socket real. */
export const app = express()

app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' }))
app.use(express.json({ limit: '5mb' })) // los schemas Form.io pueden ser JSON grandes

app.get('/api/health', (_req, res) => res.json({ estado: true, mensaje: 'ok' }))

app.use('/api/auth', authRouter)

// Todo lo demás requiere sesión autenticada; los módulos operativos/catálogo además
// requieren que el Rol del usuario incluya esa clave de módulo (o ser administrador).
app.use('/api/centros', requireAuth, requireModulo('centros'), centrosRouter)
app.use('/api/grupos-responsables', requireAuth, requireModulo('grupos-responsables'), gruposResponsablesRouter)
app.use('/api/materiales', requireAuth, requireModulo('materiales'), materialesRouter)
app.use('/api/procesos', requireAuth, requireModulo('procesos'), procesosRouter)
app.use('/api/firmas', requireAuth, requireModulo('firmas'), firmasRouter)
app.use('/api/estrategias-firma', requireAuth, requireModulo('estrategias-firma'), estrategiasFirmaRouter)
app.use('/api/detalles', requireAuth, requireModulo('detalles'), detallesRouter)
// Usuarios y Roles administran cuentas y permisos — quedan reservados a esAdministrador (ver requireAdmin en cada router).
app.use('/api/usuarios', requireAuth, usuariosRouter)
app.use('/api/roles', requireAuth, rolesRouter)
app.use('/api/recetas-maestras', requireAuth, requireModulo('recetas-maestras'), recetasMaestrasRouter)
app.use('/api/ordenes-proceso', requireAuth, requireModulo('ordenes-proceso'), ordenesProcesoRouter)
app.use('/api/formulas-control', requireAuth, requireModulo('formulas-control'), formulasControlRouter)
app.use('/api/batch-records', requireAuth, requireModulo('batch-records'), batchRecordsRouter)
app.use('/api/desviaciones', requireAuth, requireModulo('batch-records'), desviacionesRouter)
app.use('/api/auditoria', requireAuth, auditoriaRouter)
app.use('/api/parametros', requireAuth, requireModulo('parametros'), parametrosRouter)

app.use(errorHandler)

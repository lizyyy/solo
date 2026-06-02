import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'

import './database.js'

import batchRoutes from './routes/batch.routes.js'
import importRoutes from './routes/import.routes.js'
import mergeRoutes from './routes/merge.routes.js'
import conflictRoutes from './routes/conflict.routes.js'
import anomalyRoutes from './routes/anomaly.routes.js'
import exportRoutes from './routes/export.routes.js'
import auditLogRoutes from './routes/audit-log.routes.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')))

app.use('/api/batches', batchRoutes)
app.use('/api/batches', importRoutes)
app.use('/api/batches', mergeRoutes)
app.use('/api/conflicts', conflictRoutes)
app.use('/api/batches', anomalyRoutes)
app.use('/api/batches', exportRoutes)
app.use('/api/batches', auditLogRoutes)

app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app

/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import authRoutes from './routes/auth.js'
import rawRowsRoutes from './routes/raw-rows.js'
import boundariesRoutes from './routes/boundaries.js'
import changesRoutes from './routes/changes.js'
import calculationsRoutes from './routes/calculations.js'
import workflowRoutes from './routes/workflow.js'
import importLogsRoutes from './routes/import-logs.js'
import reportsRoutes from './routes/reports.js'

// for esm mode
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// load env
dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

/**
 * API Routes
 */
app.use('/api/auth', authRoutes)
app.use('/api/raw-rows', rawRowsRoutes)
app.use('/api/boundaries', boundariesRoutes)
app.use('/api/changes', changesRoutes)
app.use('/api/calculations', calculationsRoutes)
app.use('/api/workflow', workflowRoutes)
app.use('/api/import-logs', importLogsRoutes)
app.use('/api/reports', reportsRoutes)

/**
 * health
 */
app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app

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
import './database.js'
import schemeRoutes from './routes/schemes.js'
import recordRoutes from './routes/records.js'
import sourceRoutes from './routes/sources.js'
import conflictRoutes from './routes/conflicts.js'
import changeRoutes from './routes/changes.js'
import exportRoutes from './routes/export.js'

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
app.use('/api/schemes', schemeRoutes)
app.use('/api/schemes/:schemeId/records', recordRoutes)
app.use('/api/schemes/:schemeId/conflicts', conflictRoutes)
app.use('/api/conflicts', conflictRoutes)
app.use('/api/schemes/:schemeId/changes', changeRoutes)
app.use('/api/schemes/:schemeId/export', exportRoutes)
app.use('/api/records/:recordId/sources', sourceRoutes)
app.use('/api/records', recordRoutes)

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

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
import screenshotRoutes from './routes/screenshots.js'
import samplingIntervalRoutes from './routes/sampling-intervals.js'
import calculationRoutes from './routes/calculations.js'
import auditRoutes from './routes/audit.js'
import reviewRoutes from './routes/review.js'
import userRoutes from './routes/users.js'
import { initDatabase } from './data/db.js'

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
 * Init Database
 */
initDatabase().catch(console.error)

/**
 * API Routes
 */
app.use('/api/auth', authRoutes)
app.use('/api/screenshots', screenshotRoutes)
app.use('/api/sampling-intervals', samplingIntervalRoutes)
app.use('/api/calculations', calculationRoutes)
app.use('/api/audit', auditRoutes)
app.use('/api', reviewRoutes)
app.use('/api/users', userRoutes)

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

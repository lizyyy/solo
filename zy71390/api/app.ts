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
import rulesRoutes from './routes/rules.js'
import customersRoutes from './routes/customers.js'
import shadowRoutes from './routes/shadow.js'
import anomaliesRoutes from './routes/anomalies.js'
import reportsRoutes from './routes/reports.js'
import modificationsRoutes from './routes/modifications.js'
import dashboardRoutes from './routes/dashboard.js'

// for esm mode
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// load env
dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use((req: Request, res: Response, next: NextFunction) => {
  const user = (req.headers['x-user'] as string) || 'admin'
  ;(req as Request & { user: string }).user = user
  next()
})

/**
 * API Routes
 */
app.use('/api/auth', authRoutes)
app.use('/api/rules', rulesRoutes)
app.use('/api/customers', customersRoutes)
app.use('/api/shadow', shadowRoutes)
app.use('/api/anomalies', anomaliesRoutes)
app.use('/api/reports', reportsRoutes)
app.use('/api/modifications', modificationsRoutes)
app.use('/api/dashboard', dashboardRoutes)

/**
 * health
 */
app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      data: { status: 'ok' },
    })
  },
)

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Server error:', error)
  res.status(500).json({
    success: false,
    error: error.message || 'Server internal error',
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

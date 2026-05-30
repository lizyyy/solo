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
import './db.js'
import channelRoutes from './routes/channels.js'
import allocationRoutes from './routes/allocations.js'
import exceptionRoutes from './routes/exceptions.js'
import reportRoutes from './routes/reports.js'
import dataRoutes from './routes/data.js'
import dashboardRoutes from './routes/dashboard.js'
import conversionRoutes from './routes/conversions.js'
import budgetRoutes from './routes/budgets.js'

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
app.use('/api/channels', channelRoutes)
app.use('/api/allocations', allocationRoutes)
app.use('/api/exceptions', exceptionRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/data', dataRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/conversions', conversionRoutes)
app.use('/api/budgets', budgetRoutes)

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

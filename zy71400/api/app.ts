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
import batchRoutes from './routes/batches.js'
import tradeRoutes from './routes/trades.js'
import collateralRoutes from './routes/collaterals.js'
import rateRoutes from './routes/rates.js'
import processRoutes from './routes/process.js'
import reviewRoutes from './routes/review.js'
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
app.use('/api/batches', batchRoutes)
app.use('/api/batches', tradeRoutes)
app.use('/api/batches', collateralRoutes)
app.use('/api/batches', rateRoutes)
app.use('/api/batches', processRoutes)
app.use('/api/batches', reviewRoutes)
app.use('/api/batches', exportRoutes)

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

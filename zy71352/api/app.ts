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
import artworksRoutes from './routes/artworks.js'
import valuationsRoutes from './routes/valuations.js'
import contractsRoutes from './routes/contracts.js'
import transportRoutes from './routes/transport.js'
import insuranceRoutes from './routes/insurance.js'
import gapCheckRoutes from './routes/gapCheck.js'
import reportsRoutes from './routes/reports.js'
import currencyRoutes from './routes/currency.js'

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
app.use('/api/artworks', artworksRoutes)
app.use('/api/valuations', valuationsRoutes)
app.use('/api/contracts', contractsRoutes)
app.use('/api/transport-nodes', transportRoutes)
app.use('/api/insurance-clauses', insuranceRoutes)
app.use('/api/gap-check', gapCheckRoutes)
app.use('/api/reports', reportsRoutes)
app.use('/api/currency', currencyRoutes)

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

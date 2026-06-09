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
import schedulesRoutes from './routes/schedules.js'
import photosRoutes from './routes/photos.js'
import overridesRoutes from './routes/overrides.js'
import actionsRoutes from './routes/actions.js'
import exportRoutes from './routes/export.js'
import retrieveRoutes from './routes/retrieve.js'

import './data/store.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

/**
 * API Routes
 */
app.use('/api/auth', authRoutes)
app.use('/api/schedules', schedulesRoutes)
app.use('/api/photos', photosRoutes)
app.use('/api/overrides', overridesRoutes)
app.use('/api/replace-actions', actionsRoutes)
app.use('/api/export', exportRoutes)
app.use('/api/retrieve', retrieveRoutes)

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
  console.error('[API ERROR]', error)
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

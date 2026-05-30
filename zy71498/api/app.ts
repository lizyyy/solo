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
import statsRoutes from './routes/stats.js'
import tracksRoutes from './routes/tracks.js'
import conflictsRoutes from './routes/conflicts.js'
import importRoutes from './routes/import.js'
import timelineRoutes from './routes/timeline.js'
import exportRoutes from './routes/export.js'
import { initializeStore } from './store.js'

// for esm mode
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// load env
dotenv.config()

const app: express.Application = express()

initializeStore()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use('/exports', express.static(path.join(process.cwd(), 'data', 'exports')))

/**
 * API Routes
 */
app.use('/api/auth', authRoutes)
app.use('/api/stats', statsRoutes)
app.use('/api/tracks', tracksRoutes)
app.use('/api/conflicts', conflictsRoutes)
app.use('/api/import', importRoutes)
app.use('/api/timeline', timelineRoutes)
app.use('/api/export', exportRoutes)

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
  console.error('Server error:', error)
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

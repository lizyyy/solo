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
import { v4 as uuidv4 } from 'uuid'
import authRoutes from './routes/auth.js'
import galleryRoutes from './routes/gallery.js'
import lightSourceRoutes from './routes/lightSource.js'
import artworkRoutes from './routes/artwork.js'
import samplingRoutes from './routes/sampling.js'
import exhibitionRoutes from './routes/exhibition.js'
import reportRoutes from './routes/report.js'
import riskRoutes from './routes/risk.js'
import { auditLog } from './middleware/audit.js'
import { errorHandler, notFoundHandler } from './middleware/validation.js'
import { db } from './db/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use(auditLog)

app.use(async (_req: Request, _res: Response, next: NextFunction) => {
  try {
    await db.init()
    next()
  } catch (error) {
    next(error)
  }
})

/**
 * API Routes
 */
app.use('/api/auth', authRoutes)
app.use('/api/galleries', galleryRoutes)
app.use('/api/light-sources', lightSourceRoutes)
app.use('/api/artworks', artworkRoutes)
app.use('/api/samplings', samplingRoutes)
app.use('/api/exhibitions', exhibitionRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/risks', riskRoutes)

/**
 * health
 */
app.get(
  '/api/health',
  (_req: Request, res: Response): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
      timestamp: new Date().toISOString(),
      requestId: uuidv4(),
    })
  },
)

app.use(errorHandler)
app.use(notFoundHandler)

export default app

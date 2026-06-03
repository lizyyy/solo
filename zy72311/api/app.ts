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
import questionnaireRoutes from './routes/questionnaire.js'
import boundaryNotesRoutes from './routes/boundaryNotes.js'
import conflictsRoutes from './routes/conflicts.js'
import auditLogsRoutes from './routes/auditLogs.js'
import scoringRoutes from './routes/scoring.js'
import reviewRoutes from './routes/review.js'
import { getDb } from './db/database.js'

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
app.use('/api/questionnaire', questionnaireRoutes)
app.use('/api/boundary-notes', boundaryNotesRoutes)
app.use('/api/conflicts', conflictsRoutes)
app.use('/api/audit-logs', auditLogsRoutes)
app.use('/api/scoring', scoringRoutes)
app.use('/api/review', reviewRoutes)

getDb()

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

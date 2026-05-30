/**
 * 演出返场曲单决策系统 API 服务器
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
import apiRoutes from './routes/index.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import { auditLogger } from './middleware/auditLogger.js'
import './db/index.js'

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
  req.headers['x-operator'] = req.headers['x-operator'] || 'local-admin'
  next()
})

/**
 * health
 */
app.use(
  '/api/health',
  (req: Request, res: Response): void => {
    res.status(200).json({
      success: true,
      message: '演出返场曲单决策系统运行正常',
      timestamp: new Date().toISOString(),
    })
  },
)

/**
 * Audit Logger Middleware
 */
app.use('/api', auditLogger)

/**
 * API Routes
 */
app.use('/api', apiRoutes)

/**
 * 404 handler
 */
app.use(notFoundHandler)

/**
 * error handler middleware
 */
app.use(errorHandler)

export default app

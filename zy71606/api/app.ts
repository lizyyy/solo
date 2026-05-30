import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { BusinessError } from './errors.js'
import { getDb } from './db.js'
import authRoutes from './routes/auth.js'
import clientRoutes from './routes/clients.js'
import marketRoutes from './routes/market.js'
import notificationRoutes from './routes/notifications.js'
import importRoutes from './routes/imports.js'
import depositRoutes from './routes/deposits.js'
import reportRoutes from './routes/reports.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

app.use('/api/auth', authRoutes)
app.use('/api/clients', clientRoutes)
app.use('/api/market', marketRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/import', importRoutes)
app.use('/api/deposits', depositRoutes)
app.use('/api/reports', reportRoutes)

app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    const db = getDb()
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  if (error instanceof BusinessError) {
    const status = error.severity === 'fatal' ? 500 : error.severity === 'warning' ? 409 : 400
    res.status(status).json({
      success: false,
      error: error.toJSON(),
    })
    return
  }

  if (error.name === 'MulterError') {
    res.status(400).json({
      success: false,
      error: {
        message: `文件上传错误: ${error.message}`,
        severity: 'error',
      },
    })
    return
  }

  console.error('[Unhandled Error]', error)
  res.status(500).json({
    success: false,
    error: {
      message: '服务器内部错误',
      severity: 'fatal',
    },
  })
})

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      message: 'API接口不存在',
      severity: 'error',
    },
  })
})

export default app

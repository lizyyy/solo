import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import featureRoutes from './routes/features.js'
import auditLogRoutes from './routes/auditLogs.js'
import leakAlertRoutes from './routes/leakAlerts.js'
import evaluationRoutes from './routes/evaluation.js'
import exportRoutes from './routes/export.js'
import { getDb } from './database.js'

dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

getDb()

app.use('/api/features', featureRoutes)
app.use('/api/audit-logs', auditLogRoutes)
app.use('/api/leak-alerts', leakAlertRoutes)
app.use('/api/evaluation', evaluationRoutes)
app.use('/api/export', exportRoutes)

app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app

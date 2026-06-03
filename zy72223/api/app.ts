import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import './db.js'
import settlementRoutes from './routes/settlements.js'
import entryRoutes from './routes/entries.js'
import summaryRoutes from './routes/summaries.js'
import auditLogRoutes from './routes/audit-logs.js'

dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use('/api/settlements', settlementRoutes)
app.use('/api/entries', entryRoutes)
app.use('/api/summaries', summaryRoutes)
app.use('/api/audit-logs', auditLogRoutes)

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

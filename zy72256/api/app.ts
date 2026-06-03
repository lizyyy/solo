import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { getDb } from './database.js'
import recordRoutes from './routes/records.js'
import reviewRoutes from './routes/review.js'
import auditRoutes from './routes/audit.js'
import ruleRoutes from './routes/rules.js'
import photoRoutes from './routes/photos.js'

dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use('/api', recordRoutes)
app.use('/api', reviewRoutes)
app.use('/api', auditRoutes)
app.use('/api', ruleRoutes)
app.use('/api', photoRoutes)

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

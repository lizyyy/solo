import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import importRoutes from './routes/import.js'
import reviewRoutes from './routes/review.js'
import selfcheckRoutes from './routes/selfcheck.js'
import auditRoutes from './routes/audit.js'
import exportRoutes from './routes/export.js'
import { getDb } from './db.js'

dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

getDb()

app.use('/api/import', importRoutes)
app.use('/api/review', reviewRoutes)
app.use('/api/selfcheck', selfcheckRoutes)
app.use('/api/audit', auditRoutes)
app.use('/api/export', exportRoutes)

app.use(
  '/api/health',
  (_req: Request, res: Response): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
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

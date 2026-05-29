import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import './db.js'
import worksRoutes from './routes/works.js'
import studentsRoutes from './routes/students.js'
import batchesRoutes from './routes/batches.js'
import glazesRoutes from './routes/glazes.js'
import queueRoutes from './routes/queue.js'
import rescheduleLogsRoutes from './routes/rescheduleLogs.js'
import reportsRoutes from './routes/reports.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use('/api/works', worksRoutes)
app.use('/api/students', studentsRoutes)
app.use('/api/batches', batchesRoutes)
app.use('/api', glazesRoutes)
app.use('/api/queue', queueRoutes)
app.use('/api/reschedule-logs', rescheduleLogsRoutes)
app.use('/api/reports', reportsRoutes)

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

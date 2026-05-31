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
import bundleRoutes from './routes/bundles.js'
import reportRoutes from './routes/reports.js'
import sampleRoutes from './routes/samples.js'
import evaluationRoutes from './routes/evaluations.js'
import changeRoutes from './routes/changes.js'
import guideRoutes from './routes/guide.js'
import modelRoutes from './routes/models.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use('/api/bundles', bundleRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/samples', sampleRoutes)
app.use('/api/evaluations', evaluationRoutes)
app.use('/api/changes', changeRoutes)
app.use('/api/consistency', changeRoutes)
app.use('/api/guide', guideRoutes)
app.use('/api/models', modelRoutes)

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

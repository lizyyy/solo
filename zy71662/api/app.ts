import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import schemeRoutes from './routes/schemes.js'
import fixtureRoutes from './routes/fixtures.js'
import calculationRoutes from './routes/calculations.js'
import reportRoutes from './routes/reports.js'
import { getDb } from './db/database.js'

dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use((_req: Request, _res: Response, next: NextFunction) => {
  getDb()
  next()
})

app.use('/api/schemes', schemeRoutes)
app.use('/api/fixtures', fixtureRoutes)
app.use('/api/calculations', calculationRoutes)
app.use('/api/reports', reportRoutes)

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

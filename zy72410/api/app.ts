import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { initDatabase } from './db/init.js'
import importRoutes from './routes/import.js'
import materialRoutes from './routes/materials.js'
import messageRoutes from './routes/messages.js'
import changeRoutes from './routes/changes.js'
import selfCheckRoutes from './routes/selfcheck.js'
import exportRoutes from './routes/export.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

initDatabase()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use('/api/import', importRoutes)
app.use('/api/materials', materialRoutes)
app.use('/api', messageRoutes)
app.use('/api/changes', changeRoutes)
app.use('/api/selfcheck', selfCheckRoutes)
app.use('/api/report', exportRoutes)
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
  console.error('Server error:', error)
  res.status(500).json({
    success: false,
    error: error.message || 'Server internal error',
  })
})

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app

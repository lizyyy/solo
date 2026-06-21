import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import multer from 'multer'
import authRoutes from './routes/auth.js'
import taskRoutes from './routes/task.router.js'
import layerRoutes from './routes/layer.router.js'
import screenshotRoutes from './routes/screenshot.router.js'
import guideRoutes from './routes/guide.router.js'
import { initDb, UPLOADS_DIR } from './db.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use('/api/auth', authRoutes)
app.use('/api/uploads', express.static(UPLOADS_DIR))
app.use('/api', taskRoutes)
app.use('/api', layerRoutes)
app.use('/api', screenshotRoutes)
app.use('/api', guideRoutes)

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
  if (error instanceof multer.MulterError) {
    res.status(400).json({
      success: false,
      error: `Multer error: ${error.message}`,
    })
    return
  }
  const msg = error.message || String(error)
  res.status(500).json({
    success: false,
    error: 'Server internal error',
    detail: msg,
  })
})

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

initDb().catch((err) => {
  console.error('Failed to initialize database:', err)
})

export default app

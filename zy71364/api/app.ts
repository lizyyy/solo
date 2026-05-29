/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import authRoutes from './routes/auth.js'
import artworkRoutes from './routes/artworks.js'
import restorationRoutes from './routes/restorations.js'
import materialRoutes from './routes/materials.js'
import photoRoutes from './routes/photos.js'
import anomalyRoutes from './routes/anomalies.js'
import signatureRoutes from './routes/signatures.js'
import reportRoutes from './routes/reports.js'
import './database.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

app.get('/api/health', (_req: Request, res: Response): void => {
  res.json({ success: true, message: 'ok' })
})

app.use('/api/auth', authRoutes)
app.use('/api/artworks', artworkRoutes)
app.use('/api/restorations', restorationRoutes)
app.use('/api', materialRoutes)
app.use('/api', photoRoutes)
app.use('/api', anomalyRoutes)
app.use('/api', signatureRoutes)
app.use('/api', reportRoutes)

app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app

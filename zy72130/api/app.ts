import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import recordRoutes from './routes/records.js'
import importRoutes from './routes/import.js'
import exportRoutes from './routes/export.js'
import judgmentRoutes from './routes/judgments.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use('/api/attachments', express.static(path.join(__dirname, '..', 'data', 'attachments')))

app.use('/api/records', recordRoutes)
app.use('/api/records', judgmentRoutes)
app.use('/api/import', importRoutes)
app.use('/api/export', exportRoutes)

app.use('/api/health', (req: Request, res: Response): void => {
  res.status(200).json({ success: true, message: 'ok' })
})

app.use((error: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error('Server error:', error)
  res.status(500).json({ success: false, error: 'Server internal error' })
})

app.use((req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'API not found' })
})

export default app

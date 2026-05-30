import 'reflect-metadata'
import express from 'express'
import cors from 'cors'
import { initDatabase } from './database.js'
import taskRoutes from './routes/tasks.js'

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use('/api', taskRoutes)

app.use('/api/health', (_req, res) => {
  res.status(200).json({ success: true, message: 'ok' })
})

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(500).json({ success: false, error: 'Server internal error' })
})

app.use((_req: express.Request, res: express.Response) => {
  res.status(404).json({ success: false, error: 'API not found' })
})

export { initDatabase }
export default app

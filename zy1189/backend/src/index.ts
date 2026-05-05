import express, { Express, Request, Response } from 'express'
import cors from 'cors'
import experimentsRouter from './routes/experiments.js'

const app: Express = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'OS Simulator API is running',
    timestamp: new Date().toISOString()
  })
})

app.use('/api/experiments', experimentsRouter)

app.use((err: Error, _req: Request, res: Response, _next: express.NextFunction) => {
  console.error('Error:', err)
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error'
  })
})

app.listen(PORT, () => {
  console.log(`OS Simulator Backend running on port ${PORT}`)
  console.log(`API endpoints: http://localhost:${PORT}/api`)
})

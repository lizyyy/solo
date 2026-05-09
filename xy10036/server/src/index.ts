import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { initDatabase, closeDatabase } from './database'
import { idempotencyMiddleware, cleanupExpiredIdempotentRequests } from './middleware/idempotency'
import { errorHandler, notFoundHandler } from './middleware/error'
import devicesRouter from './routes/devices'
import borrowRouter from './routes/borrow'
import auditRouter from './routes/audit'

const PORT = process.env.PORT || 3001
const DATA_DIR = path.join(__dirname, '../../data')

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

const app = express()

app.use(cors())
app.use(express.json())
app.use(idempotencyMiddleware)

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString()
    },
    requestId: req.idempotency?.requestId || 'health-check',
    timestamp: new Date().toISOString()
  })
})

app.use('/api/devices', devicesRouter)
app.use('/api/borrow', borrowRouter)
app.use('/api/audit', auditRouter)

app.use('*', notFoundHandler)
app.use(errorHandler)

async function startServer(): Promise<void> {
  try {
    await initDatabase()
    
    setInterval(() => {
      cleanupExpiredIdempotentRequests().catch(console.error)
    }, 60 * 60 * 1000)

    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`)
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...')
  await closeDatabase()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...')
  await closeDatabase()
  process.exit(0)
})

startServer()

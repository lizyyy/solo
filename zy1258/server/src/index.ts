import express from 'express'
import cors from 'cors'
import importRoutes from './routes/import'
import simulationRoutes from './routes/simulation'
import queryRoutes from './routes/query'
import prisma from './prisma'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.use('/api/import', importRoutes)
app.use('/api/simulate', simulationRoutes)
app.use('/api/query', queryRoutes)

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString()
    }
  })
})

app.listen(PORT, async () => {
  console.log(`CDN Cache Debugger Server running on port ${PORT}`)
  console.log(`API: http://localhost:${PORT}/api`)

  try {
    await prisma.$connect()
    console.log('Database connected successfully')
  } catch (error) {
    console.error('Database connection error:', error)
  }
})

process.on('SIGTERM', async () => {
  await prisma.$disconnect()
  process.exit(0)
})

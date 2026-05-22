import express from 'express'
import ledgerRoutes from './routes/ledgerRoutes'
import { errorHandler } from './middleware/errorHandler'

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

app.use('/api/ledgers', ledgerRoutes)

app.use(errorHandler)

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`冷链中转权限追责台账 API 服务启动成功`)
    console.log(`服务地址: http://localhost:${PORT}`)
    console.log(`健康检查: http://localhost:${PORT}/health`)
  })
}

export default app

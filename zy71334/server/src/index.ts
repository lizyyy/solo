import express from 'express'
import cors from 'cors'
import { initDatabase } from './db/index.js'
import { insertMockData } from './db/mockData.js'
import problemRoutes from './routes/problems.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

initDatabase()
insertMockData()

app.use('/api', problemRoutes)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`🚀 现场返听问题单服务已启动`)
  console.log(`📡 API 服务端口: ${PORT}`)
  console.log(`📁 数据库文件: server/data/monitor.db`)
  console.log(`📊 初始数据: 已加载 10 条示例问题`)
  console.log(`🔍 异常检测: 已启用 (通道校验/去重检测)`)
  console.log(``)
  console.log(`前端地址: http://localhost:5173`)
  console.log(`API 地址: http://localhost:${PORT}/api`)
  console.log(`健康检查: http://localhost:${PORT}/api/health`)
})

export default app

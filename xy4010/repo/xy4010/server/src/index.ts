import express from 'express'
import cors from 'cors'
import ticketRoutes from './routes/tickets.js'
import technicianRoutes from './routes/technicians.js'
import statisticsRoutes from './routes/statistics.js'

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001

const app = express()

app.use(cors())
app.use(express.json())

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api/tickets', ticketRoutes)
app.use('/api/technicians', technicianRoutes)
app.use('/api/statistics', statisticsRoutes)

app.listen(PORT, () => {
  console.log(`维修工单服务启动在 http://localhost:${PORT}`)
  console.log(`API 文档:
  - GET  /api/tickets          - 工单列表（支持筛选）
  - POST /api/tickets          - 创建工单
  - GET  /api/tickets/:id      - 获取单个工单
  - PUT  /api/tickets/:id      - 更新工单
  - POST /api/tickets/:id/transition - 状态流转
  - PUT  /api/tickets/:id/materials  - 更新材料
  - DELETE /api/tickets/:id    - 删除工单
  - GET  /api/technicians      - 维修师傅列表
  - POST /api/technicians      - 创建师傅
  - GET  /api/statistics       - 统计数据
`)
})

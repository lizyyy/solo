import express from 'express'
import promotionRoutes from './routes/promotion.routes'

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use('/api/promotions', promotionRoutes)

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack)
  res.status(500).json({ error: '服务器内部错误' })
})

app.listen(PORT, () => {
  console.log(`制品晋级审批API服务已启动，端口: ${PORT}`)
  console.log(`健康检查: http://localhost:${PORT}/health`)
  console.log(`API文档: http://localhost:${PORT}/api/promotions`)
})

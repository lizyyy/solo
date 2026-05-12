import express from 'express'
import cors from 'cors'
import routes from './routes'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.use('/api', routes)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: '羽毛球馆拼场系统运行正常' })
})

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`)
  console.log(`API 文档: http://localhost:${PORT}/api/health`)
})

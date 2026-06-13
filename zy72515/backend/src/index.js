const express = require('express')
const cors = require('cors')

const batchRoutes = require('./routes/batches')
const sampleRoutes = require('./routes/samples')
const dashboardRoutes = require('./routes/dashboard')

const app = express()
const PORT = 3002

app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true }))

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '智能排班建议解释系统运行中' })
})

app.use('/api/batches', batchRoutes)
app.use('/api/samples', sampleRoutes)
app.use('/api/dashboard', dashboardRoutes)

app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ success: false, error: '服务器内部错误' })
})

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`)
})

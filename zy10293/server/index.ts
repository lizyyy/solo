import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { initDatabase } from './database'
import routes from './routes'

const dataDir = path.join(__dirname, '../data')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

initDatabase()

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.use('/api', routes)

app.listen(PORT, () => {
  console.log(`茶叶拼配试饮台服务已启动: http://localhost:${PORT}`)
})

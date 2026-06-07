import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { initDb } from './db/init.js'
import breakpointsRoutes from './routes/breakpoints.js'
import importRoutes from './routes/import.js'
import historyRoutes from './routes/history.js'
import rulesRoutes from './routes/rules.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

const dataDir = path.join(__dirname, '../data')
import fs from 'fs'
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

initDb()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use('/api/breakpoints', breakpointsRoutes)
app.use('/api/import', importRoutes)
app.use('/api/history', historyRoutes)
app.use('/api/rules', rulesRoutes)

app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({
    success: false,
    error: {
      code: 'SERVER_ERROR',
      message: '服务器出了点小问题',
      suggestion: '请稍后重试，或联系系统管理员',
      details: error.message,
    },
  })
})

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'API_NOT_FOUND',
      message: '找不到这个接口',
      suggestion: '请检查接口地址是否正确',
    },
  })
})

export default app

import express, {
  type Request,
  type Response,
} from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import paramsRoutes from './routes/params.js'
import counterexamplesRoutes from './routes/counterexamples.js'
import conflictsRoutes from './routes/conflicts.js'
import checksRoutes from './routes/checks.js'
import demoRoutes from './routes/demo.js'
import workflowRoutes from './routes/workflow.js'

dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))

app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use('/api/params', paramsRoutes)
app.use('/api/counterexamples', counterexamplesRoutes)
app.use('/api/conflicts', conflictsRoutes)
app.use('/api/checks', checksRoutes)
app.use('/api/demo', demoRoutes)
app.use('/api/workflow', workflowRoutes)

app.use(
  '/api/health',
  (req: Request, res: Response): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

app.use((error: Error, _req: Request, res: Response): void => {
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

app.use((_req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app

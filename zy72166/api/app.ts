import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import db from './db.js'
import { v4 as uuidv4 } from 'uuid'
import { seedProject } from './seed.js'
import { runPrecheck } from './services/precheck.js'
import projectRoutes from './routes/projects.js'
import importRoutes from './routes/import.js'
import mergeRoutes from './routes/merge.js'
import reviewRoutes from './routes/review.js'
import exportRoutes from './routes/export.js'

dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use('/api/projects', projectRoutes)
app.use('/api/projects', importRoutes)
app.use('/api/projects', mergeRoutes)
app.use('/api/projects', reviewRoutes)
app.use('/api/projects', exportRoutes)

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
    error: 'Server internal error',
  })
})

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

function initializeSeedData(): void {
  try {
    const projects = db.prepare(`SELECT COUNT(*) as count FROM projects`).get() as any
    if (projects.count === 0) {
      const id = uuidv4()
      db.prepare(`
        INSERT INTO projects (id, name, status, created_at, updated_at)
        VALUES (?, '口袋公园日照复核示范项目', 'importing', datetime('now'), datetime('now'))
      `).run(id)
      seedProject(id)
      runPrecheck(id)
      console.log('Demo project seeded successfully')
    }
  } catch (error) {
    console.error('Failed to seed demo data:', (error as Error).message)
  }
}

initializeSeedData()

export default app

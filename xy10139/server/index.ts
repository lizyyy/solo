import express from 'express'
import cors from 'cors'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { initDatabase } from './database'
import { ImportService } from './services/importService'
import { reportService } from './services/reportService'
import { FileFormat } from '../shared/types'

const app = express()
const PORT = process.env.PORT || 3000

initDatabase()

app.use(cors())
app.use(express.json())

const uploadDir = path.join(process.cwd(), 'data', 'uploads')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const uniquePrefix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, `${uniquePrefix}-${file.originalname}`)
  }
})

const upload = multer({ storage })

let importService: ImportService | null = null

function getImportService(): ImportService {
  if (!importService) {
    importService = new ImportService()
    importService.initDefaultSchemas()
  }
  return importService
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.get('/api/schemas', (req, res) => {
  try {
    const service = getImportService()
    const schemas = service.getSchemas()
    res.json({ schemas })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/schemas/:id', (req, res) => {
  try {
    const service = getImportService()
    const schema = service.getSchema(req.params.id)
    if (!schema) {
      return res.status(404).json({ error: 'Schema not found' })
    }
    res.json({ schema })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/import', upload.single('file'), async (req, res) => {
  try {
    const { schemaId, format, options } = req.body
    const file = req.file

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    if (!schemaId) {
      return res.status(400).json({ error: 'schemaId is required' })
    }

    const fileFormat: FileFormat = (format || path.extname(file.originalname).slice(1).toLowerCase()) as FileFormat
    
    const service = getImportService()
    const result = await service.processImport({
      schemaId,
      filePath: file.path,
      format: fileFormat,
      fileName: file.originalname,
      options: options ? JSON.parse(options) : undefined
    })

    res.json({
      job: result.job,
      summary: result.summary
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/import/:jobId/retry', async (req, res) => {
  try {
    const { rowIds, overrideData } = req.body
    const service = getImportService()
    const result = await service.retryFailed(req.params.jobId, rowIds, overrideData)
    
    res.json({
      job: result.job,
      summary: result.summary
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/jobs', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50
    const offset = parseInt(req.query.offset as string) || 0
    
    const service = getImportService()
    const jobs = service.getJobs(limit, offset)
    
    res.json({ jobs })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/jobs/:id', (req, res) => {
  try {
    const service = getImportService()
    const result = service.getJobWithSummary(req.params.id)
    
    if (!result.job) {
      return res.status(404).json({ error: 'Job not found' })
    }
    
    res.json({
      job: result.job,
      summary: result.summary
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/jobs/:id/rows', (req, res) => {
  try {
    const service = getImportService()
    const status = req.query.status as string | undefined
    
    if (status === 'failed') {
      const rows = service.getFailedRows(req.params.id)
      return res.json({ rows })
    }
    if (status === 'success') {
      const rows = service.getSuccessRows(req.params.id)
      return res.json({ rows })
    }
    
    const rows = service.getAllRows(req.params.id)
    res.json({ rows })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/jobs/:id/report', async (req, res) => {
  try {
    const { format, options } = req.body
    const report = await reportService.generateReport(
      req.params.id,
      format || 'csv',
      options
    )
    
    res.json({ report })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/jobs/:id/reports', (req, res) => {
  try {
    const reports = reportService.getReportsByJob(req.params.id)
    res.json({ reports })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/reports/:id/download', (req, res) => {
  try {
    const report = reportService.getReport(req.params.id)
    if (!report) {
      return res.status(404).json({ error: 'Report not found' })
    }
    
    if (!fs.existsSync(report.filePath)) {
      return res.status(404).json({ error: 'Report file not found' })
    }
    
    res.download(report.filePath, path.basename(report.filePath))
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

app.listen(PORT, () => {
  console.log(`Import Validator Replayer Server running on port ${PORT}`)
  console.log(`API Base URL: http://localhost:${PORT}/api`)
})

import { Router, Request, Response } from 'express'
import multer from 'multer'
import { ImportService } from '../services/ImportService'
import prisma from '../prisma'

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })
const importService = new ImportService()

router.post('/manifest', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const content = req.file.buffer.toString('utf-8')
    const result = await importService.importManifest(content)

    res.json({
      success: true,
      data: {
        releaseBatch: {
          id: result.id,
          version: result.version,
          commitHash: result.commitHash,
          createdAt: result.createdAt,
          resourceCount: result.resources.length
        }
      }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/edge-logs', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const content = req.file.buffer.toString('utf-8')
    const releaseBatchId = req.body.releaseBatchId as string

    const hitChains = await importService.importEdgeLogs(content, releaseBatchId)

    res.json({
      success: true,
      data: {
        importedCount: hitChains.length,
        releaseBatchId: releaseBatchId
      }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/purge-events', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const content = req.file.buffer.toString('utf-8')
    const releaseBatchId = req.body.releaseBatchId as string

    const purgeEvents = await importService.importPurgeEvents(content, releaseBatchId)

    res.json({
      success: true,
      data: {
        importedCount: purgeEvents.length,
        releaseBatchId: releaseBatchId
      }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/detect-anomalies/:batchId', async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params
    const anomalies = await importService.detectAnomalyUsers(batchId)

    res.json({
      success: true,
      data: {
        detectedCount: anomalies.length,
        anomalies: anomalies.map(a => ({
          id: a.id,
          sessionId: a.sessionId,
          errorType: a.errorType,
          errorMessage: a.errorMessage,
          firstSeen: a.firstSeen,
          lastSeen: a.lastSeen
        }))
      }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router

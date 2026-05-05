import { Router, Request, Response } from 'express'
import { RiskDetectionService } from '../services/RiskDetectionService'
import { ReportService } from '../services/ReportService'
import prisma from '../prisma'
import { jsonStringify, jsonParse } from '../utils/json'
import { ReleaseBatch, AnomalyUser, PurgeEvent, DebugTask, Risk } from '@prisma/client'

function transformReleaseBatch(batch: ReleaseBatch & {
  resources?: any[]
  hitChains?: any[]
  anomalyUsers?: any[]
  purgeEvents?: any[]
}) {
  return {
    ...batch,
    manifest: jsonParse<any>(batch.manifest, null),
    anomalyUsers: batch.anomalyUsers?.map(transformAnomalyUser) || [],
    purgeEvents: batch.purgeEvents?.map(transformPurgeEvent) || []
  }
}

function transformAnomalyUser(user: AnomalyUser) {
  return {
    ...user,
    affectedUrls: jsonParse<string[]>(user.affectedUrls, [])
  }
}

function transformPurgeEvent(event: PurgeEvent) {
  return {
    ...event,
    urls: jsonParse<string[]>(event.urls, []),
    surrogateKeys: jsonParse<string[]>(event.surrogateKeys, []),
    edgeNodes: jsonParse<any[]>(event.edgeNodes, []),
    skippedNodes: jsonParse<string[]>(event.skippedNodes, [])
  }
}

function transformDebugTask(task: DebugTask & {
  risks?: Risk[]
  releaseBatches?: any[]
}) {
  return {
    ...task,
    config: jsonParse<any>(task.config, null),
    snapshot: jsonParse<any>(task.snapshot, null),
    risks: task.risks?.map(transformRisk) || [],
    releaseBatches: task.releaseBatches?.map(transformReleaseBatch) || []
  }
}

function transformRisk(risk: Risk) {
  return {
    ...risk,
    affectedUrls: jsonParse<string[]>(risk.affectedUrls, []),
    evidence: jsonParse<any>(risk.evidence, {})
  }
}

const router = Router()
const riskDetectionService = new RiskDetectionService()
const reportService = new ReportService()

router.get('/release-batches', async (req: Request, res: Response) => {
  try {
    const batches = await prisma.releaseBatch.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            resources: true,
            hitChains: true,
            anomalyUsers: true,
            purgeEvents: true
          }
        }
      }
    })

    res.json({
      success: true,
      data: batches.map(batch => ({
        id: batch.id,
        version: batch.version,
        commitHash: batch.commitHash,
        status: batch.status,
        createdAt: batch.createdAt,
        resourceCount: batch._count.resources,
        hitChainCount: batch._count.hitChains,
        anomalyUserCount: batch._count.anomalyUsers,
        purgeEventCount: batch._count.purgeEvents
      }))
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/release-batches/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const batch = await prisma.releaseBatch.findUnique({
      where: { id },
      include: {
        resources: true,
        hitChains: {
          take: 100,
          orderBy: { requestTime: 'desc' }
        },
        anomalyUsers: {
          take: 50,
          orderBy: { lastSeen: 'desc' }
        },
        purgeEvents: {
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    if (!batch) {
      return res.status(404).json({ success: false, error: 'Release batch not found' })
    }

    res.json({
      success: true,
      data: transformReleaseBatch(batch as any)
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/debug-tasks', async (req: Request, res: Response) => {
  try {
    const tasks = await prisma.debugTask.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            risks: true,
            hitChains: true,
            anomalyUsers: true
          }
        }
      }
    })

    res.json({
      success: true,
      data: tasks.map(task => ({
        id: task.id,
        name: task.name,
        type: task.type,
        status: task.status,
        createdAt: task.createdAt,
        completedAt: task.completedAt,
        riskCount: task._count.risks,
        hitChainCount: task._count.hitChains,
        anomalyUserCount: task._count.anomalyUsers
      }))
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/debug-tasks/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const task = await prisma.debugTask.findUnique({
      where: { id },
      include: {
        risks: {
          orderBy: [
            { severity: 'desc' },
            { createdAt: 'desc' }
          ]
        },
        releaseBatches: {
          include: {
            resources: true
          }
        }
      }
    })

    if (!task) {
      return res.status(404).json({ success: false, error: 'Debug task not found' })
    }

    res.json({
      success: true,
      data: transformDebugTask(task as any)
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/detect-risks/:batchId', async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params

    const task = await prisma.debugTask.create({
      data: {
        name: `风险检测 - 版本 ${batchId.slice(0, 8)}`,
        type: 'risk_detection',
        status: 'running',
        config: jsonStringify({ batchId }),
        startedAt: new Date()
      }
    })

    const risks = await riskDetectionService.detectAllRisks(batchId)

    await riskDetectionService.saveRisks(task.id, risks)

    const conclusion = await reportService.generateConclusion(risks as any)

    const updatedTask = await prisma.debugTask.update({
      where: { id: task.id },
      data: {
        status: 'completed',
        snapshot: jsonStringify({
          riskCount: risks.length,
          bySeverity: {
            critical: risks.filter(r => r.severity === 'critical').length,
            high: risks.filter(r => r.severity === 'high').length,
            medium: risks.filter(r => r.severity === 'medium').length,
            low: risks.filter(r => r.severity === 'low').length
          }
        }),
        conclusion: conclusion,
        completedAt: new Date()
      },
      include: { risks: true }
    })

    res.json({
      success: true,
      data: {
        taskId: task.id,
        riskCount: risks.length,
        risks: risks,
        conclusion: conclusion
      }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/report/:id/markdown', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const markdown = await reportService.exportMarkdown(id)

    res.setHeader('Content-Type', 'text/markdown')
    res.setHeader('Content-Disposition', `attachment; filename="report-${id}.md"`)
    res.send(markdown)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/report/:id/json', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const json = await reportService.exportJson(id)

    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="report-${id}.json"`)
    res.send(json)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/statistics', async (req: Request, res: Response) => {
  try {
    const [batchCount, hitChainCount, anomalyCount, taskCount, riskCount] = await Promise.all([
      prisma.releaseBatch.count(),
      prisma.hitChain.count(),
      prisma.anomalyUser.count(),
      prisma.debugTask.count(),
      prisma.risk.count()
    ])

    const recentRisks = await prisma.risk.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        debugTask: {
          select: { id: true, name: true }
        }
      }
    })

    res.json({
      success: true,
      data: {
        summary: {
          releaseBatches: batchCount,
          hitChains: hitChainCount,
          anomalyUsers: anomalyCount,
          debugTasks: taskCount,
          risks: riskCount
        },
        recentRisks: recentRisks.map(r => transformRisk(r as any))
      }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router

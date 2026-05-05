import { Router, Request, Response } from 'express'
import { SimulationService } from '../services/SimulationService'
import prisma from '../prisma'
import { RiskDetectionService } from '../services/RiskDetectionService'
import { ReportService } from '../services/ReportService'
import { jsonStringify } from '../utils/json'

const router = Router()
const simulationService = new SimulationService()
const riskDetectionService = new RiskDetectionService()
const reportService = new ReportService()

router.post('/canary', async (req: Request, res: Response) => {
  try {
    const { oldBatchId, newBatchId, parameters } = req.body

    const task = await prisma.debugTask.create({
      data: {
        name: `灰度发布模拟 - ${parameters.canaryPercentage}%`,
        type: 'canary',
        status: 'running',
        config: jsonStringify({ oldBatchId, newBatchId, parameters }),
        startedAt: new Date()
      }
    })

    const { hitChains, risks } = await simulationService.simulateCanaryRelease(
      oldBatchId,
      newBatchId,
      parameters
    )

    await riskDetectionService.saveRisks(task.id, risks)

    const conclusion = await reportService.generateConclusion(risks as any)

    const updatedTask = await prisma.debugTask.update({
      where: { id: task.id },
      data: {
        status: 'completed',
        snapshot: jsonStringify({
          hitChainCount: hitChains.length,
          riskCount: risks.length
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
        hitChainCount: hitChains.length,
        riskCount: risks.length,
        risks: risks.slice(0, 10),
        conclusion: conclusion
      }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/rollback', async (req: Request, res: Response) => {
  try {
    const { newBatchId, oldBatchId, parameters } = req.body

    const task = await prisma.debugTask.create({
      data: {
        name: `回滚模拟 - ${parameters.rollbackTime}`,
        type: 'rollback',
        status: 'running',
        config: jsonStringify({ newBatchId, oldBatchId, parameters }),
        startedAt: new Date()
      }
    })

    const { hitChains, risks } = await simulationService.simulateRollback(
      newBatchId,
      oldBatchId,
      parameters
    )

    await riskDetectionService.saveRisks(task.id, risks)

    const conclusion = await reportService.generateConclusion(risks as any)

    await prisma.debugTask.update({
      where: { id: task.id },
      data: {
        status: 'completed',
        snapshot: jsonStringify({
          hitChainCount: hitChains.length,
          riskCount: risks.length
        }),
        conclusion: conclusion,
        completedAt: new Date()
      }
    })

    res.json({
      success: true,
      data: {
        taskId: task.id,
        hitChainCount: hitChains.length,
        riskCount: risks.length,
        risks: risks.slice(0, 10),
        conclusion: conclusion
      }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/sw-residue', async (req: Request, res: Response) => {
  try {
    const { oldBatchId, newBatchId, parameters } = req.body

    const task = await prisma.debugTask.create({
      data: {
        name: `SW缓存残留模拟 - v${parameters.swVersion}`,
        type: 'sw_residue',
        status: 'running',
        config: jsonStringify({ oldBatchId, newBatchId, parameters }),
        startedAt: new Date()
      }
    })

    const { hitChains, risks } = await simulationService.simulateSWResidue(
      oldBatchId,
      newBatchId,
      parameters
    )

    await riskDetectionService.saveRisks(task.id, risks)

    const conclusion = await reportService.generateConclusion(risks as any)

    await prisma.debugTask.update({
      where: { id: task.id },
      data: {
        status: 'completed',
        snapshot: jsonStringify({
          hitChainCount: hitChains.length,
          riskCount: risks.length
        }),
        conclusion: conclusion,
        completedAt: new Date()
      }
    })

    res.json({
      success: true,
      data: {
        taskId: task.id,
        hitChainCount: hitChains.length,
        riskCount: risks.length,
        risks: risks.slice(0, 10),
        conclusion: conclusion
      }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/purge-miss', async (req: Request, res: Response) => {
  try {
    const { batchId, parameters } = req.body

    const task = await prisma.debugTask.create({
      data: {
        name: `Purge漏节点模拟`,
        type: 'purge_miss',
        status: 'running',
        config: jsonStringify({ batchId, parameters }),
        startedAt: new Date()
      }
    })

    const { hitChains, risks } = await simulationService.simulatePurgeMiss(
      batchId,
      parameters
    )

    await riskDetectionService.saveRisks(task.id, risks)

    const conclusion = await reportService.generateConclusion(risks as any)

    await prisma.debugTask.update({
      where: { id: task.id },
      data: {
        status: 'completed',
        snapshot: jsonStringify({
          hitChainCount: hitChains.length,
          riskCount: risks.length
        }),
        conclusion: conclusion,
        completedAt: new Date()
      }
    })

    res.json({
      success: true,
      data: {
        taskId: task.id,
        hitChainCount: hitChains.length,
        riskCount: risks.length,
        risks: risks.slice(0, 10),
        conclusion: conclusion
      }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router

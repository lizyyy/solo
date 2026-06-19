import { Router, type Request, type Response } from 'express'
import type { PointCloudLog, SafetyRadius } from '../../shared/types.js'
import { state, buildSafetyReport } from '../store.js'

const router = Router()

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const report = buildSafetyReport(state.logs, state.radiusTable)
  res.status(200).json({ success: true, data: report })
})

router.post('/generate', async (req: Request, res: Response): Promise<void> => {
  const { logs, radiusTable } = req.body
  const report = buildSafetyReport(
    logs && Array.isArray(logs) ? logs as PointCloudLog[] : state.logs,
    radiusTable && Array.isArray(radiusTable) ? radiusTable as SafetyRadius[] : state.radiusTable
  )

  res.status(201).json({
    success: true,
    data: report,
    message: '安全距离报告已生成'
  })
})

router.post('/review', async (req: Request, res: Response): Promise<void> => {
  const { logId, action, reviewedBy, comment } = req.body
  const logIndex = state.logs.findIndex(l => l.id === logId)

  if (logIndex === -1) {
    res.status(404).json({ success: false, error: '日志不存在' })
    return
  }

  if (action === 'approve') {
    state.logs[logIndex] = { ...state.logs[logIndex], status: 'success' }
    state.logs[logIndex].notes = `${state.logs[logIndex].notes || ''} | 施工经理${reviewedBy}复核通过`
  } else if (action === 'reject') {
    state.logs[logIndex] = { ...state.logs[logIndex], status: 'blocked' }
    state.logs[logIndex].notes = `${state.logs[logIndex].notes || ''} | 施工经理${reviewedBy}驳回，原因：${comment || '未说明'}`
  }

  const report = buildSafetyReport(state.logs, state.radiusTable)

  res.status(200).json({
    success: true,
    data: { log: state.logs[logIndex], report },
    message: action === 'approve' ? '已通过复核，报告已更新' : '已驳回，报告已更新'
  })
})

router.get('/export', async (req: Request, res: Response): Promise<void> => {
  const report = buildSafetyReport(state.logs, state.radiusTable)

  const csvContent = [
    ['批次号', '状态', '风向(度)', '风速', '实测距离(m)', '要求距离(m)', '差值(m)', '合规性', '口径版本', '备注'].join(','),
    ...(report.items || []).map(item => [
      item.batchNo,
      item.status,
      item.windDirection,
      item.windSpeed,
      item.measuredDistance,
      item.requiredDistance,
      item.diff,
      item.compliance,
      item.version,
      `"${item.notes}"`
    ].join(','))
  ].join('\n')

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="safety-report-${Date.now()}.csv"`)
  res.status(200).send('\ufeff' + csvContent)
})

export default router

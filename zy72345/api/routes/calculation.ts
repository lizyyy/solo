import { Router, type Request, type Response } from 'express'
import db from '../db.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  try {
    const results = db.prepare(`
      SELECT car.*, sr.original_value, sr.is_negative, sr.old_table_status, sr.is_boundary as record_is_boundary, sr.boundary_status,
             sl.name as list_name, sl.id as list_id,
             car.traceable_id, car.batch_id,
             bs.corrected_value, bs.process_reason, bs.confirmed_by,
             pe.key as source_param_key, pe.value as source_param_value
      FROM cost_allocation_results car
      JOIN sampling_records sr ON car.record_id = sr.id
      JOIN sampling_lists sl ON car.source_list_id = sl.id
      LEFT JOIN boundary_samples bs ON bs.record_id = sr.id
      LEFT JOIN param_entries pe ON pe.id = car.source_param_id
      ORDER BY car.id
    `).all() as Record<string, any>[]

    const totalSamples = results.length
    const totalCost = results.reduce((sum, r) => sum + r.allocated_cost, 0)
    const boundaryCount = results.filter(r => r.is_boundary === 1).length
    const pendingCount = results.filter(r => r.is_boundary === 1 && r.boundary_status === 'pending').length
    const confirmedCount = results.filter(r => r.boundary_status === 'confirmed').length
    const ignoredCount = results.filter(r => r.boundary_status === 'ignored').length

    const batchIds = new Set(results.map(r => r.batch_id).filter(Boolean))
    const batchCount = batchIds.size
    const needReviewCount = pendingCount

    res.json({
      success: true,
      data: {
        results,
        summary: {
          totalSamples,
          totalCost: Math.round(totalCost * 100) / 100,
          boundaryCount,
          pendingCount,
          confirmedCount,
          ignoredCount,
          batchCount,
          needReviewCount
        }
      }
    })
  } catch (error) {
    console.error('查询成本分摊结果失败:', error)
    res.status(500).json({ success: false, error: '查询成本分摊结果失败' })
  }
})

router.get('/export', (req: Request, res: Response): void => {
  try {
    const rows = db.prepare(`
      SELECT car.traceable_id,
             sr.original_value,
             car.allocated_cost,
             car.is_boundary,
             car.boundary_type,
             sr.boundary_status,
             bs.corrected_value,
             bs.process_reason,
             bs.confirmed_by,
             sl.name as list_name,
             car.batch_id,
             pe.key as source_param_key,
             pe.value as source_param_value
      FROM cost_allocation_results car
      JOIN sampling_records sr ON car.record_id = sr.id
      JOIN sampling_lists sl ON car.source_list_id = sl.id
      LEFT JOIN boundary_samples bs ON bs.record_id = sr.id
      LEFT JOIN param_entries pe ON pe.id = car.source_param_id
      ORDER BY car.id
    `).all() as any[]

    const headers = ['traceable_id', 'original_value', 'allocated_cost', 'is_boundary', 'boundary_type', 'boundary_status', 'corrected_value', 'process_reason', 'confirmed_by', 'list_name', 'batch_id', 'source_param_key', 'source_param_value']

    const csvLines = [headers.join(',')]
    for (const row of rows) {
      const line = headers.map(h => {
        const val = row[h] ?? ''
        const str = String(val)
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return '"' + str.replace(/"/g, '""') + '"'
        }
        return str
      }).join(',')
      csvLines.push(line)
    }

    const csvContent = '\ufeff' + csvLines.join('\r\n')
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `计算明细_${timestamp}.csv`

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`)
    res.send(csvContent)
  } catch (error) {
    console.error('导出失败:', error)
    res.status(500).json({ success: false, error: '导出失败' })
  }
})

router.get('/:id/trace', (req: Request, res: Response): void => {
  try {
    const { id } = req.params

    const result = db.prepare('SELECT * FROM cost_allocation_results WHERE id = ?').get(id) as Record<string, any> | undefined
    if (!result) {
      res.status(404).json({ success: false, error: '成本分摊结果不存在' })
      return
    }

    const record = db.prepare('SELECT * FROM sampling_records WHERE id = ?').get(result.record_id)
    const list = db.prepare('SELECT * FROM sampling_lists WHERE id = ?').get(result.source_list_id)

    let params: unknown[] = []
    if (result.source_param_id) {
      const param = db.prepare('SELECT * FROM param_entries WHERE id = ?').get(result.source_param_id)
      if (param) params = [param]
    } else {
      params = db.prepare('SELECT * FROM param_entries').all()
    }

    res.json({
      success: true,
      data: { result, record, list, params }
    })
  } catch (error) {
    console.error('溯源查询失败:', error)
    res.status(500).json({ success: false, error: '成本溯源查询失败' })
  }
})

export default router

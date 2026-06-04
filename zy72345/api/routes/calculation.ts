import { Router, type Request, type Response } from 'express'
import db from '../db.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  try {
    const results = db.prepare(`
      SELECT car.*, sr.original_value, sr.is_negative, sr.old_table_status, sr.is_boundary as record_is_boundary, sr.boundary_status,
             sl.name as list_name, sl.id as list_id
      FROM cost_allocation_results car
      JOIN sampling_records sr ON car.record_id = sr.id
      JOIN sampling_lists sl ON car.source_list_id = sl.id
      ORDER BY car.id
    `).all() as Record<string, any>[]

    const totalSamples = results.length
    const totalCost = results.reduce((sum, r) => sum + r.allocated_cost, 0)
    const boundaryCount = results.filter(r => r.is_boundary === 1).length
    const pendingCount = results.filter(r => r.is_boundary === 1 && r.boundary_status === 'pending').length
    const confirmedCount = results.filter(r => r.boundary_status === 'confirmed').length
    const ignoredCount = results.filter(r => r.boundary_status === 'ignored').length

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
          ignoredCount
        }
      }
    })
  } catch (error) {
    console.error('查询成本分摊结果失败:', error)
    res.status(500).json({ success: false, error: '查询成本分摊结果失败' })
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

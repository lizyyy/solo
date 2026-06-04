import { Router, type Request, type Response } from 'express'
import multer from 'multer'
import crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })

router.post('/import', upload.single('file'), (req: Request, res: Response): void => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: '请上传CSV文件' })
      return
    }

    const content = req.file.buffer.toString('utf-8')
    const lines = content.split(/\r?\n/).filter(line => line.trim() !== '')

    if (lines.length === 0) {
      res.status(400).json({ success: false, error: 'CSV文件内容为空' })
      return
    }

    const dataLines = lines[0].toLowerCase().includes('value') ? lines.slice(1) : lines

    const sortedContent = [...dataLines].sort().join('\n')
    const fingerprint = crypto.createHash('sha256').update(sortedContent).digest('hex')

    const existing = db.prepare('SELECT id FROM sampling_lists WHERE fingerprint = ?').get(fingerprint) as { id: string } | undefined

    if (existing) {
      res.json({
        success: true,
        message: '这份抽样名单已经导入过了，不会重复计算数量',
        data: { listId: existing.id, skipped: true }
      })
      return
    }

    const listId = uuidv4()
    const listName = req.body.name || req.file.originalname.replace(/\.csv$/i, '')
    const operator = req.body.operator || 'system'
    const operatorRole = req.body.operatorRole || 'system'

    const records: { value: number; oldTableStatus: string; remark: string }[] = []
    for (const line of dataLines) {
      const parts = line.split(',').map(p => p.trim())
      const value = parseFloat(parts[0])
      if (isNaN(value)) continue
      const oldTableStatus = parts[1] || 'normal'
      const remark = parts.slice(2).join(',').replace(/^"|"$/g, '') || ''
      records.push({ value, oldTableStatus, remark })
    }

    const recordCount = records.length
    if (recordCount === 0) {
      res.status(400).json({ success: false, error: 'CSV文件中没有有效数据' })
      return
    }

    const insertList = db.prepare('INSERT INTO sampling_lists (id, name, fingerprint, record_count) VALUES (?, ?, ?, ?)')
    const insertRecord = db.prepare('INSERT INTO sampling_records (id, list_id, original_value, is_negative, old_table_status, is_boundary, boundary_status, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    const insertBoundary = db.prepare('INSERT INTO boundary_samples (id, record_id, type, status, description) VALUES (?, ?, ?, ?, ?)')
    const insertChangeLog = db.prepare('INSERT INTO change_log (id, entity_type, entity_id, action, field, old_value, new_value, operator, operator_role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    const insertResult = db.prepare('INSERT INTO cost_allocation_results (id, record_id, allocated_cost, is_boundary, boundary_type, source_list_id, source_param_id) VALUES (?, ?, ?, ?, ?, ?, ?)')

    const totalRecordsRow = db.prepare("SELECT COALESCE(SUM(record_count), 0) as total FROM sampling_lists WHERE status = 'active'").get() as { total: number }
    const totalRecords = totalRecordsRow.total + recordCount

    const params = db.prepare('SELECT id, key, value FROM param_entries').all() as { id: string; key: string; value: number }[]
    const paramMap: Record<string, { id: string; value: number }> = {}
    for (const p of params) {
      paramMap[p.key] = { id: p.id, value: p.value }
    }

    const unitCost = paramMap['unit_cost']?.value ?? 100
    const allocationRatio = paramMap['allocation_ratio']?.value ?? 1
    const sourceParamId = paramMap['unit_cost']?.id ?? null
    const allocatedCostPerRecord = unitCost * allocationRatio / totalRecords

    const transaction = db.transaction(() => {
      insertList.run(listId, listName, fingerprint, recordCount)

      let boundaryCount = 0

      for (const record of records) {
        const recordId = uuidv4()
        const isNegative = record.value < 0 ? 1 : 0
        let isBoundary = 0
        let boundaryStatus = 'pending'
        let boundaryType: string | null = null

        if (record.value < 0 && record.oldTableStatus === 'missing') {
          isBoundary = 1
          boundaryStatus = 'pending'
          boundaryType = 'BR-001'
          boundaryCount++
        }

        insertRecord.run(recordId, listId, record.value, isNegative, record.oldTableStatus, isBoundary, boundaryStatus, record.remark)

        if (isBoundary) {
          const boundaryId = uuidv4()
          insertBoundary.run(boundaryId, recordId, boundaryType!, 'pending', '发现负数样本被旧表标记为缺失')
          insertChangeLog.run(uuidv4(), 'sampling_record', recordId, 'boundary_detected', 'is_boundary', '0', '1', operator, operatorRole)
        }

        insertResult.run(uuidv4(), recordId, allocatedCostPerRecord, isBoundary, boundaryType, listId, sourceParamId)
      }

      insertChangeLog.run(uuidv4(), 'sampling_list', listId, 'import', 'record_count', '0', String(recordCount), operator, operatorRole)

      return { boundaryCount }
    })

    const result = transaction()

    res.json({
      success: true,
      data: {
        listId,
        name: listName,
        recordCount,
        boundaryCount: result.boundaryCount,
        fingerprint,
        allocatedCostPerRecord: Math.round(allocatedCostPerRecord * 100) / 100
      }
    })
  } catch (error) {
    console.error('导入失败:', error)
    res.status(500).json({ success: false, error: '导入抽样名单失败' })
  }
})

router.get('/', (req: Request, res: Response): void => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const pageSize = parseInt(req.query.pageSize as string) || 10
    const offset = (page - 1) * pageSize

    const total = db.prepare('SELECT COUNT(*) as count FROM sampling_lists').get() as { count: number }
    const lists = db.prepare('SELECT * FROM sampling_lists ORDER BY import_time DESC LIMIT ? OFFSET ?').all(pageSize, offset)

    res.json({
      success: true,
      data: {
        items: lists,
        total: total.count,
        page,
        pageSize
      }
    })
  } catch (error) {
    console.error('查询失败:', error)
    res.status(500).json({ success: false, error: '查询抽样名单失败' })
  }
})

router.get('/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params

    const list = db.prepare('SELECT * FROM sampling_lists WHERE id = ?').get(id)
    if (!list) {
      res.status(404).json({ success: false, error: '抽样名单不存在' })
      return
    }

    const records = db.prepare('SELECT * FROM sampling_records WHERE list_id = ?').all(id)
    const params = db.prepare('SELECT * FROM param_entries').all()

    res.json({
      success: true,
      data: { list, records, params }
    })
  } catch (error) {
    console.error('查询详情失败:', error)
    res.status(500).json({ success: false, error: '查询抽样名单详情失败' })
  }
})

export default router

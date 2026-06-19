import { Router, type Request, type Response } from 'express'
import multer from 'multer'
import crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'

interface SamplingListRow {
  id: string
  name: string
  fingerprint: string
  record_count: number
  import_time: string
  status: string
}

interface BatchImportRow {
  id: string
  import_time: string
  operator: string
  is_duplicate: number
  name: string
}

interface SamplingRecordRow {
  id: string
  remark: string
}

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
    const operator = req.body.operator || 'system'
    const operatorRole = req.body.operatorRole || 'system'
    const listName = req.body.name || req.file.originalname.replace(/\.csv$/i, '')
    const batchId = uuidv4()

    const existingBatches = db.prepare(
      'SELECT id, import_time, operator, name FROM batch_imports WHERE fingerprint = ? ORDER BY import_time DESC LIMIT 3'
    ).all(fingerprint) as Array<{ id: string; import_time: string; operator: string; name: string }>

    const duplicateCount = existingBatches.length + 1

    if (existing) {
      db.prepare(
        'INSERT INTO batch_imports (id, fingerprint, list_id, name, is_duplicate, operator, operator_role, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(batchId, fingerprint, existing.id, listName, 1, operator, operatorRole, '重复导入，未创建新名单')

      res.json({
        success: true,
        message: '这份抽样名单已经导入过了，不会重复计算数量',
        data: {
          listId: existing.id,
          skipped: true,
          batchId,
          originalListId: existing.id,
          duplicateImportCount: duplicateCount,
          historyBatches: existingBatches.map((b) => ({
            batchId: b.id,
            importTime: b.import_time,
            operator: b.operator,
            name: b.name
          }))
        }
      })
      return
    }

    const listId = uuidv4()

    const records: Array<{ value: number; oldTableStatus: string; remark: string }> = []
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
    const insertRecord = db.prepare('INSERT INTO sampling_records (id, list_id, original_value, is_negative, old_table_status, is_boundary, boundary_status, remark, batch_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    const insertBoundary = db.prepare('INSERT INTO boundary_samples (id, record_id, type, status, description, original_value) VALUES (?, ?, ?, ?, ?, ?)')
    const insertChangeLog = db.prepare('INSERT INTO change_log (id, entity_type, entity_id, action, field, old_value, new_value, operator, operator_role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    const insertResult = db.prepare('INSERT INTO cost_allocation_results (id, record_id, allocated_cost, is_boundary, boundary_type, source_list_id, source_param_id, batch_id, traceable_id, boundary_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    const insertBatch = db.prepare('INSERT INTO batch_imports (id, fingerprint, list_id, name, is_duplicate, operator, operator_role) VALUES (?, ?, ?, ?, ?, ?, ?)')

    const totalRecordsRow = db.prepare("SELECT COALESCE(SUM(record_count), 0) as total FROM sampling_lists WHERE status = 'active'").get() as { total: number }
    const totalRecords = totalRecordsRow.total + recordCount

    const params = db.prepare('SELECT id, key, value FROM param_entries').all() as Array<{ id: string; key: string; value: number }>
    const paramMap: Record<string, { id: string; value: number }> = {}
    for (const p of params) {
      paramMap[p.key] = { id: p.id, value: p.value }
    }

    const unitCost = paramMap['unit_cost']?.value ?? 100
    const allocationRatio = paramMap['allocation_ratio']?.value ?? 1
    const sourceParamId = paramMap['unit_cost']?.id ?? null
    const allocatedCostPerRecord = unitCost * allocationRatio / totalRecords

    const transaction = db.transaction((): { boundaryCount: number } => {
      insertBatch.run(batchId, fingerprint, listId, listName, 0, operator, operatorRole)
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

        insertRecord.run(recordId, listId, record.value, isNegative, record.oldTableStatus, isBoundary, boundaryStatus, record.remark, batchId)

        if (isBoundary) {
          const boundaryId = uuidv4()
          insertBoundary.run(boundaryId, recordId, boundaryType, 'pending', '发现负数样本被旧表标记为缺失', record.value)
          insertChangeLog.run(uuidv4(), 'sampling_record', recordId, 'boundary_detected', 'is_boundary', '0', '1', operator, operatorRole)
        }

        insertResult.run(uuidv4(), recordId, allocatedCostPerRecord, isBoundary, boundaryType, listId, sourceParamId, batchId, recordId, boundaryStatus)
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
        allocatedCostPerRecord: Math.round(allocatedCostPerRecord * 100) / 100,
        batchId,
        originalListId: listId,
        duplicateImportCount: 1,
        historyBatches: []
      }
    })
  } catch (error) {
    console.error('导入失败:', error)
    res.status(500).json({ success: false, error: '导入抽样名单失败' })
  }
})

router.put('/records/:recordId/remark', (req: Request, res: Response): void => {
  try {
    const { recordId } = req.params
    const { remark, operator, operatorRole } = req.body

    if (remark === undefined || remark === null) {
      res.status(400).json({ success: false, error: '缺少备注参数' })
      return
    }

    const record = db.prepare('SELECT remark FROM sampling_records WHERE id = ?').get(recordId) as { remark: string } | undefined
    if (!record) {
      res.status(404).json({ success: false, error: '抽样记录不存在' })
      return
    }

    const oldRemark = record.remark
    const newRemark = String(remark)
    const changeBy = operator || 'system'
    const changeRole = operatorRole || 'system'

    const transaction = db.transaction((): void => {
      db.prepare('UPDATE sampling_records SET remark = ? WHERE id = ?').run(newRemark, recordId)

      db.prepare(
        'INSERT INTO record_remark_history (id, record_id, old_remark, new_remark, changed_by) VALUES (?, ?, ?, ?, ?)'
      ).run(uuidv4(), recordId, oldRemark, newRemark, changeBy)

      db.prepare(
        'INSERT INTO change_log (id, entity_type, entity_id, action, field, old_value, new_value, operator, operator_role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(uuidv4(), 'sampling_record', recordId, 'update_remark', 'remark', oldRemark, newRemark, changeBy, changeRole)
    })

    transaction()

    const updated = db.prepare('SELECT * FROM sampling_records WHERE id = ?').get(recordId) as SamplingRecordRow
    res.json({ success: true, data: updated })
  } catch (error) {
    console.error('修改备注失败:', error)
    res.status(500).json({ success: false, error: '修改备注失败' })
  }
})

router.get('/export/csv', (req: Request, res: Response): void => {
  try {
    const { listId } = req.query
    if (!listId) {
      res.status(400).json({ success: false, error: '缺少 listId 参数' })
      return
    }

    const list = db.prepare('SELECT name, import_time FROM sampling_lists WHERE id = ?').get(listId as string) as { name: string; import_time: string } | undefined
    if (!list) {
      res.status(404).json({ success: false, error: '抽样名单不存在' })
      return
    }

    const rows = db.prepare(`
      SELECT sr.id as traceable_id, sr.original_value, sr.is_negative, sr.old_table_status,
             sr.is_boundary, sr.boundary_status, sr.remark, sr.batch_id,
             bi.import_time, sl.name as list_name
      FROM sampling_records sr
      JOIN sampling_lists sl ON sr.list_id = sl.id
      LEFT JOIN batch_imports bi ON sr.batch_id = bi.id
      WHERE sr.list_id = ?
    `).all(listId as string) as Record<string, unknown>[]

    const headers = ['traceable_id', 'original_value', 'is_negative', 'old_table_status', 'is_boundary', 'boundary_status', 'remark', 'batch_id', 'import_time', 'list_name']

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
    const fileName = `抽样名单_${list.name}_${timestamp}.csv`

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`)
    res.send(csvContent)
  } catch (error) {
    console.error('导出失败:', error)
    res.status(500).json({ success: false, error: '导出失败' })
  }
})

router.get('/', (req: Request, res: Response): void => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const pageSize = parseInt(req.query.pageSize as string) || 10
    const offset = (page - 1) * pageSize

    const total = db.prepare('SELECT COUNT(*) as count FROM sampling_lists').get() as { count: number }
    const rawLists = db.prepare('SELECT * FROM sampling_lists ORDER BY import_time DESC LIMIT ? OFFSET ?').all(pageSize, offset) as SamplingListRow[]

    const lists = rawLists.map((list) => {
      const batches = db.prepare(
        'SELECT id, import_time, operator, is_duplicate FROM batch_imports WHERE fingerprint = ? ORDER BY import_time DESC'
      ).all(list.fingerprint) as BatchImportRow[]
      const lastBatch = batches[0]
      const hasDuplicate = batches.some((b) => b.is_duplicate === 1)
      return {
        ...list,
        lastBatchId: lastBatch?.id,
        lastImportTime: lastBatch?.import_time || list.import_time,
        hasDuplicateImport: hasDuplicate,
        importCount: batches.length
      }
    })

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

    const list = db.prepare('SELECT * FROM sampling_lists WHERE id = ?').get(id) as SamplingListRow | undefined
    if (!list) {
      res.status(404).json({ success: false, error: '抽样名单不存在' })
      return
    }

    const records = db.prepare('SELECT * FROM sampling_records WHERE list_id = ?').all(id)
    const params = db.prepare('SELECT * FROM param_entries').all()

    const batches = db.prepare(
      'SELECT id, import_time, operator, is_duplicate, name FROM batch_imports WHERE fingerprint = ? ORDER BY import_time DESC'
    ).all(list.fingerprint) as BatchImportRow[]

    res.json({
      success: true,
      data: { list, records, params, batches }
    })
  } catch (error) {
    console.error('查询详情失败:', error)
    res.status(500).json({ success: false, error: '查询抽样名单详情失败' })
  }
})

export default router

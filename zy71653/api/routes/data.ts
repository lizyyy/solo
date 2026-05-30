import { Router, type Request, type Response } from 'express'
import db from '../db.js'
import { v4 as uuidv4 } from 'uuid'

const router = Router()

interface ImportRecord {
  [key: string]: any
}

interface ImportWarning {
  field: string
  message: string
  index: number
}

interface ImportError {
  field: string
  message: string
  index: number
}

function validateRecords(dataType: string, records: ImportRecord[]): { warnings: ImportWarning[]; errors: ImportError[] } {
  const warnings: ImportWarning[] = []
  const errors: ImportError[] = []

  records.forEach((record, index) => {
    if (dataType === 'channels') {
      if (!record.name) errors.push({ field: 'name', message: '渠道名称为必填项', index })
      if (!record.platform) errors.push({ field: 'platform', message: '平台为必填项', index })
      if (record.conversion_rate !== undefined && (record.conversion_rate < 0 || record.conversion_rate > 1)) {
        warnings.push({ field: 'conversion_rate', message: '转化率应在0-1之间', index })
      }
      if (record.fatigue_score !== undefined && (record.fatigue_score < 0 || record.fatigue_score > 1)) {
        warnings.push({ field: 'fatigue_score', message: '疲劳度应在0-1之间', index })
      }
    }

    if (dataType === 'conversions') {
      if (!record.channel_id) errors.push({ field: 'channel_id', message: '渠道ID为必填项', index })
      if (!record.conversion_date) errors.push({ field: 'conversion_date', message: '转化日期为必填项', index })
      if (record.conversion_date && !/^\d{4}-\d{2}-\d{2}/.test(record.conversion_date)) {
        errors.push({ field: 'conversion_date', message: '日期格式不一致，应为YYYY-MM-DD', index })
      }
      if (record.delay_hours && record.delay_hours > 48) {
        warnings.push({ field: 'delay_hours', message: `延迟${record.delay_hours}小时，属于滞后附件数据`, index })
      }
    }

    for (const key of Object.keys(record)) {
      if (record[key] === null || record[key] === undefined || record[key] === '') {
        warnings.push({ field: key, message: `字段${key}值为空`, index })
      }
    }
  })

  if (dataType === 'channels') {
    const names = records.map(r => r.name).filter(Boolean)
    const duplicateNames = names.filter((name, i) => names.indexOf(name) !== i)
    if (duplicateNames.length > 0) {
      warnings.push({
        field: 'name',
        message: `发现重复渠道名称: ${[...new Set(duplicateNames)].join(', ')}`,
        index: -1,
      })
    }
  }

  return { warnings, errors }
}

function importChannels(records: ImportRecord[]): number {
  const insert = db.prepare(`
    INSERT INTO channels (id, name, platform, conversion_rate, fatigue_score, spend_velocity, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const now = new Date().toISOString()
  const transaction = db.transaction(() => {
    let count = 0
    for (const record of records) {
      insert.run(
        uuidv4(),
        record.name,
        record.platform,
        record.conversion_rate || 0,
        record.fatigue_score || 0,
        record.spend_velocity || 0,
        record.status || 'active',
        now,
        now
      )
      count++
    }
    return count
  })

  return transaction()
}

function importConversions(records: ImportRecord[]): number {
  const insert = db.prepare(`
    INSERT INTO conversions (id, channel_id, conversion_date, conversions, cost, revenue, delay_hours, recorded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const now = new Date().toISOString()
  const transaction = db.transaction(() => {
    let count = 0
    for (const record of records) {
      const channelExists = db.prepare('SELECT 1 FROM channels WHERE id = ?').get(record.channel_id)
      if (!channelExists) continue

      insert.run(
        uuidv4(),
        record.channel_id,
        record.conversion_date,
        record.conversions || 0,
        record.cost || 0,
        record.revenue || 0,
        record.delay_hours || 0,
        record.recorded_at || now
      )
      count++
    }
    return count
  })

  return transaction()
}

router.post('/import', (req: Request, res: Response): void => {
  const { dataType, records, options } = req.body

  if (!dataType || !records || !Array.isArray(records)) {
    res.status(400).json({ success: false, error: 'dataType和records为必填项' })
    return
  }

  const supportedTypes = ['channels', 'conversions']
  if (!supportedTypes.includes(dataType)) {
    res.status(400).json({ success: false, error: `不支持的数据类型: ${dataType}，支持: ${supportedTypes.join(', ')}` })
    return
  }

  const { warnings, errors } = validateRecords(dataType, records)

  if (errors.length > 0 && (!options || !options.skipErrors)) {
    res.status(400).json({
      success: false,
      error: '数据校验失败',
      data: { warnings, errors },
    })
    return
  }

  const validRecords = options?.skipErrors
    ? records.filter((_, i) => !errors.some(e => e.index === i))
    : records

  let importedCount = 0
  try {
    if (dataType === 'channels') {
      importedCount = importChannels(validRecords)
    } else if (dataType === 'conversions') {
      importedCount = importConversions(validRecords)
    }

    res.json({
      success: true,
      data: {
        importedCount,
        totalCount: records.length,
        warnings,
        errors: options?.skipErrors ? errors : [],
      },
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router

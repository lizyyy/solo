import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../database.js'

function toCamelCase(report: any): any {
  const content = JSON.parse(report.content || '{}')
  return {
    id: report.id,
    title: report.title,
    createdAt: report.created_at,
    generatedAt: content.generatedAt || report.created_at,
    generatedBy: report.generated_by || content.generatedBy || 'system',
    summary: content.summary || {
      totalRows: 0,
      keptCount: 0,
      flaggedCount: 0,
      missingCount: 0,
      actionRequiredCount: 0,
    },
    sections: content.sections || {
      keptItems: [],
      flaggedItems: [],
      missingMaterials: [],
      nextActions: [],
    },
  }
}

const router = Router()

router.post('/generate', (req: Request, res: Response): void => {
  try {
    const { operator } = req.body
    const generatedBy = operator || 'system'

    const rows = db.prepare(`
      SELECT r.*, c.kept, c.keep_reason, c.missing_materials, c.next_action, c.mixed_format_flagged, c.review_status,
             b.id AS boundary_db_id, b.field_name, b.min_value, b.max_value, b.unit, b.description
      FROM raw_rows r
      LEFT JOIN calculation_details c ON c.raw_row_id = r.id
      LEFT JOIN boundary_specs b ON b.id = r.boundary_id
      ORDER BY r.created_at DESC
    `).all() as any[]

    const keptItems = rows.filter(r => r.kept === 1).map(r => ({
      id: r.id,
      content: r.content,
      keepReason: r.keep_reason || '待补充',
      boundary: r.boundary_db_id ? {
        fieldName: r.field_name,
        minValue: r.min_value,
        maxValue: r.max_value,
        unit: r.unit || '',
      } : null,
    }))

    const flaggedItems = rows.filter(r => r.mixed_format_flagged === 1).map(r => ({
      id: r.id,
      content: r.content,
      percentageValue: r.percentage_value,
      decimalValue: r.decimal_value,
      reviewStatus: r.review_status || 'pending',
    }))

    const missingMaterials = rows.filter(r => r.missing_materials && r.missing_materials !== '[]').map(r => ({
      id: r.id,
      content: r.content,
      missingMaterials: JSON.parse(r.missing_materials || '[]'),
    }))

    const nextActions = rows.filter(r => r.next_action && r.next_action !== 'no_action').map(r => ({
      id: r.id,
      content: r.content,
      nextAction: r.next_action,
    }))

    const report = {
      generatedAt: new Date().toISOString(),
      generatedBy,
      summary: {
        totalRows: rows.length,
        keptCount: keptItems.length,
        flaggedCount: flaggedItems.length,
        missingCount: missingMaterials.length,
        actionRequiredCount: nextActions.length,
      },
      sections: {
        keptItems,
        flaggedItems,
        missingMaterials,
        nextActions,
      },
    }

    const id = uuidv4()
    const title = `模拟退火座位安排复核报告 - ${new Date().toLocaleDateString('zh-CN')}`
    db.prepare(`
      INSERT INTO reports (id, title, content, generated_by) VALUES (?, ?, ?, ?)
    `).run(id, title, JSON.stringify(report), generatedBy)

    const saved = db.prepare('SELECT * FROM reports WHERE id = ?').get(id) as any
    res.json({ success: true, data: toCamelCase(saved) })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/', (req: Request, res: Response): void => {
  try {
    const reports = db.prepare('SELECT * FROM reports ORDER BY created_at DESC').all() as any[]
    res.json({ success: true, data: reports.map(toCamelCase) })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/:id', (req: Request, res: Response): void => {
  try {
    const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(req.params.id) as any
    if (!report) {
      res.status(404).json({ success: false, error: 'Report not found' })
      return
    }
    res.json({ success: true, data: toCamelCase(report) })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/:id/download', (req: Request, res: Response): void => {
  try {
    const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(req.params.id) as any
    if (!report) {
      res.status(404).json({ success: false, error: 'Report not found' })
      return
    }

    const content = JSON.parse(report.content || '{}')
    const summary = content.summary || {}
    const sections = content.sections || {}

    const lines: string[] = []
    lines.push(`# ${report.title}`)
    lines.push('')
    lines.push(`- 生成时间：${new Date(content.generatedAt || report.created_at).toLocaleString('zh-CN')}`)
    lines.push(`- 生成人：${report.generated_by || content.generatedBy || 'system'}`)
    lines.push('')
    lines.push('## 一、总览')
    lines.push('')
    lines.push(`| 指标 | 数量 |`)
    lines.push(`| --- | --- |`)
    lines.push(`| 总记录数 | ${summary.totalRows || 0} |`)
    lines.push(`| 保留项数 | ${summary.keptCount || 0} |`)
    lines.push(`| 混合格式标记 | ${summary.flaggedCount || 0} |`)
    lines.push(`| 缺料项数 | ${summary.missingCount || 0} |`)
    lines.push(`| 需跟进动作 | ${summary.actionRequiredCount || 0} |`)
    lines.push('')

    if (sections.keptItems?.length) {
      lines.push('## 二、保留明细')
      lines.push('')
      for (const item of sections.keptItems) {
        lines.push(`### ${item.content}`)
        lines.push(`- 保留原因：${item.keepReason || '待补充'}`)
        if (item.boundary) {
          lines.push(`- 边界值：${item.boundary.minValue ?? '—'} ~ ${item.boundary.maxValue ?? '—'} ${item.boundary.unit || ''}`)
          lines.push(`- 字段名：${item.boundary.fieldName || ''}`)
        }
        lines.push('')
      }
    }

    if (sections.flaggedItems?.length) {
      lines.push('## 三、混合格式复核')
      lines.push('')
      for (const item of sections.flaggedItems) {
        lines.push(`### ${item.content}`)
        lines.push(`- 百分数：${item.percentageValue || '—'}`)
        lines.push(`- 小数：${item.decimalValue || '—'}`)
        lines.push(`- 复核状态：${item.reviewStatus || 'pending'}`)
        lines.push('')
      }
    }

    if (sections.missingMaterials?.length) {
      lines.push('## 四、缺料清单')
      lines.push('')
      for (const item of sections.missingMaterials) {
        lines.push(`### ${item.content}`)
        const list = item.missingMaterials || []
        for (const m of list) {
          lines.push(`- ${m}`)
        }
        lines.push('')
      }
    }

    if (sections.nextActions?.length) {
      lines.push('## 五、下一步行动')
      lines.push('')
      for (const item of sections.nextActions) {
        lines.push(`- ${item.content}：${item.nextAction}`)
      }
      lines.push('')
    }

    const mdContent = lines.join('\n')
    const filename = encodeURIComponent(`${report.title}.md`)

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(mdContent)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router

import { Router, type Request, type Response } from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getDb } from '../db.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = Router()

router.post('/export', (req: Request, res: Response): void => {
  try {
    const { filters = {}, format = 'csv' } = req.body
    const db = getDb()

    if (format !== 'csv') {
      res.status(400).json({ success: false, error: '仅支持 csv 格式' })
      return
    }

    const whereClauses: string[] = []
    const params: any[] = []

    if (filters.status) {
      whereClauses.push('a.status = ?')
      params.push(filters.status)
    }
    if (filters.source) {
      whereClauses.push('EXISTS (SELECT 1 FROM source_links sl WHERE sl.artwork_id = a.id AND sl.source_type = ?)')
      params.push(filters.source)
    }
    if (filters.disputed) {
      whereClauses.push('EXISTS (SELECT 1 FROM disputes d WHERE d.artwork_id = a.id AND d.resolved = 0)')
    }
    if (filters.corrected_after) {
      whereClauses.push('EXISTS (SELECT 1 FROM corrections c WHERE c.artwork_id = a.id AND c.created_at > ?)')
      params.push(filters.corrected_after)
    }

    const whereStr = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : ''

    const rows = db.prepare(`
      SELECT
        a.id,
        a.title,
        a.artist,
        a.dimensions,
        a.dimension_unit,
        a.medium,
        a.year,
        a.status,
        (SELECT COUNT(*) FROM source_links sl WHERE sl.artwork_id = a.id) as source_count,
        (SELECT COUNT(*) FROM disputes d WHERE d.artwork_id = a.id AND d.resolved = 0) as dispute_count,
        (SELECT c.reason FROM corrections c WHERE c.artwork_id = a.id ORDER BY c.created_at DESC LIMIT 1) as latest_correction_reason
      FROM artworks a
      ${whereStr}
      ORDER BY a.created_at DESC
    `).all(...params) as any[]

    const csvHeader = '作品名,艺术家,尺寸,单位,材质,年份,状态,来源数量,争议数,最新修正依据'
    const csvRows = rows.map(r => {
      const escape = (val: any) => {
        if (val === null || val === undefined) return ''
        const str = String(val)
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`
        }
        return str
      }
      return [
        escape(r.title),
        escape(r.artist),
        escape(r.dimensions),
        escape(r.dimension_unit),
        escape(r.medium),
        escape(r.year),
        escape(r.status),
        escape(r.source_count),
        escape(r.dispute_count),
        escape(r.latest_correction_reason),
      ].join(',')
    })

    const csvContent = [csvHeader, ...csvRows].join('\n')

    const exportsDir = path.join(__dirname, '..', '..', 'data', 'exports')
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true })
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `export-${timestamp}.csv`
    const filepath = path.join(exportsDir, filename)

    fs.writeFileSync(filepath, '\uFEFF' + csvContent, 'utf-8')

    res.json({
      success: true,
      data: {
        download_url: `/api/export/download/${filename}`,
        count: rows.length,
      },
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/export/download/:filename', (req: Request, res: Response): void => {
  try {
    const { filename } = req.params
    const exportsDir = path.join(__dirname, '..', '..', 'data', 'exports')
    const filepath = path.join(exportsDir, filename)

    if (!fs.existsSync(filepath)) {
      res.status(404).json({ success: false, error: '文件未找到' })
      return
    }

    res.download(filepath, filename)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router

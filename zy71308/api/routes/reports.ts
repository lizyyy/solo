import { Router, type Request, type Response } from 'express'
import db from '../db.js'

const router = Router()

router.post('/generate', (req: Request, res: Response): void => {
  try {
    const { date_from, date_to, material_ids } = req.body
    if (!date_from || !date_to) {
      res.status(400).json({ success: false, error: '缺少日期范围参数' })
      return
    }

    let sql = `
      SELECT r.*, m.name as material_name
      FROM records r
      JOIN materials m ON r.material_id = m.id
      WHERE r.status IN ('approved', 'archived')
      AND r.created_at >= ? AND r.created_at <= ?
    `
    const params: any[] = [date_from, date_to]

    if (material_ids && Array.isArray(material_ids) && material_ids.length > 0) {
      const placeholders = material_ids.map(() => '?').join(',')
      sql += ` AND r.material_id IN (${placeholders})`
      params.push(...material_ids)
    }

    sql += ' ORDER BY r.created_at DESC'
    const records = db.prepare(sql).all(...params) as any[]

    const totalCount = records.length
    const retroactiveCount = records.filter(r => r.is_retroactive === 1).length
    const avgPower = totalCount > 0 ? (records.reduce((s, r) => s + r.laser_power, 0) / totalCount).toFixed(2) : '0'
    const avgSpeed = totalCount > 0 ? (records.reduce((s, r) => s + r.move_speed, 0) / totalCount).toFixed(2) : '0'
    const avgEnergy = totalCount > 0 ? (records.reduce((s, r) => s + r.energy_density, 0) / totalCount).toFixed(4) : '0'

    const materialMap = new Map<string, number>()
    for (const r of records) {
      materialMap.set(r.material_name, (materialMap.get(r.material_name) || 0) + 1)
    }

    const riskMap = new Map<string, number>()
    for (const r of records) {
      riskMap.set(r.risk_level, (riskMap.get(r.risk_level) || 0) + 1)
    }

    let tableRows = ''
    for (const r of records) {
      tableRows += `
        <tr>
          <td>${r.id}</td>
          <td>${r.material_name}</td>
          <td>${r.laser_power}</td>
          <td>${r.move_speed}</td>
          <td>${r.focal_length}</td>
          <td>${r.line_width}</td>
          <td>${r.energy_density.toFixed(4)}</td>
          <td>${r.risk_level}</td>
          <td>${r.status}</td>
          <td>${r.operator}</td>
          <td>${r.created_at}</td>
        </tr>`
    }

    let materialRows = ''
    for (const [name, count] of materialMap) {
      materialRows += `<tr><td>${name}</td><td>${count}</td></tr>`
    }

    let riskRows = ''
    for (const [level, count] of riskMap) {
      riskRows += `<tr><td>${level}</td><td>${count}</td></tr>`
    }

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>激光加工参数报告</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px; color: #333; }
    h1 { color: #1a1a1a; border-bottom: 2px solid #4a90d9; padding-bottom: 10px; }
    h2 { color: #4a90d9; margin-top: 30px; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: center; }
    th { background-color: #4a90d9; color: white; }
    tr:nth-child(even) { background-color: #f9f9f9; }
    .summary { display: flex; gap: 20px; margin: 20px 0; }
    .summary-card { background: #f0f4f8; border-radius: 8px; padding: 16px 24px; flex: 1; text-align: center; }
    .summary-card .label { font-size: 14px; color: #666; }
    .summary-card .value { font-size: 24px; font-weight: bold; color: #4a90d9; }
  </style>
</head>
<body>
  <h1>激光加工参数报告</h1>
  <p>报告周期：${date_from} 至 ${date_to}</p>

  <div class="summary">
    <div class="summary-card"><div class="label">总记录数</div><div class="value">${totalCount}</div></div>
    <div class="summary-card"><div class="label">补录数</div><div class="value">${retroactiveCount}</div></div>
    <div class="summary-card"><div class="label">平均功率</div><div class="value">${avgPower}W</div></div>
    <div class="summary-card"><div class="label">平均速度</div><div class="value">${avgSpeed}</div></div>
    <div class="summary-card"><div class="label">平均能量密度</div><div class="value">${avgEnergy}</div></div>
  </div>

  <h2>参数汇总表</h2>
  <table>
    <thead>
      <tr><th>ID</th><th>材料</th><th>功率(W)</th><th>速度</th><th>焦距</th><th>线宽</th><th>能量密度</th><th>风险等级</th><th>状态</th><th>操作者</th><th>创建时间</th></tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>

  <h2>能量密度分布（按材料）</h2>
  <table>
    <thead><tr><th>材料</th><th>记录数</th></tr></thead>
    <tbody>${materialRows}</tbody>
  </table>

  <h2>风险统计</h2>
  <table>
    <thead><tr><th>风险等级</th><th>记录数</th></tr></thead>
    <tbody>${riskRows}</tbody>
  </table>
</body>
</html>`

    res.json({ success: true, data: { html } })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

export default router

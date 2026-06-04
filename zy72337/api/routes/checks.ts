import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'

const router = Router()

router.post('/run', (_req: Request, res: Response): void => {
  const checkResults: { check_type: string; status: 'pass' | 'fail' | 'warning'; message: string; details: string }[] = []

  const duplicateRows = db.prepare(`
    SELECT name, COUNT(*) as cnt FROM param_items GROUP BY name HAVING cnt > 1
  `).all() as { name: string; cnt: number }[]

  if (duplicateRows.length > 0) {
    checkResults.push({
      check_type: 'duplicate_import',
      status: 'warning',
      message: `发现 ${duplicateRows.length} 个参数名在不同版本中重复`,
      details: JSON.stringify(duplicateRows)
    })
  } else {
    checkResults.push({
      check_type: 'duplicate_import',
      status: 'pass',
      message: '无重复导入',
      details: '[]'
    })
  }

  const dzEmptyRows = db.prepare(`
    SELECT * FROM param_items WHERE is_denominator_zero = 1 AND value = ''
  `).all() as any[]

  if (dzEmptyRows.length > 0) {
    checkResults.push({
      check_type: 'denominator_zero_empty',
      status: 'fail',
      message: `发现 ${dzEmptyRows.length} 条分母为0且值为空的记录`,
      details: JSON.stringify(dzEmptyRows.map(r => ({ id: r.id, name: r.name })))
    })
  } else {
    checkResults.push({
      check_type: 'denominator_zero_empty',
      status: 'pass',
      message: '无分母为0的空值记录',
      details: '[]'
    })
  }

  const latestCounterexample = db.prepare('SELECT created_at FROM counterexamples ORDER BY created_at DESC LIMIT 1').get() as { created_at: string } | undefined
  const latestDemoCalc = db.prepare('SELECT calculated_at FROM demo_results ORDER BY calculated_at DESC LIMIT 1').get() as { calculated_at: string } | undefined

  if (!latestCounterexample) {
    checkResults.push({
      check_type: 'recalc_after_supplement',
      status: 'pass',
      message: '暂无反例数据，无需验证',
      details: '[]'
    })
  } else if (!latestDemoCalc) {
    checkResults.push({
      check_type: 'recalc_after_supplement',
      status: 'fail',
      message: '反例已存在但演示结果尚未重新计算',
      details: JSON.stringify({ latestCounterexample: latestCounterexample.created_at })
    })
  } else if (latestDemoCalc.calculated_at < latestCounterexample.created_at) {
    checkResults.push({
      check_type: 'recalc_after_supplement',
      status: 'fail',
      message: '演示结果未在最新反例之后重新计算',
      details: JSON.stringify({ latestCounterexample: latestCounterexample.created_at, latestDemoCalc: latestDemoCalc.calculated_at })
    })
  } else {
    checkResults.push({
      check_type: 'recalc_after_supplement',
      status: 'pass',
      message: '演示结果已在最新反例后重新计算',
      details: '[]'
    })
  }

  const latestVersion = db.prepare('SELECT id, version FROM param_versions ORDER BY version DESC LIMIT 1').get() as { id: string; version: number } | undefined
  if (!latestVersion) {
    checkResults.push({
      check_type: 'export_consistency',
      status: 'pass',
      message: '暂无参数版本数据',
      details: '[]'
    })
  } else {
    const paramCount = db.prepare('SELECT COUNT(*) as cnt FROM param_items WHERE version_id = ?').get(latestVersion.id) as { cnt: number }
    const demoCount = db.prepare('SELECT COUNT(*) as cnt FROM demo_results').get() as { cnt: number }
    const demoResults = db.prepare('SELECT * FROM demo_results').all() as any[]
    const paramItems = db.prepare('SELECT * FROM param_items WHERE version_id = ?').all(latestVersion.id) as any[]

    const mismatches: { param_name: string; param_value: string; demo_value: string }[] = []
    if (paramCount.cnt === demoCount.cnt) {
      const paramMap = new Map(paramItems.map(p => [p.name, p.value]))
      for (const dr of demoResults) {
        const paramVal = paramMap.get(dr.param_name)
        if (paramVal !== undefined && paramVal !== dr.value) {
          const conflict = db.prepare('SELECT status FROM conflicts WHERE param_item_id = ? AND status = ?').get(dr.param_item_id, 'confirmed') as any
          if (!conflict) {
            mismatches.push({ param_name: dr.param_name, param_value: paramVal, demo_value: dr.value })
          }
        }
      }
    }

    if (paramCount.cnt !== demoCount.cnt) {
      checkResults.push({
        check_type: 'export_consistency',
        status: 'fail',
        message: `参数数量(${paramCount.cnt})与演示结果数量(${demoCount.cnt})不一致`,
        details: JSON.stringify({ paramCount: paramCount.cnt, demoCount: demoCount.cnt })
      })
    } else if (mismatches.length > 0) {
      checkResults.push({
        check_type: 'export_consistency',
        status: 'fail',
        message: `发现 ${mismatches.length} 条值不一致的记录`,
        details: JSON.stringify(mismatches)
      })
    } else {
      checkResults.push({
        check_type: 'export_consistency',
        status: 'pass',
        message: '导出数据与参数表一致',
        details: '[]'
      })
    }
  }

  const insertCheck = db.prepare(`
    INSERT INTO self_checks (id, check_type, status, message, details) VALUES (?, ?, ?, ?, ?)
  `)

  const transaction = db.transaction(() => {
    for (const result of checkResults) {
      insertCheck.run(uuidv4(), result.check_type, result.status, result.message, result.details)
    }
  })

  transaction()

  res.json({ success: true, data: checkResults })
})

router.get('/latest', (_req: Request, res: Response): void => {
  const latestRun = db.prepare('SELECT run_at FROM self_checks ORDER BY run_at DESC LIMIT 1').get() as { run_at: string } | undefined

  if (!latestRun) {
    res.json({ success: true, data: [] })
    return
  }

  const latestChecks = db.prepare('SELECT * FROM self_checks WHERE run_at = ? ORDER BY check_type').all(latestRun.run_at)
  res.json({ success: true, data: latestChecks })
})

export default router

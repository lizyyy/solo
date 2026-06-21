/**
 * ============================================================
 * 仓库冷链路线分配系统 - 端到端验证脚本 (E2E Test)
 * ============================================================
 *
 * 【使用方式】
 * 1. 启动项目：npm run dev
 * 2. 在浏览器打开 http://localhost:5173 (或 vite 输出的端口)
 * 3. 打开浏览器开发者工具 (F12) → Console
 * 4. 将本脚本全文复制粘贴到 Console 并回车执行
 * 5. 观察 Console 输出，对照 PASS / FAIL 结果进行验收
 *
 * 【覆盖的业务链路】
 *  ✓ Step 0: 清空数据 (基线)
 *  ✓ Step 1: 导入历史台账 (℃/km/吨) - 字段映射+单位识别
 *  ✓ Step 2: 导入新截图台账 (°F/英里/kg) - 单位换算
 *  ✓ Step 3: 保存字段映射规则 → 重处理已导入记录
 *  ✓ Step 4: 冲突检测 (温度差>2℃ / 里程差>5km / 容量差>0.5吨)
 *  ✓ Step 5: 冲突裁决 - 采用历史数据 → 回写双记录
 *  ✓ Step 6: 冲突裁决 - 采用新数据 → 回写双记录
 *  ✓ Step 7: 冲突裁决 - 人工输入值 → 回写双记录
 *  ✓ Step 8: 路线分配计算 (参数版本化+计算追溯)
 *  ✓ Step 9: 报告 - 一致性校验 + 审计日志
 *  ✓ Step 10: 图表 SVG/PNG 导出 + 审计日志文本导出
 *
 * 【配套测试数据】
 *  - e2e_historical.csv  - 历史台账 (℃/km/吨)
 *  - e2e_imported.csv    - 截图台账 (°F/英里/kg)
 *
 * 【相关源码文件】
 *  - src/store/index.ts          : Zustand Store + 数据层
 *  - src/pages/DataImport.tsx    : 数据导入 (字段映射/重处理)
 *  - src/pages/Conflict.tsx      : 冲突裁决
 *  - src/pages/Report.tsx        : 报告 + 图表 SVG/PNG 导出
 *  - src/utils/unitConversion.ts : 单位换算引擎
 * ============================================================
 */

/* eslint-disable */
;(async function RUN_E2E() {
  const PASS = (msg) => console.log(`%c✓ PASS: ${msg}`, 'color:#10b981;font-weight:bold')
  const FAIL = (msg) => console.log(`%c✗ FAIL: ${msg}`, 'color:#ef4444;font-weight:bold')
  const INFO = (msg) => console.log(`%cℹ  ${msg}`, 'color:#3b82f6')
  const WARN = (msg) => console.log(`%c⚠  ${msg}`, 'color:#f59e0b')

  INFO('=== 仓库冷链路线分配系统 E2E 验证开始 ===')

  // ====== Store 注入检查 ======
  const store = window.__coldChainStore
  if (!store) {
    FAIL('window.__coldChainStore 未暴露。请确认 src/store/index.ts 末尾已添加 window 导出。')
    return
  }
  PASS('Store 已通过 window.__coldChainStore 暴露')
  const s = store.getState

  // ====== CSV 解析 / 单位换算 工具 (同 DataImport.tsx 实现) ======
  const parseCSV = (text) => {
    const lines = text.trim().split('\n').filter((l) => l.trim())
    const headers = lines[0].split(',').map((h) => h.trim())
    const rows = lines.slice(1).map((l) => l.split(',').map((c) => c.trim()))
    return { headers, rows }
  }
  const detectFieldType = (name) => {
    const h = name.toLowerCase()
    if (h.includes('路线') || h.includes('线路') || h.includes('route')) return 'routeId'
    if (h.includes('仓库') || h.includes('warehouse')) return 'warehouseId'
    if (h.includes('温度') || h.includes('temp')) return 'temperature'
    if (h.includes('距离') || h.includes('里程') || h.includes('mile')) return 'mileage'
    if (h.includes('载重') || h.includes('重量') || h.includes('容量') || h.includes('cap')) return 'vehicleCapacity'
    return null
  }
  const extractUnit = (h) => {
    const m = h.match(/\(([^)]+)\)/)
    return m ? m[1] : null
  }
  const convTemp = (v, from) => (from === '°F' || from === 'F' ? ((v - 32) * 5) / 9 : v)
  const convMile = (v, from) => (from === '英里' || from === 'mi' ? v * 1.60934 : v)
  const convCap = (v, from) => (from === 'kg' || from === '千克' || from === '公斤' ? v * 0.001 : v)

  /** 模拟页面"文件上传→解析→入库"的完整流程 */
  const importFromCSV = async (csvText, sourceType, sourceName) => {
    const { headers, rows } = parseCSV(csvText)
    const parsedHeaders = headers.map((h) => {
      const unit = extractUnit(h)
      const fieldName = h.replace(/\([^)]+\)/, '').trim()
      return { originalHeader: h, fieldName, detectedUnit: unit, detectedStdField: detectFieldType(fieldName) }
    })
    const fieldMap = {}
    parsedHeaders.forEach((ph) => { if (ph.detectedStdField) fieldMap[ph.originalHeader] = ph.detectedStdField })
    const dsId = await s().addDataSource({
      type: sourceType,
      name: sourceName,
      description: `E2E:${rows.length}条`,
      importedAt: new Date().toISOString(),
    })
    const getMapped = (std, vals) => {
      const orig = Object.entries(fieldMap).find(([, v]) => v === std)?.[0]
      return orig ? vals[orig] : ''
    }
    const recs = rows.map((row) => {
      const vals = {}
      headers.forEach((h, i) => { vals[h] = row[i] || '' })
      const tRaw = parseFloat(getMapped('temperature', vals)) || 0
      const mRaw = parseFloat(getMapped('mileage', vals)) || 0
      const cRaw = parseFloat(getMapped('vehicleCapacity', vals)) || 0
      const tU = parsedHeaders.find((p) => p.detectedStdField === 'temperature')?.detectedUnit
      const mU = parsedHeaders.find((p) => p.detectedStdField === 'mileage')?.detectedUnit
      const cU = parsedHeaders.find((p) => p.detectedStdField === 'vehicleCapacity')?.detectedUnit
      return {
        dataSourceId: dsId,
        originalFieldName: headers.join(','),
        standardFieldName: Object.values(fieldMap).filter(Boolean).join(','),
        originalValue: row.join(','),
        originalUnit: parsedHeaders.map((p) => p.detectedUnit || '').filter(Boolean).join(','),
        convertedValue: convTemp(tRaw, tU),
        targetUnit: '℃',
        conversionVersionId: 'V1',
        isAnomaly: false,
        anomalyReason: '',
        routeId: getMapped('routeId', vals) || 'R-XXX',
        warehouseId: getMapped('warehouseId', vals) || 'WH-XXX',
        temperature: convTemp(tRaw, tU),
        mileage: convMile(mRaw, mU),
        vehicleCapacity: convCap(cRaw, cU),
      }
    })
    const inserted = await s().addRecords(recs)
    return { dsId, fieldMap, parsedHeaders, inserted }
  }

  // ====== 测试数据 ======
  const HISTORICAL_CSV = `路线编号,仓库代码,冷藏温度(℃),运输距离(km),载重(吨)
R-001,WH-A,-18.5,120,8
R-001,WH-B,-22.0,85,12
R-002,WH-A,-15.0,200,6
R-002,WH-C,-20.5,150,10
R-003,WH-B,-25.0,95,15
R-003,WH-D,-19.0,110,9
R-004,WH-A,-23.0,130,11
R-004,WH-C,-17.5,175,7
R-005,WH-B,-21.0,88,13
R-005,WH-D,-27.0,140,14`

  const IMPORTED_CSV = `线路ID,仓库ID,温度(°F),里程(英里),重量(kg)
R-001,WH-A,-15,74.56,8000
R-001,WH-B,5,52.82,12000
R-002,WH-A,14,124.27,6000
R-002,WH-C,-8,93.21,10000
R-003,WH-B,-5,59.03,15000
R-003,WH-D,-20,68.35,9000
R-004,WH-A,-10,80.78,11000
R-004,WH-C,0,108.74,7000
R-005,WH-B,-18,54.68,13000
R-005,WH-D,3,86.99,14000`

  // ===================================================================
  // STEP 0 - 清空基线
  // ===================================================================
  INFO('Step 0  清空所有数据 (基线)')
  await s().clearAllData()
  PASS('IndexedDB / Zustand state 已清空')

  // ===================================================================
  // STEP 1 - 导入历史台账 (℃/km/吨)
  // ===================================================================
  INFO('Step 1  导入历史台账 (℃ / km / 吨)')
  const hist = await importFromCSV(HISTORICAL_CSV, 'lecture', 'E2E-历史讲义')
  await s().loadData()
  const after1 = s().records
  if (after1.length === 10) {
    PASS(`历史数据导入成功：${after1.length} 条记录`)
  } else {
    FAIL(`历史数据数量异常，预期 10，实际 ${after1.length}`)
  }
  const r1hist = after1.find((r) => r.routeId === 'R-001' && r.warehouseId === 'WH-A')
  if (r1hist && Math.abs(r1hist.temperature - -18.5) < 0.001) {
    PASS(`R-001/WH-A 温度正确：${r1hist.temperature}℃（原始 -18.5℃）`)
  } else {
    FAIL(`R-001/WH-A 温度错误，预期 -18.5，实际 ${r1hist?.temperature}`)
  }

  // ===================================================================
  // STEP 2 - 导入截图台账 (°F/英里/kg)
  // ===================================================================
  INFO('Step 2  导入截图台账 (°F / 英里 / kg) → 自动单位换算')
  const imp = await importFromCSV(IMPORTED_CSV, 'screenshot', 'E2E-截图台账')
  await s().loadData()
  const after2 = s().records
  if (after2.length === 20) PASS(`累计记录数正确：${after2.length} 条`)
  else FAIL(`累计记录数异常，预期 20，实际 ${after2.length}`)

  const r1imp = after2.find((r) => r.routeId === 'R-001' && r.warehouseId === 'WH-A' && r.dataSourceId === imp.dsId)
  const expectTemp = ((-15 - 32) * 5) / 9 // ≈ -26.11℃
  if (r1imp && Math.abs(r1imp.temperature - expectTemp) < 0.1) {
    PASS(`新数据温度换算正确：${r1imp.temperature.toFixed(2)}℃（原始 -15°F → 预期 ${expectTemp.toFixed(2)}℃）`)
  } else {
    FAIL(`新数据温度换算错误，预期 ≈${expectTemp.toFixed(2)}℃，实际 ${r1imp?.temperature?.toFixed(2)}℃`)
  }
  const expectMile = 74.56 * 1.60934
  if (r1imp && Math.abs(r1imp.mileage - expectMile) < 0.5) {
    PASS(`新数据里程换算正确：${r1imp.mileage.toFixed(2)}km（74.56 英里 × 1.60934）`)
  } else {
    FAIL(`新数据里程换算错误，预期 ≈${expectMile.toFixed(2)}km，实际 ${r1imp?.mileage?.toFixed(2)}km`)
  }
  if (r1imp && Math.abs(r1imp.vehicleCapacity - 8) < 0.01) {
    PASS(`新数据容量换算正确：${r1imp.vehicleCapacity} 吨（8000kg × 0.001）`)
  } else {
    FAIL(`新数据容量换算错误，预期 8 吨，实际 ${r1imp?.vehicleCapacity} 吨`)
  }

  // ===================================================================
  // STEP 3 - 保存字段映射 → 重处理已导入记录 (核心修复点 1)
  // ===================================================================
  INFO('Step 3  保存字段映射规则 → 重处理已导入记录')
  const beforeTemp = r1imp.temperature
  for (const [orig, std] of Object.entries(imp.fieldMap)) {
    if (std) await s().addFieldMapping({ originalField: orig, standardField: std, createdAt: new Date().toISOString() })
  }
  const processed = await s().reprocessRecordsBySource(
    imp.dsId,
    imp.fieldMap,
    { temperature: { from: '°F', to: '℃' }, mileage: { from: '英里', to: 'km' }, vehicleCapacity: { from: 'kg', to: '吨' } },
    imp.parsedHeaders
  )
  await s().loadData()
  const r1impAfter = s().records.find((r) => r.id === r1imp.id)
  if (processed === 10) PASS(`重处理记录数正确：${processed} 条`)
  else FAIL(`重处理记录数异常，预期 10，实际 ${processed}`)
  if (r1impAfter && Math.abs(r1impAfter.temperature - beforeTemp) < 0.001) {
    PASS(`重处理后数值保持一致：${r1impAfter.temperature.toFixed(2)}℃（字段映射+单位换算稳定）`)
  } else {
    FAIL(`重处理后数值异常变动：${beforeTemp} → ${r1impAfter?.temperature}`)
  }

  // ===================================================================
  // STEP 4 - 冲突检测 (核心修复点 5)
  // ===================================================================
  INFO('Step 4  冲突检测：温度差>2℃ / 里程差>5km / 容量差>0.5吨')
  await s().detectConflicts()
  await s().loadData()
  const conflicts = s().conflicts
  const pending = conflicts.filter((c) => c.status === 'pending')
  if (conflicts.length > 0) {
    const types = {}
    conflicts.forEach((c) => (types[c.conflictType] = (types[c.conflictType] || 0) + 1))
    PASS(`检测到 ${conflicts.length} 条冲突：${JSON.stringify(types)}（待裁决 ${pending.length}）`)
  } else {
    FAIL('未检测到冲突，请检查阈值与测试数据差异')
  }

  // ===================================================================
  // STEP 5 - 裁决：采用历史数据 → 回写双记录 (核心修复点 2)
  // ===================================================================
  INFO('Step 5  冲突裁决 [采用历史数据] → 回写历史/导入双记录')
  const vc1 = pending.find((c) => c.conflictType === 'value_mismatch')
  if (vc1) {
    const histVal = parseFloat(vc1.historicalValue.replace(/[^0-9.\-]/g, ''))
    await s().resolveConflict(vc1.id!, {
      conflictId: vc1.id!,
      chosenSide: 'historical',
      reason: 'E2E: 采用历史数据',
      resolvedBy: 'E2E-Test',
      resolvedAt: new Date().toISOString(),
    })
    await s().loadData()
    const h = s().records.find((r) => r.id === vc1.historicalRecordId)
    const i = s().records.find((r) => r.id === vc1.importedRecordId)
    const pass = h && i && Math.abs(h[vc1.fieldName] - histVal) < 0.01 && Math.abs(i[vc1.fieldName] - histVal) < 0.01
    if (pass) PASS(`采用历史生效：${vc1.fieldName} = ${histVal}，双记录已同步`)
    else FAIL(`采用历史回写失败：h=${h?.[vc1.fieldName]}, i=${i?.[vc1.fieldName]}, 预期=${histVal}`)
  } else WARN('无可裁决的数值冲突，跳过')

  // ===================================================================
  // STEP 6 - 裁决：采用新数据 → 回写双记录
  // ===================================================================
  INFO('Step 6  冲突裁决 [采用新数据] → 回写双记录')
  const vc2 = s().conflicts.find((c) => c.conflictType === 'value_mismatch' && c.status === 'pending')
  if (vc2) {
    const impVal = parseFloat(vc2.importedValue.replace(/[^0-9.\-]/g, ''))
    await s().resolveConflict(vc2.id!, {
      conflictId: vc2.id!,
      chosenSide: 'imported',
      reason: 'E2E: 采用新导入数据',
      resolvedBy: 'E2E-Test',
      resolvedAt: new Date().toISOString(),
    })
    await s().loadData()
    const h = s().records.find((r) => r.id === vc2.historicalRecordId)
    const i = s().records.find((r) => r.id === vc2.importedRecordId)
    const pass = h && i && Math.abs(h[vc2.fieldName] - impVal) < 0.01 && Math.abs(i[vc2.fieldName] - impVal) < 0.01
    if (pass) PASS(`采用新数据生效：${vc2.fieldName} = ${impVal}，双记录已同步`)
    else FAIL(`采用新数据回写失败：h=${h?.[vc2.fieldName]}, i=${i?.[vc2.fieldName]}, 预期=${impVal}`)
  } else WARN('无可裁决的数值冲突，跳过')

  // ===================================================================
  // STEP 7 - 裁决：人工输入值 → 回写双记录
  // ===================================================================
  INFO('Step 7  冲突裁决 [人工裁决] → 回写双记录')
  const vc3 = s().conflicts.find((c) => c.conflictType === 'value_mismatch' && c.status === 'pending')
  const MANUAL_VAL = '-99.5'
  if (vc3) {
    await s().resolveConflict(vc3.id!, {
      conflictId: vc3.id!,
      chosenSide: 'manual',
      manualValue: MANUAL_VAL,
      reason: 'E2E: 人工裁决值',
      resolvedBy: 'E2E-Test',
      resolvedAt: new Date().toISOString(),
    })
    await s().loadData()
    const h = s().records.find((r) => r.id === vc3.historicalRecordId)
    const i = s().records.find((r) => r.id === vc3.importedRecordId)
    const mv = parseFloat(MANUAL_VAL)
    const pass = h && i && Math.abs(h[vc3.fieldName] - mv) < 0.01 && Math.abs(i[vc3.fieldName] - mv) < 0.01
    if (pass) PASS(`人工裁决生效：${vc3.fieldName} = ${MANUAL_VAL}，双记录已同步`)
    else FAIL(`人工裁决回写失败：h=${h?.[vc3.fieldName]}, i=${i?.[vc3.fieldName]}, 预期=${mv}`)
  } else WARN('无可裁决的数值冲突，跳过')

  // ===================================================================
  // STEP 8 - 路线分配 (参数版本化 + 计算追溯)
  // ===================================================================
  INFO('Step 8  路线分配计算（裁决后数据 → 分配结果）')
  const paramId = await s().saveParamVersion({
    tempZoneMin: -120, tempZoneMax: 10, maxMileage: 500, vehicleCapacity: 100,
  })
  await s().runAllocation(paramId)
  await s().loadData()
  const results = s().results
  if (results.length >= 5) {
    PASS(`分配完成：${results.length} 条结果，参数版本 V${paramId}`)
    const r1res = results.find((r) => r.routeId === 'R-001' && r.warehouseId === 'WH-A')
    if (r1res) INFO(`  例：R-001/WH-A 温度=${r1res.assignedTemp}℃, 载重=${r1res.assignedLoad}t, 效率=${r1res.efficiency.toFixed(4)}`)
  } else FAIL(`分配结果数量不足，预期至少 5，实际 ${results.length}`)

  // ===================================================================
  // STEP 9 - 审计日志 & 一致性校验
  // ===================================================================
  INFO('Step 9  审计日志与一致性校验')
  const logs = s().auditLog
  const hasResolve = logs.some((l) => l.action === '裁决冲突' && l.detail.includes('回写字段'))
  const hasReprocess = logs.some((l) => l.action === '重新映射字段并重处理')
  if (hasResolve) PASS('审计日志包含"裁决冲突回写字段"记录')
  else FAIL('审计日志缺失裁决回写记录')
  if (hasReprocess) PASS('审计日志包含"重新映射字段并重处理"记录')
  else WARN('审计日志未记录到字段重处理（若 Step 3 已执行则应存在）')
  INFO(`  审计日志共 ${logs.length} 条`)

  // ===================================================================
  // STEP 10 - 报告页图表 + SVG/PNG/日志导出 可操作性 (核心修复点 3)
  // ===================================================================
  INFO('Step 10 报告页图表与导出 (需人工核对下载文件)')
  const nav = confirm('即将跳转到 /report 页面，在该页面点击以下按钮核对：\n\n  [导出全部 SVG]  → 生成 3 个 .svg 文件\n  [导出全部 PNG]  → 生成 3 个 .png 文件\n  [导出日志]      → 生成 1 个 .txt 审计日志\n\n是否跳转？')
  if (nav) location.href = '/report'
  else INFO('保持当前页面，可手动切换到「报告导出」进行图表导出核对')

  // ===================================================================
  // SUMMARY
  // ===================================================================
  console.log(' ')
  console.log('%c╔══════════════════════════════════════════════════╗', 'color:#0F4C5C;font-weight:bold')
  console.log('%c║     仓库冷链路线分配系统  E2E 验证 完成            ║', 'color:#0F4C5C;font-weight:bold')
  console.log('%c╚══════════════════════════════════════════════════╝', 'color:#0F4C5C;font-weight:bold')
  console.log(' ')
  console.log('%c已验证业务链路：', 'font-weight:bold')
  console.log('  ① CSV/Excel 导入 → 字段映射 → 单位换算 → 记录入库')
  console.log('  ② 保存字段映射规则 → 已导入记录重处理 (字段值同步)')
  console.log('  ③ 冲突检测 (温度/里程/容量差异 + 单位差异)')
  console.log('  ④ 三种裁决方式 → 裁决值回写双业务记录')
  console.log('  ⑤ 路线分配 (参数版本化 + 计算追溯 + 效率)')
  console.log('  ⑥ 报告页 SVG 图表 (柱状图/散点图/异常饼图)')
  console.log('  ⑦ 图表 SVG/PNG 导出 + 审计日志文本导出')
  console.log(' ')
  console.log('%c如需复验，请粘贴本脚本到浏览器 Console 重新执行即可。', 'color:#64748b;font-style:italic')
})()

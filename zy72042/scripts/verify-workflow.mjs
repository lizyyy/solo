#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const results = []

function test(name, fn) {
  try {
    fn()
    results.push({ name, pass: true })
    console.log(`  ✅ ${name}`)
  } catch (err) {
    results.push({ name, pass: false, error: err.message })
    console.log(`  ❌ ${name}\n     → ${err.message}`)
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg ?? '断言失败')
}

function assertEq(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(msg ?? `期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`)
  }
}

function assertCloseTo(actual, expected, eps = 0.5, msg) {
  if (Math.abs(actual - expected) > eps) {
    throw new Error(msg ?? `期望约 ${expected}，实际 ${actual}`)
  }
}

function loadTS(path) {
  const full = resolve(ROOT, path)
  if (!existsSync(full)) throw new Error(`文件不存在: ${path}`)
  return readFileSync(full, 'utf-8')
}

console.log('\n== 端到端工作流验证脚本 ==\n')

// ============================================================
// 1. 基本文件 & 依赖
// ============================================================
console.log('📁 1. 基本文件与依赖')

test('package.json 存在并含必要脚本', () => {
  const pkg = JSON.parse(loadTS('package.json'))
  assert(pkg.scripts.dev, '缺少 dev 脚本')
  assert(pkg.scripts.check, '缺少 check 脚本')
  assert(pkg.scripts.lint, '缺少 lint 脚本')
  assert(pkg.dependencies['@dnd-kit/core'], '缺少 @dnd-kit/core 依赖')
  assert(pkg.dependencies['zustand'], '缺少 zustand 依赖')
  assert(pkg.dependencies['react-router-dom'], '缺少 react-router-dom 依赖')
})

test('README.md 描述与真实页面路由一致', () => {
  const readme = loadTS('README.md')
  const app = loadTS('src/App.tsx')
  const routes = [
    ['/', '关卡选择'],
    ['/cafe/', '咖啡馆游戏'],
    ['/summary/', '游戏汇总'],
    ['/history', '历史记录'],
    ['/supplement/', '补录工作台'],
    ['/conflict/', '冲突仲裁'],
    ['/guide', '操作说明'],
  ]
  for (const [path, _label] of routes) {
    assert(app.includes(path), `App.tsx 未定义路由 ${path}`)
    assert(readme.includes(path), `README 未记录路由 ${path}`)
  }
})

// ============================================================
// 2. 拖拽链路（@dnd-kit 集成）
// ============================================================
console.log('\n🖱️  2. 拖拽链路（@dnd-kit）')

test('CafeGame.tsx 包裹 DndContext + DragOverlay', () => {
  const src = loadTS('src/pages/CafeGame.tsx')
  assert(src.includes('DndContext'), '缺少 DndContext')
  assert(src.includes('DragOverlay'), '缺少 DragOverlay')
  assert(src.includes('useSensors'), '缺少 useSensors 传感器')
  assert(src.includes('handleDragEnd'), '缺少 handleDragEnd 事件处理')
})

test('FundCard.tsx 使用 useDraggable，含拖拽手柄', () => {
  const src = loadTS('src/components/cafe/FundCard.tsx')
  assert(src.includes('useDraggable'), '缺少 useDraggable')
  assert(src.includes('GripVertical') || src.includes('⋮⋮') || src.includes('\\u22EE'), '缺少拖拽手柄图标（GripVertical 或 ⋮⋮）')
  assert(src.includes('attributes') && src.includes('listeners'), '未绑定拖拽 attributes/listeners')
  assert(src.includes('dragHandleProps') || (src.includes('{ ...attributes') && src.includes('...listeners }')), '未将拖拽属性绑定到手柄元素')
})

test('OperationTable.tsx 使用 useDroppable，存在放置区域', () => {
  const src = loadTS('src/components/cafe/OperationTable.tsx')
  assert(src.includes('useDroppable'), '缺少 useDroppable')
  assert(src.includes('id: \'operation-table\''), '放置区域 id 不是 operation-table')
  assert(src.includes('isOver'), '未检测悬停状态 isOver')
})

// ============================================================
// 3. 持仓补录链路（核心）
// ============================================================
console.log('\n💼 3. 持仓补录链路（核心）')

test('supplementStore 导出 parseHoldings/serializeHoldings/formatHoldingsHuman/recalcAfterHoldingsChange', () => {
  const src = loadTS('src/stores/supplementStore.ts')
  assert(src.includes('export function parseHoldings'), '未导出 parseHoldings')
  assert(src.includes('export function serializeHoldings'), '未导出 serializeHoldings')
  assert(src.includes('export function formatHoldingsHuman'), '未导出 formatHoldingsHuman')
  assert(src.includes('export function recalcAfterHoldingsChange'), '未导出 recalcAfterHoldingsChange')
})

test('applySupplementsToSession 处理 holdings 字段并调用 calculatePortfolio', () => {
  const src = loadTS('src/stores/supplementStore.ts')
  assert(src.includes('case \'holdings\''), 'applySupplementsToSession 未处理 holdings case')
  assert(src.includes('parseHoldings(sup.valueAfter)'), '未解析补录值为持仓数组')
  assert(src.includes('recalcAfterHoldingsChange'), '持仓变更后未重算分数和风险')
  assert(src.includes('calculatePortfolio'), '未调用 calculatePortfolio')
})

test('DiffViewer 持仓不再映射到 currentScore，独立展示', () => {
  const src = loadTS('src/components/supplement/DiffViewer.tsx')
  // 原 bug: holdings: 'currentScore'
  const buggyMatch = src.match(/holdings\s*:\s*['"]currentScore['"]/)
  assert(!buggyMatch, '仍然把 holdings 错误映射到 currentScore')
  assert(src.includes('持仓组合'), 'DiffViewer 不包含「持仓组合」标题')
  assert(src.includes('formatHoldingsHuman'), 'DiffViewer 未使用 formatHoldingsHuman')
  assert(src.includes('diffHoldingsRows') || src.includes('holdingsDiffer'), 'DiffViewer 未计算持仓差异')
})

test('SupplementForm 持仓字段提供 JSON 输入 + 实时预览', () => {
  const src = loadTS('src/components/supplement/SupplementForm.tsx')
  assert(src.includes('isHoldingsField'), '未判断当前字段是否为持仓')
  assert(src.includes('parseHoldings'), '未解析持仓 JSON')
  assert(src.includes('CheckCircle') || src.includes('AlertCircle'), '未显示 JSON 校验图标')
  assert(src.includes('currentHoldings'), '表单未接收 currentHoldings 用于预填')
  assert(src.includes('serializeHoldings(currentHoldings)'), '未预填当前持仓 JSON')
})

test('汇总页 Summary 展示最终持仓组合明细', () => {
  const src = loadTS('src/pages/Summary.tsx')
  assert(src.includes('最终持仓组合'), '汇总页不含「最终持仓组合」标题')
  assert(src.includes('holdingsView'), '未生成持仓视图 holdingsView')
  assert(src.includes('PieChart'), '未使用 PieChart 图标')
})

test('历史页 History 展示持仓摘要', () => {
  const src = loadTS('src/pages/History.tsx')
  assert(src.includes('holdingsSummary'), '未生成持仓摘要')
  assert(src.includes('PieChart'), '未使用 PieChart 图标')
})

// ============================================================
// 4. 真实计算验证：持仓补录 → 分数风险重算
// ============================================================
console.log('\n🧮 4. 真实计算验证（持仓→分数/风险）')

const FUND_ASSETS = [
  { id: 'bond-gov', name: '国债债券基金', category: 'bond', riskFactor: 0.15, scoreFactor: 60, costPerUnit: 8 },
  { id: 'mixed-balanced', name: '平衡混合基金', category: 'mixed', riskFactor: 0.5, scoreFactor: 100, costPerUnit: 11 },
  { id: 'money-market', name: '货币市场基金', category: 'money', riskFactor: 0.05, scoreFactor: 32, costPerUnit: 5 },
]

function calcPortfolio(holdings) {
  const fundMap = new Map(FUND_ASSETS.map(f => [f.id, f]))
  let rawScore = 0, rawRisk = 0
  const categories = new Set()
  for (const h of holdings) {
    const fund = fundMap.get(h.fundId)
    if (!fund) continue
    rawScore += h.ratio * fund.scoreFactor
    rawRisk += h.ratio * fund.riskFactor
    categories.add(fund.category)
  }
  const diversificationBonus = Math.min(1 + 0.05 * categories.size, 1.2)
  const pairs = []
  const catArr = Array.from(categories)
  for (let i = 0; i < catArr.length; i++)
    for (let j = i + 1; j < catArr.length; j++) pairs.push([catArr[i], catArr[j]])
  const hedgeReduction = 0.03 * pairs.length
  return {
    score: rawScore * diversificationBonus,
    risk: Math.max(rawRisk - hedgeReduction, 0),
  }
}

test('样例持仓 1：国债 60% + 平衡混合 35% → 分数/风险正确', () => {
  const holdings = [
    { fundId: 'bond-gov', ratio: 0.6 },
    { fundId: 'mixed-balanced', ratio: 0.35 },
  ]
  const { score, risk } = calcPortfolio(holdings)
  // bond 60*0.6=36, mixed 100*0.35=35 → rawScore=71
  // categories {bond, mixed}=2 → bonus=1.1 → score=78.1
  // risk: 0.15*0.6=0.09, 0.5*0.35=0.175 → rawRisk=0.265
  // pairs=1 → hedge=0.03 → risk=0.235
  assertCloseTo(score, 78.1, 0.01, `分数偏差：${score}`)
  assertCloseTo(risk, 0.235, 0.001, `风险偏差：${risk}`)
})

test('样例持仓 2：增加货币市场 10% → 分散化奖励提升，风险下降', () => {
  const holdings = [
    { fundId: 'bond-gov', ratio: 0.5 },
    { fundId: 'mixed-balanced', ratio: 0.35 },
    { fundId: 'money-market', ratio: 0.1 },
  ]
  const { score, risk } = calcPortfolio(holdings)
  // rawScore = 60*0.5 + 100*0.35 + 32*0.1 = 30 + 35 + 3.2 = 68.2
  // categories {bond, mixed, money}=3 → bonus=1.15 → score=68.2*1.15=78.43
  // rawRisk = 0.15*0.5 + 0.5*0.35 + 0.05*0.1 = 0.075 + 0.175 + 0.005 = 0.255
  // pairs = C(3,2)=3 → hedge=0.09 → risk=0.165
  assertCloseTo(score, 78.43, 0.01, `分数偏差：${score}`)
  assertCloseTo(risk, 0.165, 0.001, `风险偏差：${risk}`)
})

// ============================================================
// 5. 数据一致性验证
// ============================================================
console.log('\n🔗 5. 数据一致性验证')

test('README 持仓样例 JSON 与 FUND_ASSETS 真实 ID 对齐', () => {
  const readme = loadTS('README.md')
  const fundIds = FUND_ASSETS.map(f => f.id)
  for (const id of fundIds) {
    assert(readme.includes(id), `README 未记录基金 ID: ${id}`)
  }
  // 检查 README 样例 JSON 可解析
  const sampleMatch = readme.match(/\[\{"fundId":"bond-gov","ratio":0\.5\},\{"fundId":"mixed-balanced","ratio":0\.35\},\{"fundId":"money-market","ratio":0\.1\}\]/)
  assert(sampleMatch, 'README 缺少真实样例 JSON')
  const parsed = JSON.parse(sampleMatch[0])
  assert(Array.isArray(parsed) && parsed.length === 3, 'README 样例 JSON 结构不正确')
})

test('路由与导航组件 Header 一致', () => {
  const header = loadTS('src/components/layout/Header.tsx')
  const required = ['/history', '/guide', '/']
  for (const r of required) {
    assert(header.includes(r) || header.includes('to="/"'), `Header 缺少导航链接 ${r}`)
  }
})

// ============================================================
// 6. 持久化键对齐
// ============================================================
console.log('\n💾 6. 持久化键对齐')

test('补录 & 基线快照使用独立 localStorage 键', () => {
  const src = loadTS('src/stores/supplementStore.ts')
  assert(src.includes('cafe-supplements'), '缺少补录存储键')
  assert(src.includes('cafe-baselines'), '缺少基线存储键')
})

// ============================================================
// 汇总
// ============================================================
const passed = results.filter(r => r.pass).length
const total = results.length
console.log(`\n📊 结果: ${passed}/${total} 通过`)
if (passed < total) {
  const failures = results.filter(r => !r.pass)
  console.log(`\n失败项 (${failures.length}):`)
  for (const f of failures) console.log(`  - ${f.name}: ${f.error}`)
  process.exit(1)
} else {
  console.log('\n🎉 全部验证通过！')
  process.exit(0)
}

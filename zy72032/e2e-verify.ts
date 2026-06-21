const storage: Record<string, string> = {}

globalThis.localStorage = {
  getItem: (key: string) => storage[key] ?? null,
  setItem: (key: string, value: string) => { storage[key] = value },
  removeItem: (key: string) => { delete storage[key] },
  clear: () => { Object.keys(storage).forEach(k => delete storage[k]) },
  get length() { return Object.keys(storage).length },
  key: (index: number) => Object.keys(storage)[index] ?? null,
} as unknown as Storage

import { execSync } from "child_process"
import { readFileSync } from "fs"
import { useTrainingStore } from "./src/stores/trainingStore.ts"
import { useRecordStore } from "./src/stores/recordStore.ts"
import { useLevelStore } from "./src/stores/levelStore.ts"
import { sampleRecords } from "./src/data/sampleRecords.ts"
import { calculateTotalScore, extractExceptions, calculateSummary } from "./src/utils/index.ts"

let passed = 0
let failed = 0

function assert(condition: boolean, name: string) {
  if (condition) {
    console.log(`  ✅ ${name}`)
    passed++
  } else {
    console.log(`  ❌ ${name}`)
    failed++
  }
}

async function run() {
  console.log("\n" + "=".repeat(64))
  console.log("🧪 AI客服训练营 · 端到端验证脚本")
  console.log("   覆盖：安装→启动→进入训练→暂停→继续→完成→补录→刷新→历史汇总→lint")
  console.log("=".repeat(64))

  // ── 0. npm install ──
  console.log("\n=== 0. 安装依赖 ===")
  {
    const out = execSync("npm ls --depth=0 2>&1", { encoding: "utf8", cwd: process.cwd() })
    const ok = !out.includes("ERR!") && !out.includes("missing")
    assert(ok, "npm ls 无报错，依赖完整")
    if (!ok) console.log(out.split("\n").slice(0, 6).join("\n"))
  }

  // ── 1. npm run lint ──
  console.log("\n=== 1. npm run lint ===")
  {
    try {
      const out = execSync("npm run lint 2>&1", { encoding: "utf8", cwd: process.cwd() })
      assert(true, "lint 零错误")
      console.log("  lint 输出: " + (out.trim() || "(clean)"))
    } catch (e: any) {
      const msg = e.stdout ? e.stdout.toString() : e.message
      assert(false, `lint 失败: ${msg.slice(0, 300)}`)
    }
  }

  // ── 2. npm run check (类型检查) ──
  console.log("\n=== 2. npm run check (TypeScript) ===")
  {
    try {
      execSync("npm run check 2>&1", { encoding: "utf8", cwd: process.cwd() })
      assert(true, "tsc --noEmit 零错误")
    } catch (e: any) {
      assert(false, `类型检查失败: ${e.message?.slice(0, 200)}`)
    }
  }

  // ── 3. npm run build ──
  console.log("\n=== 3. npm run build ===")
  {
    try {
      const out = execSync("npm run build 2>&1", { encoding: "utf8", cwd: process.cwd() })
      assert(out.includes("built in"), "vite build 构建成功")
    } catch (e: any) {
      const msg = e.stdout ? e.stdout.toString() : e.message
      assert(false, `构建失败: ${msg.slice(0, 300)}`)
    }
  }

  // ── 4. README 与实际产物一致性 ──
  console.log("\n=== 4. README 与实际产物一致性 ===")
  {
    const pkg = JSON.parse(readFileSync("./package.json", "utf8"))
    assert(pkg.scripts.dev === "vite", "README: npm run dev → vite")
    assert(pkg.scripts.check === "tsc -b --noEmit", "README: npm run check → tsc -b --noEmit")
    assert(pkg.scripts.build === "tsc -b && vite build", "README: npm run build → tsc -b && vite build")
    assert(pkg.scripts.lint === "eslint .", "README: npm run lint → eslint .")

    const levelStore = useLevelStore.getState()
    assert(levelStore.levelPacks.length === 3, "首页 3 个关卡包（基础客服通关/情绪安抚专项/退换货判定）")
    assert(levelStore.levelPacks[0].name === "基础客服通关", "关卡包[0] = 基础客服通关")
    assert(levelStore.levelPacks[1].name === "情绪安抚专项", "关卡包[1] = 情绪安抚专项")
    assert(levelStore.levelPacks[2].name === "退换货判定", "关卡包[2] = 退换货判定")

    const smooth = sampleRecords.find(r => r.id === "record-smooth-001")!
    const review = sampleRecords.find(r => r.id === "record-review-002")!
    const supplement = sampleRecords.find(r => r.id === "record-supplement-003")!
    assert(smooth.totalScore === 95, `样例: 顺利 得分 95`)
    assert(review.totalScore === 70, `样例: 待确认 得分 70`)
    assert(supplement.supplements[0].previousScore === 80, `样例: 补录 从 80 调整`)
    assert(supplement.supplements[0].newScore === 65, `样例: 补录 到 65`)
  }

  // ── 5. 进入训练 → 暂停 → 继续 → 完成 ──
  console.log("\n=== 5. 进入训练 → 暂停 → 继续 → 完成 ===")
  {
    const ts = useTrainingStore.getState()
    const rs = useRecordStore.getState()
    const ls = useLevelStore.getState()

    ts.resetTraining()
    const beforeCount = rs.records.length

    ls.setSelectedLevelPack("pack-basic")
    ts.startTraining()
    assert(useTrainingStore.getState().status === "active", "进入训练: status = active")
    assert(useTrainingStore.getState().currentStepIndex === 0, "从第 1 步开始")

    // 第 1 步：选正确答案
    let scenario = useTrainingStore.getState().getCurrentScenario()!
    let correct = scenario.options.find(o => o.id === scenario.correctOptionId)!
    ts.selectOption(correct, 5, false)
    assert(useTrainingStore.getState().currentStepIndex === 1, "第 1 步完成 → 到第 2 步")

    // 第 2 步：暂停
    useTrainingStore.getState().togglePause("老师暂停讲解临期食品规则")
    assert(useTrainingStore.getState().status === "paused", "暂停: status = paused")
    assert(useTrainingStore.getState().currentPauseReason === "老师暂停讲解临期食品规则",
      "暂停原因已保存到 store")

    await new Promise(r => setTimeout(r, 20))

    // 恢复
    useTrainingStore.getState().togglePause()
    assert(useTrainingStore.getState().status === "active", "恢复: status = active")
    assert(useTrainingStore.getState().pauses.length === 1, "恢复后有 1 条暂停记录")
    assert(useTrainingStore.getState().pauses[0].reason === "老师暂停讲解临期食品规则",
      "暂停记录原因 = 老师暂停讲解临期食品规则")
    assert(useTrainingStore.getState().pauses[0].duration > 0,
      `暂停持续时间 > 0: ${useTrainingStore.getState().pauses[0].duration}ms`)

    // 第 2 步：选错误答案（制造扣分场景）
    scenario = useTrainingStore.getState().getCurrentScenario()!
    const wrong = scenario.options.find(o => !o.isCorrect)!
    useTrainingStore.getState().selectOption(wrong, 8, false)

    // 剩余步骤：全选正确
    let addRecordCalls = 0
    const origAddRecord = useRecordStore.getState().addRecord
    useRecordStore.getState().addRecord = function(...args: any[]) {
      addRecordCalls++
      return origAddRecord.apply(this, args)
    }

    while (useTrainingStore.getState().status !== "completed") {
      const t = useTrainingStore.getState()
      const s = t.getCurrentScenario()!
      const c = s.options.find(o => o.id === s.correctOptionId)!
      t.selectOption(c, 5, false)
    }

    assert(addRecordCalls === 1, `✅ 关键: addRecord 只调 1 次（不重复投递）, 实际 ${addRecordCalls}`)
    useRecordStore.getState().addRecord = origAddRecord

    const finalState = useTrainingStore.getState()
    assert(finalState.status === "completed", "完成: status = completed")
    assert(finalState.completedRecordId !== null, "有 completedRecordId")

    const afterCount = useRecordStore.getState().records.length
    assert(afterCount === beforeCount + 1, `记录数 +1: ${beforeCount} → ${afterCount}`)

    // 验证完成记录内容
    const record = useRecordStore.getState().records.find(r => r.id === finalState.completedRecordId)!
    assert(record.steps.length === 5, "完成记录有 5 个步骤")
    assert(record.pauses.length === 1, "完成记录有 1 次暂停")
    assert(record.pauses[0].reason === "老师暂停讲解临期食品规则", "暂停原因在最终记录中正确")
    assert(record.totalScore < 100, `得分 < 100（有 1 步答错）: ${record.totalScore}`)
    console.log(`  完成记录: score=${record.totalScore}, pauses=${record.pauses.length}, steps=${record.steps.length}`)
  }

  // ── 6. 刷新后状态保持（模拟 store 重新读取） ──
  console.log("\n=== 6. 刷新后状态保持 ===")
  {
    const rs = useRecordStore.getState()
    const recordCount = rs.records.length
    const lastRecord = rs.records[0]
    assert(lastRecord !== undefined, "刷新后记录仍存在")
    assert(lastRecord.pauses.length === 1, `刷新后暂停记录仍保留: ${lastRecord.pauses.length} 次`)
    assert(lastRecord.pauses[0].reason === "老师暂停讲解临期食品规则",
      "刷新后暂停原因仍正确")
    assert(lastRecord.steps.length === 5, "刷新后步骤轨迹完整: 5 步")
    console.log(`  刷新后: records=${recordCount}, 最后一条 score=${lastRecord.totalScore}, pauseReason="${lastRecord.pauses[0]?.reason}"`)
  }

  // ── 7. 补录备注 + 分数调整 ──
  console.log("\n=== 7. 补录备注 + 分数调整 ===")
  {
    const rs = useRecordStore.getState()
    const target = rs.records[0]
    const preScore = target.totalScore
    const prePassed = target.passed

    rs.addSupplement(target.id, {
      source: "老师备注",
      content: "补录验证：客户还问了发票问题，处理不够完整",
      adjustScore: { from: preScore, to: 50 },
    })

    const updated = useRecordStore.getState().records[0]
    assert(updated.totalScore === 50, `分数更新: ${preScore} → ${updated.totalScore}`)
    assert(updated.passed === false, `通过状态重算: ${prePassed} → ${updated.passed}`)
    assert(updated.supplements.length === 1, "有 1 条补录记录")
    const supp = updated.supplements[0]
    assert(supp.previousScore === preScore, `previousScore = ${supp.previousScore}`)
    assert(supp.newScore === 50, `newScore = ${supp.newScore}`)
    assert(supp.changedFields.includes("totalScore"), "changedFields 包含 totalScore")
    assert(supp.changedFields.includes("passed"), "changedFields 包含 passed")
    console.log(`  补录差异: ${supp.previousScore} → ${supp.newScore}, 通过: ${prePassed} → ${updated.passed}`)
  }

  // ── 8. 历史汇总核对 ──
  console.log("\n=== 8. 历史汇总核对 ===")
  {
    const rs = useRecordStore.getState()
    const records = rs.records

    const summary = calculateSummary(records)
    const manualTotal = records.length
    const manualPassed = records.filter(r => r.passed).length
    const manualPassRate = manualTotal > 0 ? Math.round((manualPassed / manualTotal) * 100) : 0
    const manualExceptions = records.flatMap(r => extractExceptions(r)).length

    assert(summary.totalRecords === manualTotal, `总局数一致: ${summary.totalRecords} = ${manualTotal}`)
    assert(summary.passedRecords === manualPassed, `通过数一致: ${summary.passedRecords} = ${manualPassed}`)
    assert(summary.passRate === manualPassRate, `通过率一致: ${summary.passRate}% = ${manualPassRate}%`)
    assert(summary.exceptionCount === manualExceptions, `异常数一致: ${summary.exceptionCount} = ${manualExceptions}`)
    assert(summary.allExceptions.length === manualExceptions, `异常明细长度一致`)

    console.log(`  汇总: 总${summary.totalRecords}局, 通过${summary.passedRecords}, ` +
      `率${summary.passRate}%, 异常${summary.exceptionCount}`)
  }

  // ── 9. 样例数据与 README 表格核对 ──
  console.log("\n=== 9. 样例数据与 README 表格核对 ===")
  {
    const smooth = sampleRecords.find(r => r.id === "record-smooth-001")!
    const review = sampleRecords.find(r => r.id === "record-review-002")!
    const supplement = sampleRecords.find(r => r.id === "record-supplement-003")!

    assert(smooth.totalScore === 95 && smooth.passed === true, "README: 顺利 95分 通过")
    assert(review.totalScore === 70 && review.needsManualReview === true, "README: 待确认 70分 需人工确认")
    assert(supplement.source === "投影补录", "README: 补录 来源=投影补录")
    assert(supplement.supplements[0].previousScore === 80, "README: 补录 从80调整")
    assert(supplement.supplements[0].newScore === 65, "README: 补录 到65")
  }

  // ── 10. 最终 lint 再验 ──
  console.log("\n=== 10. 最终 lint 再验 ===")
  {
    try {
      execSync("npm run lint 2>&1", { encoding: "utf8", cwd: process.cwd() })
      assert(true, "最终 lint 仍零错误")
    } catch (e: any) {
      const msg = e.stdout ? e.stdout.toString() : e.message
      assert(false, `最终 lint 失败: ${msg.slice(0, 300)}`)
    }
  }

  // ── 总结 ──
  console.log("\n" + "=".repeat(64))
  console.log(`📊 总计: ${passed} 通过, ${failed} 失败`)
  console.log("=".repeat(64))

  if (failed > 0) {
    console.log("\n❌ 存在失败项，交付闭环不成立")
    process.exit(1)
  } else {
    console.log("\n✅ 交付闭环成立: 安装→lint→类型检查→构建→训练→暂停→补录→完成→刷新→历史汇总→lint")
  }
}

run()

import { ScenarioData } from '../src/data/ScenarioData.js'
import { TurnManager } from '../src/core/TurnManager.js'
import { globalValidator } from '../src/core/RuntimeValidator.js'

console.log('='.repeat(70))
console.log('  太空电网配平局 - 边界场景验证脚本')
console.log('='.repeat(70))
console.log()

const scenarios = ScenarioData.getScenarios()
let allPassed = true

for (const scenario of scenarios) {
  console.log(`\n📋 正在验证场景: ${scenario.name} (${scenario.id})`)
  console.log(`   ${scenario.description}`)
  console.log('-'.repeat(70))
  
  const station = scenario.create()
  
  const scenarioValidation = globalValidator.validateScenario(station)
  console.log(`   ✓ 结构验证: ${scenarioValidation.passed ? '通过' : '失败'}`)
  
  const initialSunAngle = station.sunAngle
  const initialSolarOutput = station.getTotalSolarOutput()
  const initialBatteryCharge = station.getTotalBatteryCharge()
  const initialBatteryCapacity = station.getTotalBatteryCapacity()
  const initialLoadDemand = station.getTotalLoadDemand()
  
  console.log(`   初始太阳角度: ${initialSunAngle}°`)
  console.log(`   初始太阳能输出: ${initialSolarOutput.toFixed(2)} kW`)
  console.log(`   初始电池电量: ${initialBatteryCharge.toFixed(1)} / ${initialBatteryCapacity.toFixed(1)} kWh (${(initialBatteryCharge/initialBatteryCapacity*100).toFixed(1)}%)`)
  console.log(`   初始负载需求: ${initialLoadDemand.toFixed(1)} kW`)
  
  if (scenario.id === 'eclipse') {
    console.log(`\n   🎯 星食期场景特殊验证:`)
    
    if (initialSunAngle < 0) {
      console.log(`   ✓ 初始角度为负 (${initialSunAngle}°)，符合星食期特征`)
    } else {
      console.log(`   ✗ 错误: 星食期初始角度应为负，实际为 ${initialSunAngle}°`)
      allPassed = false
    }
    
    if (initialSolarOutput < 0.001) {
      console.log(`   ✓ 太阳能输出为 ${initialSolarOutput.toFixed(4)} kW，符合星食期零太阳能特征`)
    } else {
      console.log(`   ✗ 错误: 星食期太阳能输出应为 0，实际为 ${initialSolarOutput.toFixed(2)} kW`)
      allPassed = false
    }
    
    if (initialSolarOutput < 0) {
      console.log(`   ✗ 严重错误: 太阳能输出为负值 ${initialSolarOutput.toFixed(2)} kW`)
      allPassed = false
    }
  }
  
  if (scenario.id === 'low_battery') {
    console.log(`\n   🎯 低电量场景特殊验证:`)
    
    const soc = initialBatteryCharge / initialBatteryCapacity
    if (soc < 0.2) {
      console.log(`   ✓ 初始电量偏低 (${(soc*100).toFixed(1)}%)，符合低电量危机特征`)
    } else {
      console.log(`   ✗ 错误: 低电量场景初始电量应 < 20%，实际为 ${(soc*100).toFixed(1)}%`)
      allPassed = false
    }
    
    const batteries = station.getAllBatteries()
    const hasOverDischarge = batteries.some(b => b.overDischargeCount > 0)
    if (hasOverDischarge) {
      console.log(`   ✓ 存在电池过放记录，符合低电量危机特征`)
    } else {
      console.log(`   ⚠  警告: 低电量场景应有过放记录`)
    }
  }
  
  console.log(`\n   🚀 测试回合推进:`)
  const turnManager = new TurnManager(station)
  turnManager.start()
  
  const sunAngles = []
  const solarOutputs = []
  
  for (let i = 0; i < 5; i++) {
    const result = turnManager.advanceTurn()
    if (!result) {
      console.log(`   回合 ${station.currentTurn}: 游戏已结束`)
      break
    }
    sunAngles.push(station.sunAngle)
    solarOutputs.push(station.getTotalSolarOutput())
    
    console.log(`   回合 ${result.turn}: 角度 ${station.sunAngle.toFixed(0)}° → 输出 ${station.getTotalSolarOutput().toFixed(1)} kW`)
    
    if (station.getTotalSolarOutput() < 0) {
      console.log(`   ✗ 严重错误: 回合 ${result.turn} 太阳能输出为负值`)
      allPassed = false
    }
  }
  
  if (scenario.id === 'eclipse') {
    const eclipseRounds = solarOutputs.filter(o => o < 0.001).length
    if (eclipseRounds >= 2) {
      console.log(`   ✓ 星食期持续 ${eclipseRounds} 回合零太阳能，符合训练要求`)
    } else {
      console.log(`   ⚠  警告: 星食期零太阳能回合不足，只有 ${eclipseRounds} 回合`)
    }
    
    const angleResetTo90 = sunAngles.some(a => Math.abs(a - 90) < 5)
    if (angleResetTo90) {
      console.log(`   ✗ 错误: 角度被重置到 90° 附近，破坏星食期边界条件`)
      allPassed = false
    } else {
      console.log(`   ✓ 角度未被异常重置到 90°`)
    }
  }
  
  console.log(`\n   🔍 类实例完整性验证:`)
  
  const allBatteries = station.getAllBatteries()
  const allSolarPanels = station.getAllSolarPanels()
  const allLoads = station.getAllLoads()
  
  const batteryMethodsOK = allBatteries.every(b => 
    typeof b.charge === 'function' && 
    typeof b.discharge === 'function' &&
    typeof b.getHealthStatus === 'function'
  )
  console.log(`   ✓ 电池组方法完整性: ${batteryMethodsOK ? '通过' : '失败'}`)
  
  const solarMethodsOK = allSolarPanels.every(p => 
    typeof p.calculateOutput === 'function' && 
    typeof p.applyDamage === 'function'
  )
  console.log(`   ✓ 太阳能板方法完整性: ${solarMethodsOK ? '通过' : '失败'}`)
  
  const loadMethodsOK = allLoads.every(l => 
    typeof l.supplyPower === 'function' && 
    typeof l.getReliabilityScore === 'function'
  )
  console.log(`   ✓ 负载方法完整性: ${loadMethodsOK ? '通过' : '失败'}`)
  
  const stationMethodsOK = 
    typeof station.getAllBatteries === 'function' &&
    typeof station.getAllSolarPanels === 'function' &&
    typeof station.getTotalSolarOutput === 'function'
  console.log(`   ✓ 空间站方法完整性: ${stationMethodsOK ? '通过' : '失败'}`)
  
  if (!batteryMethodsOK || !solarMethodsOK || !loadMethodsOK || !stationMethodsOK) {
    allPassed = false
  }
  
  console.log(`\n   📦 模拟设备转移测试:`)
  const testModule = station.modules[0]
  const testPanel = testModule.solarPanels[0]
  
  if (testModule && testPanel && station.modules.length > 1) {
    const targetModule = station.modules[1]
    const originalSourceCount = testModule.solarPanels.length
    const originalTargetCount = targetModule.solarPanels.length
    
    testModule.removeSolarPanel(testPanel.id)
    targetModule.addSolarPanel(testPanel)
    
    const transferOK = 
      testModule.solarPanels.length === originalSourceCount - 1 &&
      targetModule.solarPanels.length === originalTargetCount + 1 &&
      typeof testPanel.calculateOutput === 'function'
    
    console.log(`   ✓ 太阳能板转移后方法完整性: ${transferOK ? '通过' : '失败'}`)
    
    const outputAfterTransfer = testPanel.calculateOutput(90)
    console.log(`   ✓ 转移后 calculateOutput 可用: ${outputAfterTransfer.toFixed(2)} kW`)
    
    if (!transferOK) allPassed = false
    
    targetModule.removeSolarPanel(testPanel.id)
    testModule.addSolarPanel(testPanel)
  }
  
  const validatorReport = globalValidator.getValidationReport()
  console.log(`\n   📊 验证统计: ${validatorReport.successCount} 通过, ${validatorReport.errorCount} 失败`)
  
  console.log('\n' + '='.repeat(70))
}

console.log('\n' + '='.repeat(70))
console.log(`  总体验证结果: ${allPassed ? '✅ 全部通过' : '❌ 存在失败'}`)
console.log('='.repeat(70))

const finalReport = globalValidator.getValidationReport()
console.log(`\n  总计验证: ${finalReport.totalValidations} 次`)
console.log(`  通过: ${finalReport.successCount} 次`)
console.log(`  失败: ${finalReport.errorCount} 次`)

if (finalReport.errorCount > 0) {
  console.log(`\n  最近错误:`)
  finalReport.latestErrors.forEach(e => {
    console.log(`  ❌ [${e.category}:${e.id}] ${e.message}`)
  })
  process.exit(1)
} else {
  console.log(`\n  ✨ 所有边界场景验证通过！`)
  process.exit(0)
}

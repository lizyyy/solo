import { SolarPanel } from '../models/SolarPanel.js'
import { Battery } from '../models/Battery.js'
import { Load } from '../models/Load.js'
import { Module } from '../models/Module.js'
import { SpaceStation } from '../models/SpaceStation.js'

export class ValidationResult {
  constructor(passed, message, details = {}) {
    this.passed = passed
    this.message = message
    this.details = details
    this.timestamp = new Date()
  }
}

export class RuntimeValidator {
  constructor() {
    this.validationLog = []
    this.errorCount = 0
  }

  validateSolarPanel(panel) {
    const checks = [
      { check: () => panel instanceof SolarPanel, message: '不是 SolarPanel 类实例' },
      { check: () => typeof panel.calculateOutput === 'function', message: '缺少 calculateOutput 方法' },
      { check: () => typeof panel.applyDamage === 'function', message: '缺少 applyDamage 方法' },
      { check: () => typeof panel.repair === 'function', message: '缺少 repair 方法' },
      { check: () => typeof panel.id === 'string' && panel.id.length > 0, message: 'id 属性无效' },
      { check: () => typeof panel.maxOutput === 'number' && panel.maxOutput >= 0, message: 'maxOutput 属性无效' }
    ]

    for (const check of checks) {
      if (!check.check()) {
        this.logError('SolarPanel', panel.id, check.message)
        return new ValidationResult(false, check.message, { device: panel.id })
      }
    }

    const testOutput = panel.calculateOutput(90)
    if (testOutput < 0) {
      this.logError('SolarPanel', panel.id, `calculateOutput 返回负值: ${testOutput}`)
      return new ValidationResult(false, 'calculateOutput 返回负值', { device: panel.id, output: testOutput })
    }

    return new ValidationResult(true, '太阳能板验证通过', { device: panel.id, testOutput })
  }

  validateBattery(battery) {
    const checks = [
      { check: () => battery instanceof Battery, message: '不是 Battery 类实例' },
      { check: () => typeof battery.charge === 'function', message: '缺少 charge 方法' },
      { check: () => typeof battery.discharge === 'function', message: '缺少 discharge 方法' },
      { check: () => typeof battery.getHealthStatus === 'function', message: '缺少 getHealthStatus 方法' },
      { check: () => typeof battery.stateOfCharge === 'number', message: 'stateOfCharge getter 无效' },
      { check: () => typeof battery.id === 'string' && battery.id.length > 0, message: 'id 属性无效' }
    ]

    for (const check of checks) {
      if (!check.check()) {
        this.logError('Battery', battery.id, check.message)
        return new ValidationResult(false, check.message, { device: battery.id })
      }
    }

    return new ValidationResult(true, '电池组验证通过', { device: battery.id, soc: battery.stateOfCharge })
  }

  validateLoad(load) {
    const checks = [
      { check: () => load instanceof Load, message: '不是 Load 类实例' },
      { check: () => typeof load.supplyPower === 'function', message: '缺少 supplyPower 方法' },
      { check: () => typeof load.getReliabilityScore === 'function', message: '缺少 getReliabilityScore 方法' },
      { check: () => typeof load.getStatusText === 'function', message: '缺少 getStatusText 方法' },
      { check: () => typeof load.id === 'string' && load.id.length > 0, message: 'id 属性无效' },
      { check: () => typeof load.powerDemand === 'number' && load.powerDemand > 0, message: 'powerDemand 属性无效' }
    ]

    for (const check of checks) {
      if (!check.check()) {
        this.logError('Load', load.id, check.message)
        return new ValidationResult(false, check.message, { device: load.id })
      }
    }

    return new ValidationResult(true, '负载验证通过', { device: load.id })
  }

  validateModule(module) {
    const checks = [
      { check: () => module instanceof Module, message: '不是 Module 类实例' },
      { check: () => typeof module.getTotalSolarOutput === 'function', message: '缺少 getTotalSolarOutput 方法' },
      { check: () => typeof module.getTotalBatteryCapacity === 'function', message: '缺少 getTotalBatteryCapacity 方法' },
      { check: () => typeof module.getTotalLoadDemand === 'function', message: '缺少 getTotalLoadDemand 方法' },
      { check: () => Array.isArray(module.solarPanels), message: 'solarPanels 不是数组' },
      { check: () => Array.isArray(module.batteries), message: 'batteries 不是数组' },
      { check: () => Array.isArray(module.loads), message: 'loads 不是数组' }
    ]

    for (const check of checks) {
      if (!check.check()) {
        this.logError('Module', module.id, check.message)
        return new ValidationResult(false, check.message, { module: module.id })
      }
    }

    for (const panel of module.solarPanels) {
      const result = this.validateSolarPanel(panel)
      if (!result.passed) return result
    }

    for (const battery of module.batteries) {
      const result = this.validateBattery(battery)
      if (!result.passed) return result
    }

    for (const load of module.loads) {
      const result = this.validateLoad(load)
      if (!result.passed) return result
    }

    return new ValidationResult(true, '舱段验证通过', { module: module.id })
  }

  validateStation(station) {
    const checks = [
      { check: () => station instanceof SpaceStation, message: '不是 SpaceStation 类实例' },
      { check: () => typeof station.getAllSolarPanels === 'function', message: '缺少 getAllSolarPanels 方法' },
      { check: () => typeof station.getAllBatteries === 'function', message: '缺少 getAllBatteries 方法' },
      { check: () => typeof station.getAllLoads === 'function', message: '缺少 getAllLoads 方法' },
      { check: () => typeof station.getTotalSolarOutput === 'function', message: '缺少 getTotalSolarOutput 方法' },
      { check: () => Array.isArray(station.modules), message: 'modules 不是数组' }
    ]

    for (const check of checks) {
      if (!check.check()) {
        this.logError('SpaceStation', station.id, check.message)
        return new ValidationResult(false, check.message, { station: station.id })
      }
    }

    for (const module of station.modules) {
      const result = this.validateModule(module)
      if (!result.passed) return result
    }

    return new ValidationResult(true, '空间站验证通过', { station: station.id })
  }

  validateAfterTransfer(station, transferInfo) {
    const stationResult = this.validateStation(station)
    if (!stationResult.passed) {
      return new ValidationResult(false, '设备转移后验证失败', {
        transfer: transferInfo,
        error: stationResult.message
      })
    }

    this.logSuccess('TransferValidation', `设备转移验证通过: ${transferInfo.type} ${transferInfo.device?.id || 'unknown'}`)
    return new ValidationResult(true, '设备转移后验证通过', { transfer: transferInfo })
  }

  validateScenario(station) {
    const results = []
    
    results.push({
      name: '空间站结构',
      result: this.validateStation(station)
    })

    const solarOutput = station.getTotalSolarOutput()
    results.push({
      name: '太阳能输出非负',
      result: new ValidationResult(
        solarOutput >= 0,
        solarOutput >= 0 ? `太阳能输出正常: ${solarOutput.toFixed(2)} kW` : `太阳能输出为负: ${solarOutput}`,
        { solarOutput, sunAngle: station.sunAngle }
      )
    })

    const batteryCharge = station.getTotalBatteryCharge()
    const batteryCapacity = station.getTotalBatteryCapacity()
    results.push({
      name: '电池电量合理',
      result: new ValidationResult(
        batteryCharge >= 0 && batteryCharge <= batteryCapacity,
        `电池电量: ${batteryCharge.toFixed(1)} / ${batteryCapacity.toFixed(1)} kWh`,
        { batteryCharge, batteryCapacity }
      )
    })

    const loadDemand = station.getTotalLoadDemand()
    results.push({
      name: '负载需求正常',
      result: new ValidationResult(
        loadDemand > 0,
        `总负载需求: ${loadDemand.toFixed(1)} kW`,
        { loadDemand }
      )
    })

    results.push({
      name: '太阳角度合理',
      result: new ValidationResult(
        !isNaN(station.sunAngle) && isFinite(station.sunAngle),
        `太阳角度: ${station.sunAngle}°`,
        { sunAngle: station.sunAngle }
      )
    })

    const allPassed = results.every(r => r.result.passed)
    
    return {
      passed: allPassed,
      results,
      summary: allPassed ? '场景验证全部通过' : '场景存在验证失败'
    }
  }

  logError(type, id, message) {
    this.errorCount++
    this.validationLog.push({
      type: 'error',
      category: type,
      id,
      message,
      timestamp: new Date()
    })
    console.error(`❌ [${type}:${id}] ${message}`)
  }

  logSuccess(type, message) {
    this.validationLog.push({
      type: 'success',
      category: type,
      message,
      timestamp: new Date()
    })
    console.log(`✅ [${type}] ${message}`)
  }

  getValidationReport() {
    const errors = this.validationLog.filter(l => l.type === 'error')
    const successes = this.validationLog.filter(l => l.type === 'success')
    
    return {
      totalValidations: this.validationLog.length,
      errorCount: this.errorCount,
      successCount: successes.length,
      errors: errors,
      latestErrors: errors.slice(-10),
      latestSuccesses: successes.slice(-10)
    }
  }

  clear() {
    this.validationLog = []
    this.errorCount = 0
  }
}

export const globalValidator = new RuntimeValidator()

export function validateLayout(layout) {
  const errors = []
  const warnings = []
  
  if (!layout || typeof layout !== 'object') {
    errors.push('场地布局数据格式错误')
    return { valid: false, errors, warnings }
  }
  
  if (!Array.isArray(layout.entrances) || layout.entrances.length === 0) {
    errors.push('缺少入口配置')
  } else {
    const entranceIds = new Set()
    layout.entrances.forEach((entrance, index) => {
      if (!entrance.id) {
        errors.push(`入口 #${index + 1} 缺少 ID`)
      } else if (entranceIds.has(entrance.id)) {
        errors.push(`入口 ID 重复: ${entrance.id}`)
      } else {
        entranceIds.add(entrance.id)
      }
      
      if (!entrance.name) {
        warnings.push(`入口 ${entrance.id || '#' + (index + 1)} 缺少名称`)
      }
      
      if (entrance.maxCapacity === undefined || entrance.maxCapacity === null) {
        errors.push(`入口 ${entrance.id || '#' + (index + 1)} 缺少最大容量`)
      } else if (typeof entrance.maxCapacity !== 'number') {
        errors.push(`入口 ${entrance.id || '#' + (index + 1)} 最大容量必须是数字`)
      } else if (entrance.maxCapacity <= 0) {
        errors.push(`入口 ${entrance.id || '#' + (index + 1)} 最大容量必须大于 0`)
      }
      
      if (entrance.currentFlow !== undefined) {
        if (typeof entrance.currentFlow !== 'number') {
          errors.push(`入口 ${entrance.id || '#' + (index + 1)} 当前流量必须是数字`)
        } else if (entrance.currentFlow < 0) {
          errors.push(`入口 ${entrance.id || '#' + (index + 1)} 当前流量不能为负数`)
        } else if (entrance.maxCapacity && entrance.currentFlow > entrance.maxCapacity) {
          warnings.push(`入口 ${entrance.id || '#' + (index + 1)} 当前流量超过最大容量`)
        }
      }
    })
  }
  
  if (!Array.isArray(layout.tentZones) || layout.tentZones.length === 0) {
    errors.push('缺少帐篷区配置')
  } else {
    const tentIds = new Set()
    layout.tentZones.forEach((tent, index) => {
      if (!tent.id) {
        errors.push(`帐篷区 #${index + 1} 缺少 ID`)
      } else if (tentIds.has(tent.id)) {
        errors.push(`帐篷区 ID 重复: ${tent.id}`)
      } else {
        tentIds.add(tent.id)
      }
      
      if (!tent.name) {
        warnings.push(`帐篷区 ${tent.id || '#' + (index + 1)} 缺少名称`)
      }
      
      if (tent.capacity === undefined || tent.capacity === null) {
        errors.push(`帐篷区 ${tent.id || '#' + (index + 1)} 缺少容量配置`)
      } else if (typeof tent.capacity !== 'number') {
        errors.push(`帐篷区 ${tent.id || '#' + (index + 1)} 容量必须是数字`)
      } else if (tent.capacity <= 0) {
        errors.push(`帐篷区 ${tent.id || '#' + (index + 1)} 容量必须大于 0`)
      }
      
      if (tent.currentOccupancy !== undefined) {
        if (typeof tent.currentOccupancy !== 'number') {
          errors.push(`帐篷区 ${tent.id || '#' + (index + 1)} 当前入住人数必须是数字`)
        } else if (tent.currentOccupancy < 0) {
          errors.push(`帐篷区 ${tent.id || '#' + (index + 1)} 当前入住人数不能为负数`)
        } else if (tent.capacity && tent.currentOccupancy > tent.capacity) {
          errors.push(`帐篷区 ${tent.id || '#' + (index + 1)} 当前入住人数超过容量`)
        }
      }
    })
  }
  
  if (!Array.isArray(layout.supplyPoints) || layout.supplyPoints.length === 0) {
    warnings.push('缺少物资点配置，物资可达性分析将不可用')
  } else {
    const supplyIds = new Set()
    layout.supplyPoints.forEach((supply, index) => {
      if (!supply.id) {
        errors.push(`物资点 #${index + 1} 缺少 ID`)
      } else if (supplyIds.has(supply.id)) {
        errors.push(`物资点 ID 重复: ${supply.id}`)
      } else {
        supplyIds.add(supply.id)
      }
      
      if (!supply.name) {
        warnings.push(`物资点 ${supply.id || '#' + (index + 1)} 缺少名称`)
      }
      
      if (!Array.isArray(supply.supplies) || supply.supplies.length === 0) {
        warnings.push(`物资点 ${supply.id || '#' + (index + 1)} 缺少物资类型配置`)
      }
    })
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

export function validateInflowScenario(scenario) {
  const errors = []
  const warnings = []
  
  if (!scenario || typeof scenario !== 'object') {
    errors.push('流入场景数据格式错误')
    return { valid: false, errors, warnings }
  }
  
  if (!Array.isArray(scenario.timeSteps) || scenario.timeSteps.length === 0) {
    errors.push('缺少时间步配置')
    return { valid: false, errors, warnings }
  }
  
  scenario.timeSteps.forEach((step, index) => {
    if (!step.time) {
      errors.push(`时间步 #${index + 1} 缺少时间标识`)
    }
    
    if (step.inflow === undefined || step.inflow === null) {
      errors.push(`时间步 ${step.time || '#' + (index + 1)} 缺少流入人数`)
    } else if (typeof step.inflow !== 'number') {
      errors.push(`时间步 ${step.time || '#' + (index + 1)} 流入人数必须是数字`)
    } else if (step.inflow < 0) {
      errors.push(`时间步 ${step.time || '#' + (index + 1)} 流入人数不能为负数`)
    }
    
    if (!step.entrance) {
      errors.push(`时间步 ${step.time || '#' + (index + 1)} 缺少指定入口`)
    }
  })
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

export function calculateEntranceCongestion(entrance) {
  if (!entrance.maxCapacity || entrance.maxCapacity <= 0) {
    return { level: 'unknown', percentage: 0, message: '入口容量数据无效' }
  }
  
  const currentFlow = entrance.currentFlow || 0
  const percentage = (currentFlow / entrance.maxCapacity) * 100
  
  let level, message
  if (percentage >= 100) {
    level = 'critical'
    message = `${entrance.name}: 严重拥堵！流量 ${currentFlow} 人超过容量 ${entrance.maxCapacity} 人`
  } else if (percentage >= 80) {
    level = 'warning'
    message = `${entrance.name}: 即将拥堵！流量 ${currentFlow} 人接近容量 ${entrance.maxCapacity} 人 (${percentage.toFixed(0)}%)`
  } else if (percentage >= 50) {
    level = 'caution'
    message = `${entrance.name}: 流量适中 (${percentage.toFixed(0)}%)`
  } else {
    level = 'normal'
    message = `${entrance.name}: 流量正常 (${percentage.toFixed(0)}%)`
  }
  
  return { level, percentage, message, currentFlow, maxCapacity: entrance.maxCapacity }
}

export function calculateTentZoneUtilization(tentZone) {
  if (!tentZone.capacity || tentZone.capacity <= 0) {
    return { level: 'unknown', percentage: 0, message: '帐篷区容量数据无效' }
  }
  
  const currentOccupancy = tentZone.currentOccupancy || 0
  const percentage = (currentOccupancy / tentZone.capacity) * 100
  
  let level, message
  if (percentage >= 100) {
    level = 'critical'
    message = `${tentZone.name}: 容量已满！入住 ${currentOccupancy} 人超过容量 ${tentZone.capacity} 人`
  } else if (percentage >= 85) {
    level = 'warning'
    message = `${tentZone.name}: 即将满员！入住 ${currentOccupancy} 人接近容量 ${tentZone.capacity} 人 (${percentage.toFixed(0)}%)`
  } else if (percentage >= 60) {
    level = 'caution'
    message = `${tentZone.name}: 入住率较高 (${percentage.toFixed(0)}%)`
  } else {
    level = 'normal'
    message = `${tentZone.name}: 容量充足 (${percentage.toFixed(0)}%)`
  }
  
  return { level, percentage, message, currentOccupancy, capacity: tentZone.capacity }
}

export function calculateSupplyAccessibility(layout) {
  if (!Array.isArray(layout.supplyPoints) || layout.supplyPoints.length === 0) {
    return { overallLevel: 'unknown', zones: [], message: '缺少物资点配置' }
  }
  
  if (!Array.isArray(layout.tentZones) || layout.tentZones.length === 0) {
    return { overallLevel: 'unknown', zones: [], message: '缺少帐篷区配置' }
  }
  
  const pathMap = new Map()
  if (Array.isArray(layout.paths)) {
    layout.paths.forEach(path => {
      const key1 = `${path.from}-${path.to}`
      const key2 = `${path.to}-${path.from}`
      pathMap.set(key1, path.distance)
      pathMap.set(key2, path.distance)
    })
  }
  
  const zoneResults = layout.tentZones.map(tentZone => {
    const suppliesByType = {}
    let totalDistance = 0
    let connectedCount = 0
    
    layout.supplyPoints.forEach(supplyPoint => {
      const key = `${tentZone.id}-${supplyPoint.id}`
      const distance = pathMap.get(key)
      
      if (distance !== undefined) {
        connectedCount++
        totalDistance += distance
        
        supplyPoint.supplies.forEach(supplyType => {
          if (!suppliesByType[supplyType]) {
            suppliesByType[supplyType] = []
          }
          suppliesByType[supplyType].push({
            supplyPointId: supplyPoint.id,
            supplyPointName: supplyPoint.name,
            distance
          })
        })
      }
    })
    
    const criticalDistance = 100
    const warningDistance = 70
    
    let level = 'normal'
    let issues = []
    
    if (connectedCount === 0) {
      level = 'critical'
      issues.push(`${tentZone.name} 未连接任何物资点`)
    } else {
      const avgDistance = totalDistance / connectedCount
      
      if (avgDistance > criticalDistance) {
        level = 'critical'
        issues.push(`${tentZone.name} 到物资点平均距离过远: ${avgDistance.toFixed(1)}米`)
      } else if (avgDistance > warningDistance) {
        level = 'warning'
        issues.push(`${tentZone.name} 到物资点平均距离较远: ${avgDistance.toFixed(1)}米`)
      }
      
      const allSupplies = ['water', 'food', 'medicine', 'first-aid', 'blanket']
      const missingSupplies = allSupplies.filter(type => !suppliesByType[type])
      
      if (missingSupplies.length > 0) {
        level = level === 'normal' ? 'warning' : level
        const supplyNames = {
          water: '饮用水',
          food: '食品',
          medicine: '药品',
          'first-aid': '急救用品',
          blanket: '毛毯'
        }
        issues.push(`缺少物资类型: ${missingSupplies.map(s => supplyNames[s] || s).join(', ')}`)
      }
    }
    
    return {
      tentZoneId: tentZone.id,
      tentZoneName: tentZone.name,
      level,
      connectedSupplyCount: connectedCount,
      totalSupplyCount: layout.supplyPoints.length,
      issues,
      suppliesByType
    }
  })
  
  const criticalCount = zoneResults.filter(r => r.level === 'critical').length
  const warningCount = zoneResults.filter(r => r.level === 'warning').length
  
  let overallLevel = 'normal'
  let overallMessage = '物资可达性良好'
  
  if (criticalCount > 0) {
    overallLevel = 'critical'
    overallMessage = `${criticalCount} 个帐篷区物资可达性严重不足`
  } else if (warningCount > 0) {
    overallLevel = 'warning'
    overallMessage = `${warningCount} 个帐篷区物资可达性需要关注`
  }
  
  return {
    overallLevel,
    overallMessage,
    zones: zoneResults
  }
}

export function simulateInflow(layout, scenario) {
  const layoutCopy = JSON.parse(JSON.stringify(layout))
  const results = []
  
  const entranceMap = new Map()
  layoutCopy.entrances.forEach(e => entranceMap.set(e.id, e))
  
  const tentZoneMap = new Map()
  layoutCopy.tentZones.forEach(t => tentZoneMap.set(t.id, t))
  
  const currentState = {
    entrances: new Map(),
    tentZones: new Map(),
    totalInflow: 0
  }
  
  layoutCopy.entrances.forEach(e => {
    currentState.entrances.set(e.id, { currentFlow: e.currentFlow || 0, maxCapacity: e.maxCapacity })
  })
  
  layoutCopy.tentZones.forEach(t => {
    currentState.tentZones.set(t.id, { currentOccupancy: t.currentOccupancy || 0, capacity: t.capacity, connectedEntrances: t.connectedEntrances || [] })
  })
  
  scenario.timeSteps.forEach((step, stepIndex) => {
    const stepResult = {
      stepIndex,
      time: step.time,
      inflow: step.inflow,
      targetEntrance: step.entrance,
      issues: [],
      newEntranceStates: [],
      newTentZoneStates: []
    }
    
    if (step.entrance && currentState.entrances.has(step.entrance)) {
      const entrance = currentState.entrances.get(step.entrance)
      const newFlow = entrance.currentFlow + step.inflow
      
      if (newFlow > entrance.maxCapacity) {
        stepResult.issues.push({
          type: 'entrance_congestion',
          severity: 'critical',
          message: `入口 ${step.entrance} 拥堵: 新增 ${step.inflow} 人后流量 ${newFlow} 超过容量 ${entrance.maxCapacity}`
        })
      } else if (newFlow > entrance.maxCapacity * 0.8) {
        stepResult.issues.push({
          type: 'entrance_congestion',
          severity: 'warning',
          message: `入口 ${step.entrance} 即将拥堵: 新增 ${step.inflow} 人后流量 ${newFlow} 达到容量的 ${((newFlow/entrance.maxCapacity)*100).toFixed(0)}%`
        })
      }
      
      entrance.currentFlow = newFlow
      stepResult.newEntranceStates.push({
        entranceId: step.entrance,
        currentFlow: newFlow,
        maxCapacity: entrance.maxCapacity,
        utilizationRate: (newFlow / entrance.maxCapacity) * 100
      })
      
      const availableTents = Array.from(currentState.tentZones.entries())
        .filter(([_, tent]) => {
          if (!tent.connectedEntrances || tent.connectedEntrances.length === 0) return false
          return tent.connectedEntrances.includes(step.entrance)
        })
        .map(([id, tent]) => ({
          id,
          remainingCapacity: tent.capacity - tent.currentOccupancy,
          currentOccupancy: tent.currentOccupancy,
          capacity: tent.capacity,
          tent
        }))
        .sort((a, b) => b.remainingCapacity - a.remainingCapacity)
      
      let remainingPeople = step.inflow
      
      if (availableTents.length === 0) {
        stepResult.issues.push({
          type: 'tent_zone_shortage',
          severity: 'critical',
          message: `入口 ${step.entrance} 没有可分配的帐篷区，${step.inflow} 人无法安置`
        })
      } else {
        for (const tent of availableTents) {
          if (remainingPeople <= 0) break
          
          const canAccept = Math.min(tent.remainingCapacity, remainingPeople)
          tent.tent.currentOccupancy += canAccept
          remainingPeople -= canAccept
          
          const newOccupancy = tent.tent.currentOccupancy
          const utilizationRate = (newOccupancy / tent.capacity) * 100
          
          if (newOccupancy >= tent.capacity) {
            stepResult.issues.push({
              type: 'tent_zone_full',
              severity: 'critical',
              message: `帐篷区 ${tent.id} 已满员`
            })
          } else if (utilizationRate >= 85) {
            stepResult.issues.push({
              type: 'tent_zone_warning',
              severity: 'warning',
              message: `帐篷区 ${tent.id} 即将满员 (${utilizationRate.toFixed(0)}%)`
            })
          }
          
          stepResult.newTentZoneStates.push({
            tentZoneId: tent.id,
            currentOccupancy: newOccupancy,
            capacity: tent.capacity,
            utilizationRate
          })
        }
        
        if (remainingPeople > 0) {
          stepResult.issues.push({
            type: 'tent_zone_shortage',
            severity: 'critical',
            message: `帐篷区容量不足！还有 ${remainingPeople} 人无法安置`
          })
        }
      }
    } else {
      stepResult.issues.push({
        type: 'entrance_not_found',
        severity: 'error',
        message: `入口 ${step.entrance} 不存在`
      })
    }
    
    currentState.totalInflow += step.inflow
    stepResult.totalInflow = currentState.totalInflow
    
    results.push(stepResult)
  })
  
  const finalState = {
    entrances: Array.from(currentState.entrances.entries()).map(([id, e]) => ({
      id,
      currentFlow: e.currentFlow,
      maxCapacity: e.maxCapacity,
      utilizationRate: (e.currentFlow / e.maxCapacity) * 100
    })),
    tentZones: Array.from(currentState.tentZones.entries()).map(([id, t]) => ({
      id,
      currentOccupancy: t.currentOccupancy,
      capacity: t.capacity,
      utilizationRate: (t.currentOccupancy / t.capacity) * 100
    })),
    totalInflow: currentState.totalInflow,
    totalCapacity: layoutCopy.tentZones.reduce((sum, t) => sum + t.capacity, 0)
  }
  
  finalState.overallUtilizationRate = (currentState.totalInflow / finalState.totalCapacity) * 100
  
  return {
    stepResults: results,
    finalState
  }
}

export function generateRiskReport(layout, scenario, simulationResult) {
  const risks = []
  
  simulationResult.stepResults.forEach(step => {
    step.issues.forEach(issue => {
      risks.push({
        type: issue.type,
        severity: issue.severity,
        time: step.time,
        message: issue.message
      })
    })
  })
  
  const criticalRisks = risks.filter(r => r.severity === 'critical')
  const warningRisks = risks.filter(r => r.severity === 'warning')
  const errorRisks = risks.filter(r => r.severity === 'error')
  
  const final = simulationResult.finalState
  const overCapacityEntrances = final.entrances.filter(e => e.utilizationRate >= 100)
  const congestedEntrances = final.entrances.filter(e => e.utilizationRate >= 80 && e.utilizationRate < 100)
  const fullTents = final.tentZones.filter(t => t.utilizationRate >= 100)
  const nearFullTents = final.tentZones.filter(t => t.utilizationRate >= 85 && t.utilizationRate < 100)
  
  let overallStatus = 'safe'
  let overallMessage = '演练结果安全，所有指标正常'
  
  if (errorRisks.length > 0 || criticalRisks.length > 0 || overCapacityEntrances.length > 0 || fullTents.length > 0) {
    overallStatus = 'fail'
    overallMessage = '演练失败！存在严重风险点，需要立即调整'
  } else if (warningRisks.length > 0 || congestedEntrances.length > 0 || nearFullTents.length > 0) {
    overallStatus = 'warning'
    overallMessage = '演练有风险！存在需要关注的问题'
  }
  
  return {
    overallStatus,
    overallMessage,
    allRisks: risks,
    criticalRisks,
    warningRisks,
    errorRisks,
    statistics: {
      totalInflow: final.totalInflow,
      totalCapacity: final.totalCapacity,
      overallUtilizationRate: final.overallUtilizationRate,
      overCapacityEntrances: overCapacityEntrances.length,
      congestedEntrances: congestedEntrances.length,
      fullTents: fullTents.length,
      nearFullTents: nearFullTents.length
    }
  }
}

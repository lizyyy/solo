function parseTime(timeStr) {
  if (!timeStr) return 0
  const parts = timeStr.split(':')
  return parseInt(parts[0] || 0) * 3600 + 
         parseInt(parts[1] || 0) * 60 + 
         (parseInt(parts[2] || 0))
}

function timeOverlaps(time1, time2) {
  const start1 = parseTime(time1.startTime || time1.time)
  const end1 = parseTime(time1.endTime || time1.time) + 30
  const start2 = parseTime(time2.startTime || time2.time)
  const end2 = parseTime(time2.endTime || time2.time) + 30
  
  return !(end1 < start2 || end2 < start1)
}

function checkOverload(equipment, cueTable) {
  const risks = []
  
  if (!equipment || !cueTable) return risks
  
  equipment.forEach(eq => {
    if (eq.type === '吊杆' && eq.maxLoad) {
      cueTable.forEach(cue => {
        if (cue.equipmentIds && cue.equipmentIds.includes(eq.id)) {
          const load = parseFloat(cue.load) || 0
          const maxLoad = parseFloat(eq.maxLoad)
          
          if (load > maxLoad) {
            risks.push({
              id: `overload-${eq.id}-${cue.id}`,
              category: 'overload',
              level: 'high',
              time: cue.time,
              title: `吊杆超载警告`,
              description: `${eq.name} (吊杆${eq.number}) 额定负载 ${maxLoad}kg，当前负载 ${load}kg，超载 ${(load - maxLoad).toFixed(1)}kg`,
              status: 'pending',
              notes: '',
              relatedCue: cue.id,
              relatedEquipment: eq.id,
              details: {
                equipment: eq.name,
                maxLoad: maxLoad,
                currentLoad: load,
                overload: load - maxLoad,
                cueNumber: cue.number
              }
            })
          }
        }
      })
    }
  })
  
  return risks
}

function checkMovementConflict(movements, equipment, cueTable) {
  const risks = []
  
  if (!movements || !equipment) return risks
  
  const liftEquipment = equipment.filter(eq => eq.type === '升降台')
  
  movements.forEach(movement => {
    liftEquipment.forEach(lift => {
      const liftCues = cueTable ? cueTable.filter(cue => 
        cue.equipmentIds && cue.equipmentIds.includes(lift.id)
      ) : []
      
      liftCues.forEach(cue => {
        if (timeOverlaps(
          { startTime: movement.startTime, endTime: movement.endTime },
          { time: cue.time }
        )) {
          const movementPath = `${movement.fromPosition} -> ${movement.toPosition}`
          const liftArea = lift.area || `升降台${lift.number}区域`
          
          const pathCoversLift = movementPath.includes(lift.number.toString()) ||
                                  movementPath.includes(liftArea) ||
                                  (movement.fromPosition === liftArea || movement.toPosition === liftArea)
          
          if (pathCoversLift || (cue.action === '升起' || cue.action === '降下')) {
            risks.push({
              id: `movement-${movement.id}-${lift.id}-${cue.id}`,
              category: 'movement',
              level: 'high',
              time: movement.startTime,
              title: `升降台运行与演员走位冲突`,
              description: `${movement.actor} 在 ${movement.startTime} 至 ${movement.endTime} 从 ${movement.fromPosition} 到 ${movement.toPosition}，同时 ${lift.name} 在 ${cue.time} 执行 ${cue.action} 操作`,
              status: 'pending',
              notes: '',
              relatedMovement: movement.id,
              relatedEquipment: lift.id,
              relatedCue: cue.id,
              details: {
                actor: movement.actor,
                movement: movementPath,
                lift: lift.name,
                action: cue.action,
                cueNumber: cue.number
              }
            })
          }
        }
      })
    })
  })
  
  if (movements.length >= 2) {
    for (let i = 0; i < movements.length; i++) {
      for (let j = i + 1; j < movements.length; j++) {
        const m1 = movements[i]
        const m2 = movements[j]
        
        if (timeOverlaps(
          { startTime: m1.startTime, endTime: m1.endTime },
          { startTime: m2.startTime, endTime: m2.endTime }
        )) {
          const path1 = `${m1.fromPosition} -> ${m1.toPosition}`
          const path2 = `${m2.fromPosition} -> ${m2.toPosition}`
          
          if (path1 === path2 || 
              m1.fromPosition === m2.toPosition ||
              m1.toPosition === m2.fromPosition ||
              m1.fromPosition === m2.fromPosition ||
              m1.toPosition === m2.toPosition) {
            risks.push({
              id: `movement-conflict-${m1.id}-${m2.id}`,
              category: 'movement',
              level: 'medium',
              time: m1.startTime,
              title: `演员走位路径冲突`,
              description: `${m1.actor} (${path1}) 与 ${m2.actor} (${path2}) 在 ${m1.startTime} 至 ${m1.endTime} 期间走位路径可能冲突`,
              status: 'pending',
              notes: '',
              relatedMovement: m1.id,
              details: {
                actors: [m1.actor, m2.actor],
                paths: [path1, path2],
                timeRange: `${m1.startTime} - ${m1.endTime}`
              }
            })
          }
        }
      }
    }
  }
  
  return risks
}

function checkPermitExpiry(pyroPermits) {
  const risks = []
  
  if (!pyroPermits) return risks
  
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  pyroPermits.forEach(permit => {
    if (permit.expiryDate) {
      const expiryDate = new Date(permit.expiryDate)
      expiryDate.setHours(0, 0, 0, 0)
      
      const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24))
      
      if (daysUntilExpiry < 0) {
        risks.push({
          id: `permit-expired-${permit.id}`,
          category: 'permit',
          level: 'high',
          time: permit.useTime || '00:00:00',
          title: `烟火许可已过期`,
          description: `${permit.name} (许可编号: ${permit.permitNumber}) 已于 ${permit.expiryDate} 过期，过期 ${Math.abs(daysUntilExpiry)} 天`,
          status: 'pending',
          notes: '',
          relatedPermit: permit.id,
          details: {
            permitName: permit.name,
            permitNumber: permit.permitNumber,
            expiryDate: permit.expiryDate,
            daysExpired: Math.abs(daysUntilExpiry)
          }
        })
      } else if (daysUntilExpiry <= 7) {
        risks.push({
          id: `permit-expiring-${permit.id}`,
          category: 'permit',
          level: 'medium',
          time: permit.useTime || '00:00:00',
          title: `烟火许可即将过期`,
          description: `${permit.name} (许可编号: ${permit.permitNumber}) 将于 ${permit.expiryDate} 过期，剩余 ${daysUntilExpiry} 天`,
          status: 'pending',
          notes: '',
          relatedPermit: permit.id,
          details: {
            permitName: permit.name,
            permitNumber: permit.permitNumber,
            expiryDate: permit.expiryDate,
            daysRemaining: daysUntilExpiry
          }
        })
      }
    }
  })
  
  return risks
}

function checkTimingConflict(cueTable) {
  const risks = []
  
  if (!cueTable || cueTable.length < 2) return risks
  
  const sortedCues = [...cueTable].sort((a, b) => parseTime(a.time) - parseTime(b.time))
  
  for (let i = 0; i < sortedCues.length - 1; i++) {
    const currentCue = sortedCues[i]
    const nextCue = sortedCues[i + 1]
    
    const currentTime = parseTime(currentCue.time)
    const nextTime = parseTime(nextCue.time)
    const gap = nextTime - currentTime
    
    const currentTransition = parseFloat(currentCue.transitionTime) || 5
    const nextTransition = parseFloat(nextCue.transitionTime) || 5
    
    const minGap = Math.max(currentTransition, nextTransition) + 2
    
    if (gap < minGap) {
      risks.push({
        id: `timing-${currentCue.id}-${nextCue.id}`,
        category: 'timing',
        level: gap < 2 ? 'high' : 'medium',
        time: currentCue.time,
        title: `换景时间不足`,
        description: `Cue ${currentCue.number} (${currentCue.name}) 与 Cue ${nextCue.number} (${nextCue.name}) 之间间隔 ${gap} 秒，建议至少 ${minGap} 秒`,
        status: 'pending',
        notes: '',
        relatedCue: currentCue.id,
        details: {
          cue1: { number: currentCue.number, name: currentCue.name, time: currentCue.time },
          cue2: { number: nextCue.number, name: nextCue.name, time: nextCue.time },
          actualGap: gap,
          recommendedGap: minGap
        }
      })
    }
  }
  
  return risks
}

function checkEquipmentUsage(equipment, cueTable) {
  const risks = []
  
  if (!equipment || !cueTable) return risks
  
  equipment.forEach(eq => {
    if (eq.status === '故障' || eq.status === '维护中') {
      const usingCues = cueTable.filter(cue => 
        cue.equipmentIds && cue.equipmentIds.includes(eq.id)
      )
      
      usingCues.forEach(cue => {
        risks.push({
          id: `equipment-status-${eq.id}-${cue.id}`,
          category: 'other',
          level: eq.status === '故障' ? 'high' : 'medium',
          time: cue.time,
          title: `设备状态异常`,
          description: `${eq.name} 当前状态为「${eq.status}」，但在 Cue ${cue.number} (${cue.name}) 中被使用`,
          status: 'pending',
          notes: '',
          relatedCue: cue.id,
          relatedEquipment: eq.id,
          details: {
            equipment: eq.name,
            status: eq.status,
            cueNumber: cue.number,
            cueName: cue.name
          }
        })
      })
    }
  })
  
  return risks
}

export const riskEngine = {
  analyzeAll(data) {
    const allRisks = [
      ...checkOverload(data.equipment, data.cueTable),
      ...checkMovementConflict(data.movements, data.equipment, data.cueTable),
      ...checkPermitExpiry(data.pyroPermits),
      ...checkTimingConflict(data.cueTable),
      ...checkEquipmentUsage(data.equipment, data.cueTable)
    ]
    
    return allRisks.sort((a, b) => {
      const levelOrder = { high: 0, medium: 1, low: 2 }
      if (levelOrder[a.level] !== levelOrder[b.level]) {
        return levelOrder[a.level] - levelOrder[b.level]
      }
      return parseTime(a.time) - parseTime(b.time)
    })
  },
  
  checkOverload,
  checkMovementConflict,
  checkPermitExpiry,
  checkTimingConflict,
  checkEquipmentUsage
}

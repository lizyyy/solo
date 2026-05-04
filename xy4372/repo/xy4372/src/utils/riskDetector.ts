import type {
  Horse,
  VetRecord,
  ShoeingRecord,
  TackItem,
  RaceEntry,
  Risk,
  AppSettings,
} from '@/types'

interface DetectionContext {
  sessionId: string
  horses: Horse[]
  vetRecords: VetRecord[]
  shoeingRecords: ShoeingRecord[]
  tackItems: TackItem[]
  raceEntries: RaceEntry[]
  settings: AppSettings
  raceDate: Date
}

function getHorseName(horseNumber: string, horses: Horse[]): string {
  const horse = horses.find(h => h.horseNumber === horseNumber)
  return horse?.horseName || ''
}

function parseSize(size: string): number {
  const match = size.match(/[\d.]+/)
  if (match) {
    return parseFloat(match[0])
  }
  return 0
}

function isSameDay(date1: Date, date2: Date): boolean {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate()
}

export function detectRestPeriodRisks(
  context: DetectionContext
): Risk[] {
  const risks: Risk[] = []
  const { sessionId, horses, vetRecords, raceEntries, raceDate, settings } = context

  const horseRaceMap = new Map<string, RaceEntry[]>()
  for (const entry of raceEntries) {
    const existing = horseRaceMap.get(entry.horseNumber) || []
    existing.push(entry)
    horseRaceMap.set(entry.horseNumber, existing)
  }

  for (const [horseNumber, races] of horseRaceMap) {
    const horseVetRecords = vetRecords.filter(v => v.horseNumber === horseNumber)
    
    for (const record of horseVetRecords) {
      if (record.isCleared) continue

      const recoveryDate = record.recoveryDate ? new Date(record.recoveryDate) : null
      const treatmentDate = record.treatmentDate ? new Date(record.treatmentDate) : null

      if (!recoveryDate && !treatmentDate) continue

      const actualRecoveryDate = recoveryDate || 
        (treatmentDate ? new Date(treatmentDate.getTime() + (record.restPeriodDays || settings.defaultRestPeriodDays) * 86400000) : null)

      if (!actualRecoveryDate) continue

      const daysUntilRecovery = Math.ceil((actualRecoveryDate.getTime() - raceDate.getTime()) / 86400000)

      if (daysUntilRecovery > 0) {
        for (const race of races) {
          const risk: Risk = {
            id: crypto.randomUUID(),
            sessionId,
            horseNumber,
            horseName: getHorseName(horseNumber, horses) || record.horseName,
            type: 'rest_period_not_expired',
            severity: daysUntilRecovery > 3 ? 'critical' : daysUntilRecovery > 1 ? 'high' : 'medium',
            title: '休养期未满',
            description: `马匹 ${getHorseName(horseNumber, horses) || record.horseName} (${horseNumber}) 兽医休养期未满。` +
              `诊断: ${record.diagnosis || '未知'}，治疗日期: ${record.treatmentDate || '未知'}，` +
              `预计康复日期: ${actualRecoveryDate.toISOString().split('T')[0]}，` +
              `距离比赛还有 ${daysUntilRecovery} 天休养期。`,
            detectedAt: new Date().toISOString(),
            raceNumber: race.raceNumber,
            raceName: race.raceName,
            data: {
              diagnosis: record.diagnosis,
              treatmentDate: record.treatmentDate,
              recoveryDate: actualRecoveryDate.toISOString(),
              daysUntilRecovery,
              vetName: record.vetName,
            },
          }
          risks.push(risk)
        }
      }
    }
  }

  return risks
}

export function detectDuplicateRaceRisks(
  context: DetectionContext
): Risk[] {
  const risks: Risk[] = []
  const { sessionId, horses, raceEntries, raceDate } = context

  const horseRaceMap = new Map<string, RaceEntry[]>()
  for (const entry of raceEntries) {
    if (!entry.horseNumber) continue
    
    const entryTime = entry.startTime ? new Date(entry.startTime) : null
    if (entryTime && !isSameDay(entryTime, raceDate)) continue

    const existing = horseRaceMap.get(entry.horseNumber) || []
    existing.push(entry)
    horseRaceMap.set(entry.horseNumber, existing)
  }

  for (const [horseNumber, races] of horseRaceMap) {
    if (races.length <= 1) continue

    const sortedRaces = [...races].sort((a, b) => {
      const timeA = a.startTime ? new Date(a.startTime).getTime() : 0
      const timeB = b.startTime ? new Date(b.startTime).getTime() : 0
      return timeA - timeB
    })

    const raceInfo = sortedRaces.map(r => 
      `${r.raceName || r.raceNumber} (${r.startTime ? new Date(r.startTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '未知时间'})`
    ).join('、')

    const minInterval = calculateMinInterval(sortedRaces)

    const risk: Risk = {
      id: crypto.randomUUID(),
      sessionId,
      horseNumber,
      horseName: getHorseName(horseNumber, horses) || sortedRaces[0].horseName,
      type: 'duplicate_race_entry',
      severity: minInterval < 30 ? 'critical' : minInterval < 60 ? 'high' : 'medium',
      title: '同一马匹重复排赛',
      description: `马匹 ${getHorseName(horseNumber, horses) || sortedRaces[0].horseName} (${horseNumber}) 在同一天内被安排了 ${races.length} 场比赛。` +
        `场次: ${raceInfo}。最小间隔时间: ${minInterval} 分钟。`,
      detectedAt: new Date().toISOString(),
      data: {
        raceCount: races.length,
        races: sortedRaces.map(r => ({
          raceNumber: r.raceNumber,
          raceName: r.raceName,
          startTime: r.startTime,
          rider: r.rider,
        })),
        minIntervalMinutes: minInterval,
      },
    }
    risks.push(risk)
  }

  return risks
}

function calculateMinInterval(races: RaceEntry[]): number {
  let minInterval = Infinity

  for (let i = 0; i < races.length - 1; i++) {
    const currentEnd = races[i].endTime ? new Date(races[i].endTime!) : 
                       races[i].startTime ? new Date(races[i].startTime!) : null
    const nextStart = races[i + 1].startTime ? new Date(races[i + 1].startTime!) : null

    if (currentEnd && nextStart) {
      const interval = (nextStart.getTime() - currentEnd.getTime()) / 60000
      if (interval < minInterval) {
        minInterval = interval
      }
    }
  }

  return minInterval === Infinity ? 0 : minInterval
}

export function detectShoeingOverdueRisks(
  context: DetectionContext
): Risk[] {
  const risks: Risk[] = []
  const { sessionId, horses, shoeingRecords, raceEntries, raceDate, settings } = context

  const horseRaceMap = new Map<string, RaceEntry[]>()
  for (const entry of raceEntries) {
    const existing = horseRaceMap.get(entry.horseNumber) || []
    existing.push(entry)
    horseRaceMap.set(entry.horseNumber, existing)
  }

  const horseShoeingMap = new Map<string, ShoeingRecord>()
  for (const record of shoeingRecords) {
    const existing = horseShoeingMap.get(record.horseNumber)
    if (!existing) {
      horseShoeingMap.set(record.horseNumber, record)
    } else {
      const existingDate = existing.shoeingDate ? new Date(existing.shoeingDate) : new Date(0)
      const newDate = record.shoeingDate ? new Date(record.shoeingDate) : new Date(0)
      if (newDate > existingDate) {
        horseShoeingMap.set(record.horseNumber, record)
      }
    }
  }

  for (const [horseNumber, races] of horseRaceMap) {
    const shoeingRecord = horseShoeingMap.get(horseNumber)
    
    if (!shoeingRecord) continue

    const shoeingDate = shoeingRecord.shoeingDate ? new Date(shoeingRecord.shoeingDate) : null
    const nextDueDate = shoeingRecord.nextDueDate ? new Date(shoeingRecord.nextDueDate) :
      shoeingDate ? new Date(shoeingDate.getTime() + settings.shoeingIntervalDays * 86400000) : null

    if (!nextDueDate) continue

    const daysOverdue = Math.ceil((raceDate.getTime() - nextDueDate.getTime()) / 86400000)

    if (daysOverdue > 0) {
      for (const race of races) {
        const risk: Risk = {
          id: crypto.randomUUID(),
          sessionId,
          horseNumber,
          horseName: getHorseName(horseNumber, horses) || shoeingRecord.horseName,
          type: 'shoeing_overdue',
          severity: daysOverdue > 14 ? 'critical' : daysOverdue > 7 ? 'high' : 'medium',
          title: '蹄铁维护超期',
          description: `马匹 ${getHorseName(horseNumber, horses) || shoeingRecord.horseName} (${horseNumber}) 蹄铁维护已超期。` +
            `上次装蹄日期: ${shoeingDate?.toISOString().split('T')[0] || '未知'}，` +
            `下次应维护日期: ${nextDueDate.toISOString().split('T')[0]}，` +
            `已超期 ${daysOverdue} 天。`,
          detectedAt: new Date().toISOString(),
          raceNumber: race.raceNumber,
          raceName: race.raceName,
          data: {
            shoeingDate: shoeingDate?.toISOString(),
            nextDueDate: nextDueDate.toISOString(),
            daysOverdue,
            farrierName: shoeingRecord.farrierName,
            frontLeft: shoeingRecord.frontLeft,
            frontRight: shoeingRecord.frontRight,
            hindLeft: shoeingRecord.hindLeft,
            hindRight: shoeingRecord.hindRight,
          },
        }
        risks.push(risk)
      }
    }
  }

  for (const [horseNumber, races] of horseRaceMap) {
    if (!horseShoeingMap.has(horseNumber)) {
      for (const race of races) {
        const risk: Risk = {
          id: crypto.randomUUID(),
          sessionId,
          horseNumber,
          horseName: getHorseName(horseNumber, horses) || race.horseName,
          type: 'shoeing_overdue',
          severity: 'high',
          title: '无蹄铁维护记录',
          description: `马匹 ${getHorseName(horseNumber, horses) || race.horseName} (${horseNumber}) 没有找到蹄铁维护记录。` +
            `请确认该马匹是否已进行蹄铁检查。`,
          detectedAt: new Date().toISOString(),
          raceNumber: race.raceNumber,
          raceName: race.raceName,
          data: {
            missingRecord: true,
          },
        }
        risks.push(risk)
      }
    }
  }

  return risks
}

export function detectTackSizeMismatchRisks(
  context: DetectionContext
): Risk[] {
  const risks: Risk[] = []
  const { sessionId, horses, tackItems, raceEntries, settings } = context

  const horseRaceMap = new Map<string, RaceEntry[]>()
  for (const entry of raceEntries) {
    const existing = horseRaceMap.get(entry.horseNumber) || []
    existing.push(entry)
    horseRaceMap.set(entry.horseNumber, existing)
  }

  const horseTackMap = new Map<string, TackItem[]>()
  for (const item of tackItems) {
    if (!item.assignedHorseNumber) continue
    const existing = horseTackMap.get(item.assignedHorseNumber) || []
    existing.push(item)
    horseTackMap.set(item.assignedHorseNumber, existing)
  }

  const horseSizeMap = new Map<string, number>()
  for (const horse of horses) {
    if (horse.notes) {
      const sizeMatch = horse.notes.match(/鞍具尺寸[:：]\s*([\d.]+)/i)
      if (sizeMatch) {
        horseSizeMap.set(horse.horseNumber, parseFloat(sizeMatch[1]))
      }
    }
  }

  for (const [horseNumber, items] of horseTackMap) {
    const races = horseRaceMap.get(horseNumber)
    if (!races || races.length === 0) continue

    const horseExpectedSize = horseSizeMap.get(horseNumber)

    for (const item of items) {
      if (item.condition === 'retired' || item.condition === 'needs_repair') {
        for (const race of races) {
          const risk: Risk = {
            id: crypto.randomUUID(),
            sessionId,
            horseNumber,
            horseName: getHorseName(horseNumber, horses) || item.assignedHorseName || '',
            type: 'tack_size_mismatch',
            severity: item.condition === 'retired' ? 'critical' : 'high',
            title: '鞍具状态异常',
            description: `分配给马匹 ${getHorseName(horseNumber, horses) || item.assignedHorseName || ''} (${horseNumber}) 的鞍具状态异常。` +
              `鞍具编号: ${item.tackNumber}，类型: ${item.tackType}，状态: ${item.condition}。` +
              `${item.condition === 'retired' ? '该鞍具已退役，不应使用。' : '该鞍具需要维修，请检查。'}`,
            detectedAt: new Date().toISOString(),
            tackNumber: item.tackNumber,
            data: {
              tackNumber: item.tackNumber,
              tackType: item.tackType,
              brand: item.brand,
              model: item.model,
              condition: item.condition,
              lastInspectionDate: item.lastInspectionDate,
            },
          }
          risks.push(risk)
        }
        continue
      }

      if (item.tackType === 'saddle' && item.size && horseExpectedSize) {
        const tackSize = parseSize(item.size)
        
        if (tackSize > 0) {
          const sizeDiff = Math.abs(tackSize - horseExpectedSize)
          
          if (sizeDiff > settings.sizeTolerance) {
            for (const race of races) {
              const risk: Risk = {
                id: crypto.randomUUID(),
                sessionId,
                horseNumber,
                horseName: getHorseName(horseNumber, horses) || item.assignedHorseName || '',
                type: 'tack_size_mismatch',
                severity: sizeDiff > settings.sizeTolerance * 2 ? 'critical' : 'medium',
                title: '鞍具尺寸不匹配',
                description: `分配给马匹 ${getHorseName(horseNumber, horses) || item.assignedHorseName || ''} (${horseNumber}) 的鞍具尺寸可能不匹配。` +
                  `马匹预期尺寸: ${horseExpectedSize}${item.sizeUnit || ''}，鞍具尺寸: ${item.size}，` +
                  `差异: ${sizeDiff}${item.sizeUnit || ''}。`,
                detectedAt: new Date().toISOString(),
                tackNumber: item.tackNumber,
                raceNumber: race.raceNumber,
                raceName: race.raceName,
                data: {
                  tackNumber: item.tackNumber,
                  tackType: item.tackType,
                  brand: item.brand,
                  model: item.model,
                  tackSize: item.size,
                  horseExpectedSize,
                  sizeDiff,
                },
              }
              risks.push(risk)
            }
          }
        }
      }
    }
  }

  for (const [horseNumber, races] of horseRaceMap) {
    const items = horseTackMap.get(horseNumber)
    if (!items || items.filter(i => i.tackType === 'saddle').length === 0) {
      for (const race of races) {
        const risk: Risk = {
          id: crypto.randomUUID(),
          sessionId,
          horseNumber,
          horseName: getHorseName(horseNumber, horses) || race.horseName,
          type: 'tack_size_mismatch',
          severity: 'low',
          title: '无分配鞍具记录',
          description: `马匹 ${getHorseName(horseNumber, horses) || race.horseName} (${horseNumber}) 没有分配的鞍具记录。` +
            `请确认该马匹使用的鞍具是否已登记。`,
          detectedAt: new Date().toISOString(),
          raceNumber: race.raceNumber,
          raceName: race.raceName,
          data: {
            missingAssignment: true,
          },
        }
        risks.push(risk)
      }
    }
  }

  return risks
}

export function detectHighTemperatureRisks(
  context: DetectionContext
): Risk[] {
  const risks: Risk[] = []
  const { sessionId, horses, raceEntries, settings } = context

  for (const entry of raceEntries) {
    const temperature = entry.temperature

    if (temperature === undefined || temperature === null) continue

    if (temperature >= settings.highTemperatureThreshold) {
      const risk: Risk = {
        id: crypto.randomUUID(),
        sessionId,
        horseNumber: entry.horseNumber,
        horseName: getHorseName(entry.horseNumber, horses) || entry.horseName,
        type: 'high_temperature_risk',
        severity: temperature >= settings.highTemperatureThreshold + 5 ? 'critical' : 
                  temperature >= settings.highTemperatureThreshold + 2 ? 'high' : 'medium',
        title: '高温场次风险',
        description: `场次 ${entry.raceName || entry.raceNumber} 温度较高，存在马匹中暑风险。` +
          `当前温度: ${temperature}°C，阈值: ${settings.highTemperatureThreshold}°C。` +
          `马匹: ${getHorseName(entry.horseNumber, horses) || entry.horseName} (${entry.horseNumber})，骑手: ${entry.rider || '未知'}。` +
          `${entry.humidity ? `湿度: ${entry.humidity}%` : ''}`,
        detectedAt: new Date().toISOString(),
        raceNumber: entry.raceNumber,
        raceName: entry.raceName,
        data: {
          temperature,
          humidity: entry.humidity,
          threshold: settings.highTemperatureThreshold,
          weatherCondition: entry.weatherCondition,
          category: entry.category,
          class: entry.class,
          rider: entry.rider,
        },
      }
      risks.push(risk)
    }
  }

  return risks
}

export function detectAllRisks(
  context: Omit<DetectionContext, 'raceDate'> & { raceDate?: string | Date }
): Risk[] {
  const raceDate = context.raceDate ? 
    (typeof context.raceDate === 'string' ? new Date(context.raceDate) : context.raceDate) :
    new Date()

  const detectionContext: DetectionContext = {
    ...context,
    raceDate,
  }

  const risks: Risk[] = []

  risks.push(...detectRestPeriodRisks(detectionContext))
  risks.push(...detectDuplicateRaceRisks(detectionContext))
  risks.push(...detectShoeingOverdueRisks(detectionContext))
  risks.push(...detectTackSizeMismatchRisks(detectionContext))
  risks.push(...detectHighTemperatureRisks(detectionContext))

  return risks
}

export const riskTypeLabels: Record<string, string> = {
  rest_period_not_expired: '休养期未满',
  duplicate_race_entry: '重复排赛',
  shoeing_overdue: '蹄铁维护超期',
  tack_size_mismatch: '鞍具尺寸不匹配',
  high_temperature_risk: '高温风险',
}

export const severityLabels: Record<string, string> = {
  critical: '严重',
  high: '高',
  medium: '中',
  low: '低',
}

export const severityColors: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#3b82f6',
}

import dayjs from 'dayjs'
import type { Scene, PropStatus, ActorCall, ValidationIssue, IssueType, IssueSeverity } from '../../src/types'

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

function createIssue(
  type: IssueType,
  severity: IssueSeverity,
  title: string,
  description: string,
  affectedScenes: string[] = [],
  affectedActors: string[] = [],
  affectedProps: string[] = [],
  evidence: ValidationIssue['evidence'] = [],
  suggestion: string = ''
): ValidationIssue {
  return {
    id: generateId(),
    type,
    severity,
    title,
    description,
    affectedScenes,
    affectedActors,
    affectedProps,
    evidence,
    suggestion,
    timestamp: dayjs().toISOString(),
  }
}

interface ValidationData {
  scenes: Scene[]
  propStatus: PropStatus[]
  actorCalls: ActorCall[]
  photoFiles?: string[]
}

export function validateContinuity(data: ValidationData): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  
  // 规则1: 道具状态跳变检测
  issues.push(...checkPropStateJump(data))
  
  // 规则2: 服装缺记录检测
  issues.push(...checkCostumeMissing(data))
  
  // 规则3: 照片证据缺失检测
  issues.push(...checkPhotoMissing(data))
  
  // 规则4: 补拍日期冲突检测
  issues.push(...checkReshootDateConflict(data))
  
  // 规则5: 时间线不一致检测
  issues.push(...checkTimelineInconsistency(data))
  
  // 规则6: 演员日程冲突检测
  issues.push(...checkActorScheduleConflict(data))
  
  // 规则7: 伤口/妆容连续性检测
  issues.push(...checkWoundAndMakeupContinuity(data))
  
  return issues
}

// 规则1: 道具状态跳变
function checkPropStateJump(data: ValidationData): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const { scenes, propStatus } = data
  
  // 按道具分组状态记录
  const propsByScene = new Map<string, PropStatus[]>()
  propStatus.forEach(status => {
    if (status.type === 'prop' && status.sceneNumber) {
      if (!propsByScene.has(status.name)) {
        propsByScene.set(status.name, [])
      }
      propsByScene.get(status.name)!.push(status)
    }
  })
  
  propsByScene.forEach((statuses, propName) => {
    // 按场景顺序排序状态
    const sortedStatuses = [...statuses].sort((a, b) => {
      const sceneA = scenes.find(s => s.sceneNumber === a.sceneNumber)
      const sceneB = scenes.find(s => s.sceneNumber === b.sceneNumber)
      return (sceneA?.storyOrder || 0) - (sceneB?.storyOrder || 0)
    })
    
    // 检查相邻场景的状态变化
    for (let i = 1; i < sortedStatuses.length; i++) {
      const prev = sortedStatuses[i - 1]
      const curr = sortedStatuses[i]
      
      const prevScene = scenes.find(s => s.sceneNumber === prev.sceneNumber)
      const currScene = scenes.find(s => s.sceneNumber === curr.sceneNumber)
      
      // 状态关键词：空、满、干净、脏、破、新
      const stateKeywords = ['空', '满', '干净', '脏', '破', '新', '有', '无', '开', '关']
      
      for (const keyword of stateKeywords) {
        const prevHas = prev.status.includes(keyword) || prev.description.includes(keyword)
        const currHas = curr.status.includes(keyword) || curr.description.includes(keyword)
        
        if (prevHas !== currHas) {
          const isReverse = i > 1 && (
            (sortedStatuses[i - 2].status.includes(keyword) === currHas) ||
            (sortedStatuses[i - 2].description.includes(keyword) === currHas)
          )
          
          if (!isReverse) {
            issues.push(createIssue(
              'prop_state_jump',
              'warning',
              `道具"${propName}"状态异常跳变`,
              `在场景${prev.sceneNumber}状态为"${prev.status}"，到场景${curr.sceneNumber}变为"${curr.status}"，` +
              `但没有状态变化的合理过渡场景记录。`,
              [prev.sceneNumber!, curr.sceneNumber!],
              [],
              [propName],
              [
                {
                  type: 'prop_record',
                  reference: prev.id,
                  description: `场景${prev.sceneNumber}: ${prev.status} - ${prev.description}`,
                },
                {
                  type: 'prop_record',
                  reference: curr.id,
                  description: `场景${curr.sceneNumber}: ${curr.status} - ${curr.description}`,
                },
              ],
              `建议检查是否有遗漏的过渡场景，或确认该道具状态变化是否符合剧情逻辑。`
            ))
          }
        }
      }
    }
  })
  
  return issues
}

// 规则2: 服装缺记录
function checkCostumeMissing(data: ValidationData): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const { scenes, propStatus, actorCalls } = data
  
  // 收集所有有服装需求的场景
  scenes.forEach(scene => {
    if (scene.costumes.length > 0) {
      scene.costumes.forEach(costume => {
        // 检查是否有对应的服装状态记录
        const costumeRecords = propStatus.filter(
          p => p.type === 'costume' && 
               (p.name.includes(costume) || costume.includes(p.name)) &&
               p.sceneNumber === scene.sceneNumber
        )
        
        if (costumeRecords.length === 0) {
          // 检查演员通告中是否有相关服装信息
          const callRecords = actorCalls.filter(
            c => c.sceneNumber === scene.sceneNumber && 
                 (c.costume.includes(costume) || costume.includes(c.costume))
          )
          
          issues.push(createIssue(
            'costume_missing',
            'warning',
            `场景${scene.sceneNumber}服装"${costume}"缺少状态记录`,
            `场次表中记录了该场景需要服装"${costume}"，但没有找到对应的服装状态确认记录。`,
            [scene.sceneNumber],
            scene.actors,
            [costume],
            callRecords.length > 0 ? callRecords.map(c => ({
              type: 'schedule' as const,
              reference: c.id,
              description: `演员${c.actorName}(${c.characterName})服装: ${c.costume}`,
            })) : [],
            `建议补充服装状态记录，或确认该服装是否确实不需要在该场景中使用。`
          ))
        }
      })
    }
    
    // 检查演员的服装记录
    scene.actors.forEach(actor => {
      const actorCostumes = propStatus.filter(
        p => p.type === 'costume' && 
             p.actorName === actor && 
             p.sceneNumber === scene.sceneNumber
      )
      
      const actorCallsForScene = actorCalls.filter(
        c => c.actorName === actor && c.sceneNumber === scene.sceneNumber
      )
      
      if (actorCallsForScene.length > 0 && actorCostumes.length === 0) {
        const call = actorCallsForScene[0]
        if (call.costume) {
          issues.push(createIssue(
            'costume_missing',
            'info',
            `演员${actor}在场景${scene.sceneNumber}缺少服装确认`,
            `演员通告记录了服装"${call.costume}"，但没有场记确认的服装状态记录。`,
            [scene.sceneNumber],
            [actor],
            [call.costume],
            [
              {
                type: 'schedule',
                reference: call.id,
                description: `通告服装: ${call.costume}`,
              },
            ],
            `建议补充场记服装状态确认。`
          ))
        }
      }
    })
  })
  
  return issues
}

// 规则3: 照片证据缺失
function checkPhotoMissing(data: ValidationData): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const { scenes, propStatus, photoFiles } = data
  
  if (!photoFiles || photoFiles.length === 0) {
    issues.push(createIssue(
      'photo_missing',
      'info',
      '未提供照片目录',
      '没有选择照片目录，无法进行照片证据核对。',
      scenes.map(s => s.sceneNumber),
      [],
      [],
      [],
      '建议导入现场照片目录以进行完整的连续性核对。'
    ))
    return issues
  }
  
  // 检查需要照片记录的道具/服装
  const itemsNeedingPhoto = propStatus.filter(p => p.photoReference)
  
  itemsNeedingPhoto.forEach(item => {
    const hasMatchingPhoto = photoFiles.some(photo => {
      const photoName = photo.toLowerCase()
      const ref = (item.photoReference || '').toLowerCase()
      const name = item.name.toLowerCase()
      const scene = item.sceneNumber?.toLowerCase() || ''
      
      return photoName.includes(ref) || 
             (photoName.includes(name) && photoName.includes(scene))
    })
    
    if (!hasMatchingPhoto) {
      issues.push(createIssue(
        'photo_missing',
        'warning',
        `${item.type === 'prop' ? '道具' : item.type === 'costume' ? '服装' : '记录'}"${item.name}"缺少照片证据`,
        `场记记录中引用了照片"${item.photoReference}"，但在照片目录中未找到匹配的照片文件。`,
        item.sceneNumber ? [item.sceneNumber] : [],
        item.actorName ? [item.actorName] : [],
        [item.name],
        [
          {
            type: item.type === 'costume' ? 'costume_record' : 'prop_record',
            reference: item.id,
            description: `照片引用: ${item.photoReference}`,
          },
        ],
        `建议确认照片是否存在，或更新场记记录中的照片引用。`
      ))
    }
  })
  
  // 检查关键场景是否有照片
  const criticalScenes = scenes.filter(s => 
    s.notes?.toLowerCase().includes('关键') ||
    s.notes?.toLowerCase().includes('转场') ||
    s.notes?.toLowerCase().includes('特效')
  )
  
  criticalScenes.forEach(scene => {
    const scenePhotos = photoFiles.filter(p => 
      p.toLowerCase().includes(scene.sceneNumber.toLowerCase())
    )
    
    if (scenePhotos.length < 2) {
      issues.push(createIssue(
        'photo_missing',
        'info',
        `关键场景${scene.sceneNumber}照片数量较少`,
        `该场景被标记为关键/转场/特效场景，但仅找到${scenePhotos.length}张相关照片。`,
        [scene.sceneNumber],
        scene.actors,
        scene.props,
        scenePhotos.length > 0 ? [
          {
            type: 'photo',
            reference: scenePhotos[0],
            description: `找到的照片: ${scenePhotos.length}张`,
          },
        ] : [],
        `建议确认是否有遗漏的照片。`
      ))
    }
  })
  
  return issues
}

// 规则4: 补拍日期冲突
function checkReshootDateConflict(data: ValidationData): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const { scenes } = data
  
  // 按剧情顺序分组，检查拍摄日期是否合理
  const scenesByStoryOrder = [...scenes].sort((a, b) => a.storyOrder - b.storyOrder)
  
  for (let i = 0; i < scenesByStoryOrder.length; i++) {
    for (let j = i + 1; j < scenesByStoryOrder.length; j++) {
      const earlier = scenesByStoryOrder[i]
      const later = scenesByStoryOrder[j]
      
      const earlierDate = dayjs(earlier.shootDate)
      const laterDate = dayjs(later.shootDate)
      
      // 如果剧情上早的场景，实际拍摄日期却晚，可能是补拍
      if (earlierDate.isAfter(laterDate)) {
        const isReshoot = 
          earlier.notes?.toLowerCase().includes('补拍') ||
          earlier.notes?.toLowerCase().includes('reshoot') ||
          later.notes?.toLowerCase().includes('补拍') ||
          later.notes?.toLowerCase().includes('reshoot')
        
        if (isReshoot) {
          // 补拍场景，检查是否有相关记录
          issues.push(createIssue(
            'reshoot_date_conflict',
            'info',
            `检测到补拍场景: ${earlier.sceneNumber}`,
            `场景${earlier.sceneNumber}(剧情顺序${earlier.storyOrder})拍摄于${earlier.shootDate}，` +
            `晚于场景${later.sceneNumber}(剧情顺序${later.storyOrder})的${later.shootDate}。` +
            `这被标记为补拍，请确认连续性是否正确。`,
            [earlier.sceneNumber, later.sceneNumber],
            [...new Set([...earlier.actors, ...later.actors])],
            [...new Set([...earlier.props, ...later.props])],
            [
              {
                type: 'note',
                reference: earlier.id,
                description: `场景${earlier.sceneNumber}备注: ${earlier.notes || '(无)'}`,
              },
              {
                type: 'note',
                reference: later.id,
                description: `场景${later.sceneNumber}备注: ${later.notes || '(无)'}`,
              },
            ],
            `补拍场景需要特别注意道具、服装、妆容的连续性，建议对照原始拍摄记录仔细核对。`
          ))
        } else {
          // 可能是拍摄顺序问题，但需要确认
          issues.push(createIssue(
            'reshoot_date_conflict',
            'warning',
            `拍摄日期与剧情顺序不一致`,
            `场景${earlier.sceneNumber}(剧情顺序${earlier.storyOrder})拍摄于${earlier.shootDate}，` +
            `晚于场景${later.sceneNumber}(剧情顺序${later.storyOrder})的${later.shootDate}。` +
            `这可能是非顺序拍摄，也可能是补拍但未标记。`,
            [earlier.sceneNumber, later.sceneNumber],
            [...new Set([...earlier.actors, ...later.actors])],
            [...new Set([...earlier.props, ...later.props])],
            [],
            `建议确认这是否为正常的非顺序拍摄，或是需要标记为补拍的场景。` +
            `如果是补拍，请在备注中添加"补拍"字样以便系统识别。`
          ))
        }
      }
    }
  }
  
  return issues
}

// 规则5: 时间线不一致
function checkTimelineInconsistency(data: ValidationData): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const { scenes, propStatus } = data
  
  // 检查日夜场景的连续性
  const scenesByStoryOrder = [...scenes].sort((a, b) => a.storyOrder - b.storyOrder)
  
  for (let i = 1; i < scenesByStoryOrder.length; i++) {
    const prev = scenesByStoryOrder[i - 1]
    const curr = scenesByStoryOrder[i]
    
    // 日夜突变（没有转场标记）
    if (prev.dayNight && curr.dayNight && prev.dayNight !== curr.dayNight) {
      const hasTransition = 
        prev.notes?.toLowerCase().includes('转场') ||
        prev.notes?.toLowerCase().includes('时间流逝') ||
        prev.notes?.toLowerCase().includes('第二天') ||
        prev.notes?.toLowerCase().includes('隔天') ||
        curr.notes?.toLowerCase().includes('转场')
      
      if (!hasTransition) {
        issues.push(createIssue(
          'timeline_inconsistency',
          'info',
          `场景${prev.sceneNumber}到${curr.sceneNumber}日夜状态突变`,
          `前一场景是${prev.dayNight}，后一场景是${curr.dayNight}，` +
          `但没有转场或时间流逝的标记。`,
          [prev.sceneNumber, curr.sceneNumber],
          [...new Set([...prev.actors, ...curr.actors])],
          [],
          [],
          `建议确认是否有时间跳跃。如果有，请在备注中添加"转场"或"时间流逝"标记。`
        ))
      }
    }
    
    // 内外景突变
    if (prev.interiorExterior && curr.interiorExterior && 
        prev.interiorExterior !== curr.interiorExterior) {
      const hasTransition = 
        prev.notes?.toLowerCase().includes('转场') ||
        curr.notes?.toLowerCase().includes('转场')
      
      if (!hasTransition) {
        issues.push(createIssue(
          'timeline_inconsistency',
          'info',
          `场景${prev.sceneNumber}到${curr.sceneNumber}内外景突变`,
          `前一场景是${prev.interiorExterior}(${prev.location})，` +
          `后一场景是${curr.interiorExterior}(${curr.location})，` +
          `但没有转场标记。`,
          [prev.sceneNumber, curr.sceneNumber],
          [...new Set([...prev.actors, ...curr.actors])],
          [],
          [],
          `建议确认是否需要转场镜头。`
        ))
      }
    }
  }
  
  return issues
}

// 规则6: 演员日程冲突
function checkActorScheduleConflict(data: ValidationData): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const { scenes, actorCalls } = data
  
  // 按演员分组
  const callsByActor = new Map<string, ActorCall[]>()
  actorCalls.forEach(call => {
    if (!callsByActor.has(call.actorName)) {
      callsByActor.set(call.actorName, [])
    }
    callsByActor.get(call.actorName)!.push(call)
  })
  
  callsByActor.forEach((calls, actorName) => {
    // 按拍摄日期排序
    const sortedCalls = [...calls].sort((a, b) => {
      const dateA = dayjs(a.shootDate)
      const dateB = dayjs(b.shootDate)
      if (dateA.isSame(dateB)) {
        return (a.callTime || '').localeCompare(b.callTime || '')
      }
      return dateA.isBefore(dateB) ? -1 : 1
    })
    
    // 检查同一天的时间冲突
    const callsByDate = new Map<string, ActorCall[]>()
    sortedCalls.forEach(call => {
      if (!callsByDate.has(call.shootDate)) {
        callsByDate.set(call.shootDate, [])
      }
      callsByDate.get(call.shootDate)!.push(call)
    })
    
    callsByDate.forEach((dateCalls, date) => {
      if (dateCalls.length > 1) {
        // 检查时间是否有重叠
        for (let i = 0; i < dateCalls.length; i++) {
          for (let j = i + 1; j < dateCalls.length; j++) {
            const call1 = dateCalls[i]
            const call2 = dateCalls[j]
            
            const time1 = dayjs(`${date} ${call1.callTime || call1.onSetTime || '00:00'}`)
            const time2 = dayjs(`${date} ${call2.callTime || call2.onSetTime || '00:00'}`)
            
            // 如果时间差小于2小时，可能有冲突
            const diffHours = Math.abs(time1.diff(time2, 'hour'))
            
            if (diffHours < 2) {
              issues.push(createIssue(
                'actor_schedule_conflict',
                'warning',
                `演员${actorName}日程可能冲突`,
                `在${date}，演员${actorName}有两个场景安排时间过于接近：` +
                `场景${call1.sceneNumber}(${call1.callTime || call1.onSetTime}) 和 ` +
                `场景${call2.sceneNumber}(${call2.callTime || call2.onSetTime})。` +
                `两场时间间隔仅${diffHours}小时，可能没有足够时间换装/转场。`,
                [call1.sceneNumber!, call2.sceneNumber!],
                [actorName],
                [],
                [
                  {
                    type: 'schedule',
                    reference: call1.id,
                    description: `场景${call1.sceneNumber}: ${call1.callTime || call1.onSetTime}`,
                  },
                  {
                    type: 'schedule',
                    reference: call2.id,
                    description: `场景${call2.sceneNumber}: ${call2.callTime || call2.onSetTime}`,
                  },
                ],
                `建议确认演员是否有足够时间在两个场景之间转场、换装、补妆。`
              ))
            }
          }
        }
      }
    })
  })
  
  return issues
}

// 规则7: 伤口/妆容连续性
function checkWoundAndMakeupContinuity(data: ValidationData): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const { scenes, propStatus } = data
  
  // 筛选伤口和妆容记录
  const woundRecords = propStatus.filter(p => p.type === 'wound')
  const makeupRecords = propStatus.filter(p => p.type === 'makeup')
  
  // 按演员分组伤口
  const woundsByActor = new Map<string, PropStatus[]>()
  woundRecords.forEach(wound => {
    if (wound.actorName) {
      if (!woundsByActor.has(wound.actorName)) {
        woundsByActor.set(wound.actorName, [])
      }
      woundsByActor.get(wound.actorName)!.push(wound)
    }
  })
  
  // 检查每个演员的伤口连续性
  woundsByActor.forEach((wounds, actorName) => {
    // 按场景顺序排序
    const sortedWounds = [...wounds].sort((a, b) => {
      const sceneA = scenes.find(s => s.sceneNumber === a.sceneNumber)
      const sceneB = scenes.find(s => s.sceneNumber === b.sceneNumber)
      return (sceneA?.storyOrder || 0) - (sceneB?.storyOrder || 0)
    })
    
    // 检查伤口状态变化
    for (let i = 1; i < sortedWounds.length; i++) {
      const prev = sortedWounds[i - 1]
      const curr = sortedWounds[i]
      
      // 伤口关键词：新伤、旧伤、结痂、出血、包扎、拆除
      const woundKeywords = ['新伤', '旧伤', '结痂', '出血', '包扎', '拆除', '新鲜', '愈合']
      
      for (const keyword of woundKeywords) {
        const prevHas = prev.status.includes(keyword) || prev.description.includes(keyword)
        const currHas = curr.status.includes(keyword) || curr.description.includes(keyword)
        
        if (prevHas && !currHas && !['结痂', '愈合', '拆除'].includes(keyword)) {
          // 伤口消失但没有愈合记录
          issues.push(createIssue(
            'wound_continuity',
            'critical',
            `演员${actorName}伤口连续性异常`,
            `在场景${prev.sceneNumber}有"${keyword}"状态：${prev.description}，` +
            `但到场景${curr.sceneNumber}该状态消失，且没有愈合或包扎记录。`,
            [prev.sceneNumber!, curr.sceneNumber!],
            [actorName],
            [prev.name],
            [
              {
                type: 'prop_record',
                reference: prev.id,
                description: `场景${prev.sceneNumber}: ${prev.status} - ${prev.description}`,
              },
              {
                type: 'prop_record',
                reference: curr.id,
                description: `场景${curr.sceneNumber}: ${curr.status} - ${curr.description}`,
              },
            ],
            `这是严重的连续性问题！伤口状态变化需要有合理的剧情解释（如时间流逝、治疗等）。` +
            `建议确认是否有遗漏的中间场景，或补充伤口状态变化的记录。`
          ))
        }
        
        // 检查是否有不合理的状态变化（如新伤 -> 结痂 但中间没有时间流逝）
        if (prevHas && keyword === '新伤' && 
            (curr.status.includes('结痂') || curr.description.includes('结痂') ||
             curr.status.includes('愈合') || curr.description.includes('愈合'))) {
          const scenesBetween = scenes.filter(s => {
            const prevScene = scenes.find(sc => sc.sceneNumber === prev.sceneNumber)
            const currScene = scenes.find(sc => sc.sceneNumber === curr.sceneNumber)
            const currentScene = scenes.find(sc => sc.sceneNumber === s.sceneNumber)
            return prevScene && currScene && currentScene &&
                   currentScene.storyOrder > prevScene.storyOrder &&
                   currentScene.storyOrder < currScene.storyOrder
          })
          
          const hasTimePass = scenesBetween.some(s => 
            s.notes?.toLowerCase().includes('时间流逝') ||
            s.notes?.toLowerCase().includes('第二天') ||
            s.notes?.toLowerCase().includes('几天后')
          )
          
          if (!hasTimePass && scenesBetween.length < 3) {
            issues.push(createIssue(
              'wound_continuity',
              'warning',
              `演员${actorName}伤口愈合速度异常`,
              `场景${prev.sceneNumber}是新伤，场景${curr.sceneNumber}已结痂/愈合，` +
              `但中间只有${scenesBetween.length}个场景，且没有时间流逝标记。`,
              [prev.sceneNumber!, curr.sceneNumber!],
              [actorName],
              [prev.name],
              [
                {
                  type: 'prop_record',
                  reference: prev.id,
                  description: `场景${prev.sceneNumber}: ${prev.status} - ${prev.description}`,
                },
                {
                  type: 'prop_record',
                  reference: curr.id,
                  description: `场景${curr.sceneNumber}: ${curr.status} - ${curr.description}`,
                },
              ],
              `建议确认伤口愈合时间是否符合剧情逻辑。如果有时间跳跃，请在中间场景添加"时间流逝"标记。`
            ))
          }
        }
      }
    }
  })
  
  // 检查妆容连续性
  const makeupByActor = new Map<string, PropStatus[]>()
  makeupRecords.forEach(makeup => {
    if (makeup.actorName) {
      if (!makeupByActor.has(makeup.actorName)) {
        makeupByActor.set(makeup.actorName, [])
      }
      makeupByActor.get(makeup.actorName)!.push(makeup)
    }
  })
  
  makeupByActor.forEach((makeups, actorName) => {
    const sortedMakeups = [...makeups].sort((a, b) => {
      const sceneA = scenes.find(s => s.sceneNumber === a.sceneNumber)
      const sceneB = scenes.find(s => s.sceneNumber === b.sceneNumber)
      return (sceneA?.storyOrder || 0) - (sceneB?.storyOrder || 0)
    })
    
    for (let i = 1; i < sortedMakeups.length; i++) {
      const prev = sortedMakeups[i - 1]
      const curr = sortedMakeups[i]
      
      // 妆容关键词：浓妆、淡妆、素颜、特殊妆、老年妆
      const makeupKeywords = ['浓妆', '淡妆', '素颜', '特殊妆', '老年妆', '受伤妆', '血迹']
      
      for (const keyword of makeupKeywords) {
        const prevHas = prev.status.includes(keyword) || prev.description.includes(keyword)
        const currHas = curr.status.includes(keyword) || curr.description.includes(keyword)
        
        if (prevHas !== currHas) {
          const scenesBetween = scenes.filter(s => {
            const prevScene = scenes.find(sc => sc.sceneNumber === prev.sceneNumber)
            const currScene = scenes.find(sc => sc.sceneNumber === curr.sceneNumber)
            const currentScene = scenes.find(sc => sc.sceneNumber === s.sceneNumber)
            return prevScene && currScene && currentScene &&
                   currentScene.storyOrder > prevScene.storyOrder &&
                   currentScene.storyOrder < currScene.storyOrder
          })
          
          const hasTransition = scenesBetween.some(s => 
            s.notes?.toLowerCase().includes('转场') ||
            s.notes?.toLowerCase().includes('回家') ||
            s.notes?.toLowerCase().includes('换妆')
          )
          
          if (!hasTransition && scenesBetween.length === 0) {
            issues.push(createIssue(
              'makeup_continuity',
              'warning',
              `演员${actorName}妆容突变`,
              `场景${prev.sceneNumber}是"${keyword ? (prevHas ? '有' : '无') + keyword : prev.status}"，` +
              `场景${curr.sceneNumber}变为"${curr.status}"，但没有转场或换妆场景。`,
              [prev.sceneNumber!, curr.sceneNumber!],
              [actorName],
              [prev.name],
              [
                {
                  type: 'prop_record',
                  reference: prev.id,
                  description: `场景${prev.sceneNumber}: ${prev.status} - ${prev.description}`,
                },
                {
                  type: 'prop_record',
                  reference: curr.id,
                  description: `场景${curr.sceneNumber}: ${curr.status} - ${curr.description}`,
                },
              ],
              `建议确认妆容变化是否有合理的剧情解释。如果有换妆场景，请添加"换妆"标记。`
            ))
          }
        }
      }
    }
  })
  
  return issues
}

export type { ValidationData }

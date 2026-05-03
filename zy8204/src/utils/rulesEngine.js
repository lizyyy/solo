import { calculateDepthIntervals } from './depthCalculator.js'

const DEFAULT_RULES = {
  depth_gap_threshold: 0.1,
  rqd_min: 0,
  rqd_max: 100,
  recovery_min: 0,
  recovery_max: 100,
  check_lithology_consistency: true,
  check_box_sequence: true,
  check_continuous_depth: true
}

export function runAllRules(boreholes, coreBoxes, rules = {}) {
  const mergedRules = { ...DEFAULT_RULES, ...rules }
  const allIssues = []
  
  allIssues.push(...checkDepthContinuity(coreBoxes, mergedRules))
  allIssues.push(...checkBoxSequence(coreBoxes, mergedRules))
  allIssues.push(...checkRQDValues(coreBoxes, mergedRules))
  allIssues.push(...checkRecoveryValues(coreBoxes, mergedRules))
  
  if (mergedRules.check_lithology_consistency) {
    allIssues.push(...checkLithologyConsistency(boreholes, coreBoxes))
  }
  
  allIssues.push(...checkDepthOverlaps(coreBoxes))
  allIssues.push(...checkBoxNumberDuplicates(coreBoxes))
  allIssues.push(...checkTotalDepthConsistency(boreholes, coreBoxes))
  
  allIssues.sort((a, b) => {
    const typeOrder = { error: 0, warning: 1, info: 2 }
    return typeOrder[a.type] - typeOrder[b.type]
  })
  
  const stats = {
    total: allIssues.length,
    errors: allIssues.filter(i => i.type === 'error').length,
    warnings: allIssues.filter(i => i.type === 'warning').length,
    infos: allIssues.filter(i => i.type === 'info').length
  }
  
  return {
    issues: allIssues,
    stats,
    rules: mergedRules
  }
}

export function checkDepthContinuity(coreBoxes, rules) {
  const issues = []
  const boreholeGroups = groupByBorehole(coreBoxes)
  
  Object.entries(boreholeGroups).forEach(([boreholeId, boxes]) => {
    if (boxes.length < 2) return
    
    const depthInfo = calculateDepthIntervals(boxes)
    
    depthInfo.gaps.forEach(gap => {
      if (gap.gap_size > rules.depth_gap_threshold) {
        issues.push({
          id: `gap_${boreholeId}_${gap.between.join('_')}`,
          type: 'error',
          code: 'DEPTH_GAP',
          severity: 'high',
          title: '深度断档',
          message: `钻孔 ${boreholeId} 中，箱 ${gap.between[0]} 和箱 ${gap.between[1]} 之间存在 ${gap.gap_size.toFixed(2)}m 的深度断档`,
          borehole_id: boreholeId,
          box_numbers: gap.between,
          start_depth: gap.gap_start,
          end_depth: gap.gap_end,
          gap_size: gap.gap_size,
          affected_boxes: gap.between,
          location: `${boreholeId}: ${gap.gap_start.toFixed(2)}m - ${gap.gap_end.toFixed(2)}m`
        })
      }
    })
  })
  
  return issues
}

export function checkBoxSequence(coreBoxes, rules) {
  if (!rules.check_box_sequence) return []
  
  const issues = []
  const boreholeGroups = groupByBorehole(coreBoxes)
  
  Object.entries(boreholeGroups).forEach(([boreholeId, boxes]) => {
    const sortedByDepth = [...boxes].sort((a, b) => a.start_depth - b.start_depth)
    const sortedByBox = [...boxes].sort((a, b) => a.box_number - b.box_number)
    
    const isConsistent = sortedByDepth.every((box, index) => 
      box.box_number === sortedByBox[index].box_number
    )
    
    if (!isConsistent) {
      issues.push({
        id: `seq_${boreholeId}`,
        type: 'warning',
        code: 'BOX_SEQUENCE_MISMATCH',
        severity: 'medium',
        title: '箱号顺序与深度不一致',
        message: `钻孔 ${boreholeId} 的箱号顺序与深度顺序不完全匹配，可能存在编录顺序问题`,
        borehole_id: boreholeId,
        location: `${boreholeId}: 全孔`
      })
    }
    
    const boxNumbers = boxes.map(b => b.box_number).sort((a, b) => a - b)
    const minBox = Math.min(...boxNumbers)
    const maxBox = Math.max(...boxNumbers)
    
    for (let i = minBox; i <= maxBox; i++) {
      if (!boxNumbers.includes(i)) {
        issues.push({
          id: `missing_box_${boreholeId}_${i}`,
          type: 'warning',
          code: 'MISSING_BOX_NUMBER',
          severity: 'low',
          title: '缺失箱号',
          message: `钻孔 ${boreholeId} 中缺失箱号 ${i}`,
          borehole_id: boreholeId,
          missing_box_number: i,
          location: `${boreholeId}: 箱号 ${i}`
        })
      }
    }
  })
  
  return issues
}

export function checkBoxNumberDuplicates(coreBoxes) {
  const issues = []
  const boreholeGroups = groupByBorehole(coreBoxes)
  
  Object.entries(boreholeGroups).forEach(([boreholeId, boxes]) => {
    const boxNumberCounts = {}
    
    boxes.forEach(box => {
      if (!boxNumberCounts[box.box_number]) {
        boxNumberCounts[box.box_number] = []
      }
      boxNumberCounts[box.box_number].push(box)
    })
    
    Object.entries(boxNumberCounts).forEach(([boxNumber, boxList]) => {
      if (boxList.length > 1) {
        issues.push({
          id: `dup_${boreholeId}_${boxNumber}`,
          type: 'error',
          code: 'DUPLICATE_BOX_NUMBER',
          severity: 'high',
          title: '箱号重复',
          message: `钻孔 ${boreholeId} 中箱号 ${boxNumber} 出现 ${boxList.length} 次`,
          borehole_id: boreholeId,
          box_number: parseInt(boxNumber),
          count: boxList.length,
          boxes: boxList.map(b => ({
            start_depth: b.start_depth,
            end_depth: b.end_depth,
            lithology: b.lithology
          })),
          location: `${boreholeId}: 箱号 ${boxNumber}`
        })
      }
    })
  })
  
  return issues
}

export function checkRQDValues(coreBoxes, rules) {
  const issues = []
  
  coreBoxes.forEach(box => {
    if (box.rqd === undefined || box.rqd === null || box.rqd === '') return
    
    const rqd = parseFloat(box.rqd)
    
    if (isNaN(rqd)) {
      issues.push({
        id: `rqd_nan_${box.borehole_id}_${box.box_number}`,
        type: 'error',
        code: 'RQD_INVALID',
        severity: 'high',
        title: 'RQD 值无效',
        message: `钻孔 ${box.borehole_id} 箱号 ${box.box_number} 的 RQD 值无效`,
        borehole_id: box.borehole_id,
        box_number: box.box_number,
        start_depth: box.start_depth,
        end_depth: box.end_depth,
        location: `${box.borehole_id}: ${box.start_depth.toFixed(2)}m - ${box.end_depth.toFixed(2)}m`
      })
    } else if (rqd < rules.rqd_min || rqd > rules.rqd_max) {
      issues.push({
        id: `rqd_range_${box.borehole_id}_${box.box_number}`,
        type: 'error',
        code: 'RQD_OUT_OF_RANGE',
        severity: 'high',
        title: 'RQD 值超范围',
        message: `钻孔 ${box.borehole_id} 箱号 ${box.box_number} 的 RQD 值 ${rqd} 超出有效范围 (${rules.rqd_min}-${rules.rqd_max})`,
        borehole_id: box.borehole_id,
        box_number: box.box_number,
        rqd_value: rqd,
        min: rules.rqd_min,
        max: rules.rqd_max,
        start_depth: box.start_depth,
        end_depth: box.end_depth,
        location: `${box.borehole_id}: ${box.start_depth.toFixed(2)}m - ${box.end_depth.toFixed(2)}m`
      })
    }
  })
  
  return issues
}

export function checkRecoveryValues(coreBoxes, rules) {
  const issues = []
  
  coreBoxes.forEach(box => {
    if (box.recovery_rate === undefined || box.recovery_rate === null || box.recovery_rate === '') return
    
    const recovery = parseFloat(box.recovery_rate)
    
    if (isNaN(recovery)) {
      issues.push({
        id: `rec_nan_${box.borehole_id}_${box.box_number}`,
        type: 'error',
        code: 'RECOVERY_INVALID',
        severity: 'high',
        title: '取芯率值无效',
        message: `钻孔 ${box.borehole_id} 箱号 ${box.box_number} 的取芯率值无效`,
        borehole_id: box.borehole_id,
        box_number: box.box_number,
        start_depth: box.start_depth,
        end_depth: box.end_depth,
        location: `${box.borehole_id}: ${box.start_depth.toFixed(2)}m - ${box.end_depth.toFixed(2)}m`
      })
    } else if (recovery < rules.recovery_min || recovery > rules.recovery_max) {
      issues.push({
        id: `rec_range_${box.borehole_id}_${box.box_number}`,
        type: 'warning',
        code: 'RECOVERY_OUT_OF_RANGE',
        severity: 'medium',
        title: '取芯率值超范围',
        message: `钻孔 ${box.borehole_id} 箱号 ${box.box_number} 的取芯率 ${recovery} 超出推荐范围 (${rules.recovery_min}-${rules.recovery_max})`,
        borehole_id: box.borehole_id,
        box_number: box.box_number,
        recovery_value: recovery,
        min: rules.recovery_min,
        max: rules.recovery_max,
        start_depth: box.start_depth,
        end_depth: box.end_depth,
        location: `${box.borehole_id}: ${box.start_depth.toFixed(2)}m - ${box.end_depth.toFixed(2)}m`
      })
    }
  })
  
  return issues
}

export function checkDepthOverlaps(coreBoxes) {
  const issues = []
  const boreholeGroups = groupByBorehole(coreBoxes)
  
  Object.entries(boreholeGroups).forEach(([boreholeId, boxes]) => {
    const depthInfo = calculateDepthIntervals(boxes)
    
    depthInfo.overlaps.forEach(overlap => {
      issues.push({
        id: `overlap_${boreholeId}_${overlap.between.join('_')}`,
        type: 'error',
        code: 'DEPTH_OVERLAP',
        severity: 'high',
        title: '深度重叠',
        message: `钻孔 ${boreholeId} 中，箱 ${overlap.between[0]} 和箱 ${overlap.between[1]} 之间存在 ${overlap.overlap_size.toFixed(2)}m 的深度重叠`,
        borehole_id: boreholeId,
        box_numbers: overlap.between,
        start_depth: overlap.overlap_start,
        end_depth: overlap.overlap_end,
        overlap_size: overlap.overlap_size,
        location: `${boreholeId}: ${overlap.overlap_start.toFixed(2)}m - ${overlap.overlap_end.toFixed(2)}m`
      })
    })
  })
  
  return issues
}

export function checkLithologyConsistency(boreholes, coreBoxes) {
  const issues = []
  
  const allLithologies = new Set()
  const lithologyByBorehole = {}
  
  boreholes.forEach(borehole => {
    lithologyByBorehole[borehole.borehole_id] = new Set()
  })
  
  coreBoxes.forEach(box => {
    if (box.lithology && box.lithology.trim()) {
      const lithology = box.lithology.trim()
      allLithologies.add(lithology)
      if (lithologyByBorehole[box.borehole_id]) {
        lithologyByBorehole[box.borehole_id].add(lithology)
      }
    }
  })
  
  const lithologyCounts = {}
  coreBoxes.forEach(box => {
    if (box.lithology && box.lithology.trim()) {
      const lithology = box.lithology.trim()
      if (!lithologyCounts[lithology]) {
        lithologyCounts[lithology] = { count: 0, boreholes: new Set() }
      }
      lithologyCounts[lithology].count++
      lithologyCounts[lithology].boreholes.add(box.borehole_id)
    }
  })
  
  Object.entries(lithologyCounts).forEach(([lithology, stats]) => {
    if (stats.boreholes.size > 1) {
      issues.push({
        id: `litho_consist_${lithology}`,
        type: 'info',
        code: 'LITHOLOGY_CROSS_BOREHOLE',
        severity: 'low',
        title: '跨钻孔岩性统计',
        message: `岩性 "${lithology}" 在 ${stats.boreholes.size} 个钻孔中出现，共 ${stats.count} 个箱位`,
        lithology: lithology,
        borehole_count: stats.boreholes.size,
        box_count: stats.count,
        location: `跨钻孔: ${Array.from(stats.boreholes).join(', ')}`
      })
    }
  })
  
  const lithologyVariants = {}
  allLithologies.forEach(lithology => {
    const base = lithology.toLowerCase().replace(/[^a-z\u4e00-\u9fa5]/g, '')
    if (!lithologyVariants[base]) {
      lithologyVariants[base] = []
    }
    lithologyVariants[base].push(lithology)
  })
  
  Object.entries(lithologyVariants).forEach(([base, variants]) => {
    if (variants.length > 1) {
      issues.push({
        id: `litho_variant_${base}`,
        type: 'warning',
        code: 'LITHOLOGY_VARIANT',
        severity: 'medium',
        title: '岩性命名不一致',
        message: `发现相似岩性命名: ${variants.join(', ')}，可能存在命名不一致问题`,
        variants: variants,
        base: base,
        location: '全项目'
      })
    }
  })
  
  return issues
}

export function checkTotalDepthConsistency(boreholes, coreBoxes) {
  const issues = []
  
  const boreholeGroups = groupByBorehole(coreBoxes)
  
  boreholes.forEach(borehole => {
    const boxes = boreholeGroups[borehole.borehole_id] || []
    
    if (boxes.length === 0) {
      issues.push({
        id: `no_boxes_${borehole.borehole_id}`,
        type: 'warning',
        code: 'NO_CORE_BOXES',
        severity: 'medium',
        title: '无岩芯箱数据',
        message: `钻孔 ${borehole.borehole_id} 没有对应的岩芯箱数据`,
        borehole_id: borehole.borehole_id,
        location: borehole.borehole_id
      })
      return
    }
    
    const maxCoreDepth = Math.max(...boxes.map(b => b.end_depth))
    const declaredTotalDepth = borehole.total_depth
    
    if (Math.abs(maxCoreDepth - declaredTotalDepth) > 0.1) {
      issues.push({
        id: `depth_mismatch_${borehole.borehole_id}`,
        type: 'warning',
        code: 'TOTAL_DEPTH_MISMATCH',
        severity: 'medium',
        title: '总深度不一致',
        message: `钻孔 ${borehole.borehole_id} 声明总深度 ${declaredTotalDepth}m 与岩芯箱最大深度 ${maxCoreDepth}m 不一致，差异 ${Math.abs(maxCoreDepth - declaredTotalDepth).toFixed(2)}m`,
        borehole_id: borehole.borehole_id,
        declared_depth: declaredTotalDepth,
        actual_max_depth: maxCoreDepth,
        difference: Math.abs(maxCoreDepth - declaredTotalDepth),
        location: `${borehole.borehole_id}: 总深度`
      })
    }
  })
  
  return issues
}

function groupByBorehole(coreBoxes) {
  const groups = {}
  coreBoxes.forEach(box => {
    if (!groups[box.borehole_id]) {
      groups[box.borehole_id] = []
    }
    groups[box.borehole_id].push(box)
  })
  return groups
}

export function getIssuesByBorehole(issues, boreholeId) {
  return issues.filter(issue => 
    issue.borehole_id === boreholeId || 
    (issue.borehole_ids && issue.borehole_ids.includes(boreholeId))
  )
}

export function getIssuesByBox(issues, boreholeId, boxNumber) {
  return issues.filter(issue => {
    if (issue.borehole_id !== boreholeId) return false
    if (issue.box_number === boxNumber) return true
    if (issue.box_numbers && issue.box_numbers.includes(boxNumber)) return true
    if (issue.affected_boxes && issue.affected_boxes.includes(boxNumber)) return true
    return false
  })
}

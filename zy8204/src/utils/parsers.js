import Papa from 'papaparse'
import YAML from 'yaml'

export function parseCSV(text) {
  try {
    const result = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true
    })
    
    if (result.errors.length > 0) {
      throw new Error(`CSV解析错误: ${result.errors.map(e => e.message).join(', ')}`)
    }
    
    return result.data
  } catch (error) {
    throw new Error(`CSV解析失败: ${error.message}`)
  }
}

export function parseJSON(text) {
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new Error(`JSON解析失败: ${error.message}`)
  }
}

export function parseYAML(text) {
  try {
    return YAML.parse(text)
  } catch (error) {
    throw new Error(`YAML解析失败: ${error.message}`)
  }
}

export function validateBoreholes(data) {
  const issues = []
  const boreholeIds = new Set()
  
  if (!Array.isArray(data) || data.length === 0) {
    issues.push({
      type: 'error',
      code: 'BH_EMPTY',
      message: '钻孔数据为空或格式不正确'
    })
    return { valid: false, issues }
  }
  
  const requiredFields = ['borehole_id', 'total_depth']
  
  data.forEach((borehole, index) => {
    requiredFields.forEach(field => {
      if (borehole[field] === undefined || borehole[field] === null || borehole[field] === '') {
        issues.push({
          type: 'error',
          code: 'BH_MISSING_FIELD',
          message: `第 ${index + 1} 行: 缺少必填字段 "${field}"`,
          borehole_id: borehole.borehole_id
        })
      }
    })
    
    if (borehole.borehole_id) {
      if (boreholeIds.has(borehole.borehole_id)) {
        issues.push({
          type: 'error',
          code: 'BH_DUPLICATE_ID',
          message: `钻孔编号 "${borehole.borehole_id}" 重复`,
          borehole_id: borehole.borehole_id
        })
      }
      boreholeIds.add(borehole.borehole_id)
    }
    
    if (borehole.total_depth !== undefined && borehole.total_depth !== null) {
      if (typeof borehole.total_depth !== 'number' || borehole.total_depth <= 0) {
        issues.push({
          type: 'error',
          code: 'BH_INVALID_DEPTH',
          message: `钻孔 "${borehole.borehole_id}" 的总深度无效`,
          borehole_id: borehole.borehole_id
        })
      }
    }
  })
  
  return {
    valid: issues.length === 0,
    issues,
    boreholeIds: Array.from(boreholeIds)
  }
}

export function validateCoreBoxes(data, boreholeIds = []) {
  const issues = []
  const boreholeIdSet = new Set(boreholeIds)
  
  if (!Array.isArray(data) || data.length === 0) {
    issues.push({
      type: 'error',
      code: 'CB_EMPTY',
      message: '岩芯箱数据为空或格式不正确'
    })
    return { valid: false, issues }
  }
  
  const requiredFields = ['borehole_id', 'box_number', 'start_depth', 'end_depth']
  
  const boxNumbersByBorehole = {}
  boreholeIds.forEach(id => {
    boxNumbersByBorehole[id] = new Set()
  })
  
  data.forEach((box, index) => {
    requiredFields.forEach(field => {
      if (box[field] === undefined || box[field] === null || 
          (typeof box[field] === 'string' && box[field].trim() === '')) {
        issues.push({
          type: 'error',
          code: 'CB_MISSING_FIELD',
          message: `第 ${index + 1} 个岩芯箱: 缺少必填字段 "${field}"`,
          borehole_id: box.borehole_id,
          box_number: box.box_number
        })
      }
    })
    
    if (box.borehole_id && boreholeIds.length > 0 && !boreholeIdSet.has(box.borehole_id)) {
      issues.push({
        type: 'warning',
        code: 'CB_UNKNOWN_BOREHOLE',
        message: `岩芯箱 "${box.box_number}" 引用了未知钻孔 "${box.borehole_id}"`,
        borehole_id: box.borehole_id,
        box_number: box.box_number
      })
    }
    
    if (box.borehole_id && box.box_number !== undefined) {
      const bhId = box.borehole_id
      if (!boxNumbersByBorehole[bhId]) {
        boxNumbersByBorehole[bhId] = new Set()
      }
      if (boxNumbersByBorehole[bhId].has(box.box_number)) {
        issues.push({
          type: 'error',
          code: 'CB_DUPLICATE_BOX_NUMBER',
          message: `钻孔 "${bhId}" 中箱号 "${box.box_number}" 重复`,
          borehole_id: bhId,
          box_number: box.box_number
        })
      }
      boxNumbersByBorehole[bhId].add(box.box_number)
    }
    
    const startDepth = parseFloat(box.start_depth)
    const endDepth = parseFloat(box.end_depth)
    
    if (!isNaN(startDepth) && !isNaN(endDepth)) {
      if (startDepth >= endDepth) {
        issues.push({
          type: 'error',
          code: 'CB_INVALID_DEPTH_RANGE',
          message: `岩芯箱 "${box.box_number}" 的起始深度 ${startDepth} 大于等于结束深度 ${endDepth}`,
          borehole_id: box.borehole_id,
          box_number: box.box_number,
          start_depth: startDepth,
          end_depth: endDepth
        })
      }
    } else {
      issues.push({
        type: 'error',
        code: 'CB_INVALID_DEPTH',
        message: `岩芯箱 "${box.box_number}" 的深度值无效`,
        borehole_id: box.borehole_id,
        box_number: box.box_number
      })
    }
    
    if (box.rqd !== undefined && box.rqd !== null && box.rqd !== '') {
      const rqd = parseFloat(box.rqd)
      if (isNaN(rqd) || rqd < 0 || rqd > 100) {
        issues.push({
          type: 'warning',
          code: 'CB_RQD_OUT_OF_RANGE',
          message: `岩芯箱 "${box.box_number}" 的 RQD 值 ${rqd} 超出有效范围 (0-100)`,
          borehole_id: box.borehole_id,
          box_number: box.box_number,
          rqd: rqd
        })
      }
    }
    
    if (box.recovery_rate !== undefined && box.recovery_rate !== null && box.recovery_rate !== '') {
      const recovery = parseFloat(box.recovery_rate)
      if (isNaN(recovery) || recovery < 0 || recovery > 100) {
        issues.push({
          type: 'warning',
          code: 'CB_RECOVERY_OUT_OF_RANGE',
          message: `岩芯箱 "${box.box_number}" 的取芯率 ${recovery} 超出有效范围 (0-100)`,
          borehole_id: box.borehole_id,
          box_number: box.box_number,
          recovery_rate: recovery
        })
      }
    }
  })
  
  return {
    valid: issues.filter(i => i.type === 'error').length === 0,
    issues,
    boxNumbersByBorehole
  }
}

export function validateRules(data) {
  const issues = []
  
  if (!data || typeof data !== 'object') {
    issues.push({
      type: 'error',
      code: 'RL_EMPTY',
      message: '规则数据为空或格式不正确'
    })
    return { valid: false, issues }
  }
  
  const defaultRules = {
    depth_gap_threshold: 0.1,
    rqd_min: 0,
    rqd_max: 100,
    recovery_min: 0,
    recovery_max: 100,
    check_lithology_consistency: true,
    check_box_sequence: true,
    check_continuous_depth: true
  }
  
  const validatedRules = { ...defaultRules, ...data }
  
  if (validatedRules.depth_gap_threshold < 0 || validatedRules.depth_gap_threshold > 10) {
    issues.push({
      type: 'warning',
      code: 'RL_INVALID_GAP_THRESHOLD',
      message: `深度断档阈值 ${validatedRules.depth_gap_threshold} 超出推荐范围 (0-10m)`
    })
    validatedRules.depth_gap_threshold = defaultRules.depth_gap_threshold
  }
  
  if (validatedRules.rqd_min < 0 || validatedRules.rqd_min > 100) {
    issues.push({
      type: 'warning',
      code: 'RL_INVALID_RQD_MIN',
      message: `RQD 最小值 ${validatedRules.rqd_min} 超出有效范围`
    })
    validatedRules.rqd_min = defaultRules.rqd_min
  }
  
  if (validatedRules.rqd_max < 0 || validatedRules.rqd_max > 100 || validatedRules.rqd_max < validatedRules.rqd_min) {
    issues.push({
      type: 'warning',
      code: 'RL_INVALID_RQD_MAX',
      message: `RQD 最大值 ${validatedRules.rqd_max} 无效`
    })
    validatedRules.rqd_max = defaultRules.rqd_max
  }
  
  return {
    valid: issues.filter(i => i.type === 'error').length === 0,
    issues,
    rules: validatedRules
  }
}

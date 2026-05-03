import { reactive, computed, watch } from 'vue'
import { parseCSV, parseJSON, parseYAML, validateBoreholes, validateCoreBoxes, validateRules } from '../utils/parsers.js'
import { runAllRules } from '../utils/rulesEngine.js'
import { calculateDepthIntervals, calculateLithologyLayers, calculateRQDAndRecoveryData } from '../utils/depthCalculator.js'

export const appState = reactive({
  boreholes: [],
  coreBoxes: [],
  rules: {
    depth_gap_threshold: 0.1,
    rqd_min: 0,
    rqd_max: 100,
    recovery_min: 0,
    recovery_max: 100,
    check_lithology_consistency: true,
    check_box_sequence: true,
    check_continuous_depth: true
  },
  selectedBoreholeId: null,
  selectedIssueId: null,
  selectedBoxNumber: null,
  issues: [],
  stats: {
    total: 0,
    errors: 0,
    warnings: 0,
    infos: 0
  },
  parseErrors: [],
  isUsingSampleData: false
})

export const computedState = {
  selectedBorehole: computed(() => {
    return appState.boreholes.find(b => b.borehole_id === appState.selectedBoreholeId) || null
  }),
  
  selectedBoreholeBoxes: computed(() => {
    if (!appState.selectedBoreholeId) return []
    return appState.coreBoxes.filter(box => box.borehole_id === appState.selectedBoreholeId)
      .sort((a, b) => a.start_depth - b.start_depth)
  }),
  
  selectedBoreholeIssues: computed(() => {
    if (!appState.selectedBoreholeId) return appState.issues
    return appState.issues.filter(issue => 
      issue.borehole_id === appState.selectedBoreholeId ||
      (issue.code === 'LITHOLOGY_VARIANT') ||
      (issue.code === 'LITHOLOGY_CROSS_BOREHOLE' && issue.lithology && 
       computedState.selectedBoreholeBoxes.value.some(b => b.lithology === issue.lithology))
    )
  }),
  
  selectedBoreholeDepthInfo: computed(() => {
    if (computedState.selectedBoreholeBoxes.value.length === 0) return null
    return calculateDepthIntervals(computedState.selectedBoreholeBoxes.value)
  }),
  
  selectedBoreholeLithologyLayers: computed(() => {
    if (computedState.selectedBoreholeBoxes.value.length === 0) return []
    return calculateLithologyLayers(computedState.selectedBoreholeBoxes.value)
  }),
  
  selectedBoreholeRQDRecovery: computed(() => {
    if (computedState.selectedBoreholeBoxes.value.length === 0) return null
    return calculateRQDAndRecoveryData(computedState.selectedBoreholeBoxes.value)
  }),
  
  hasData: computed(() => {
    return appState.boreholes.length > 0 && appState.coreBoxes.length > 0
  }),
  
  issuesBySeverity: computed(() => {
    return {
      errors: appState.issues.filter(i => i.type === 'error'),
      warnings: appState.issues.filter(i => i.type === 'warning'),
      infos: appState.issues.filter(i => i.type === 'info')
    }
  }),
  
  issuesByCode: computed(() => {
    const groups = {}
    appState.issues.forEach(issue => {
      if (!groups[issue.code]) {
        groups[issue.code] = []
      }
      groups[issue.code].push(issue)
    })
    return groups
  }),
  
  boreholeList: computed(() => {
    return appState.boreholes.map(borehole => {
      const boxes = appState.coreBoxes.filter(box => box.borehole_id === borehole.borehole_id)
      const issues = appState.issues.filter(issue => issue.borehole_id === borehole.borehole_id)
      
      return {
        ...borehole,
        box_count: boxes.length,
        issue_count: issues.length,
        error_count: issues.filter(i => i.type === 'error').length,
        warning_count: issues.filter(i => i.type === 'warning').length
      }
    })
  })
}

export function setBoreholes(data) {
  appState.boreholes = data
  if (!appState.selectedBoreholeId && data.length > 0) {
    appState.selectedBoreholeId = data[0].borehole_id
  }
  runValidation()
}

export function setCoreBoxes(data) {
  appState.coreBoxes = data
  runValidation()
}

export function setRules(data) {
  appState.rules = { ...appState.rules, ...data }
  runValidation()
}

export function selectBorehole(boreholeId) {
  appState.selectedBoreholeId = boreholeId
  appState.selectedIssueId = null
  appState.selectedBoxNumber = null
}

export function selectIssue(issueId) {
  appState.selectedIssueId = issueId
  const issue = appState.issues.find(i => i.id === issueId)
  if (issue) {
    if (issue.start_depth !== undefined) {
      appState.selectedBoxNumber = findBoxNumberByDepth(issue.start_depth)
    } else if (issue.box_number !== undefined) {
      appState.selectedBoxNumber = issue.box_number
    } else if (issue.box_numbers && issue.box_numbers.length > 0) {
      appState.selectedBoxNumber = issue.box_numbers[0]
    }
  }
}

export function selectBoxNumber(boxNumber) {
  appState.selectedBoxNumber = boxNumber
  appState.selectedIssueId = null
}

export function clearSelection() {
  appState.selectedIssueId = null
  appState.selectedBoxNumber = null
}

export async function loadBoreholesFromFile(file) {
  try {
    const text = await readFileAsText(file)
    const data = parseCSV(text)
    const validation = validateBoreholes(data)
    
    if (!validation.valid) {
      appState.parseErrors = [...appState.parseErrors, ...validation.issues]
      throw new Error('钻孔数据验证失败')
    }
    
    setBoreholes(data)
    return { success: true, data }
  } catch (error) {
    appState.parseErrors.push({
      type: 'error',
      message: `加载钻孔数据失败: ${error.message}`
    })
    return { success: false, error: error.message }
  }
}

export async function loadCoreBoxesFromFile(file) {
  try {
    const text = await readFileAsText(file)
    const data = parseJSON(text)
    const validation = validateCoreBoxes(data, appState.boreholes.map(b => b.borehole_id))
    
    if (validation.issues.length > 0) {
      appState.parseErrors = [...appState.parseErrors, ...validation.issues]
    }
    
    setCoreBoxes(data)
    return { success: true, data }
  } catch (error) {
    appState.parseErrors.push({
      type: 'error',
      message: `加载岩芯箱数据失败: ${error.message}`
    })
    return { success: false, error: error.message }
  }
}

export async function loadRulesFromFile(file) {
  try {
    const text = await readFileAsText(file)
    const data = parseYAML(text)
    const validation = validateRules(data)
    
    if (validation.issues.length > 0) {
      appState.parseErrors = [...appState.parseErrors, ...validation.issues]
    }
    
    setRules(validation.rules)
    return { success: true, rules: validation.rules }
  } catch (error) {
    appState.parseErrors.push({
      type: 'error',
      message: `加载规则文件失败: ${error.message}`
    })
    return { success: false, error: error.message }
  }
}

export function loadSampleData(sampleData) {
  appState.parseErrors = []
  appState.isUsingSampleData = true
  
  if (sampleData.boreholes) {
    const validation = validateBoreholes(sampleData.boreholes)
    if (!validation.valid) {
      appState.parseErrors = [...appState.parseErrors, ...validation.issues]
    }
    setBoreholes(sampleData.boreholes)
  }
  
  if (sampleData.coreBoxes) {
    const validation = validateCoreBoxes(sampleData.coreBoxes, 
      sampleData.boreholes?.map(b => b.borehole_id) || [])
    if (validation.issues.length > 0) {
      appState.parseErrors = [...appState.parseErrors, ...validation.issues]
    }
    setCoreBoxes(sampleData.coreBoxes)
  }
  
  if (sampleData.rules) {
    const validation = validateRules(sampleData.rules)
    if (validation.issues.length > 0) {
      appState.parseErrors = [...appState.parseErrors, ...validation.issues]
    }
    setRules(validation.rules)
  }
}

export function clearAllData() {
  appState.boreholes = []
  appState.coreBoxes = []
  appState.issues = []
  appState.stats = { total: 0, errors: 0, warnings: 0, infos: 0 }
  appState.selectedBoreholeId = null
  appState.selectedIssueId = null
  appState.selectedBoxNumber = null
  appState.parseErrors = []
  appState.isUsingSampleData = false
  appState.rules = {
    depth_gap_threshold: 0.1,
    rqd_min: 0,
    rqd_max: 100,
    recovery_min: 0,
    recovery_max: 100,
    check_lithology_consistency: true,
    check_box_sequence: true,
    check_continuous_depth: true
  }
}

function runValidation() {
  if (appState.boreholes.length === 0 || appState.coreBoxes.length === 0) {
    appState.issues = []
    appState.stats = { total: 0, errors: 0, warnings: 0, infos: 0 }
    return
  }
  
  const result = runAllRules(appState.boreholes, appState.coreBoxes, appState.rules)
  appState.issues = result.issues
  appState.stats = result.stats
}

function findBoxNumberByDepth(depth) {
  const box = computedState.selectedBoreholeBoxes.value.find(b => 
    depth >= b.start_depth && depth <= b.end_depth
  )
  return box ? box.box_number : null
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.onerror = (e) => reject(new Error('文件读取失败'))
    reader.readAsText(file)
  })
}

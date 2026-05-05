import { reactive, computed } from 'vue'

// 数据状态
const state = reactive({
  // 原始数据
  temperatureLogs: [],
  loanLists: [],
  returnChecks: [],
  humidityRecords: [],
  
  // 标本数据（整合后）
  specimens: [],
  
  // 人工改判和备注
  manualOverrides: {},
  notes: {},
  
  // 应用状态
  isDataLoaded: false,
  lastUpdate: null
})

// 计算属性
const getters = {
  // 所有标本
  allSpecimens: computed(() => state.specimens),
  
  // 高风险标本
  highRiskSpecimens: computed(() => 
    state.specimens.filter(s => s.riskLevel === 'high')
  ),
  
  // 中等风险标本
  mediumRiskSpecimens: computed(() => 
    state.specimens.filter(s => s.riskLevel === 'medium')
  ),
  
  // 低风险标本
  lowRiskSpecimens: computed(() => 
    state.specimens.filter(s => s.riskLevel === 'low')
  ),
  
  // 不能入柜的标本
  cannotStoreSpecimens: computed(() => 
    state.specimens.filter(s => s.cannotStore)
  ),
  
  // 需要暂停外借的标本
  suspendLoanSpecimens: computed(() => 
    state.specimens.filter(s => s.suspendLoan)
  ),
  
  // 统计数据
  statistics: computed(() => ({
    totalSpecimens: state.specimens.length,
    highRisk: getters.highRiskSpecimens.value.length,
    mediumRisk: getters.mediumRiskSpecimens.value.length,
    lowRisk: getters.lowRiskSpecimens.value.length,
    cannotStore: getters.cannotStoreSpecimens.value.length,
    suspendLoan: getters.suspendLoanSpecimens.value.length
  }))
}

// 方法
const actions = {
  // 加载数据
  async loadData() {
    try {
      const result = await window.electronAPI.loadData()
      if (result.success && result.data) {
        // 从本地存储加载数据
        const data = result.data
        state.temperatureLogs = data.temperatureLogs || []
        state.loanLists = data.loanLists || []
        state.returnChecks = data.returnChecks || []
        state.humidityRecords = data.humidityRecords || []
        state.manualOverrides = data.manualOverrides || {}
        state.notes = data.notes || {}
        state.lastUpdate = data.lastUpdate
        
        // 整合标本数据
        if (state.temperatureLogs.length > 0 || 
            state.loanLists.length > 0 || 
            state.returnChecks.length > 0 || 
            state.humidityRecords.length > 0) {
          actions.integrateSpecimenData()
        }
        
        state.isDataLoaded = true
        return true
      }
      state.isDataLoaded = true
      return false
    } catch (error) {
      console.error('加载数据失败:', error)
      state.isDataLoaded = true
      return false
    }
  },
  
  // 保存数据
  async saveData() {
    try {
      const data = {
        temperatureLogs: state.temperatureLogs,
        loanLists: state.loanLists,
        returnChecks: state.returnChecks,
        humidityRecords: state.humidityRecords,
        manualOverrides: state.manualOverrides,
        notes: state.notes,
        lastUpdate: new Date().toISOString()
      }
      
      const result = await window.electronAPI.saveData(data)
      if (result.success) {
        state.lastUpdate = new Date().toISOString()
        return true
      }
      return false
    } catch (error) {
      console.error('保存数据失败:', error)
      return false
    }
  },
  
  // 导入示例数据
  importSampleData() {
    // 冷冻灭虫柜温度日志
    state.temperatureLogs = [
      { id: 'temp1', specimenId: 'S001', date: '2026-05-01', temperature: -18, duration: 72, status: '正常' },
      { id: 'temp2', specimenId: 'S002', date: '2026-05-01', temperature: -15, duration: 48, status: '温度偏高' },
      { id: 'temp3', specimenId: 'S003', date: '2026-05-02', temperature: -20, duration: 72, status: '正常' },
      { id: 'temp4', specimenId: 'S004', date: '2026-05-02', temperature: -10, duration: 24, status: '严重异常' },
      { id: 'temp5', specimenId: 'S005', date: '2026-05-03', temperature: -19, duration: 72, status: '正常' }
    ]
    
    // 标本借展清单
    state.loanLists = [
      { id: 'loan1', specimenId: 'S001', borrower: '北京大学自然博物馆', loanDate: '2026-04-15', expectedReturn: '2026-05-15', actualReturn: '2026-05-01', condition: '良好' },
      { id: 'loan2', specimenId: 'S002', borrower: '上海昆虫研究所', loanDate: '2026-04-20', expectedReturn: '2026-05-20', actualReturn: null, condition: null },
      { id: 'loan3', specimenId: 'S003', borrower: '广州自然博物馆', loanDate: '2026-03-10', expectedReturn: '2026-04-10', actualReturn: '2026-04-25', condition: '轻微损伤' },
      { id: 'loan4', specimenId: 'S004', borrower: '成都昆虫馆', loanDate: '2026-04-01', expectedReturn: '2026-05-01', actualReturn: '2026-05-02', condition: '严重损伤' },
      { id: 'loan5', specimenId: 'S005', borrower: '昆明动物研究所', loanDate: '2026-04-10', expectedReturn: '2026-05-10', actualReturn: '2026-05-05', condition: '良好' }
    ]
    
    // 归还照片复查表
    state.returnChecks = [
      { id: 'check1', specimenId: 'S001', checkDate: '2026-05-02', photos: ['正面照', '侧面照', '标签照'], condition: '良好', issues: [], inspector: '张管理员' },
      { id: 'check2', specimenId: 'S003', checkDate: '2026-04-26', photos: ['正面照', '侧面照'], condition: '轻微损伤', issues: ['触角轻微折断'], inspector: '李管理员' },
      { id: 'check3', specimenId: 'S004', checkDate: '2026-05-03', photos: ['正面照', '侧面照', '标签照', '损伤特写'], condition: '严重损伤', issues: ['翅膀严重破损', '胸部变形'], inspector: '王管理员' },
      { id: 'check4', specimenId: 'S005', checkDate: '2026-05-06', photos: ['正面照', '侧面照', '标签照'], condition: '良好', issues: [], inspector: '张管理员' }
    ]
    
    // 展柜湿度记录
    state.humidityRecords = [
      { id: 'hum1', specimenId: 'S001', displayCase: 'A-01', date: '2026-05-01', humidity: 65, status: '正常' },
      { id: 'hum2', specimenId: 'S002', displayCase: 'A-02', date: '2026-05-01', humidity: 75, status: '偏高' },
      { id: 'hum3', specimenId: 'S003', displayCase: 'B-01', date: '2026-05-02', humidity: 45, status: '偏低' },
      { id: 'hum4', specimenId: 'S004', displayCase: 'B-02', date: '2026-05-02', humidity: 80, status: '严重偏高' },
      { id: 'hum5', specimenId: 'S005', displayCase: 'C-01', date: '2026-05-03', humidity: 62, status: '正常' }
    ]
    
    // 整合标本数据
    actions.integrateSpecimenData()
    
    // 保存数据
    actions.saveData()
    
    return true
  },
  
  // 整合标本数据
  integrateSpecimenData() {
    // 收集所有唯一的标本ID
    const specimenIds = new Set()
    
    state.temperatureLogs.forEach(log => specimenIds.add(log.specimenId))
    state.loanLists.forEach(loan => specimenIds.add(loan.specimenId))
    state.returnChecks.forEach(check => specimenIds.add(check.specimenId))
    state.humidityRecords.forEach(record => specimenIds.add(record.specimenId))
    
    // 为每个标本创建整合数据
    state.specimens = Array.from(specimenIds).map(id => {
      const temperatureLog = state.temperatureLogs.find(log => log.specimenId === id)
      const loan = state.loanLists.find(l => l.specimenId === id)
      const returnCheck = state.returnChecks.find(c => c.specimenId === id)
      const humidityRecord = state.humidityRecords.find(r => r.specimenId === id)
      
      // 评估风险
      const riskAssessment = actions.assessRisk({
        temperatureLog,
        loan,
        returnCheck,
        humidityRecord
      })
      
      // 检查人工改判
      const manualOverride = state.manualOverrides[id]
      
      return {
        id,
        basicInfo: {
          specimenId: id,
          name: `标本 ${id}`,
          category: '昆虫标本'
        },
        temperatureLog,
        loan,
        returnCheck,
        humidityRecord,
        riskLevel: manualOverride?.riskLevel || riskAssessment.riskLevel,
        riskReasons: riskAssessment.reasons,
        cannotStore: manualOverride?.cannotStore !== undefined ? manualOverride.cannotStore : riskAssessment.cannotStore,
        suspendLoan: manualOverride?.suspendLoan !== undefined ? manualOverride.suspendLoan : riskAssessment.suspendLoan,
        hasManualOverride: !!manualOverride,
        notes: state.notes[id] || ''
      }
    })
  },
  
  // 评估风险
  assessRisk(data) {
    const { temperatureLog, loan, returnCheck, humidityRecord } = data
    const reasons = []
    let riskLevel = 'low'
    let cannotStore = false
    let suspendLoan = false
    
    // 检查冷冻温度
    if (temperatureLog) {
      if (temperatureLog.status === '严重异常') {
        reasons.push('冷冻温度严重异常，可能影响标本保存')
        riskLevel = 'high'
        cannotStore = true
        suspendLoan = true
      } else if (temperatureLog.status === '温度偏高') {
        reasons.push('冷冻温度偏高，建议检查保存条件')
        if (riskLevel === 'low') riskLevel = 'medium'
      }
    }
    
    // 检查借展状态
    if (loan) {
      if (loan.actualReturn === null && new Date() > new Date(loan.expectedReturn)) {
        reasons.push('标本超期未归还')
        if (riskLevel === 'low') riskLevel = 'medium'
      }
      
      if (loan.condition === '严重损伤') {
        reasons.push('标本借展后严重损伤')
        riskLevel = 'high'
        cannotStore = true
        suspendLoan = true
      } else if (loan.condition === '轻微损伤') {
        reasons.push('标本借展后轻微损伤')
        if (riskLevel === 'low') riskLevel = 'medium'
        suspendLoan = true
      }
    }
    
    // 检查归还复查
    if (returnCheck) {
      if (returnCheck.condition === '严重损伤') {
        reasons.push('归还复查发现严重损伤')
        riskLevel = 'high'
        cannotStore = true
        suspendLoan = true
      } else if (returnCheck.condition === '轻微损伤') {
        reasons.push('归还复查发现轻微损伤')
        if (riskLevel === 'low') riskLevel = 'medium'
        suspendLoan = true
      }
      
      if (returnCheck.issues && returnCheck.issues.length > 0) {
        reasons.push(`存在以下问题：${returnCheck.issues.join('、')}`)
      }
    }
    
    // 检查湿度记录
    if (humidityRecord) {
      if (humidityRecord.status === '严重偏高' || humidityRecord.status === '严重偏低') {
        reasons.push('展柜湿度严重异常，可能影响标本保存')
        if (riskLevel !== 'high') riskLevel = 'medium'
        cannotStore = true
      } else if (humidityRecord.status === '偏高' || humidityRecord.status === '偏低') {
        reasons.push('展柜湿度异常，建议调整')
        if (riskLevel === 'low') riskLevel = 'medium'
      }
    }
    
    return {
      riskLevel,
      reasons,
      cannotStore,
      suspendLoan
    }
  },
  
  // 获取标本详情
  getSpecimenById(id) {
    return state.specimens.find(s => s.id === id)
  },
  
  // 人工改判
  setManualOverride(specimenId, override) {
    state.manualOverrides[specimenId] = {
      ...state.manualOverrides[specimenId],
      ...override
    }
    
    // 更新标本数据
    const specimen = state.specimens.find(s => s.id === specimenId)
    if (specimen) {
      if (override.riskLevel !== undefined) {
        specimen.riskLevel = override.riskLevel
      }
      if (override.cannotStore !== undefined) {
        specimen.cannotStore = override.cannotStore
      }
      if (override.suspendLoan !== undefined) {
        specimen.suspendLoan = override.suspendLoan
      }
      specimen.hasManualOverride = true
    }
    
    // 保存数据
    actions.saveData()
  },
  
  // 清除人工改判
  clearManualOverride(specimenId) {
    delete state.manualOverrides[specimenId]
    
    // 重新评估风险
    const specimen = state.specimens.find(s => s.id === specimenId)
    if (specimen) {
      const riskAssessment = actions.assessRisk({
        temperatureLog: specimen.temperatureLog,
        loan: specimen.loan,
        returnCheck: specimen.returnCheck,
        humidityRecord: specimen.humidityRecord
      })
      
      specimen.riskLevel = riskAssessment.riskLevel
      specimen.riskReasons = riskAssessment.reasons
      specimen.cannotStore = riskAssessment.cannotStore
      specimen.suspendLoan = riskAssessment.suspendLoan
      specimen.hasManualOverride = false
    }
    
    // 保存数据
    actions.saveData()
  },
  
  // 设置备注
  setNotes(specimenId, notes) {
    state.notes[specimenId] = notes
    
    // 更新标本数据
    const specimen = state.specimens.find(s => s.id === specimenId)
    if (specimen) {
      specimen.notes = notes
    }
    
    // 保存数据
    actions.saveData()
  },
  
  // 导出 Markdown 处置清单
  exportMarkdown() {
    let markdown = '# 昆虫标本处置清单\n\n'
    markdown += `生成时间：${new Date().toLocaleString('zh-CN')}\n\n`
    
    // 不能入柜的标本
    if (getters.cannotStoreSpecimens.value.length > 0) {
      markdown += '## 一、不能入柜的标本\n\n'
      getters.cannotStoreSpecimens.value.forEach(specimen => {
        markdown += `### ${specimen.id}\n\n`
        markdown += `- 风险等级：${specimen.riskLevel === 'high' ? '高' : specimen.riskLevel === 'medium' ? '中' : '低'}\n`
        markdown += `- 风险原因：\n`
        specimen.riskReasons.forEach(reason => {
          markdown += `  - ${reason}\n`
        })
        if (specimen.notes) {
          markdown += `- 管理员备注：${specimen.notes}\n`
        }
        markdown += '\n'
      })
    }
    
    // 需要暂停外借的标本
    if (getters.suspendLoanSpecimens.value.length > 0) {
      markdown += '## 二、需要暂停外借的标本\n\n'
      getters.suspendLoanSpecimens.value.forEach(specimen => {
        markdown += `### ${specimen.id}\n\n`
        markdown += `- 风险等级：${specimen.riskLevel === 'high' ? '高' : specimen.riskLevel === 'medium' ? '中' : '低'}\n`
        markdown += `- 风险原因：\n`
        specimen.riskReasons.forEach(reason => {
          markdown += `  - ${reason}\n`
        })
        if (specimen.notes) {
          markdown += `- 管理员备注：${specimen.notes}\n`
        }
        markdown += '\n'
      })
    }
    
    // 统计信息
    markdown += '## 三、统计信息\n\n'
    markdown += `- 总标本数：${getters.statistics.value.totalSpecimens}\n`
    markdown += `- 高风险标本：${getters.statistics.value.highRisk}\n`
    markdown += `- 中等风险标本：${getters.statistics.value.mediumRisk}\n`
    markdown += `- 低风险标本：${getters.statistics.value.lowRisk}\n`
    markdown += `- 不能入柜标本：${getters.statistics.value.cannotStore}\n`
    markdown += `- 需暂停外借标本：${getters.statistics.value.suspendLoan}\n`
    
    return markdown
  },
  
  // 导出 JSON 明细
  exportJSON() {
    const data = {
      exportTime: new Date().toISOString(),
      statistics: getters.statistics.value,
      specimens: state.specimens.map(specimen => ({
        id: specimen.id,
        basicInfo: specimen.basicInfo,
        riskLevel: specimen.riskLevel,
        riskReasons: specimen.riskReasons,
        cannotStore: specimen.cannotStore,
        suspendLoan: specimen.suspendLoan,
        hasManualOverride: specimen.hasManualOverride,
        notes: specimen.notes,
        temperatureLog: specimen.temperatureLog,
        loan: specimen.loan,
        returnCheck: specimen.returnCheck,
        humidityRecord: specimen.humidityRecord
      }))
    }
    
    return JSON.stringify(data, null, 2)
  },
  
  // 清空所有数据
  clearAllData() {
    state.temperatureLogs = []
    state.loanLists = []
    state.returnChecks = []
    state.humidityRecords = []
    state.specimens = []
    state.manualOverrides = {}
    state.notes = {}
    state.lastUpdate = null
    
    // 保存数据
    actions.saveData()
  }
}

// 创建 store
export function useDataStore() {
  return {
    state,
    ...getters,
    ...actions
  }
}

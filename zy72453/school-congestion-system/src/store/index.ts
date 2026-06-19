import { reactive, computed } from 'vue'
import type {
  CongestionRecord,
  Community,
  HistoryVersion,
  ModelParams,
  RedLineNote,
  GridInspectorRecord,
  StreetSummary,
  CongestionCalculation
} from '../types'

export type ImportResultItem = {
  index: number
  communityName: string
  schoolName: string
  status: 'new' | 'duplicate_current' | 'duplicate_history'
  duplicateRecordId?: string
  duplicateRecordName?: string
  recordId?: string
}

export type ImportResult = {
  batchId: string
  items: ImportResultItem[]
  newCount: number
  duplicateCurrentCount: number
  duplicateHistoryCount: number
}

const generateId = () => Math.random().toString(36).substring(2, 11)

const modelParams: ModelParams = {
  version: 'v2.1.0',
  name: '学校周边拥堵评估模型',
  description: '基于距离、小区规模、历史数据的综合评估模型',
  parameters: {
    distanceWeight: 0.3,
    householdWeight: 0.25,
    peakHourWeight: 0.25,
    historicalDataWeight: 0.2
  },
  tradeOffs: '优先保障学校周边500米内小区的识别准确率，远距离小区可能存在漏判。高峰时段权重基于2024年秋季学期统计数据。',
  createdAt: '2024-09-01'
}

const mockCommunities: Community[] = [
  {
    id: 'comm-001',
    names: [
      { id: 'name-001', name: '阳光花园', isOldName: false, verified: true },
      { id: 'name-002', name: '阳光小区', isOldName: true, verified: false }
    ],
    address: '文化路88号',
    area: 52000,
    householdCount: 1280
  },
  {
    id: 'comm-002',
    names: [
      { id: 'name-003', name: '学府家园', isOldName: false, verified: true },
      { id: 'name-004', name: '教师新村', isOldName: true, verified: true, verifiedBy: 'inspector', verifiedAt: '2024-08-15' }
    ],
    address: '学府路126号',
    area: 38000,
    householdCount: 860
  }
]

const mockRedLineNotes: RedLineNote[] = [
  {
    id: 'note-001',
    importBatchId: 'batch-001',
    communityId: 'comm-001',
    communityName: '阳光花园',
    schoolName: '第一实验小学',
    distanceToSchool: 320,
    noteContent: '早晚高峰接送车辆较多，占用非机动车道',
    congestionLevel: 'high',
    importTime: '2024-10-15 09:30:00',
    importedBy: '城更项目经理-阿宁',
    isDuplicate: false
  },
  {
    id: 'note-002',
    importBatchId: 'batch-001',
    communityId: 'comm-002',
    communityName: '学府家园',
    schoolName: '第一实验小学',
    distanceToSchool: 180,
    noteContent: '校门口对面小区，接送人流与放学人流交织',
    congestionLevel: 'severe',
    importTime: '2024-10-15 09:30:00',
    importedBy: '城更项目经理-阿宁',
    isDuplicate: false
  },
  {
    id: 'note-003',
    importBatchId: 'batch-001',
    communityId: 'comm-001',
    communityName: '阳光花园',
    schoolName: '第一实验小学',
    distanceToSchool: 320,
    noteContent: '学校门口接送车辆较多，早高峰尤为明显',
    congestionLevel: 'medium',
    importTime: '2024-10-15 09:30:00',
    importedBy: '城更项目经理-阿宁',
    isDuplicate: true,
    duplicateOfId: 'note-001'
  }
]

const mockGridInspector: GridInspectorRecord = {
  id: 'grid-001',
  redLineNoteId: 'note-001',
  inspectorName: '网格员-小张',
  inspectionTime: '2024-10-16 17:30:00',
  photos: ['photo1.jpg', 'photo2.jpg'],
  description: '下午5点-6点为高峰，约有80辆车排队，占用2条车道',
  peakTime: '17:00-18:30',
  vehicleCount: 85,
  pedestrianCount: 230,
  issues: ['无专用等候区', '非机动车道被占用', '过街设施不足'],
  suggestions: '建议设置临时等候区，增加过街天桥',
  reviewedByManager: true,
  reviewTime: '2024-10-17 10:00:00',
  managerNotes: '情况属实，已纳入整改计划'
}

const mockCalculation: CongestionCalculation = {
  id: 'calc-001',
  redLineNoteId: 'note-001',
  modelVersion: 'v2.1.0',
  score: 82,
  level: 'high',
  factors: {
    distance: 25,
    householdDensity: 22,
    peakVolume: 20,
    historicalIncident: 15
  },
  paramsSnapshot: modelParams,
  calculatedAt: '2024-10-15 10:00:00'
}

const mockSummary: StreetSummary = {
  id: 'summary-001',
  redLineNoteId: 'note-001',
  title: '阳光花园周边接送拥堵问题',
  reasonKept: '距离学校仅320米，且现场核实高峰时段车辆排队超过80辆，严重影响通行',
  missingMaterials: ['交通流量详细统计报告', '周边道路承载力评估'],
  nextStep: 'inspector',
  nextStepPerson: '市政巡检员',
  status: 'in_progress',
  updatedAt: '2024-10-18 14:00:00',
  updatedBy: '城更项目经理-阿宁',
  reviewHistory: ['初始导入', '网格员现场核实', '项目经理审核']
}

const mockHistory: HistoryVersion[] = [
  {
    id: 'hist-001',
    recordId: 'note-001',
    recordType: 'redLineNote',
    fieldName: 'noteContent',
    oldValue: '高峰时段车辆较多',
    newValue: '早晚高峰接送车辆较多，占用非机动车道',
    changedBy: '城更项目经理-阿宁',
    changedAt: '2024-10-15 14:20:00',
    changeReason: '补充现场观察细节'
  }
]

const mockHistory003: HistoryVersion[] = [
  {
    id: 'hist-003',
    recordId: 'note-003',
    recordType: 'redLineNote',
    fieldName: 'noteContent',
    oldValue: '接送车辆较多',
    newValue: '学校门口接送车辆较多，早高峰尤为明显',
    changedBy: '城更项目经理-阿宁',
    changedAt: '2024-10-15 10:15:00',
    changeReason: '补充高峰时段特征'
  },
  {
    id: 'hist-004',
    recordId: 'note-003',
    recordType: 'redLineNote',
    fieldName: 'congestionLevel',
    oldValue: 'low',
    newValue: 'medium',
    changedBy: '城更项目经理-阿宁',
    changedAt: '2024-10-15 10:20:00',
    changeReason: '根据现场观察调整拥堵等级'
  }
]

const mockRecords: CongestionRecord[] = [
  {
    id: 'record-001',
    redLineNote: mockRedLineNotes[0],
    gridInspector: mockGridInspector,
    calculation: mockCalculation,
    summary: mockSummary,
    flowStep: 'summary_update',
    needsReview: true,
    reviewReason: '小区存在新旧名称：阳光花园 / 阳光小区，需市政巡检员复核',
    reviewedByInspector: false,
    createdAt: '2024-10-15 09:30:00',
    updatedAt: '2024-10-18 14:00:00',
    historyVersions: mockHistory
  },
  {
    id: 'record-002',
    redLineNote: mockRedLineNotes[1],
    flowStep: 'import',
    needsReview: false,
    reviewedByInspector: false,
    createdAt: '2024-10-15 09:30:00',
    updatedAt: '2024-10-15 09:30:00',
    historyVersions: []
  },
  {
    id: 'record-003',
    redLineNote: mockRedLineNotes[2],
    flowStep: 'inspector_review',
    needsReview: false,
    reviewedByInspector: false,
    createdAt: '2024-10-15 09:30:00',
    updatedAt: '2024-10-15 10:20:00',
    historyVersions: mockHistory003
  }
]

export type DetailTab = 'redline' | 'inspector' | 'summary' | 'history' | 'calculation'

interface State {
  records: CongestionRecord[]
  communities: Community[]
  modelParams: ModelParams
  currentUser: 'inspector' | 'manager'
  selectedRecordId: string | null
  viewMode: 'list' | 'chart' | '3d'
  activeTab: 'all' | 'pending' | 'needsReview'
  activeDetailTab: DetailTab
  lastImportResult: ImportResult | null
}

const state = reactive<State>({
  records: mockRecords,
  communities: mockCommunities,
  modelParams: modelParams,
  currentUser: 'manager',
  selectedRecordId: null,
  viewMode: 'list',
  activeTab: 'all',
  activeDetailTab: 'redline',
  lastImportResult: null
})

export function useStore() {
  const filteredRecords = computed(() => {
    let result = [...state.records]
    if (state.activeTab === 'pending') {
      result = result.filter(r => r.flowStep !== 'summary_update')
    } else if (state.activeTab === 'needsReview') {
      result = result.filter(r => r.needsReview)
    }
    return result
  })

  const selectedRecord = computed(() => {
    return state.records.find(r => r.id === state.selectedRecordId) || null
  })

  const stats = computed(() => ({
    total: state.records.length,
    severe: state.records.filter(r => r.redLineNote.congestionLevel === 'severe').length,
    high: state.records.filter(r => r.redLineNote.congestionLevel === 'high').length,
    needsReview: state.records.filter(r => r.needsReview).length,
    pending: state.records.filter(r => r.flowStep !== 'summary_update').length
  }))

  function findDuplicateInHistory(note: Partial<RedLineNote>): CongestionRecord | undefined {
    return state.records.find(r => {
      const sameCommunity = r.redLineNote.communityId === note.communityId ||
        r.redLineNote.communityName === note.communityName
      const sameSchool = r.redLineNote.schoolName === note.schoolName
      const similarContent = r.redLineNote.noteContent === note.noteContent
      return sameCommunity && sameSchool && similarContent
    })
  }

  function checkCommunityNameConflict(communityName: string): { needsReview: boolean; reason?: string } {
    for (const comm of state.communities) {
      const matchingNames = comm.names.filter(n =>
        n.name === communityName ||
        communityName.includes(n.name) ||
        n.name.includes(communityName)
      )
      if (matchingNames.length > 0 && comm.names.length > 1) {
        const allNames = comm.names.map(n => n.name).join(' / ')
        const hasUnverified = comm.names.some(n => !n.verified)
        if (hasUnverified) {
          return {
            needsReview: true,
            reason: `小区存在新旧名称：${allNames}，需市政巡检员复核`
          }
        }
      }
    }
    return { needsReview: false }
  }

  function addHistoryVersion(
    recordId: string,
    recordType: HistoryVersion['recordType'],
    fieldName: string,
    oldValue: string,
    newValue: string,
    changedBy: string,
    changeReason: string
  ) {
    const record = state.records.find(r => r.id === recordId)
    if (record && oldValue !== newValue) {
      record.historyVersions.push({
        id: generateId(),
        recordId,
        recordType,
        fieldName,
        oldValue,
        newValue,
        changedBy,
        changedAt: new Date().toLocaleString('zh-CN'),
        changeReason
      })
    }
  }

  function importRedLineNotes(notes: Partial<RedLineNote>[]): ImportResult {
    const batchId = generateId()
    const result: ImportResult = {
      batchId,
      items: [],
      newCount: 0,
      duplicateCurrentCount: 0,
      duplicateHistoryCount: 0
    }
    const processedNamesInBatch = new Set<string>()

    notes.forEach((note, index) => {
      const dupKey = `${note.communityName || ''}_${note.schoolName || ''}_${note.noteContent || ''}`

      const histDup = findDuplicateInHistory(note)
      const currentDup = processedNamesInBatch.has(dupKey)

      let status: ImportResultItem['status'] = 'new'
      let duplicateRecordId: string | undefined
      let duplicateRecordName: string | undefined

      if (currentDup) {
        status = 'duplicate_current'
        const firstMatch = result.items.find(i => i.communityName === note.communityName && (i.status === 'new' || i.status === 'duplicate_history'))
        duplicateRecordId = firstMatch?.duplicateRecordId || firstMatch?.recordId
        duplicateRecordName = note.communityName || '(同批次)'
        result.duplicateCurrentCount++
      } else if (histDup) {
        status = 'duplicate_history'
        duplicateRecordId = histDup.id
        duplicateRecordName = histDup.redLineNote.communityName
        result.duplicateHistoryCount++
        processedNamesInBatch.add(dupKey)
      }

      const item: ImportResultItem = {
        index,
        communityName: note.communityName || '(未填写)',
        schoolName: note.schoolName || '(未填写)',
        status,
        duplicateRecordId,
        duplicateRecordName
      }

      if (status === 'new') {
        processedNamesInBatch.add(dupKey)

        const conflictCheck = checkCommunityNameConflict(note.communityName || '')

        const newNote: RedLineNote = {
          id: generateId(),
          importBatchId: batchId,
          communityId: note.communityId || generateId(),
          communityName: note.communityName || '',
          schoolName: note.schoolName || '',
          distanceToSchool: note.distanceToSchool || 0,
          noteContent: note.noteContent || '',
          congestionLevel: note.congestionLevel || 'medium',
          importTime: new Date().toLocaleString('zh-CN'),
          importedBy: state.currentUser === 'manager' ? '城更项目经理-阿宁' : '市政巡检员',
          isDuplicate: false
        }

        const newRecord: CongestionRecord = {
          id: generateId(),
          redLineNote: newNote,
          flowStep: 'import',
          needsReview: conflictCheck.needsReview,
          reviewReason: conflictCheck.reason,
          reviewedByInspector: false,
          createdAt: new Date().toLocaleString('zh-CN'),
          updatedAt: new Date().toLocaleString('zh-CN'),
          historyVersions: []
        }

        state.records.push(newRecord)
        item.recordId = newRecord.id
        result.newCount++
      }

      result.items.push(item)
    })

    state.lastImportResult = result
    return result
  }

  function updateRedLineNote(recordId: string, updates: Partial<RedLineNote>, reason: string) {
    const record = state.records.find(r => r.id === recordId)
    if (!record) return

    const oldNote = { ...record.redLineNote }
    Object.assign(record.redLineNote, updates)
    record.updatedAt = new Date().toLocaleString('zh-CN')

    for (const key of Object.keys(updates)) {
      const oldVal = String(oldNote[key as keyof RedLineNote])
      const newVal = String(updates[key as keyof RedLineNote])
      if (oldVal !== newVal) {
        addHistoryVersion(
          recordId,
          'redLineNote',
          key,
          oldVal,
          newVal,
          state.currentUser === 'manager' ? '城更项目经理-阿宁' : '市政巡检员',
          reason
        )
      }
    }
  }

  function addGridInspectorRecord(recordId: string, inspectorData: Partial<GridInspectorRecord>) {
    const record = state.records.find(r => r.id === recordId)
    if (!record) return

    record.gridInspector = {
      id: generateId(),
      redLineNoteId: record.redLineNote.id,
      inspectorName: inspectorData.inspectorName || '网格员',
      inspectionTime: new Date().toLocaleString('zh-CN'),
      photos: inspectorData.photos || [],
      description: inspectorData.description || '',
      peakTime: inspectorData.peakTime || '',
      vehicleCount: inspectorData.vehicleCount || 0,
      pedestrianCount: inspectorData.pedestrianCount || 0,
      issues: inspectorData.issues || [],
      suggestions: inspectorData.suggestions || '',
      reviewedByManager: false
    }

    record.flowStep = 'inspector_review'
    record.updatedAt = new Date().toLocaleString('zh-CN')
  }

  function reviewGridInspector(recordId: string, managerNotes: string, approved: boolean) {
    const record = state.records.find(r => r.id === recordId)
    if (!record || !record.gridInspector) return

    const oldReviewed = record.gridInspector.reviewedByManager
    record.gridInspector.reviewedByManager = approved
    record.gridInspector.reviewTime = new Date().toLocaleString('zh-CN')
    record.gridInspector.managerNotes = managerNotes

    if (approved) {
      record.flowStep = 'summary_update'
    }

    addHistoryVersion(
      recordId,
      'gridInspector',
      'reviewedByManager',
      String(oldReviewed),
      String(approved),
      '城更项目经理-阿宁',
      managerNotes
    )

    record.updatedAt = new Date().toLocaleString('zh-CN')
  }

  function updateSummary(recordId: string, summaryData: Partial<StreetSummary>) {
    const record = state.records.find(r => r.id === recordId)
    if (!record) return

    if (!record.summary) {
      record.summary = {
        id: generateId(),
        redLineNoteId: record.redLineNote.id,
        title: summaryData.title || '',
        reasonKept: summaryData.reasonKept || '',
        missingMaterials: summaryData.missingMaterials || [],
        nextStep: summaryData.nextStep || 'inspector',
        nextStepPerson: summaryData.nextStepPerson || '市政巡检员',
        status: summaryData.status || 'pending',
        updatedAt: new Date().toLocaleString('zh-CN'),
        updatedBy: '城更项目经理-阿宁',
        reviewHistory: ['街道摘要生成']
      }
    } else {
      const oldSummary = { ...record.summary }
      Object.assign(record.summary, summaryData, {
        updatedAt: new Date().toLocaleString('zh-CN'),
        updatedBy: '城更项目经理-阿宁'
      })

      for (const key of Object.keys(summaryData)) {
        const oldVal = JSON.stringify(oldSummary[key as keyof StreetSummary])
        const newVal = JSON.stringify(summaryData[key as keyof StreetSummary])
        if (oldVal !== newVal) {
          addHistoryVersion(
            recordId,
            'summary',
            key,
            oldVal,
            newVal,
            '城更项目经理-阿宁',
            '更新街道摘要'
          )
        }
      }
    }

    record.updatedAt = new Date().toLocaleString('zh-CN')
  }

  function inspectorReview(recordId: string, approved: boolean, _comments: string) {
    const record = state.records.find(r => r.id === recordId)
    if (!record) return

    record.reviewedByInspector = approved
    record.needsReview = !approved
    if (approved) {
      record.reviewReason = undefined
    }
    record.updatedAt = new Date().toLocaleString('zh-CN')

    for (const comm of state.communities) {
      if (comm.id === record.redLineNote.communityId) {
        for (const name of comm.names) {
          if (!name.verified) {
            name.verified = true
            name.verifiedBy = 'inspector'
            name.verifiedAt = new Date().toLocaleString('zh-CN')
          }
        }
      }
    }
  }

  function setSelectedRecord(id: string | null) {
    state.selectedRecordId = id
  }

  function setViewMode(mode: 'list' | 'chart' | '3d') {
    state.viewMode = mode
  }

  function setActiveTab(tab: 'all' | 'pending' | 'needsReview') {
    state.activeTab = tab
  }

  function setActiveDetailTab(tab: DetailTab) {
    state.activeDetailTab = tab
  }

  function selectRecordAndJump(recordId: string, tab: DetailTab = 'redline') {
    state.selectedRecordId = recordId
    state.activeDetailTab = tab
  }

  function findFirstRecordByLevel(level: string): CongestionRecord | undefined {
    return state.records.find(r => r.redLineNote.congestionLevel === level)
  }

  function findFirstRecordByFlowStep(step: string): CongestionRecord | undefined {
    return state.records.find(r => r.flowStep === step)
  }

  function setCurrentUser(user: 'inspector' | 'manager') {
    state.currentUser = user
  }

  function exportRecordsToCSV(): string {
    const headers = [
      '记录ID', '小区名称', '学校名称', '距离学校(米)', '拥堵等级',
      '备注内容', '导入时间', '导入人', '流程步骤',
      '是否待复核', '复核原因', '街道摘要标题', '下一步处理人'
    ]
    const rows = state.records.map(r => [
      r.id,
      r.redLineNote.communityName,
      r.redLineNote.schoolName,
      r.redLineNote.distanceToSchool,
      r.redLineNote.congestionLevel,
      r.redLineNote.noteContent.replace(/,/g, '，'),
      r.redLineNote.importTime,
      r.redLineNote.importedBy,
      r.flowStep,
      r.needsReview ? '是' : '否',
      r.reviewReason || '',
      r.summary?.title || '',
      r.summary?.nextStepPerson || ''
    ])
    return [headers, ...rows].map(row => row.join(',')).join('\n')
  }

  return {
    state,
    filteredRecords,
    selectedRecord,
    stats,
    importRedLineNotes,
    updateRedLineNote,
    addGridInspectorRecord,
    reviewGridInspector,
    updateSummary,
    inspectorReview,
    setSelectedRecord,
    setViewMode,
    setActiveTab,
    setActiveDetailTab,
    selectRecordAndJump,
    findFirstRecordByLevel,
    findFirstRecordByFlowStep,
    setCurrentUser,
    addHistoryVersion,
    exportRecordsToCSV
  }
}

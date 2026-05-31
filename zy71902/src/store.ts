import { reactive, computed } from 'vue'
import type { ScoreRecord, RecordStatus, SourceType, ImportResult, FilterOptions, HistoryEntry } from './types'

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

function formatDate(date: Date): string {
  return date.toISOString()
}

function createHistoryEntry(
  action: string,
  operator: string,
  detail: string,
  oldStatus?: RecordStatus,
  newStatus?: RecordStatus
): HistoryEntry {
  return {
    id: generateId(),
    timestamp: formatDate(new Date()),
    action,
    operator,
    detail,
    oldStatus,
    newStatus
  }
}

const state = reactive<{
  records: ScoreRecord[]
  filter: FilterOptions
  selectedIds: string[]
}>({
  records: [],
  filter: {
    status: '',
    source: '',
    studentName: '',
    songTitle: '',
    instrument: ''
  },
  selectedIds: []
})

function findDuplicates(record: Partial<ScoreRecord>, excludeId?: string): string[] {
  return state.records
    .filter((r) => {
      if (!r || !r.studentName || !r.songTitle) return false
      if (excludeId && r.id === excludeId) return false
      return r.studentName === record.studentName && r.songTitle === record.songTitle
    })
    .map((r) => r.id)
}

export function useStore() {
  const filteredRecords = computed(() => {
    return state.records.filter((record) => {
      if (!record || !record.id) return false
      if (state.filter.status && record.status !== state.filter.status) return false
      if (state.filter.source && record.source !== state.filter.source) return false
      if (state.filter.studentName && !record.studentName?.includes(state.filter.studentName)) return false
      if (state.filter.songTitle && !record.songTitle?.includes(state.filter.songTitle)) return false
      if (state.filter.instrument && !record.instrument?.includes(state.filter.instrument)) return false
      return true
    })
  })

  const stats = computed(() => ({
    total: state.records.filter((r) => r && r.id).length,
    pending: state.records.filter((r) => r && r.status === 'pending').length,
    confirmed: state.records.filter((r) => r && r.status === 'confirmed').length,
    duplicate: state.records.filter((r) => r && r.status === 'duplicate').length,
    rejected: state.records.filter((r) => r && r.status === 'rejected').length
  }))

  function addRecord(
    recordData: Omit<ScoreRecord, 'id' | 'createdAt' | 'updatedAt' | 'history' | 'duplicateIds'>,
    operator: string
  ): ScoreRecord {
    const duplicateIds = findDuplicates(recordData)
    const initialStatus = duplicateIds.length > 0 ? 'duplicate' : (recordData.status || 'pending')
    const initialReason = duplicateIds.length > 0
      ? '检测到重复记录，关联ID: ' + duplicateIds.join(', ')
      : (recordData.pendingReason || '')

    const newRecord: ScoreRecord = {
      studentName: recordData.studentName || '',
      instrument: recordData.instrument || '',
      part: recordData.part || '',
      songTitle: recordData.songTitle || '',
      measures: recordData.measures || '',
      status: initialStatus as RecordStatus,
      source: (recordData.source || 'manual') as SourceType,
      sourceName: recordData.sourceName || '',
      pendingReason: initialReason,
      id: generateId(),
      duplicateIds: duplicateIds || [],
      createdAt: formatDate(new Date()),
      updatedAt: formatDate(new Date()),
      history: [createHistoryEntry('创建记录', operator, '从' + (recordData.sourceName || '手动') + '导入')]
    }

    if (duplicateIds.length > 0) {
      newRecord.history.push(
        createHistoryEntry(
          '重复检测',
          '系统',
          '发现' + duplicateIds.length + '条重复记录',
          recordData.status as RecordStatus,
          'duplicate'
        )
      )
    }

    state.records.push(newRecord)

    duplicateIds.forEach((id) => {
      const existing = state.records.find((r) => r && r.id === id)
      if (existing) {
        if (!existing.duplicateIds) existing.duplicateIds = []
        if (!existing.duplicateIds.includes(newRecord.id)) {
          existing.duplicateIds.push(newRecord.id)
          existing.status = 'duplicate'
          existing.history.push(
            createHistoryEntry(
              '关联重复',
              '系统',
              '新记录' + newRecord.id + '关联为重复',
              existing.status,
              'duplicate'
            )
          )
        }
      }
    })

    return newRecord
  }

  function importRecords(
    records: Array<Omit<ScoreRecord, 'id' | 'createdAt' | 'updatedAt' | 'history' | 'duplicateIds'>>,
    operator: string,
    sourceName: string
  ): ImportResult {
    let newRecords = 0
    let duplicates = 0
    let errors = 0

    records.forEach((recordData) => {
      try {
        if (!recordData.studentName || !recordData.songTitle) {
          errors++
          return
        }
        const record = addRecord(
          {
            ...recordData,
            sourceName
          },
          operator
        )

        if (record.status === 'duplicate') {
          duplicates++
        } else {
          newRecords++
        }
      } catch (e) {
        errors++
      }
    })

    return {
      total: records.length,
      newRecords,
      duplicates,
      errors
    }
  }

  function updateRecordStatus(id: string, status: RecordStatus, operator: string, reason: string): void {
    const record = state.records.find((r) => r && r.id === id)
    if (!record) return

    const oldStatus = record.status
    record.status = status
    record.updatedAt = formatDate(new Date())
    if (status === 'pending') {
      record.pendingReason = reason
    }
    if (!record.history) record.history = []
    record.history.push(createHistoryEntry('状态变更', operator, reason, oldStatus, status))
  }

  function undoRecord(id: string, operator: string, reason: string): void {
    const record = state.records.find((r) => r && r.id === id)
    if (!record || !record.history || record.history.length < 2) return

    const lastEntry = record.history[record.history.length - 2]
    if (lastEntry.oldStatus) {
      record.status = lastEntry.oldStatus
      record.updatedAt = formatDate(new Date())
      record.history.push(
        createHistoryEntry('撤回操作', operator, reason, record.status, lastEntry.oldStatus)
      )
    }
  }

  function deleteRecord(id: string, operator: string): void {
    const index = state.records.findIndex((r) => r && r.id === id)
    if (index === -1) return

    state.records.splice(index, 1)

    state.records.forEach((r) => {
      if (!r || !r.duplicateIds) return
      const dupIndex = r.duplicateIds.indexOf(id)
      if (dupIndex > -1) {
        r.duplicateIds.splice(dupIndex, 1)
        if (r.duplicateIds.length === 0 && r.status === 'duplicate') {
          r.status = 'pending'
          if (!r.history) r.history = []
          r.history.push(
            createHistoryEntry('重复解除', '系统', '关联记录已删除', 'duplicate', 'pending')
          )
        }
      }
    })
  }

  function batchUpdateStatus(ids: string[], status: RecordStatus, operator: string, reason: string): void {
    ids.forEach((id) => updateRecordStatus(id, status, operator, reason))
  }

  function exportRecords(ids: string[]): ScoreRecord[] {
    return state.records.filter((r) => r && ids.includes(r.id))
  }

  function getRecordById(id: string): ScoreRecord | undefined {
    return state.records.find((r) => r && r.id === id)
  }

  function setFilter(filter: Partial<FilterOptions>): void {
    Object.assign(state.filter, filter)
  }

  function toggleSelect(id: string): void {
    const index = state.selectedIds.indexOf(id)
    if (index > -1) {
      state.selectedIds.splice(index, 1)
    } else {
      state.selectedIds.push(id)
    }
  }

  function selectAll(): void {
    state.selectedIds = filteredRecords.value.map((r) => r.id)
  }

  function clearSelection(): void {
    state.selectedIds = []
  }

  function loadSampleData(): void {
    const sampleData: Array<Omit<ScoreRecord, 'id' | 'createdAt' | 'updatedAt' | 'history' | 'duplicateIds'>> = [
      {
        studentName: '张三',
        instrument: '二胡',
        part: '一声部',
        songTitle: '二泉映月',
        status: 'confirmed',
        source: 'selection_list',
        sourceName: '选曲表-2024',
        pendingReason: '',
        measures: '1-64'
      },
      {
        studentName: '李四',
        instrument: '古筝',
        part: '二声部',
        songTitle: '高山流水',
        status: 'pending',
        source: 'section_leader_note',
        sourceName: '声部长备注-王老师',
        pendingReason: '小节错位:第12-15小节需确认',
        measures: '1-32'
      },
      {
        studentName: '张三',
        instrument: '二胡',
        part: '一声部',
        songTitle: '二泉映月',
        status: 'pending',
        source: 'accompaniment_teacher',
        sourceName: '伴奏老师-李老师',
        pendingReason: '重复导入待确认',
        measures: '1-64'
      },
      {
        studentName: '王五',
        instrument: '琵琶',
        part: '独奏',
        songTitle: '十面埋伏',
        status: 'confirmed',
        source: 'selection_list',
        sourceName: '选曲表-2024',
        pendingReason: '',
        measures: '1-128'
      },
      {
        studentName: '赵六',
        instrument: '笛子',
        part: '一声部',
        songTitle: '姑苏行',
        status: 'pending',
        source: 'section_leader_note',
        sourceName: '声部长备注-张老师',
        pendingReason: '转调部分需确认',
        measures: '1-48'
      }
    ]

    sampleData.forEach((data) => addRecord(data, '系统初始化'))
  }

  return {
    state,
    filteredRecords,
    stats,
    addRecord,
    importRecords,
    updateRecordStatus,
    undoRecord,
    deleteRecord,
    batchUpdateStatus,
    exportRecords,
    getRecordById,
    setFilter,
    toggleSelect,
    selectAll,
    clearSelection,
    loadSampleData
  }
}

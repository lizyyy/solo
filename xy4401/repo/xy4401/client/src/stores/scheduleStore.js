import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { uploadApi, schedulingApi, exportApi } from '@/api'
import dayjs from 'dayjs'

export const useScheduleStore = defineStore('schedule', () => {
  const dataStatus = ref({
    tide: { loaded: false, count: 0 },
    berth: { loaded: false, count: 0 },
    barge: { loaded: false, count: 0 }
  })

  const currentSchedule = ref(null)
  const schedules = ref([])
  const selectedBarge = ref(null)
  const selectedEvent = ref(null)

  const canCalculate = computed(() => {
    return dataStatus.value.tide.loaded && 
           dataStatus.value.berth.loaded && 
           dataStatus.value.barge.loaded
  })

  const hasConflict = computed(() => {
    return currentSchedule.value?.conflicts?.length > 0
  })

  const hasWarning = computed(() => {
    return currentSchedule.value?.warnings?.length > 0
  })

  const timeRange = computed(() => {
    if (!currentSchedule.value?.barges?.length) {
      return { start: null, end: null }
    }

    let earliest = null
    let latest = null

    for (const barge of currentSchedule.value.barges) {
      if (barge.assignedTime) {
        const start = dayjs(barge.assignedTime.startTime)
        const end = dayjs(barge.assignedTime.endTime)
        
        if (!earliest || start.isBefore(earliest)) {
          earliest = start
        }
        if (!latest || end.isAfter(latest)) {
          latest = end
        }
      }
    }

    return { start: earliest, end: latest }
  })

  async function loadDataStatus() {
    try {
      const response = await uploadApi.getStatus()
      if (response.data.success) {
        dataStatus.value = response.data.data
      }
    } catch (error) {
      console.error('加载数据状态失败:', error)
    }
  }

  async function uploadTideFile(file) {
    const response = await uploadApi.uploadTideCsv(file)
    if (response.data.success) {
      dataStatus.value.tide = { loaded: true, count: response.data.data.records.length }
    }
    return response.data
  }

  async function uploadBerthData(data) {
    const response = await uploadApi.uploadBerthJson(data)
    if (response.data.success) {
      dataStatus.value.berth = { loaded: true, count: response.data.data.berths.length }
    }
    return response.data
  }

  async function uploadBargeData(data) {
    const response = await uploadApi.uploadBargeJson(data)
    if (response.data.success) {
      dataStatus.value.barge = { loaded: true, count: response.data.data.barges.length }
    }
    return response.data
  }

  async function calculateSchedule() {
    const response = await schedulingApi.calculate()
    if (response.data.success) {
      currentSchedule.value = response.data.data
      saveToLocalStorage()
    }
    return response.data
  }

  async function validateSchedule() {
    if (!currentSchedule.value) {
      return { success: false, error: '没有排程数据' }
    }
    const response = await schedulingApi.validate(currentSchedule.value)
    return response.data
  }

  async function saveSchedule(name = '未命名排程') {
    if (!currentSchedule.value) {
      return { success: false, error: '没有排程数据' }
    }
    currentSchedule.value.name = name
    const response = await schedulingApi.save(currentSchedule.value)
    if (response.data.success) {
      currentSchedule.value.id = response.data.data.id
      saveToLocalStorage()
    }
    return response.data
  }

  async function loadSchedules() {
    const response = await schedulingApi.list()
    if (response.data.success) {
      schedules.value = response.data.data
    }
    return response.data
  }

  async function loadSchedule(id) {
    const response = await schedulingApi.get(id)
    if (response.data.success) {
      currentSchedule.value = response.data.data
      saveToLocalStorage()
    }
    return response.data
  }

  async function deleteSchedule(id) {
    const response = await schedulingApi.delete(id)
    if (response.data.success) {
      schedules.value = schedules.value.filter(s => s.id !== id)
    }
    return response.data
  }

  function updateBargeAssignment(bargeId, newTime, newBerth) {
    if (!currentSchedule.value) return

    const barge = currentSchedule.value.barges.find(b => b.id === bargeId || b.name === bargeId)
    if (barge) {
      if (newTime) {
        barge.assignedTime = newTime
      }
      if (newBerth) {
        barge.assignedBerth = newBerth
      }
      
      if (!currentSchedule.value.adjustments) {
        currentSchedule.value.adjustments = []
      }
      currentSchedule.value.adjustments.push({
        bargeId: bargeId,
        action: 'update_assignment',
        newTime: newTime,
        newBerth: newBerth,
        timestamp: new Date().toISOString()
      })

      recalculateConflicts()
      saveToLocalStorage()
    }
  }

  function recalculateConflicts() {
    if (!currentSchedule.value) return

    const conflicts = []
    const berthGroups = {}

    for (const barge of currentSchedule.value.barges) {
      if (!barge.assignedTime || !barge.assignedBerth) continue

      const berthId = barge.assignedBerth.id
      if (!berthGroups[berthId]) {
        berthGroups[berthId] = []
      }
      berthGroups[berthId].push({
        barge: barge,
        startTime: dayjs(barge.assignedTime.startTime),
        endTime: dayjs(barge.assignedTime.endTime)
      })
    }

    for (const [berthId, assignments] of Object.entries(berthGroups)) {
      for (let i = 0; i < assignments.length; i++) {
        for (let j = i + 1; j < assignments.length; j++) {
          const a = assignments[i]
          const b = assignments[j]
          
          if (a.startTime.isBefore(b.endTime) && b.startTime.isBefore(a.endTime)) {
            conflicts.push({
              type: 'berth_conflict',
              severity: 'critical',
              berthId: berthId,
              berthName: a.barge.assignedBerth.name,
              barges: [a.barge.name, b.barge.name],
              message: `${a.barge.name} 与 ${b.barge.name} 在泊位 ${a.barge.assignedBerth.name} 时间冲突`
            })
          }
        }
      }
    }

    currentSchedule.value.conflicts = conflicts
  }

  function saveToLocalStorage() {
    try {
      if (currentSchedule.value) {
        localStorage.setItem('currentSchedule', JSON.stringify(currentSchedule.value))
      }
      localStorage.setItem('dataStatus', JSON.stringify(dataStatus.value))
    } catch (error) {
      console.error('保存到本地存储失败:', error)
    }
  }

  function loadFromLocalStorage() {
    try {
      const savedSchedule = localStorage.getItem('currentSchedule')
      const savedStatus = localStorage.getItem('dataStatus')
      
      if (savedSchedule) {
        currentSchedule.value = JSON.parse(savedSchedule)
      }
      if (savedStatus) {
        dataStatus.value = JSON.parse(savedStatus)
      }
    } catch (error) {
      console.error('从本地存储加载失败:', error)
    }
  }

  function clearCurrentSchedule() {
    currentSchedule.value = null
    localStorage.removeItem('currentSchedule')
  }

  function selectBarge(barge) {
    selectedBarge.value = barge
  }

  function selectEvent(event) {
    selectedEvent.value = event
  }

  async function exportMarkdown() {
    if (!currentSchedule.value) {
      return { success: false, error: '没有排程数据' }
    }
    
    if (currentSchedule.value.id) {
      const response = await exportApi.getMarkdown(currentSchedule.value.id)
      return downloadBlob(response.data, 'text/markdown', `schedule_${currentSchedule.value.id}_report.md`)
    } else {
      const response = await exportApi.generateMarkdown(currentSchedule.value)
      if (response.data.success) {
        return downloadText(response.data.data.markdown, `schedule_report_${dayjs().format('YYYYMMDD_HHmmss')}.md`)
      }
      return response.data
    }
  }

  async function exportJson() {
    if (!currentSchedule.value) {
      return { success: false, error: '没有排程数据' }
    }
    
    if (currentSchedule.value.id) {
      const response = await exportApi.getJson(currentSchedule.value.id)
      return downloadBlob(response.data, 'application/json', `schedule_${currentSchedule.value.id}_audit.json`)
    } else {
      const response = await exportApi.generateJson(currentSchedule.value)
      if (response.data.success) {
        return downloadJson(response.data.data, `schedule_audit_${dayjs().format('YYYYMMDD_HHmmss')}.json`)
      }
      return response.data
    }
  }

  function downloadBlob(blob, mimeType, filename) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    return { success: true }
  }

  function downloadText(content, filename) {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    return downloadBlob(blob, 'text/markdown', filename)
  }

  function downloadJson(data, filename) {
    const content = JSON.stringify(data, null, 2)
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
    return downloadBlob(blob, 'application/json', filename)
  }

  return {
    dataStatus,
    currentSchedule,
    schedules,
    selectedBarge,
    selectedEvent,
    canCalculate,
    hasConflict,
    hasWarning,
    timeRange,
    loadDataStatus,
    uploadTideFile,
    uploadBerthData,
    uploadBargeData,
    calculateSchedule,
    validateSchedule,
    saveSchedule,
    loadSchedules,
    loadSchedule,
    deleteSchedule,
    updateBargeAssignment,
    recalculateConflicts,
    saveToLocalStorage,
    loadFromLocalStorage,
    clearCurrentSchedule,
    selectBarge,
    selectEvent,
    exportMarkdown,
    exportJson
  }
})

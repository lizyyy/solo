import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { 
  detectDuplicates, 
  detectMixedCoordinates, 
  validateExportConsistency,
  recalculateAfterSupplement
} from '../utils/selfCheckUtils'
import { createAuditLog, trackModification } from '../utils/auditUtils'

export const useSimulationStore = defineStore('simulation', () => {
  const obstacleRecords = ref([])
  const floorSectionRecords = ref([])
  const siteInstructions = ref([])
  const auditLogs = ref([])
  const currentStep = ref(1)
  const selfCheckResults = ref({
    duplicateCheck: { passed: true, details: [] },
    coordinateCheck: { passed: true, details: [] },
    recalculateCheck: { passed: true, details: [] },
    exportConsistencyCheck: { passed: true, details: [] }
  })
  const affectedRecords = ref([])
  const unifiedResult = ref(null)

  const addObstacleRecord = (record) => {
    const newRecord = {
      ...record,
      id: Date.now() + Math.random(),
      originalLineNumber: record.originalLineNumber || obstacleRecords.value.length + 1,
      originalObstacleNote: record.obstacleNote || '',
      manualChanges: [],
      processingStatus: 'pending',
      statusHistory: [{ status: 'pending', timestamp: new Date().toISOString(), operator: 'system' }],
      isMixedCoordinate: false,
      coordinateType: detectCoordinateType(record),
      importTimestamp: new Date().toISOString()
    }
    obstacleRecords.value.push(newRecord)
    createAuditLog(auditLogs.value, 'import', 'obstacle', newRecord.id, '导入障碍物记录')
    runSelfCheck()
    updateUnifiedResult()
  }

  const batchImportObstacles = (records) => {
    records.forEach((record, index) => {
      addObstacleRecord({
        ...record,
        originalLineNumber: record.originalLineNumber || index + 1
      })
    })
  }

  const addFloorSectionRecord = (record) => {
    const newRecord = {
      ...record,
      id: Date.now() + Math.random(),
      originalSectionNote: record.sectionNote || '',
      manualChanges: [],
      statusHistory: [{ status: 'imported', timestamp: new Date().toISOString(), operator: 'system' }]
    }
    floorSectionRecords.value.push(newRecord)
    createAuditLog(auditLogs.value, 'import', 'floorSection', newRecord.id, '导入楼层剖面记录')
    updateUnifiedResult()
  }

  const updateObstacleNote = (recordId, newNote, operator = '小魏') => {
    const record = obstacleRecords.value.find(r => r.id === recordId)
    if (record) {
      const oldNote = record.obstacleNote
      record.obstacleNote = newNote
      record.manualChanges.push({
        field: 'obstacleNote',
        oldValue: oldNote,
        newValue: newNote,
        timestamp: new Date().toISOString(),
        operator
      })
      record.processingStatus = 'manual_updated'
      record.statusHistory.push({
        status: 'manual_updated',
        timestamp: new Date().toISOString(),
        operator
      })
      createAuditLog(auditLogs.value, 'update', 'obstacle', recordId, `障碍物备注从"${oldNote}"改为"${newNote}"`, operator)
      trackModification(record, 'obstacleNote', oldNote, newNote, operator)
      runSelfCheck()
      updateUnifiedResult()
    }
  }

  const updateFloorSectionNote = (recordId, newNote, operator = '小魏') => {
    const record = floorSectionRecords.value.find(r => r.id === recordId)
    if (record) {
      const oldNote = record.sectionNote
      record.sectionNote = newNote
      record.manualChanges.push({
        field: 'sectionNote',
        oldValue: oldNote,
        newValue: newNote,
        timestamp: new Date().toISOString(),
        operator
      })
      record.statusHistory.push({
        status: 'manual_updated',
        timestamp: new Date().toISOString(),
        operator
      })
      createAuditLog(auditLogs.value, 'update', 'floorSection', recordId, `楼层剖面备注从"${oldNote}"改为"${newNote}"`, operator)
      markAffectedRecords(recordId)
      updateUnifiedResult()
    }
  }

  const markAffectedRecords = (floorSectionId) => {
    affectedRecords.value = obstacleRecords.value
      .filter(r => r.floorSectionId === floorSectionId)
      .map(r => ({
        recordId: r.id,
        wallPanelCode: r.wallPanelCode,
        obstacleNote: r.obstacleNote,
        affectedReason: '关联楼层剖面备注已更新',
        affectedAt: new Date().toISOString()
      }))
  }

  const updateSiteInstruction = (instruction) => {
    const newInstruction = {
      ...instruction,
      id: Date.now() + Math.random(),
      affectedRecords: [...affectedRecords.value],
      createdAt: new Date().toISOString()
    }
    siteInstructions.value.push(newInstruction)
    createAuditLog(auditLogs.value, 'create', 'instruction', newInstruction.id, '生成现场班组说明')
    updateUnifiedResult()
  }

  const runSelfCheck = () => {
    selfCheckResults.value.duplicateCheck = detectDuplicates(obstacleRecords.value)
    selfCheckResults.value.coordinateCheck = detectMixedCoordinates(obstacleRecords.value)
    selfCheckResults.value.recalculateCheck = recalculateAfterSupplement(obstacleRecords.value)
    updateUnifiedResult()
  }

  const runExportConsistencyCheck = () => {
    selfCheckResults.value.exportConsistencyCheck = validateExportConsistency(
      obstacleRecords.value,
      unifiedResult.value
    )
    return selfCheckResults.value.exportConsistencyCheck
  }

  const updateUnifiedResult = () => {
    unifiedResult.value = {
      obstacleRecords: obstacleRecords.value.map(r => ({ ...r })),
      floorSectionRecords: floorSectionRecords.value.map(r => ({ ...r })),
      siteInstructions: siteInstructions.value.map(i => ({ ...i })),
      affectedRecords: affectedRecords.value.map(a => ({ ...a })),
      selfCheckResults: { ...selfCheckResults.value },
      generatedAt: new Date().toISOString()
    }
  }

  const getUnifiedResult = () => {
    if (!unifiedResult.value) {
      updateUnifiedResult()
    }
    return unifiedResult.value
  }

  const setCurrentStep = (step) => {
    currentStep.value = step
  }

  const nextStep = () => {
    if (currentStep.value < 3) {
      currentStep.value++
    }
  }

  const prevStep = () => {
    if (currentStep.value > 1) {
      currentStep.value--
    }
  }

  const getRecordAuditTrail = (recordId) => {
    const record = obstacleRecords.value.find(r => r.id === recordId)
    if (!record) return null
    return {
      originalLineNumber: record.originalLineNumber,
      originalObstacleNote: record.originalObstacleNote,
      manualChanges: record.manualChanges,
      statusHistory: record.statusHistory,
      processingStatus: record.processingStatus
    }
  }

  const clearAll = () => {
    obstacleRecords.value = []
    floorSectionRecords.value = []
    siteInstructions.value = []
    auditLogs.value = []
    affectedRecords.value = []
    unifiedResult.value = null
    currentStep.value = 1
    selfCheckResults.value = {
      duplicateCheck: { passed: true, details: [] },
      coordinateCheck: { passed: true, details: [] },
      recalculateCheck: { passed: true, details: [] },
      exportConsistencyCheck: { passed: true, details: [] }
    }
  }

  return {
    obstacleRecords,
    floorSectionRecords,
    siteInstructions,
    auditLogs,
    currentStep,
    selfCheckResults,
    affectedRecords,
    unifiedResult,
    addObstacleRecord,
    batchImportObstacles,
    addFloorSectionRecord,
    updateObstacleNote,
    updateFloorSectionNote,
    updateSiteInstruction,
    runSelfCheck,
    runExportConsistencyCheck,
    updateUnifiedResult,
    getUnifiedResult,
    setCurrentStep,
    nextStep,
    prevStep,
    getRecordAuditTrail,
    clearAll
  }
})

function detectCoordinateType(record) {
  if (!record.coordinate) return 'unknown'
  const coordStr = String(record.coordinate)
  if (coordStr.includes(',') || coordStr.includes('°') || /^\d{1,3}\.\d+,\s*\d{1,3}\.\d+$/.test(coordStr)) {
    return 'latlng'
  }
  if (/^\d+(\.\d+)?$/.test(coordStr) || /^[XYZxyz]:/.test(coordStr)) {
    return 'metric'
  }
  return 'unknown'
}

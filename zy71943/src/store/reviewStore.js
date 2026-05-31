import { create } from 'zustand'
import {
  createPayloadPlan,
  createFaultRecord,
  createOrbitalElements,
  createReviewNote,
  createManualConfirm,
  createTimelineEvent,
  createAnomaly,
  createTaskBriefing,
  ANOMALY_TYPES,
  CHANGE_TYPES,
  DATA_SOURCE_TYPES
} from '../models/types'

const useReviewStore = create((set, get) => ({
  missionId: 'MISSION-2026-001',
  
  payloadPlans: [],
  faultRecords: [],
  orbitalElements: [],
  reviewNotes: [],
  manualConfirms: [],
  anomalies: [],
  timeline: [],
  taskBriefings: [],
  
  activeTab: 'timeline',
  selectedItemId: null,
  viewMode: 'review',
  
  addPayloadPlan: (data) => {
    const plan = createPayloadPlan(`plan_${Date.now()}`, data)
    const event = createTimelineEvent({
      timestamp: plan.receivedTime || new Date().toISOString(),
      eventType: 'data_received',
      itemId: plan.id,
      itemType: DATA_SOURCE_TYPES.PAYLOAD_PLAN,
      description: `载荷计划 "${plan.planName}" 已导入`,
      isKeyEvent: true,
      metadata: { isEarly: plan.isEarly }
    })
    
    set(state => ({
      payloadPlans: [...state.payloadPlans, plan],
      timeline: [...state.timeline, event].sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
      )
    }))
    
    get().detectAnomalies()
    return plan
  },
  
  addFaultRecord: (data) => {
    const record = createFaultRecord(`fault_${Date.now()}`, data)
    const event = createTimelineEvent({
      timestamp: record.recordedTime || new Date().toISOString(),
      eventType: 'data_received',
      itemId: record.id,
      itemType: DATA_SOURCE_TYPES.FAULT_RECORD,
      description: `故障纪要 "${record.faultName}" 已导入`,
      isKeyEvent: true,
      metadata: { isLateSupplement: record.isLateSupplement }
    })
    
    set(state => ({
      faultRecords: [...state.faultRecords, record],
      timeline: [...state.timeline, event].sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
      )
    }))
    
    get().detectAnomalies()
    return record
  },
  
  addOrbitalElements: (data) => {
    const elements = createOrbitalElements(`orbit_${Date.now()}`, data)
    const event = createTimelineEvent({
      timestamp: elements.createdAt,
      eventType: 'data_received',
      itemId: elements.id,
      itemType: DATA_SOURCE_TYPES.ORBITAL_ELEMENTS,
      description: `轨道根数 "${elements.elementSetName}" 已导入`,
      isKeyEvent: elements.isManualModified,
      metadata: { isManualModified: elements.isManualModified }
    })
    
    set(state => ({
      orbitalElements: [...state.orbitalElements, elements],
      timeline: [...state.timeline, event].sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
      )
    }))
    
    get().detectAnomalies()
    return elements
  },
  
  addReviewNote: (data) => {
    const note = createReviewNote(`note_${Date.now()}`, data)
    const event = createTimelineEvent({
      timestamp: note.createdAt,
      eventType: 'note_added',
      itemId: note.id,
      itemType: DATA_SOURCE_TYPES.REVIEW_NOTE,
      description: `复核备注已添加`,
      isKeyEvent: false,
      metadata: { isIncomplete: note.isIncomplete }
    })
    
    set(state => ({
      reviewNotes: [...state.reviewNotes, note],
      timeline: [...state.timeline, event].sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
      )
    }))
    
    return note
  },
  
  addManualConfirm: (data) => {
    const confirm = createManualConfirm(`confirm_${Date.now()}`, data)
    const event = createTimelineEvent({
      timestamp: confirm.confirmedAt,
      eventType: 'confirmation',
      itemId: confirm.id,
      itemType: DATA_SOURCE_TYPES.MANUAL_CONFIRM,
      description: `复核确认: ${confirm.changeType === CHANGE_TYPES.MATERIAL_ONLY ? '仅补材料' : '结论变更'}`,
      isKeyEvent: true,
      changeType: confirm.changeType,
      metadata: { reviewer: confirm.reviewer }
    })
    
    set(state => ({
      manualConfirms: [...state.manualConfirms, confirm],
      timeline: [...state.timeline, event].sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
      )
    }))
    
    get().resolveRelatedAnomalies(confirm)
    return confirm
  },
  
  detectAnomalies: () => {
    const state = get()
    const newAnomalies = []
    
    state.payloadPlans.forEach(plan => {
      if (plan.isEarly) {
        newAnomalies.push(createAnomaly({
          type: ANOMALY_TYPES.TIMING_ISSUE,
          severity: 'info',
          relatedItemIds: [plan.id],
          title: '载荷计划提前到达',
          description: `计划 "${plan.planName}" 早于预期时间到达`,
          explanation: '该载荷计划提前接收，需确认是否影响后续复核流程。提前到达本身不影响结论，但需确保所有关联数据完整。'
        }))
      }
    })
    
    state.faultRecords.forEach(record => {
      if (record.isLateSupplement) {
        newAnomalies.push(createAnomaly({
          type: ANOMALY_TYPES.TIMING_ISSUE,
          severity: 'warning',
          relatedItemIds: [record.id],
          title: '故障纪要晚补',
          description: `故障 "${record.faultName}" 的纪要为事后补录`,
          explanation: '该故障记录属于事后补充材料。补录内容仅用于完整记录，不改变原始复核结论，除非有明确的人工确认标记结论变更。'
        }))
      }
    })
    
    state.orbitalElements.forEach(elements => {
      if (elements.isManualModified) {
        newAnomalies.push(createAnomaly({
          type: ANOMALY_TYPES.MANUAL_CHANGE,
          severity: 'high',
          relatedItemIds: [elements.id],
          title: '轨道根数控改动',
          description: `轨道根数 "${elements.elementSetName}" 包含手工修改`,
          explanation: '检测到轨道根数存在手工修改痕迹！此修改可能影响复核结论，必须通过人工确认流程明确说明修改原因和对结论的影响。'
        }))
      }
    })
    
    const elementNames = state.orbitalElements.map(e => e.elementSetName)
    const duplicates = elementNames.filter((name, index) => 
      elementNames.indexOf(name) !== index
    )
    duplicates.forEach(name => {
      const duplicateElements = state.orbitalElements.filter(e => e.elementSetName === name)
      newAnomalies.push(createAnomaly({
        type: ANOMALY_TYPES.DUPLICATE_DATA,
        severity: 'warning',
        relatedItemIds: duplicateElements.map(e => e.id),
        title: '重复轨道根数',
        description: `检测到 "${name}" 存在多组重复数据`,
        explanation: `发现 ${duplicateElements.length} 组同名轨道根数。请确认哪一组为有效数据，多余数据应标记为废弃或仅作参考。`
      }))
    })
    
    if (state.payloadPlans.length > 0 && state.faultRecords.length === 0) {
      newAnomalies.push(createAnomaly({
        type: ANOMALY_TYPES.MISSING_DATA,
        severity: 'info',
        relatedItemIds: [],
        title: '缺少故障纪要',
        description: '当前任务未关联任何故障记录',
        explanation: '载荷计划已导入，但未发现关联的故障纪要。如果本次任务确实无故障，请添加人工确认说明此情况。'
      }))
    }
    
    state.orbitalElements.forEach(elements => {
      if (elements.eccentricity > 0.9) {
        newAnomalies.push(createAnomaly({
          type: ANOMALY_TYPES.BOUNDARY_VIOLATION,
          severity: 'high',
          relatedItemIds: [elements.id],
          title: '轨道参数边界异常',
          description: `偏心率 ${elements.eccentricity.toFixed(4)} 超出正常范围`,
          explanation: '偏心率接近1.0，可能表示轨道异常或数据录入错误。请复核该轨道根数的来源和计算过程。'
        }))
      }
      if (elements.inclination < 0 || elements.inclination > 180) {
        newAnomalies.push(createAnomaly({
          type: ANOMALY_TYPES.BOUNDARY_VIOLATION,
          severity: 'high',
          relatedItemIds: [elements.id],
          title: '轨道倾角边界异常',
          description: `倾角 ${elements.inclination}° 超出正常范围 (0-180°)`,
          explanation: '轨道倾角超出物理可能范围，该数据无效或存在录入错误，必须修正。'
        }))
      }
    })
    
    set({ anomalies: newAnomalies })
  },
  
  resolveRelatedAnomalies: (confirm) => {
    set(state => ({
      anomalies: state.anomalies.map(anomaly => {
        const isRelated = confirm.relatedItemIds.some(id => 
          anomaly.relatedItemIds.includes(id)
        )
        if (isRelated) {
          return {
            ...anomaly,
            isResolved: true,
            resolution: confirm.conclusion,
            resolvedBy: confirm.reviewer,
            resolvedAt: confirm.confirmedAt
          }
        }
        return anomaly
      })
    }))
  },
  
  resolveAnomaly: (anomalyId, resolution, reviewer) => {
    set(state => ({
      anomalies: state.anomalies.map(a => 
        a.id === anomalyId ? {
          ...a,
          isResolved: true,
          resolution,
          resolvedBy: reviewer,
          resolvedAt: new Date().toISOString()
        } : a
      )
    }))
  },
  
  generateTaskBriefing: () => {
    const state = get()
    const briefing = createTaskBriefing(`briefing_${Date.now()}`, {
      missionId: state.missionId,
      title: `轨控指令复核简报 - ${state.missionId}`,
      payloadPlans: state.payloadPlans,
      faultRecords: state.faultRecords,
      orbitalElements: state.orbitalElements,
      reviewNotes: state.reviewNotes,
      manualConfirms: state.manualConfirms,
      anomalies: state.anomalies,
      conclusions: state.manualConfirms.map(c => ({
        changeType: c.changeType,
        conclusion: c.conclusion,
        reviewer: c.reviewer,
        confirmedAt: c.confirmedAt
      }))
    })
    
    const checksum = btoa(JSON.stringify({
      plans: state.payloadPlans.length,
      faults: state.faultRecords.length,
      orbits: state.orbitalElements.length,
      confirms: state.manualConfirms.length,
      anomalies: state.anomalies.filter(a => !a.isResolved).length
    }))
    briefing.checksum = checksum
    
    const event = createTimelineEvent({
      timestamp: briefing.generatedAt,
      eventType: 'briefing_generated',
      itemId: briefing.id,
      itemType: DATA_SOURCE_TYPES.TASK_BRIEFING,
      description: `任务简报已生成`,
      isKeyEvent: true,
      metadata: { checksum, version: briefing.version }
    })
    
    set(state => ({
      taskBriefings: [...state.taskBriefings, briefing],
      timeline: [...state.timeline, event].sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
      )
    }))
    
    return briefing
  },
  
  exportBriefing: (briefingId) => {
    const state = get()
    const briefing = state.taskBriefings.find(b => b.id === briefingId)
    if (!briefing) return null
    
    const exportData = {
      ...briefing,
      exportedAt: new Date().toISOString(),
      exportFormat: 'v1.0'
    }
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `briefing_${state.missionId}_${briefing.version}.json`
    a.click()
    URL.revokeObjectURL(url)
    
    return exportData
  },
  
  getStateAtTime: (timestamp) => {
    const state = get()
    const cutoffTime = new Date(timestamp)
    
    return {
      payloadPlans: state.payloadPlans.filter(p => new Date(p.createdAt) <= cutoffTime),
      faultRecords: state.faultRecords.filter(f => new Date(f.createdAt) <= cutoffTime),
      orbitalElements: state.orbitalElements.filter(o => new Date(o.createdAt) <= cutoffTime),
      reviewNotes: state.reviewNotes.filter(n => new Date(n.createdAt) <= cutoffTime),
      manualConfirms: state.manualConfirms.filter(c => new Date(c.confirmedAt) <= cutoffTime),
      anomalies: state.anomalies.filter(a => {
        if (!a.isResolved) return new Date(a.createdAt) <= cutoffTime
        return new Date(a.resolvedAt) <= cutoffTime
      })
    }
  },
  
  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedItemId: (id) => set({ selectedItemId: id }),
  setViewMode: (mode) => set({ viewMode: mode }),
  
  loadSampleData: () => {
    const { addPayloadPlan, addFaultRecord, addOrbitalElements, addReviewNote, addManualConfirm } = get()
    
    addPayloadPlan({
      missionId: 'MISSION-2026-001',
      planName: '轨道机动计划-A',
      plannedTime: '2026-06-01T10:00:00Z',
      receivedTime: '2026-05-28T08:00:00Z',
      parameters: { deltaV: 120, duration: 300 },
      isEarly: true,
      createdBy: 'ground_station_1'
    })
    
    addPayloadPlan({
      missionId: 'MISSION-2026-001',
      planName: '载荷开机计划',
      plannedTime: '2026-06-01T14:00:00Z',
      receivedTime: '2026-05-30T10:00:00Z',
      parameters: { mode: 'normal', target: 'experiment_a' },
      isEarly: false,
      createdBy: 'ground_station_1'
    })
    
    addFaultRecord({
      missionId: 'MISSION-2026-001',
      faultName: '推力器温度异常',
      faultCode: 'THR-001',
      description: '1号推力器预热阶段温度偏高2度',
      occurredTime: '2026-05-29T15:30:00Z',
      recordedTime: '2026-05-31T09:00:00Z',
      isLateSupplement: true,
      impact: 'minor',
      createdBy: 'engineer_zhang'
    })
    
    addOrbitalElements({
      missionId: 'MISSION-2026-001',
      elementSetName: '初始轨道',
      semiMajorAxis: 6878,
      eccentricity: 0.0012,
      inclination: 51.6,
      rightAscension: 120.5,
      argumentOfPerigee: 90.0,
      trueAnomaly: 45.0,
      epoch: '2026-05-28T00:00:00Z',
      isManualModified: false,
      createdBy: 'orbit_calc'
    })
    
    addOrbitalElements({
      missionId: 'MISSION-2026-001',
      elementSetName: '机动后轨道',
      semiMajorAxis: 7000,
      eccentricity: 0.0015,
      inclination: 51.6,
      rightAscension: 120.5,
      argumentOfPerigee: 92.3,
      trueAnomaly: 180.0,
      epoch: '2026-06-01T10:05:00Z',
      isManualModified: true,
      modificationReason: '根据实测数据修正偏心率',
      createdBy: 'orbit_engineer'
    })
    
    addOrbitalElements({
      missionId: 'MISSION-2026-001',
      elementSetName: '机动后轨道',
      semiMajorAxis: 7002,
      eccentricity: 0.0014,
      inclination: 51.6,
      rightAscension: 120.5,
      argumentOfPerigee: 92.0,
      trueAnomaly: 179.5,
      epoch: '2026-06-01T10:10:00Z',
      isManualModified: false,
      createdBy: 'orbit_calc_2'
    })
    
    addOrbitalElements({
      missionId: 'MISSION-2026-001',
      elementSetName: '边界测试轨道',
      semiMajorAxis: 10000,
      eccentricity: 0.95,
      inclination: 90,
      rightAscension: 0,
      argumentOfPerigee: 0,
      trueAnomaly: 0,
      epoch: '2026-05-20T00:00:00Z',
      isManualModified: false,
      createdBy: 'test_system'
    })
    
    addReviewNote({
      missionId: 'MISSION-2026-001',
      relatedItemId: 'orbit_002',
      relatedItemType: 'orbital_elements',
      content: '手动修改的轨道根数需要进一步确认来源...',
      author: 'reviewer_li',
      isIncomplete: true
    })
    
    addManualConfirm({
      missionId: 'MISSION-2026-001',
      relatedItemIds: ['fault_001'],
      changeType: CHANGE_TYPES.MATERIAL_ONLY,
      conclusion: '确认该故障仅为补录材料，不改变原有复核结论。温度异常在允许范围内，不影响本次轨控执行。',
      reason: '补录故障发生在计划制定之前，已在计划中考虑了温度裕度。',
      reviewer: 'chief_engineer_wang'
    })
    
    setTimeout(() => get().detectAnomalies(), 100)
  }
}))

export default useReviewStore

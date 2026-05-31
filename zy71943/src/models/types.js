export const DATA_SOURCE_TYPES = {
  PAYLOAD_PLAN: 'payload_plan',
  FAULT_RECORD: 'fault_record',
  ORBITAL_ELEMENTS: 'orbital_elements',
  REVIEW_NOTE: 'review_note',
  MANUAL_CONFIRM: 'manual_confirm',
  TASK_BRIEFING: 'task_briefing'
}

export const REVIEW_STATUS = {
  PENDING: 'pending',
  REVIEWING: 'reviewing',
  CONFIRMED: 'confirmed',
  REJECTED: 'rejected',
  NEEDS_CLARIFICATION: 'needs_clarification'
}

export const ANOMALY_TYPES = {
  MISSING_DATA: 'missing_data',
  DUPLICATE_DATA: 'duplicate_data',
  MANUAL_CHANGE: 'manual_change',
  TIMING_ISSUE: 'timing_issue',
  BOUNDARY_VIOLATION: 'boundary_violation',
  INCONSISTENT_DATA: 'inconsistent_data'
}

export const CHANGE_TYPES = {
  MATERIAL_ONLY: 'material_only',
  CONCLUSION_CHANGED: 'conclusion_changed',
  CORRECTION: 'correction',
  CLARIFICATION: 'clarification'
}

export function createPayloadPlan(id, data) {
  return {
    id,
    type: DATA_SOURCE_TYPES.PAYLOAD_PLAN,
    missionId: data.missionId,
    planName: data.planName,
    plannedTime: data.plannedTime,
    receivedTime: data.receivedTime,
    parameters: data.parameters || {},
    status: data.status || 'pending',
    version: data.version || 1,
    isEarly: data.isEarly || false,
    source: data.source || 'system',
    createdAt: new Date().toISOString(),
    history: [{
      action: 'created',
      timestamp: new Date().toISOString(),
      user: data.createdBy || 'system'
    }]
  }
}

export function createFaultRecord(id, data) {
  return {
    id,
    type: DATA_SOURCE_TYPES.FAULT_RECORD,
    missionId: data.missionId,
    faultName: data.faultName,
    faultCode: data.faultCode,
    description: data.description,
    occurredTime: data.occurredTime,
    recordedTime: data.recordedTime,
    isLateSupplement: data.isLateSupplement || false,
    impact: data.impact || 'unknown',
    status: data.status || 'open',
    source: data.source || 'system',
    createdAt: new Date().toISOString(),
    history: [{
      action: 'created',
      timestamp: new Date().toISOString(),
      user: data.createdBy || 'system'
    }]
  }
}

export function createOrbitalElements(id, data) {
  return {
    id,
    type: DATA_SOURCE_TYPES.ORBITAL_ELEMENTS,
    missionId: data.missionId,
    elementSetName: data.elementSetName,
    semiMajorAxis: data.semiMajorAxis,
    eccentricity: data.eccentricity,
    inclination: data.inclination,
    rightAscension: data.rightAscension,
    argumentOfPerigee: data.argumentOfPerigee,
    trueAnomaly: data.trueAnomaly,
    epoch: data.epoch,
    isManualModified: data.isManualModified || false,
    modificationReason: data.modificationReason || null,
    source: data.source || 'calculated',
    createdAt: new Date().toISOString(),
    history: [{
      action: 'created',
      timestamp: new Date().toISOString(),
      user: data.createdBy || 'system'
    }]
  }
}

export function createReviewNote(id, data) {
  return {
    id,
    type: DATA_SOURCE_TYPES.REVIEW_NOTE,
    missionId: data.missionId,
    relatedItemId: data.relatedItemId,
    relatedItemType: data.relatedItemType,
    content: data.content,
    author: data.author,
    isIncomplete: data.isIncomplete || false,
    createdAt: new Date().toISOString()
  }
}

export function createManualConfirm(id, data) {
  return {
    id,
    type: DATA_SOURCE_TYPES.MANUAL_CONFIRM,
    missionId: data.missionId,
    relatedItemIds: data.relatedItemIds,
    changeType: data.changeType,
    conclusion: data.conclusion,
    reason: data.reason,
    reviewer: data.reviewer,
    confirmedAt: new Date().toISOString(),
    evidence: data.evidence || []
  }
}

export function createTimelineEvent(data) {
  return {
    id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: data.timestamp,
    eventType: data.eventType,
    itemId: data.itemId,
    itemType: data.itemType,
    description: data.description,
    isKeyEvent: data.isKeyEvent || false,
    changeType: data.changeType || null,
    metadata: data.metadata || {}
  }
}

export function createAnomaly(data) {
  return {
    id: `anomaly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: data.type,
    severity: data.severity || 'warning',
    relatedItemIds: data.relatedItemIds || [],
    title: data.title,
    description: data.description,
    explanation: data.explanation || '',
    resolution: data.resolution || null,
    isResolved: false,
    createdAt: new Date().toISOString()
  }
}

export function createTaskBriefing(id, data) {
  return {
    id,
    missionId: data.missionId,
    title: data.title,
    generatedAt: new Date().toISOString(),
    generatedBy: data.generatedBy || 'system',
    payloadPlans: data.payloadPlans || [],
    faultRecords: data.faultRecords || [],
    orbitalElements: data.orbitalElements || [],
    reviewNotes: data.reviewNotes || [],
    manualConfirms: data.manualConfirms || [],
    anomalies: data.anomalies || [],
    conclusions: data.conclusions || [],
    version: 1,
    checksum: null
  }
}

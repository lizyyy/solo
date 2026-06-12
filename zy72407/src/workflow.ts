import { v4 as uuidv4 } from 'uuid'
import {
  WorkflowState,
  WorkflowStep,
  StepName,
  ConsumptionRecord,
  RecordStatus,
  ReviewFlag,
  ImportBatch
} from './types'
import {
  parseTunerMessage,
  parseGroupSignup,
  createConsumptionRecordsFromTuner,
  mergeGroupSignupToRecords
} from './import'
import { markDuplicates, recalculateAfterSupplement } from './selfCheck'
import { settleRecords } from './audit'
import { unifiedStore } from './unifiedResult'

export function createInitialWorkflow(): WorkflowState {
  const now = new Date().toISOString()
  return {
    currentStep: 'import_tuner',
    steps: [
      { name: 'import_tuner', status: 'in_progress' },
      { name: 'review_group', status: 'pending' },
      { name: 'update_settlement', status: 'pending' }
    ],
    startedAt: now,
    updatedAt: now
  }
}

export function advanceStep(
  state: WorkflowState,
  stepName: StepName,
  operator: string
): WorkflowState {
  const now = new Date().toISOString()
  const stepIndex = state.steps.findIndex(s => s.name === stepName)
  
  if (stepIndex === -1) return state

  const updatedSteps = state.steps.map((step, index) => {
    if (index === stepIndex) {
      return {
        ...step,
        status: 'completed' as const,
        completedAt: now,
        operator
      }
    }
    if (index === stepIndex + 1) {
      return {
        ...step,
        status: 'in_progress' as const
      }
    }
    return step
  })

  const isLastStep = stepIndex === state.steps.length - 1
  const nextStep = updatedSteps[stepIndex + 1]

  return {
    ...state,
    currentStep: isLastStep ? stepName : nextStep ? nextStep.name : stepName,
    steps: updatedSteps,
    updatedAt: now
  }
}

export function finishWorkflow(
  state: WorkflowState,
  operator: string
): WorkflowState {
  const now = new Date().toISOString()
  return {
    ...state,
    currentStep: state.steps[state.steps.length - 1].name,
    steps: state.steps.map(step => {
      if (step.name === 'update_settlement' && step.status !== 'completed') {
        return {
          ...step,
          status: 'completed' as const,
          completedAt: now,
          operator
        }
      }
      return step
    }),
    updatedAt: now
  }
}

export function isWorkflowDone(state: WorkflowState): boolean {
  return state.steps.every(s => s.status === 'completed')
}

export function step1ImportTunerMessages(
  tunerLines: string[],
  operator: string
): { records: ConsumptionRecord[]; batch: ImportBatch; workflow: WorkflowState; reuseReport: { reused: number; newlyAdded: number } } {
  const batchId = uuidv4()
  const { batch, records: tunerRecords } = parseTunerMessage(tunerLines, batchId, operator)
  
  const existingRecords = unifiedStore.getRecords()
  const existingKeys = new Set(
    existingRecords
      .filter(r => r.tunerMessageId)
      .map(r => `${r.studentName}|${r.courseDate}|${r.courseTime}|${r.teacherName}`)
  )
  
  let consumptionRecords = createConsumptionRecordsFromTuner(tunerRecords)
  
  const reuseReport = { reused: 0, newlyAdded: 0 }
  
  consumptionRecords = consumptionRecords.map(record => {
    const key = `${record.studentName}|${record.courseDate}|${record.courseTime}|${record.teacherName}`
    if (existingKeys.has(key)) {
      reuseReport.reused++
      return {
        ...record,
        importSource: 'reimport_reuse' as const,
        importBatchLabel: `复用(已有相同调音师留言): ${record.tunerRawContent}`,
        manualEdits: [{
          id: uuidv4(),
          timestamp: new Date().toISOString(),
          operator: 'system',
          action: 'reimport_detected',
          reason: `重复导入检测: 调音师留言"${record.tunerRawContent}"在系统中已存在，标记为复用记录`
        }]
      }
    }
    reuseReport.newlyAdded++
    return record
  })
  
  consumptionRecords = markDuplicates(consumptionRecords)
  
  if (existingRecords.length === 0) {
    unifiedStore.setRecords(consumptionRecords)
  } else {
    unifiedStore.setRecords([...existingRecords, ...consumptionRecords])
  }
  unifiedStore.addBatch(batch)

  const workflow = createInitialWorkflow()

  return {
    records: unifiedStore.getRecords(),
    batch,
    workflow,
    reuseReport
  }
}

export function step2ReviewGroupSignup(
  groupLines: string[],
  operator: string,
  currentWorkflow: WorkflowState
): { records: ConsumptionRecord[]; batch: ImportBatch; workflow: WorkflowState } {
  const batchId = uuidv4()
  const { batch, records: groupRecords } = parseGroupSignup(groupLines, batchId, operator)
  
  let existingRecords = unifiedStore.getRecords()
  let mergedRecords = mergeGroupSignupToRecords(existingRecords, groupRecords)
  
  mergedRecords = markDuplicates(mergedRecords)
  mergedRecords = recalculateAfterSupplement(mergedRecords)
  
  unifiedStore.setRecords(mergedRecords)
  unifiedStore.addBatch(batch)

  const workflow = advanceStep(currentWorkflow, 'import_tuner', operator)

  return {
    records: mergedRecords,
    batch,
    workflow
  }
}

export function step3UpdateSettlement(
  operator: string,
  currentWorkflow: WorkflowState
): { records: ConsumptionRecord[]; workflow: WorkflowState } {
  let records = unifiedStore.getRecords()
  
  records = records.map(record => {
    if (record.status === RecordStatus.MATCHED) {
      return {
        ...record,
        status: RecordStatus.CONFIRMED,
        updatedAt: new Date().toISOString()
      }
    }
    if (record.status === RecordStatus.IMPORTED && record.reviewFlag === ReviewFlag.NONE) {
      return {
        ...record,
        status: RecordStatus.CONFIRMED,
        updatedAt: new Date().toISOString()
      }
    }
    return record
  })
  
  records = settleRecords(records, operator)
  records = recalculateAfterSupplement(records)
  
  unifiedStore.setRecords(records)

  const workflow = finishWorkflow(
    advanceStep(currentWorkflow, 'review_group', operator),
    operator
  )

  return {
    records,
    workflow
  }
}

export function canAdvanceToStep(
  state: WorkflowState,
  targetStep: StepName
): boolean {
  const stepOrder: StepName[] = ['import_tuner', 'review_group', 'update_settlement']
  const currentIndex = stepOrder.indexOf(state.currentStep)
  const targetIndex = stepOrder.indexOf(targetStep)
  
  return targetIndex === currentIndex + 1
}

export function isStepCompleted(
  state: WorkflowState,
  stepName: StepName
): boolean {
  const step = state.steps.find(s => s.name === stepName)
  return step?.status === 'completed'
}

export function getPendingReviews(records: ConsumptionRecord[]): ConsumptionRecord[] {
  return records.filter(r => r.status === RecordStatus.NEEDS_REVIEW)
}

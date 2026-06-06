import { v4 as uuidv4 } from 'uuid'
import {
  WorkflowState,
  WorkflowStep,
  StepName,
  ConsumptionRecord,
  RecordStatus,
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

  const nextStep = updatedSteps[stepIndex + 1]

  return {
    ...state,
    currentStep: nextStep ? nextStep.name : stepName,
    steps: updatedSteps,
    updatedAt: now
  }
}

export function step1ImportTunerMessages(
  tunerLines: string[],
  operator: string
): { records: ConsumptionRecord[]; batch: ImportBatch; workflow: WorkflowState } {
  const batchId = uuidv4()
  const { batch, records: tunerRecords } = parseTunerMessage(tunerLines, batchId, operator)
  let consumptionRecords = createConsumptionRecordsFromTuner(tunerRecords)
  
  consumptionRecords = markDuplicates(consumptionRecords)
  
  unifiedStore.setRecords(consumptionRecords)
  unifiedStore.addBatch(batch)

  const workflow = createInitialWorkflow()

  return {
    records: consumptionRecords,
    batch,
    workflow
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
    if (record.status === RecordStatus.MATCHED || 
        (record.status === RecordStatus.IMPORTED && record.reviewFlag === 'none')) {
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

  const workflow = advanceStep(currentWorkflow, 'review_group', operator)

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

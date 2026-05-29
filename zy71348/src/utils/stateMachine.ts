import type { RecordStatus, RecordFormData } from '@/types';
import { STATE_TRANSITIONS, REQUIRED_FIELDS } from '@/types';

export function canTransition(
  from: RecordStatus,
  to: RecordStatus
): boolean {
  const allowed = STATE_TRANSITIONS[from] || [];
  return allowed.includes(to);
}

export function validateTransition(
  from: RecordStatus,
  to: RecordStatus
): { valid: boolean; message?: string } {
  if (from === to) {
    return { valid: true };
  }

  if (!canTransition(from, to)) {
    return {
      valid: false,
      message: `不允许从"${from}"状态变更为"${to}"状态`,
    };
  }

  return { valid: true };
}

export function getMissingFields(
  data: Partial<RecordFormData>
): (keyof RecordFormData)[] {
  return REQUIRED_FIELDS.filter((field) => {
    const value = data[field];
    if (value === undefined || value === null) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    if (typeof value === 'number' && isNaN(value)) return true;
    return false;
  });
}

export function canSubmitToPending(
  data: Partial<RecordFormData>
): { valid: boolean; missingFields: (keyof RecordFormData)[] } {
  const missingFields = getMissingFields(data);
  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}

export function getInitialStatus(
  data: Partial<RecordFormData>
): RecordStatus {
  const { valid } = canSubmitToPending(data);
  return valid ? 'pending' : 'draft';
}

export function isModifiable(status: RecordStatus): boolean {
  return status !== 'archived' && status !== 'listed';
}

export function canExport(status: RecordStatus): boolean {
  return status === 'verified';
}

export function getAvailableTransitions(
  status: RecordStatus
): RecordStatus[] {
  return STATE_TRANSITIONS[status] || [];
}

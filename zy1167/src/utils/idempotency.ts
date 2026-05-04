import { randomUUID, createHash, UUID } from 'crypto';
import { EmployeeId, BatchId, PayrollId, DisbursementId } from '../types';

export function generateIdempotencyKey(
  employeeId: EmployeeId,
  year: number,
  month: number,
  batchId?: string
): string {
  const baseString = `${employeeId}:${year}:${month}:${batchId || 'default'}`;
  return createHash('sha256').update(baseString).digest('hex');
}

export function generateUUID(): UUID {
  return randomUUID() as UUID;
}

export function generateBatchId(): BatchId {
  return randomUUID() as BatchId;
}

export function generateEmployeeId(): EmployeeId {
  return randomUUID() as EmployeeId;
}

export function generatePayrollId(): PayrollId {
  return randomUUID() as PayrollId;
}

export function generateDisbursementId(): DisbursementId {
  return randomUUID() as DisbursementId;
}

export function generateTransactionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `TXN-${timestamp.toUpperCase()}-${random.toUpperCase()}`;
}

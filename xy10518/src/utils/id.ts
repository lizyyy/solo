import { v4 as uuidv4 } from 'uuid';

export function generateId(): string {
  return uuidv4();
}

export function generateBatchNumber(prefix: string = 'B'): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}${year}${month}${day}${random}`;
}

export function generateSheetNumber(batchNumber: string, sequence: number = 1): string {
  return `${batchNumber}-S${String(sequence).padStart(3, '0')}`;
}

export function getTimestamp(): string {
  return new Date().toISOString();
}

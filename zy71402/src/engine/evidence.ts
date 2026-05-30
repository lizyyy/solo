import type { EvidenceRef, Material } from '../types';
import { generateId } from '../utils/hash';

export function createEvidenceRef(
  material: Material,
  location: string,
  value: string
): EvidenceRef {
  return {
    materialId: material.id,
    filename: material.filename,
    location,
    value,
  };
}

export function formatLocation(sheetName: string, row: number, col: string | number): string {
  if (typeof col === 'number') {
    col = String.fromCharCode(65 + col);
  }
  return `${sheetName}!${col}${row}`;
}

export function getEvidenceDisplayText(ref: EvidenceRef): string {
  return `[${ref.filename} - ${ref.location}] ${ref.value}`;
}

export interface EvidenceChain {
  id: string;
  title: string;
  description: string;
  refs: EvidenceRef[];
  timestamp: Date;
}

export function createEvidenceChain(
  title: string,
  description: string,
  refs: EvidenceRef[] = []
): EvidenceChain {
  return {
    id: generateId('ev_chain'),
    title,
    description,
    refs,
    timestamp: new Date(),
  };
}

import { createHash, randomUUID } from 'node:crypto';
import type {
  BatchImportInput,
  SupplementInput,
  GrayBatch,
  Sample,
  HistoryItem,
  Label,
} from '../../shared/types';
import { db } from '../db/index';

export function md5(text: string): string {
  return createHash('md5').update(text).digest('hex');
}

export function uuid(): string {
  return randomUUID();
}

export function isLowConfidence(confA: number, confB: number): boolean {
  return confA < 0.6 || confB < 0.6;
}

export function buildHistoryItem(
  sampleId: string,
  action: HistoryItem['action'],
  operator: string,
  snapshot: Partial<Sample>,
  note?: string,
): HistoryItem {
  return {
    id: uuid(),
    sampleId,
    action,
    operator,
    at: Date.now(),
    note,
    snapshot,
  };
}

export function dedupeSamples(
  incoming: BatchImportInput['samples'],
  existing: Sample[],
): { newSamples: BatchImportInput['samples']; skipped: number } {
  const existingMd5s = new Set(existing.map((s) => s.md5));
  const seen = new Set<string>();
  const newSamples: BatchImportInput['samples'] = [];
  for (const s of incoming) {
    const hash = md5(s.id + '|' + s.content);
    if (existingMd5s.has(hash) || seen.has(hash)) continue;
    seen.add(hash);
    newSamples.push(s);
  }
  return { newSamples, skipped: incoming.length - newSamples.length };
}

export function sampleFromInput(
  s: BatchImportInput['samples'][number],
  batchId: string,
  operator: string,
): Sample {
  const hash = md5(s.id + '|' + s.content);
  const sample: Sample = {
    id: s.id,
    batchId,
    content: s.content,
    confidenceA: s.confidenceA,
    confidenceB: s.confidenceB,
    labelA: s.labelA,
    labelB: s.labelB,
    grayLabel: s.grayLabel,
    annotatorNote: s.annotatorNote,
    isLowConfidence: isLowConfidence(s.confidenceA, s.confidenceB),
    md5: hash,
    history: [],
  };
  sample.history.push(
    buildHistoryItem(sample.id, 'import', operator, {
      confidenceA: sample.confidenceA,
      confidenceB: sample.confidenceB,
      labelA: sample.labelA,
      labelB: sample.labelB,
      grayLabel: sample.grayLabel,
      isLowConfidence: sample.isLowConfidence,
    }),
  );
  return sample;
}

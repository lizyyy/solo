import { db } from '../db/index';
import {
  dedupeSamples,
  sampleFromInput,
  uuid,
  buildHistoryItem,
  isLowConfidence,
  md5,
} from './common';
import type {
  BatchImportInput,
  BatchOverview,
  GrayBatch,
  Sample,
} from '../../shared/types';

export async function listBatches(): Promise<GrayBatch[]> {
  await db.read();
  return db.data.batches;
}

export async function importBatch(
  input: BatchImportInput,
  operator = '知识库编辑小乔',
): Promise<{ batch: GrayBatch; overview: BatchOverview; skipped: number; added: number }> {
  await db.read();
  const { newSamples, skipped } = dedupeSamples(input.samples, db.data.samples);

  let batch = db.data.batches.find((b) => b.id === input.batchId);
  if (!batch) {
    batch = {
      id: input.batchId,
      name: input.batchName,
      modelVersionA: input.modelVersionA,
      modelVersionB: input.modelVersionB,
      importedAt: Date.now(),
      sampleIds: [],
      duplicateSkipped: 0,
      recalcVersion: 1,
    };
    db.data.batches.push(batch);
  }

  const addedSamples: Sample[] = [];
  for (const s of newSamples) {
    const sample = sampleFromInput(s, batch.id, operator);
    db.data.samples.push(sample);
    batch.sampleIds.push(sample.id);
    addedSamples.push(sample);
  }

  batch.duplicateSkipped += skipped;
  await db.write();

  const overview = await getBatchOverview(batch.id);
  return { batch, overview, skipped, added: addedSamples.length };
}

export async function getBatch(batchId: string): Promise<GrayBatch | null> {
  await db.read();
  return db.data.batches.find((b) => b.id === batchId) ?? null;
}

export async function getBatchSamples(
  batchId: string,
): Promise<{ lowConfidence: Sample[]; normal: Sample[]; all: Sample[] }> {
  await db.read();
  const all = db.data.samples
    .filter((s) => s.batchId === batchId)
    .sort((a, b) => Math.min(a.confidenceA, a.confidenceB) - Math.min(b.confidenceA, b.confidenceB));
  return {
    all,
    lowConfidence: all.filter((s) => s.isLowConfidence),
    normal: all.filter((s) => !s.isLowConfidence),
  };
}

export async function getBatchOverview(batchId: string): Promise<BatchOverview> {
  const batch = (await getBatch(batchId))!;
  const { all, lowConfidence } = await getBatchSamples(batchId);
  await db.read();
  const conflictCount = db.data.conflicts.filter(
    (c) => c.batchId === batchId && !c.resolved,
  ).length;
  const reviewedCount = all.filter((s) => s.finalLabel).length;
  const avgA = all.length ? all.reduce((sum, s) => sum + s.confidenceA, 0) / all.length : 0;
  const avgB = all.length ? all.reduce((sum, s) => sum + s.confidenceB, 0) / all.length : 0;
  return {
    batch,
    totalSamples: all.length,
    lowConfidenceCount: lowConfidence.length,
    conflictCount,
    reviewedCount,
    avgConfidenceA: avgA,
    avgConfidenceB: avgB,
  };
}

export async function recalcBatch(batchId: string, operator = '知识库编辑小乔'): Promise<BatchOverview> {
  await db.read();
  const batch = db.data.batches.find((b) => b.id === batchId);
  if (!batch) throw new Error('batch not found');

  const samples = db.data.samples.filter((s) => s.batchId === batchId);
  for (const sample of samples) {
    const wasLow = sample.isLowConfidence;
    sample.isLowConfidence = isLowConfidence(sample.confidenceA, sample.confidenceB);
    if (wasLow !== sample.isLowConfidence) {
      sample.history.push(
        buildHistoryItem(sample.id, 'recalc', operator, {
          isLowConfidence: sample.isLowConfidence,
          confidenceA: sample.confidenceA,
          confidenceB: sample.confidenceB,
        }, `批次重算 v${batch.recalcVersion + 1}`),
      );
    }
  }
  batch.recalcVersion += 1;
  await db.write();
  return getBatchOverview(batchId);
}

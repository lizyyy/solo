import { db } from '../db/index';
import { buildHistoryItem, isLowConfidence, md5, uuid } from './common';
import type {
  FinalLabel,
  ReviewSampleInput,
  Sample,
  SupplementInput,
} from '../../shared/types';

export async function getSample(sampleId: string): Promise<Sample | null> {
  await db.read();
  return db.data.samples.find((s) => s.id === sampleId) ?? null;
}

export async function reviewSample(
  sampleId: string,
  input: ReviewSampleInput,
): Promise<Sample> {
  await db.read();
  const sample = db.data.samples.find((s) => s.id === sampleId);
  if (!sample) throw new Error('sample not found');

  sample.finalLabel = input.finalLabel;
  sample.reviewedBy = input.operator;
  sample.reviewedAt = Date.now();
  sample.history.push(
    buildHistoryItem(sampleId, 'review', input.operator, {
      finalLabel: sample.finalLabel,
      isLowConfidence: sample.isLowConfidence,
    }, input.note),
  );
  await db.write();
  return sample;
}

export async function supplementSamples(
  input: SupplementInput,
  operator = '知识库编辑小乔',
): Promise<{ added: number; skipped: number; samples: Sample[] }> {
  await db.read();
  const existingMd5s = new Set(db.data.samples.map((s) => s.md5));
  const existingIds = new Set(db.data.samples.map((s) => s.id));
  const added: Sample[] = [];
  let skipped = 0;

  for (const s of input.samples) {
    const hash = md5(s.id + '|' + s.content);
    if (existingMd5s.has(hash) || existingIds.has(s.id)) {
      skipped += 1;
      continue;
    }
    const sample: Sample = {
      id: s.id,
      batchId: input.batchId,
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
      buildHistoryItem(sample.id, 'supplement', operator, {
        confidenceA: sample.confidenceA,
        confidenceB: sample.confidenceB,
        labelA: sample.labelA,
        labelB: sample.labelB,
        grayLabel: sample.grayLabel,
        isLowConfidence: sample.isLowConfidence,
      }, '补录样本'),
    );
    db.data.samples.push(sample);
    const batch = db.data.batches.find((b) => b.id === input.batchId);
    if (batch) batch.sampleIds.push(sample.id);
    added.push(sample);
  }
  await db.write();
  return { added: added.length, skipped, samples: added };
}

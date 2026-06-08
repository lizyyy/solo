import { generateUUID, generateSHA256 } from '../utils/crypto';
import { getCurrentISO } from '../utils/date';
import { addToStore, putToStore, getFromStore, getFromIndex, getAllFromStore } from '../db';
import { logAction } from './auditService';
import type {
  CheckupRun,
  Sample,
  SampleResult,
  ModelVersion,
  Evidence,
  JudgmentType,
  CreateCheckupOptions,
  ImportSampleInput,
  Note,
  ManualJudgment,
} from '../types';

const DEFAULT_USER = '小乔';

function generateMockEvidences(question: string, knowledgeSource: string): Evidence[] {
  const evidences: Evidence[] = [];
  const fragments = [
    `${question}的相关配置说明`,
    `参考文档：${knowledgeSource}`,
    '最佳实践建议',
  ];

  for (let i = 0; i < Math.min(3, Math.floor(Math.random() * 3) + 1); i++) {
    evidences.push({
      id: generateUUID(),
      knowledgeDocId: `doc_${Date.now()}_${i}`,
      fragment: fragments[i],
      startPos: i * 50,
      endPos: i * 50 + 40 + Math.floor(Math.random() * 20),
      relevanceScore: 0.7 + Math.random() * 0.25,
      quotedText: fragments[i],
    });
  }

  return evidences;
}

function determineJudgment(
  sample: Sample,
  threshold: number
): { judgment: JudgmentType; confidence: number } {
  if (!sample.modelOutput || !sample.referenceAnswer) {
    return { judgment: 'unverified', confidence: 0.5 };
  }

  const output = sample.modelOutput.toLowerCase();
  const reference = sample.referenceAnswer.toLowerCase();
  
  const outputWords = new Set(output.split(/[\s，。,.！？!?]+/).filter(w => w.length > 0));
  const referenceWords = reference.split(/[\s，。,.！？!?]+/).filter(w => w.length > 0);
  
  let matchCount = 0;
  for (const word of referenceWords) {
    if (outputWords.has(word)) matchCount++;
  }
  
  const matchRatio = referenceWords.length > 0 ? matchCount / referenceWords.length : 0;
  const confidence = 0.5 + matchRatio * 0.45 + Math.random() * 0.05;

  let judgment: JudgmentType;
  if (confidence >= threshold && matchRatio >= 0.8) {
    judgment = 'correct';
  } else if (confidence >= threshold * 0.8 && matchRatio >= 0.4) {
    judgment = 'partial';
  } else if (matchRatio >= 0.2) {
    judgment = 'partial';
  } else {
    judgment = 'incorrect';
  }

  return { judgment, confidence: Math.min(0.99, confidence) };
}

function calculateMetrics(results: SampleResult[]): CheckupRun['metrics'] {
  const total = results.length;
  if (total === 0) {
    return {
      accuracy: 0,
      precision: 0,
      recall: 0,
      f1: 0,
      manualOverrideRate: 0,
      totalSamples: 0,
      totalCount: 0,
      conflictCount: 0,
    };
  }

  const correct = results.filter(r => r.judgment === 'correct').length;
  const incorrect = results.filter(r => r.judgment === 'incorrect').length;
  const partial = results.filter(r => r.judgment === 'partial').length;
  const manuallyAdjusted = results.filter(r => r.status === 'manually_adjusted').length;
  const conflicts = results.filter(r => r.manualJudgment).length;

  const accuracy = correct / total;
  const predictedPositive = correct + incorrect;
  const actualPositive = correct + partial;
  
  const precision = predictedPositive > 0 ? correct / predictedPositive : 0;
  const recall = actualPositive > 0 ? correct / actualPositive : 0;
  const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;
  const manualOverrideRate = manuallyAdjusted / total;

  return {
    accuracy: Math.round(accuracy * 10000) / 10000,
    precision: Math.round(precision * 10000) / 10000,
    recall: Math.round(recall * 10000) / 10000,
    f1: Math.round(f1 * 10000) / 10000,
    manualOverrideRate: Math.round(manualOverrideRate * 10000) / 10000,
    totalSamples: total,
    totalCount: total,
    conflictCount: conflicts,
  };
}

export async function createCheckupRun(
  options: CreateCheckupOptions,
  operator?: string
): Promise<CheckupRun> {
  const user = operator || DEFAULT_USER;
  const modelVersion = await getFromStore('modelVersions', options.modelVersionId);
  
  if (!modelVersion) {
    throw new Error(`Model version ${options.modelVersionId} not found`);
  }

  const samples: Sample[] = [];
  for (const sampleId of options.sampleIds) {
    const sample = await getFromStore('samples', sampleId);
    if (sample) samples.push(sample);
  }

  if (samples.length === 0) {
    throw new Error('No valid samples provided');
  }

  const runId = generateUUID();
  const now = getCurrentISO();

  const run: CheckupRun = {
    id: runId,
    modelVersionId: options.modelVersionId,
    modelName: modelVersion.name,
    version: modelVersion.version,
    batchName: options.name || `RAG体检批次`,
    name: options.name || `体检 - ${modelVersion.version} - ${new Date().toLocaleString('zh-CN')}`,
    status: 'running',
    startedAt: now,
    createdBy: user,
    operator: user,
    confidenceThreshold: modelVersion.config.threshold,
    metrics: {
      accuracy: 0,
      precision: 0,
      recall: 0,
      f1: 0,
      manualOverrideRate: 0,
      totalSamples: samples.length,
      totalCount: samples.length,
      conflictCount: 0,
    },
    dataHash: '',
  };

  await addToStore('checkupRuns', run);
  await logAction('checkup_run', runId, 'create', undefined, run, user);

  const results: SampleResult[] = [];
  for (const sample of samples) {
    const { judgment, confidence } = determineJudgment(sample, modelVersion.config.threshold);
    const evidences = generateMockEvidences(sample.question, sample.knowledgeSource);
    
    const notes = await getFromIndex('notes', 'by-entity', IDBKeyRange.only(['sample_result', '']));
    
    const result: SampleResult = {
      id: generateUUID(),
      checkupRunId: runId,
      runId: runId,
      sampleId: sample.id,
      modelOutput: sample.modelOutput || '',
      confidence,
      modelConfidence: confidence,
      thresholdUsed: modelVersion.config.threshold,
      judgment,
      originalJudgment: judgment,
      finalJudgment: judgment,
      status: 'processed',
      evidences,
      evidence: evidences,
      notes: [],
      processedAt: getCurrentISO(),
    };

    await addToStore('sampleResults', result);
    results.push(result);
  }

  const metrics = calculateMetrics(results);
  const resultsJson = JSON.stringify(results.map(r => ({
    id: r.id,
    judgment: r.judgment,
    confidence: r.confidence,
    evidences: r.evidences.map(e => ({ id: e.id, score: e.relevanceScore })),
  })));
  const dataHash = await generateSHA256(resultsJson);

  run.status = 'completed';
  run.completedAt = getCurrentISO();
  run.metrics = metrics;
  run.dataHash = dataHash;

  await putToStore('checkupRuns', run);
  await logAction('checkup_run', runId, 'update', undefined, run, user);

  return run;
}

export async function importSamples(
  inputs: ImportSampleInput[],
  sourceFile: string,
  operator?: string
): Promise<Sample[]> {
  const user = operator || DEFAULT_USER;
  const samples: Sample[] = [];

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    const sample: Sample = {
      id: generateUUID(),
      question: input.question,
      sourceFile,
      sourceLine: i + 1,
      knowledgeSource: input.knowledge_source,
      referenceAnswer: input.reference_answer,
      modelOutput: input.model_output,
      manualCorrection: input.manual_correction,
      onlineFeedback: input.online_feedback,
      originalData: input.original_data || {},
      importedAt: getCurrentISO(),
      importedBy: user,
      dataHash: `hash_${generateUUID().slice(0, 16)}`,
    };

    await addToStore('samples', sample);
    samples.push(sample);
  }

  return samples;
}

export async function parseJSONLFile(file: File): Promise<ImportSampleInput[]> {
  const text = await file.text();
  const lines = text.split('\n').filter(line => line.trim());
  const results: ImportSampleInput[] = [];

  for (let i = 0; i < lines.length; i++) {
    try {
      const data = JSON.parse(lines[i]);
      if (!data.question || !data.knowledge_source) {
        console.warn(`Line ${i + 1}: missing required fields`);
        continue;
      }
      results.push(data);
    } catch (e) {
      console.warn(`Line ${i + 1}: invalid JSON`);
    }
  }

  return results;
}

export async function addManualJudgment(
  sampleResultId: string,
  newJudgment: JudgmentType,
  reason: string,
  operator?: string
): Promise<SampleResult | undefined> {
  const user = operator || DEFAULT_USER;
  const result = await getFromStore('sampleResults', sampleResultId);
  
  if (!result) {
    return undefined;
  }

  const beforeState = JSON.parse(JSON.stringify(result));

  const now = getCurrentISO();
  const mj: ManualJudgment = {
    id: generateUUID(),
    sampleResultId,
    originalJudgment: result.judgment,
    newJudgment,
    judgment: newJudgment,
    reason,
    createdAt: now,
    createdBy: user,
    operator: user,
    timestamp: now,
  };

  result.manualJudgment = mj;
  result.judgment = newJudgment;
  result.finalJudgment = newJudgment;
  result.status = 'manually_adjusted';

  await putToStore('sampleResults', result);
  await logAction('sample_result', sampleResultId, 'override', beforeState, result, user, {
    judgment: newJudgment,
    originalJudgment: mj.originalJudgment,
    reason,
  });

  const run = await getFromStore('checkupRuns', result.checkupRunId);
  if (run) {
    const allResults = await getFromIndex('sampleResults', 'by-checkupRunId', IDBKeyRange.only(result.checkupRunId));
    const newMetrics = calculateMetrics(allResults);
    const runBefore = JSON.parse(JSON.stringify(run));
    run.metrics = newMetrics;
    await putToStore('checkupRuns', run);
    await logAction('checkup_run', run.id, 'update', runBefore, run, user);
  }

  return result;
}

export async function addNote(
  entityType: 'checkup_run' | 'sample_result',
  entityId: string,
  content: string,
  diffSummary?: string,
  operator?: string
): Promise<Note> {
  const user = operator || DEFAULT_USER;
  const now = getCurrentISO();
  const note: Note = {
    id: generateUUID(),
    entityType,
    entityId,
    content,
    diffSummary,
    createdAt: now,
    createdBy: user,
    operator: user,
    timestamp: now,
  };

  await addToStore('notes', note);
  await logAction(entityType, entityId, 'add_note', undefined, note, user, {
    note: {
      id: note.id,
      content: note.content,
      diffSummary: note.diffSummary,
      operator: note.operator,
      timestamp: note.timestamp,
    },
  });

  if (entityType === 'sample_result') {
    const result = await getFromStore('sampleResults', entityId);
    if (result) {
      result.notes = [...(result.notes || []), note];
      await putToStore('sampleResults', result);
    }
  }

  return note;
}

export async function getCheckupRunWithResults(
  runId: string
): Promise<{ run: CheckupRun; results: SampleResult[]; modelVersion: ModelVersion } | undefined> {
  const run = await getFromStore('checkupRuns', runId);
  if (!run) return undefined;

  const modelVersion = await getFromStore('modelVersions', run.modelVersionId);
  if (!modelVersion) return undefined;

  const results = await getFromIndex('sampleResults', 'by-checkupRunId', IDBKeyRange.only(runId));
  
  const resultsWithNotes = await Promise.all(
    results.map(async r => {
      const notes = await getFromIndex('notes', 'by-entity', IDBKeyRange.only(['sample_result', r.id]));
      return { ...r, notes };
    })
  );

  return { run, results: resultsWithNotes, modelVersion };
}

export async function createModelVersion(
  data: Omit<ModelVersion, 'id' | 'createdAt' | 'createdBy' | 'isActive'>,
  operator?: string
): Promise<ModelVersion> {
  const user = operator || DEFAULT_USER;
  const version: ModelVersion = {
    ...data,
    id: generateUUID(),
    createdAt: getCurrentISO(),
    createdBy: user,
    isActive: false,
  };

  await addToStore('modelVersions', version);
  return version;
}

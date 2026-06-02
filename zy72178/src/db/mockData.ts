import { generateUUID, generateSHA256 } from '../utils/crypto';
import { getCurrentISO } from '../utils/date';
import type {
  ModelVersion,
  CheckupRun,
  Sample,
  SampleResult,
  Evidence,
  ManualJudgment,
  Note,
  JudgmentType,
  AuditLog,
} from '../types';
import { addToStore, getAllFromStore, getDB } from './index';

const DEFAULT_USER = '小乔';

function createMockModelVersions(): ModelVersion[] {
  const now = new Date();
  return [
    {
      id: generateUUID(),
      name: 'RAG基线模型',
      version: 'v1.0.0',
      description: '初始版本，使用默认配置',
      config: {
        threshold: 0.7,
        topK: 3,
        modelType: 'gpt-3.5-turbo',
        embeddingModel: 'text-embedding-ada-002',
      },
      createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdBy: DEFAULT_USER,
      isActive: false,
    },
    {
      id: generateUUID(),
      name: 'RAG优化模型',
      version: 'v1.1.0',
      description: '调整了检索策略，优化了prompt模板',
      config: {
        threshold: 0.75,
        topK: 4,
        modelType: 'gpt-3.5-turbo',
        embeddingModel: 'text-embedding-ada-002',
        reranker: 'bge-reranker-base',
      },
      createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      createdBy: DEFAULT_USER,
      isActive: false,
    },
    {
      id: generateUUID(),
      name: 'RAG新版模型',
      version: 'v2.0.0',
      description: '升级到GPT-4，使用新的知识库切分策略',
      config: {
        threshold: 0.8,
        topK: 5,
        modelType: 'gpt-4-turbo',
        embeddingModel: 'text-embedding-3-large',
        chunkSize: 512,
        chunkOverlap: 50,
      },
      createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      createdBy: DEFAULT_USER,
      isActive: true,
    },
  ];
}

function createMockSamples(): Sample[] {
  const now = new Date();
  const samplesData = [
    {
      question: '如何配置RAG系统的阈值参数？',
      referenceAnswer: '在config.yaml中设置threshold参数，建议取值范围0.6-0.9',
      modelOutput: '在配置文件中设置threshold，一般设置为0.7比较合适',
      manualCorrection: '在config.yaml中设置threshold参数，建议取值范围0.6-0.9',
      onlineFeedback: '用户反馈回答基本正确，但缺少具体位置说明',
      knowledgeSource: 'docs/rag-config.md',
      original_data: { conversation_id: 'conv_001', user_id: 'u_123' },
    },
    {
      question: 'RAG支持哪些向量数据库？',
      referenceAnswer: '支持Milvus、FAISS、Pinecone、Chroma、Weaviate等',
      modelOutput: '主流支持Milvus和FAISS',
      manualCorrection: undefined,
      onlineFeedback: '用户提到也需要Pinecone的支持',
      knowledgeSource: 'docs/vector-db.md',
      original_data: { conversation_id: 'conv_002', user_id: 'u_124' },
    },
    {
      question: '如何处理知识库的更新？',
      referenceAnswer: '可以通过增量更新或全量重建两种方式，增量更新效率更高',
      modelOutput: '知识库更新需要重新导入所有文档',
      manualCorrection: '可以通过增量更新或全量重建两种方式，增量更新效率更高',
      onlineFeedback: '',
      knowledgeSource: 'docs/knowledge-update.md',
      original_data: { conversation_id: 'conv_003', user_id: 'u_125' },
    },
    {
      question: 'RAG的召回率低怎么办？',
      referenceAnswer: '可以调整topK参数、优化embedding模型、增加query改写',
      modelOutput: '可以调大topK参数来提升召回率',
      manualCorrection: undefined,
      onlineFeedback: '用户按建议调整后效果有改善',
      knowledgeSource: 'docs/optimization.md',
      original_data: { conversation_id: 'conv_004', user_id: 'u_126' },
    },
    {
      question: '如何评估RAG系统的效果？',
      referenceAnswer: '常用指标包括准确率、召回率、F1、BLEU、ROUGE，以及人工评估',
      modelOutput: '主要看准确率和召回率',
      manualCorrection: undefined,
      onlineFeedback: '',
      knowledgeSource: 'docs/evaluation.md',
      original_data: { conversation_id: 'conv_005', user_id: 'u_127' },
    },
    {
      question: 'RAG会产生幻觉吗？',
      referenceAnswer: 'RAG可以减少幻觉，但如果引用的内容本身有误或模型理解偏差，仍可能产生',
      modelOutput: 'RAG完全不会产生幻觉',
      manualCorrection: 'RAG可以减少幻觉，但如果引用的内容本身有误或模型理解偏差，仍可能产生',
      onlineFeedback: '用户对这个问题很关注',
      knowledgeSource: 'docs/limitations.md',
      original_data: { conversation_id: 'conv_006', user_id: 'u_128' },
    },
  ];

  return samplesData.map((data, idx) => ({
    id: generateUUID(),
    question: data.question,
    sourceFile: 'samples_v1.jsonl',
    sourceLine: idx + 1,
    knowledgeSource: data.knowledgeSource,
    referenceAnswer: data.referenceAnswer,
    modelOutput: data.modelOutput,
    manualCorrection: data.manualCorrection,
    onlineFeedback: data.onlineFeedback,
    originalData: data.original_data || {},
    importedAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    importedBy: DEFAULT_USER,
    dataHash: `hash_${generateUUID().slice(0, 16)}`,
  }));
}

function createMockEvidences(sampleIdx: number): Evidence[] {
  const evidencesPool = [
    [
      {
        knowledgeDocId: 'doc_rag_config_1',
        fragment: 'threshold: 0.7 # 相似度阈值，高于此值才会被召回',
        startPos: 45,
        endPos: 102,
        relevanceScore: 0.92,
        quotedText: '在config.yaml中设置threshold参数，建议取值范围0.6-0.9',
      },
      {
        knowledgeDocId: 'doc_rag_config_2',
        fragment: '参数调优建议：根据实际数据分布调整阈值',
        startPos: 200,
        endPos: 256,
        relevanceScore: 0.78,
        quotedText: '参数调优建议：根据实际数据分布调整阈值',
      },
    ],
    [
      {
        knowledgeDocId: 'doc_vector_db_1',
        fragment: '支持的向量数据库：Milvus, FAISS, Pinecone, Chroma, Weaviate',
        startPos: 12,
        endPos: 78,
        relevanceScore: 0.95,
        quotedText: '支持Milvus、FAISS、Pinecone、Chroma、Weaviate等',
      },
    ],
    [
      {
        knowledgeDocId: 'doc_update_1',
        fragment: '增量更新：只更新发生变化的文档片段',
        startPos: 34,
        endPos: 89,
        relevanceScore: 0.88,
        quotedText: '可以通过增量更新或全量重建两种方式，增量更新效率更高',
      },
      {
        knowledgeDocId: 'doc_update_2',
        fragment: '全量重建：删除所有索引后重新导入',
        startPos: 156,
        endPos: 201,
        relevanceScore: 0.72,
        quotedText: '全量重建：删除所有索引后重新导入',
      },
    ],
    [
      {
        knowledgeDocId: 'doc_opt_1',
        fragment: '召回率优化：增大topK、优化embedding、query改写',
        startPos: 78,
        endPos: 145,
        relevanceScore: 0.91,
        quotedText: '可以调整topK参数、优化embedding模型、增加query改写',
      },
    ],
    [
      {
        knowledgeDocId: 'doc_eval_1',
        fragment: '评估指标：准确率、召回率、F1、BLEU、ROUGE',
        startPos: 23,
        endPos: 87,
        relevanceScore: 0.89,
        quotedText: '常用指标包括准确率、召回率、F1、BLEU、ROUGE，以及人工评估',
      },
      {
        knowledgeDocId: 'doc_eval_2',
        fragment: '人工评估需要制定详细的评分标准',
        startPos: 234,
        endPos: 278,
        relevanceScore: 0.65,
        quotedText: '人工评估需要制定详细的评分标准',
      },
    ],
    [
      {
        knowledgeDocId: 'doc_limit_1',
        fragment: 'RAG可以显著减少幻觉，但无法完全消除',
        startPos: 56,
        endPos: 112,
        relevanceScore: 0.94,
        quotedText: 'RAG可以减少幻觉，但如果引用的内容本身有误或模型理解偏差，仍可能产生',
      },
    ],
  ];

  return evidencesPool[sampleIdx % evidencesPool.length].map(e => ({
    id: generateUUID(),
    ...e,
  }));
}

function determineJudgment(
  sample: Sample,
  hasManualCorrection: boolean
): { judgment: JudgmentType; confidence: number } {
  if (hasManualCorrection) {
    return { judgment: 'incorrect', confidence: 0.85 + Math.random() * 0.1 };
  }
  if (sample.modelOutput && sample.referenceAnswer) {
    const output = sample.modelOutput.toLowerCase();
    const reference = sample.referenceAnswer.toLowerCase();
    const overlap = reference.split(' ').filter(w => output.includes(w)).length;
    const ratio = overlap / reference.split(' ').length;
    if (ratio > 0.8) return { judgment: 'correct', confidence: 0.88 + Math.random() * 0.1 };
    if (ratio > 0.5) return { judgment: 'partial', confidence: 0.7 + Math.random() * 0.15 };
    return { judgment: 'incorrect', confidence: 0.6 + Math.random() * 0.15 };
  }
  return { judgment: 'unverified', confidence: 0.5 };
}

function createMockResults(
  checkupRunId: string,
  samples: Sample[],
  modelVersion: ModelVersion,
  runIdx: number
): { results: SampleResult[]; manualJudgments: ManualJudgment[]; notes: Note[]; auditLogs: AuditLog[] } {
  const now = new Date();
  const results: SampleResult[] = [];
  const manualJudgments: ManualJudgment[] = [];
  const notes: Note[] = [];
  const auditLogs: AuditLog[] = [];

  const judgmentBias = runIdx === 0 ? 0 : runIdx === 1 ? 0.1 : 0.2;

  samples.forEach((sample, sampleIdx) => {
    const evidences = createMockEvidences(sampleIdx);
    const hasManualCorrection = !!sample.manualCorrection && runIdx === 2;
    const { judgment: origJudgment, confidence } = determineJudgment(sample, false);

    const adjustedConfidence = Math.min(0.99, confidence + judgmentBias);
    const adjustedJudgment: JudgmentType = adjustedConfidence > modelVersion.config.threshold
      ? origJudgment
      : 'partial';

    const isManuallyAdjusted = hasManualCorrection;
    const status = isManuallyAdjusted ? 'manually_adjusted' : 'processed';

    const finalJudgment = isManuallyAdjusted ? 'correct' : adjustedJudgment;
    const nowStr = now.toISOString();

    const resultId = generateUUID();

    if (isManuallyAdjusted) {
      const timestamp = new Date(now.getTime() - (runIdx + 1) * 60 * 60 * 1000).toISOString();
      const mj: ManualJudgment = {
        id: generateUUID(),
        sampleResultId: resultId,
        originalJudgment: adjustedJudgment,
        newJudgment: 'correct',
        judgment: 'correct',
        reason: '模型输出虽然不完整，但核心信息正确，人工修正为正确',
        createdAt: timestamp,
        createdBy: DEFAULT_USER,
        operator: DEFAULT_USER,
        timestamp: timestamp,
      };
      manualJudgments.push(mj);

      auditLogs.push({
        id: generateUUID(),
        entityType: 'sample_result',
        entityId: resultId,
        action: 'add_manual_judgment',
        createdAt: timestamp,
        createdBy: DEFAULT_USER,
        operator: DEFAULT_USER,
        timestamp: timestamp,
        metadata: {
          judgment: 'correct',
          reason: mj.reason,
          originalJudgment: adjustedJudgment,
        },
      });

      if (sampleIdx === 0) {
        const noteTime = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
        const note: Note = {
          id: generateUUID(),
          entityType: 'sample_result',
          entityId: resultId,
          content: '后续补充：用户反馈这条的回答确实帮助解决了问题，虽然缺少具体配置路径，但用户找到了。',
          diffSummary: '补充了用户实际使用反馈',
          createdAt: noteTime,
          createdBy: DEFAULT_USER,
          operator: DEFAULT_USER,
          timestamp: noteTime,
        };
        notes.push(note);

        auditLogs.push({
          id: generateUUID(),
          entityType: 'sample_result',
          entityId: resultId,
          action: 'add_note',
          createdAt: noteTime,
          createdBy: DEFAULT_USER,
          operator: DEFAULT_USER,
          timestamp: noteTime,
          metadata: { note },
        });
      }
    }

    const processedAt = new Date(now.getTime() - runIdx * 24 * 60 * 60 * 1000 - sampleIdx * 5 * 60 * 1000).toISOString();

    const result: SampleResult = {
      id: resultId,
      checkupRunId,
      runId: checkupRunId,
      sampleId: sample.id,
      modelOutput: sample.modelOutput || '',
      confidence: adjustedConfidence,
      modelConfidence: adjustedConfidence,
      thresholdUsed: modelVersion.config.threshold,
      judgment: finalJudgment,
      originalJudgment: adjustedJudgment,
      finalJudgment: finalJudgment,
      status,
      evidences,
      evidence: evidences,
      manualJudgment: isManuallyAdjusted ? manualJudgments[manualJudgments.length - 1] : undefined,
      notes: notes.filter(n => n.entityId === resultId),
      processedAt,
    };

    auditLogs.push({
      id: generateUUID(),
      entityType: 'sample_result',
      entityId: resultId,
      action: 'create',
      createdAt: processedAt,
      createdBy: DEFAULT_USER,
      operator: DEFAULT_USER,
      timestamp: processedAt,
      metadata: {
        judgment: finalJudgment,
        confidence: adjustedConfidence,
      },
    });

    results.push(result);
  });

  return { results, manualJudgments, notes, auditLogs };
}

function calculateMetrics(results: SampleResult[]): CheckupRun['metrics'] {
  const total = results.length;
  const correct = results.filter(r => r.judgment === 'correct').length;
  const incorrect = results.filter(r => r.judgment === 'incorrect').length;
  const partial = results.filter(r => r.judgment === 'partial').length;
  const manuallyAdjusted = results.filter(r => r.status === 'manually_adjusted').length;
  const conflicts = results.filter(r => r.manualJudgment).length;

  const accuracy = total > 0 ? correct / total : 0;
  const precision = (correct + partial) > 0 ? correct / (correct + incorrect) : 0;
  const recall = (correct + partial) > 0 ? correct / (correct + partial) : 0;
  const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;
  const manualOverrideRate = total > 0 ? manuallyAdjusted / total : 0;

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

export async function initMockData(): Promise<boolean> {
  const existingVersions = await getAllFromStore('modelVersions');
  if (existingVersions.length > 0) {
    return false;
  }

  const modelVersions = createMockModelVersions();
  for (const mv of modelVersions) {
    await addToStore('modelVersions', mv);
  }

  const samples = createMockSamples();
  for (const s of samples) {
    await addToStore('samples', s);
  }

  const now = new Date();
  const runNames = ['首次体检', '优化后体检', '新版本体检'];
  const runBatchNames = ['RAG基线模型体检', '优化后模型体检', '新版本模型体检'];

  for (let runIdx = 0; runIdx < 3; runIdx++) {
    const modelVersion = modelVersions[runIdx];
    const runId = generateUUID();
    const { results, manualJudgments, notes, auditLogs } = createMockResults(
      runId,
      samples,
      modelVersion,
      runIdx
    );
    const metrics = calculateMetrics(results);

    const startedAt = new Date(now.getTime() - (3 - runIdx) * 24 * 60 * 60 * 1000).toISOString();
    const completedAt = new Date(now.getTime() - (3 - runIdx) * 24 * 60 * 60 * 1000 + 5 * 60 * 1000).toISOString();

    const checkupRun: CheckupRun = {
      id: runId,
      modelVersionId: modelVersion.id,
      modelName: modelVersion.name,
      version: modelVersion.version,
      batchName: runBatchNames[runIdx],
      name: `RAG引用${runNames[runIdx]} - ${modelVersion.version}`,
      status: 'completed',
      startedAt,
      completedAt,
      createdBy: DEFAULT_USER,
      operator: DEFAULT_USER,
      confidenceThreshold: modelVersion.config.threshold,
      metrics,
      dataHash: `run_${generateUUID().slice(0, 32)}`,
    };

    await addToStore('checkupRuns', checkupRun);

    for (const r of results) {
      await addToStore('sampleResults', r);
    }

    for (const n of notes) {
      await addToStore('notes', n);
    }

    for (const log of auditLogs) {
      await addToStore('auditLogs', log);
    }
  }

  await localStorage.setItem('rag_checkup_initialized', 'true');
  return true;
}

export async function checkAndInitMockData(): Promise<boolean> {
  const initialized = localStorage.getItem('rag_checkup_initialized');
  if (initialized === 'true') {
    return false;
  }
  return initMockData();
}

export async function exportDB(): Promise<any> {
  const db = await getDB();
  const data: any = {};
  const stores = ['modelVersions', 'checkupRuns', 'samples', 'sampleResults', 'notes', 'auditLogs'];
  
  for (const store of stores) {
    data[store] = await getAllFromStore(store as any);
  }
  
  return {
    exportTime: new Date().toISOString(),
    version: '1.0.0',
    data,
  };
}

export async function importDB(importData: any): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(
    ['modelVersions', 'checkupRuns', 'samples', 'sampleResults', 'notes', 'auditLogs'],
    'readwrite'
  );

  const storeNames = ['modelVersions', 'checkupRuns', 'samples', 'sampleResults', 'notes', 'auditLogs'];
  for (const storeName of storeNames) {
    const store = tx.objectStore(storeName);
    await store.clear();
    if (importData.data?.[storeName]) {
      for (const item of importData.data[storeName]) {
        await store.add(item);
      }
    }
  }

  await tx.done;
  await localStorage.setItem('rag_checkup_initialized', 'true');
}

export async function clearDatabase(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(
    ['modelVersions', 'checkupRuns', 'samples', 'sampleResults', 'notes', 'auditLogs'],
    'readwrite'
  );

  for (const storeName of ['modelVersions', 'checkupRuns', 'samples', 'sampleResults', 'notes', 'auditLogs']) {
    await tx.objectStore(storeName).clear();
  }

  await tx.done;
  await localStorage.removeItem('rag_checkup_initialized');
  await localStorage.removeItem('db_initialized');
}

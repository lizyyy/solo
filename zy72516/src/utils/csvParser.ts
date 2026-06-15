import Papa from 'papaparse';
import { AnnotationRecord, RecordStatus, AbnormalType, ContentSnapshot, ModelOutput } from '../types';

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export interface ParsedCsvRow {
  annotatorMessage: string;
  referenceUrl: string;
  urlStatus: boolean;
  robotJudgment: string;
  modelOutputSnippet?: string;
  modelName?: string;
  confidence?: number;
  [key: string]: unknown;
}

function getRowValue(row: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) {
      return row[key];
    }
  }
  return '';
}

function parseUrlStatus(value: string): boolean {
  const lower = value.toLowerCase().trim();
  if (lower === '无效' || lower === 'false' || lower === 'no' || lower === '404' || lower === '失效') {
    return false;
  }
  return true;
}

function isModelOutputMissing(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === '' || trimmed === '暂无' || trimmed === 'N/A' || trimmed === 'n/a' || trimmed === 'NA' || trimmed === 'na') {
    return true;
  }
  return false;
}

function buildAnnotationRecord(row: Record<string, string>, index: number): AnnotationRecord {
  const annotatorMessage = getRowValue(row, ['标注员留言', 'message', 'annotator_message']);
  const referenceUrl = getRowValue(row, ['引用链接', 'url', 'reference_url']);
  const urlStatusStr = getRowValue(row, ['链接状态', 'url_status']);
  const robotJudgment = getRowValue(row, ['机器人判断', 'judgment', 'robot_judgment']);
  const modelOutputSnippet = getRowValue(row, ['模型输出', 'model_output', 'output']);
  const modelName = getRowValue(row, ['模型名称', 'model_name', 'model']);
  const confidenceStr = getRowValue(row, ['置信度', 'confidence']);

  const urlStatus = urlStatusStr ? parseUrlStatus(urlStatusStr) : true;
  const modelOutputMissing = isModelOutputMissing(modelOutputSnippet);
  const confidence = confidenceStr ? parseFloat(confidenceStr) : undefined;

  const id = generateId();

  let modelOutput: ModelOutput | undefined;
  if (!modelOutputMissing && modelOutputSnippet) {
    modelOutput = {
      id: generateId(),
      recordId: id,
      modelName: modelName || '',
      outputSnippet: modelOutputSnippet,
      confidence: confidence ?? 0,
      reasoningDetails: {},
      isBackfill: false
    };
  }

  const originalSnapshot: ContentSnapshot = {
    annotatorMessage,
    referenceUrl,
    urlStatus,
    robotJudgment,
    modelOutputSnippet: modelOutput?.outputSnippet,
    modelOutputName: modelOutput?.modelName,
    modelOutputConfidence: modelOutput?.confidence,
    status: RecordStatus.PENDING,
    abnormalType: AbnormalType.NONE
  };

  return {
    id,
    originalLineNumber: index + 1,
    annotatorMessage,
    referenceUrl,
    urlStatus,
    robotJudgment,
    currentStatus: RecordStatus.PENDING,
    abnormalType: AbnormalType.NONE,
    modelOutput,
    modelOutputMissing,
    judgmentLogs: [],
    rawData: row as Record<string, unknown>,
    originalSnapshot,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function parseCsvFile(file: File): Promise<AnnotationRecord[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete: (results) => {
        const records = results.data.map((row, index) => buildAnnotationRecord(row, index));
        resolve(records);
      },
      error: (error) => {
        reject(error);
      }
    });
  });
}

export function parseCsvString(content: string): AnnotationRecord[] {
  let records: AnnotationRecord[] = [];
  Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    encoding: 'UTF-8',
    complete: (results) => {
      records = results.data.map((row, index) => buildAnnotationRecord(row, index));
    }
  });
  return records;
}

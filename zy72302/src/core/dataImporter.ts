import * as fs from 'fs';
import * as path from 'path';
import { ManualCounterExample, QuestionnaireRow } from '../types';
import { generateManualCounterExampleId, generateQuestionnaireRowId } from '../utils/idGenerator';

interface RawManualCounterExample {
  sampleId: string;
  timestamp: string;
  windowNumber: number;
  arrivalCount: number;
  serviceTime: number;
  waitTime: number;
  isNegative?: boolean;
  source?: 'manual' | 'old_table' | 'calculated';
  notes?: string;
  mainProcessEvidence?: string;
}

interface RawQuestionnaireRow {
  sampleId: string;
  timestamp: string;
  windowNumber: number;
  onSiteStatement: string;
  witnessName: string;
  hasBreak?: boolean;
  breakStartTime?: string;
  breakEndTime?: string;
  isTemporaryClosed?: boolean;
  queueOverflow?: boolean;
  actualWaitTime: number;
  actualArrivalCount: number;
  supplementaryNotes?: string;
}

export function importManualCounterExamples(filePath: string): ManualCounterExample[] {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const rawData: RawManualCounterExample[] = JSON.parse(fileContent);
  
  return rawData.map(raw => ({
    id: generateManualCounterExampleId(),
    sampleId: raw.sampleId,
    timestamp: new Date(raw.timestamp),
    windowNumber: raw.windowNumber,
    arrivalCount: raw.arrivalCount,
    serviceTime: raw.serviceTime,
    waitTime: raw.waitTime,
    isNegative: raw.isNegative ?? (raw.waitTime < 0 || raw.arrivalCount < 0),
    source: raw.source ?? 'manual',
    notes: raw.notes,
    mainProcessEvidence: raw.mainProcessEvidence,
  }));
}

export function importQuestionnaireRows(filePath: string): QuestionnaireRow[] {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const rawData: RawQuestionnaireRow[] = JSON.parse(fileContent);
  
  return rawData.map(raw => ({
    id: generateQuestionnaireRowId(),
    sampleId: raw.sampleId,
    timestamp: new Date(raw.timestamp),
    windowNumber: raw.windowNumber,
    onSiteStatement: raw.onSiteStatement,
    witnessName: raw.witnessName,
    hasBreak: raw.hasBreak ?? false,
    breakStartTime: raw.breakStartTime,
    breakEndTime: raw.breakEndTime,
    isTemporaryClosed: raw.isTemporaryClosed ?? false,
    queueOverflow: raw.queueOverflow ?? false,
    actualWaitTime: raw.actualWaitTime,
    actualArrivalCount: raw.actualArrivalCount,
    supplementaryNotes: raw.supplementaryNotes,
  }));
}

export function loadSampleData(dataDir: string): {
  manualCounterExamples: ManualCounterExample[];
  questionnaireRows: QuestionnaireRow[];
} {
  const manualPath = path.join(dataDir, 'manualCounterExamples.json');
  const questionnairePath = path.join(dataDir, 'questionnaireRows.json');
  
  const manualExamples = fs.existsSync(manualPath) 
    ? importManualCounterExamples(manualPath)
    : [];
  
  const questionnaireRows = fs.existsSync(questionnairePath)
    ? importQuestionnaireRows(questionnairePath)
    : [];
  
  return { manualCounterExamples: manualExamples, questionnaireRows };
}

export function saveJSON(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

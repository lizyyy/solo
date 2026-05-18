import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { parseFiles } from './parser';
import {
  Contraindication,
  TreatmentPackage,
  ScreeningRecord,
  ScreeningIssue,
  ScreeningResult,
  ParseError,
  PACKAGE_CATEGORIES
} from './types';

interface DedupeState {
  processedBatches: Set<string>;
  processedRecords: Set<string>;
}

const STATE_FILE = path.join(process.cwd(), '.screening-state.json');

function loadDedupeState(): DedupeState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const content = fs.readFileSync(STATE_FILE, 'utf-8');
      const data = JSON.parse(content);
      return {
        processedBatches: new Set(data.processedBatches || []),
        processedRecords: new Set(data.processedRecords || [])
      };
    }
  } catch (e) {
  }
  return {
    processedBatches: new Set(),
    processedRecords: new Set()
  };
}

function saveDedupeState(state: DedupeState): void {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({
      processedBatches: Array.from(state.processedBatches),
      processedRecords: Array.from(state.processedRecords)
    }, null, 2));
  } catch (e) {
  }
}

function generateBatchHash(filePaths: string[]): string {
  const sortedPaths = [...filePaths].sort();
  const fileHashes = sortedPaths.map(fp => {
    try {
      const content = fs.readFileSync(fp, 'utf-8');
      return crypto.createHash('md5').update(content).digest('hex');
    } catch {
      return '';
    }
  });
  return crypto.createHash('md5').update(fileHashes.join('|')).digest('hex');
}

function generateRecordHash(patientId: string, packageId: string, screeningDate: string): string {
  return crypto.createHash('md5').update(`${patientId}|${packageId}|${screeningDate}`).digest('hex');
}

function isExpired(expiryDate: string, screeningDate: string): boolean {
  return new Date(expiryDate) < new Date(screeningDate);
}

function checkPackageMismatch(pkg: TreatmentPackage, contraindications: Contraindication[]): ScreeningIssue | null {
  const categoryContraindications: Record<string, string[]> = {
    '盆底康复': ['盆底肌肉严重损伤', '子宫复旧不良', '活动性出血'],
    '子宫复旧': ['活动性出血', '急性感染', '发热'],
    '形体恢复': ['严重贫血', '高血压', '心脏病'],
    '乳腺护理': ['急性感染', '发热', '恶性肿瘤'],
    '产后心理': ['精神疾病', '产后抑郁'],
    '综合调理': ['高血压', '心脏病', '糖尿病', '肝肾功能异常']
  };

  const expectedTypes = categoryContraindications[pkg.category] || [];

  for (const contType of pkg.contraindications) {
    if (!expectedTypes.includes(contType)) {
      return {
        type: 'package_mismatch',
        severity: 'warning',
        message: `套餐"${pkg.name}"(${pkg.category})包含非预期禁忌类型: ${contType}`,
        details: {
          packageId: pkg.id,
          expectedCategory: pkg.category,
          actualCategory: contType
        },
        source: pkg.source!
      };
    }
  }

  return null;
}

function screenPatient(
  patientId: string,
  patientName: string,
  pkg: TreatmentPackage,
  contraindications: Contraindication[],
  screeningDate: string,
  batchId: string
): ScreeningRecord {
  const issues: ScreeningIssue[] = [];
  const patientContraindications = contraindications.filter(c => c.patientId === patientId);

  for (const ci of patientContraindications) {
    if (isExpired(ci.expiryDate, screeningDate)) {
      issues.push({
        type: 'expired_contraindication',
        severity: 'critical',
        message: `患者"${patientName}"的禁忌"${ci.type}"已过期 (过期日期: ${ci.expiryDate})`,
        details: {
          contraindicationId: ci.id,
          contraindicationType: ci.type,
          expiryDate: ci.expiryDate
        },
        source: ci.source!
      });
    }
  }

  const mismatchIssue = checkPackageMismatch(pkg, patientContraindications);
  if (mismatchIssue) {
    issues.push(mismatchIssue);
  }

  let result: 'pass' | 'fail' | 'warning' = 'pass';
  if (issues.some(i => i.severity === 'critical')) {
    result = 'fail';
  } else if (issues.length > 0) {
    result = 'warning';
  }

  return {
    id: uuidv4(),
    batchId,
    patientId,
    patientName,
    treatmentPackageId: pkg.id,
    treatmentPackageName: pkg.name,
    screeningDate,
    result,
    issues,
    sourceFile: pkg.source?.file || '',
    sourceLine: pkg.source?.line || 0,
    processedAt: new Date().toISOString()
  };
}

export function runScreening(
  filePaths: string[],
  screeningDate: string = new Date().toISOString().split('T')[0],
  force: boolean = false
): ScreeningResult {
  const batchId = generateBatchHash(filePaths);
  const state = loadDedupeState();

  if (!force && state.processedBatches.has(batchId)) {
    return {
      batchId,
      processedAt: new Date().toISOString(),
      totalRecords: 0,
      passed: 0,
      failed: 0,
      warnings: 0,
      records: [],
      parseErrors: [],
      inputFiles: filePaths
    };
  }

  const parsed = parseFiles(filePaths);

  const records: ScreeningRecord[] = [];
  const uniquePatients = new Set(parsed.contraindications.map(c => c.patientId));

  for (const patientId of uniquePatients) {
    const patientContra = parsed.contraindications.find(c => c.patientId === patientId);
    if (!patientContra) continue;

    for (const pkg of parsed.packages) {
      const recordHash = generateRecordHash(patientId, pkg.id, screeningDate);

      if (!force && state.processedRecords.has(recordHash)) {
        continue;
      }

      const record = screenPatient(
        patientId,
        patientContra.patientName,
        pkg,
        parsed.contraindications.filter(c => c.patientId === patientId),
        screeningDate,
        batchId
      );

      records.push(record);
      state.processedRecords.add(recordHash);
    }
  }

  state.processedBatches.add(batchId);
  saveDedupeState(state);

  const passed = records.filter(r => r.result === 'pass').length;
  const failed = records.filter(r => r.result === 'fail').length;
  const warnings = records.filter(r => r.result === 'warning').length;

  return {
    batchId,
    processedAt: new Date().toISOString(),
    totalRecords: records.length,
    passed,
    failed,
    warnings,
    records: sortRecords(records),
    parseErrors: parsed.errors,
    inputFiles: filePaths
  };
}

export function sortRecords(records: ScreeningRecord[]): ScreeningRecord[] {
  return [...records].sort((a, b) => {
    if (a.result !== b.result) {
      const order: Record<string, number> = { fail: 0, warning: 1, pass: 2 };
      return order[a.result] - order[b.result];
    }
    if (a.patientId !== b.patientId) {
      return a.patientId.localeCompare(b.patientId);
    }
    return a.treatmentPackageId.localeCompare(b.treatmentPackageId);
  });
}

export function clearDedupeState(): void {
  if (fs.existsSync(STATE_FILE)) {
    fs.unlinkSync(STATE_FILE);
  }
}

import type {
  ParameterTable,
  ParameterRecord,
  CounterExample,
  ExampleRecord,
  Conflict,
  ForecastResult,
  WorkflowState,
  AuditLogEntry,
  MetadataState,
  ImportResult,
  ParsedParameterRow,
  ParameterUpdateRequest,
} from '../../shared/types';
import fs from 'fs/promises';
import path from 'path';
import { parseNumericValue } from './exponentialSmoothing';

const DATA_DIR = path.resolve(process.cwd(), 'data');

const readJSONFile = async <T>(filename: string, fallback: T): Promise<T> => {
  try {
    const filePath = path.join(DATA_DIR, filename);
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return fallback;
  }
};

const writeJSONFile = async <T>(filename: string, data: T): Promise<void> => {
  const filePath = path.join(DATA_DIR, filename);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
};

const makeId = (prefix: string): string => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

// ==================== 参数表相关 ====================

type UpsertStrategy = 'overwrite' | 'skip' | 'append';

interface UpsertResult {
  importedCount: number;
  duplicateCount: number;
  overwrittenCount: number;
  skippedCount: number;
  duplicateProductIds: string[];
  overwrittenProductIds: string[];
  skippedProductIds: string[];
  mixedProductIds: string[];
}

const buildRecord = (
  parsed: ParsedParameterRow,
  tableId: string,
  existingVersion = 0
): ParameterRecord => {
  const hasPct = (s: string): boolean => typeof s === 'string' && s.endsWith('%');

  const formats: boolean[] = [hasPct(parsed.rawAlpha), hasPct(parsed.rawBeta), hasPct(parsed.rawGamma)];
  const anyPct = formats.some(Boolean);
  const anyDec = formats.some(f => !f);
  const mixed = anyPct && anyDec;

  let alpha: number | string = parsed.rawAlpha;
  let beta: number | string = parsed.rawBeta;
  let gamma: number | string = parsed.rawGamma;
  try {
    alpha = parseNumericValue(parsed.rawAlpha);
    beta = parseNumericValue(parsed.rawBeta);
    gamma = parseNumericValue(parsed.rawGamma);
  } catch {
    /* ignore parse errors here */
  }

  const valueFormat: 'decimal' | 'percentage' | 'mixed' = mixed
    ? 'mixed'
    : anyPct
    ? 'percentage'
    : 'decimal';

  const now = new Date().toISOString();

  return {
    id: makeId('rec'),
    tableId,
    productId: parsed.productId,
    productName: parsed.productName,
    alpha,
    beta,
    gamma,
    forecastConclusion: parsed.forecastConclusion,
    valueFormat,
    hasMixedFormat: mixed,
    rawAlpha: parsed.rawAlpha,
    rawBeta: parsed.rawBeta,
    rawGamma: parsed.rawGamma,
    createdAt: now,
    lastModifiedAt: now,
    lastModifiedBy: 'import',
    source: existingVersion === 0 ? 'original' : 'overwritten',
    version: existingVersion + 1,
    nextOwner: mixed ? '活动负责人' : undefined,
    changeReason: existingVersion > 0 ? '重复导入覆盖' : undefined,
  };
};

export const getParameterTables = async (): Promise<ParameterTable[]> => {
  const data = await readJSONFile<{ tables: ParameterTable[]; records: ParameterRecord[] }>('parameters.json', {
    tables: [],
    records: [],
  });
  return data.tables;
};

export const getParameterRecords = async (): Promise<ParameterRecord[]> => {
  const data = await readJSONFile<{ tables: ParameterTable[]; records: ParameterRecord[] }>('parameters.json', {
    tables: [],
    records: [],
  });
  return data.records;
};

export const getLatestParameterRecords = async (): Promise<ParameterRecord[]> => {
  const all = await getParameterRecords();
  const latest = new Map<string, ParameterRecord>();
  for (const r of all) {
    const exist = latest.get(r.productId);
    if (!exist || r.version > exist.version) latest.set(r.productId, r);
  }
  return [...latest.values()];
};

export const saveParameterTable = async (table: ParameterTable, records: ParameterRecord[]): Promise<void> => {
  const data = await readJSONFile<{ tables: ParameterTable[]; records: ParameterRecord[] }>('parameters.json', {
    tables: [],
    records: [],
  });
  data.tables.push(table);
  data.records.push(...records);
  await writeJSONFile('parameters.json', data);
};

export const upsertParsedRows = async (
  parsedRows: ParsedParameterRow[],
  options: {
    importedBy: string;
    fileName?: string;
    strategy?: UpsertStrategy;
    source?: 'upload' | 'manual' | 'demo';
  }
): Promise<{ table: ParameterTable; records: ParameterRecord[]; result: UpsertResult }> => {
  const strategy = options.strategy ?? 'overwrite';
  const source = options.source ?? 'upload';

  const existingAll = await getParameterRecords();
  const existingLatest = new Map<string, ParameterRecord>();
  for (const r of existingAll) {
    const e = existingLatest.get(r.productId);
    if (!e || r.version > e.version) existingLatest.set(r.productId, r);
  }

  const metadata = await getMetadata();
  const batchNum = metadata.importBatchCounter + 1;
  const batchId = `BATCH-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(batchNum).padStart(3, '0')}`;
  const tableId = makeId('tbl');

  const table: ParameterTable = {
    id: tableId,
    importBatch: batchId,
    version: `v${Math.ceil(batchNum / 10)}.${batchNum % 10}`,
    importTime: new Date().toISOString(),
    importedBy: options.importedBy,
    strategy,
    source,
    fileName: options.fileName,
  };

  const savedRecords: ParameterRecord[] = [];
  const duplicateProductIds: string[] = [];
  const overwrittenProductIds: string[] = [];
  const skippedProductIds: string[] = [];
  const mixedProductIds: string[] = [];
  let importedCount = 0;

  for (const row of parsedRows) {
    if (!row.productId) continue;
    const exist = existingLatest.get(row.productId);
    const existVersion = exist ? exist.version : 0;

    if (exist) {
      duplicateProductIds.push(row.productId);
      if (strategy === 'skip') {
        skippedProductIds.push(row.productId);
        continue;
      }
      if (strategy === 'overwrite') {
        overwrittenProductIds.push(row.productId);
        const built = buildRecord(row, tableId, existVersion);
        built.previousValues = {
          rawAlpha: exist.rawAlpha,
          rawBeta: exist.rawBeta,
          rawGamma: exist.rawGamma,
          forecastConclusion: exist.forecastConclusion,
          version: exist.version,
          source: exist.source,
          changeReason: exist.changeReason,
          previousValues: exist.previousValues as ParameterRecord['previousValues'],
        };
        built.source = 'overwritten';
        built.lastModifiedBy = options.importedBy;
        built.changeReason = '重复导入覆盖';
        savedRecords.push(built);
        importedCount++;
      } else {
        // append 策略：允许同名产品多条，保存新版本
        const built = buildRecord(row, tableId, existVersion);
        built.previousValues = {
          rawAlpha: exist.rawAlpha,
          rawBeta: exist.rawBeta,
          rawGamma: exist.rawGamma,
          forecastConclusion: exist.forecastConclusion,
          version: exist.version,
          source: exist.source,
          changeReason: exist.changeReason,
          previousValues: exist.previousValues as ParameterRecord['previousValues'],
        };
        built.source = 'overwritten';
        built.changeReason = '重复导入追加';
        savedRecords.push(built);
        importedCount++;
      }
    } else {
      savedRecords.push(buildRecord(row, tableId, 0));
      importedCount++;
    }

    const latest = savedRecords[savedRecords.length - 1];
    if (latest.hasMixedFormat) mixedProductIds.push(latest.productId);
  }

  // 更新 Metadata 计数
  const nextMeta = {
    ...metadata,
    importBatchCounter: batchNum,
    totalImportCount: metadata.totalImportCount + 1,
  };
  await writeJSONFile('metadata.json', nextMeta);

  // 写参数文件（追加：旧 records + 新 savedRecords；新 table 加入 tables）
  const data = await readJSONFile<{ tables: ParameterTable[]; records: ParameterRecord[] }>('parameters.json', {
    tables: [],
    records: [],
  });
  data.tables.push(table);
  data.records.push(...savedRecords);
  await writeJSONFile('parameters.json', data);

  const result: UpsertResult = {
    importedCount,
    duplicateCount: duplicateProductIds.length,
    overwrittenCount: overwrittenProductIds.length,
    skippedCount: skippedProductIds.length,
    duplicateProductIds,
    overwrittenProductIds,
    skippedProductIds,
    mixedProductIds,
  };

  // 写 AuditLog
  const audit: AuditLogEntry = {
    id: makeId('audit'),
    action: 'parameter.import',
    actor: options.importedBy,
    timestamp: new Date().toISOString(),
    productIds: savedRecords.map(r => r.productId),
    summary: `参数导入批次 ${batchId}，成功 ${importedCount}，重复 ${duplicateProductIds.length}${overwrittenProductIds.length ? ` 覆盖 ${overwrittenProductIds.length}` : ''}${skippedProductIds.length ? ` 跳过 ${skippedProductIds.length}` : ''}，混合格式 ${mixedProductIds.length}`,
    before: { strategy, fileName: options.fileName ?? '' },
    after: { batchId, tableId, counts: result },
    batchId,
    nextOwner: mixedProductIds.length ? '活动负责人（复核混合格式）' : undefined,
    reason: '用户上传参数调试表',
  };
  await appendAuditLog(audit);

  // 重复/覆盖单独写 1 条 audit 方便追溯
  for (const pid of overwrittenProductIds) {
    await appendAuditLog({
      id: makeId('audit'),
      action: 'parameter.overwritten_duplicate',
      actor: options.importedBy,
      timestamp: new Date().toISOString(),
      productIds: [pid],
      summary: `${pid} 重复导入，执行覆盖`,
      before: { oldVersion: existingLatest.get(pid)?.version ?? 0 },
      after: { newVersion: savedRecords.find(r => r.productId === pid)?.version, batchId },
      batchId,
      nextOwner: savedRecords.find(r => r.productId === pid)?.hasMixedFormat ? '活动负责人' : undefined,
    });
  }
  for (const pid of skippedProductIds) {
    await appendAuditLog({
      id: makeId('audit'),
      action: 'parameter.skipped_duplicate',
      actor: options.importedBy,
      timestamp: new Date().toISOString(),
      productIds: [pid],
      summary: `${pid} 重复导入，执行跳过`,
      before: { existingVersion: existingLatest.get(pid)?.version ?? 0 },
      after: { skipped: true, batchId },
      batchId,
    });
  }

  return { table, records: savedRecords, result };
};

export const updateParameterRecord = async (
  update: ParameterUpdateRequest
): Promise<ParameterRecord | null> => {
  const all = await getParameterRecords();
  const latestRecords = new Map<string, ParameterRecord>();
  for (const r of all) {
    const e = latestRecords.get(r.productId);
    if (!e || r.version > e.version) latestRecords.set(r.productId, r);
  }

  const existing = latestRecords.get(update.productId);
  if (!existing) return null;

  const nextRawAlpha = update.rawAlpha !== undefined ? update.rawAlpha : existing.rawAlpha;
  const nextRawBeta = update.rawBeta !== undefined ? update.rawBeta : existing.rawBeta;
  const nextRawGamma = update.rawGamma !== undefined ? update.rawGamma : existing.rawGamma;
  const nextConclusion = update.forecastConclusion !== undefined ? update.forecastConclusion : existing.forecastConclusion;

  const hasPct = (s: string): boolean => typeof s === 'string' && s.endsWith('%');
  const formats = [hasPct(nextRawAlpha), hasPct(nextRawBeta), hasPct(nextRawGamma)];
  const mixed = formats.some(Boolean) && formats.some(f => !f);
  const valueFormat: 'decimal' | 'percentage' | 'mixed' = mixed
    ? 'mixed'
    : formats.some(Boolean)
    ? 'percentage'
    : 'decimal';

  try {
    existing.alpha = parseNumericValue(nextRawAlpha);
    existing.beta = parseNumericValue(nextRawBeta);
    existing.gamma = parseNumericValue(nextRawGamma);
  } catch {
    /* ignore */
  }

  const now = new Date().toISOString();
  const newRecord: ParameterRecord = {
    ...existing,
    id: makeId('rec'),
    tableId: existing.tableId,
    alpha: existing.alpha,
    beta: existing.beta,
    gamma: existing.gamma,
    forecastConclusion: nextConclusion,
    valueFormat,
    hasMixedFormat: mixed,
    rawAlpha: nextRawAlpha,
    rawBeta: nextRawBeta,
    rawGamma: nextRawGamma,
    previousValues: {
      rawAlpha: existing.rawAlpha,
      rawBeta: existing.rawBeta,
      rawGamma: existing.rawGamma,
      forecastConclusion: existing.forecastConclusion,
      version: existing.version,
      source: existing.source,
      changeReason: existing.changeReason,
      previousValues: existing.previousValues as ParameterRecord['previousValues'],
    },
    source: 'corrected',
    changeReason: update.reason,
    lastModifiedAt: now,
    lastModifiedBy: update.operator,
    nextOwner: mixed ? '活动负责人复核' : '数据分析师复核',
    version: existing.version + 1,
    createdAt: existing.createdAt,
  };

  // 追加一条新纪录（保留历史版本）
  const data = await readJSONFile<{ tables: ParameterTable[]; records: ParameterRecord[] }>('parameters.json', {
    tables: [],
    records: [],
  });
  data.records.push(newRecord);
  await writeJSONFile('parameters.json', data);

  // Metadata
  const meta = await getMetadata();
  await writeJSONFile('metadata.json', {
    ...meta,
    totalCorrectionCount: meta.totalCorrectionCount + 1,
  });

  await appendAuditLog({
    id: makeId('audit'),
    action: 'parameter.update',
    actor: update.operator,
    timestamp: now,
    productIds: [update.productId],
    summary: `${update.productId} 参数修正：${update.reason}`,
    before: {
      rawAlpha: existing.rawAlpha,
      rawBeta: existing.rawBeta,
      rawGamma: existing.rawGamma,
      forecastConclusion: existing.forecastConclusion,
      version: existing.version,
    },
    after: {
      rawAlpha: nextRawAlpha,
      rawBeta: nextRawBeta,
      rawGamma: nextRawGamma,
      forecastConclusion: nextConclusion,
      version: newRecord.version,
    },
    reason: update.reason,
    nextOwner: newRecord.nextOwner,
  });

  return newRecord;
};

export const checkDuplicateImport = async (tableId: string, productIds: string[]): Promise<number> => {
  const records = await getParameterRecords();
  const existingProductIds = new Set(
    records.filter(r => r.tableId !== tableId).map(r => r.productId)
  );
  return productIds.filter(id => existingProductIds.has(id)).length;
};

// ==================== 反例相关 ====================

export const getCounterExamples = async (): Promise<CounterExample[]> => {
  const data = await readJSONFile<{ examples: CounterExample[]; records: ExampleRecord[] }>(
    'counterExamples.json',
    { examples: [], records: [] }
  );
  return data.examples;
};

export const getExampleRecords = async (): Promise<ExampleRecord[]> => {
  const data = await readJSONFile<{ examples: CounterExample[]; records: ExampleRecord[] }>(
    'counterExamples.json',
    { examples: [], records: [] }
  );
  return data.records;
};

export const saveCounterExample = async (example: CounterExample, records: ExampleRecord[]): Promise<void> => {
  const data = await readJSONFile<{ examples: CounterExample[]; records: ExampleRecord[] }>(
    'counterExamples.json',
    { examples: [], records: [] }
  );
  data.examples.push(example);
  data.records.push(...records);
  await writeJSONFile('counterExamples.json', data);

  await appendAuditLog({
    id: makeId('audit'),
    action: 'counterexample.import',
    actor: example.submittedBy,
    timestamp: example.submittedTime,
    productIds: records.map(r => r.productId),
    summary: `反例批次 ${example.batch} 导入，共 ${records.length} 条`,
    batchId: example.batch,
    after: { count: records.length, fileName: example.fileName },
    nextOwner: '数据分析师处理冲突',
    reason: '用户补录手算反例',
  });
};

// ==================== 冲突相关 ====================

export const getConflicts = async (): Promise<Conflict[]> => {
  return readJSONFile<Conflict[]>('conflicts.json', []);
};

export const saveConflicts = async (conflicts: Conflict[]): Promise<void> => {
  await writeJSONFile('conflicts.json', conflicts);
};

export const updateConflict = async (id: string, updates: Partial<Conflict>): Promise<Conflict | null> => {
  const conflicts = await getConflicts();
  const index = conflicts.findIndex(c => c.id === id);
  if (index === -1) return null;
  conflicts[index] = { ...conflicts[index], ...updates };
  await saveConflicts(conflicts);
  return conflicts[index];
};

// ==================== 预测结果相关 ====================

export const getForecastResults = async (): Promise<ForecastResult[]> => {
  return readJSONFile<ForecastResult[]>('results.json', []);
};

export const saveForecastResults = async (results: ForecastResult[]): Promise<void> => {
  await writeJSONFile('results.json', results);
  const meta = await getMetadata();
  await writeJSONFile('metadata.json', {
    ...meta,
    lastCalculatedAt: new Date().toISOString(),
    lastCalculationCount: results.length,
    recalculationCount: meta.recalculationCount + 1,
  });
  await appendAuditLog({
    id: makeId('audit'),
    action: 'forecast.calculated',
    actor: '指数平滑模型 v1.0',
    timestamp: new Date().toISOString(),
    productIds: results.map(r => r.productId),
    summary: `预测计算完成，共 ${results.length} 条，待复核 ${results.filter(r => r.reviewStatus === 'pending_review').length} 条`,
    before: { lastCalculatedAt: meta.lastCalculatedAt, count: meta.lastCalculationCount },
    after: { count: results.length, newCalculationVersion: meta.recalculationCount + 1 },
    nextOwner: results.some(r => r.reviewStatus === 'pending_review') ? '活动负责人复核待审核项' : '业务运营查看结果',
  });
};

// ==================== 工作流 ====================

export const getWorkflowState = async (): Promise<WorkflowState | null> => {
  const data = await readJSONFile<Record<string, any>>('workflow.json', {} as Record<string, any>);
  if (!data || Object.keys(data).length === 0) return null;
  return data as WorkflowState;
};

export const saveWorkflowState = async (state: WorkflowState): Promise<void> => {
  await writeJSONFile('workflow.json', state);
};

// ==================== Metadata ====================

const DEFAULT_METADATA: MetadataState = {
  lastExportedAt: null,
  lastExportedCount: null,
  lastExportedHash: null,
  lastCalculatedAt: null,
  lastCalculationCount: null,
  importBatchCounter: 0,
  totalImportCount: 0,
  totalCorrectionCount: 0,
  recalculationCount: 0,
};

export const getMetadata = async (): Promise<MetadataState> => {
  return readJSONFile<MetadataState>('metadata.json', DEFAULT_METADATA);
};

export const updateMetadata = async (patch: Partial<MetadataState>): Promise<MetadataState> => {
  const cur = await getMetadata();
  const next = { ...cur, ...patch };
  await writeJSONFile('metadata.json', next);
  return next;
};

// ==================== Audit Log ====================

export const getAuditLogs = async (): Promise<AuditLogEntry[]> => {
  return readJSONFile<AuditLogEntry[]>('auditLog.json', []);
};

export const appendAuditLog = async (entry: AuditLogEntry): Promise<void> => {
  const cur = await getAuditLogs();
  cur.push(entry);
  await writeJSONFile('auditLog.json', cur);
};

// ==================== 工具：记录导出哈希，用于自检 ====================

export const recordExport = async (count: number, contentHash: string): Promise<void> => {
  const meta = await getMetadata();
  const now = new Date().toISOString();
  await writeJSONFile('metadata.json', {
    ...meta,
    lastExportedAt: now,
    lastExportedCount: count,
    lastExportedHash: contentHash,
  });
  await appendAuditLog({
    id: makeId('audit'),
    action: 'forecast.exported',
    actor: '导出系统',
    timestamp: now,
    productIds: [],
    summary: `预测明细导出完成，共 ${count} 条`,
    before: { lastExportedAt: meta.lastExportedAt, count: meta.lastExportedCount },
    after: { count, hash: contentHash.slice(0, 16) },
  });
};

// ==================== 构建 ImportResult ====================

export const buildImportResult = (
  success: boolean,
  message: string,
  table: ParameterTable,
  upsert: UpsertResult
): ImportResult => {
  return {
    success,
    message,
    importedCount: upsert.importedCount,
    duplicateCount: upsert.duplicateCount,
    mixedFormatCount: upsert.mixedProductIds.length,
    overwrittenCount: upsert.overwrittenCount,
    skippedCount: upsert.skippedCount,
    batchId: table.importBatch,
    tableId: table.id,
    duplicateProductIds: upsert.duplicateProductIds,
    overwrittenProductIds: upsert.overwrittenProductIds,
    skippedProductIds: upsert.skippedProductIds,
    mixedProductIds: upsert.mixedProductIds,
    allProductIds: [...new Set([...upsert.duplicateProductIds, ...upsert.mixedProductIds, ...upsert.overwrittenProductIds, ...upsert.skippedProductIds])],
  };
};

export { makeId };

import * as XLSX from 'xlsx';

type PetCategory = 'reptile' | 'bird' | 'smallMammal' | 'other';

const PET_CATEGORY_LABEL: Record<PetCategory, string> = {
  reptile: '爬行类',
  bird: '鸟类',
  smallMammal: '小型哺乳',
  other: '其他',
};

type WeightUnit = 'kg' | 'g' | '斤' | 'lb';

type AnomalyType =
  | 'weight_unit_mixed'
  | 'duplicate_pet'
  | 'temp_out_of_range'
  | 'missing_data'
  | 'wechat_note_flag';

const ANOMALY_LABEL: Record<AnomalyType, string> = {
  weight_unit_mixed: '体重单位混写',
  duplicate_pet: '疑似同宠异名',
  temp_out_of_range: '温度异常',
  missing_data: '字段缺失',
  wechat_note_flag: '微信备注含特殊标记',
};

type RecordStatus = 'pending' | 'confirmed' | 'anomaly';

const STATUS_LABEL: Record<RecordStatus, string> = {
  pending: '待处理',
  confirmed: '已确认',
  anomaly: '异常',
};

interface JudgmentRecord {
  id: string;
  operator: string;
  originalAnomaly: AnomalyType;
  newStatus: RecordStatus;
  reason: string;
  timestamp: string;
}

interface SupplementaryNote {
  id: string;
  author: string;
  content: string;
  timestamp: string;
}

interface TempControlRecord {
  id: string;
  petName: string;
  petCategory: PetCategory;
  species: string;
  ownerName: string;
  ownerPhone: string;
  ownerWechatNote: string;
  weight: number;
  weightUnit: WeightUnit;
  weightNormalizedKg: number;
  weightUnitAbnormal: boolean;
  temperature: number;
  measureTime: string;
  status: RecordStatus;
  anomalyType: AnomalyType[];
  confirmedBy?: string;
  confirmedAt?: string;
  mergeGroupId?: string;
  aliases?: string[];
  judgments?: JudgmentRecord[];
  supplementaryNotes?: SupplementaryNote[];
}

type ExportField =
  | 'id'
  | 'petName'
  | 'aliases'
  | 'petCategory'
  | 'species'
  | 'ownerName'
  | 'ownerPhone'
  | 'weightRaw'
  | 'weightNormalized'
  | 'weightUnitFlag'
  | 'temperature'
  | 'measureTime'
  | 'status'
  | 'anomalyTags'
  | 'wechatNote'
  | 'judgments'
  | 'supplementaryNotes';

const EXPORT_FIELD_LABEL: Record<ExportField, string> = {
  id: '记录编号',
  petName: '宠物名',
  aliases: '曾用名/别名',
  petCategory: '宠物品类',
  species: '具体品种',
  ownerName: '主人姓名',
  ownerPhone: '联系电话',
  weightRaw: '体重(原始值+单位)',
  weightNormalized: '体重(规范化kg)',
  weightUnitFlag: '体重单位异常标记',
  temperature: '温度(℃)',
  measureTime: '测量时间',
  status: '处理状态',
  anomalyTags: '异常标签',
  wechatNote: '主人微信备注',
  judgments: '人工改判记录',
  supplementaryNotes: '后补说明',
};

interface ExportConfig {
  format: 'xlsx' | 'csv';
  fields: ExportField[];
  normalizeWeight: boolean;
  includeFlagColumns: boolean;
  onlyConfirmed: boolean;
}

const DEFAULT_EXPORT_FIELDS: ExportField[] = [
  'id',
  'petName',
  'aliases',
  'petCategory',
  'species',
  'ownerName',
  'ownerPhone',
  'weightRaw',
  'weightNormalized',
  'weightUnitFlag',
  'temperature',
  'measureTime',
  'status',
  'anomalyTags',
  'wechatNote',
  'judgments',
  'supplementaryNotes',
];

function formatWeightRaw(weight: number, unit: WeightUnit): string {
  return `${weight}${unit}`;
}

function formatAnomalyTags(types: AnomalyType[]): string {
  if (!types || types.length === 0) return '';
  return types.map((t) => ANOMALY_LABEL[t] || t).join('、');
}

function formatJudgments(judgments?: JudgmentRecord[]): string {
  if (!judgments || judgments.length === 0) return '';
  return judgments
    .map(
      (j) =>
        `[${j.timestamp}] ${j.operator} 将「${ANOMALY_LABEL[j.originalAnomaly] || j.originalAnomaly}」改判为「${STATUS_LABEL[j.newStatus]}」\n  原因：${j.reason}`
    )
    .join('\n---\n');
}

function formatSupplementaryNotes(notes?: SupplementaryNote[]): string {
  if (!notes || notes.length === 0) return '';
  return notes
    .map((n) => `[${n.timestamp}] ${n.author}：${n.content}`)
    .join('\n---\n');
}

function formatAliases(aliases?: string[]): string {
  if (!aliases || aliases.length === 0) return '';
  return aliases.join(' / ');
}

function formatWeightUnitFlag(abnormal: boolean): string {
  return abnormal ? '⚠ 单位异常（非标准kg）' : '';
}

function applyFieldMappers(
  record: TempControlRecord,
  fields: ExportField[]
): Record<string, string | number> {
  const row: Record<string, string | number> = {};

  for (const field of fields) {
    const label = EXPORT_FIELD_LABEL[field];
    switch (field) {
      case 'id':
        row[label] = record.id;
        break;
      case 'petName':
        row[label] = record.petName;
        break;
      case 'aliases':
        row[label] = formatAliases(record.aliases);
        break;
      case 'petCategory':
        row[label] = PET_CATEGORY_LABEL[record.petCategory] || record.petCategory;
        break;
      case 'species':
        row[label] = record.species;
        break;
      case 'ownerName':
        row[label] = record.ownerName;
        break;
      case 'ownerPhone':
        row[label] = "'" + record.ownerPhone;
        break;
      case 'weightRaw':
        row[label] = formatWeightRaw(record.weight, record.weightUnit);
        break;
      case 'weightNormalized':
        row[label] = record.weightNormalizedKg;
        break;
      case 'weightUnitFlag':
        row[label] = formatWeightUnitFlag(record.weightUnitAbnormal);
        break;
      case 'temperature':
        row[label] = record.temperature;
        break;
      case 'measureTime':
        row[label] = record.measureTime;
        break;
      case 'status':
        row[label] = STATUS_LABEL[record.status] || record.status;
        break;
      case 'anomalyTags':
        row[label] = formatAnomalyTags(record.anomalyType);
        break;
      case 'wechatNote':
        row[label] = record.ownerWechatNote;
        break;
      case 'judgments':
        row[label] = formatJudgments(record.judgments);
        break;
      case 'supplementaryNotes':
        row[label] = formatSupplementaryNotes(record.supplementaryNotes);
        break;
    }
  }

  return row;
}

export function filterRecordsForExport(
  records: TempControlRecord[],
  config: ExportConfig
): TempControlRecord[] {
  let filtered = records;

  if (config.onlyConfirmed) {
    filtered = filtered.filter((r) => r.status === 'confirmed');
  }

  return filtered;
}

export function buildExportRows(
  records: TempControlRecord[],
  config: ExportConfig
): Array<Record<string, string | number>> {
  const filtered = filterRecordsForExport(records, config);
  let fields = config.fields && config.fields.length > 0
    ? [...config.fields]
    : [...DEFAULT_EXPORT_FIELDS];

  if (!config.includeFlagColumns) {
    fields = fields.filter((f) => f !== 'weightUnitFlag');
  }

  return filtered.map((r) => applyFieldMappers(r, fields));
}

function getColumnOrder(fields: ExportField[], includeFlagColumns: boolean): string[] {
  let fs = fields && fields.length > 0 ? fields : DEFAULT_EXPORT_FIELDS;
  if (!includeFlagColumns) {
    fs = fs.filter((f) => f !== 'weightUnitFlag');
  }
  return fs.map((f) => EXPORT_FIELD_LABEL[f]);
}

function generateFileName(prefix: string, format: 'xlsx' | 'csv'): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `${prefix}_${ts}.${format}`;
}

export function exportToXLSX(
  records: TempControlRecord[],
  config: Omit<ExportConfig, 'format'> & { format?: 'xlsx' },
  fileNamePrefix = '异宠温控记录'
): {
  success: boolean;
  fileName: string;
  blob?: Blob;
  error?: string;
} {
  try {
    const fullConfig: ExportConfig = { format: 'xlsx', ...config };
    const rows = buildExportRows(records, fullConfig);
    const header = getColumnOrder(fullConfig.fields, fullConfig.includeFlagColumns);

    const ws = XLSX.utils.json_to_sheet(rows, { header });

    const colWidths = header.map((h) => {
      let maxLen = h.length * 2;
      for (const row of rows) {
        const val = row[h];
        const len = val !== undefined && val !== null
          ? String(val).split('\n').reduce((acc, line) => Math.max(acc, line.length), 0)
          : 0;
        if (len > maxLen) maxLen = len;
      }
      return { wch: Math.min(Math.max(maxLen + 2, 8), 50) };
    });
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '温控记录');

    const summaryRow: Record<string, string | number> = {};
    summaryRow[header[0]] = '导出统计';
    summaryRow[header[1]] = `共 ${rows.length} 条记录`;
    const anomalyCount = records.filter(
      (r) => r.anomalyType.length > 0 && (!fullConfig.onlyConfirmed || r.status === 'confirmed')
    ).length;
    if (header[2]) summaryRow[header[2]] = `含异常标记 ${anomalyCount} 条`;
    const wsSummary = XLSX.utils.json_to_sheet([summaryRow], { header });
    wsSummary['!cols'] = colWidths;
    XLSX.utils.book_append_sheet(wb, wsSummary, '导出说明');

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const fileName = generateFileName(fileNamePrefix, 'xlsx');
    return { success: true, fileName, blob };
  } catch (e) {
    return {
      success: false,
      fileName: '',
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

function escapeCsvField(value: string | number): string {
  if (value === undefined || value === null) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

export function exportToCSV(
  records: TempControlRecord[],
  config: Omit<ExportConfig, 'format'> & { format?: 'csv' },
  fileNamePrefix = '异宠温控记录'
): {
  success: boolean;
  fileName: string;
  blob?: Blob;
  csvContent?: string;
  error?: string;
} {
  try {
    const fullConfig: ExportConfig = { format: 'csv', ...config };
    const rows = buildExportRows(records, fullConfig);
    const header = getColumnOrder(fullConfig.fields, fullConfig.includeFlagColumns);

    const csvLines: string[] = [];
    csvLines.push(header.map(escapeCsvField).join(','));
    for (const row of rows) {
      csvLines.push(header.map((h) => escapeCsvField(row[h] ?? '')).join(','));
    }

    const csvContent = '\uFEFF' + csvLines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const fileName = generateFileName(fileNamePrefix, 'csv');

    return { success: true, fileName, blob, csvContent };
  } catch (e) {
    return {
      success: false,
      fileName: '',
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export function exportRecords(
  records: TempControlRecord[],
  config: ExportConfig,
  fileNamePrefix = '异宠温控记录'
): {
  success: boolean;
  fileName: string;
  blob?: Blob;
  error?: string;
} {
  if (config.format === 'csv') {
    return exportToCSV(records, config as Parameters<typeof exportToCSV>[1], fileNamePrefix);
  }
  return exportToXLSX(records, config as Parameters<typeof exportToXLSX>[1], fileNamePrefix);
}

export function downloadBlob(blob: Blob, fileName: string): void {
  if (typeof window === 'undefined' || !('URL' in window) || !('document' in window)) {
    return;
  }
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export function performExport(
  records: TempControlRecord[],
  config: ExportConfig,
  fileNamePrefix = '异宠温控记录'
): { success: boolean; error?: string; fileName?: string } {
  const result = exportRecords(records, config, fileNamePrefix);
  if (!result.success || !result.blob) {
    return { success: false, error: result.error };
  }
  downloadBlob(result.blob, result.fileName);
  return { success: true, fileName: result.fileName };
}

export function getExportFieldInfo(): Array<{ key: ExportField; label: string }> {
  return (Object.keys(EXPORT_FIELD_LABEL) as ExportField[]).map((key) => ({
    key,
    label: EXPORT_FIELD_LABEL[key],
  }));
}

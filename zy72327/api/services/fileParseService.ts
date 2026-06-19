import * as XLSX from 'xlsx';
import type { ParsedParameterRow } from '../../shared/types';

const COLUMN_ALIASES: Partial<Record<keyof ParsedParameterRow, string[]>> = {
  productId: ['productid', 'product_id', '商品id', '产品id', '商品编号', '产品编号', 'sku', 'sku码', 'id'],
  productName: ['productname', 'product_name', '商品名称', '产品名称', '商品', '产品', 'name', '名称'],
  rawAlpha: ['alpha', 'α', '平滑系数alpha', '平滑系数α', '指数平滑系数α', '指数平滑系数alpha', 'a系数'],
  rawBeta: ['beta', 'β', '趋势系数beta', '趋势系数β', '平滑系数beta', 'b系数'],
  rawGamma: ['gamma', 'γ', '季节系数gamma', '季节系数γ', '平滑系数gamma', 'g系数'],
  forecastConclusion: ['forecast', 'forecastconclusion', '预测结论', '预测量', '预测值', '预测销量', '销量预测', '结论', '预估销量'],
};

const normalizeKey = (key: string): string => {
  return key
    .toLowerCase()
    .replace(/[\s\u3000_-]/g, '')
    .replace(/[()（）【】\[\]]/g, '');
};

const buildColumnMap = (headers: string[]): Partial<Record<keyof ParsedParameterRow, string>> => {
  const map: Partial<Record<keyof ParsedParameterRow, string>> = {};
  const normalizedHeaders: Record<string, string> = {};
  for (const h of headers) normalizedHeaders[normalizeKey(h)] = h;

  for (const field of Object.keys(COLUMN_ALIASES) as (keyof ParsedParameterRow)[]) {
    const aliases = COLUMN_ALIASES[field].map(a => normalizeKey(a));
    for (const nh of Object.keys(normalizedHeaders)) {
      if (aliases.includes(nh) || nh === aliases[0]) {
        map[field] = normalizedHeaders[nh];
        break;
      }
      for (const alias of aliases) {
        if (nh.includes(alias) && alias.length >= 3) {
          map[field] = normalizedHeaders[nh];
          break;
        }
      }
      if (map[field]) break;
    }
  }
  return map;
};

const toStr = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  const s = String(v).trim();
  if (s.endsWith('.0')) return s.slice(0, -2);
  return s;
};

const detectNumberFormat = (raw: string): { value: string; format: 'percentage' | 'decimal' } => {
  if (!raw) return { value: '', format: 'decimal' };
  if (raw.endsWith('%')) {
    return { value: raw, format: 'percentage' };
  }
  const num = parseFloat(raw);
  if (!isNaN(num) && num <= 1 && num >= 0) {
    return { value: raw, format: 'decimal' };
  }
  return { value: raw, format: 'decimal' };
};

const parseRowsToRecords = (
  rows: Array<Record<string, unknown>>,
  originalFile: string
): { rows: ParsedParameterRow[]; parseErrors: string[] } => {
  if (rows.length === 0) return { rows: [], parseErrors: [`${originalFile} 没有数据行`] };
  const headers = Object.keys(rows[0]);
  const colMap = buildColumnMap(headers);
  const parseErrors: string[] = [];

  const required: (keyof ParsedParameterRow)[] = ['productId', 'rawAlpha', 'rawBeta', 'rawGamma'];
  const missing = required.filter(f => !colMap[f]);
  if (missing.length > 0) {
    parseErrors.push(`缺少必需列：${missing.join('、')}。检测到的表头：${headers.join(' | ')}`);
    return { rows: [], parseErrors };
  }

  const parsedRows: ParsedParameterRow[] = [];
  rows.forEach((row, i) => {
    const idx = i + 2;
    const errors: string[] = [];

    const productId = toStr(row[colMap.productId!]).trim();
    const productName = colMap.productName ? toStr(row[colMap.productName]).trim() : productId;
    const rawAlpha = toStr(row[colMap.rawAlpha!]).trim();
    const rawBeta = toStr(row[colMap.rawBeta!]).trim();
    const rawGamma = toStr(row[colMap.rawGamma!]).trim();
    const forecastConclusion = colMap.forecastConclusion
      ? toStr(row[colMap.forecastConclusion]).trim()
      : '';

    if (!productId) errors.push(`第 ${idx} 行：productId 为空`);
    if (!rawAlpha || isNaN(parseFloat(rawAlpha.replace('%', '')))) errors.push(`第 ${idx} 行：alpha 不是数字：${rawAlpha}`);
    if (!rawBeta || isNaN(parseFloat(rawBeta.replace('%', '')))) errors.push(`第 ${idx} 行：beta 不是数字：${rawBeta}`);
    if (!rawGamma || isNaN(parseFloat(rawGamma.replace('%', '')))) errors.push(`第 ${idx} 行：gamma 不是数字：${rawGamma}`);

    parsedRows.push({
      productId,
      productName: productName || productId,
      rawAlpha: detectNumberFormat(rawAlpha).value,
      rawBeta: detectNumberFormat(rawBeta).value,
      rawGamma: detectNumberFormat(rawGamma).value,
      forecastConclusion,
      parseErrors: errors.length > 0 ? errors : undefined,
    });
  });

  return { rows: parsedRows.filter(r => !r.parseErrors), parseErrors: parseErrors.concat(parsedRows.flatMap(r => r.parseErrors || [])) };
};

export const parseParameterFile = async (
  buffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<{ rows: ParsedParameterRow[]; parseErrors: string[] }> => {
  const ext = originalName.split('.').pop()?.toLowerCase();
  const rows: Array<Record<string, unknown>> = [];

  if (ext === 'csv' || mimeType.includes('csv')) {
    const text = new TextDecoder('utf-8').decode(buffer).replace(/^\uFEFF/, '');
    const wb = XLSX.read(text, { type: 'string' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows.push(...(XLSX.utils.sheet_to_json(ws, { defval: '', raw: false }) as Array<Record<string, unknown>>));
  } else if (ext === 'xlsx' || ext === 'xls' || mimeType.includes('sheet')) {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows.push(...(XLSX.utils.sheet_to_json(ws, { defval: '', raw: false }) as Array<Record<string, unknown>>));
  } else {
    return { rows: [], parseErrors: [`不支持的文件类型：${originalName}（仅支持 .csv/.xlsx/.xls）`] };
  }

  return parseRowsToRecords(rows, originalName);
};

const COUNTER_ALIASES: Record<'productId' | 'productName' | 'manualCalculation' | 'reasoning', string[]> = {
  productId: ['productid', 'product_id', '商品id', '产品id', '商品编号', '产品编号', 'sku', 'sku码', 'id'],
  productName: ['productname', 'product_name', '商品名称', '产品名称', '商品', '产品', 'name', '名称'],
  manualCalculation: ['manualcalculation', 'manual_calculation', '手算值', '手算结论', '手算反例', '修正值', '修正结论', '反例值', '人工计算'],
  reasoning: ['reason', 'reasoning', '理由', '原因', '说明', '备注', '计算依据', '修正理由'],
};

export const parseCounterExampleFile = async (
  buffer: Buffer,
  originalName: string,
  _mimeType: string
): Promise<{ rows: Array<{ productId: string; productName: string; manualCalculation: number; reasoning: string; parseErrors?: string[] }>; parseErrors: string[] }> => {
  const ext = originalName.split('.').pop()?.toLowerCase();
  const rows: Array<Record<string, unknown>> = [];

  if (ext === 'csv' || ext === 'xlsx' || ext === 'xls') {
    let wb;
    if (ext === 'csv') {
      const text = new TextDecoder('utf-8').decode(buffer).replace(/^\uFEFF/, '');
      wb = XLSX.read(text, { type: 'string' });
    } else {
      wb = XLSX.read(buffer, { type: 'buffer' });
    }
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows.push(...(XLSX.utils.sheet_to_json(ws, { defval: '', raw: false }) as Array<Record<string, unknown>>));
  }
  if (rows.length === 0) return { rows: [], parseErrors: ['反例文件没有数据'] };

  const headers = Object.keys(rows[0]);
  const normalized: Record<string, string> = {};
  for (const h of headers) normalized[normalizeKey(h)] = h;

  const colMap: Partial<Record<'productId' | 'productName' | 'manualCalculation' | 'reasoning', string>> = {};
  for (const field of Object.keys(COUNTER_ALIASES) as Array<'productId' | 'productName' | 'manualCalculation' | 'reasoning'>) {
    const aliases = COUNTER_ALIASES[field].map(a => normalizeKey(a));
    for (const nh of Object.keys(normalized)) {
      if (aliases.includes(nh)) {
        colMap[field] = normalized[nh];
        break;
      }
      for (const alias of aliases) {
        if (alias.length >= 3 && nh.includes(alias)) {
          colMap[field] = normalized[nh];
          break;
        }
      }
      if (colMap[field]) break;
    }
  }

  const required = ['productId', 'manualCalculation'] as const;
  const missing = required.filter(f => !colMap[f]);
  if (missing.length > 0) return { rows: [], parseErrors: [`缺少必需列：${missing.join('、')}，检测到的表头：${headers.join('|')}`] };

  const parsed = rows.map((row, i) => {
    const idx = i + 2;
    const errors: string[] = [];
    const productId = toStr(row[colMap.productId!]).trim();
    const productName = colMap.productName ? toStr(row[colMap.productName]).trim() : productId;
    const rawVal = toStr(row[colMap.manualCalculation!]).trim();
    const val = parseFloat(rawVal);
    const reasoning = colMap.reasoning ? toStr(row[colMap.reasoning]).trim() : '';
    if (!productId) errors.push(`第 ${idx} 行：productId 为空`);
    if (isNaN(val) || val < 0) errors.push(`第 ${idx} 行：手算值 ${rawVal} 无效`);
    return { productId, productName: productName || productId, manualCalculation: val, reasoning, parseErrors: errors.length > 0 ? errors : undefined };
  });

  return { rows: parsed.filter(r => !r.parseErrors), parseErrors: parsed.flatMap(r => r.parseErrors || []) };
};

export const buildSampleParameterCsv = (): string => {
  return [
    '产品ID,产品名称,alpha,beta,gamma,预测量,备注',
    'REAL-001,夏季短袖T恤,0.3,0.2,0.1,1200,基准款',
    'REAL-002,防晒遮阳帽,0.5,0.3,0.2,850,季节款',
    'REAL-003,运动凉鞋,70%,0.4,25%,650,混合格式-重点复核',
    'REAL-004,冰丝防晒衣,0.6,0.4,0.3,2100,季节款',
    'REAL-005,速干运动短裤,0.4,0.25,0.15,980,常规款',
  ].join('\n');
};

export const buildSampleCounterCsv = (): string => {
  return [
    '产品ID,产品名称,手算反例,理由',
    'REAL-002,防晒遮阳帽,1050,618活动促销权重加成，历史同期+23%，应更高',
    'REAL-004,冰丝防晒衣,1750,气温升高不及预期，消费者购买周期前移',
    'REAL-001,夏季短袖T恤,1220,新款式预售订单+20件',
  ].join('\n');
};

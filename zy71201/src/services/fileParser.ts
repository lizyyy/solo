import * as XLSX from 'xlsx';
import type { Product, NetValue, Valuation, Redemption, Anomaly, AnomalyType } from '../types';

export type FileCategory = 'netvalue' | 'valuation' | 'redemption' | 'warning' | 'unknown';

export interface ParsedResult<T> {
  success: boolean;
  data: T[];
  errors: string[];
  warnings: string[];
  rawData?: Record<string, unknown>[];
}

export interface ImportPreview {
  category: FileCategory;
  fileName: string;
  recordCount: number;
  sampleData: Record<string, unknown>[];
  detectedColumns: string[];
  affectedProducts: string[];
  anomalies: Anomaly[];
}

const COLUMN_MAPPINGS: Record<FileCategory, Record<string, string[]>> = {
  netvalue: {
    productCode: ['产品代码', '基金代码', '代码', 'productCode', 'code'],
    productName: ['产品名称', '基金名称', '名称', 'productName', 'name'],
    valueDate: ['净值日期', '日期', 'valueDate', 'date'],
    netValue: ['单位净值', '净值', 'netValue', 'nav'],
    accumulatedValue: ['累计净值', 'accumulatedValue', 'accumNav'],
    drawdownRate: ['回撤率', '回撤', 'drawdown', 'drawdownRate'],
  },
  valuation: {
    productCode: ['产品代码', '基金代码', '代码', 'productCode', 'code'],
    valuationDate: ['估值日期', '日期', 'valuationDate', 'date'],
    holdingName: ['持仓名称', '证券名称', '标的名称', 'holdingName', 'name'],
    holdingRatio: ['持仓占比', '占比', '比例', 'holdingRatio', 'ratio'],
    marketValue: ['市值', '持仓市值', 'marketValue', 'value'],
  },
  redemption: {
    productCode: ['产品代码', '基金代码', '代码', 'productCode', 'code'],
    effectiveDate: ['生效日期', '日期', 'effectiveDate', 'date'],
    status: ['申赎状态', '状态', 'status', 'redeemStatus'],
    restrictionType: ['限制类型', '限制', 'restrictionType'],
    description: ['说明', '备注', 'description', 'remark'],
  },
  warning: {
    productCode: ['产品代码', '基金代码', '代码', 'productCode', 'code'],
    productName: ['产品名称', '基金名称', '名称', 'productName', 'name'],
    effectiveDate: ['生效日期', '日期', 'effectiveDate', 'date'],
    warningLine: ['预警线', '预警', 'warningLine'],
    stopLossLine: ['止损线', '止损', 'stopLossLine'],
  },
  unknown: {},
};

export function detectFileCategory(headers: string[]): FileCategory {
  const headerStr = headers.join(',').toLowerCase();
  
  if (headerStr.includes('净值') || headerStr.includes('nav') || headerStr.includes('netvalue')) {
    return 'netvalue';
  }
  if (headerStr.includes('估值') || headerStr.includes('持仓') || headerStr.includes('市值')) {
    return 'valuation';
  }
  if (headerStr.includes('申赎') || headerStr.includes('赎回') || headerStr.includes('redemption')) {
    return 'redemption';
  }
  if (headerStr.includes('预警') || headerStr.includes('止损') || headerStr.includes('warning')) {
    return 'warning';
  }
  
  return 'unknown';
}

export function findColumnValue(
  row: Record<string, unknown>,
  fieldAliases: string[]
): string | number | undefined {
  for (const alias of fieldAliases) {
    if (row[alias] !== undefined && row[alias] !== null && row[alias] !== '') {
      return row[alias] as string | number;
    }
    const lowerAlias = alias.toLowerCase();
    for (const key of Object.keys(row)) {
      if (key.toLowerCase() === lowerAlias) {
        return row[key] as string | number;
      }
    }
  }
  return undefined;
}

export function parseDate(value: unknown): string {
  if (!value) return '';
  
  if (typeof value === 'string') {
    return value;
  }
  
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
    }
  }
  
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  
  return String(value);
}

export function parseNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;
  const str = String(value).replace(/[^0-9.-]/g, '');
  return parseFloat(str) || 0;
}

export async function parseExcelFile(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
        resolve(jsonData as Record<string, unknown>[]);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsBinaryString(file);
  });
}

export async function parseNetValueFile(
  rawData: Record<string, unknown>[]
): Promise<ParsedResult<NetValue>> {
  const mappings = COLUMN_MAPPINGS.netvalue;
  const data: NetValue[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  
  rawData.forEach((row, index) => {
    const productCode = findColumnValue(row, mappings.productCode);
    
    if (!productCode) {
      warnings.push(`第${index + 2}行：缺少产品代码，已跳过`);
      return;
    }
    
    const valueDate = parseDate(findColumnValue(row, mappings.valueDate));
    const netValue = parseNumber(findColumnValue(row, mappings.netValue));
    const accumulatedValue = parseNumber(findColumnValue(row, mappings.accumulatedValue));
    const drawdownRate = parseNumber(findColumnValue(row, mappings.drawdownRate));
    
    if (!valueDate) {
      warnings.push(`第${index + 2}行：产品${productCode}缺少净值日期`);
    }
    
    if (netValue === 0) {
      warnings.push(`第${index + 2}行：产品${productCode}净值数据可能缺失`);
    }
    
    data.push({
      id: `nv-${productCode}-${valueDate || index}`,
      productId: String(productCode),
      valueDate,
      netValue,
      accumulatedValue: accumulatedValue || netValue,
      drawdownRate,
      source: '导入',
    });
  });
  
  return {
    success: errors.length === 0,
    data,
    errors,
    warnings,
    rawData,
  };
}

export async function parseRedemptionFile(
  rawData: Record<string, unknown>[]
): Promise<ParsedResult<Redemption>> {
  const mappings = COLUMN_MAPPINGS.redemption;
  const data: Redemption[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  
  rawData.forEach((row, index) => {
    const productCode = findColumnValue(row, mappings.productCode);
    
    if (!productCode) {
      warnings.push(`第${index + 2}行：缺少产品代码，已跳过`);
      return;
    }
    
    const statusValue = String(findColumnValue(row, mappings.status) || '').toLowerCase();
    let status: Redemption['status'] = 'normal';
    if (statusValue.includes('暂停') || statusValue.includes('停止') || statusValue.includes('suspend')) {
      status = 'suspended';
    } else if (statusValue.includes('限制') || statusValue.includes('restrict')) {
      status = 'restricted';
    }
    
    data.push({
      id: `r-${productCode}`,
      productId: String(productCode),
      effectiveDate: parseDate(findColumnValue(row, mappings.effectiveDate)),
      status,
      restrictionType: String(findColumnValue(row, mappings.restrictionType) || ''),
      description: String(findColumnValue(row, mappings.description) || ''),
      source: '导入',
    });
  });
  
  return {
    success: errors.length === 0,
    data,
    errors,
    warnings,
    rawData,
  };
}

export async function parseValuationFile(
  rawData: Record<string, unknown>[]
): Promise<ParsedResult<Valuation>> {
  const mappings = COLUMN_MAPPINGS.valuation;
  const data: Valuation[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  
  rawData.forEach((row, index) => {
    const productCode = findColumnValue(row, mappings.productCode);
    
    if (!productCode) {
      warnings.push(`第${index + 2}行：缺少产品代码，已跳过`);
      return;
    }
    
    const holdingName = String(findColumnValue(row, mappings.holdingName) || '');
    const valuationDate = parseDate(findColumnValue(row, mappings.valuationDate));
    
    if (!holdingName) {
      warnings.push(`第${index + 2}行：产品${productCode}缺少持仓名称`);
    }
    
    if (!valuationDate) {
      warnings.push(`第${index + 2}行：产品${productCode}缺少估值日期`);
    }
    
    data.push({
      id: `val-${productCode}-${valuationDate || index}-${holdingName || index}`,
      productId: String(productCode),
      valuationDate,
      holdingName,
      holdingRatio: parseNumber(findColumnValue(row, mappings.holdingRatio)),
      marketValue: parseNumber(findColumnValue(row, mappings.marketValue)),
      source: '导入',
    });
  });
  
  return {
    success: errors.length === 0,
    data,
    errors,
    warnings,
    rawData,
  };
}

export async function parseWarningLineFile(
  rawData: Record<string, unknown>[]
): Promise<ParsedResult<{ productCode: string; warningLine: number; stopLossLine: number; effectiveDate: string }>> {
  const mappings = COLUMN_MAPPINGS.warning;
  const data: Array<{ productCode: string; warningLine: number; stopLossLine: number; effectiveDate: string }> = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  
  rawData.forEach((row, index) => {
    const productCode = findColumnValue(row, mappings.productCode);
    
    if (!productCode) {
      warnings.push(`第${index + 2}行：缺少产品代码，已跳过`);
      return;
    }
    
    data.push({
      productCode: String(productCode),
      warningLine: parseNumber(findColumnValue(row, mappings.warningLine)),
      stopLossLine: parseNumber(findColumnValue(row, mappings.stopLossLine)),
      effectiveDate: parseDate(findColumnValue(row, mappings.effectiveDate)),
    });
  });
  
  return {
    success: errors.length === 0,
    data,
    errors,
    warnings,
    rawData,
  };
}

export function detectAnomalies(
  netValues: NetValue[],
  oldWarningLine?: number,
  newWarningLine?: number,
  redemptionStatus?: string,
  valuationDate?: string,
  netValueDate?: string
): Anomaly[] {
  const anomalies: Anomaly[] = [];
  
  if (oldWarningLine !== undefined && newWarningLine !== undefined && oldWarningLine !== newWarningLine) {
    anomalies.push({
      type: 'warning_line_changed',
      description: `预警线从${oldWarningLine}调整为${newWarningLine}`,
      level: 'medium',
      detectedAt: new Date().toISOString(),
    });
  }
  
  if (redemptionStatus === 'suspended') {
    anomalies.push({
      type: 'redemption_suspended',
      description: '产品处于暂停赎回状态',
      level: 'high',
      detectedAt: new Date().toISOString(),
    });
  }
  
  if (valuationDate && netValueDate && valuationDate !== netValueDate) {
    anomalies.push({
      type: 'date_mismatch',
      description: `估值日期(${valuationDate})与净值日期(${netValueDate})不一致`,
      level: 'high',
      detectedAt: new Date().toISOString(),
    });
  }
  
  return anomalies;
}

export async function analyzeFile(file: File): Promise<ImportPreview> {
  const rawData = await parseExcelFile(file);
  const headers = rawData.length > 0 ? Object.keys(rawData[0]) : [];
  const category = detectFileCategory(headers);
  
  const productCodes = new Set<string>();
  const mappings = COLUMN_MAPPINGS[category];
  
  rawData.forEach((row) => {
    const code = findColumnValue(row, mappings.productCode || ['产品代码', 'code']);
    if (code) productCodes.add(String(code));
  });
  
  const anomalies: Anomaly[] = [];
  
  if (category === 'unknown') {
    anomalies.push({
      type: 'date_mismatch',
      description: '无法自动识别文件类型，请手动确认',
      level: 'medium',
      detectedAt: new Date().toISOString(),
    });
  }
  
  return {
    category,
    fileName: file.name,
    recordCount: rawData.length,
    sampleData: rawData.slice(0, 5),
    detectedColumns: headers,
    affectedProducts: Array.from(productCodes),
    anomalies,
  };
}

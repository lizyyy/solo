import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { OrderBookSnapshot, PriceLevel, TradeRecord } from '../types/data';
import { Anomaly, AnomalyType } from '../types/anomaly';

interface ColumnMapping {
  timestamp: string[];
  symbol: string[];
  lastPrice: string[];
  volume: string[];
  openInterest: string[];
  bidPrice: string[];
  bidQuantity: string[];
  askPrice: string[];
  askQuantity: string[];
  tradePrice: string[];
  tradeQuantity: string[];
  tradeDirection: string[];
  tradeTime: string[];
}

const COLUMN_PATTERNS: ColumnMapping = {
  timestamp: ['时间', 'timestamp', 'time', '日期时间', '时刻', '快照时间'],
  symbol: ['合约', '代码', 'symbol', '品种', 'instrument', '标的'],
  lastPrice: ['最新价', '成交价', 'lastPrice', 'price', '现价', '结算价'],
  volume: ['成交量', 'volume', 'vol', '总量', '成交额'],
  openInterest: ['持仓量', 'openInterest', 'oi', '持仓', '未平仓'],
  bidPrice: ['买', 'bid', '买入', '买价', 'bidPrice', '买一', '买二', '买三', '买四', '买五'],
  bidQuantity: ['买量', 'bidQty', 'bidQuantity', '买入量', '买一量', '买二量'],
  askPrice: ['卖', 'ask', '卖出', '卖价', 'askPrice', '卖一', '卖二', '卖三', '卖四', '卖五'],
  askQuantity: ['卖量', 'askQty', 'askQuantity', '卖出量', '卖一量', '卖二量'],
  tradePrice: ['成交价', 'tradePrice', '成交价格', '执行价'],
  tradeQuantity: ['成交量', 'tradeQty', 'tradeQuantity', '成交手数'],
  tradeDirection: ['方向', 'direction', '买卖方向', 'tradeDirection', '多空'],
  tradeTime: ['成交时间', 'tradeTime', '成交时刻'],
};

function fuzzyMatch(columnName: string, patterns: string[]): boolean {
  const lowerName = columnName.toLowerCase().replace(/[\s_\-()（）]/g, '');
  return patterns.some(pattern => 
    lowerName.includes(pattern.toLowerCase().replace(/[\s_\-()（）]/g, ''))
  );
}

function detectColumnMapping(headers: string[]): Partial<Record<keyof ColumnMapping, string[]>> {
  const mapping: Partial<Record<keyof ColumnMapping, string[]>> = {};
  
  Object.entries(COLUMN_PATTERNS).forEach(([key, patterns]) => {
    const matches = headers.filter(header => fuzzyMatch(header, patterns));
    if (matches.length > 0) {
      mapping[key as keyof ColumnMapping] = matches;
    }
  });
  
  return mapping;
}

function extractLevelNumber(columnName: string): number | null {
  const match = columnName.match(/(\d+)/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value === 'number') {
    return isNaN(value) ? null : value;
  }
  if (typeof value === 'string') {
    const cleaned = value.replace(/[,\s%]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

function parseTimestamp(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number') {
    return value > 9999999999 ? value : value * 1000;
  }
  if (typeof value === 'string') {
    let parsed = Date.parse(value);
    if (!isNaN(parsed)) {
      return parsed;
    }
    const num = parseFloat(value);
    if (!isNaN(num)) {
      return num > 9999999999 ? num : num * 1000;
    }
  }
  return null;
}

function expandMergedCells(data: unknown[][]): unknown[][] {
  const expanded: unknown[][] = [];
  let lastValues: unknown[] = [];
  
  data.forEach(row => {
    const expandedRow: unknown[] = [];
    row.forEach((cell, colIndex) => {
      if (cell === null || cell === undefined || cell === '') {
        expandedRow.push(lastValues[colIndex] ?? null);
      } else {
        expandedRow.push(cell);
        lastValues[colIndex] = cell;
      }
    });
    expanded.push(expandedRow);
  });
  
  return expanded;
}

interface ParseResult {
  snapshots: OrderBookSnapshot[];
  anomalies: Anomaly[];
  warnings: string[];
}

export function parseExcelFile(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const result = parseWorkbook(workbook);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export function parseCSVFile(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: false,
      complete: (results) => {
        try {
          const data = results.data as unknown[][];
          const result = parseRawData(data);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      },
      error: reject,
    });
  });
}

function parseWorkbook(workbook: XLSX.WorkBook): ParseResult {
  const snapshots: OrderBookSnapshot[] = [];
  const anomalies: Anomaly[] = [];
  const warnings: string[] = [];
  
  workbook.SheetNames.forEach(sheetName => {
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1, 
      raw: true,
      defval: null,
    }) as unknown[][];
    
    if (data.length > 0) {
      const sheetResult = parseRawData(data, sheetName);
      snapshots.push(...sheetResult.snapshots);
      anomalies.push(...sheetResult.anomalies);
      warnings.push(...sheetResult.warnings);
    }
  });
  
  return { snapshots, anomalies, warnings };
}

function parseRawData(data: unknown[][], sheetName?: string): ParseResult {
  const snapshots: OrderBookSnapshot[] = [];
  const anomalies: Anomaly[] = [];
  const warnings: string[] = [];
  
  if (data.length < 2) {
    return { snapshots, anomalies, warnings: ['数据行数不足'] };
  }
  
  const expandedData = expandMergedCells(data);
  
  const headerRow = expandedData[0].map(String);
  const mapping = detectColumnMapping(headerRow);
  
  warnings.push(`Sheet: ${sheetName || 'default'}, 识别列: ${Object.keys(mapping).join(', ')}`);
  
  const bidPriceColumns = (mapping.bidPrice || []).sort((a, b) => {
    const levelA = extractLevelNumber(a) ?? 99;
    const levelB = extractLevelNumber(b) ?? 99;
    return levelA - levelB;
  });
  
  const bidQtyColumns = (mapping.bidQuantity || []).sort((a, b) => {
    const levelA = extractLevelNumber(a) ?? 99;
    const levelB = extractLevelNumber(b) ?? 99;
    return levelA - levelB;
  });
  
  const askPriceColumns = (mapping.askPrice || []).sort((a, b) => {
    const levelA = extractLevelNumber(a) ?? 99;
    const levelB = extractLevelNumber(b) ?? 99;
    return levelA - levelB;
  });
  
  const askQtyColumns = (mapping.askQuantity || []).sort((a, b) => {
    const levelA = extractLevelNumber(a) ?? 99;
    const levelB = extractLevelNumber(b) ?? 99;
    return levelA - levelB;
  });
  
  const colIndexMap: Record<string, number> = {};
  headerRow.forEach((header, idx) => {
    colIndexMap[header] = idx;
  });
  
  let nullValueCount = 0;
  let duplicateCount = 0;
  const seenTimestamps = new Map<string, number>();
  
  for (let rowIdx = 1; rowIdx < expandedData.length; rowIdx++) {
    const row = expandedData[rowIdx];
    
    const timestampCol = mapping.timestamp?.[0];
    const timestamp = timestampCol ? parseTimestamp(row[colIndexMap[timestampCol]]) : null;
    
    if (timestamp === null) {
      nullValueCount++;
      anomalies.push({
        id: `anomaly-null-${Date.now()}-${rowIdx}`,
        type: 'null_value',
        severity: 2,
        description: `第${rowIdx + 1}行时间戳为空或无法解析`,
        impact: ANOMALY_IMPACTS.null_value,
        recommendation: ANOMALY_RECOMMENDATIONS.null_value,
        dataPoint: { timestamp: undefined, level: undefined },
        detectedAt: Date.now(),
        snapshotIndex: rowIdx,
        timestamp: Date.now(),
        level: 0,
        side: 'both',
        suggestions: ['检查时间戳格式', '验证列名映射配置', '使用前后行插值填充'],
        rawData: { row: rowIdx + 1, sheet: sheetName, rawValue: timestampCol ? row[colIndexMap[timestampCol]] : undefined },
      });
      continue;
    }
    
    const timestampKey = `${timestamp}-${sheetName || ''}`;
    if (seenTimestamps.has(timestampKey)) {
      duplicateCount++;
      anomalies.push({
        id: `anomaly-duplicate-${Date.now()}-${rowIdx}`,
        type: 'duplicate_entry',
        severity: 2,
        description: `第${rowIdx + 1}行存在重复时间戳: ${new Date(timestamp).toISOString()}`,
        impact: ANOMALY_IMPACTS.duplicate_entry,
        recommendation: ANOMALY_RECOMMENDATIONS.duplicate_entry,
        dataPoint: { timestamp, level: undefined },
        detectedAt: Date.now(),
        snapshotIndex: rowIdx,
        timestamp,
        level: 0,
        side: 'both',
        suggestions: ['保留最新记录，删除重复项', '检查数据源是否有重复上报', '添加去重逻辑'],
        rawData: { row: rowIdx + 1, sheet: sheetName, timestamp, duplicateOf: seenTimestamps.get(timestampKey) },
      });
      continue;
    }
    seenTimestamps.set(timestampKey, rowIdx);
    
    const symbolCol = mapping.symbol?.[0];
    const lastPriceCol = mapping.lastPrice?.[0];
    const volumeCol = mapping.volume?.[0];
    const oiCol = mapping.openInterest?.[0];
    
    const lastPrice = parseNumber(lastPriceCol ? row[colIndexMap[lastPriceCol]] : null);
    const volume = parseNumber(volumeCol ? row[colIndexMap[volumeCol]] : null) ?? 0;
    const openInterest = parseNumber(oiCol ? row[colIndexMap[oiCol]] : null) ?? 0;
    
    if (lastPrice === null) {
      nullValueCount++;
    }
    
    const bids: PriceLevel[] = [];
    const asks: PriceLevel[] = [];
    
    const maxLevels = Math.min(
      bidPriceColumns.length,
      bidQtyColumns.length,
      askPriceColumns.length,
      askQtyColumns.length,
      10
    );
    
    for (let level = 0; level < maxLevels; level++) {
      const bidPrice = parseNumber(row[colIndexMap[bidPriceColumns[level]]]);
      const bidQty = parseNumber(row[colIndexMap[bidQtyColumns[level]]]);
      
      if (bidPrice !== null && bidQty !== null) {
        bids.push({
          id: `bid-${timestamp}-${level + 1}`,
          side: 'bid',
          level: level + 1,
          price: bidPrice,
          quantity: bidQty,
          rawData: { row: rowIdx + 1, sheet: sheetName },
        });
      } else {
        nullValueCount++;
        anomalies.push({
          id: `anomaly-null-${Date.now()}-${rowIdx}-bid-${level}`,
          type: 'null_value',
          severity: 1,
          description: `买${level + 1}档数据为空`,
          impact: ANOMALY_IMPACTS.null_value,
          recommendation: ANOMALY_RECOMMENDATIONS.null_value,
          dataPoint: { timestamp, level: level + 1 },
          detectedAt: Date.now(),
          snapshotIndex: rowIdx,
          timestamp,
          level: level + 1,
          side: 'bid',
          suggestions: ['使用线性插值填充空值', '检查数据采集程序是否正常', '标记空值位置便于追溯'],
          rawData: { row: rowIdx + 1, sheet: sheetName, level: level + 1, bidPrice, bidQty },
        });
      }
      
      const askPrice = parseNumber(row[colIndexMap[askPriceColumns[level]]]);
      const askQty = parseNumber(row[colIndexMap[askQtyColumns[level]]]);
      
      if (askPrice !== null && askQty !== null) {
        asks.push({
          id: `ask-${timestamp}-${level + 1}`,
          side: 'ask',
          level: level + 1,
          price: askPrice,
          quantity: askQty,
          rawData: { row: rowIdx + 1, sheet: sheetName },
        });
      } else {
        nullValueCount++;
        anomalies.push({
          id: `anomaly-null-${Date.now()}-${rowIdx}-ask-${level}`,
          type: 'null_value',
          severity: 1,
          description: `卖${level + 1}档数据为空`,
          impact: ANOMALY_IMPACTS.null_value,
          recommendation: ANOMALY_RECOMMENDATIONS.null_value,
          dataPoint: { timestamp, level: level + 1 },
          detectedAt: Date.now(),
          snapshotIndex: rowIdx,
          timestamp,
          level: level + 1,
          side: 'ask',
          suggestions: ['使用线性插值填充空值', '检查数据采集程序是否正常', '标记空值位置便于追溯'],
          rawData: { row: rowIdx + 1, sheet: sheetName, level: level + 1, askPrice, askQty },
        });
      }
    }
    
    const trades: TradeRecord[] = [];
    const tradeTimeCol = mapping.tradeTime?.[0];
    const tradePriceCol = mapping.tradePrice?.[0];
    const tradeQtyCol = mapping.tradeQuantity?.[0];
    const tradeDirCol = mapping.tradeDirection?.[0];
    
    if (tradePriceCol && tradeQtyCol) {
      const tradePrice = parseNumber(row[colIndexMap[tradePriceCol]]);
      const tradeQty = parseNumber(row[colIndexMap[tradeQtyCol]]);
      const tradeDirRaw = tradeDirCol ? row[colIndexMap[tradeDirCol]] : null;
      const tradeTime = tradeTimeCol ? parseTimestamp(row[colIndexMap[tradeTimeCol]]) : timestamp;
      
      if (tradePrice !== null && tradeQty !== null) {
        const direction = String(tradeDirRaw || '').toLowerCase().includes('买') || 
                          String(tradeDirRaw || '').toLowerCase().includes('buy')
                          ? 'buy' : 'sell';
        
        trades.push({
          id: `trade-${timestamp}-${rowIdx}`,
          tradeTime: tradeTime ?? timestamp,
          price: tradePrice,
          quantity: tradeQty,
          direction,
        });
      }
    }
    
    snapshots.push({
      id: `snapshot-${timestamp}-${rowIdx}`,
      timestamp,
      symbol: symbolCol ? String(row[colIndexMap[symbolCol]] || 'UNKNOWN') : 'UNKNOWN',
      lastPrice: lastPrice ?? 0,
      volume,
      openInterest,
      bids,
      asks,
      trades,
      rawData: { row: rowIdx + 1, sheet: sheetName },
    });
  }
  
  if (nullValueCount > 0) {
    warnings.push(`发现 ${nullValueCount} 个空值字段，已标记并尝试处理`);
  }
  if (duplicateCount > 0) {
    warnings.push(`发现 ${duplicateCount} 条重复记录，已跳过`);
  }
  
  return { snapshots, anomalies, warnings };
}

const ANOMALY_IMPACTS: Record<AnomalyType, string> = {
  price_misalignment: '导致深度计算偏差，影响策略下单精度',
  duplicate_cancellation: '制造虚假流动性假象，误导盘口深度判断',
  time_grain_chaos: '破坏时间序列连续性，影响时序分析准确性',
  null_value: '可能导致计算错误或程序崩溃，影响分析结果可靠性',
  duplicate_entry: '导致统计指标失真，成交量、挂单量等被重复计算',
  boundary_extreme: '可能扭曲统计分析结果，导致模型训练偏差',
  time_reversal: '破坏时间序列因果关系，导致回放和分析逻辑混乱',
  missing_snapshot: '导致盘口演化连续性中断，可能遗漏关键行情变化',
};

const ANOMALY_RECOMMENDATIONS: Record<AnomalyType, string> = {
  price_misalignment: '检查数据源是否有档位遗漏，考虑对错位档位进行插值补全',
  duplicate_cancellation: '标记该时段为高风险期，建议风控部门介入调查',
  time_grain_chaos: '检查数据采集系统，考虑对时间序列进行重采样',
  null_value: '使用插值法填充或标记后跳过，检查数据采集逻辑',
  duplicate_entry: '保留最新记录并删除重复项，检查数据入库逻辑',
  boundary_extreme: '验证数据真实性，如为真实极值则保留并标记，否则修正',
  time_reversal: '按时间戳重新排序，检查数据采集和传输时序',
  missing_snapshot: '检查数据采集系统稳定性，考虑插值补全缺失时段',
};

export async function parseFile(file: File): Promise<ParseResult> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  
  if (extension === 'csv') {
    return parseCSVFile(file);
  } else if (extension === 'xlsx' || extension === 'xls') {
    return parseExcelFile(file);
  }
  
  throw new Error(`不支持的文件格式: ${extension}`);
}

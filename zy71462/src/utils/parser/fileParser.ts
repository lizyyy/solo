import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import {
  Holding,
  TargetWeight,
  PriceQuote,
  MaterialType,
  calculateHoldingDays,
} from '@/types';

export type FileFormat = 'csv' | 'xlsx' | 'xls';

export interface ParseResult<T> {
  success: boolean;
  data: T[];
  errors: string[];
  warnings: string[];
}

export function detectFileFormat(fileName: string): FileFormat | null {
  const ext = fileName.toLowerCase().split('.').pop();
  if (ext === 'csv') return 'csv';
  if (ext === 'xlsx') return 'xlsx';
  if (ext === 'xls') return 'xls';
  return null;
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === 'string') {
        resolve(result);
      } else if (result instanceof ArrayBuffer) {
        const decoder = new TextDecoder('utf-8');
        resolve(decoder.decode(result));
      } else {
        reject(new Error('无法读取文件内容'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function readExcelFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          reject(new Error('无法读取文件'));
          return;
        }
        
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const csvContent = XLSX.utils.sheet_to_csv(firstSheet);
        resolve(csvContent);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsBinaryString(file);
  });
}

export async function parseFileContent(file: File): Promise<string> {
  const format = detectFileFormat(file.name);
  
  if (!format) {
    throw new Error(`不支持的文件格式：${file.name}。请上传CSV或Excel文件。`);
  }

  if (format === 'csv') {
    return readFileAsText(file);
  } else {
    return readExcelFile(file);
  }
}

function normalizeColumnName(col: string): string {
  return col.trim().toLowerCase().replace(/[\s_-]/g, '');
}

function findColumn(headers: string[], possibleNames: string[]): string | null {
  const normalizedHeaders = headers.map(normalizeColumnName);
  for (const name of possibleNames) {
    const normName = normalizeColumnName(name);
    const index = normalizedHeaders.indexOf(normName);
    if (index !== -1) {
      return headers[index];
    }
  }
  return null;
}

function safeParseNumber(value: any): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;
  
  const str = String(value).replace(/[,\s%]/g, '');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function safeParseDate(value: any): Date {
  if (!value) return new Date(NaN);
  
  if (value instanceof Date) {
    return value;
  }
  
  if (typeof value === 'number') {
    return new Date(Math.round((value - 25569) * 86400 * 1000));
  }
  
  const str = String(value).trim();
  const date = new Date(str);
  return isNaN(date.getTime()) ? new Date(NaN) : date;
}

export function parseHoldings(content: string, materialId: string): ParseResult<Holding> {
  const result: ParseResult<Holding> = {
    success: true,
    data: [],
    errors: [],
    warnings: [],
  };

  const parseResult = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  if (parseResult.errors.length > 0) {
    result.errors.push(...parseResult.errors.map(e => e.message));
    result.success = false;
    return result;
  }

  const headers = parseResult.meta.fields || [];
  
  const symbolCol = findColumn(headers, ['symbol', '代码', '证券代码', '股票代码', 'code', 'id']);
  const nameCol = findColumn(headers, ['name', '名称', '证券名称', '股票名称']);
  const quantityCol = findColumn(headers, ['quantity', '数量', '持仓数量', '持有数量', 'shares']);
  const costBasisCol = findColumn(headers, ['costBasis', '成本价', '买入价', '成本', 'cost']);
  const marketPriceCol = findColumn(headers, ['marketPrice', '市价', '当前价', '现价', '价格', 'price']);
  const purchaseDateCol = findColumn(headers, ['purchaseDate', '买入日期', '购买日期', '建仓日期', 'date']);

  if (!symbolCol) {
    result.errors.push('未找到证券代码列，请确保包含"代码"或"symbol"列');
    result.success = false;
    return result;
  }

  if (!quantityCol) {
    result.errors.push('未找到持仓数量列，请确保包含"数量"或"quantity"列');
    result.success = false;
    return result;
  }

  if (!costBasisCol) {
    result.warnings.push('未找到成本价列，税费计算可能不准确');
  }

  if (!marketPriceCol) {
    result.warnings.push('未找到市价列，将使用成本价作为市价');
  }

  const rows = parseResult.data as Record<string, any>[];
  const asOfDate = new Date();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const symbol = String(row[symbolCol] || '').trim();
    
    if (!symbol) {
      result.warnings.push(`第${i + 1}行：证券代码为空，已跳过`);
      continue;
    }

    const quantity = safeParseNumber(row[quantityCol]);
    const costBasis = costBasisCol ? safeParseNumber(row[costBasisCol]) : 0;
    const marketPrice = marketPriceCol ? safeParseNumber(row[marketPriceCol]) : costBasis || 1;
    const purchaseDate = purchaseDateCol ? safeParseDate(row[purchaseDateCol]) : new Date(NaN);
    const name = nameCol ? String(row[nameCol] || '').trim() : symbol;

    const marketValue = quantity * marketPrice;
    const costValue = quantity * costBasis;
    const unrealizedGain = marketValue - costValue;
    const unrealizedGainPct = costValue > 0 ? unrealizedGain / costValue : 0;
    const holdingDays = isNaN(purchaseDate.getTime()) ? 0 : calculateHoldingDays(purchaseDate, asOfDate);

    result.data.push({
      id: `hold_${Date.now()}_${i}`,
      materialId,
      symbol,
      name,
      quantity,
      costBasis,
      marketPrice,
      purchaseDate,
      holdingDays,
      marketValue,
      costValue,
      unrealizedGain,
      unrealizedGainPct,
      currentWeight: 0,
    });
  }

  if (result.data.length === 0) {
    result.errors.push('未解析到任何有效的持仓数据');
    result.success = false;
  }

  const totalMarketValue = result.data.reduce((sum, h) => sum + h.marketValue, 0);
  result.data = result.data.map(h => ({
    ...h,
    currentWeight: totalMarketValue > 0 ? h.marketValue / totalMarketValue : 0,
  }));

  return result;
}

export function parseTargetWeights(content: string, materialId: string): ParseResult<TargetWeight> {
  const result: ParseResult<TargetWeight> = {
    success: true,
    data: [],
    errors: [],
    warnings: [],
  };

  const parseResult = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  if (parseResult.errors.length > 0) {
    result.errors.push(...parseResult.errors.map(e => e.message));
    result.success = false;
    return result;
  }

  const headers = parseResult.meta.fields || [];
  
  const symbolCol = findColumn(headers, ['symbol', '代码', '证券代码', '股票代码', 'code', 'id']);
  const weightCol = findColumn(headers, ['targetWeight', '权重', '目标权重', 'weight', '比例', '配置比例']);

  if (!symbolCol) {
    result.errors.push('未找到证券代码列，请确保包含"代码"或"symbol"列');
    result.success = false;
    return result;
  }

  if (!weightCol) {
    result.errors.push('未找到目标权重列，请确保包含"目标权重"或"weight"列');
    result.success = false;
    return result;
  }

  const rows = parseResult.data as Record<string, any>[];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const symbol = String(row[symbolCol] || '').trim();
    
    if (!symbol) {
      result.warnings.push(`第${i + 1}行：证券代码为空，已跳过`);
      continue;
    }

    let targetWeight = safeParseNumber(row[weightCol]);
    
    if (targetWeight > 1) {
      targetWeight = targetWeight / 100;
      result.warnings.push(`第${i + 1}行：权重${row[weightCol]}已自动转换为${targetWeight.toFixed(4)}`);
    }

    result.data.push({
      id: `target_${Date.now()}_${i}`,
      materialId,
      symbol,
      targetWeight,
    });
  }

  if (result.data.length === 0) {
    result.errors.push('未解析到任何有效的目标权重数据');
    result.success = false;
  }

  return result;
}

export function parsePriceQuotes(content: string, materialId: string): ParseResult<PriceQuote> {
  const result: ParseResult<PriceQuote> = {
    success: true,
    data: [],
    errors: [],
    warnings: [],
  };

  const parseResult = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  if (parseResult.errors.length > 0) {
    result.errors.push(...parseResult.errors.map(e => e.message));
    result.success = false;
    return result;
  }

  const headers = parseResult.meta.fields || [];
  
  const symbolCol = findColumn(headers, ['symbol', '代码', '证券代码', '股票代码', 'code', 'id']);
  const bidCol = findColumn(headers, ['bidPrice', '买入价', '买价', 'bid', '买方报价']);
  const askCol = findColumn(headers, ['askPrice', '卖出价', '卖价', 'ask', '卖方报价']);
  const priceCol = findColumn(headers, ['price', '价格', '现价', '市价']);

  if (!symbolCol) {
    result.errors.push('未找到证券代码列，请确保包含"代码"或"symbol"列');
    result.success = false;
    return result;
  }

  if (!bidCol && !priceCol) {
    result.warnings.push('未找到买入价列，将使用市价作为买入价');
  }

  if (!askCol && !priceCol) {
    result.warnings.push('未找到卖出价列，将使用市价作为卖出价');
  }

  const rows = parseResult.data as Record<string, any>[];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const symbol = String(row[symbolCol] || '').trim();
    
    if (!symbol) {
      result.warnings.push(`第${i + 1}行：证券代码为空，已跳过`);
      continue;
    }

    const price = priceCol ? safeParseNumber(row[priceCol]) : 0;
    const bidPrice = bidCol ? safeParseNumber(row[bidCol]) : price;
    const askPrice = askCol ? safeParseNumber(row[askCol]) : price;

    result.data.push({
      id: `price_${Date.now()}_${i}`,
      materialId,
      symbol,
      bidPrice: bidPrice > 0 ? bidPrice : askPrice,
      askPrice: askPrice > 0 ? askPrice : bidPrice,
      quoteTime: new Date(),
    });
  }

  return result;
}

export async function parseMaterial(
  file: File,
  type: MaterialType,
  materialId: string
): Promise<ParseResult<Holding | TargetWeight | PriceQuote>> {
  const content = await parseFileContent(file);
  
  switch (type) {
    case 'holding':
      return parseHoldings(content, materialId) as ParseResult<Holding | TargetWeight | PriceQuote>;
    case 'target':
      return parseTargetWeights(content, materialId) as ParseResult<Holding | TargetWeight | PriceQuote>;
    case 'price':
      return parsePriceQuotes(content, materialId) as ParseResult<Holding | TargetWeight | PriceQuote>;
  }
}

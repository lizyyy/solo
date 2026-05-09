import fs from 'fs';
import path from 'path';
import csvParser from 'csv-parser';
import { Invoice, ImportResult, FailedRecord } from '../types/invoice';
import { 
  generateId, 
  generateBatchId, 
  normalizeInvoiceType,
  normalizeInvoiceStatus,
  sanitizeNumber,
  isRedInvoiceSignaled,
  normalizeInvoiceNumber,
  normalizeInvoiceCode
} from '../utils/helpers';

interface RawInvoiceData {
  [key: string]: any;
}

const FIELD_MAPPING: Record<string, string[]> = {
  invoiceNumber: ['发票号码', 'invoiceNumber', 'invoiceNo', '发票号', '编号'],
  invoiceCode: ['发票代码', 'invoiceCode', '发票编码', '代码'],
  invoiceDate: ['开票日期', 'invoiceDate', '日期', 'date', '开票时间'],
  amount: ['金额', 'amount', '不含税金额', '价款'],
  taxAmount: ['税额', 'taxAmount', '税金', 'tax'],
  totalAmount: ['价税合计', 'totalAmount', '合计', '总额', 'total'],
  sellerName: ['销售方名称', 'sellerName', '销售方', '卖方', '销方'],
  buyerName: ['购买方名称', 'buyerName', '购买方', '买方', '购方'],
  invoiceType: ['发票类型', 'invoiceType', '类型', 'type'],
  status: ['状态', 'status', '发票状态'],
  isRedInvoice: ['是否红冲', 'isRedInvoice', '红冲', '红字'],
  originalInvoiceNumber: ['对应原票号码', 'originalInvoiceNumber', '原票号码', '对应发票号'],
  originalInvoiceCode: ['对应原票代码', 'originalInvoiceCode', '原票代码', '对应发票代码'],
  remark: ['备注', 'remark', '说明']
};

function mapField(data: RawInvoiceData, targetField: string): any {
  const possibleFields = FIELD_MAPPING[targetField] || [targetField];
  for (const field of possibleFields) {
    if (data[field] !== undefined && data[field] !== null && data[field] !== '') {
      return data[field];
    }
  }
  return undefined;
}

function transformRawToInvoice(raw: RawInvoiceData, batchId: string): Invoice {
  const invoice: Invoice = {
    id: generateId(),
    invoiceNumber: normalizeInvoiceNumber(mapField(raw, 'invoiceNumber') || ''),
    invoiceCode: normalizeInvoiceCode(mapField(raw, 'invoiceCode') || ''),
    invoiceDate: mapField(raw, 'invoiceDate') || '',
    amount: sanitizeNumber(mapField(raw, 'amount')),
    taxAmount: sanitizeNumber(mapField(raw, 'taxAmount')),
    totalAmount: sanitizeNumber(mapField(raw, 'totalAmount')),
    sellerName: mapField(raw, 'sellerName') || '',
    buyerName: mapField(raw, 'buyerName') || '',
    invoiceType: normalizeInvoiceType(mapField(raw, 'invoiceType') || '其他'),
    status: normalizeInvoiceStatus(mapField(raw, 'status') || '待核验'),
    isRedInvoice: isRedInvoiceSignaled(raw),
    rawData: raw,
    importBatchId: batchId,
    importTime: new Date(),
    validationErrors: []
  };

  const originalInvoiceNumber = mapField(raw, 'originalInvoiceNumber');
  const originalInvoiceCode = mapField(raw, 'originalInvoiceCode');
  const remark = mapField(raw, 'remark');

  if (originalInvoiceNumber) {
    invoice.originalInvoiceNumber = normalizeInvoiceNumber(originalInvoiceNumber);
  }
  if (originalInvoiceCode) {
    invoice.originalInvoiceCode = normalizeInvoiceCode(originalInvoiceCode);
  }
  if (remark) {
    invoice.remark = remark;
  }

  return invoice;
}

function validateRequiredFields(invoice: Invoice): string[] {
  const errors: string[] = [];
  
  if (!invoice.invoiceNumber) {
    errors.push('缺少发票号码');
  }
  if (!invoice.invoiceCode) {
    errors.push('缺少发票代码');
  }
  if (invoice.totalAmount === 0 && invoice.amount === 0) {
    errors.push('缺少金额信息');
  }
  
  return errors;
}

export async function importFromCSV(filePath: string): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      reject(new Error(`文件不存在: ${filePath}`));
      return;
    }

    const batchId = generateBatchId();
    const results: RawInvoiceData[] = [];
    let lineNumber = 0;

    const stream = fs.createReadStream(filePath, 'utf8')
      .pipe(csvParser({
        mapHeaders: ({ header }) => header.trim()
      }));

    stream.on('data', (data: RawInvoiceData) => {
      lineNumber++;
      results.push({ ...data, _lineNumber: lineNumber });
    });

    stream.on('end', () => {
      processImportResults(results, batchId, path.basename(filePath))
        .then(resolve)
        .catch(reject);
    });

    stream.on('error', (error) => {
      reject(error);
    });
  });
}

export async function importFromJSON(filePath: string): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      reject(new Error(`文件不存在: ${filePath}`));
      return;
    }

    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(fileContent);
      const batchId = generateBatchId();
      
      let results: RawInvoiceData[];
      if (Array.isArray(data)) {
        results = data.map((item, index) => ({ ...item, _lineNumber: index + 1 }));
      } else if (data.invoices && Array.isArray(data.invoices)) {
        results = data.invoices.map((item: any, index: number) => ({ ...item, _lineNumber: index + 1 }));
      } else {
        reject(new Error('JSON 文件格式不正确，需要是数组或包含 invoices 数组的对象'));
        return;
      }

      processImportResults(results, batchId, path.basename(filePath))
        .then(resolve)
        .catch(reject);
    } catch (error) {
      reject(error);
    }
  });
}

async function processImportResults(
  results: RawInvoiceData[], 
  batchId: string,
  fileName: string
): Promise<ImportResult> {
  const invoices: Invoice[] = [];
  const failedRecords: FailedRecord[] = [];
  const totalRecords = results.length;

  for (const raw of results) {
    const lineNumber = raw._lineNumber || 0;
    delete raw._lineNumber;

    try {
      const invoice = transformRawToInvoice(raw, batchId);
      const validationErrors = validateRequiredFields(invoice);
      
      if (validationErrors.length > 0) {
        failedRecords.push({
          lineNumber,
          rawData: raw,
          error: validationErrors.join('; ')
        });
      } else {
        invoices.push(invoice);
      }
    } catch (error) {
      failedRecords.push({
        lineNumber,
        rawData: raw,
        error: `数据转换失败: ${error instanceof Error ? error.message : '未知错误'}`
      });
    }
  }

  return {
    success: true,
    totalRecords,
    importedRecords: invoices.length,
    failedRecords: failedRecords.length,
    failedRecordsDetails: failedRecords,
    invoices,
    batchId
  };
}

export async function importFile(filePath: string): Promise<ImportResult> {
  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === '.csv') {
    return importFromCSV(filePath);
  } else if (ext === '.json') {
    return importFromJSON(filePath);
  } else {
    throw new Error(`不支持的文件格式: ${ext}。仅支持 CSV 和 JSON 文件。`);
  }
}

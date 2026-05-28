import * as XLSX from 'xlsx';
import type {
  DataSource,
  SourceType,
  BankTransaction,
  Voucher,
  Invoice,
  Contract,
  ImportConflict,
} from '../types';
import { generateId, calculateFileHash, normalizeString } from '../utils';
import { dbOperations } from '../db';

type ParsedData = {
  transactions: BankTransaction[];
  vouchers: Voucher[];
  invoices: Invoice[];
  contracts: Contract[];
  conflicts: ImportConflict[];
};

export const detectSourceType = (fileName: string, headers: string[]): SourceType => {
  const lowerName = fileName.toLowerCase();
  const lowerHeaders = headers.map(h => h.toLowerCase());

  if (lowerName.includes('流水') || lowerName.includes('bank') || 
      lowerHeaders.some(h => h.includes('交易') || h.includes('流水') || h.includes('借方') || h.includes('贷方'))) {
    return 'bank';
  }

  if (lowerName.includes('凭证') || lowerName.includes('voucher') ||
      lowerHeaders.some(h => h.includes('凭证号') || h.includes('科目'))) {
    return 'voucher';
  }

  if (lowerName.includes('发票') || lowerName.includes('invoice') ||
      lowerHeaders.some(h => h.includes('发票号') || h.includes('税额'))) {
    return 'invoice';
  }

  if (lowerName.includes('合同') || lowerName.includes('contract') ||
      lowerHeaders.some(h => h.includes('合同号') || h.includes('合同金额'))) {
    return 'contract';
  }

  return 'bank';
};

export const parseExcel = async (file: File): Promise<{
  headers: string[];
  rows: Record<string, unknown>[];
  sheetNames: string[];
}> => {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];
  
  if (jsonData.length === 0) {
    return { headers: [], rows: [], sheetNames: workbook.SheetNames };
  }

  const headers = (jsonData[0] as string[]).map(h => String(h || '').trim());
  const rows: Record<string, unknown>[] = [];

  for (let i = 1; i < jsonData.length; i++) {
    const row: Record<string, unknown> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = jsonData[i][j];
    }
    rows.push(row);
  }

  return { headers, rows, sheetNames: workbook.SheetNames };
};

export const parseBankTransaction = (
  row: Record<string, unknown>,
  batchId: string,
  sourceId: string
): BankTransaction => {
  const getValue = (keys: string[]): string => {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null) {
        return String(row[key]).trim();
      }
    }
    return '';
  };

  const getNumber = (keys: string[]): number => {
    const value = getValue(keys);
    if (!value) return 0;
    const num = parseFloat(value.replace(/,/g, ''));
    return isNaN(num) ? 0 : num;
  };

  const now = Date.now();
  const summary = getValue(['摘要', '交易摘要', '备注', 'description', 'summary']);
  const isRedFlush = summary.includes('红冲') || summary.includes('冲销') || summary.includes('负数');

  return {
    id: generateId(),
    batchId,
    sourceId,
    transactionDate: getValue(['交易日期', '日期', '记账日期', 'date', 'transactionDate']),
    transactionNo: getValue(['交易流水号', '流水号', '交易号', 'transactionNo', 'id']),
    summary,
    debitAmount: getNumber(['借方金额', '支出', '付出', 'debit', 'debitAmount', '支出金额']),
    creditAmount: getNumber(['贷方金额', '收入', '存入', 'credit', 'creditAmount', '收入金额']),
    balance: getNumber(['余额', 'balance']),
    counterparty: getValue(['对方户名', '对方名称', '交易对手', 'counterparty', '对方账户名']),
    counterpartyAccount: getValue(['对方账号', '对方账户', 'counterpartyAccount']),
    remark: getValue(['备注', '附言', 'remark', 'notes']),
    isRedFlush,
    matched: false,
    createdAt: now,
    updatedAt: now,
  };
};

export const parseVoucher = (
  row: Record<string, unknown>,
  batchId: string,
  sourceId: string
): Voucher => {
  const getValue = (keys: string[]): string => {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null) {
        return String(row[key]).trim();
      }
    }
    return '';
  };

  const getNumber = (keys: string[]): number => {
    const value = getValue(keys);
    if (!value) return 0;
    const num = parseFloat(value.replace(/,/g, ''));
    return isNaN(num) ? 0 : num;
  };

  const now = Date.now();
  const summary = getValue(['摘要', '摘要信息', 'description', 'summary']);
  const isRedFlush = summary.includes('红冲') || summary.includes('冲销') || 
                     getValue(['方向', 'direction']).includes('红') ||
                     getNumber(['借方金额', '贷方金额']) < 0;

  return {
    id: generateId(),
    batchId,
    sourceId,
    voucherNo: getValue(['凭证号', '凭证编号', 'voucherNo', 'voucherNumber']),
    voucherDate: getValue(['凭证日期', '日期', '记账日期', 'voucherDate', 'date']),
    summary,
    debitAmount: Math.abs(getNumber(['借方金额', 'debit', 'debitAmount'])),
    creditAmount: Math.abs(getNumber(['贷方金额', 'credit', 'creditAmount'])),
    accountCode: getValue(['科目代码', '科目编码', 'accountCode']),
    accountName: getValue(['科目名称', 'accountName', '科目']),
    isRedFlush,
    matched: false,
    createdAt: now,
    updatedAt: now,
  };
};

export const parseInvoice = (
  row: Record<string, unknown>,
  batchId: string,
  sourceId: string
): Invoice => {
  const getValue = (keys: string[]): string => {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null) {
        return String(row[key]).trim();
      }
    }
    return '';
  };

  const getNumber = (keys: string[]): number => {
    const value = getValue(keys);
    if (!value) return 0;
    const num = parseFloat(value.replace(/,/g, ''));
    return isNaN(num) ? 0 : num;
  };

  const now = Date.now();

  return {
    id: generateId(),
    batchId,
    sourceId,
    invoiceNo: getValue(['发票号码', '发票号', 'invoiceNo', 'invoiceNumber']),
    invoiceCode: getValue(['发票代码', 'invoiceCode']),
    invoiceDate: getValue(['开票日期', '发票日期', 'invoiceDate', 'date']),
    amount: getNumber(['不含税金额', '金额', 'amount']),
    taxAmount: getNumber(['税额', '税金', 'taxAmount', 'tax']),
    totalAmount: getNumber(['价税合计', '总金额', 'totalAmount', '合计']),
    counterparty: getValue(['购方名称', '对方名称', '客户名称', 'counterparty', '销售方']),
    counterpartyTaxNo: getValue(['购方税号', '对方税号', 'taxNo']),
    matched: false,
    createdAt: now,
    updatedAt: now,
  };
};

export const parseContract = (
  row: Record<string, unknown>,
  batchId: string,
  sourceId: string
): Contract => {
  const getValue = (keys: string[]): string => {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null) {
        return String(row[key]).trim();
      }
    }
    return '';
  };

  const getNumber = (keys: string[]): number => {
    const value = getValue(keys);
    if (!value) return 0;
    const num = parseFloat(value.replace(/,/g, ''));
    return isNaN(num) ? 0 : num;
  };

  const now = Date.now();

  return {
    id: generateId(),
    batchId,
    sourceId,
    contractNo: getValue(['合同编号', '合同号', 'contractNo', 'contractNumber']),
    contractName: getValue(['合同名称', 'contractName', '名称']),
    contractAmount: getNumber(['合同金额', '金额', 'contractAmount', 'amount']),
    counterparty: getValue(['对方单位', '合作方', '乙方', 'counterparty']),
    paymentTerms: getValue(['付款条款', '付款方式', 'paymentTerms']),
    matched: false,
    createdAt: now,
    updatedAt: now,
  };
};

export const checkDuplicates = async (
  batchId: string,
  transactions: BankTransaction[],
  vouchers: Voucher[]
): Promise<ImportConflict[]> => {
  const conflicts: ImportConflict[] = [];

  const existingTransactions = await dbOperations.transactions.getByBatch(batchId);
  const existingVouchers = await dbOperations.vouchers.getByBatch(batchId);

  const existingTransactionNos = new Map(
    existingTransactions.map(t => [normalizeString(t.transactionNo), t.id])
  );
  const existingVoucherNos = new Map(
    existingVouchers.map(v => [normalizeString(v.voucherNo), v.id])
  );

  for (const transaction of transactions) {
    const key = normalizeString(transaction.transactionNo);
    if (existingTransactionNos.has(key)) {
      conflicts.push({
        id: generateId(),
        batchId,
        sourceType: 'bank',
        existingRecordId: existingTransactionNos.get(key)!,
        newRecord: transaction,
        resolution: null,
        createdAt: Date.now(),
      });
    }
  }

  for (const voucher of vouchers) {
    const key = normalizeString(voucher.voucherNo);
    if (existingVoucherNos.has(key)) {
      conflicts.push({
        id: generateId(),
        batchId,
        sourceType: 'voucher',
        existingRecordId: existingVoucherNos.get(key)!,
        newRecord: voucher,
        resolution: null,
        createdAt: Date.now(),
      });
    }
  }

  return conflicts;
};

export const importFile = async (
  file: File,
  batchId: string
): Promise<{
  source: DataSource;
  data: ParsedData;
  duplicateCount: number;
}> => {
  const fileHash = await calculateFileHash(file);
  
  const existingSource = await dbOperations.sources.getByHash(fileHash);
  if (existingSource) {
    throw new Error(`该文件已在批次"${existingSource.batchId}"中导入过`);
  }

  const { headers, rows } = await parseExcel(file);
  const sourceType = detectSourceType(file.name, headers);

  const sourceId = generateId();
  const source: DataSource = {
    id: sourceId,
    name: file.name,
    type: sourceType,
    importTime: Date.now(),
    fileHash,
    recordCount: rows.length,
    batchId,
  };

  const data: ParsedData = {
    transactions: [],
    vouchers: [],
    invoices: [],
    contracts: [],
    conflicts: [],
  };

  switch (sourceType) {
    case 'bank':
      data.transactions = rows
        .filter(r => Object.values(r).some(v => v !== undefined && v !== null && v !== ''))
        .map(r => parseBankTransaction(r, batchId, sourceId));
      break;
    case 'voucher':
      data.vouchers = rows
        .filter(r => Object.values(r).some(v => v !== undefined && v !== null && v !== ''))
        .map(r => parseVoucher(r, batchId, sourceId));
      break;
    case 'invoice':
      data.invoices = rows
        .filter(r => Object.values(r).some(v => v !== undefined && v !== null && v !== ''))
        .map(r => parseInvoice(r, batchId, sourceId));
      break;
    case 'contract':
      data.contracts = rows
        .filter(r => Object.values(r).some(v => v !== undefined && v !== null && v !== ''))
        .map(r => parseContract(r, batchId, sourceId));
      break;
  }

  data.conflicts = await checkDuplicates(batchId, data.transactions, data.vouchers);

  return {
    source,
    data,
    duplicateCount: data.conflicts.length,
  };
};

export const resolveImportConflict = async (
  conflictId: string,
  resolution: 'skip' | 'overwrite' | 'append'
): Promise<void> => {
  const batch = await dbOperations.batches.getAll().then(b => b[0]);
  if (!batch) return;

  const conflicts = await dbOperations.importConflicts.getByBatch(batch.id);
  const conflict = conflicts.find(c => c.id === conflictId);
  if (!conflict) return;

  if (resolution === 'overwrite') {
    if (conflict.sourceType === 'bank') {
      const transactions = await dbOperations.transactions.getByBatch(batch.id);
      const updatedTransactions = transactions.filter(t => t.id !== conflict.existingRecordId);
      await dbOperations.transactions.updateMany(updatedTransactions);
      await dbOperations.transactions.addMany([conflict.newRecord as BankTransaction]);
    } else if (conflict.sourceType === 'voucher') {
      const vouchers = await dbOperations.vouchers.getByBatch(batch.id);
      const updatedVouchers = vouchers.filter(v => v.id !== conflict.existingRecordId);
      await dbOperations.vouchers.updateMany(updatedVouchers);
      await dbOperations.vouchers.addMany([conflict.newRecord as Voucher]);
    }
  } else if (resolution === 'append') {
    if (conflict.sourceType === 'bank') {
      await dbOperations.transactions.addMany([conflict.newRecord as BankTransaction]);
    } else if (conflict.sourceType === 'voucher') {
      await dbOperations.vouchers.addMany([conflict.newRecord as Voucher]);
    }
  }

  await dbOperations.importConflicts.delete(conflictId);
};

export const saveImportedData = async (
  source: DataSource,
  data: ParsedData
): Promise<void> => {
  await dbOperations.sources.add(source);

  if (data.transactions.length > 0) {
    await dbOperations.transactions.addMany(data.transactions);
  }
  if (data.vouchers.length > 0) {
    await dbOperations.vouchers.addMany(data.vouchers);
  }
  if (data.invoices.length > 0) {
    await dbOperations.invoices.addMany(data.invoices);
  }
  if (data.contracts.length > 0) {
    await dbOperations.contracts.addMany(data.contracts);
  }
  if (data.conflicts.length > 0) {
    await dbOperations.importConflicts.addMany(data.conflicts);
  }
};

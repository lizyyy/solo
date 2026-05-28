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
};

export type ImportResult = {
  source: DataSource;
  data: ParsedData;
  conflicts: ImportConflict[];
  sameFileDetected: boolean;
  existingSource?: DataSource;
  cleanCount: number;
  conflictCount: number;
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
  vouchers: Voucher[],
  invoices: Invoice[],
  contracts: Contract[],
  sourceId: string
): Promise<ImportConflict[]> => {
  const conflicts: ImportConflict[] = [];

  const existingTransactions = await dbOperations.transactions.getByBatch(batchId);
  const existingVouchers = await dbOperations.vouchers.getByBatch(batchId);
  const existingInvoices = await dbOperations.invoices.getByBatch(batchId);
  const existingContracts = await dbOperations.contracts.getByBatch(batchId);

  const existingTransactionNos = new Map(
    existingTransactions.map(t => [normalizeString(t.transactionNo), t])
  );
  const existingVoucherNos = new Map(
    existingVouchers.map(v => [normalizeString(v.voucherNo), v])
  );
  const existingInvoiceNos = new Map(
    existingInvoices.map(i => [normalizeString(i.invoiceNo), i])
  );
  const existingContractNos = new Map(
    existingContracts.map(c => [normalizeString(c.contractNo), c])
  );

  for (const transaction of transactions) {
    const key = normalizeString(transaction.transactionNo);
    const existing = existingTransactionNos.get(key);
    if (existing) {
      const isSameFile = existing.sourceId === sourceId;
      conflicts.push({
        id: generateId(),
        batchId,
        sourceType: 'bank',
        existingRecordId: existing.id,
        newRecord: transaction,
        recordKey: transaction.transactionNo,
        resolution: null,
        isSameFile,
        existingSourceId: existing.sourceId,
        createdAt: Date.now(),
      });
    }
  }

  for (const voucher of vouchers) {
    const key = normalizeString(voucher.voucherNo);
    const existing = existingVoucherNos.get(key);
    if (existing) {
      const isSameFile = existing.sourceId === sourceId;
      conflicts.push({
        id: generateId(),
        batchId,
        sourceType: 'voucher',
        existingRecordId: existing.id,
        newRecord: voucher,
        recordKey: voucher.voucherNo,
        resolution: null,
        isSameFile,
        existingSourceId: existing.sourceId,
        createdAt: Date.now(),
      });
    }
  }

  for (const invoice of invoices) {
    const key = normalizeString(invoice.invoiceNo);
    const existing = existingInvoiceNos.get(key);
    if (existing) {
      const isSameFile = existing.sourceId === sourceId;
      conflicts.push({
        id: generateId(),
        batchId,
        sourceType: 'invoice',
        existingRecordId: existing.id,
        newRecord: invoice,
        recordKey: invoice.invoiceNo,
        resolution: null,
        isSameFile,
        existingSourceId: existing.sourceId,
        createdAt: Date.now(),
      });
    }
  }

  for (const contract of contracts) {
    const key = normalizeString(contract.contractNo);
    const existing = existingContractNos.get(key);
    if (existing) {
      const isSameFile = existing.sourceId === sourceId;
      conflicts.push({
        id: generateId(),
        batchId,
        sourceType: 'contract',
        existingRecordId: existing.id,
        newRecord: contract,
        recordKey: contract.contractNo,
        resolution: null,
        isSameFile,
        existingSourceId: existing.sourceId,
        createdAt: Date.now(),
      });
    }
  }

  return conflicts;
};

export const importFile = async (
  file: File,
  batchId: string
): Promise<ImportResult> => {
  const fileHash = await calculateFileHash(file);

  const existingSource = await dbOperations.sources.getByHash(fileHash);
  const sameFileDetected = !!existingSource;

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

  const conflicts = await checkDuplicates(
    batchId,
    data.transactions,
    data.vouchers,
    data.invoices,
    data.contracts,
    sourceId
  );

  const conflictIds = new Set(conflicts.map(c => c.newRecord.id));

  let cleanCount = 0;
  const cleanTransactions = data.transactions.filter(t => !conflictIds.has(t.id));
  const cleanVouchers = data.vouchers.filter(v => !conflictIds.has(v.id));
  const cleanInvoices = data.invoices.filter(i => !conflictIds.has(i.id));
  const cleanContracts = data.contracts.filter(c => !conflictIds.has(c.id));

  cleanCount = cleanTransactions.length + cleanVouchers.length + cleanInvoices.length + cleanContracts.length;

  await dbOperations.sources.add(source);

  if (cleanTransactions.length > 0) {
    await dbOperations.transactions.addMany(cleanTransactions);
  }
  if (cleanVouchers.length > 0) {
    await dbOperations.vouchers.addMany(cleanVouchers);
  }
  if (cleanInvoices.length > 0) {
    await dbOperations.invoices.addMany(cleanInvoices);
  }
  if (cleanContracts.length > 0) {
    await dbOperations.contracts.addMany(cleanContracts);
  }

  if (conflicts.length > 0) {
    await dbOperations.importConflicts.addMany(conflicts);
  }

  return {
    source,
    data,
    conflicts,
    sameFileDetected,
    existingSource: existingSource || undefined,
    cleanCount,
    conflictCount: conflicts.length,
  };
};

export const resolveImportConflict = async (
  conflictId: string,
  resolution: 'skip' | 'overwrite' | 'append',
  batchId: string
): Promise<void> => {
  const conflicts = await dbOperations.importConflicts.getByBatch(batchId);
  const conflict = conflicts.find(c => c.id === conflictId);
  if (!conflict) return;

  if (resolution === 'skip') {
    await dbOperations.importConflicts.delete(conflictId);
    return;
  }

  if (resolution === 'overwrite') {
    await deleteRecordById(conflict.existingRecordId, conflict.sourceType);
    await addRecord(conflict.newRecord, conflict.sourceType);
    await dbOperations.importConflicts.delete(conflictId);
    return;
  }

  if (resolution === 'append') {
    if (conflict.sourceType === 'bank') {
      const txn = conflict.newRecord as BankTransaction;
      txn.transactionNo = `${txn.transactionNo}-副本`;
    } else if (conflict.sourceType === 'voucher') {
      const vch = conflict.newRecord as Voucher;
      vch.voucherNo = `${vch.voucherNo}-副本`;
    } else if (conflict.sourceType === 'invoice') {
      const inv = conflict.newRecord as Invoice;
      inv.invoiceNo = `${inv.invoiceNo}-副本`;
    } else if (conflict.sourceType === 'contract') {
      const ctt = conflict.newRecord as Contract;
      ctt.contractNo = `${ctt.contractNo}-副本`;
    }
    await addRecord(conflict.newRecord, conflict.sourceType);
    await dbOperations.importConflicts.delete(conflictId);
    return;
  }
};

const deleteRecordById = async (id: string, sourceType: SourceType): Promise<void> => {
  switch (sourceType) {
    case 'bank':
      await dbOperations.transactions.deleteById(id);
      break;
    case 'voucher':
      await dbOperations.vouchers.deleteById(id);
      break;
    case 'invoice':
      await dbOperations.invoices.deleteById(id);
      break;
    case 'contract':
      await dbOperations.contracts.deleteById(id);
      break;
  }
};

const addRecord = async (
  record: BankTransaction | Voucher | Invoice | Contract,
  sourceType: SourceType
): Promise<void> => {
  switch (sourceType) {
    case 'bank':
      await dbOperations.transactions.addMany([record as BankTransaction]);
      break;
    case 'voucher':
      await dbOperations.vouchers.addMany([record as Voucher]);
      break;
    case 'invoice':
      await dbOperations.invoices.addMany([record as Invoice]);
      break;
    case 'contract':
      await dbOperations.contracts.addMany([record as Contract]);
      break;
  }
};

export const resolveAllConflicts = async (
  batchId: string,
  resolution: 'skip' | 'overwrite' | 'append'
): Promise<number> => {
  const conflicts = await dbOperations.importConflicts.getByBatch(batchId);
  let resolved = 0;

  for (const conflict of conflicts) {
    try {
      await resolveImportConflict(conflict.id, resolution, batchId);
      resolved++;
    } catch {
      // continue resolving others
    }
  }

  return resolved;
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
};

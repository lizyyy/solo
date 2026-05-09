import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from './database';
import { 
  createOrUpdateBudget 
} from './models';
import { 
  createPurchaseRequest, 
  createContractPayment,
  BudgetAlreadyProcessedError,
  ImportError,
  ImportSummary
} from './budgetService';

export type ImportType = 'budget' | 'purchase' | 'payment';

export interface ImportOptions {
  type: ImportType;
  sheetName?: string;
  period?: string;
}

function parseNumber(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (isNaN(num)) return null;
  return num;
}

function parseDate(value: any): string {
  if (!value) return new Date().toISOString().split('T')[0];
  
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    if (/^\d{4}\/\d{2}\/\d{2}$/.test(trimmed)) return trimmed.replace(/\//g, '-');
  }
  
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  
  try {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      return date.toISOString().split('T')[0];
    }
  } catch {
    return new Date().toISOString().split('T')[0];
  }
  
  return new Date().toISOString().split('T')[0];
}

function validateBudgetRow(row: any, rowNum: number): { isValid: boolean; errors: ImportError[] } {
  const errors: ImportError[] = [];

  if (!row['部门'] || !String(row['部门']).trim()) {
    errors.push({ row: rowNum, field: '部门', message: '部门名称不能为空' });
  }

  const amount = parseNumber(row['预算金额']);
  if (amount === null || amount < 0) {
    errors.push({ 
      row: rowNum, field: '预算金额', message: '预算金额必须是大于0的数字', value: String(row['预算金额']) });
  }

  const threshold = parseNumber(row['阈值']);
  if (threshold !== null && (threshold < 0 || threshold > 1)) {
    errors.push({ 
      row: rowNum, field: '阈值', message: '阈值必须在0-1之间', value: String(row['阈值']) });
  }

  return { isValid: errors.length === 0, errors };
}

function validatePurchaseRow(row: any, rowNum: number): { isValid: boolean; errors: ImportError[] } {
  const errors: ImportError[] = [];

  if (!row['申请单号'] || !String(row['申请单号']).trim()) {
    errors.push({ row: rowNum, field: '申请单号', message: '申请单号不能为空' });
  }

  if (!row['部门'] || !String(row['部门']).trim()) {
    errors.push({ row: rowNum, field: '部门', message: '部门名称不能为空' });
  }

  if (!row['物品名称'] || !String(row['物品名称']).trim()) {
    errors.push({ row: rowNum, field: '物品名称', message: '物品名称不能为空' });
  }

  const amount = parseNumber(row['申请金额']);
  if (amount === null || amount <= 0) {
    errors.push({ 
      row: rowNum, field: '申请金额', message: '申请金额必须是大于0的数字', value: String(row['申请金额']) });
  }

  return { isValid: errors.length === 0, errors };
}

function validatePaymentRow(row: any, rowNum: number): { isValid: boolean; errors: ImportError[] } {
  const errors: ImportError[] = [];

  if (!row['付款单号'] || !String(row['付款单号']).trim()) {
    errors.push({ row: rowNum, field: '付款单号', message: '付款单号不能为空' });
  }

  if (!row['部门'] || !String(row['部门']).trim()) {
    errors.push({ row: rowNum, field: '部门', message: '部门名称不能为空' });
  }

  const amount = parseNumber(row['付款金额']);
  if (amount === null || amount <= 0) {
    errors.push({ 
      row: rowNum, field: '付款金额', message: '付款金额必须是大于0的数字', value: String(row['付款金额']) });
  }

  return { isValid: errors.length === 0, errors };
}

export function importFromExcel(
  filePath: string,
  options: ImportOptions
): ImportSummary {
  const db = getDatabase();
  const summary: ImportSummary = {
    totalRecords: 0,
    successCount: 0,
    errorCount: 0,
    errors: []
  };

  const logId = uuidv4();
  db.prepare(`
    INSERT INTO import_logs (id, file_name, file_type, status)
    VALUES (?, ?, ?, 'processing')
  `).run(logId, filePath, options.type);

  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = options.sheetName || workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    if (!worksheet) {
      throw new Error(`找不到工作表: ${sheetName}`);
    }

    const data = XLSX.utils.sheet_to_json<any>(worksheet);
    summary.totalRecords = data.length;

    if (data.length === 0) {
      throw new Error('工作表中没有数据');
    }

    let successCount = 0;
    let errorCount = 0;
    const allErrors: ImportError[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2;

      try {
        if (options.type === 'budget') {
          const validation = validateBudgetRow(row, rowNum);
          if (!validation.isValid) {
            allErrors.push(...validation.errors);
            errorCount++;
            continue;
          }

          const amount = parseNumber(row['预算金额'])!;
          const threshold = parseNumber(row['阈值']) ?? 0.8;
          const period = String(row['期间'] || options.period || '2024');
          const budgetType = String(row['预算类型'] || '运营');

          createOrUpdateBudget(
            String(row['部门']),
            period,
            budgetType,
            amount,
            threshold,
            String(row['描述']) || ''
          );
          successCount++;
        } else if (options.type === 'purchase') {
          const validation = validatePurchaseRow(row, rowNum);
          if (!validation.isValid) {
            allErrors.push(...validation.errors);
            errorCount++;
            continue;
          }

          const amount = parseNumber(row['申请金额'])!;

          createPurchaseRequest({
            requestNo: String(row['申请单号']),
            departmentName: String(row['部门']),
            itemName: String(row['物品名称']),
            requestedAmount: amount,
            requestDate: parseDate(row['申请日期']),
            requester: String(row['申请人']) || undefined,
            description: String(row['描述']) || undefined,
            period: String(row['期间']) || undefined,
            budgetType: String(row['预算类型']) || undefined
          });
          successCount++;
        } else if (options.type === 'payment') {
          const validation = validatePaymentRow(row, rowNum);
          if (!validation.isValid) {
            allErrors.push(...validation.errors);
            errorCount++;
            continue;
          }

          const amount = parseNumber(row['付款金额'])!;

          createContractPayment({
            paymentNo: String(row['付款单号']),
            contractNo: String(row['合同号']) || undefined,
            departmentName: String(row['部门']),
            amount: amount,
            paymentDate: parseDate(row['付款日期']),
            payee: String(row['收款方']) || undefined,
            description: String(row['描述']) || undefined,
            requestNo: String(row['申请单号']) || undefined,
            period: String(row['期间']) || undefined,
            budgetType: String(row['预算类型']) || undefined
          });
          successCount++;
        }
      } catch (error) {
        errorCount++;
        
        if (error instanceof BudgetAlreadyProcessedError) {
          allErrors.push({
            row: rowNum,
            field: 'id',
            message: error.message,
          });
        } else {
          allErrors.push({
            row: rowNum,
            field: 'general',
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    summary.successCount = successCount;
    summary.errorCount = errorCount;
    summary.errors = allErrors;

    db.prepare(`
      UPDATE import_logs 
      SET total_records = ?, success_count = ?, error_count = ?, status = ?, error_message = ?
      WHERE id = ?
    `).run(
      summary.totalRecords,
      summary.successCount,
      summary.errorCount,
      summary.errorCount > 0 ? 'completed_with_errors' : 'completed',
      summary.errors.length > 0 ? JSON.stringify(summary.errors.slice(0, 10)) : null,
      logId
    );

    return summary;
  } catch (error) {
    db.prepare(`
      UPDATE import_logs 
      SET status = 'failed', error_message = ?
      WHERE id = ?
    `).run(error instanceof Error ? error.message : String(error), logId);
    
    throw error;
  }
}

export function generateTemplate(type: ImportType): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  
  let sampleData: any[] = [];

  if (type === 'budget') {
    sampleData = [
      { '部门': '财务部', '期间': '2024', '预算类型': '运营', '预算金额': 100000, '阈值': 0.8, '描述': '年度运营预算' },
      { '部门': '市场部', '期间': '2024', '预算类型': '运营', '预算金额': 50000, '阈值': 0.8, '描述': '年度运营预算' }
    ];
  } else if (type === 'purchase') {
    sampleData = [
      { '申请单号': 'PR2024001', '部门': '市场部', '物品名称': '办公设备', '申请金额': 25000, '申请日期': '2024-01-15', '申请人': '张三', '期间': '2024', '预算类型': '运营', '描述': '笔记本电脑采购' }
    ];
  } else if (type === 'payment') {
    sampleData = [
      { '付款单号': 'PAY2024001', '合同号': 'CT2024001', '部门': '市场部', '申请单号': 'PR2024001', '付款金额': 25000, '付款日期': '2024-01-20', '收款方': 'XX科技公司', '期间': '2024', '预算类型': '运营', '描述': '设备采购款' }
    ];
  }

  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  XLSX.utils.book_append_sheet(workbook, worksheet, '数据');

  return workbook;
}

export function saveTemplate(type: ImportType, outputPath: string): void {
  const workbook = generateTemplate(type);
  XLSX.writeFile(workbook, outputPath);
}

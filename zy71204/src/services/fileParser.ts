import * as XLSX from 'xlsx';
import { Bill, ImportResult, ImportFileType } from '@/types/bill';
import { isValid, parse } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

interface RawBillData {
  票据编号?: string;
  billNo?: string;
  质押状态?: string;
  pledgeStatus?: string;
  到期日?: string;
  maturityDate?: string;
  原始到期日?: string;
  originalMaturityDate?: string;
  保证金?: string | number;
  margin?: string | number;
  释放申请?: string;
  releaseApplication?: string;
  占用报告?: string;
  occupancyReport?: string;
  [key: string]: string | number | undefined;
}

const detectFileType = (fileName: string): ImportFileType => {
  const ext = fileName.toLowerCase().split('.').pop();
  if (ext === 'csv') return 'csv';
  if (['xlsx', 'xls', 'xlsm'].includes(ext || '')) return 'excel';
  return 'excel';
};

const normalizeFieldName = (key: string): string => {
  const keyMap: Record<string, string> = {
    '票据编号': 'billNo',
    '票号': 'billNo',
    '票据号': 'billNo',
    '质押状态': 'pledgeStatus',
    '状态': 'pledgeStatus',
    '到期日': 'maturityDate',
    '到期日期': 'maturityDate',
    '原始到期日': 'originalMaturityDate',
    '保证金': 'margin',
    '保证金金额': 'margin',
    '释放申请': 'releaseApplication',
    '释放申请编号': 'releaseApplication',
    '占用报告': 'occupancyReport',
    '占用报告编号': 'occupancyReport',
  };
  return keyMap[key] || key;
};

const normalizeData = (raw: RawBillData): Partial<Bill> => {
  const normalized: Record<string, string | number | undefined> = {};
  
  for (const [key, value] of Object.entries(raw)) {
    const normalizedKey = normalizeFieldName(key.trim());
    normalized[normalizedKey] = typeof value === 'string' ? value.trim() : value;
  }
  
  return {
    billNo: (normalized.billNo as string) || '',
    pledgeStatus: (normalized.pledgeStatus as string) || '待处理',
    maturityDate: normalized.maturityDate as string,
    originalMaturityDate: normalized.originalMaturityDate as string | undefined,
    margin: parseFloat(normalized.margin as string) || 0,
    releaseApplication: normalized.releaseApplication as string | undefined,
    occupancyReport: normalized.occupancyReport as string | undefined,
  };
};

const parseDate = (dateStr: string): string | null => {
  if (!dateStr) return null;
  
  const formats = [
    'yyyy-MM-dd',
    'yyyy/MM/dd',
    'yyyy年MM月dd日',
    'MM/dd/yyyy',
    'dd-MM-yyyy',
  ];
  
  for (const format of formats) {
    try {
      const parsed = parse(dateStr, format, new Date(), { locale: zhCN });
      if (isValid(parsed)) {
        return parsed.toISOString().split('T')[0];
      }
    } catch {
      continue;
    }
  }
  
  if (/^\d+$/.test(dateStr)) {
    const excelDate = parseInt(dateStr);
    if (excelDate > 10000 && excelDate < 100000) {
      const jsDate = new Date((excelDate - 25569) * 86400 * 1000);
      if (isValid(jsDate)) {
        return jsDate.toISOString().split('T')[0];
      }
    }
  }
  
  return null;
};

const validateBillData = (data: Partial<Bill>, rowIndex: number): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!data.billNo || data.billNo.trim() === '') {
    errors.push(`第${rowIndex + 1}行: 票据编号不能为空`);
  } else if (data.billNo.length < 5) {
    warnings.push(`第${rowIndex + 1}行: 票据编号 "${data.billNo}" 格式可能不正确`);
  }
  
  if (!data.maturityDate) {
    errors.push(`第${rowIndex + 1}行: 到期日不能为空`);
  } else {
    const parsedDate = parseDate(data.maturityDate);
    if (!parsedDate) {
      errors.push(`第${rowIndex + 1}行: 到期日 "${data.maturityDate}" 格式不正确`);
    }
  }
  
  if (data.originalMaturityDate) {
    const parsedDate = parseDate(data.originalMaturityDate);
    if (!parsedDate) {
      errors.push(`第${rowIndex + 1}行: 原始到期日 "${data.originalMaturityDate}" 格式不正确`);
    }
  }
  
  if (data.margin === undefined || data.margin === null) {
    errors.push(`第${rowIndex + 1}行: 保证金不能为空`);
  } else if (isNaN(data.margin)) {
    errors.push(`第${rowIndex + 1}行: 保证金必须是数字`);
  } else if (data.margin < 0) {
    warnings.push(`第${rowIndex + 1}行: 保证金为负数，请确认`);
  }
  
  return { isValid: errors.length === 0, errors, warnings };
};

export const parseExcelFile = async (file: File): Promise<ImportResult> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet) as RawBillData[];
        
        resolve(processParsedData(jsonData, file.name));
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsBinaryString(file);
  });
};

export const parseCsvFile = async (file: File): Promise<ImportResult> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const csvData = e.target?.result as string;
        const workbook = XLSX.read(csvData, { type: 'string' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet) as RawBillData[];
        
        resolve(processParsedData(jsonData, file.name));
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file, 'UTF-8');
  });
};

const processParsedData = (jsonData: RawBillData[], fileName: string): ImportResult => {
  const validBills: Bill[] = [];
  const dirtyBills: Bill[] = [];
  const allErrors: string[] = [];
  const allWarnings: string[] = [];
  
  jsonData.forEach((raw, index) => {
    const normalized = normalizeData(raw);
    const validation = validateBillData(normalized, index);
    
    allWarnings.push(...validation.warnings);
    
    const maturityDate = parseDate(normalized.maturityDate || '') || new Date().toISOString().split('T')[0];
    const originalMaturityDate = normalized.originalMaturityDate 
      ? parseDate(normalized.originalMaturityDate) || undefined
      : undefined;
    
    const bill: Bill = {
      id: `bill_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 5)}`,
      billNo: normalized.billNo || `UNKNOWN_${index}`,
      pledgeStatus: normalized.pledgeStatus || '待处理',
      maturityDate,
      originalMaturityDate,
      margin: normalized.margin || 0,
      releaseApplication: normalized.releaseApplication,
      occupancyReport: normalized.occupancyReport,
      status: 'pending',
      statusHistory: [
        {
          id: `hist_${Date.now()}_${index}`,
          status: 'pending',
          timestamp: new Date().toISOString(),
          operator: 'SYSTEM',
          reason: '数据导入',
        }
      ],
      exceptions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sourceFile: fileName,
      isDirty: !validation.isValid,
      dirtyReason: validation.errors.join('; ') || undefined,
      calculatedOccupancy: normalized.margin || 0,
    };
    
    if (validation.isValid) {
      validBills.push(bill);
    } else {
      allErrors.push(...validation.errors);
      dirtyBills.push(bill);
    }
  });
  
  return {
    success: true,
    total: jsonData.length,
    validCount: validBills.length,
    dirtyCount: dirtyBills.length,
    validBills,
    dirtyBills,
    errors: allErrors,
    warnings: allWarnings,
  };
};

export const parseFile = async (file: File): Promise<ImportResult> => {
  const fileType = detectFileType(file.name);
  
  if (fileType === 'csv') {
    return parseCsvFile(file);
  } else {
    return parseExcelFile(file);
  }
};

export const validateAndMergeBills = (existingBills: Bill[], newBills: Bill[]): Bill[] => {
  const merged = [...existingBills];
  
  for (const newBill of newBills) {
    const existingIndex = merged.findIndex(b => b.billNo === newBill.billNo && !b.isDirty);
    
    if (existingIndex >= 0) {
      const existing = merged[existingIndex];
      
      if (newBill.releaseApplication && !existing.releaseApplication) {
        merged[existingIndex] = {
          ...existing,
          releaseApplication: newBill.releaseApplication,
          updatedAt: new Date().toISOString(),
          statusHistory: [
            ...existing.statusHistory,
            {
              id: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              status: existing.status,
              timestamp: new Date().toISOString(),
              operator: 'SYSTEM',
              reason: `补传释放申请: ${newBill.releaseApplication}`,
            }
          ],
        };
      }
      
      if (newBill.occupancyReport && !existing.occupancyReport) {
        merged[existingIndex] = {
          ...merged[existingIndex],
          occupancyReport: newBill.occupancyReport,
          updatedAt: new Date().toISOString(),
        };
      }
      
      if (newBill.maturityDate !== existing.maturityDate && !existing.originalMaturityDate) {
        merged[existingIndex] = {
          ...merged[existingIndex],
          originalMaturityDate: existing.maturityDate,
          maturityDate: newBill.maturityDate,
          updatedAt: new Date().toISOString(),
          statusHistory: [
            ...merged[existingIndex].statusHistory,
            {
              id: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              status: merged[existingIndex].status,
              timestamp: new Date().toISOString(),
              operator: 'SYSTEM',
              reason: `到期日变更: ${existing.maturityDate} → ${newBill.maturityDate}`,
            }
          ],
        };
      }
    } else {
      merged.push(newBill);
    }
  }
  
  return merged;
};

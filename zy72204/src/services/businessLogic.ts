import { CounterTransaction, EmailSupplement, SplitInfo, DiffRecord } from '../types';
import { BUSINESS_RULES } from '../constants/businessRules';

const COLUMN_MAPPINGS: Record<string, string> = {
  '柜台流水尾号': 'tailNumber',
  '流水尾号': 'tailNumber',
  '尾号': 'tailNumber',
  'tailNumber': 'tailNumber',
  'tail_number': 'tailNumber',

  '业务号': 'businessNumber',
  '业务编号': 'businessNumber',
  'businessNumber': 'businessNumber',
  'business_number': 'businessNumber',

  '交易日期': 'transactionDate',
  '日期': 'transactionDate',
  '成交日期': 'transactionDate',
  'transactionDate': 'transactionDate',
  'transaction_date': 'transactionDate',

  '金额': 'amount',
  '金额(元)': 'amount',
  '金额（元）': 'amount',
  '交易金额': 'amount',
  'amount': 'amount',

  '金额类型': 'amountType',
  '类型': 'amountType',
  '交易类型': 'amountType',
  'amountType': 'amountType',
  'amount_type': 'amountType',

  '对手方': 'counterparty',
  '交易对手': 'counterparty',
  '对手': 'counterparty',
  'counterparty': 'counterparty',

  '备注': 'remark',
  '备注说明': 'remark',
  '说明': 'remark',
  'remark': 'remark',
};

const AMOUNT_TYPE_MAPPINGS: Record<string, string> = {
  '本金': 'PRINCIPAL',
  '手续费': 'FEE',
  '费用': 'FEE',
  '合计': 'COMBINED',
  '综合': 'COMBINED',
  'PRINCIPAL': 'PRINCIPAL',
  'FEE': 'FEE',
  'COMBINED': 'COMBINED',
};

export function mapColumnHeaders(rawHeaders: string[]): {
  mapped: Record<string, string>;
  unmapped: string[];
} {
  const mapped: Record<string, string> = {};
  const unmapped: string[] = [];

  for (const header of rawHeaders) {
    const trimmed = header.trim();
    if (COLUMN_MAPPINGS[trimmed]) {
      mapped[trimmed] = COLUMN_MAPPINGS[trimmed];
    } else {
      const lowerKey = trimmed.toLowerCase();
      const found = Object.keys(COLUMN_MAPPINGS).find(
        k => k.toLowerCase() === lowerKey
      );
      if (found) {
        mapped[trimmed] = COLUMN_MAPPINGS[found];
      } else {
        unmapped.push(trimmed);
      }
    }
  }

  return { mapped, unmapped };
}

export function normalizeImportRow(
  rawRow: Record<string, string>,
  headerMapping: Record<string, string>,
  _rowNumber: number
): {
  normalized: Record<string, string>;
  rawSource: Record<string, string>;
  missingFields: string[];
} {
  const normalized: Record<string, string> = {};
  const rawSource: Record<string, string> = {};
  const requiredFields = BUSINESS_RULES.VALIDATION.REQUIRED_FIELDS as readonly string[];
  const missingFields: string[] = [];

  for (const [rawHeader, rawValue] of Object.entries(rawRow)) {
    const trimmedHeader = rawHeader.trim();
    const trimmedValue = (rawValue || '').trim();
    rawSource[trimmedHeader] = trimmedValue;

    const internalField = headerMapping[trimmedHeader];
    if (internalField) {
      normalized[internalField] = trimmedValue;
    }
  }

  for (const field of requiredFields) {
    if (!normalized[field] || normalized[field] === '') {
      missingFields.push(field);
    }
  }

  if (normalized.amountType && AMOUNT_TYPE_MAPPINGS[normalized.amountType]) {
    normalized.amountType = AMOUNT_TYPE_MAPPINGS[normalized.amountType];
  }

  return { normalized, rawSource, missingFields };
}

export function validateImport(record: any): { valid: boolean; error?: string } {
  const { VALIDATION, ERROR_MESSAGES } = BUSINESS_RULES;

  if (!record.tailNumber) {
    return { valid: false, error: ERROR_MESSAGES.MISSING_TAIL_NUMBER };
  }
  if (!record.businessNumber) {
    return { valid: false, error: ERROR_MESSAGES.MISSING_BUSINESS_NUMBER };
  }
  if (!record.transactionDate) {
    return { valid: false, error: ERROR_MESSAGES.MISSING_TRANSACTION_DATE };
  }
  if (!record.amount && record.amount !== 0) {
    return { valid: false, error: ERROR_MESSAGES.MISSING_AMOUNT };
  }
  const amount = parseFloat(String(record.amount).replace(/,/g, ''));
  if (isNaN(amount) || amount <= VALIDATION.AMOUNT_MIN) {
    return { valid: false, error: ERROR_MESSAGES.INVALID_AMOUNT };
  }

  return { valid: true };
}

export function detectSplit(transactions: CounterTransaction[]): SplitInfo | null {
  const { SPLIT_DETECTION } = BUSINESS_RULES;

  if (!SPLIT_DETECTION.ENABLED) return null;

  const principal = transactions.find(t => t.transactionType === 'PRINCIPAL');
  const fee = transactions.find(t => t.transactionType === 'FEE');

  if (principal && fee) {
    return {
      businessNumber: principal.businessNumber,
      principalId: principal.id,
      feeId: fee.id,
      principalAmount: principal.amount,
      feeAmount: fee.amount,
      totalAmount: principal.amount + fee.amount,
      isMatched: true,
      status: 'PENDING_REVIEW',
    };
  }

  return null;
}

export function generateDiffRecords(
  transactions: CounterTransaction[],
  email: EmailSupplement
): Omit<DiffRecord, 'id' | 'createdAt'>[] {
  const diffs: Omit<DiffRecord, 'id' | 'createdAt'>[] = [];

  if (transactions.length === 0) return diffs;

  const emailContent = email.supplementContent;

  for (const transaction of transactions) {
    if (transaction.remark && !emailContent.includes(transaction.remark)) {
      diffs.push({
        businessNumber: transaction.businessNumber,
        fieldName: 'remark',
        counterValue: transaction.remark,
        emailValue: '邮件中未提及',
        resolved: false,
      });
    }
  }

  const totalCounterAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
  const emailAmountMatch = emailContent.match(/(\d+(?:\.\d+)?)/g);
  
  if (emailAmountMatch) {
    const emailAmounts = emailAmountMatch.map(Number).filter(n => n > 0);
    const maxEmailAmount = Math.max(...emailAmounts);
    
    if (maxEmailAmount > 0 && Math.abs(maxEmailAmount - totalCounterAmount) > 0.01) {
      diffs.push({
        businessNumber: transactions[0].businessNumber,
        fieldName: 'amount',
        counterValue: totalCounterAmount.toString(),
        emailValue: maxEmailAmount.toString(),
        resolved: false,
      });
    }
  }

  return diffs;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function getUserFriendlyError(error: any): string {
  if (typeof error === 'string') return error;
  
  if (error?.message) {
    if (error.message.includes('tailNumber')) {
      return BUSINESS_RULES.ERROR_MESSAGES.MISSING_TAIL_NUMBER;
    }
    if (error.message.includes('businessNumber')) {
      return BUSINESS_RULES.ERROR_MESSAGES.MISSING_BUSINESS_NUMBER;
    }
    if (error.message.includes('amount')) {
      return BUSINESS_RULES.ERROR_MESSAGES.INVALID_AMOUNT;
    }
    return error.message;
  }

  return '操作失败，请检查输入数据后重试';
}

export function checkWorkflowPermission(
  currentStep: string,
  action: string
): { allowed: boolean; message?: string } {
  const stepIndex = BUSINESS_RULES.WORKFLOW.STEPS.findIndex(
    s => s.key === currentStep
  );

  switch (action) {
    case 'import_email':
      if (stepIndex < 0) {
        return { allowed: false, message: '请先导入柜台流水' };
      }
      if (stepIndex >= 1) {
        return { allowed: false, message: '补充邮件已导入，请勿重复操作' };
      }
      return { allowed: true };

    case 'confirm_split':
      if (stepIndex < 1) {
        return { allowed: false, message: '请先完成补充邮件核对' };
      }
      return { allowed: true };

    case 'resolve_diff':
      if (stepIndex < 1) {
        return { allowed: false, message: '请先完成补充邮件核对' };
      }
      return { allowed: true };

    default:
      return { allowed: true };
  }
}

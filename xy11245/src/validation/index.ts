import { ErrorType } from '../database';

export interface ValidationError {
  type: ErrorType;
  message: string;
  suggestion: string;
}

export interface ValidationResult<T> {
  valid: boolean;
  data?: T;
  error?: ValidationError;
}

const VALID_CONDITIONS = ['全新', '九成新', '八成新', '七成新', '六成新', '其他'];
const VALID_GRADES = ['幼儿园', '一年级', '二年级', '三年级', '四年级', '五年级', '六年级', 
                     '初一', '初二', '初三', '初中', '高一', '高二', '高三', '高中', '通用'];

export const isValidIsbn = (isbn: string): boolean => {
  const cleanIsbn = isbn.replace(/[-\s]/g, '');
  
  if (!/^\d{10}(\d{3})?$/.test(cleanIsbn)) {
    return false;
  }

  return true;
};

export const validateIsbn = (isbn: string): ValidationError | null => {
  if (!isbn || isbn.trim() === '') {
    return {
      type: 'missing_required',
      message: 'ISBN 不能为空',
      suggestion: '请扫描书籍条形码或手动输入完整 ISBN'
    };
  }

  if (!isValidIsbn(isbn)) {
    return {
      type: 'invalid_isbn',
      message: `ISBN 格式无效: ${isbn}`,
      suggestion: '请检查 ISBN 是否为 10 位或 13 位有效数字，或使用标准格式（如 978-7-111-54493-7）'
    };
  }

  return null;
};

export const validateCondition = (condition: string): ValidationError | null => {
  if (!condition || condition.trim() === '') {
    return null;
  }

  if (!VALID_CONDITIONS.includes(condition.trim())) {
    return {
      type: 'invalid_condition',
      message: `品相 "${condition}" 不是标准值`,
      suggestion: `请从以下选项中选择: ${VALID_CONDITIONS.join('、')}`
    };
  }

  return null;
};

export const validateGrade = (grade: string): ValidationError | null => {
  if (!grade || grade.trim() === '') {
    return null;
  }

  if (!VALID_GRADES.includes(grade.trim())) {
    return {
      type: 'invalid_grade',
      message: `年级 "${grade}" 不是标准值`,
      suggestion: `请从以下选项中选择: ${VALID_GRADES.join('、')}`
    };
  }

  return null;
};

export interface RawBookData {
  isbn: string;
  title?: string;
  condition?: string;
  grade?: string;
  donor?: string;
  scanned_at?: string;
  [key: string]: string | undefined;
}

export const validateBookData = (data: RawBookData): ValidationResult<RawBookData> => {
  const errors: ValidationError[] = [];

  const isbnError = validateIsbn(data.isbn);
  if (isbnError) {
    errors.push(isbnError);
  }

  const conditionError = validateCondition(data.condition || '');
  if (conditionError) {
    errors.push(conditionError);
  }

  const gradeError = validateGrade(data.grade || '');
  if (gradeError) {
    errors.push(gradeError);
  }

  if (errors.length > 0) {
    const combinedMessage = errors.map(e => e.message).join('; ');
    const combinedSuggestion = errors.map(e => e.suggestion).join('; ');
    
    return {
      valid: false,
      error: {
        type: errors[0].type,
        message: combinedMessage,
        suggestion: combinedSuggestion
      }
    };
  }

  return {
    valid: true,
    data: {
      ...data,
      isbn: data.isbn.replace(/[-\s]/g, ''),
      condition: data.condition?.trim() || '其他',
      grade: data.grade?.trim() || '通用'
    }
  };
};

export const normalizeBookData = (data: Record<string, string | undefined>): RawBookData => {
  const findKey = (keys: string[]): string | undefined => {
    for (const key of keys) {
      const found = Object.keys(data).find(k => 
        k.toLowerCase().includes(key.toLowerCase()) || 
        key.toLowerCase().includes(k.toLowerCase())
      );
      if (found) return found;
    }
    return undefined;
  };

  return {
    isbn: data[findKey(['isbn', 'ISBN', '条码']) || 'isbn'] || '',
    title: data[findKey(['title', '书名', '名称']) || 'title'],
    condition: data[findKey(['condition', '品相', '成色']) || 'condition'],
    grade: data[findKey(['grade', '年级', '适用年级']) || 'grade'],
    donor: data[findKey(['donor', '捐赠人', '捐赠']) || 'donor'],
    scanned_at: data[findKey(['scanned_at', '扫码时间', '时间']) || 'scanned_at']
  };
};

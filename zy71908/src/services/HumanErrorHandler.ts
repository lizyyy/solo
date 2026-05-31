import type { HumanError } from '../types';
import { SOURCE_LABELS } from '../types';

type ErrorCode = 
  | 'TRANSPOSITION_MISMATCH'
  | 'DUPLICATE_RECORD'
  | 'VERSION_SAVE_FAILED'
  | 'STORAGE_WRITE_FAILED'
  | 'STORAGE_READ_FAILED'
  | 'EXPORT_FAILED'
  | 'INVALID_DATE_RANGE'
  | 'NO_RECORDS_TO_EXPORT'
  | 'FILTER_STATE_INVALID'
  | 'SOURCE_DATA_MISSING'
  | 'UNKNOWN_ERROR';

export interface ErrorContext {
  fieldName?: string;
  userAction?: string;
  recordId?: string;
  studentName?: string;
  pieceName?: string;
  sourceType?: string;
  expectedValue?: string;
  actualValue?: string;
  handlerName?: string;
}

export class HumanErrorHandler {
  private static errorMap: Record<ErrorCode, (ctx?: ErrorContext) => HumanError> = {
    TRANSPOSITION_MISMATCH: (ctx) => ({
      title: '转调不一致',
      message: this.buildTranspositionMessage(ctx),
      suggestion: '请核对三个数据源的转调值，确保节拍器记录、选曲表、曲谱PDF的转调统一。如有疑问，请联系该学生的任课老师确认。',
      severity: 'warning',
      fieldName: ctx?.fieldName,
    }),

    DUPLICATE_RECORD: (ctx) => ({
      title: '发现重复记录',
      message: this.buildDuplicateMessage(ctx),
      suggestion: ctx?.handlerName 
        ? `请联系 ${ctx.handlerName} 确认哪条记录是正确的，然后合并重复数据。`
        : '请联系该学生的任课老师确认，合并重复数据。',
      severity: 'warning',
      fieldName: ctx?.fieldName,
    }),

    VERSION_SAVE_FAILED: (ctx) => ({
      title: '版本留底失败',
      message: this.buildVersionSaveMessage(ctx),
      suggestion: '请检查网络连接后重试。如果问题持续，请联系技术支持，不要重复提交以避免数据混乱。',
      severity: 'error',
      fieldName: ctx?.fieldName,
    }),

    STORAGE_WRITE_FAILED: () => ({
      title: '保存失败',
      message: '数据保存到本地时出错，可能是浏览器存储空间已满。',
      suggestion: '请尝试清理浏览器缓存，或使用其他浏览器重试。重要数据请先手动记录。',
      severity: 'error',
    }),

    STORAGE_READ_FAILED: () => ({
      title: '读取失败',
      message: '无法读取本地存储的数据，可能是数据已损坏。',
      suggestion: '请刷新页面重试。如果问题持续，可能需要重新导入数据。',
      severity: 'error',
    }),

    EXPORT_FAILED: () => ({
      title: '导出失败',
      message: '排练小结生成PDF时出错。',
      suggestion: '请减少导出的记录数量，或尝试使用其他浏览器导出。如仍有问题，请联系技术支持。',
      severity: 'error',
    }),

    INVALID_DATE_RANGE: () => ({
      title: '日期范围无效',
      message: '开始日期不能晚于结束日期。',
      suggestion: '请检查选择的日期范围，确保开始日期在结束日期之前。',
      severity: 'warning',
    }),

    NO_RECORDS_TO_EXPORT: () => ({
      title: '没有可导出的记录',
      message: '当前筛选条件下没有找到任何记录，无法生成排练小结。',
      suggestion: '请调整筛选条件，确保至少有一条记录被选中后再导出。',
      severity: 'info',
    }),

    FILTER_STATE_INVALID: () => ({
      title: '筛选条件无效',
      message: 'URL中的筛选条件格式不正确，已重置为默认筛选。',
      suggestion: '请重新设置筛选条件，或使用页面上的筛选器进行操作。',
      severity: 'warning',
    }),

    SOURCE_DATA_MISSING: (ctx) => ({
      title: '数据源不完整',
      message: this.buildSourceMissingMessage(ctx),
      suggestion: ctx?.sourceType 
        ? `请补充${SOURCE_LABELS[ctx.sourceType as keyof typeof SOURCE_LABELS] || ctx.sourceType}的相关数据。`
        : '请补充完整三个数据源的信息。',
      severity: 'warning',
      fieldName: ctx?.fieldName,
    }),

    UNKNOWN_ERROR: (ctx) => ({
      title: '操作失败',
      message: ctx?.userAction 
        ? `${ctx.userAction}时发生了未知错误。` 
        : '发生了未知错误。',
      suggestion: '请刷新页面重试。如果问题持续，请联系技术支持并描述您的操作步骤。',
      severity: 'error',
    }),
  };

  private static buildTranspositionMessage(ctx?: ErrorContext): string {
    if (!ctx) return '三个数据源的转调值不一致。';
    
    const parts: string[] = [];
    if (ctx.studentName && ctx.pieceName) {
      parts.push(`${ctx.studentName} 的《${ctx.pieceName}》`);
    }
    
    if (ctx.expectedValue && ctx.actualValue) {
      parts.push(`转调不一致：应为 ${ctx.expectedValue}，实际为 ${ctx.actualValue}`);
    } else {
      parts.push('转调值在不同数据源中不一致');
    }
    
    if (ctx.sourceType) {
      const label = SOURCE_LABELS[ctx.sourceType as keyof typeof SOURCE_LABELS] || ctx.sourceType;
      parts.push(`（${label}）`);
    }
    
    return parts.join('') + '。';
  }

  private static buildDuplicateMessage(ctx?: ErrorContext): string {
    if (!ctx) return '系统检测到重复的归档记录。';
    
    const parts: string[] = [];
    if (ctx.studentName && ctx.pieceName) {
      parts.push(`${ctx.studentName} 的《${ctx.pieceName}》`);
    } else {
      parts.push('该曲目');
    }
    parts.push('已有一条归档记录，请勿重复录入。');
    
    if (ctx.handlerName) {
      parts.push(`建议先联系 ${ctx.handlerName} 确认。`);
    }
    
    return parts.join('');
  }

  private static buildVersionSaveMessage(ctx?: ErrorContext): string {
    if (!ctx?.userAction) return '保存版本历史时失败。';
    
    const actionMap: Record<string, string> = {
      '修改选曲表': '修改选曲表内容',
      '更新转调': '更新转调信息',
      '补充材料': '补充归档材料',
    };
    
    const action = actionMap[ctx.userAction] || ctx.userAction;
    return `${action}时，自动保存版本历史失败。您的修改已保存，但版本对比功能可能受影响。`;
  }

  private static buildSourceMissingMessage(ctx?: ErrorContext): string {
    if (!ctx?.sourceType) return '部分数据源的信息还不完整。';
    
    const label = SOURCE_LABELS[ctx.sourceType as keyof typeof SOURCE_LABELS] || ctx.sourceType;
    const parts: string[] = [`缺少${label}的数据`];
    
    if (ctx.studentName && ctx.pieceName) {
      parts.unshift(`${ctx.studentName} 的《${ctx.pieceName}》`);
    }
    
    return parts.join('，') + '。';
  }

  static translate(error: Error | string, context?: ErrorContext): HumanError {
    const errorCode = this.extractErrorCode(error);
    const handler = this.errorMap[errorCode] || this.errorMap.UNKNOWN_ERROR;
    
    try {
      return handler(context);
    } catch {
      return this.errorMap.UNKNOWN_ERROR(context);
    }
  }

  private static extractErrorCode(error: Error | string): ErrorCode {
    const message = typeof error === 'string' ? error : error.message;
    
    const codePatterns: [RegExp, ErrorCode][] = [
      [/transposition.*mismatch/i, 'TRANSPOSITION_MISMATCH'],
      [/duplicate.*record/i, 'DUPLICATE_RECORD'],
      [/version.*save/i, 'VERSION_SAVE_FAILED'],
      [/storage.*write/i, 'STORAGE_WRITE_FAILED'],
      [/storage.*read/i, 'STORAGE_READ_FAILED'],
      [/export.*fail/i, 'EXPORT_FAILED'],
      [/date.*range.*invalid/i, 'INVALID_DATE_RANGE'],
      [/no.*records.*export/i, 'NO_RECORDS_TO_EXPORT'],
      [/filter.*state.*invalid/i, 'FILTER_STATE_INVALID'],
      [/source.*missing/i, 'SOURCE_DATA_MISSING'],
    ];

    for (const [pattern, code] of codePatterns) {
      if (pattern.test(message)) {
        return code;
      }
    }

    if (typeof error !== 'string' && error.name && this.errorMap[error.name as ErrorCode]) {
      return error.name as ErrorCode;
    }

    return 'UNKNOWN_ERROR';
  }

  static createError(code: ErrorCode, context?: ErrorContext): HumanError {
    const handler = this.errorMap[code] || this.errorMap.UNKNOWN_ERROR;
    return handler(context);
  }

  static toToastMessage(humanError: HumanError): {
    title: string;
    description: string;
    variant: 'default' | 'destructive';
    action?: { label: string; onClick: () => void };
  } {
    return {
      title: humanError.title,
      description: humanError.message + '\n' + humanError.suggestion,
      variant: humanError.severity === 'error' ? 'destructive' : 'default',
    };
  }
}

export class AppError extends Error {
  code: ErrorCode;
  context?: ErrorContext;

  constructor(code: ErrorCode, message?: string, context?: ErrorContext) {
    super(message || code);
    this.name = code;
    this.code = code;
    this.context = context;
  }
}

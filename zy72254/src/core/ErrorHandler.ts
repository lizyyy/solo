import { UserFriendlyError } from '../types';

export type ErrorCode =
  | 'IMPORT_DUPLICATE'
  | 'CONFLICT_DETECTED'
  | 'INVALID_RANGEFINDER'
  | 'MISSING_CAD_DATA'
  | 'INVALID_GEOMETRY'
  | 'PERMISSION_DENIED'
  | 'NOT_FOUND'
  | 'INVALID_OPERATION'
  | 'ROLLBACK_FAILED'
  | 'MERGE_FAILED'
  | 'VALIDATION_ERROR';

interface ErrorDefinition {
  message: string;
  suggestion: string;
  detailsTemplate?: (details: Record<string, unknown>) => string;
}

const ERROR_DEFINITIONS: Record<ErrorCode, ErrorDefinition> = {
  IMPORT_DUPLICATE: {
    message: '检测到重复导入的CAD图层',
    suggestion: '系统已自动跳过重复图层，请检查导入源确认是否需要更新现有数据',
    detailsTemplate: (details) =>
      `图层"${details.layerName}"在导入源"${details.source}"中已存在，操作人：${details.operator}`
  },

  CONFLICT_DETECTED: {
    message: '发现障碍物名称冲突',
    suggestion: '请点击冲突标记查看详情，选择合并、保留或留待培训学员复核',
    detailsTemplate: (details) =>
      `障碍物"${details.name1}"(${details.id1})和"${details.name2}"(${details.id2})可能是同一物体`
  },

  INVALID_RANGEFINDER: {
    message: '测距仪记录数据无效',
    suggestion: '请检查测量距离与坐标是否匹配，测量人员信息是否填写完整',
    detailsTemplate: (details) =>
      `误差${Number(details.diff).toFixed(2)}米超过允许范围${details.tolerance}米`
  },

  MISSING_CAD_DATA: {
    message: '缺少CAD图层数据',
    suggestion: '请先导入CAD图层数据，再进行后续操作',
    detailsTemplate: (details) =>
      `操作"${details.operation}"需要先导入CAD图层`
  },

  INVALID_GEOMETRY: {
    message: '几何数据无效',
    suggestion: '请检查坐标点是否完整，至少需要3个点构成一个区域',
    detailsTemplate: (details) =>
      `仅提供了${details.pointCount}个坐标点`
  },

  PERMISSION_DENIED: {
    message: '没有操作权限',
    suggestion: '请联系管理员获取相应权限，或由授权人员执行此操作',
    detailsTemplate: (details) =>
      `用户"${details.user}"无权执行"${details.action}"操作`
  },

  NOT_FOUND: {
    message: '找不到指定的数据',
    suggestion: '请刷新页面或检查数据是否已被删除',
    detailsTemplate: (details) =>
      `未找到${details.type}：${details.id}`
  },

  INVALID_OPERATION: {
    message: '操作无效',
    suggestion: '请检查当前状态是否允许执行此操作',
    detailsTemplate: (details) =>
      `在"${details.currentStatus}"状态下不能执行"${details.operation}"操作`
  },

  ROLLBACK_FAILED: {
    message: '回滚操作失败',
    suggestion: '该变更可能已被后续操作覆盖，请检查历史记录',
    detailsTemplate: (details) =>
      `记录${details.recordId}：${details.reason}`
  },

  MERGE_FAILED: {
    message: '合并操作失败',
    suggestion: '请确认两个障碍物是否存在关联，或选择其他处理方式',
    detailsTemplate: (details) =>
      `无法合并${details.id1}和${details.id2}：${details.reason}`
  },

  VALIDATION_ERROR: {
    message: '数据校验失败',
    suggestion: '请检查必填字段是否填写完整，格式是否正确',
    detailsTemplate: (details) =>
      `${details.errors}`
  }
};

export function createError(
  code: ErrorCode,
  details: Record<string, unknown> = {}
): UserFriendlyError {
  const definition = ERROR_DEFINITIONS[code];

  return {
    code,
    message: definition.message,
    suggestion: definition.suggestion,
    details: definition.detailsTemplate
      ? { raw: details, formatted: definition.detailsTemplate(details) }
      : details,
    timestamp: Date.now()
  };
}

export function formatErrorForDisplay(error: UserFriendlyError): {
  title: string;
  content: string;
  suggestion: string;
  timestamp: string;
} {
  const time = new Date(error.timestamp);
  const timeStr = time.toLocaleString('zh-CN');

  let content = error.message;
  if (error.details) {
    if ('formatted' in error.details && typeof error.details.formatted === 'string') {
      content += `\n详细信息：${error.details.formatted}`;
    } else if (typeof error.details === 'object' && error.details !== null) {
      const parts = Object.entries(error.details)
        .filter(([key]) => key !== 'formatted')
        .map(([key, value]) => `${translateField(key)}: ${value}`);
      if (parts.length > 0) {
        content += `\n详细信息：${parts.join('，')}`;
      }
    }
  }

  return {
    title: error.message,
    content,
    suggestion: error.suggestion,
    timestamp: timeStr
  };
}

export function validateRequiredFields(
  data: Record<string, unknown>,
  requiredFields: string[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const field of requiredFields) {
    const value = data[field];
    if (value === null || value === undefined || value === '') {
      errors.push(`${translateField(field)}不能为空`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function translateField(field: string): string {
  const translations: Record<string, string> = {
    layerName: '图层名称',
    source: '数据来源',
    operator: '操作人',
    name1: '名称1',
    name2: '名称2',
    id1: 'ID1',
    id2: 'ID2',
    diff: '误差',
    tolerance: '允许误差',
    operation: '操作',
    pointCount: '点数量',
    user: '用户',
    action: '操作类型',
    type: '数据类型',
    id: 'ID',
    currentStatus: '当前状态',
    recordId: '记录ID',
    reason: '原因',
    errors: '错误信息',
    distance: '测量距离',
    measuredBy: '测量人',
    obstructionId: '障碍物ID',
    geometry: '几何数据',
    notes: '备注'
  };
  return translations[field] || field;
}

export class ErrorCollector {
  private errors: UserFriendlyError[] = [];

  add(error: UserFriendlyError): void {
    this.errors.push(error);
  }

  addError(code: ErrorCode, details?: Record<string, unknown>): void {
    this.errors.push(createError(code, details));
  }

  getAll(): UserFriendlyError[] {
    return [...this.errors];
  }

  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  getErrorCount(): number {
    return this.errors.length;
  }

  formatAll(): Array<ReturnType<typeof formatErrorForDisplay>> {
    return this.errors.map(formatErrorForDisplay);
  }

  clear(): void {
    this.errors = [];
  }

  throwIfErrors(): void {
    if (this.hasErrors()) {
      const formatted = this.formatAll();
      const messages = formatted.map(f => `[${f.timestamp}] ${f.content}`).join('\n');
      throw new Error(`操作过程中发生${this.errors.length}个错误：\n${messages}`);
    }
  }
}

export function wrapWithErrorHandling<T>(
  fn: () => T,
  errorCode: ErrorCode = 'VALIDATION_ERROR',
  errorDetails: Record<string, unknown> = {}
): T {
  try {
    return fn();
  } catch (error) {
    const userError = createError(errorCode, {
      ...errorDetails,
      reason: error instanceof Error ? error.message : String(error)
    });
    throw userError;
  }
}

export async function wrapAsyncWithErrorHandling<T>(
  fn: () => Promise<T>,
  errorCode: ErrorCode = 'VALIDATION_ERROR',
  errorDetails: Record<string, unknown> = {}
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const userError = createError(errorCode, {
      ...errorDetails,
      reason: error instanceof Error ? error.message : String(error)
    });
    throw userError;
  }
}

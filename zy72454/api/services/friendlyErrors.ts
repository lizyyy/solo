import { FriendlyError } from '../../shared/types.js';

const errorMap: Record<string, Omit<FriendlyError, 'details'>> = {
  BREAKPOINT_NOT_FOUND: {
    code: 'BREAKPOINT_NOT_FOUND',
    message: '找不到这个断点记录',
    suggestion: '请检查断点ID是否正确，或返回断点列表重新选择',
  },
  IMPORT_FILE_EMPTY: {
    code: 'IMPORT_FILE_EMPTY',
    message: '导入的文件是空的',
    suggestion: '请检查文件内容，确保至少包含一条公交刷卡时段数据',
  },
  IMPORT_FILE_FORMAT: {
    code: 'IMPORT_FILE_FORMAT',
    message: '文件格式不对，我读不懂',
    suggestion: '请使用 CSV 或 JSON 格式，列名要包含断点名称、位置、时段、日期、客流量',
  },
  INVALID_BREAKPOINT_DATA: {
    code: 'INVALID_BREAKPOINT_DATA',
    message: '断点数据填写不完整',
    suggestion: '请检查名称、位置、经纬度等必填项，不能留空',
  },
  STATUS_TRANSITION_INVALID: {
    code: 'STATUS_TRANSITION_INVALID',
    message: '当前状态不能直接跳到这个目标状态',
    suggestion: '请按照工作流顺序操作：导入→巡检→复核→确认',
  },
  DETOUR_MUST_REVIEW: {
    code: 'DETOUR_MUST_REVIEW',
    message: '有施工临时改道的断点必须经过居民代表复核',
    suggestion: '请先标记为"待复核"，不要直接归为正常，留给居民代表开会确认',
  },
  DUPLICATE_IMPORT: {
    code: 'DUPLICATE_IMPORT',
    message: '这批数据之前已经导过了',
    suggestion: '系统已自动跳过重复项，不会把数量翻倍，请查看导入报告确认',
  },
  RULE_NOT_FOUND: {
    code: 'RULE_NOT_FOUND',
    message: '找不到对应的边界规则',
    suggestion: '请检查规则ID，或在规则配置页面查看可用规则',
  },
  ROLLBACK_NO_SNAPSHOT: {
    code: 'ROLLBACK_NO_SNAPSHOT',
    message: '找不到可以回滚的历史快照',
    suggestion: '这条记录可能是刚创建的，还没有修改历史',
  },
  FIELD_NOT_EDITABLE: {
    code: 'FIELD_NOT_EDITABLE',
    message: '这个字段现在不能改',
    suggestion: '有些字段在特定状态下是锁定的，请先确认当前工作流阶段',
  },
};

export const createFriendlyError = (
  code: string,
  details?: string
): FriendlyError => {
  const mapped = errorMap[code];
  if (mapped) {
    return { ...mapped, details };
  }
  return {
    code,
    message: '出了点问题，请稍后再试',
    suggestion: '如果问题持续，请联系系统管理员',
    details,
  };
};

export const friendlyErrorMiddleware = (
  err: Error,
  _req: unknown,
  res: { status: (code: number) => { json: (body: unknown) => void }; json: (body: unknown) => void },
  _next: unknown
) => {
  const code = (err as { code?: string }).code || 'UNKNOWN_ERROR';
  const friendly = createFriendlyError(code, err.message);
  res.status(400).json({ error: friendly });
};

export default createFriendlyError;

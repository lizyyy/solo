import type { ErrorMessage } from '../types/data';

export const ERROR_MESSAGES: Record<string, ErrorMessage> = {
  IDB_NOT_INITIALIZED: {
    code: 'IDB_NOT_INITIALIZED',
    message: '本地数据库还没准备好',
    suggestion: '请稍等几秒再试，如果还是不行可以刷新页面重新加载',
    contact: '联系技术组 @技术支持',
  },
  IDB_VERSION_ERR: {
    code: 'IDB_VERSION_ERR',
    message: '本地数据版本不兼容',
    suggestion: '请先导出当前数据备份，然后清除浏览器存储后重新导入',
    contact: '联系数据组 @数据专员',
  },
  IDB_QUOTA_EXCEEDED: {
    code: 'IDB_QUOTA_EXCEEDED',
    message: '本地存储空间不够了',
    suggestion: '请导出历史数据备份后，删除一些旧的游戏记录释放空间',
    contact: '联系技术组 @技术支持',
  },
  IMPORT_FORMAT_INVALID: {
    code: 'IMPORT_FORMAT_INVALID',
    message: '导入的文件格式不对',
    suggestion: '请检查文件是不是标准的JSON格式，字段是不是完整',
    contact: '联系数据组 @数据专员',
  },
  IMPORT_VERSION_MISMATCH: {
    code: 'IMPORT_VERSION_MISMATCH',
    message: '导入的数据版本和当前系统不匹配',
    suggestion: '请确认数据是从哪个版本导出的，可能需要先升级系统',
    contact: '联系数据组 @数据专员',
  },
  LEVEL_NOT_FOUND: {
    code: 'LEVEL_NOT_FOUND',
    message: '找不到这个关卡的配置',
    suggestion: '请检查关卡ID是否正确，或者需要先导入关卡配置',
    contact: '联系运营组 @关卡策划',
  },
  SCORE_TOO_HIGH: {
    code: 'SCORE_TOO_HIGH',
    message: '这个分数有点高得不太正常哦',
    suggestion: '系统检测到这个分数超出了正常范围，已经标记待复核，请不要着急提交',
    contact: '联系运营组 @数据审核员',
  },
  SCORE_DUPLICATE: {
    code: 'SCORE_DUPLICATE',
    message: '这位玩家已经提交过这个关卡的分数啦',
    suggestion: '每位玩家每个关卡只能记录一次有效分数，如果是重玩请注明原因',
    contact: '联系运营组 @活动负责人',
  },
  GAME_DISCONNECTED: {
    code: 'GAME_DISCONNECTED',
    message: '刚才的游戏好像意外中断了',
    suggestion: '别担心，进度已经自动保存，你可以选择继续上次的游戏或者重新开始',
    contact: '联系技术组 @技术支持',
  },
  EXPORT_NO_DATA: {
    code: 'EXPORT_NO_DATA',
    message: '当前筛选条件下没有数据可以导出',
    suggestion: '试试调整一下筛选条件，比如扩大时间范围或者清除状态筛选',
    contact: '联系数据组 @数据专员',
  },
  NETWORK_ERROR: {
    code: 'NETWORK_ERROR',
    message: '网络好像不太稳定',
    suggestion: '别担心，所有数据都存在本地，等网络恢复后再操作也可以',
    contact: '联系技术组 @技术支持',
  },
  UNKNOWN_ERROR: {
    code: 'UNKNOWN_ERROR',
    message: '出了点小问题，具体原因还不清楚',
    suggestion: '可以先试试刷新页面，如果问题还在请截图联系我们',
    contact: '联系技术组 @技术支持',
  },
  PERMISSION_DENIED: {
    code: 'PERMISSION_DENIED',
    message: '你没有权限执行这个操作',
    suggestion: '这个功能需要运营权限，如果需要使用请联系管理员开通',
    contact: '联系管理组 @系统管理员',
  },
  DATA_CORRUPTED: {
    code: 'DATA_CORRUPTED',
    message: '这条数据好像损坏了',
    suggestion: '可以尝试从历史版本恢复，或者联系数据组修复',
    contact: '联系数据组 @数据专员',
  },
  INVALID_OPERATION: {
    code: 'INVALID_OPERATION',
    message: '这个操作现在不能做',
    suggestion: '请检查游戏状态，比如游戏进行中不能导入数据，已复核的记录不能直接删除',
    contact: '联系运营组 @活动负责人',
  },
};

export function getFriendlyMessage(errorCode: string): ErrorMessage {
  return ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.UNKNOWN_ERROR;
}

export function getErrorMessage(errorCode: string): ErrorMessage {
  return getFriendlyMessage(errorCode);
}

export function handleError(error: Error | string): ErrorMessage {
  const code = typeof error === 'string' ? error : error.message;
  return getFriendlyMessage(code);
}

export class FriendlyError extends Error {
  public code: string;
  public userMessage: ErrorMessage;
  public originalError?: Error;

  constructor(code: string, originalError?: Error) {
    super(code);
    this.name = 'FriendlyError';
    this.code = code;
    this.userMessage = getFriendlyMessage(code);
    this.originalError = originalError;
  }

  toString(): string {
    return `${this.userMessage.message} - ${this.userMessage.suggestion}`;
  }
}

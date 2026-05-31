import { AccountFreezeRequest, ParameterIssue, ParameterSource } from '../types';

const EXPECTED_PARAMETERS = [
  'accountId',
  'accountName',
  'freezeReason',
  'reasonDetail',
  'riskScore'
];

const ALARM_RECORD_EXPECTED_PARAMS = [
  'alarmId',
  'alarmType',
  'alarmLevel',
  'triggerTime'
];

const OLD_API_EXPECTED_PARAMS = [
  'requestId',
  'operatorId',
  'timestamp'
];

export function validateClientParameters(request: AccountFreezeRequest): ParameterIssue[] {
  const issues: ParameterIssue[] = [];

  if (!request.clientParameters) {
    return issues;
  }

  const source = request.parameterSource || ParameterSource.UNKNOWN;
  const clientVersion = request.clientVersion || 'unknown';

  if (clientVersion.startsWith('v1.')) {
    issues.push({
      field: 'clientVersion',
      issue: `使用旧版本客户端 (${clientVersion})，建议升级到 v2.0+ 版本`,
      severity: 'WARNING',
      source,
      suggestedContact: '客户端开发组 - 张工'
    });
  }

  const params = request.clientParameters;

  switch (source) {
    case ParameterSource.ALARM_RECORD:
      issues.push(...validateAlarmRecordParams(params, source));
      break;
    case ParameterSource.OLD_API_DOCUMENT:
      issues.push(...validateOldApiParams(params, source));
      break;
    case ParameterSource.NEW_API:
      issues.push(...validateNewApiParams(params, source));
      break;
    default:
      issues.push({
        field: 'parameterSource',
        issue: '参数来源未知，无法校验参数完整性',
        severity: 'WARNING',
        source,
        suggestedContact: '接口对接人确认参数来源'
      });
  }

  EXPECTED_PARAMETERS.forEach(param => {
    if (params[param] === undefined || params[param] === null) {
      issues.push({
        field: param,
        issue: `核心参数 ${param} 缺失或为空`,
        severity: 'ERROR',
        source,
        suggestedContact: getSuggestedContact(source)
      });
    }
  });

  return issues;
}

function validateAlarmRecordParams(
  params: Record<string, unknown>,
  source: ParameterSource
): ParameterIssue[] {
  const issues: ParameterIssue[] = [];

  ALARM_RECORD_EXPECTED_PARAMS.forEach(param => {
    if (params[param] === undefined) {
      issues.push({
        field: param,
        issue: `报警记录参数 ${param} 缺失，该字段来自报警系统`,
        severity: 'WARNING',
        source,
        suggestedContact: '监控报警组 - 李工'
      });
    }
  });

  if (params.alarmLevel && typeof params.alarmLevel === 'string') {
    const validLevels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    if (!validLevels.includes(params.alarmLevel)) {
      issues.push({
        field: 'alarmLevel',
        issue: `报警级别值异常: ${params.alarmLevel}，有效值为: ${validLevels.join(', ')}`,
        severity: 'WARNING',
        source,
        suggestedContact: '监控报警组 - 李工'
      });
    }
  }

  return issues;
}

function validateOldApiParams(
  params: Record<string, unknown>,
  source: ParameterSource
): ParameterIssue[] {
  const issues: ParameterIssue[] = [];

  issues.push({
    field: 'apiVersion',
    issue: '使用旧版API文档参数格式，字段定义可能不完整',
    severity: 'WARNING',
    source,
    suggestedContact: 'API架构组 - 王工（建议迁移至新API）'
  });

  OLD_API_EXPECTED_PARAMS.forEach(param => {
    if (params[param] === undefined) {
      issues.push({
        field: param,
        issue: `旧版API参数 ${param} 缺失，该字段来自旧接口文档`,
        severity: 'ERROR',
        source,
        suggestedContact: 'API架构组 - 王工'
      });
    }
  });

  if (params.timestamp) {
    const ts = params.timestamp;
    if (typeof ts === 'string') {
      const date = new Date(ts);
      if (isNaN(date.getTime())) {
        issues.push({
          field: 'timestamp',
          issue: `旧版API时间戳格式错误: ${ts}，应为ISO格式字符串`,
          severity: 'ERROR',
          source,
          suggestedContact: 'API架构组 - 王工'
        });
      }
    }
  }

  return issues;
}

function validateNewApiParams(
  params: Record<string, unknown>,
  source: ParameterSource
): ParameterIssue[] {
  const issues: ParameterIssue[] = [];

  if (params.clientId && typeof params.clientId === 'string') {
    if (params.clientId.length < 8) {
      issues.push({
        field: 'clientId',
        issue: `新版API clientId格式异常，长度不足`,
        severity: 'WARNING',
        source,
        suggestedContact: '新版API对接人 - 赵工'
      });
    }
  }

  return issues;
}

function getSuggestedContact(source: ParameterSource): string {
  switch (source) {
    case ParameterSource.ALARM_RECORD:
      return '监控报警组 - 李工';
    case ParameterSource.OLD_API_DOCUMENT:
      return 'API架构组 - 王工';
    case ParameterSource.NEW_API:
      return '新版API对接人 - 赵工';
    default:
      return '接口对接人确认';
  }
}

export function getSourceDisplayName(source: ParameterSource): string {
  const sourceNames: Record<ParameterSource, string> = {
    [ParameterSource.ALARM_RECORD]: '报警记录',
    [ParameterSource.OLD_API_DOCUMENT]: '旧接口文档',
    [ParameterSource.NEW_API]: '新版API',
    [ParameterSource.UNKNOWN]: '未知来源'
  };
  return sourceNames[source] || source;
}

import { GameState, AuditLog, GameEvent, DataSource } from '../types/game';

const generateAuditId = (): string => {
  return `AUD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const createAuditLog = (
  action: string,
  operator: string,
  beforeState: GameState | null,
  afterState: GameState | null,
  reason: string,
  source: DataSource | null = null
): AuditLog => {
  return {
    id: generateAuditId(),
    timestamp: new Date(),
    action,
    operator,
    beforeState: beforeState ? JSON.parse(JSON.stringify(beforeState)) : null,
    afterState: afterState ? JSON.parse(JSON.stringify(afterState)) : null,
    reason,
    source,
  };
};

export const logScheduleCreation = (
  beforeState: GameState,
  afterState: GameState,
  scheduleId: string,
  decisionNote: string
): AuditLog => {
  const schedule = afterState.schedules.find(s => s.id === scheduleId);
  const ship = afterState.ships.find(s => s.id === schedule?.shipId);
  
  return createAuditLog(
    'CREATE_SCHEDULE',
    'player',
    beforeState,
    afterState,
    decisionNote || `为船舶${ship?.name || schedule?.shipId}创建靠泊计划`,
    ship?.source || null
  );
};

export const logScheduleCancellation = (
  beforeState: GameState,
  afterState: GameState,
  scheduleId: string,
  reason: string
): AuditLog => {
  const schedule = beforeState.schedules.find(s => s.id === scheduleId);
  const ship = beforeState.ships.find(s => s.id === schedule?.shipId);
  
  return createAuditLog(
    'CANCEL_SCHEDULE',
    'player',
    beforeState,
    afterState,
    reason,
    ship?.source || null
  );
};

export const logTimeAdvance = (
  beforeState: GameState,
  afterState: GameState,
  minutes: number
): AuditLog => {
  return createAuditLog(
    'ADVANCE_TIME',
    'system',
    beforeState,
    afterState,
    `时间推进${minutes}分钟，从${beforeState.currentTime.toLocaleString('zh-CN')}到${afterState.currentTime.toLocaleString('zh-CN')}`,
    null
  );
};

export const logGameStart = (initialState: GameState): AuditLog => {
  return createAuditLog(
    'GAME_START',
    'system',
    null,
    initialState,
    '游戏开始',
    null
  );
};

export const logGameEnd = (finalState: GameState): AuditLog => {
  return createAuditLog(
    'GAME_END',
    'system',
    null,
    finalState,
    `游戏结束，最终得分: ${finalState.score}`,
    null
  );
};

export const logDataImport = (
  state: GameState,
  dataType: string,
  recordCount: number,
  fileName: string
): AuditLog => {
  return createAuditLog(
    'DATA_IMPORT',
    'player',
    null,
    state,
    `从文件${fileName}导入${recordCount}条${dataType}数据`,
    null
  );
};

export const logBadData = (
  fileName: string,
  lineNumber: number,
  rawContent: string,
  errorType: string,
  errorMessage: string
): AuditLog => {
  return {
    id: generateAuditId(),
    timestamp: new Date(),
    action: 'BAD_DATA',
    operator: 'system',
    beforeState: null,
    afterState: null,
    reason: `${errorType}: ${errorMessage}`,
    source: {
      file: fileName,
      line: lineNumber,
      rawContent,
      importTimestamp: new Date(),
    },
  };
};

export const logEventTriggered = (
  state: GameState,
  event: GameEvent
): AuditLog => {
  return createAuditLog(
    `EVENT_${event.type.toUpperCase()}`,
    'system',
    null,
    state,
    event.description,
    event.shipId 
      ? state.ships.find(s => s.id === event.shipId)?.source || null
      : null
  );
};

export const getAuditLogsByAction = (
  auditLogs: AuditLog[],
  action: string
): AuditLog[] => {
  return auditLogs.filter(log => log.action === action);
};

export const getAuditLogsByTimeRange = (
  auditLogs: AuditLog[],
  startTime: Date,
  endTime: Date
): AuditLog[] => {
  return auditLogs.filter(log => 
    log.timestamp.getTime() >= startTime.getTime() && 
    log.timestamp.getTime() <= endTime.getTime()
  );
};

export const getAuditLogsBySource = (
  auditLogs: AuditLog[],
  fileName: string
): AuditLog[] => {
  return auditLogs.filter(log => log.source?.file === fileName);
};

export const formatAuditLogForDisplay = (log: AuditLog): string => {
  const time = log.timestamp.toLocaleString('zh-CN');
  const source = log.source ? ` [来源: ${log.source.file}:${log.source.line}]` : '';
  return `[${time}] ${log.action} - ${log.reason}${source}`;
};

export const generateAuditTrail = (
  auditLogs: AuditLog[],
  scheduleId: string
): string[] => {
  const trail: string[] = [];
  
  auditLogs.forEach(log => {
    const schedules = log.afterState?.schedules || log.beforeState?.schedules || [];
    if (schedules.some(s => s.id === scheduleId)) {
      trail.push(formatAuditLogForDisplay(log));
    }
  });
  
  return trail;
};

export const validateDataIntegrity = (
  state: GameState
): { valid: boolean; issues: string[] } => {
  const issues: string[] = [];
  
  state.ships.forEach(ship => {
    if (!ship.source || !ship.source.file || !ship.source.line) {
      issues.push(`船舶${ship.name}(${ship.id})缺少完整的溯源信息`);
    }
  });
  
  state.berths.forEach(berth => {
    if (!berth.source || !berth.source.file || !berth.source.line) {
      issues.push(`泊位${berth.name}(${berth.id})缺少完整的溯源信息`);
    }
  });
  
  state.tugs.forEach(tug => {
    if (!tug.source || !tug.source.file || !tug.source.line) {
      issues.push(`拖轮${tug.name}(${tug.id})缺少完整的溯源信息`);
    }
  });
  
  state.weatherForecast.forEach(weather => {
    if (!weather.source || !weather.source.file || !weather.source.line) {
      issues.push(`天气数据${weather.id}缺少完整的溯源信息`);
    }
  });
  
  state.events.forEach(event => {
    if (event.shipId && !event.rawData?.shipSource) {
      issues.push(`事件${event.id}缺少关联船舶的溯源信息`);
    }
  });
  
  return {
    valid: issues.length === 0,
    issues,
  };
};

export const getDataSourceSummary = (
  state: GameState
): Record<string, { count: number; files: string[] }> => {
  const summary: Record<string, { count: number; files: Set<string> }> = {
    ships: { count: state.ships.length, files: new Set() },
    berths: { count: state.berths.length, files: new Set() },
    tugs: { count: state.tugs.length, files: new Set() },
    weather: { count: state.weatherForecast.length, files: new Set() },
  };
  
  state.ships.forEach(s => summary.ships.files.add(s.source.file));
  state.berths.forEach(b => summary.berths.files.add(b.source.file));
  state.tugs.forEach(t => summary.tugs.files.add(t.source.file));
  state.weatherForecast.forEach(w => summary.weather.files.add(w.source.file));
  
  return Object.fromEntries(
    Object.entries(summary).map(([key, value]) => [
      key,
      { count: value.count, files: Array.from(value.files) },
    ])
  );
};

import { 
  Session, 
  Source, 
  Event, 
  ImportResult, 
  ValidationError,
  SESSION_VERSION,
  SourceType,
  EventType
} from './types';

function isValidSourceType(type: unknown): type is SourceType {
  return typeof type === 'string' && 
    ['microphone', 'camera', 'remote_stream', 'local_file'].includes(type);
}

function isValidEventType(type: unknown): type is EventType {
  return typeof type === 'string' && 
    ['clap_peak', 'flash_frame', 'rtp_timestamp', 'manual_anchor'].includes(type);
}

export function validateSource(source: unknown): ImportResult<Source> {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const validated: Partial<Source> = {};

  if (typeof source !== 'object' || source === null) {
    errors.push({ field: 'source', message: '源数据必须是对象', severity: 'error' });
    return { success: false, errors, warnings };
  }

  const s = source as Record<string, unknown>;

  if (typeof s.id !== 'string' || s.id.trim() === '') {
    errors.push({ field: 'id', message: '源ID必须是非空字符串', severity: 'error' });
  } else {
    validated.id = s.id;
  }

  if (typeof s.name !== 'string' || s.name.trim() === '') {
    warnings.push({ field: 'name', message: '源名称为空，将使用默认值', severity: 'warning' });
    validated.name = '未命名源';
  } else {
    validated.name = s.name;
  }

  if (!isValidSourceType(s.type)) {
    errors.push({ field: 'type', message: `无效的源类型: ${s.type}`, severity: 'error' });
  } else {
    validated.type = s.type;
  }

  if (s.sampleRate !== undefined) {
    if (typeof s.sampleRate !== 'number' || s.sampleRate <= 0) {
      errors.push({ field: 'sampleRate', message: '采样率必须是正数', severity: 'error' });
    } else {
      validated.sampleRate = s.sampleRate;
    }
  }

  if (s.frameRate !== undefined) {
    if (typeof s.frameRate !== 'number' || s.frameRate <= 0) {
      errors.push({ field: 'frameRate', message: '帧率必须是正数', severity: 'error' });
    } else {
      validated.frameRate = s.frameRate;
    }
  }

  if (s.delayOffset !== undefined) {
    if (typeof s.delayOffset !== 'number') {
      errors.push({ field: 'delayOffset', message: '延迟偏移必须是数字', severity: 'error' });
    } else {
      validated.delayOffset = s.delayOffset;
    }
  } else {
    validated.delayOffset = 0;
  }

  validated.isActive = s.isActive !== false;
  validated.isInMix = s.isInMix !== false;

  if (typeof s.color === 'string') {
    validated.color = s.color;
  } else {
    validated.color = '#e94560';
  }

  if (typeof s.notes === 'string') {
    validated.notes = s.notes;
  }

  const requiredFields = ['id', 'name', 'type'];
  const missingFields = requiredFields.filter(f => !Object.keys(validated).includes(f));
  
  if (missingFields.length > 0) {
    return { 
      success: false, 
      errors, 
      warnings 
    };
  }

  return {
    success: true,
    data: validated as Source,
    errors,
    warnings
  };
}

export function validateEvent(event: unknown, sourceIds: string[]): ImportResult<Event> {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const validated: Partial<Event> = {};

  if (typeof event !== 'object' || event === null) {
    errors.push({ field: 'event', message: '事件数据必须是对象', severity: 'error' });
    return { success: false, errors, warnings };
  }

  const e = event as Record<string, unknown>;

  if (typeof e.id !== 'string' || e.id.trim() === '') {
    errors.push({ field: 'id', message: '事件ID必须是非空字符串', severity: 'error' });
  } else {
    validated.id = e.id;
  }

  if (typeof e.sourceId !== 'string' || e.sourceId.trim() === '') {
    errors.push({ field: 'sourceId', message: '事件必须关联源ID', severity: 'error' });
  } else if (!sourceIds.includes(e.sourceId)) {
    warnings.push({ field: 'sourceId', message: `事件引用的源ID ${e.sourceId} 不存在`, severity: 'warning' });
    validated.sourceId = e.sourceId;
  } else {
    validated.sourceId = e.sourceId;
  }

  if (!isValidEventType(e.type)) {
    errors.push({ field: 'type', message: `无效的事件类型: ${e.type}`, severity: 'error' });
  } else {
    validated.type = e.type;
  }

  if (typeof e.timestamp !== 'number' || e.timestamp < 0) {
    errors.push({ field: 'timestamp', message: '时间戳必须是非负数', severity: 'error' });
  } else {
    validated.timestamp = e.timestamp;
  }

  if (e.value !== undefined) {
    if (typeof e.value !== 'number') {
      errors.push({ field: 'value', message: '值必须是数字', severity: 'error' });
    } else {
      validated.value = e.value;
    }
  }

  if (e.rtpTimestamp !== undefined) {
    if (typeof e.rtpTimestamp !== 'number') {
      errors.push({ field: 'rtpTimestamp', message: 'RTP时间戳必须是数字', severity: 'error' });
    } else {
      validated.rtpTimestamp = e.rtpTimestamp;
    }
  }

  if (typeof e.description === 'string') {
    validated.description = e.description;
  }

  if (e.confidence !== undefined) {
    if (typeof e.confidence !== 'number' || e.confidence < 0 || e.confidence > 1) {
      warnings.push({ field: 'confidence', message: '置信度应该在0-1之间', severity: 'warning' });
      validated.confidence = Math.max(0, Math.min(1, e.confidence));
    } else {
      validated.confidence = e.confidence;
    }
  } else {
    validated.confidence = 1.0;
  }

  if (Array.isArray(e.tags)) {
    validated.tags = e.tags.filter(t => typeof t === 'string');
  }

  const requiredFields = ['id', 'sourceId', 'type', 'timestamp'];
  const missingFields = requiredFields.filter(f => !Object.keys(validated).includes(f));
  
  if (missingFields.length > 0) {
    return { 
      success: false, 
      errors, 
      warnings 
    };
  }

  return {
    success: true,
    data: validated as Event,
    errors,
    warnings
  };
}

export function validateSession(session: unknown): ImportResult<Session> {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const validated: Partial<Session> = {};

  if (typeof session !== 'object' || session === null) {
    errors.push({ field: 'session', message: '会话数据必须是对象', severity: 'error' });
    return { success: false, errors, warnings };
  }

  const s = session as Record<string, unknown>;

  if (s.version !== SESSION_VERSION) {
    if (s.version === undefined) {
      warnings.push({ field: 'version', message: '未指定版本号，可能导致兼容性问题', severity: 'warning' });
    } else {
      warnings.push({ 
        field: 'version', 
        message: `版本不匹配: 期望 ${SESSION_VERSION}，得到 ${s.version}`, 
        severity: 'warning' 
      });
    }
  }
  validated.version = SESSION_VERSION;

  if (typeof s.id !== 'string' || s.id.trim() === '') {
    warnings.push({ field: 'id', message: '会话ID为空，将生成新ID', severity: 'warning' });
  } else {
    validated.id = s.id;
  }

  if (typeof s.name !== 'string' || s.name.trim() === '') {
    warnings.push({ field: 'name', message: '会话名称为空，将使用默认值', severity: 'warning' });
    validated.name = '导入的会话';
  } else {
    validated.name = s.name;
  }

  if (typeof s.description === 'string') {
    validated.description = s.description;
  }

  if (typeof s.createdAt !== 'number') {
    warnings.push({ field: 'createdAt', message: '创建时间无效，将使用当前时间', severity: 'warning' });
    validated.createdAt = Date.now();
  } else {
    validated.createdAt = s.createdAt;
  }

  if (typeof s.updatedAt !== 'number') {
    validated.updatedAt = Date.now();
  } else {
    validated.updatedAt = s.updatedAt;
  }

  if (s.timestampUnit !== 'ms' && s.timestampUnit !== 's') {
    warnings.push({ field: 'timestampUnit', message: '时间戳单位无效，默认为毫秒', severity: 'warning' });
    validated.timestampUnit = 'ms';
  } else {
    validated.timestampUnit = s.timestampUnit;
  }

  if (Array.isArray(s.sources)) {
    const validatedSources: Source[] = [];
    for (const [index, src] of s.sources.entries()) {
      const result = validateSource(src);
      if (result.success && result.data) {
        validatedSources.push(result.data);
      }
      result.errors.forEach(e => errors.push({ ...e, field: `sources[${index}].${e.field}` }));
      result.warnings.forEach(w => warnings.push({ ...w, field: `sources[${index}].${w.field}` }));
    }
    validated.sources = validatedSources;
  } else {
    validated.sources = [];
  }

  const sourceIds = validated.sources?.map(src => src.id) || [];

  if (Array.isArray(s.events)) {
    const validatedEvents: Event[] = [];
    for (const [index, evt] of s.events.entries()) {
      const result = validateEvent(evt, sourceIds);
      if (result.success && result.data) {
        validatedEvents.push(result.data);
      }
      result.errors.forEach(e => errors.push({ ...e, field: `events[${index}].${e.field}` }));
      result.warnings.forEach(w => warnings.push({ ...w, field: `events[${index}].${w.field}` }));
    }
    validated.events = validatedEvents;
  } else {
    validated.events = [];
  }

  validated.calibrationResults = Array.isArray(s.calibrationResults) ? s.calibrationResults : [];
  validated.problems = Array.isArray(s.problems) ? s.problems : [];
  validated.syncIssues = Array.isArray(s.syncIssues) ? s.syncIssues : [];
  validated.importLogs = Array.isArray(s.importLogs) ? s.importLogs : [];

  if (typeof s.masterClockSourceId === 'string') {
    if (sourceIds.length > 0 && !sourceIds.includes(s.masterClockSourceId)) {
      warnings.push({ field: 'masterClockSourceId', message: '主时钟源ID不存在', severity: 'warning' });
    }
    validated.masterClockSourceId = s.masterClockSourceId;
  }

  const hasErrors = errors.some(e => e.severity === 'error');
  
  return {
    success: !hasErrors,
    data: hasErrors ? undefined : (validated as Session),
    errors,
    warnings
  };
}

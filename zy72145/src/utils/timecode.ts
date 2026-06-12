export interface TimecodeParseResult {
  valid: boolean;
  seconds: number;
  error?: string;
}

export function parseTimecode(tc: string): TimecodeParseResult {
  if (!tc || typeof tc !== 'string') {
    return { valid: false, seconds: 0, error: '时码为空' };
  }

  const cleanTc = tc.trim();

  const match = cleanTc.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (!match) {
    return { valid: false, seconds: 0, error: `时码格式错误: ${tc}` };
  }

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = parseInt(match[3], 10);

  if (hours >= 24) {
    return { valid: false, seconds: 0, error: `小时数超出范围: ${hours}` };
  }
  if (minutes >= 60) {
    return { valid: false, seconds: 0, error: `分钟数超出范围: ${minutes}` };
  }
  if (seconds >= 60) {
    return { valid: false, seconds: 0, error: `秒数超出范围: ${seconds}` };
  }

  const totalSeconds = hours * 3600 + minutes * 60 + seconds;
  return { valid: true, seconds: totalSeconds };
}

export function validateTimecodeRange(tcIn: string, tcOut: string): { valid: boolean; error?: string } {
  const inResult = parseTimecode(tcIn);
  const outResult = parseTimecode(tcOut);

  if (!inResult.valid) {
    return { valid: false, error: `开始${inResult.error}` };
  }
  if (!outResult.valid) {
    return { valid: false, error: `结束${outResult.error}` };
  }
  if (inResult.seconds >= outResult.seconds) {
    return { valid: false, error: `开始时码(${tcIn})大于等于结束时码(${tcOut})` };
  }

  return { valid: true };
}

export function calculateDuration(tcIn: string, tcOut: string): number {
  const inResult = parseTimecode(tcIn);
  const outResult = parseTimecode(tcOut);
  if (!inResult.valid || !outResult.valid) return 0;
  return Math.round((outResult.seconds - inResult.seconds) / 60);
}

import type { Timecode, Result, ParseError } from '@/types';
import { generateId } from './helpers';

const FRAME_RATE = 24;

export function parseTimecode(input: string, materialId: string, lineNumber?: number, fieldName?: string): Result<Timecode, ParseError> {
  const trimmed = input.trim();

  if (!trimmed) {
    return {
      success: false,
      error: createParseError(
        materialId,
        '时间码为空',
        '请检查是否漏填了时间码字段',
        '第1步：读取原始数据',
        lineNumber,
        fieldName,
        input
      ),
    };
  }

  const framesPattern = /^(\d{1,2}):(\d{2}):(\d{2}):(\d{2})$/;
  const hhmmssPattern = /^(\d{1,2}):(\d{2}):(\d{2})$/;
  const msPattern = /^(\d{1,2}):(\d{2}):(\d{2})\.(\d{1,3})$/;
  const secondsPattern = /^(\d+(?:\.\d+)?)$/;
  const mmssPattern = /^(\d{1,2}):(\d{2})$/;

  let match = trimmed.match(framesPattern);
  if (match) {
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const seconds = parseInt(match[3], 10);
    const frames = parseInt(match[4], 10);

    if (minutes >= 60) {
      return {
        success: false,
        error: createParseError(
          materialId,
          `时间码「${trimmed}」的分钟数 ${minutes} 超过59`,
          '分钟数应在0-59之间，请检查原始文件',
          '第2步：验证时间码范围',
          lineNumber,
          fieldName,
          input
        ),
      };
    }
    if (seconds >= 60) {
      return {
        success: false,
        error: createParseError(
          materialId,
          `时间码「${trimmed}」的秒数 ${seconds} 超过59`,
          '秒数应在0-59之间，请检查原始文件',
          '第2步：验证时间码范围',
          lineNumber,
          fieldName,
          input
        ),
      };
    }
    if (frames >= FRAME_RATE) {
      return {
        success: false,
        error: createParseError(
          materialId,
          `时间码「${trimmed}」的帧数 ${frames} 超过帧率 ${FRAME_RATE}`,
          `帧数应在0-${FRAME_RATE - 1}之间，请检查原始文件或确认帧率设置`,
          '第2步：验证时间码范围',
          lineNumber,
          fieldName,
          input
        ),
      };
    }

    const totalSeconds = hours * 3600 + minutes * 60 + seconds + frames / FRAME_RATE;
    return {
      success: true,
      data: {
        hours,
        minutes,
        seconds,
        frames,
        totalSeconds,
        originalFormat: 'frames',
      },
    };
  }

  match = trimmed.match(hhmmssPattern);
  if (match) {
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const seconds = parseInt(match[3], 10);

    if (minutes >= 60) {
      return {
        success: false,
        error: createParseError(
          materialId,
          `时间码「${trimmed}」的分钟数 ${minutes} 超过59`,
          '分钟数应在0-59之间，请检查原始文件',
          '第2步：验证时间码范围',
          lineNumber,
          fieldName,
          input
        ),
      };
    }
    if (seconds >= 60) {
      return {
        success: false,
        error: createParseError(
          materialId,
          `时间码「${trimmed}」的秒数 ${seconds} 超过59`,
          '秒数应在0-59之间，请检查原始文件',
          '第2步：验证时间码范围',
          lineNumber,
          fieldName,
          input
        ),
      };
    }

    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    return {
      success: true,
      data: {
        hours,
        minutes,
        seconds,
        totalSeconds,
        originalFormat: 'seconds',
      },
    };
  }

  match = trimmed.match(mmssPattern);
  if (match) {
    const minutes = parseInt(match[1], 10);
    const seconds = parseInt(match[2], 10);

    if (seconds >= 60) {
      return {
        success: false,
        error: createParseError(
          materialId,
          `时间码「${trimmed}」的秒数 ${seconds} 超过59`,
          '秒数应在0-59之间，请检查原始文件',
          '第2步：验证时间码范围',
          lineNumber,
          fieldName,
          input
        ),
      };
    }

    const totalSeconds = minutes * 60 + seconds;
    return {
      success: true,
      data: {
        hours: Math.floor(totalSeconds / 3600),
        minutes,
        seconds,
        totalSeconds,
        originalFormat: 'seconds',
      },
    };
  }

  match = trimmed.match(msPattern);
  if (match) {
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const seconds = parseInt(match[3], 10);
    const milliseconds = parseInt(match[4].padEnd(3, '0'), 10);

    if (minutes >= 60) {
      return {
        success: false,
        error: createParseError(
          materialId,
          `时间码「${trimmed}」的分钟数 ${minutes} 超过59`,
          '分钟数应在0-59之间，请检查原始文件',
          '第2步：验证时间码范围',
          lineNumber,
          fieldName,
          input
        ),
      };
    }
    if (seconds >= 60) {
      return {
        success: false,
        error: createParseError(
          materialId,
          `时间码「${trimmed}」的秒数 ${seconds} 超过59`,
          '秒数应在0-59之间，请检查原始文件',
          '第2步：验证时间码范围',
          lineNumber,
          fieldName,
          input
        ),
      };
    }

    const totalSeconds = hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
    return {
      success: true,
      data: {
        hours,
        minutes,
        seconds,
        milliseconds,
        totalSeconds,
        originalFormat: 'milliseconds',
      },
    };
  }

  match = trimmed.match(secondsPattern);
  if (match) {
    const totalSeconds = parseFloat(match[1]);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const milliseconds = Math.round((totalSeconds % 1) * 1000);

    return {
      success: true,
      data: {
        hours,
        minutes,
        seconds,
        milliseconds,
        totalSeconds,
        originalFormat: 'seconds',
      },
    };
  }

  return {
    success: false,
    error: createParseError(
      materialId,
      `无法解析时间码「${trimmed}」`,
      '支持的格式：HH:MM:SS:FF（帧）、HH:MM:SS.mmm（毫秒）、纯秒数',
      '第1步：识别时间码格式',
      lineNumber,
      fieldName,
      input
    ),
  };
}

export function formatTimecode(timecode: Timecode, preferOriginalFormat = true): string {
  const h = timecode.hours.toString().padStart(2, '0');
  const m = timecode.minutes.toString().padStart(2, '0');
  const s = timecode.seconds.toString().padStart(2, '0');

  if (preferOriginalFormat) {
    if (timecode.originalFormat === 'frames' && timecode.frames !== undefined) {
      const f = timecode.frames.toString().padStart(2, '0');
      return `${h}:${m}:${s}:${f}`;
    }
    if (timecode.originalFormat === 'milliseconds' && timecode.milliseconds !== undefined) {
      const ms = timecode.milliseconds.toString().padStart(3, '0');
      return `${h}:${m}:${s}.${ms}`;
    }
  }

  if (timecode.frames !== undefined) {
    const f = timecode.frames.toString().padStart(2, '0');
    return `${h}:${m}:${s}:${f}`;
  }
  if (timecode.milliseconds !== undefined) {
    const ms = timecode.milliseconds.toString().padStart(3, '0');
    return `${h}:${m}:${s}.${ms}`;
  }
  return `${h}:${m}:${s}`;
}

export function formatTimecodeFromSeconds(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const milliseconds = Math.round((totalSeconds % 1) * 1000);

  const h = hours.toString().padStart(2, '0');
  const m = minutes.toString().padStart(2, '0');
  const s = seconds.toString().padStart(2, '0');

  if (milliseconds > 0) {
    const ms = milliseconds.toString().padStart(3, '0');
    return `${h}:${m}:${s}.${ms}`;
  }
  return `${h}:${m}:${s}`;
}

export function timecodeDiff(t1: Timecode, t2: Timecode): number {
  return Math.abs(t1.totalSeconds - t2.totalSeconds);
}

export function addTimecodes(t1: Timecode, t2: Timecode): Timecode {
  const totalSeconds = t1.totalSeconds + t2.totalSeconds;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const milliseconds = Math.round((totalSeconds % 1) * 1000);

  return {
    hours,
    minutes,
    seconds,
    milliseconds,
    totalSeconds,
    originalFormat: t1.originalFormat,
  };
}

function createParseError(
  materialId: string,
  friendlyMessage: string,
  suggestion: string,
  detectionStep: string,
  lineNumber?: number,
  fieldName?: string,
  originalValue?: string
): ParseError {
  return {
    id: generateId(),
    materialId,
    lineNumber,
    fieldName,
    originalValue,
    friendlyMessage,
    suggestion,
    detectionStep,
  };
}

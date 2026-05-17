import { ParsedLogEntry } from './types';

const LOG_PATTERNS = [
  {
    name: 'standard-json',
    pattern: /\{.*\}/,
    extract: (match: string, lineNumber: number, raw: string): ParsedLogEntry => {
      try {
        const obj = JSON.parse(match);
        return {
          raw,
          lineNumber,
          isValid: true,
          timestamp: obj.timestamp || obj.time || obj.ts,
          method: obj.method || obj.httpMethod,
          path: obj.path || obj.url || obj.uri,
          statusCode: obj.statusCode || obj.status,
          errorType: obj.errorType || obj.error?.type,
          errorMessage: obj.errorMessage || obj.error?.message || obj.message,
          requestBody: obj.requestBody || obj.request,
          responseBody: obj.responseBody || obj.response,
          userId: obj.userId || obj.user_id,
          traceId: obj.traceId || obj.trace_id || obj.requestId,
          duration: obj.duration || obj.ms,
        };
      } catch {
        return {
          raw,
          lineNumber,
          isValid: false,
          parseError: 'JSON解析失败',
        };
      }
    },
  },
  {
    name: 'nginx-like',
    pattern: /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[^ ]*)\s+"([A-Z]+)\s+([^"]+)\s+HTTP\/[0-9.]+"\s+(\d+)\s+(\d+)/,
    extract: (match: RegExpMatchArray, lineNumber: number, raw: string): ParsedLogEntry => {
      return {
        raw,
        lineNumber,
        isValid: true,
        timestamp: match[1],
        method: match[2],
        path: match[3],
        statusCode: parseInt(match[4], 10),
        duration: parseInt(match[5], 10),
      };
    },
  },
  {
    name: 'simple-error',
    pattern: /\[([^\]]+)\]\s*(ERROR|WARN|FATAL)\s*([^:]+):\s*(.+)/,
    extract: (match: RegExpMatchArray, lineNumber: number, raw: string): ParsedLogEntry => {
      return {
        raw,
        lineNumber,
        isValid: true,
        timestamp: match[1],
        errorType: match[2],
        path: match[3],
        errorMessage: match[4],
      };
    },
  },
];

export function parseLogLine(raw: string, lineNumber: number): ParsedLogEntry {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      raw,
      lineNumber,
      isValid: false,
      parseError: '空行',
    };
  }

  for (const { name, pattern, extract } of LOG_PATTERNS) {
    if (pattern instanceof RegExp) {
      const match = trimmed.match(pattern);
      if (match) {
        try {
          const result = extract(match as any, lineNumber, raw);
          if (result.isValid) {
            return result;
          }
        } catch (e) {
          continue;
        }
      }
    }
  }

  return {
    raw,
    lineNumber,
    isValid: false,
    parseError: '未匹配到任何日志格式',
  };
}

export function parseLogFile(content: string): ParsedLogEntry[] {
  const lines = content.split('\n');
  return lines.map((line, index) => parseLogLine(line, index + 1));
}

export function filterErrorEntries(entries: ParsedLogEntry[]): ParsedLogEntry[] {
  return entries.filter((entry) => {
    if (!entry.isValid) return false;
    if (entry.statusCode && entry.statusCode >= 400) return true;
    if (entry.errorType && ['ERROR', 'WARN', 'FATAL'].includes(entry.errorType.toUpperCase())) return true;
    if (entry.errorMessage) return true;
    return false;
  });
}

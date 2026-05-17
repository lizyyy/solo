import { ParsedLogEntry, ErrorGroup, ErrorSample, SamplingConfig } from './types';
import crypto from 'crypto';

function generateGroupKey(entry: ParsedLogEntry): string {
  const method = (entry.method || 'UNKNOWN').toUpperCase();
  const path = normalizePath(entry.path || 'UNKNOWN');
  const statusCode = entry.statusCode || 0;
  const errorType = entry.errorType || 'UNKNOWN';
  return `${method}:${path}:${statusCode}:${errorType}`;
}

function normalizePath(path: string): string {
  let normalized = path;
  normalized = normalized.replace(/\/[a-f0-9-]{36}/gi, '/{uuid}');
  normalized = normalized.replace(/\/\d+/g, '/{id}');
  normalized = normalized.replace(/\?.*$/, '');
  return normalized;
}

function generateSampleId(): string {
  return crypto.randomBytes(8).toString('hex');
}

function createSample(entry: ParsedLogEntry): ErrorSample {
  return {
    id: generateSampleId(),
    path: entry.path || 'unknown',
    method: entry.method || 'UNKNOWN',
    statusCode: entry.statusCode || 0,
    errorType: entry.errorType || 'UNKNOWN',
    errorMessage: entry.errorMessage || 'No error message',
    timestamp: entry.timestamp || new Date().toISOString(),
    traceId: entry.traceId || 'unknown',
    requestBody: entry.requestBody,
    responseBody: entry.responseBody,
    userId: entry.userId,
    duration: entry.duration,
    originalLine: entry.lineNumber,
    originalRaw: entry.raw,
  };
}

function maskSensitiveData(value: string, fields: string[]): string {
  if (!value) return value;
  let masked = value;
  for (const field of fields) {
    const regex = new RegExp(`(["'])${field}\\1\\s*:\\s*(["'])(?:(?!\\2).)*\\2`, 'gi');
    masked = masked.replace(regex, `$1${field}$1:$2***MASKED***$2`);
  }
  return masked;
}

export function groupErrors(entries: ParsedLogEntry[], config: SamplingConfig): ErrorGroup[] {
  const groupsMap = new Map<string, ErrorGroup>();

  for (const entry of entries) {
    const key = generateGroupKey(entry);
    const sample = createSample(entry);

    if (config.sensitiveFields.length > 0) {
      if (sample.requestBody) {
        sample.requestBody = maskSensitiveData(sample.requestBody, config.sensitiveFields);
      }
      if (sample.responseBody) {
        sample.responseBody = maskSensitiveData(sample.responseBody, config.sensitiveFields);
      }
    }

    if (!groupsMap.has(key)) {
      groupsMap.set(key, {
        path: normalizePath(entry.path || 'unknown'),
        method: (entry.method || 'UNKNOWN').toUpperCase(),
        statusCode: entry.statusCode || 0,
        errorType: entry.errorType || 'UNKNOWN',
        count: 0,
        samples: [],
      });
    }

    const group = groupsMap.get(key)!;
    group.count++;
    if (group.samples.length < config.maxSamplesPerGroup) {
      group.samples.push(sample);
    }
  }

  return Array.from(groupsMap.values()).sort((a, b) => b.count - a.count);
}

export { maskSensitiveData };

const fs = require('fs');
const readline = require('readline');

const ERROR_PATTERNS = [
  { type: 'ERROR', regex: /\bERROR\b/i },
  { type: 'WARN', regex: /\bWARN(?:ING)?\b/i },
  { type: 'FATAL', regex: /\bFATAL\b/i },
  { type: 'EXCEPTION', regex: /EXCEPTION/i },
  { type: 'STACKTRACE', regex: /\bat\s+\w+\.\w+\(/i },
  { type: 'HTTP_5XX', regex: /\b5[0-9]{2}\b/ },
  { type: 'HTTP_4XX', regex: /\b4[0-9]{2}\b/ }
];

function parseSampleRate(value) {
  if (typeof value === 'number') {
    if (value <= 0 || value > 1) {
      throw new Error('采样率必须在 (0, 1] 范围内');
    }
    return value;
  }
  const str = String(value).trim();
  
  if (str.endsWith('%')) {
    const num = parseFloat(str) / 100;
    if (isNaN(num) || num <= 0 || num > 1) {
      throw new Error('采样率百分比格式无效，必须在 (0%, 100%] 范围内');
    }
    return num;
  }
  
  const num = parseFloat(str);
  if (isNaN(num) || num <= 0 || num > 1) {
    throw new Error('采样率必须在 (0, 1] 范围内，或使用百分比格式（如 10%）');
  }
  return num;
}

function detectErrorTypes(line) {
  const types = [];
  for (const pattern of ERROR_PATTERNS) {
    if (pattern.regex.test(line)) {
      types.push(pattern.type);
    }
  }
  return types.length > 0 ? types : ['UNKNOWN'];
}

function extractGroupFields(line, groupFields) {
  const groups = {};
  const lowerLine = line.toLowerCase();
  
  for (const field of groupFields) {
    const lowerField = field.toLowerCase();
    
    if (lowerField === 'service') {
      const match = line.match(/\bservice[:=]\s*([^\s,]+)/i) ||
                    line.match(/\[([^\]]+)\s*service\]/i) ||
                    line.match(/\b(\w+)-service\b/i);
      groups[field] = match ? match[1] : 'unknown';
    } else if (lowerField === 'error_type' || lowerField === 'errortype') {
      groups[field] = detectErrorTypes(line)[0] || 'UNKNOWN';
    } else if (lowerField === 'level' || lowerField === 'loglevel') {
      const match = line.match(/\b(ERROR|WARN|WARNING|INFO|DEBUG|FATAL)\b/i);
      groups[field] = match ? match[1].toUpperCase() : 'UNKNOWN';
    } else if (lowerField === 'host' || lowerField === 'hostname') {
      const match = line.match(/\bhost[:=]\s*([^\s,]+)/i) ||
                    line.match(/@([^\s:]+)/);
      groups[field] = match ? match[1] : 'unknown';
    } else if (lowerField === 'endpoint' || lowerField === 'path') {
      const match = line.match(/\b(?:path|endpoint|uri)[:=]\s*([^\s,]+)/i) ||
                    line.match(/(?:GET|POST|PUT|DELETE|PATCH)\s+(\/[^\s]+)/i);
      groups[field] = match ? match[1] : 'unknown';
    } else {
      const regex = new RegExp(`\\b${field}[:=]\\s*([^\\s,]+)`, 'i');
      const match = line.match(regex);
      groups[field] = match ? match[1] : 'unknown';
    }
  }
  
  return groups;
}

function getGroupKey(groups) {
  return Object.values(groups).join('|');
}

async function parseLogFile(filePath, options = {}) {
  const { sampleRate = 1.0, groupFields = ['error_type'] } = options;
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`日志文件不存在: ${filePath}`);
  }
  
  const results = {
    filePath,
    sampleRate,
    totalLines: 0,
    validLines: 0,
    badLines: [],
    records: [],
    groups: {}
  };
  
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });
  
  let lineNumber = 0;
  
  for await (const line of rl) {
    lineNumber++;
    results.totalLines++;
    
    const trimmedLine = line.trim();
    
    if (!trimmedLine) {
      results.badLines.push({
        lineNumber,
        content: line,
        reason: '空行'
      });
      continue;
    }
    
    if (trimmedLine.startsWith('#') || trimmedLine.startsWith('//')) {
      results.badLines.push({
        lineNumber,
        content: line,
        reason: '注释行'
      });
      continue;
    }
    
    const errorTypes = detectErrorTypes(line);
    const isError = errorTypes.some(t => ['ERROR', 'FATAL', 'EXCEPTION', 'HTTP_5XX'].includes(t));
    
    const groups = extractGroupFields(line, groupFields);
    const groupKey = getGroupKey(groups);
    
    const record = {
      lineNumber,
      content: line,
      errorTypes,
      isError,
      groups,
      groupKey
    };
    
    results.records.push(record);
    results.validLines++;
    
    if (!results.groups[groupKey]) {
      results.groups[groupKey] = {
        key: groupKey,
        groups,
        sampleCount: 0,
        errorCount: 0,
        records: []
      };
    }
    results.groups[groupKey].sampleCount++;
    if (isError) {
      results.groups[groupKey].errorCount++;
    }
    results.groups[groupKey].records.push(record);
  }
  
  return results;
}

module.exports = {
  parseSampleRate,
  detectErrorTypes,
  extractGroupFields,
  getGroupKey,
  parseLogFile
};

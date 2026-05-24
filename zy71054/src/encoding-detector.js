const chardet = require('chardet');
const iconv = require('iconv-lite');
const fs = require('fs');

const COMMON_ENCODINGS = [
  'UTF-8',
  'UTF-16LE',
  'UTF-16BE',
  'GBK',
  'GB2312',
  'GB18030',
  'BIG5',
  'Shift_JIS',
  'EUC-JP',
  'ISO-8859-1'
];

function hasBOM(buffer) {
  if (buffer.length < 3) return false;
  return buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF;
}

function stripBOM(buffer) {
  if (hasBOM(buffer)) {
    return buffer.slice(3);
  }
  return buffer;
}

function detectEncoding(buffer, candidates = null) {
  const encodingsToCheck = candidates || COMMON_ENCODINGS;
  const results = [];
  const sampleBuffer = buffer.length > 1024 * 1024 ? buffer.slice(0, 1024 * 1024) : buffer;

  if (hasBOM(buffer)) {
    return {
      detected: 'UTF-8',
      hasBOM: true,
      candidates: [{ encoding: 'UTF-8', confidence: 1.0 }],
      isMixedEncoding: false
    };
  }

  const utf8Validation = validateUTF8(buffer);
  if (utf8Validation.isValid) {
    return {
      detected: 'UTF-8',
      hasBOM: false,
      candidates: [{ encoding: 'UTF-8', confidence: utf8Validation.confidence }],
      isMixedEncoding: false
    };
  }

  for (const encoding of encodingsToCheck) {
    if (encoding === 'UTF-8') continue;
    try {
      const decoded = iconv.decode(sampleBuffer, encoding);
      const score = calculateEncodingScore(decoded, encoding);
      results.push({ encoding, score, confidence: score });
    } catch (e) {
      results.push({ encoding, score: 0, confidence: 0, error: e.message });
    }
  }

  const chardetResult = chardet.detect(sampleBuffer);
  if (chardetResult) {
    const existing = results.find(r => r.encoding.toLowerCase() === chardetResult.toLowerCase());
    if (existing) {
      existing.confidence = Math.min(1, existing.confidence + 0.2);
      existing.fromChardet = true;
    } else {
      results.push({ encoding: chardetResult, score: 0.5, confidence: 0.5, fromChardet: true });
    }
  }

  results.sort((a, b) => b.confidence - a.confidence);

  return {
    detected: results[0]?.encoding || 'GBK',
    hasBOM: false,
    candidates: results.slice(0, 5),
    isMixedEncoding: results[0]?.confidence < 0.7 && results[1]?.confidence > 0.3
  };
}

function validateUTF8(buffer) {
  let validBytes = 0;
  let totalBytes = 0;
  let i = 0;

  while (i < buffer.length) {
    const byte = buffer[i];
    
    if (byte < 0x80) {
      validBytes++;
      i++;
    } else if (byte >= 0xC2 && byte <= 0xDF && i + 1 < buffer.length) {
      const byte2 = buffer[i + 1];
      if (byte2 >= 0x80 && byte2 <= 0xBF) {
        validBytes += 2;
        i += 2;
      } else {
        i++;
      }
    } else if (byte >= 0xE0 && byte <= 0xEF && i + 2 < buffer.length) {
      const byte2 = buffer[i + 1];
      const byte3 = buffer[i + 2];
      if (byte2 >= 0x80 && byte2 <= 0xBF && byte3 >= 0x80 && byte3 <= 0xBF) {
        if (byte === 0xE0 && byte2 < 0xA0) { i++; continue; }
        if (byte === 0xED && byte2 > 0x9F) { i++; continue; }
        validBytes += 3;
        i += 3;
      } else {
        i++;
      }
    } else if (byte >= 0xF0 && byte <= 0xF4 && i + 3 < buffer.length) {
      const byte2 = buffer[i + 1];
      const byte3 = buffer[i + 2];
      const byte4 = buffer[i + 3];
      if (byte2 >= 0x80 && byte2 <= 0xBF && 
          byte3 >= 0x80 && byte3 <= 0xBF && 
          byte4 >= 0x80 && byte4 <= 0xBF) {
        if (byte === 0xF0 && byte2 < 0x90) { i++; continue; }
        if (byte === 0xF4 && byte2 > 0x8F) { i++; continue; }
        validBytes += 4;
        i += 4;
      } else {
        i++;
      }
    } else {
      i++;
    }
    totalBytes++;
  }

  const confidence = validBytes / buffer.length;
  return {
    isValid: confidence > 0.95,
    confidence,
    validBytes,
    totalBytes: buffer.length
  };
}

function calculateEncodingScore(decoded, encoding) {
  let score = 1.0;
  const totalChars = decoded.length;

  if (totalChars === 0) return 0.01;

  const nullBytes = (decoded.match(/\x00/g) || []).length;
  const nullRatio = nullBytes / totalChars;
  if (nullRatio > 0.3) {
    return 0.01;
  }
  score -= nullRatio * 5;

  const chineseChars = (decoded.match(/[\u4e00-\u9fa5]/g) || []).length;
  const chineseRatio = chineseChars / totalChars;
  
  if (['GBK', 'GB2312', 'GB18030', 'UTF-8', 'UTF-16LE', 'UTF-16BE'].includes(encoding)) {
    if (chineseRatio > 0.01) score += 0.3;
  }

  const replacementChars = (decoded.match(/\uFFFD/g) || []).length;
  const replacementRatio = replacementChars / totalChars;
  score -= replacementRatio * 3;

  const controlChars = (decoded.match(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g) || []).length;
  const controlRatio = controlChars / totalChars;
  score -= controlRatio * 2;

  const printableChars = (decoded.match(/[\x20-\x7E\u4e00-\u9fa5]/g) || []).length;
  const printableRatio = printableChars / totalChars;
  score = score * printableRatio;

  return Math.max(0.01, Math.min(1, score));
}

function convertToUTF8(buffer, sourceEncoding) {
  const cleanBuffer = stripBOM(buffer);
  return iconv.decode(cleanBuffer, sourceEncoding);
}

function validateEncodingConversion(buffer, sourceEncoding) {
  try {
    const decoded = convertToUTF8(buffer, sourceEncoding);
    const issues = [];
    
    const replacementChars = (decoded.match(/\uFFFD/g) || []).length;
    if (replacementChars > 0) {
      issues.push({
        type: 'replacement_chars',
        count: replacementChars,
        severity: replacementChars > 10 ? 'high' : 'medium',
        message: `发现 ${replacementChars} 个替换字符（�），可能存在编码误判`
      });
    }

    const nullBytes = (decoded.match(/\x00/g) || []).length;
    if (nullBytes > decoded.length * 0.1) {
      issues.push({
        type: 'null_bytes',
        count: nullBytes,
        severity: 'high',
        message: `发现大量空字节，编码可能不正确`
      });
    }

    return { valid: issues.length === 0 || issues.every(i => i.severity !== 'high'), issues, decoded };
  } catch (error) {
    return { valid: false, issues: [{ type: 'decode_error', severity: 'high', message: error.message }] };
  }
}

module.exports = {
  detectEncoding,
  convertToUTF8,
  validateEncodingConversion,
  hasBOM,
  stripBOM,
  COMMON_ENCODINGS
};

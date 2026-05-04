const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { Readable } = require('stream');

const parseCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
};

const parseCSVFromBuffer = (buffer) => {
  return new Promise((resolve, reject) => {
    const results = [];
    const readable = new Readable();
    readable._read = () => {};
    readable.push(buffer);
    readable.push(null);

    readable
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
};

const parseJSONL = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
    let buffer = '';

    stream.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (line.trim()) {
          try {
            results.push(JSON.parse(line));
          } catch (error) {
            // 忽略无效的JSON行
          }
        }
      }
    });

    stream.on('end', () => {
      if (buffer.trim()) {
        try {
          results.push(JSON.parse(buffer));
        } catch (error) {
          // 忽略无效的JSON行
        }
      }
      resolve(results);
    });

    stream.on('error', (error) => reject(error));
  });
};

const parseJSONLFromBuffer = (buffer) => {
  const results = [];
  const lines = buffer.toString('utf8').split('\n');

  for (const line of lines) {
    if (line.trim()) {
      try {
        results.push(JSON.parse(line));
      } catch (error) {
        // 忽略无效的JSON行
      }
    }
  }

  return results;
};

const parseJSON = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content);
};

const parseJSONFromBuffer = (buffer) => {
  return JSON.parse(buffer.toString('utf8'));
};

const normalizeMacAddress = (mac) => {
  if (!mac) return null;
  // 移除所有非十六进制字符
  const cleaned = mac.replace(/[^0-9A-Fa-f]/g, '').toLowerCase();
  if (cleaned.length !== 12) return null;
  // 格式化为 AA:BB:CC:DD:EE:FF
  return cleaned.match(/.{2}/g).join(':').toUpperCase();
};

const parseDateTime = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
};

const parseInteger = (value, defaultValue = null) => {
  if (value === null || value === undefined || value === '') return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

const parseFloat = (value, defaultValue = null) => {
  if (value === null || value === undefined || value === '') return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

const parseBoolean = (value, defaultValue = false) => {
  if (value === null || value === undefined) return defaultValue;
  if (typeof value === 'boolean') return value;
  const str = String(value).toLowerCase();
  return ['true', '1', 'yes', 'on'].includes(str);
};

const getDeviceTypeFromName = (name) => {
  if (!name) return 'other';
  const lower = name.toLowerCase();
  if (lower.includes('esl') || lower.includes('价签') || lower.includes('label')) return 'esl';
  if (lower.includes('printer') || lower.includes('打印')) return 'printer';
  if (lower.includes('beacon') || lower.includes('信标')) return 'beacon';
  if (lower.includes('scanner') || lower.includes('扫码')) return 'scanner';
  if (lower.includes('headset') || lower.includes('headphone') || lower.includes('耳机')) return 'headset';
  return 'other';
};

const isRandomMacAddress = (mac) => {
  if (!mac) return false;
  // 随机MAC地址的第二高位通常是1
  const normalized = normalizeMacAddress(mac);
  if (!normalized) return false;
  const firstOctet = parseInt(normalized.split(':')[0], 16);
  // 检查第二位是否为1 (0x02, 0x06, 0x0A, 0x0E等)
  return (firstOctet & 0x02) === 0x02;
};

module.exports = {
  parseCSV,
  parseCSVFromBuffer,
  parseJSONL,
  parseJSONLFromBuffer,
  parseJSON,
  parseJSONFromBuffer,
  normalizeMacAddress,
  parseDateTime,
  parseInteger,
  parseFloat,
  parseBoolean,
  getDeviceTypeFromName,
  isRandomMacAddress
};

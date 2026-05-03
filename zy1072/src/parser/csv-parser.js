import * as fs from 'fs/promises';
import { GUEST_REQUIRED_FIELDS, GUEST_OPTIONAL_FIELDS } from '../types.js';
import { parseBoolean, parseArray, normalizeName } from '../utils.js';

export class CsvParser {
  constructor() {}

  async parseFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return this.parseContent(content, filePath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`文件不存在: ${filePath}`);
      }
      throw new Error(`读取文件失败: ${filePath} - ${error.message}`);
    }
  }

  parseContent(content, filePath = 'unknown') {
    const lines = content.split(/\r?\n/);
    if (lines.length === 0) {
      throw new Error(`CSV文件为空: ${filePath}`);
    }

    const headers = this.parseCsvLine(lines[0]);
    if (headers.length === 0) {
      throw new Error(`CSV文件没有表头行: ${filePath}`);
    }

    const headerMap = new Map();
    headers.forEach((header, index) => {
      headerMap.set(header.trim(), index);
    });

    const records = [];
    const errors = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const values = this.parseCsvLine(line);
        const record = {};

        headers.forEach((header, index) => {
          const key = header.trim();
          record[key] = values[index] !== undefined ? values[index] : '';
        });

        records.push({
          data: record,
          lineNumber: i + 1,
          rawLine: line
        });
      } catch (error) {
        errors.push({
          lineNumber: i + 1,
          error: error.message,
          rawLine: line
        });
      }
    }

    return { records, errors, headers: headerMap };
  }

  parseCsvLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];

      if (inQuotes) {
        if (char === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i += 2;
          } else {
            inQuotes = false;
            i++;
          }
        } else {
          current += char;
          i++;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
          i++;
        } else if (char === ',') {
          result.push(current.trim());
          current = '';
          i++;
        } else {
          current += char;
          i++;
        }
      }
    }

    result.push(current.trim());
    return result;
  }
}

export class GuestParser extends CsvParser {
  parseGuests(parsedData) {
    const { records, errors, headers } = parsedData;
    const guests = [];
    const parseErrors = [...errors];

    const allGuestFields = [...GUEST_REQUIRED_FIELDS, ...GUEST_OPTIONAL_FIELDS];

    for (const record of records) {
      const { data, lineNumber } = record;
      const guest = {
        _lineNumber: lineNumber,
        _rawData: { ...data }
      };

      for (const field of GUEST_REQUIRED_FIELDS) {
        if (data[field] === undefined || data[field] === '') {
          parseErrors.push({
            lineNumber,
            field,
            error: `必填字段缺失: ${field}`,
            guest: data['姓名'] || '未知宾客'
          });
        }
      }

      guest.name = normalizeName(data['姓名'] || '');
      guest.group = data['分组'] || '';
      guest.relationTags = parseArray(data['关系标签']);
      guest.companions = parseArray(data['同行人']).map(normalizeName);
      guest.dietaryRestrictions = parseArray(data['忌口/过敏']);
      guest.isMobilityImpaired = parseBoolean(data['行动不便']);
      guest.isChild = parseBoolean(data['儿童']);
      guest.needsQuietZone = parseBoolean(data['是否需要安静区']);
      guest.preferWith = parseArray(data['优先同桌']).map(normalizeName);
      guest.avoidWith = parseArray(data['避免同桌']).map(normalizeName);
      guest.isVIP = parseBoolean(data['VIP']);
      guest.tableNumber = data['桌号'] ? String(data['桌号']).trim() : null;

      guests.push(guest);
    }

    return { guests, errors: parseErrors };
  }

  async parseFile(filePath) {
    const parsedData = await super.parseFile(filePath);
    return this.parseGuests(parsedData);
  }
}

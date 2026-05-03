import * as fs from 'fs/promises';
import { TABLE_REQUIRED_FIELDS, TABLE_OPTIONAL_FIELDS } from '../types.js';
import { parseBoolean, parseNumber } from '../utils.js';

export class TableParser {
  constructor() {}

  async parseFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return this.parseContent(content, filePath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`文件不存在: ${filePath}`);
      }
      if (error instanceof SyntaxError) {
        throw new Error(`JSON格式错误: ${filePath} - ${error.message}`);
      }
      throw new Error(`读取文件失败: ${filePath} - ${error.message}`);
    }
  }

  parseContent(content, filePath = 'unknown') {
    let tables;
    try {
      tables = JSON.parse(content);
    } catch (error) {
      throw new Error(`JSON解析失败: ${filePath} - ${error.message}`);
    }

    if (!Array.isArray(tables)) {
      throw new Error(`JSON格式错误: ${filePath} - 期望数组格式，实际得到 ${typeof tables}`);
    }

    const errors = [];
    const parsedTables = [];

    tables.forEach((table, index) => {
      const lineNumber = index + 1;
      const parsed = this.parseTable(table, lineNumber, errors);
      if (parsed) {
        parsed._lineNumber = lineNumber;
        parsed._rawData = { ...table };
        parsedTables.push(parsed);
      }
    });

    return { tables: parsedTables, errors };
  }

  parseTable(table, lineNumber, errors) {
    const parsed = {};

    for (const field of TABLE_REQUIRED_FIELDS) {
      if (table[field] === undefined || table[field] === null || table[field] === '') {
        if (field === '桌号') {
          errors.push({
            lineNumber,
            field,
            error: `必填字段缺失: ${field}`,
            table: table['桌号'] || `第${lineNumber}个桌位`
          });
          return null;
        }
        if (field === '容量') {
          errors.push({
            lineNumber,
            field,
            error: `必填字段缺失或无效: ${field}`,
            table: table['桌号'] || `第${lineNumber}个桌位`
          });
          parsed.capacity = 0;
        }
      }
    }

    parsed.tableNumber = String(table['桌号'] || lineNumber).trim();
    parsed.capacity = parseNumber(table['容量'], 0);
    parsed.area = table['区域'] || '主会场';
    parsed.distanceToStage = parseNumber(table['离舞台距离'], 50);
    parsed.distanceToSpeaker = parseNumber(table['离音箱距离'], 30);
    parsed.distanceToExit = parseNumber(table['离出口距离'], 50);
    parsed.isChildFriendly = parseBoolean(table['是否儿童友好']);
    parsed.isQuietZone = parseBoolean(table['是否安静区']);

    return parsed;
  }
}

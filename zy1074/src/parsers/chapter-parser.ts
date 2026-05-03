import fs from 'fs';
import path from 'path';
import { Chapter, AdPoint } from '../types';
import { timeToSeconds, secondsToTime } from '../utils/time';

export class ParseError extends Error {
  constructor(message: string, public lineNumber?: number) {
    super(lineNumber ? `第${lineNumber}行: ${message}` : message);
    this.name = 'ParseError';
  }
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

export class ChapterParser {
  parse(content: string): Chapter[] {
    const lines = content.split(/\r?\n/);
    const chapters: Chapter[] = [];
    
    if (lines.length === 0) {
      throw new ParseError('CSV 文件为空');
    }

    let headerLine = 0;
    let headers: string[] = [];
    
    while (headerLine < lines.length) {
      const line = lines[headerLine].trim();
      if (line !== '' && !line.startsWith('#')) {
        headers = parseCsvLine(line);
        break;
      }
      headerLine++;
    }

    if (headers.length === 0) {
      throw new ParseError('未找到 CSV 表头');
    }

    const startTimeIdx = headers.findIndex(h => 
      ['start_time', 'startTime', '开始时间', '开始', 'time', '时间'].includes(h.toLowerCase())
    );
    
    const endTimeIdx = headers.findIndex(h => 
      ['end_time', 'endTime', '结束时间', '结束'].includes(h.toLowerCase())
    );

    const titleIdx = headers.findIndex(h => 
      ['title', '标题', '章节', 'chapter', 'name', '名称'].includes(h.toLowerCase())
    );

    const idIdx = headers.findIndex(h => 
      ['id', '序号', '编号'].includes(h.toLowerCase())
    );

    if (startTimeIdx === -1) {
      throw new ParseError('未找到开始时间列，请确保表头包含 "start_time"、"开始时间" 或 "time"');
    }

    if (titleIdx === -1) {
      throw new ParseError('未找到标题列，请确保表头包含 "title"、"标题" 或 "章节"');
    }

    let currentId = 1;
    
    for (let i = headerLine + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line === '' || line.startsWith('#')) {
        continue;
      }

      const values = parseCsvLine(line);
      
      if (values.length < Math.max(startTimeIdx, titleIdx) + 1) {
        throw new ParseError(`列数不足`, i + 1);
      }

      let id: string;
      if (idIdx !== -1 && values[idIdx]) {
        id = values[idIdx];
      } else {
        id = String(currentId++);
      }

      const startTimeStr = values[startTimeIdx];
      if (!startTimeStr) {
        throw new ParseError(`开始时间为空`, i + 1);
      }

      let startTime: number;
      try {
        startTime = timeToSeconds(startTimeStr);
      } catch (error) {
        throw new ParseError(`开始时间格式错误: ${startTimeStr}`, i + 1);
      }

      let endTime: number;
      let endTimeStr: string;
      
      if (endTimeIdx !== -1 && values[endTimeIdx]) {
        endTimeStr = values[endTimeIdx];
        try {
          endTime = timeToSeconds(endTimeStr);
        } catch (error) {
          throw new ParseError(`结束时间格式错误: ${endTimeStr}`, i + 1);
        }
      } else {
        endTime = startTime;
        endTimeStr = startTimeStr;
      }

      const title = values[titleIdx];
      if (!title) {
        throw new ParseError(`标题为空`, i + 1);
      }

      chapters.push({
        id,
        startTime,
        endTime,
        startTimeStr: secondsToTime(startTime, 'simple'),
        endTimeStr: secondsToTime(endTime, 'simple'),
        title
      });
    }

    if (chapters.length === 0) {
      throw new ParseError('未找到任何章节数据');
    }

    return chapters;
  }

  parseFile(filePath: string): Chapter[] {
    if (!fs.existsSync(filePath)) {
      throw new ParseError(`文件不存在: ${filePath}`);
    }

    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.csv') {
      throw new ParseError(`不是 CSV 文件: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    return this.parse(content);
  }
}

export class AdPointParser {
  parse(content: string): AdPoint[] {
    const lines = content.split(/\r?\n/);
    const adPoints: AdPoint[] = [];
    
    if (lines.length === 0) {
      throw new ParseError('CSV 文件为空');
    }

    let headerLine = 0;
    let headers: string[] = [];
    
    while (headerLine < lines.length) {
      const line = lines[headerLine].trim();
      if (line !== '' && !line.startsWith('#')) {
        headers = parseCsvLine(line);
        break;
      }
      headerLine++;
    }

    if (headers.length === 0) {
      throw new ParseError('未找到 CSV 表头');
    }

    const startTimeIdx = headers.findIndex(h => 
      ['start_time', 'startTime', '开始时间', '开始', 'time', '时间'].includes(h.toLowerCase())
    );
    
    const endTimeIdx = headers.findIndex(h => 
      ['end_time', 'endTime', '结束时间', '结束'].includes(h.toLowerCase())
    );

    const descIdx = headers.findIndex(h => 
      ['description', 'desc', '描述', '说明', '广告', '内容'].includes(h.toLowerCase())
    );

    const idIdx = headers.findIndex(h => 
      ['id', '序号', '编号'].includes(h.toLowerCase())
    );

    if (startTimeIdx === -1) {
      throw new ParseError('未找到开始时间列，请确保表头包含 "start_time"、"开始时间" 或 "time"');
    }

    let currentId = 1;
    
    for (let i = headerLine + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line === '' || line.startsWith('#')) {
        continue;
      }

      const values = parseCsvLine(line);
      
      if (values.length < startTimeIdx + 1) {
        throw new ParseError(`列数不足`, i + 1);
      }

      let id: string;
      if (idIdx !== -1 && values[idIdx]) {
        id = values[idIdx];
      } else {
        id = String(currentId++);
      }

      const startTimeStr = values[startTimeIdx];
      if (!startTimeStr) {
        throw new ParseError(`开始时间为空`, i + 1);
      }

      let startTime: number;
      try {
        startTime = timeToSeconds(startTimeStr);
      } catch (error) {
        throw new ParseError(`开始时间格式错误: ${startTimeStr}`, i + 1);
      }

      let endTime: number;
      let endTimeStr: string;
      
      if (endTimeIdx !== -1 && values[endTimeIdx]) {
        endTimeStr = values[endTimeIdx];
        try {
          endTime = timeToSeconds(endTimeStr);
        } catch (error) {
          throw new ParseError(`结束时间格式错误: ${endTimeStr}`, i + 1);
        }
      } else {
        endTime = startTime + 1;
        endTimeStr = secondsToTime(endTime, 'simple');
      }

      let description = '';
      if (descIdx !== -1 && values[descIdx]) {
        description = values[descIdx];
      }

      adPoints.push({
        id,
        startTime,
        endTime,
        startTimeStr: secondsToTime(startTime, 'simple'),
        endTimeStr: secondsToTime(endTime, 'simple'),
        description
      });
    }

    return adPoints;
  }

  parseFile(filePath: string): AdPoint[] {
    if (!fs.existsSync(filePath)) {
      throw new ParseError(`文件不存在: ${filePath}`);
    }

    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.csv') {
      throw new ParseError(`不是 CSV 文件: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    return this.parse(content);
  }
}

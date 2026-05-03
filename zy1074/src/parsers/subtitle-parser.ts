import fs from 'fs';
import path from 'path';
import { SubtitleCue } from '../types';
import { timeToSeconds, secondsToTime } from '../utils/time';

export class SubtitleParseError extends Error {
  constructor(message: string, public lineNumber?: number) {
    super(lineNumber ? `第${lineNumber}行: ${message}` : message);
    this.name = 'SubtitleParseError';
  }
}

export class SrtParser {
  parse(content: string): SubtitleCue[] {
    const cues: SubtitleCue[] = [];
    const lines = content.split(/\r?\n/);
    let i = 0;

    while (i < lines.length) {
      const line = lines[i].trim();
      
      if (line === '') {
        i++;
        continue;
      }

      const idMatch = line.match(/^(\d+)$/);
      if (!idMatch) {
        i++;
        continue;
      }

      const id = idMatch[1];
      i++;

      while (i < lines.length && lines[i].trim() === '') {
        i++;
      }

      if (i >= lines.length) {
        throw new SubtitleParseError(`字幕 ${id} 缺少时间轴`, i);
      }

      const timeLine = lines[i].trim();
      const timeMatch = timeLine.match(/^(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})/);
      
      if (!timeMatch) {
        throw new SubtitleParseError(`字幕 ${id} 时间轴格式错误: ${timeLine}`, i + 1);
      }

      const startTimeStr = timeMatch[1].replace(',', ',');
      const endTimeStr = timeMatch[2].replace(',', ',');
      
      i++;

      let textLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== '') {
        textLines.push(lines[i]);
        i++;
      }

      const text = textLines.join('\n').trim();

      if (!text) {
        throw new SubtitleParseError(`字幕 ${id} 缺少字幕内容`, i);
      }

      try {
        const startTime = timeToSeconds(startTimeStr);
        const endTime = timeToSeconds(endTimeStr);

        if (startTime >= endTime) {
          throw new SubtitleParseError(`字幕 ${id} 开始时间大于等于结束时间: ${startTimeStr} --> ${endTimeStr}`);
        }

        cues.push({
          id,
          startTime,
          endTime,
          startTimeStr: secondsToTime(startTime, 'srt'),
          endTimeStr: secondsToTime(endTime, 'srt'),
          text
        });
      } catch (error) {
        if (error instanceof SubtitleParseError) {
          throw error;
        }
        throw new SubtitleParseError(`字幕 ${id} 时间解析失败: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    }

    if (cues.length === 0) {
      throw new SubtitleParseError('未找到任何字幕条目');
    }

    return cues;
  }

  parseFile(filePath: string): SubtitleCue[] {
    if (!fs.existsSync(filePath)) {
      throw new SubtitleParseError(`文件不存在: ${filePath}`);
    }

    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.srt') {
      throw new SubtitleParseError(`不是 SRT 文件: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    return this.parse(content);
  }
}

export class VttParser {
  parse(content: string): SubtitleCue[] {
    const cues: SubtitleCue[] = [];
    const lines = content.split(/\r?\n/);
    let i = 0;

    while (i < lines.length && !lines[i].trim().startsWith('WEBVTT')) {
      i++;
    }

    if (i >= lines.length) {
      throw new SubtitleParseError('缺少 WEBVTT 文件头');
    }

    i++;

    let cueId = 1;
    let inCue = false;
    let currentId: string | null = null;
    let startTimeStr: string | null = null;
    let endTimeStr: string | null = null;
    let textLines: string[] = [];

    while (i < lines.length) {
      const line = lines[i];
      const trimmedLine = line.trim();

      if (trimmedLine === '') {
        if (inCue && startTimeStr && endTimeStr) {
          try {
            const startTime = timeToSeconds(startTimeStr);
            const endTime = timeToSeconds(endTimeStr);

            if (startTime >= endTime) {
              throw new SubtitleParseError(`字幕 ${currentId || cueId} 开始时间大于等于结束时间: ${startTimeStr} --> ${endTimeStr}`);
            }

            const text = textLines.join('\n').trim();
            if (text) {
              cues.push({
                id: currentId || String(cueId),
                startTime,
                endTime,
                startTimeStr: secondsToTime(startTime, 'vtt'),
                endTimeStr: secondsToTime(endTime, 'vtt'),
                text
              });
            }
          } catch (error) {
            if (error instanceof SubtitleParseError) {
              throw error;
            }
            throw new SubtitleParseError(`字幕 ${currentId || cueId} 时间解析失败`);
          }
        }

        inCue = false;
        currentId = null;
        startTimeStr = null;
        endTimeStr = null;
        textLines = [];
        i++;
        continue;
      }

      if (trimmedLine.startsWith('NOTE ') || trimmedLine === 'NOTE') {
        while (i < lines.length && lines[i].trim() !== '') {
          i++;
        }
        continue;
      }

      if (trimmedLine.includes('-->')) {
        inCue = true;
        const timeMatch = trimmedLine.match(/^(\d{2}:\d{2}[:.]\d{2}[,.]\d{3}|\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}[:.]\d{2}[,.]\d{3}|\d{2}:\d{2}[,.]\d{3})/);
        
        if (!timeMatch) {
          throw new SubtitleParseError(`时间轴格式错误: ${trimmedLine}`, i + 1);
        }

        startTimeStr = timeMatch[1];
        endTimeStr = timeMatch[2];
        cueId++;
        i++;
        continue;
      }

      if (!inCue && trimmedLine.match(/^\w+$/)) {
        currentId = trimmedLine;
        i++;
        continue;
      }

      if (inCue) {
        textLines.push(line);
      }

      i++;
    }

    if (inCue && startTimeStr && endTimeStr) {
      try {
        const startTime = timeToSeconds(startTimeStr);
        const endTime = timeToSeconds(endTimeStr);
        const text = textLines.join('\n').trim();
        
        if (text) {
          cues.push({
            id: currentId || String(cueId),
            startTime,
            endTime,
            startTimeStr: secondsToTime(startTime, 'vtt'),
            endTimeStr: secondsToTime(endTime, 'vtt'),
            text
          });
        }
      } catch (error) {
        if (!(error instanceof SubtitleParseError)) {
          throw new SubtitleParseError(`字幕 ${currentId || cueId} 时间解析失败`);
        }
      }
    }

    if (cues.length === 0) {
      throw new SubtitleParseError('未找到任何字幕条目');
    }

    return cues;
  }

  parseFile(filePath: string): SubtitleCue[] {
    if (!fs.existsSync(filePath)) {
      throw new SubtitleParseError(`文件不存在: ${filePath}`);
    }

    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.vtt') {
      throw new SubtitleParseError(`不是 VTT 文件: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    return this.parse(content);
  }
}

export function parseSubtitleFile(filePath: string): SubtitleCue[] {
  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === '.srt') {
    const parser = new SrtParser();
    return parser.parseFile(filePath);
  } else if (ext === '.vtt') {
    const parser = new VttParser();
    return parser.parseFile(filePath);
  } else {
    throw new SubtitleParseError(`不支持的字幕格式: ${ext}`);
  }
}

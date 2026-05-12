import * as fs from 'fs';
import { SubtitleCue } from './types';

export function parseTimeToMs(timeStr: string): number {
  const vttMatch = timeStr.match(/^(\d{2}):(\d{2}):(\d{2})[.,](\d{1,3})$/);
  if (vttMatch) {
    const hours = parseInt(vttMatch[1], 10);
    const minutes = parseInt(vttMatch[2], 10);
    const seconds = parseInt(vttMatch[3], 10);
    const ms = parseInt(vttMatch[4].padEnd(3, '0'), 10);
    return hours * 3600000 + minutes * 60000 + seconds * 1000 + ms;
  }
  
  const srtMatch = timeStr.match(/^(\d{2}):(\d{2}):(\d{2})[.,](\d{3})$/);
  if (srtMatch) {
    const hours = parseInt(srtMatch[1], 10);
    const minutes = parseInt(srtMatch[2], 10);
    const seconds = parseInt(srtMatch[3], 10);
    const ms = parseInt(srtMatch[4], 10);
    return hours * 3600000 + minutes * 60000 + seconds * 1000 + ms;
  }
  
  throw new Error(`Invalid time format: ${timeStr}`);
}

export function msToTime(ms: number, format: 'srt' | 'vtt' = 'srt'): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;
  
  const separator = format === 'vtt' ? '.' : ',';
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}${separator}${String(milliseconds).padStart(3, '0')}`;
}

export interface ParseResult {
  success: boolean;
  cues: SubtitleCue[];
  errors: string[];
}

export function parseSRT(content: string): ParseResult {
  const cues: SubtitleCue[] = [];
  const errors: string[] = [];
  
  const blocks = content.split(/\n\n+/).filter(b => b.trim());
  let cueIndex = 1;
  
  for (const block of blocks) {
    const lines = block.split('\n').filter(l => l.trim());
    
    if (lines.length < 3) {
      if (lines.length > 0) {
        errors.push(`Incomplete cue block, expected at least 3 lines, got ${lines.length}`);
      }
      continue;
    }
    
    let idx = 0;
    
    if (idx < lines.length && /^\d+$/.test(lines[idx].trim())) {
      idx++;
    }
    
    if (idx >= lines.length) {
      errors.push('Missing time line in cue');
      continue;
    }
    
    const timeLine = lines[idx].trim();
    const timeMatch = timeLine.match(/^(\d{2}:\d{2}:\d{2}[,]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,]\d{3})(\s+.*)?$/);
    
    if (!timeMatch) {
      errors.push(`Invalid time format: ${timeLine}`);
      continue;
    }
    
    idx++;
    
    const startTimeStr = timeMatch[1];
    const endTimeStr = timeMatch[2];
    
    try {
      const startTime = parseTimeToMs(startTimeStr);
      const endTime = parseTimeToMs(endTimeStr);
      
      const text = lines.slice(idx).join('\n').trim();
      
      if (startTime >= endTime) {
        errors.push(`Start time >= end time at cue ${cueIndex}: ${startTimeStr} --> ${endTimeStr}`);
        continue;
      }
      
      cues.push({
        id: `cue_${cueIndex}`,
        index: cueIndex,
        startTime,
        endTime,
        startTimeStr,
        endTimeStr,
        text,
      });
      
      cueIndex++;
    } catch (e) {
      errors.push(`Failed to parse time: ${e}`);
    }
  }
  
  return { success: errors.length === 0, cues, errors };
}

export function parseVTT(content: string): ParseResult {
  const cues: SubtitleCue[] = [];
  const errors: string[] = [];
  
  const lines = content.split('\n');
  let idx = 0;
  
  while (idx < lines.length && !lines[idx].trim() && !lines[idx].includes('-->')) {
    idx++;
  }
  
  let cueIndex = 1;
  
  while (idx < lines.length) {
    const line = lines[idx];
    
    if (line.includes('-->')) {
      const timeMatch = line.match(/^(\d{2}:\d{2}:\d{2}[.]\d{3}|\d{2}:\d{2}[.]\d{3}|\d{2}:\d{2}:\d{2}[,]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[.]\d{3}|\d{2}:\d{2}[.]\d{3}|\d{2}:\d{2}:\d{2}[,]\d{3})(\s+.*)?$/);
      
      if (timeMatch) {
        let startTimeStr = timeMatch[1];
        let endTimeStr = timeMatch[2];
        
        if (startTimeStr.match(/^\d{2}:\d{2}[.]\d{3}/)) {
          startTimeStr = '00:' + startTimeStr;
        }
        if (endTimeStr.match(/^\d{2}:\d{2}[.]\d{3}/)) {
          endTimeStr = '00:' + endTimeStr;
        }
        
        try {
          startTimeStr = startTimeStr.replace(/[.]\d]*$/, (m) => m.length - 3 ? m : m + '0'.repeat(3 - m.length));
          endTimeStr = endTimeStr.replace(/[.]\d*$/, (m) => m.length - 1 >= 3 ? m : m + '0'.repeat(3 - (m.length - 1)));
          
          const startTime = parseTimeToMs(startTimeStr);
          const endTime = parseTimeToMs(endTimeStr);
          
          idx++;
          
          let text = '';
          while (idx < lines.length && lines[idx].trim() !== '' && !lines[idx].includes('-->')) {
            if (lines[idx].trim()) {
              text += (text ? '\n' : '') + lines[idx].trim();
            }
            idx++;
          }
          
          if (startTime >= endTime) {
            errors.push(`Start time >= end time at cue ${cueIndex}`);
            idx++;
            continue;
          }
          
          cues.push({
            id: `cue_${cueIndex}`,
            index: cueIndex,
            startTime,
            endTime,
            startTimeStr,
            endTimeStr,
            text,
          });
          
          cueIndex++;
        } catch (e) {
          errors.push(`Failed to parse VTT time: ${e}`);
        }
      }
      
      idx++;
    }
    
    while (idx < lines.length && !lines[idx].includes('-->') && lines[idx].trim() !== '') {
      idx++;
    }
  }
  
  return { success: errors.length === 0, cues, errors };
}

export function parseFile(filePath: string): { format: 'srt' | 'vtt'; cues: SubtitleCue[]; errors: string[] } {
  const content = fs.readFileSync(filePath, 'utf-8');
  const ext = filePath.split('.').pop()?.toLowerCase();
  
  if (ext === 'vtt') {
    const result = parseVTT(content);
    return { format: 'vtt', cues: result.cues, errors: result.errors };
  } else {
    const result = parseSRT(content);
    return { format: 'srt', cues: result.cues, errors: result.errors };
  }
}

export function detectLanguage(cue: SubtitleCue): 'zh' | 'en' | 'mixed' {
  const text = cue.text;
  const chineseRegex = /[\u4e00-\u9fa5]/;
  const englishRegex = /[a-zA-Z]/;
  
  const hasChinese = chineseRegex.test(text);
  const hasEnglish = englishRegex.test(text);
  
  if (hasChinese && hasEnglish) return 'mixed';
  if (hasChinese) return 'zh';
  return 'en';
}

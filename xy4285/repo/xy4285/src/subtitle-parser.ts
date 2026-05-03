import { SubtitleCue, SubtitleFile } from './types';
import * as fs from 'fs';
import * as path from 'path';

export class SubtitleParser {
  parseFile(filePath: string): SubtitleFile {
    const content = fs.readFileSync(filePath, 'utf-8');
    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath);
    const format = ext === '.vtt' ? 'vtt' : 'srt';
    
    const cues = format === 'vtt' 
      ? this.parseVTT(content)
      : this.parseSRT(content);
    
    const { language, episode, platform } = this.extractMetadata(fileName);
    
    return {
      path: filePath,
      fileName,
      format,
      cues,
      language,
      episode,
      platform
    };
  }

  parseSRT(content: string): SubtitleCue[] {
    const cues: SubtitleCue[] = [];
    const blocks = this.splitIntoBlocks(content);
    
    for (const block of blocks) {
      const cue = this.parseSRTBlock(block);
      if (cue) {
        cues.push(cue);
      }
    }
    
    return cues;
  }

  parseVTT(content: string): SubtitleCue[] {
    const cues: SubtitleCue[] = [];
    const lines = content.split(/\r?\n/);
    let i = 0;
    
    while (i < lines.length && !lines[i].includes('-->')) {
      i++;
    }
    
    while (i < lines.length) {
      const line = lines[i].trim();
      
      if (line.includes('-->')) {
        const cue = this.parseVTTCue(lines, i);
        if (cue) {
          cues.push(cue);
          i = cue.endIndex || i + 1;
          continue;
        }
      }
      i++;
    }
    
    return cues;
  }

  private splitIntoBlocks(content: string): string[] {
    return content
      .replace(/\r\n/g, '\n')
      .split(/\n\n+/)
      .filter(block => block.trim().length > 0);
  }

  private parseSRTBlock(block: string): SubtitleCue | null {
    const lines = block.split('\n').filter(l => l.trim().length > 0);
    
    if (lines.length < 2) {
      return null;
    }
    
    let id = '';
    let timeLineIndex = 0;
    
    if (this.isNumeric(lines[0].trim())) {
      id = lines[0].trim();
      timeLineIndex = 1;
    } else {
      id = '1';
    }
    
    if (timeLineIndex >= lines.length) {
      return null;
    }
    
    const timeMatch = lines[timeLineIndex].match(
      /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/
    );
    
    if (!timeMatch) {
      return null;
    }
    
    const startTime = this.timeToMs(
      parseInt(timeMatch[1]),
      parseInt(timeMatch[2]),
      parseInt(timeMatch[3]),
      parseInt(timeMatch[4])
    );
    
    const endTime = this.timeToMs(
      parseInt(timeMatch[5]),
      parseInt(timeMatch[6]),
      parseInt(timeMatch[7]),
      parseInt(timeMatch[8])
    );
    
    const text = lines.slice(timeLineIndex + 1).join('\n').trim();
    
    return {
      id,
      startTime,
      endTime,
      text
    };
  }

  private parseVTTCue(lines: string[], startIndex: number): (SubtitleCue & { endIndex: number }) | null {
    const timeLine = lines[startIndex];
    const timeMatch = timeLine.match(
      /(\d{2}):(\d{2}):(\d{2})[.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[.](\d{3})/
    ) || timeLine.match(
      /(\d{2}):(\d{2})[.](\d{3})\s*-->\s*(\d{2}):(\d{2})[.](\d{3})/
    );
    
    if (!timeMatch) {
      return null;
    }
    
    let startTime: number;
    let endTime: number;
    
    if (timeMatch.length === 9) {
      startTime = this.timeToMs(
        parseInt(timeMatch[1]),
        parseInt(timeMatch[2]),
        parseInt(timeMatch[3]),
        parseInt(timeMatch[4])
      );
      endTime = this.timeToMs(
        parseInt(timeMatch[5]),
        parseInt(timeMatch[6]),
        parseInt(timeMatch[7]),
        parseInt(timeMatch[8])
      );
    } else {
      startTime = this.timeToMs(
        0,
        parseInt(timeMatch[1]),
        parseInt(timeMatch[2]),
        parseInt(timeMatch[3])
      );
      endTime = this.timeToMs(
        0,
        parseInt(timeMatch[4]),
        parseInt(timeMatch[5]),
        parseInt(timeMatch[6])
      );
    }
    
    let i = startIndex + 1;
    const textLines: string[] = [];
    
    while (i < lines.length && lines[i].trim() !== '' && !lines[i].includes('-->')) {
      textLines.push(lines[i]);
      i++;
    }
    
    return {
      id: (startIndex + 1).toString(),
      startTime,
      endTime,
      text: textLines.join('\n').trim(),
      endIndex: i
    };
  }

  private extractMetadata(fileName: string): { language: string; episode: string; platform: string } {
    const withoutExt = fileName.replace(/\.(srt|vtt)$/i, '');
    const parts = withoutExt.split(/[._\-]/);
    
    let language = 'unknown';
    let episode = 'unknown';
    let platform = 'unknown';
    
    const langPatterns = /^(zh|en|es|pt|ar|id|vi|th|ja|ko)(-CN|-TW|-US)?$/i;
    const episodePattern = /^(e|ep)?(\d{1,4})$/i;
    
    for (const part of parts) {
      if (langPatterns.test(part)) {
        language = part.toLowerCase();
      } else if (episodePattern.test(part)) {
        const match = part.match(episodePattern);
        if (match) {
          episode = match[2].padStart(4, '0');
        }
      } else if (!this.isNumeric(part)) {
        platform = part;
      }
    }
    
    return { language, episode, platform };
  }

  private timeToMs(hours: number, minutes: number, seconds: number, milliseconds: number): number {
    return hours * 3600000 + minutes * 60000 + seconds * 1000 + milliseconds;
  }

  private isNumeric(str: string): boolean {
    return /^\d+$/.test(str);
  }

  msToTime(ms: number): string {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = ms % 1000;
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
  }
}

import { UserNote, LogSource } from '../types';
import { BaseParser } from './base';
import { safeJsonParse, isObject, parseTimestamp } from '../utils';

interface RawUserNote {
  timestamp?: number;
  time?: string | number;
  note?: string;
  content?: string;
  message?: string;
  severity?: 'info' | 'warning' | 'critical';
  level?: string;
}

export class UserNoteParser extends BaseParser {
  protected getSourceType(): 'usernote' {
    return 'usernote';
  }

  async parse(content: string): Promise<{
    events: UserNote[];
    source: LogSource;
  }> {
    const rawNotes = this.parseContent(content);
    
    if (rawNotes.length === 0) {
      throw new Error('没有找到有效的用户手写时间点数据');
    }

    const events = rawNotes.map(note => this.convertToUserNote(note));
    
    const { start, end } = this.getTimeRange(events);
    const source = this.createLogSource(start, end);

    return { events, source };
  }

  private parseContent(content: string): RawUserNote[] {
    const parsed = safeJsonParse(content);
    
    if (Array.isArray(parsed)) {
      return parsed.filter(isObject).map(item => this.normalizeRawNote(item));
    }
    
    if (isObject(parsed)) {
      if (this.looksLikeUserNote(parsed)) {
        return [this.normalizeRawNote(parsed)];
      }
      
      const values = Object.values(parsed);
      const objectValues = values.filter(isObject);
      if (objectValues.length > 0 && objectValues.some(v => this.looksLikeUserNote(v))) {
        return objectValues.filter(v => this.looksLikeUserNote(v)).map(v => this.normalizeRawNote(v));
      }
    }

    const lines = content.trim().split('\n');
    if (lines.length > 0) {
      const notes: RawUserNote[] = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        try {
          const parsedLine = JSON.parse(line);
          if (isObject(parsedLine) && this.looksLikeUserNote(parsedLine)) {
            notes.push(this.normalizeRawNote(parsedLine));
          }
        } catch {
          const textNote = this.tryParseTextLine(line, i);
          if (textNote) {
            notes.push(textNote);
          }
        }
      }
      
      if (notes.length > 0) {
        return notes;
      }
    }

    return [];
  }

  private looksLikeUserNote(obj: Record<string, unknown>): boolean {
    const noteKeywords = ['note', 'content', 'message', 'description', 'text'];
    const keys = Object.keys(obj).map(k => k.toLowerCase());
    
    for (const keyword of noteKeywords) {
      if (keys.some(k => k.includes(keyword))) {
        return true;
      }
    }
    
    if ('timestamp' in obj || 'time' in obj) {
      if ('note' in obj || 'content' in obj || 'message' in obj) {
        return true;
      }
    }
    
    return false;
  }

  private normalizeRawNote(obj: Record<string, unknown>): RawUserNote {
    const note: RawUserNote = {};
    
    if ('timestamp' in obj && typeof obj.timestamp === 'number') {
      note.timestamp = obj.timestamp;
    } else if ('time' in obj) {
      note.time = obj.time as string | number;
    }
    
    if ('note' in obj && typeof obj.note === 'string') {
      note.note = obj.note;
    } else if ('content' in obj && typeof obj.content === 'string') {
      note.content = obj.content;
    } else if ('message' in obj && typeof obj.message === 'string') {
      note.message = obj.message;
    } else if ('description' in obj && typeof obj.description === 'string') {
      note.content = obj.description;
    }
    
    if ('severity' in obj && typeof obj.severity === 'string') {
      const severity = obj.severity.toLowerCase();
      if (severity === 'info' || severity === 'warning' || severity === 'critical') {
        note.severity = severity;
      }
    } else if ('level' in obj && typeof obj.level === 'string') {
      const level = obj.level.toLowerCase();
      if (level === 'info' || level === 'warning' || level === 'critical' || level === 'error') {
        note.severity = level === 'error' ? 'critical' : level as 'info' | 'warning' | 'critical';
      }
    }

    return note;
  }

  private tryParseTextLine(line: string, index: number): RawUserNote | null {
    const fullTimeMatch = line.match(/^\[?(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)\]?\s*(.+)$/);
    const simpleTimeMatch = line.match(/^(\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?)\s+(.+)$/);
    const relativeTimeMatch = line.match(/^(\d+(?:\.\d+)?)\s*(s|sec|seconds?|m|min|minutes?)\s*(?:ago\s*)?(.+)$/i);
    
    let timestamp: number | undefined;
    let note: string | undefined;

    if (fullTimeMatch) {
      try {
        timestamp = parseTimestamp(fullTimeMatch[1]);
        note = fullTimeMatch[2].trim();
      } catch {
        return null;
      }
    } else if (simpleTimeMatch) {
      try {
        timestamp = parseTimestamp(simpleTimeMatch[1]);
        note = simpleTimeMatch[2].trim();
      } catch {
        return null;
      }
    } else if (relativeTimeMatch) {
      const amount = parseFloat(relativeTimeMatch[1]);
      const unit = relativeTimeMatch[2].toLowerCase();
      const now = Date.now();
      let multiplier = 1000;
      
      if (unit.startsWith('m')) {
        multiplier = 60 * 1000;
      }
      
      timestamp = now - amount * multiplier;
      note = relativeTimeMatch[3].trim();
    } else {
      const severityMatch = line.match(/^\[(info|warning|critical|error)\]\s*(.+)$/i);
      if (severityMatch) {
        timestamp = Date.now() + index * 1000;
        note = severityMatch[2].trim();
      } else {
        timestamp = Date.now() + index * 1000;
        note = line;
      }
    }

    if (!note || note.trim().length === 0) {
      return null;
    }

    let severity: 'info' | 'warning' | 'critical' = 'info';
    const lowerNote = note.toLowerCase();
    
    if (lowerNote.includes('卡顿') || lowerNote.includes('stutter') || lowerNote.includes('freeze')) {
      severity = 'warning';
    }
    if (lowerNote.includes('严重') || lowerNote.includes('critical') || lowerNote.includes('断连') || lowerNote.includes('disconnect')) {
      severity = 'critical';
    }
    if (lowerNote.includes('[warning]') || lowerNote.includes('(warning)')) {
      severity = 'warning';
    }
    if (lowerNote.includes('[critical]') || lowerNote.includes('[error]') || lowerNote.includes('(critical)') || lowerNote.includes('(error)')) {
      severity = 'critical';
    }
    if (lowerNote.includes('[info]') || lowerNote.includes('(info)')) {
      severity = 'info';
    }

    return {
      timestamp,
      note,
      severity
    };
  }

  private convertToUserNote(rawNote: RawUserNote): UserNote {
    const timestamp = this.extractTimestamp(rawNote);
    const note = rawNote.note || rawNote.content || rawNote.message || '';
    const severity = rawNote.severity || this.inferSeverity(note);

    return {
      timestamp: this.adjustTimestamp(timestamp),
      type: 'user_note',
      source: 'usernote',
      note,
      severity,
      rawData: rawNote
    };
  }

  private extractTimestamp(rawNote: RawUserNote): number {
    if (typeof rawNote.timestamp === 'number') {
      return rawNote.timestamp;
    }
    
    if (rawNote.time !== undefined) {
      try {
        return parseTimestamp(rawNote.time);
      } catch {
        return Date.now();
      }
    }
    
    return Date.now();
  }

  private inferSeverity(note: string): 'info' | 'warning' | 'critical' {
    const lowerNote = note.toLowerCase();
    
    if (lowerNote.includes('critical') || lowerNote.includes('error') || lowerNote.includes('failure') ||
        lowerNote.includes('断连') || lowerNote.includes('失败') || lowerNote.includes('崩溃')) {
      return 'critical';
    }
    
    if (lowerNote.includes('warning') || lowerNote.includes('stutter') || lowerNote.includes('freeze') ||
        lowerNote.includes('卡顿') || lowerNote.includes('卡') || lowerNote.includes('延迟') || lowerNote.includes('delay')) {
      return 'warning';
    }
    
    return 'info';
  }
}

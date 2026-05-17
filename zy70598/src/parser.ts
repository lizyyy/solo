import * as fs from 'fs';
import * as readline from 'readline';
import { WebSocketFrame, ParseOptions } from './types';

export class WebSocketLogParser {
  private options: ParseOptions;

  constructor(options: ParseOptions = {}) {
    this.options = {
      timeFormat: 'ISO',
      payloadEncoding: 'json',
      ...options,
    };
  }

  async parseFile(filePath: string): Promise<WebSocketFrame[]> {
    const frames: WebSocketFrame[] = [];
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath, { encoding: 'utf-8' }),
      crlfDelay: Infinity,
    });

    let lineNumber = 0;

    for await (const line of rl) {
      lineNumber++;
      const frame = this.parseLine(line, lineNumber);
      frames.push(frame);
    }

    return frames;
  }

  private parseLine(line: string, lineNumber: number): WebSocketFrame {
    const baseFrame: WebSocketFrame = {
      raw: line,
      lineNumber,
      timestamp: 0,
      timestampStr: '',
      connectionId: '',
      direction: 'unknown',
      opcode: 'unknown',
      payload: '',
      isValid: false,
    };

    if (!line.trim()) {
      return {
        ...baseFrame,
        raw: line || ' ',
        parseError: '空行',
      };
    }

    try {
      return this.tryParseFormats(line, lineNumber, baseFrame);
    } catch (error) {
      return {
        ...baseFrame,
        parseError: `解析失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private tryParseFormats(line: string, lineNumber: number, baseFrame: WebSocketFrame): WebSocketFrame {
    const parsers = [
      this.parseStandardFormat.bind(this),
      this.parseJsonFormat.bind(this),
      this.parseNginxFormat.bind(this),
      this.parseSimpleFormat.bind(this),
    ];

    for (const parser of parsers) {
      try {
        const result = parser(line, lineNumber);
        if (result && result.isValid) {
          return result;
        }
      } catch {
        continue;
      }
    }

    return {
      ...baseFrame,
      parseError: '无法识别的日志格式',
    };
  }

  private parseStandardFormat(line: string, lineNumber: number): WebSocketFrame | null {
    const patterns = [
      {
        regex: /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[.,]\d{3}Z?)\s+\[([^\]]+)\]\s+(IN|OUT|in|out)\s+(\w+)\s*(.*)$/,
        groups: ['timestamp', 'connectionId', 'direction', 'opcode', 'payload'],
      },
      {
        regex: /^\[(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}[.,]\d{3})\]\s+(\S+)\s+(->|<-)\s+(\w+):?\s*(.*)$/,
        groups: ['timestamp', 'connectionId', 'direction', 'opcode', 'payload'],
      },
    ];

    for (const pattern of patterns) {
      const match = line.match(pattern.regex);
      if (match) {
        const timestampStr = match[1];
        const timestamp = this.parseTimestamp(timestampStr);
        const direction = this.normalizeDirection(match[3]);

        return {
          raw: line,
          lineNumber,
          timestamp,
          timestampStr,
          connectionId: match[2],
          direction,
          opcode: match[4],
          payload: match[5] || '',
          isValid: true,
        };
      }
    }

    return null;
  }

  private parseJsonFormat(line: string, lineNumber: number): WebSocketFrame | null {
    try {
      const data = JSON.parse(line);

      const timestampField = data.timestamp || data.time || data.ts || data.date;
      const connectionId = data.connectionId || data.connId || data.session || data.wsId || '';
      const direction = data.direction || data.dir || data.type || '';
      const opcode = data.opcode || data.op || data.frameType || 'text';
      const payload = data.payload || data.data || data.message || '';

      if (timestampField) {
        const timestamp = this.parseTimestamp(String(timestampField));
        return {
          raw: line,
          lineNumber,
          timestamp,
          timestampStr: String(timestampField),
          connectionId: String(connectionId),
          direction: this.normalizeDirection(direction),
          opcode: String(opcode),
          payload: typeof payload === 'string' ? payload : JSON.stringify(payload),
          isValid: true,
        };
      }
    } catch {
      return null;
    }
    return null;
  }

  private parseNginxFormat(line: string, lineNumber: number): WebSocketFrame | null {
    const nginxPattern = /^(\S+)\s+\S+\s+\S+\s+\[([^\]]+)\]\s+"[^"]+"\s+\d+\s+\d+\s+"[^"]*"\s+"[^"]*"\s*(.*)$/;
    const match = line.match(nginxPattern);
    if (match) {
      const timestamp = this.parseNginxTime(match[2]);
      return {
        raw: line,
        lineNumber,
        timestamp,
        timestampStr: match[2],
        connectionId: match[1],
        direction: 'unknown',
        opcode: 'proxy',
        payload: match[3],
        isValid: true,
      };
    }
    return null;
  }

  private parseSimpleFormat(line: string, lineNumber: number): WebSocketFrame | null {
    const timeMatch = line.match(/(\d{13}|\d{10})/);
    if (timeMatch) {
      const timestamp = timeMatch[1].length === 13
        ? parseInt(timeMatch[1], 10)
        : parseInt(timeMatch[1], 10) * 1000;

      return {
        raw: line,
        lineNumber,
        timestamp,
        timestampStr: timeMatch[1],
        connectionId: '',
        direction: line.includes('<-') || line.includes('IN') ? 'in' : line.includes('->') || line.includes('OUT') ? 'out' : 'unknown',
        opcode: 'text',
        payload: line,
        isValid: true,
      };
    }
    return null;
  }

  private parseTimestamp(ts: string): number {
    if (/^\d{13}$/.test(ts)) {
      return parseInt(ts, 10);
    }
    if (/^\d{10}$/.test(ts)) {
      return parseInt(ts, 10) * 1000;
    }
    const date = new Date(ts);
    if (!isNaN(date.getTime())) {
      return date.getTime();
    }
    return Date.now();
  }

  private parseNginxTime(timeStr: string): number {
    const match = timeStr.match(/(\d+)\/(\w+)\/(\d+):(\d+):(\d+):(\d+)\s+([+-])(\d+)/);
    if (match) {
      const months: Record<string, number> = {
        Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
        Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
      };
      const date = new Date(
        parseInt(match[3], 10),
        months[match[2]] || 0,
        parseInt(match[1], 10),
        parseInt(match[4], 10),
        parseInt(match[5], 10),
        parseInt(match[6], 10)
      );
      return date.getTime();
    }
    return this.parseTimestamp(timeStr);
  }

  private normalizeDirection(dir: string): 'in' | 'out' | 'unknown' {
    const d = dir.toLowerCase();
    if (d === 'in' || d === 'recv' || d === 'receive' || d === '<-') {
      return 'in';
    }
    if (d === 'out' || d === 'send' || d === 'transmit' || d === '->') {
      return 'out';
    }
    return 'unknown';
  }

  sortFramesByTime(frames: WebSocketFrame[]): WebSocketFrame[] {
    return [...frames].sort((a, b) => {
      if (a.timestamp !== b.timestamp) {
        return a.timestamp - b.timestamp;
      }
      return a.lineNumber - b.lineNumber;
    });
  }

  filterByConnection(frames: WebSocketFrame[], connectionId: string): WebSocketFrame[] {
    return frames.filter(f => f.connectionId === connectionId || f.connectionId.includes(connectionId));
  }

  getInvalidFrames(frames: WebSocketFrame[]): WebSocketFrame[] {
    return frames.filter(f => !f.isValid);
  }

  getConnectionIds(frames: WebSocketFrame[]): string[] {
    const ids = new Set<string>();
    frames.forEach(f => {
      if (f.connectionId) {
        ids.add(f.connectionId);
      }
    });
    return Array.from(ids).sort();
  }
}

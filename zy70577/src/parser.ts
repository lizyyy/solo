import * as fs from 'fs';
import * as readline from 'readline';
import { LogEntry, BadLine, CacheHitStatus, CLIOptions } from './types';
import { LOG_PATTERNS, CACHE_HIT_STATUS } from './constants';

interface ParseResult {
  entries: LogEntry[];
  badLines: BadLine[];
  totalLines: number;
}

export class LogParser {
  private options: CLIOptions;
  private patterns: Record<string, RegExp>;

  constructor(options: CLIOptions) {
    this.options = options;
    const format = this.options.logFormat;
    if (format && format !== 'auto' && LOG_PATTERNS[format]) {
      this.patterns = LOG_PATTERNS[format];
    } else {
      this.patterns = LOG_PATTERNS['github-actions'];
    }
  }

  private async autoDetectPatterns(): Promise<Record<string, RegExp>> {
    const format = this.options.logFormat || 'auto';
    if (format !== 'auto' && LOG_PATTERNS[format]) {
      return LOG_PATTERNS[format];
    }

    try {
      const content = await fs.promises.readFile(this.options.input, 'utf8');
      const detectedFormat = this.detectFormatFromContent(content);
      if (detectedFormat) {
        return LOG_PATTERNS[detectedFormat];
      }
    } catch (e) {
    }
    return LOG_PATTERNS['github-actions'];
  }

  async parse(): Promise<ParseResult> {
    this.patterns = await this.autoDetectPatterns();
    
    const entries: LogEntry[] = [];
    const badLines: BadLine[] = [];
    let lineNumber = 0;
    let currentStage = 'unknown';

    const rl = readline.createInterface({
      input: fs.createReadStream(this.options.input),
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      lineNumber++;
      try {
        const entry = this.parseLine(line, lineNumber, currentStage);
        if (entry.stage && entry.stage !== currentStage) {
          currentStage = entry.stage;
        }
        if (this.isValidEntry(entry)) {
          entries.push(entry);
        } else if (line.trim()) {
          badLines.push({
            lineNumber,
            raw: line,
            reason: '无法识别的日志格式或缺少关键字段',
          });
        }
      } catch (error) {
        badLines.push({
          lineNumber,
          raw: line,
          reason: `解析异常: ${(error as Error).message}`,
        });
      }
    }

    return {
      entries,
      badLines,
      totalLines: lineNumber,
    };
  }

  private parseLine(line: string, lineNumber: number, currentStage: string): LogEntry {
    const entry: LogEntry = {
      lineNumber,
      raw: line,
      stage: currentStage,
    };

    const timestampMatch = line.match(this.patterns.timestamp);
    if (timestampMatch) {
      entry.timestamp = timestampMatch[0];
    }

    const stageMatch = line.match(this.patterns.stage);
    if (stageMatch) {
      entry.stage = stageMatch[1].trim();
    }

    const cacheHitMatch = line.match(this.patterns.cacheHit);
    if (cacheHitMatch) {
      entry.hitStatus = CACHE_HIT_STATUS.HIT;
      entry.cacheKey = cacheHitMatch[1].trim();
      entry.message = `缓存命中: ${entry.cacheKey}`;
    }

    const cacheMissMatch = line.match(this.patterns.cacheMiss);
    if (cacheMissMatch) {
      entry.hitStatus = CACHE_HIT_STATUS.MISS;
      entry.cacheKey = cacheMissMatch[1].trim();
      entry.message = `缓存未命中: ${entry.cacheKey}`;
    }

    const cacheKeyMatch = line.match(this.patterns.cacheKey);
    if (cacheKeyMatch && !entry.cacheKey) {
      entry.cacheKey = cacheKeyMatch[1].trim();
    }

    const durationMatch = line.match(this.patterns.duration);
    if (durationMatch) {
      const ms1 = durationMatch[1] ? parseInt(durationMatch[1], 10) : 0;
      const ms2 = durationMatch[2] ? parseInt(durationMatch[2], 10) : 0;
      const seconds = durationMatch[3] ? parseFloat(durationMatch[3]) : 0;
      entry.durationMs = ms1 > 0 ? ms1 : (ms2 > 0 ? ms2 : Math.round(seconds * 1000));
    }

    if (!entry.hitStatus && (entry.cacheKey || entry.durationMs)) {
      entry.hitStatus = CACHE_HIT_STATUS.UNKNOWN;
    }

    if (!entry.message && line.length > 0) {
      entry.message = line.substring(0, 200);
    }

    return entry;
  }

  private isValidEntry(entry: LogEntry): boolean {
    return !!(
      entry.hitStatus ||
      entry.cacheKey ||
      entry.durationMs ||
      (entry.stage && entry.stage !== 'unknown')
    );
  }

  detectFormatFromContent(content: string): keyof typeof LOG_PATTERNS | null {
    for (const [format, patterns] of Object.entries(LOG_PATTERNS)) {
      let matches = 0;
      for (const pattern of Object.values(patterns)) {
        if (pattern.test(content)) {
          matches++;
        }
      }
      if (matches >= 2) {
        return format as keyof typeof LOG_PATTERNS;
      }
    }
    return null;
  }
}

export async function parseLogFile(options: CLIOptions): Promise<ParseResult> {
  const parser = new LogParser(options);
  return parser.parse();
}

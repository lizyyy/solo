import * as fs from 'fs/promises';
import { 
  LogSource, 
  TimestampedEvent, 
  ParseOptions
} from '../types';
import { BaseParser } from './base';
import { GetStatsParser } from './getstats-parser';
import { SignalingParser } from './signaling-parser';
import { UserNoteParser } from './usernote-parser';

export type ParserType = 'auto' | 'getstats' | 'signaling' | 'usernote';

export interface ParseResult {
  events: TimestampedEvent[];
  source: LogSource;
  detectedType: 'getstats' | 'signaling' | 'usernote';
}

export interface FileParseResult extends ParseResult {
  filePath: string;
}

export class ParserManager {
  private parsers: Map<string, new (options?: ParseOptions) => BaseParser>;

  constructor() {
    this.parsers = new Map();
    this.registerParsers();
  }

  private registerParsers(): void {
    this.parsers.set('getstats', GetStatsParser);
    this.parsers.set('signaling', SignalingParser);
    this.parsers.set('usernote', UserNoteParser);
  }

  async parseFile(filePath: string, options: ParseOptions & { type?: ParserType } = {}): Promise<FileParseResult> {
    const content = await fs.readFile(filePath, 'utf-8');
    const result = await this.parse(content, options);
    
    return {
      ...result,
      filePath
    };
  }

  async parse(content: string, options: ParseOptions & { type?: ParserType } = {}): Promise<ParseResult> {
    const type = options.type || 'auto';
    
    if (type !== 'auto') {
      const ParserClass = this.parsers.get(type);
      if (!ParserClass) {
        throw new Error(`不支持的解析器类型: ${type}`);
      }
      
      const parser = new ParserClass(options);
      const result = await parser.parse(content);
      
      return {
        ...result,
        detectedType: type
      };
    }

    return this.autoDetectAndParse(content, options);
  }

  private async autoDetectAndParse(content: string, options: ParseOptions): Promise<ParseResult> {
    const detectionResults: Array<{
      type: 'getstats' | 'signaling' | 'usernote';
      score: number;
      error?: Error;
    }> = [];

    const types: Array<'getstats' | 'signaling' | 'usernote'> = ['getstats', 'signaling', 'usernote'];
    
    for (const type of types) {
      const ParserClass = this.parsers.get(type);
      if (!ParserClass) continue;

      try {
        const parser = new ParserClass(options);
        await parser.parse(content);
        
        const score = this.calculateDetectionScore(type, content);
        detectionResults.push({ type, score });
      } catch (error) {
        detectionResults.push({
          type,
          score: 0,
          error: error instanceof Error ? error : new Error(String(error))
        });
      }
    }

    const validResults = detectionResults.filter(r => r.score > 0);
    
    if (validResults.length === 0) {
      const errors = detectionResults
        .filter(r => r.error)
        .map(r => `${r.type}: ${r.error?.message}`)
        .join('; ');
      throw new Error(`无法自动检测日志类型，所有解析器都失败: ${errors}`);
    }

    validResults.sort((a, b) => b.score - a.score);
    const bestMatch = validResults[0];

    const ParserClass = this.parsers.get(bestMatch.type)!;
    const parser = new ParserClass(options);
    const result = await parser.parse(content);

    return {
      ...result,
      detectedType: bestMatch.type
    };
  }

  private calculateDetectionScore(type: string, content: string): number {
    const lowerContent = content.toLowerCase();
    let score = 50;

    switch (type) {
      case 'getstats':
        if (lowerContent.includes('candidate-pair') || lowerContent.includes('inbound-rtp') || 
            lowerContent.includes('outbound-rtp') || lowerContent.includes('ssrc')) {
          score += 30;
        }
        if (lowerContent.includes('packetslost') || lowerContent.includes('jitter') || 
            lowerContent.includes('bitrate') || lowerContent.includes('bytesreceived')) {
          score += 15;
        }
        if (lowerContent.includes('type') && lowerContent.includes('id')) {
          score += 5;
        }
        break;

      case 'signaling':
        if (lowerContent.includes('offer') || lowerContent.includes('answer') || 
            lowerContent.includes('sdp') || lowerContent.includes('ice_candidate')) {
          score += 30;
        }
        if (lowerContent.includes('ice_restart') || lowerContent.includes('renegotiation') ||
            lowerContent.includes('connectionstate') || lowerContent.includes('icestate')) {
          score += 20;
        }
        if (lowerContent.includes('send') || lowerContent.includes('receive') ||
            lowerContent.includes('direction')) {
          score += 10;
        }
        break;

      case 'usernote':
        const hasTimePrefix = /^\[?\d{4}-\d{2}-\d{2}|\d{2}:\d{2}:\d{2}/.test(content);
        if (hasTimePrefix) {
          score += 15;
        }
        if (lowerContent.includes('卡顿') || lowerContent.includes('卡') || 
            lowerContent.includes('延迟') || lowerContent.includes('stutter')) {
          score += 20;
        }
        if (lowerContent.includes('note') || lowerContent.includes('用户') ||
            lowerContent.includes('备注') || lowerContent.includes('记录')) {
          score += 15;
        }
        
        const lines = content.split('\n').filter(l => l.trim().length > 0);
        if (lines.length >= 2 && lines.every(l => l.length < 500)) {
          score += 10;
        }
        break;
    }

    return Math.min(score, 100);
  }

  async parseFiles(
    filePaths: string[],
    options: ParseOptions & { type?: ParserType } = {}
  ): Promise<FileParseResult[]> {
    const results: FileParseResult[] = [];
    const errors: Array<{ filePath: string; error: Error }> = [];

    for (const filePath of filePaths) {
      try {
        const result = await this.parseFile(filePath, options);
        results.push(result);
      } catch (error) {
        errors.push({
          filePath,
          error: error instanceof Error ? error : new Error(String(error))
        });
      }
    }

    if (errors.length > 0 && results.length === 0) {
      const errorMessages = errors.map(e => `${e.filePath}: ${e.error.message}`).join('; ');
      throw new Error(`所有文件解析失败: ${errorMessages}`);
    }

    return results;
  }

  async parseFilesWithTypes(
    files: Array<{ filePath: string; type?: ParserType }>,
    options: ParseOptions = {}
  ): Promise<FileParseResult[]> {
    const results: FileParseResult[] = [];
    const errors: Array<{ filePath: string; error: Error }> = [];

    for (const file of files) {
      try {
        const result = await this.parseFile(file.filePath, { ...options, type: file.type });
        results.push(result);
      } catch (error) {
        errors.push({
          filePath: file.filePath,
          error: error instanceof Error ? error : new Error(String(error))
        });
      }
    }

    if (errors.length > 0 && results.length === 0) {
      const errorMessages = errors.map(e => `${e.filePath}: ${e.error.message}`).join('; ');
      throw new Error(`所有文件解析失败: ${errorMessages}`);
    }

    return results;
  }
}

export { BaseParser, GetStatsParser, SignalingParser, UserNoteParser };

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { Cassette, CassetteInteraction, HTTPRequest, HTTPResponse, ExitCodes } from '../types';

export interface ParseError {
  message: string;
  line?: number;
  column?: number;
  code: number;
}

export class CassetteParser {
  private filePath: string;
  private rawContent: string = '';

  constructor(filePath: string) {
    this.filePath = path.resolve(filePath);
  }

  async parse(): Promise<Cassette> {
    this.validateFileExists();
    this.rawContent = await this.readFile();
    
    const format = this.detectFormat();
    
    try {
      if (format === 'yaml') {
        return this.parseYaml();
      } else {
        return this.parseJson();
      }
    } catch (error) {
      throw this.createParseError(error);
    }
  }

  private validateFileExists(): void {
    if (!fs.existsSync(this.filePath)) {
      const error: ParseError = {
        message: `文件不存在: ${this.filePath}`,
        code: ExitCodes.INPUT_ERROR
      };
      throw error;
    }

    const stats = fs.statSync(this.filePath);
    if (!stats.isFile()) {
      const error: ParseError = {
        message: `路径不是文件: ${this.filePath}`,
        code: ExitCodes.INPUT_ERROR
      };
      throw error;
    }
  }

  private async readFile(): Promise<string> {
    return fs.promises.readFile(this.filePath, 'utf-8');
  }

  private detectFormat(): 'yaml' | 'json' {
    const ext = path.extname(this.filePath).toLowerCase();
    if (ext === '.yaml' || ext === '.yml') {
      return 'yaml';
    }
    if (ext === '.json') {
      return 'json';
    }

    const trimmed = this.rawContent.trimStart();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return 'json';
    }
    return 'yaml';
  }

  private parseYaml(): Cassette {
    const lineOffsets = this.getLineOffsets();
    const doc = yaml.load(this.rawContent, {
      filename: this.filePath,
      onWarning: (warning) => {
        console.warn(`YAML 警告: ${warning.message}`);
      }
    }) as any;

    return this.normalizeCassette(doc, 'yaml', lineOffsets);
  }

  private parseJson(): Cassette {
    const lineOffsets = this.getLineOffsets();
    const doc = JSON.parse(this.rawContent);
    return this.normalizeCassette(doc, 'json', lineOffsets);
  }

  private getLineOffsets(): number[] {
    const offsets: number[] = [0];
    let index = this.rawContent.indexOf('\n');
    while (index !== -1) {
      offsets.push(index + 1);
      index = this.rawContent.indexOf('\n', index + 1);
    }
    return offsets;
  }

  private findLineNumber(position: number, lineOffsets: number[]): number {
    for (let i = 0; i < lineOffsets.length; i++) {
      if (position < lineOffsets[i]) {
        return i;
      }
    }
    return lineOffsets.length;
  }

  private normalizeCassette(
    doc: any, 
    format: 'yaml' | 'json',
    lineOffsets: number[]
  ): Cassette {
    if (!doc) {
      throw { message: 'Cassette 文件为空', code: ExitCodes.PARSE_ERROR };
    }

    let interactions: any[] = [];
    let version: string | undefined;

    if (Array.isArray(doc)) {
      interactions = doc;
    } else if (doc.http_interactions) {
      interactions = doc.http_interactions.interactions || doc.http_interactions || [];
      version = doc.version;
    } else if (doc.interactions) {
      interactions = doc.interactions;
      version = doc.version;
    } else {
      interactions = [doc];
    }

    const normalizedInteractions = interactions.map((interaction, index) => 
      this.normalizeInteraction(interaction, index, lineOffsets)
    );

    return {
      version,
      interactions: normalizedInteractions,
      rawContent: this.rawContent,
      filePath: this.filePath,
      format
    };
  }

  private normalizeInteraction(
    interaction: any,
    index: number,
    lineOffsets: number[]
  ): CassetteInteraction {
    const request = this.normalizeRequest(interaction.request || interaction);
    const response = this.normalizeResponse(interaction.response || interaction);

    const sourceLine = this.estimateInteractionLine(interaction, index, lineOffsets);

    return {
      id: this.generateInteractionId(request, index),
      request,
      response,
      recordedAt: interaction.recorded_at || interaction.timestamp,
      duration: interaction.duration,
      sourceLine,
      sourceFile: this.filePath
    };
  }

  private normalizeRequest(req: any): HTTPRequest {
    const method = (req.method || 'GET').toUpperCase();
    const uri = req.uri || req.url || req.path || '/';
    
    const headers = this.normalizeHeaders(req.headers);
    const body = this.normalizeBody(req.body, headers);
    const query = this.extractQueryParams(uri, req.query);

    return {
      method,
      uri: this.stripQueryString(uri),
      url: uri,
      headers,
      body,
      query
    };
  }

  private normalizeResponse(res: any): HTTPResponse {
    const status = {
      code: res.status?.code || res.status_code || res.status || 200,
      message: res.status?.message || res.statusText
    };

    const headers = this.normalizeHeaders(res.headers);
    const body = this.normalizeBody(res.body, headers);

    return {
      status,
      headers,
      body
    };
  }

  private normalizeHeaders(headers: any): Record<string, string | string[]> {
    if (!headers) return {};

    const normalized: Record<string, string | string[]> = {};
    
    for (const [key, value] of Object.entries(headers)) {
      const lowerKey = key.toLowerCase();
      if (Array.isArray(value) && value.length === 1) {
        normalized[lowerKey] = value[0];
      } else {
        normalized[lowerKey] = value as string | string[];
      }
    }

    return normalized;
  }

  private normalizeBody(body: any, headers: Record<string, string | string[]>): any {
    if (body === undefined || body === null) {
      return undefined;
    }

    if (typeof body === 'object') {
      return body;
    }

    if (typeof body === 'string') {
      const contentType = String(headers['content-type'] || '');
      
      if (contentType.includes('application/json') || this.looksLikeJson(body)) {
        try {
          return JSON.parse(body);
        } catch {
          return body;
        }
      }

      return body;
    }

    return String(body);
  }

  private looksLikeJson(str: string): boolean {
    const trimmed = str.trim();
    return (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
           (trimmed.startsWith('[') && trimmed.endsWith(']'));
  }

  private extractQueryParams(uri: string, existingQuery?: any): Record<string, string | string[]> {
    const query: Record<string, string | string[]> = { ...existingQuery };

    const queryIndex = uri.indexOf('?');
    if (queryIndex !== -1) {
      const queryString = uri.substring(queryIndex + 1);
      const params = new URLSearchParams(queryString);
      
      for (const [key, value] of params.entries()) {
        if (query[key]) {
          if (!Array.isArray(query[key])) {
            query[key] = [query[key] as string];
          }
          (query[key] as string[]).push(value);
        } else {
          query[key] = value;
        }
      }
    }

    return query;
  }

  private stripQueryString(uri: string): string {
    const queryIndex = uri.indexOf('?');
    return queryIndex !== -1 ? uri.substring(0, queryIndex) : uri;
  }

  private generateInteractionId(request: HTTPRequest, index: number): string {
    const method = request.method;
    const path = request.uri.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    return `${method}_${path}_${index}`;
  }

  private estimateInteractionLine(
    interaction: any,
    index: number,
    lineOffsets: number[]
  ): number | undefined {
    try {
      const searchStr = JSON.stringify(interaction).substring(0, 100);
      const escapedSearch = searchStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*');
      const regex = new RegExp(escapedSearch.substring(0, 50));
      const match = this.rawContent.match(regex);
      
      if (match && match.index !== undefined) {
        return this.findLineNumber(match.index, lineOffsets);
      }
    } catch {
    }

    return Math.max(1, index * 10 + 1);
  }

  private createParseError(error: any): ParseError {
    if (error.name === 'YAMLException') {
      return {
        message: `YAML 解析错误: ${error.message}`,
        line: error.mark?.line,
        column: error.mark?.column,
        code: ExitCodes.PARSE_ERROR
      };
    }
    
    if (error instanceof SyntaxError) {
      const match = error.message.match(/position (\d+)/);
      const position = match ? parseInt(match[1]) : 0;
      const lineOffsets = this.getLineOffsets();
      
      return {
        message: `JSON 解析错误: ${error.message}`,
        line: this.findLineNumber(position, lineOffsets),
        code: ExitCodes.PARSE_ERROR
      };
    }

    return {
      message: error.message || '未知解析错误',
      code: ExitCodes.PARSE_ERROR
    };
  }
}

export async function parseCassette(filePath: string): Promise<Cassette> {
  const parser = new CassetteParser(filePath);
  return parser.parse();
}

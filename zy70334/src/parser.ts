import * as fs from 'fs';
import * as path from 'path';
import JSON5 from 'json5';
import { LogEntry, BusinessFieldConfig, ScanResult } from './types';

export class LogParser {
  private config: BusinessFieldConfig;

  constructor(configPath?: string) {
    this.config = this.loadConfig(configPath);
  }

  private loadConfig(configPath?: string): BusinessFieldConfig {
    const defaultConfig: BusinessFieldConfig = {
      orderIdFields: ['order_id', 'orderId', 'order_no', 'tradeNo'],
      tenantIdFields: ['tenant_id', 'tenantId', 'tenant'],
      errorCodeFields: ['error_code', 'errorCode', 'code', 'errCode'],
      amountFields: ['amount', 'total_amount', 'payment_amount', 'price'],
      messageFields: ['message', 'msg', 'error_message', 'errorMsg', 'content'],
      timestampFields: ['timestamp', 'time', 'date', '@timestamp'],
      logPattern: 'json'
    };

    if (configPath) {
      const absolutePath = path.resolve(configPath);
      if (fs.existsSync(absolutePath)) {
        try {
          const content = fs.readFileSync(absolutePath, 'utf-8');
          const userConfig = JSON5.parse(content);
          return { ...defaultConfig, ...userConfig };
        } catch (e) {
          console.warn(`警告: 配置文件解析失败，使用默认配置`);
        }
      }
    }
    return defaultConfig;
  }

  public parseLogFile(filePath: string): LogEntry[] {
    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`日志文件不存在: ${filePath}`);
    }

    const content = fs.readFileSync(absolutePath, 'utf-8');
    const lines = content.split('\n');
    const entries: LogEntry[] = [];

    lines.forEach((line, index) => {
      if (line.trim()) {
        const entry = this.parseLine(line, index + 1);
        if (entry) {
          entries.push(entry);
        }
      }
    });

    return entries;
  }

  private parseLine(line: string, lineNumber: number): LogEntry | null {
    try {
      let jsonObj: any;
      try {
        jsonObj = JSON.parse(line);
      } catch {
        return null;
      }

      const timestamp = this.extractField<string>(jsonObj, this.config.timestampFields) || 
                       this.extractTimestampFromLine(line) ||
                       new Date().toISOString();
      
      const orderId = this.extractField<string>(jsonObj, this.config.orderIdFields);
      const tenantId = this.extractField<string>(jsonObj, this.config.tenantIdFields);
      const errorCode = this.extractField<string>(jsonObj, this.config.errorCodeFields);
      
      const amountRaw = this.extractField<number | string>(jsonObj, this.config.amountFields);
      const amount = amountRaw !== undefined ? 
        (typeof amountRaw === 'string' ? parseFloat(amountRaw) : amountRaw) : 
        undefined;

      const message = this.extractField<string>(jsonObj, this.config.messageFields) || 
                      jsonObj.message || 
                      JSON.stringify(jsonObj);

      return {
        timestamp,
        orderId,
        tenantId,
        errorCode,
        amount,
        message,
        raw: line,
        lineNumber
      };
    } catch {
      return null;
    }
  }

  private extractField<T>(obj: any, fields: string[]): T | undefined {
    for (const field of fields) {
      if (obj[field] !== undefined) {
        return obj[field] as T;
      }
      const nestedFields = field.split('.');
      let current = obj;
      let found = true;
      for (const nested of nestedFields) {
        if (current && current[nested] !== undefined) {
          current = current[nested];
        } else {
          found = false;
          break;
        }
      }
      if (found) {
        return current as T;
      }
    }
    return undefined;
  }

  private extractTimestampFromLine(line: string): string | null {
    const patterns = [
      /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)/,
      /(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/,
      /\[(.*?)\]/
    ];
    
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        return match[1];
      }
    }
    return null;
  }

  public analyze(entries: LogEntry[]): ScanResult {
    const timestamps = entries.map(e => new Date(e.timestamp).getTime());
    const uniqueErrorCodes = new Set<string>();
    
    let missingOrderId = 0;
    let missingTenantId = 0;
    let missingErrorCode = 0;
    let missingAmount = 0;
    let negativeAmount = 0;

    entries.forEach(entry => {
      if (!entry.orderId) missingOrderId++;
      if (!entry.tenantId) missingTenantId++;
      if (!entry.errorCode) {
        missingErrorCode++;
      } else {
        uniqueErrorCodes.add(entry.errorCode);
      }
      if (entry.amount === undefined) {
        missingAmount++;
      } else if (entry.amount < 0) {
        negativeAmount++;
      }
    });

    const validTimestamps = timestamps.filter(t => !isNaN(t));
    const start = validTimestamps.length > 0 ? 
      new Date(Math.min(...validTimestamps)).toISOString() : 
      new Date().toISOString();
    const end = validTimestamps.length > 0 ? 
      new Date(Math.max(...validTimestamps)).toISOString() : 
      new Date().toISOString();

    return {
      totalEntries: entries.length,
      parsedEntries: entries.length,
      missingOrderId,
      missingTenantId,
      missingErrorCode,
      missingAmount,
      negativeAmount,
      unknownErrorCodes: Array.from(uniqueErrorCodes),
      dateRange: { start, end }
    };
  }

  public getConfig(): BusinessFieldConfig {
    return this.config;
  }
}

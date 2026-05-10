import { createLogger, format, transports } from 'winston';
import { v4 as uuidv4 } from 'uuid';
import { OperatorInfo } from '../models/types';

export interface AuditLogEntry {
  logId: string;
  timestamp: Date;
  module: string;
  operation: string;
  operator: OperatorInfo;
  targetEntityType: string;
  targetEntityId: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  changes?: Array<{
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }>;
  reason?: string;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export enum LogModule {
  TARGET_SNAPSHOT = 'TARGET_SNAPSHOT',
  ACHIEVEMENT_RECORD = 'ACHIEVEMENT_RECORD',
  PROTECTION_PERIOD = 'PROTECTION_PERIOD',
  CROSS_REGION_ASSIGNMENT = 'CROSS_REGION_ASSIGNMENT',
  DISPUTE = 'DISPUTE',
  INCENTIVE_CALCULATION = 'INCENTIVE_CALCULATION',
  STATE_TRANSITION = 'STATE_TRANSITION',
  API = 'API'
}

class AuditLogger {
  private static instance: AuditLogger;
  private readonly logs: Map<string, AuditLogEntry> = new Map();
  private readonly winstonLogger;

  private constructor() {
    this.winstonLogger = createLogger({
      level: 'info',
      format: format.combine(
        format.timestamp(),
        format.json()
      ),
      transports: [
        new transports.Console(),
        new transports.File({ filename: 'audit.log' })
      ]
    });
  }

  public static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  public log(entry: Omit<AuditLogEntry, 'logId' | 'timestamp'>): AuditLogEntry {
    const logEntry: AuditLogEntry = {
      ...entry,
      logId: uuidv4(),
      timestamp: new Date()
    };

    this.logs.set(logEntry.logId, logEntry);
    
    const logMessage = `${entry.module} | ${entry.operation} | ${entry.targetEntityType}:${entry.targetEntityId} | ${entry.success ? 'SUCCESS' : 'FAILURE'} | ${entry.reason || ''}`;
    
    if (entry.success) {
      this.winstonLogger.info(logMessage, { logEntry });
    } else {
      this.winstonLogger.error(logMessage, { logEntry });
    }

    return logEntry;
  }

  public findById(logId: string): AuditLogEntry | undefined {
    return this.logs.get(logId);
  }

  public findByEntity(entityType: string, entityId: string): AuditLogEntry[] {
    return Array.from(this.logs.values())
      .filter(log => log.targetEntityType === entityType && log.targetEntityId === entityId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  public findByOperator(operatorId: string): AuditLogEntry[] {
    return Array.from(this.logs.values())
      .filter(log => log.operator.operatorId === operatorId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  public findAll(): AuditLogEntry[] {
    return Array.from(this.logs.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  public getEntityHistory(entityType: string, entityId: string): string[] {
    const logs = this.findByEntity(entityType, entityId);
    return logs.map(log => {
      const time = log.timestamp.toLocaleString('zh-CN');
      const operator = log.operator.operatorName;
      const operation = log.operation;
      const success = log.success ? '成功' : '失败';
      const reason = log.reason ? ` - ${log.reason}` : '';
      return `[${time}] ${operator} 执行「${operation}」${success}${reason}`;
    });
  }
}

export const auditLogger = AuditLogger.getInstance();

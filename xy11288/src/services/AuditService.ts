import { db } from '../models/database';
import { v4 as uuidv4 } from 'uuid';
import { OperationType, AuditResult, Operator } from '../models/types';
import winston from 'winston';

const sensitiveFields = ['phone', 'contact', 'password', 'token'];

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'audit.log' }),
    new winston.transports.Console({ format: winston.format.simple() })
  ]
});

function maskSensitiveData(data: any): any {
  if (!data) return data;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return data;
    }
  }

  const masked = { ...data };
  for (const field of sensitiveFields) {
    if (masked[field]) {
      masked[field] = '***' + masked[field].slice(-4);
    }
  }

  for (const key in masked) {
    if (typeof masked[key] === 'object') {
      masked[key] = maskSensitiveData(masked[key]);
    }
  }

  return masked;
}

export class AuditService {
  async log(
    requestId: string,
    operationType: OperationType,
    operator: Operator,
    result: AuditResult,
    reason: string,
    requestData: any,
    responseData: any
  ): Promise<void> {
    const maskedRequest = JSON.stringify(maskSensitiveData(requestData));
    const maskedResponse = JSON.stringify(maskSensitiveData(responseData));

    const logEntry = {
      id: uuidv4(),
      requestId,
      operationType,
      operatorId: operator.id,
      operatorName: operator.name,
      operatorRole: operator.role,
      result,
      reason,
      requestData: maskedRequest,
      responseData: maskedResponse,
      timestamp: Date.now()
    };

    await db.run(
      `INSERT INTO audit_logs 
       (id, requestId, operationType, operatorId, operatorName, operatorRole, 
        result, reason, requestData, responseData, timestamp) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        logEntry.id,
        logEntry.requestId,
        logEntry.operationType,
        logEntry.operatorId,
        logEntry.operatorName,
        logEntry.operatorRole,
        logEntry.result,
        logEntry.reason,
        logEntry.requestData,
        logEntry.responseData,
        logEntry.timestamp
      ]
    );

    logger.info('Audit log', {
      requestId,
      operationType,
      operator: { id: operator.id, name: operator.name, role: operator.role },
      result,
      reason
    });
  }

  async getLogs(filters: {
    requestId?: string;
    operatorId?: string;
    operationType?: OperationType;
    result?: AuditResult;
    startTime?: number;
    endTime?: number;
  } = {}): Promise<any[]> {
    let sql = `SELECT * FROM audit_logs WHERE 1=1`;
    const params: any[] = [];

    if (filters.requestId) {
      sql += ` AND requestId = ?`;
      params.push(filters.requestId);
    }
    if (filters.operatorId) {
      sql += ` AND operatorId = ?`;
      params.push(filters.operatorId);
    }
    if (filters.operationType) {
      sql += ` AND operationType = ?`;
      params.push(filters.operationType);
    }
    if (filters.result) {
      sql += ` AND result = ?`;
      params.push(filters.result);
    }
    if (filters.startTime) {
      sql += ` AND timestamp >= ?`;
      params.push(filters.startTime);
    }
    if (filters.endTime) {
      sql += ` AND timestamp <= ?`;
      params.push(filters.endTime);
    }

    sql += ` ORDER BY timestamp DESC`;

    const logs = await db.all(sql, params);
    return logs.map(log => ({
      ...log,
      requestData: JSON.parse(log.requestData),
      responseData: JSON.parse(log.responseData)
    }));
  }

  maskData(data: any): any {
    return maskSensitiveData(data);
  }
}

export const auditService = new AuditService();

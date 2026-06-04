import * as fs from 'fs';
import * as path from 'path';
import { AuditLogEntry, ProcessingResult } from '../types';
import { generateId } from '../utils/id';

const AUDIT_LOG_FILE = path.join(process.cwd(), 'data', 'audit-log.json');
const DATA_DIR = path.join(process.cwd(), 'data');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadAuditLog(): AuditLogEntry[] {
  ensureDataDir();
  if (!fs.existsSync(AUDIT_LOG_FILE)) {
    return [];
  }
  try {
    const content = fs.readFileSync(AUDIT_LOG_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

function saveAuditLog(logs: AuditLogEntry[]): void {
  ensureDataDir();
  fs.writeFileSync(AUDIT_LOG_FILE, JSON.stringify(logs, null, 2), 'utf-8');
}

export function logAction(
  operator: string,
  action: string,
  details: Record<string, unknown>,
  recordId?: string
): AuditLogEntry {
  const entry: AuditLogEntry = {
    id: generateId('audit'),
    timestamp: Date.now(),
    operator,
    action,
    recordId,
    details,
  };
  const logs = loadAuditLog();
  logs.push(entry);
  saveAuditLog(logs);
  return entry;
}

export function getAuditLog(recordId?: string): AuditLogEntry[] {
  const logs = loadAuditLog();
  if (recordId) {
    return logs.filter((l) => l.recordId === recordId);
  }
  return logs;
}

export function generateAuditReport(): ProcessingResult<string> {
  const logs = loadAuditLog();
  if (logs.length === 0) {
    return { success: true, data: '暂无审计记录', errors: [], warnings: [] };
  }

  const lines: string[] = [];
  lines.push('=== 贝塞尔曲线路径平滑 - 审计追踪报告 ===');
  lines.push(`生成时间: ${new Date().toLocaleString('zh-CN')}`);
  lines.push(`总操作数: ${logs.length}`);
  lines.push('');

  const actions = new Map<string, number>();
  const operators = new Map<string, number>();

  logs.forEach((log) => {
    actions.set(log.action, (actions.get(log.action) || 0) + 1);
    operators.set(log.operator, (operators.get(log.operator) || 0) + 1);

    lines.push(`[${new Date(log.timestamp).toLocaleString('zh-CN')}]`);
    lines.push(`  操作人: ${log.operator}`);
    lines.push(`  操作: ${log.action}`);
    if (log.recordId) {
      lines.push(`  记录ID: ${log.recordId}`);
    }
    lines.push(`  详情: ${JSON.stringify(log.details, null, 2).split('\n').join('\n          ')}`);
    lines.push('');
  });

  lines.push('=== 操作统计 ===');
  lines.push('操作类型分布:');
  actions.forEach((count, action) => {
    lines.push(`  ${action}: ${count} 次`);
  });
  lines.push('');
  lines.push('操作人分布:');
  operators.forEach((count, op) => {
    lines.push(`  ${op}: ${count} 次`);
  });

  return {
    success: true,
    data: lines.join('\n'),
    errors: [],
    warnings: [],
  };
}

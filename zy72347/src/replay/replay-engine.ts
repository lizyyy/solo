import * as fs from 'fs';
import * as path from 'path';
import { ProcessingResult, ReplaySession } from '../types';
import { generateId } from '../utils/id';
import { logAction, getAuditLog } from '../store/audit-log';
import { importCsv, ImportOptions } from '../import/csv-importer';
import { addAnnotation, reviewRecord, updateRecord, rollbackRecord } from '../workflow/engine';
import { clearAllRecords } from '../store/data-store';

const REPLAY_LOG_FILE = path.join(process.cwd(), 'data', 'replay-log.json');
const DATA_DIR = path.join(process.cwd(), 'data');

interface ReplayCommand {
  id: string;
  timestamp: number;
  command: string;
  args: Record<string, unknown>;
  recordIndex?: number;
  result?: ProcessingResult<unknown>;
}

interface ReplayManifest {
  sessionId: string;
  createdAt: number;
  createdBy: string;
  description: string;
  commands: ReplayCommand[];
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadReplayLog(): ReplayManifest[] {
  ensureDataDir();
  if (!fs.existsSync(REPLAY_LOG_FILE)) {
    return [];
  }
  try {
    const content = fs.readFileSync(REPLAY_LOG_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

function saveReplayLog(manifests: ReplayManifest[]): void {
  ensureDataDir();
  fs.writeFileSync(REPLAY_LOG_FILE, JSON.stringify(manifests, null, 2), 'utf-8');
}

export function createReplayManifest(
  createdBy: string,
  description: string,
  commands: ReplayCommand[]
): ReplayManifest {
  const manifest: ReplayManifest = {
    sessionId: generateId('session'),
    createdAt: Date.now(),
    createdBy,
    description,
    commands,
  };
  return manifest;
}

export function saveReplayManifest(manifest: ReplayManifest): void {
  const manifests = loadReplayLog();
  manifests.push(manifest);
  saveReplayLog(manifests);
}

export function listReplaySessions(): ProcessingResult<Array<{ sessionId: string; createdAt: string; createdBy: string; description: string; commandCount: number }>> {
  const manifests = loadReplayLog();
  const list = manifests.map((m) => ({
    sessionId: m.sessionId,
    createdAt: new Date(m.createdAt).toLocaleString('zh-CN'),
    createdBy: m.createdBy,
    description: m.description,
    commandCount: m.commands.length,
  }));
  return { success: true, data: list, errors: [], warnings: [] };
}

export async function executeReplay(
  sessionId: string,
  operator: string,
  clearDataBefore: boolean = true
): Promise<ProcessingResult<ReplaySession>> {
  const manifests = loadReplayLog();
  const manifest = manifests.find((m) => m.sessionId === sessionId);

  if (!manifest) {
    return { success: false, errors: [`未找到会话 ${sessionId}`], warnings: [] };
  }

  if (clearDataBefore) {
    clearAllRecords();
  }

  const session: ReplaySession = {
    sessionId: generateId('replay'),
    startTime: Date.now(),
    commands: [],
    results: [],
  };

  let currentRecordIds: string[] = [];

  logAction(operator, 'REPLAY_START', {
    originalSessionId: sessionId,
    newSessionId: session.sessionId,
    commandCount: manifest.commands.length,
  });

  for (const cmd of manifest.commands) {
    session.commands.push(cmd.command);

    let result: ProcessingResult<unknown>;

    try {
      switch (cmd.command) {
        case 'import': {
          result = importCsv(cmd.args as unknown as ImportOptions);
          if (result.success && result.data) {
            currentRecordIds = (result.data as { importedRecordIds: string[] }).importedRecordIds;
          }
          break;
        }
        case 'annotate': {
          const recordId = cmd.recordIndex !== undefined ? currentRecordIds[cmd.recordIndex] : undefined;
          if (!recordId) {
            result = { success: false, errors: [`找不到记录索引 ${cmd.recordIndex} 对应的记录ID`], warnings: [] };
            break;
          }
          const args = {
            ...(cmd.args as Record<string, unknown>),
            recordId,
          };
          result = addAnnotation(args as unknown as Parameters<typeof addAnnotation>[0]);
          break;
        }
        case 'review': {
          const recordId = cmd.recordIndex !== undefined ? currentRecordIds[cmd.recordIndex] : undefined;
          if (!recordId) {
            result = { success: false, errors: [`找不到记录索引 ${cmd.recordIndex} 对应的记录ID`], warnings: [] };
            break;
          }
          const args = {
            ...(cmd.args as Record<string, unknown>),
            recordId,
          };
          result = reviewRecord(args as unknown as Parameters<typeof reviewRecord>[0]);
          break;
        }
        case 'update': {
          const recordId = cmd.recordIndex !== undefined ? currentRecordIds[cmd.recordIndex] : undefined;
          if (!recordId) {
            result = { success: false, errors: [`找不到记录索引 ${cmd.recordIndex} 对应的记录ID`], warnings: [] };
            break;
          }
          const args = {
            ...(cmd.args as Record<string, unknown>),
            recordId,
          };
          result = updateRecord(args as unknown as Parameters<typeof updateRecord>[0]);
          break;
        }
        case 'rollback': {
          const { recordId, operator: op, reason } = cmd.args as { recordId: string; operator: string; reason: string };
          result = rollbackRecord(recordId, op, reason);
          break;
        }
        default: {
          result = { success: false, errors: [`未知命令: ${cmd.command}`], warnings: [] };
        }
      }
    } catch (e) {
      result = {
        success: false,
        errors: [`命令执行异常: ${(e as Error).message}`],
        warnings: [],
      };
    }

    session.results.push(result);

    if (!result.success) {
      logAction(operator, 'REPLAY_COMMAND_FAILED', {
        command: cmd.command,
        args: cmd.args,
        errors: result.errors,
      });
      session.endTime = Date.now();
      return {
        success: false,
        data: session,
        errors: [`命令 ${cmd.command} 执行失败: ${result.errors.join(', ')}`],
        warnings: [],
      };
    }

    logAction(operator, 'REPLAY_COMMAND_SUCCESS', {
      command: cmd.command,
      args: cmd.args,
    });
  }

  session.endTime = Date.now();

  logAction(operator, 'REPLAY_COMPLETE', {
    originalSessionId: sessionId,
    newSessionId: session.sessionId,
    completedCommands: session.commands.length,
  });

  return { success: true, data: session, errors: [], warnings: [] };
}

export function generateReplayReport(session: ReplaySession): string {
  const lines: string[] = [];
  lines.push('=== 贝塞尔曲线路径平滑 - 复盘报告 ===');
  lines.push(`会话ID: ${session.sessionId}`);
  lines.push(`开始时间: ${new Date(session.startTime).toLocaleString('zh-CN')}`);
  if (session.endTime) {
    lines.push(`结束时间: ${new Date(session.endTime).toLocaleString('zh-CN')}`);
    lines.push(`耗时: ${((session.endTime - session.startTime) / 1000).toFixed(2)} 秒`);
  }
  lines.push(`命令总数: ${session.commands.length}`);
  lines.push('');
  lines.push('--- 命令执行记录 ---');
  session.commands.forEach((cmd, idx) => {
    const result = session.results[idx];
    const status = result?.success ? '✅ 成功' : '❌ 失败';
    lines.push(`${idx + 1}. ${cmd} - ${status}`);
    if (result && !result.success && result.errors.length > 0) {
      lines.push(`   错误: ${result.errors.join(', ')}`);
    }
  });

  return lines.join('\n');
}

export function createWorkflowReplayCommands(
  importOptions: ImportOptions,
  annotations: Array<{ recordIndex: number; content: string; author: string; screenshotRef?: string }>,
  reviews: Array<{ recordIndex: number; reviewer: string; decision: 'approve' | 'reject' | 'rollback'; comment: string }>,
  updates: Array<{ recordIndex: number; operator: string; fieldValues: Record<string, string>; reason: string }>,
  importedRecordIds: string[]
): ReplayCommand[] {
  const commands: ReplayCommand[] = [];

  commands.push({
    id: generateId('cmd'),
    timestamp: Date.now(),
    command: 'import',
    args: importOptions as unknown as Record<string, unknown>,
  });

  annotations.forEach((ann) => {
    commands.push({
      id: generateId('cmd'),
      timestamp: Date.now(),
      command: 'annotate',
      recordIndex: ann.recordIndex,
      args: {
        author: ann.author,
        content: ann.content,
        screenshotRef: ann.screenshotRef,
      },
    });
  });

  reviews.forEach((rev) => {
    commands.push({
      id: generateId('cmd'),
      timestamp: Date.now(),
      command: 'review',
      recordIndex: rev.recordIndex,
      args: {
        reviewer: rev.reviewer,
        decision: rev.decision,
        comment: rev.comment,
      },
    });
  });

  updates.forEach((upd) => {
    commands.push({
      id: generateId('cmd'),
      timestamp: Date.now(),
      command: 'update',
      recordIndex: upd.recordIndex,
      args: {
        operator: upd.operator,
        fieldValues: upd.fieldValues,
        reason: upd.reason,
      },
    });
  });

  return commands;
}

export function getTraceabilityReport(recordId: string): ProcessingResult<string> {
  const auditLogs = getAuditLog(recordId);

  if (auditLogs.length === 0) {
    return { success: false, errors: [`未找到记录 ${recordId} 的审计日志`], warnings: [] };
  }

  const lines: string[] = [];
  lines.push(`=== 追溯报告 - 记录 ${recordId} ===`);
  lines.push(`生成时间: ${new Date().toLocaleString('zh-CN')}`);
  lines.push(`操作总数: ${auditLogs.length}`);
  lines.push('');
  lines.push('--- 时间线 ---');

  auditLogs.forEach((log, idx) => {
    lines.push(`${idx + 1}. [${new Date(log.timestamp).toLocaleString('zh-CN')}]`);
    lines.push(`   操作人: ${log.operator}`);
    lines.push(`   操作: ${log.action}`);
    lines.push(`   详情: ${JSON.stringify(log.details, null, 2).split('\n').join('\n         ')}`);
    lines.push('');
  });

  lines.push('--- 来源与下一步 ---');
  lines.push('📌 来源查找:');
  lines.push('   1. 查看"原始行号"字段，对应源文件中的行');
  lines.push('   2. 查看"原始值"部分，了解导入时的原始格式');
  lines.push('   3. 查看变更历史，了解每一次改动的原因');
  lines.push('');
  lines.push('🎯 下一步动作:');
  const lastLog = auditLogs[auditLogs.length - 1];
  if (lastLog.action === 'RECORD_IMPORTED' && (lastLog.details as { hasMixedFormat?: boolean }).hasMixedFormat) {
    lines.push('   ⚠️  该记录存在百分数/小数混合格式');
    lines.push('   → 需要活动负责人进行复核');
    lines.push('   → 执行: bezier review --id <记录ID> --reviewer "活动负责人" --decision approve');
  } else if (lastLog.action === 'REVIEW_COMPLETED') {
    const decision = (lastLog.details as { decision?: string }).decision;
    if (decision === 'approve') {
      lines.push('   ✅ 已批准，可以进行计算明细更新');
      lines.push('   → 执行: bezier update --id <记录ID> --operator "运营规划阿岚"');
    } else if (decision === 'reject') {
      lines.push('   ❌ 已拒绝，需要重新导入或联系数据提供方');
    } else if (decision === 'rollback') {
      lines.push('   ↩️  已回滚，数据已恢复到导入前状态');
    }
  } else if (lastLog.action === 'RECORD_UPDATED') {
    lines.push('   ✅ 已完成，数据已更新');
    lines.push('   → 可导出结果: bezier export --format detail');
  }

  return { success: true, data: lines.join('\n'), errors: [], warnings: [] };
}

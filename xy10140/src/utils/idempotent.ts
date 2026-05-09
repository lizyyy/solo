import { TableState, ReplayCommand, ReplayResult, TableRow } from '../types';
import { statesEqual, encodeTableState, decodeTableState, getDefaultState } from './urlState';
import { withRetry, DEFAULT_RETRY_OPTIONS } from './retry';

const COMMANDS_STORAGE = 'table_replay_commands';
const EXECUTION_LOG = 'table_execution_log';

export function generateCommandId(state: TableState): string {
  const encoded = encodeTableState(state);
  let hash = 0;
  for (let i = 0; i < encoded.length; i++) {
    const char = encoded.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `cmd_${Math.abs(hash).toString(36)}_${Date.now().toString(36)}`;
}

export function createReplayCommand(name: string, state: TableState): ReplayCommand {
  return {
    id: generateCommandId(state),
    name,
    state: { ...state },
    createdAt: Date.now(),
    isExecuted: false,
  };
}

export function getSavedCommands(): ReplayCommand[] {
  try {
    const raw = localStorage.getItem(COMMANDS_STORAGE);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCommand(command: ReplayCommand): void {
  const commands = getSavedCommands();
  const index = commands.findIndex(c => c.id === command.id);
  if (index === -1) {
    commands.unshift(command);
  } else {
    commands[index] = command;
  }
  localStorage.setItem(COMMANDS_STORAGE, JSON.stringify(commands.slice(0, 100)));
}

export function removeCommand(id: string): void {
  const commands = getSavedCommands();
  localStorage.setItem(COMMANDS_STORAGE, JSON.stringify(commands.filter(c => c.id !== id)));
}

export interface ExecutionLogEntry {
  commandId: string;
  executedAt: number;
  result: ReplayResult;
  stateHash: string;
}

export function getExecutionLog(): ExecutionLogEntry[] {
  try {
    const raw = localStorage.getItem(EXECUTION_LOG);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveExecutionLog(log: ExecutionLogEntry[]): void {
  localStorage.setItem(EXECUTION_LOG, JSON.stringify(log.slice(-200)));
}

export function findPreviousExecution(commandId: string, state: TableState): ExecutionLogEntry | undefined {
  const stateHash = encodeTableState(state);
  const log = getExecutionLog();
  return log.find(e => e.commandId === commandId && e.stateHash === stateHash);
}

export async function executeCommand(
  command: ReplayCommand,
  executor: (state: TableState) => Promise<{ rows: TableRow[]; errors: string[] }>,
  forceReexecute: boolean = false
): Promise<{ command: ReplayCommand; rows: TableRow[]; fromCache: boolean }> {
  const previous = findPreviousExecution(command.id, command.state);
  
  if (!forceReexecute && previous && previous.result.success) {
    const decoded = decodeTableState(previous.stateHash);
    if (decoded.errors.length === 0 && statesEqual(decoded.state, command.state)) {
      return {
        command: {
          ...command,
          isExecuted: true,
          executedAt: previous.executedAt,
          result: previous.result,
        },
        rows: [],
        fromCache: true,
      };
    }
  }

  let executionError: Error | undefined;
  let rows: TableRow[] = [];
  let executorErrors: string[] = [];

  try {
    const result = await withRetry(
      () => executor(command.state),
      {
        ...DEFAULT_RETRY_OPTIONS,
        shouldRetry: (error) => {
          return !isPermanentError(error);
        },
      }
    );
    rows = result.rows;
    executorErrors = result.errors;
  } catch (e) {
    executionError = e instanceof Error ? e : new Error(String(e));
  }

  const result: ReplayResult = {
    success: !executionError && executorErrors.length === 0,
    message: executionError 
      ? executionError.message 
      : executorErrors.length > 0 
        ? `执行完成，${executorErrors.length} 个警告` 
        : `成功匹配 ${rows.length} 条记录`,
    errors: [
      ...(executionError ? [executionError.message] : []),
      ...executorErrors,
    ],
    matchedRows: rows.length,
    timestamp: Date.now(),
  };

  const logEntry: ExecutionLogEntry = {
    commandId: command.id,
    executedAt: Date.now(),
    result,
    stateHash: encodeTableState(command.state),
  };

  const log = getExecutionLog();
  log.push(logEntry);
  saveExecutionLog(log);

  const updatedCommand: ReplayCommand = {
    ...command,
    isExecuted: true,
    executedAt: logEntry.executedAt,
    result,
  };

  saveCommand(updatedCommand);

  return {
    command: updatedCommand,
    rows,
    fromCache: false,
  };
}

function isPermanentError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('validation') ||
    msg.includes('invalid') ||
    msg.includes('not found') ||
    msg.includes('404') ||
    msg.includes('400')
  );
}

export function serializeCommand(command: ReplayCommand): string {
  return JSON.stringify(command);
}

export function deserializeCommand(serialized: string): ReplayCommand {
  const parsed = JSON.parse(serialized);
  
  if (!isValidCommand(parsed)) {
    throw new Error('无效的命令格式');
  }
  
  const { state: decodedState, errors } = decodeTableState(encodeTableState(parsed.state));
  
  if (errors.length > 0) {
    throw new Error(`命令状态验证失败: ${errors.map(e => e.message).join('; ')}`);
  }

  return {
    ...parsed,
    state: decodedState,
  };
}

function isValidCommand(value: unknown): value is ReplayCommand {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  
  return (
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.state === 'object' && obj.state !== null &&
    typeof obj.createdAt === 'number' &&
    typeof obj.isExecuted === 'boolean'
  );
}

export function getDefaultCommand(): ReplayCommand {
  return createReplayCommand('未命名命令', getDefaultState());
}

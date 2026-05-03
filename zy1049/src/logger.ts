import * as fs from 'fs/promises';
import * as path from 'path';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  pluginName?: string;
  runId?: string;
  message: string;
  data?: unknown;
}

export class PluginLogger {
  private outputDir: string;
  private consoleOutput: boolean;
  private logBuffer: LogEntry[];
  private maxBufferSize: number;
  private currentRunId: string | null;

  constructor(outputDir: string, consoleOutput: boolean = true) {
    this.outputDir = outputDir;
    this.consoleOutput = consoleOutput;
    this.logBuffer = [];
    this.maxBufferSize = 1000;
    this.currentRunId = null;
  }

  setRunId(runId: string): void {
    this.currentRunId = runId;
  }

  debug(message: string, data?: unknown, pluginName?: string): void {
    this.log('debug', message, data, pluginName);
  }

  info(message: string, data?: unknown, pluginName?: string): void {
    this.log('info', message, data, pluginName);
  }

  warn(message: string, data?: unknown, pluginName?: string): void {
    this.log('warn', message, data, pluginName);
  }

  error(message: string, data?: unknown, pluginName?: string): void {
    this.log('error', message, data, pluginName);
  }

  private log(level: LogLevel, message: string, data?: unknown, pluginName?: string): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      pluginName,
      runId: this.currentRunId || undefined,
      message,
      data,
    };

    this.logBuffer.push(entry);

    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }

    if (this.consoleOutput) {
      this.printToConsole(entry);
    }
  }

  private printToConsole(entry: LogEntry): void {
    const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`;
    const pluginPrefix = entry.pluginName ? `[${entry.pluginName}]` : '';
    const runPrefix = entry.runId ? `[${entry.runId.slice(0, 8)}]` : '';

    const colors: Record<LogLevel, (msg: string) => string> = {
      debug: (msg: string) => `\x1b[36m${msg}\x1b[0m`,
      info: (msg: string) => `\x1b[32m${msg}\x1b[0m`,
      warn: (msg: string) => `\x1b[33m${msg}\x1b[0m`,
      error: (msg: string) => `\x1b[31m${msg}\x1b[0m`,
    };

    const fullMessage = `${prefix}${pluginPrefix}${runPrefix} ${entry.message}`;
    console.log(colors[entry.level](fullMessage));

    if (entry.data) {
      console.dir(entry.data, { depth: null, colors: true });
    }
  }

  async persistLog(): Promise<string> {
    const runId = this.currentRunId || this.generateRunId();
    const logDir = path.join(this.outputDir, runId);
    const logFile = path.join(logDir, 'execution.log');

    await fs.mkdir(logDir, { recursive: true });

    const logLines = this.logBuffer.map(entry => JSON.stringify(entry));
    await fs.writeFile(logFile, logLines.join('\n') + '\n', 'utf-8');

    return logFile;
  }

  async persistPluginOutput(
    pluginName: string,
    consoleOutput: string[]
  ): Promise<string> {
    const runId = this.currentRunId || this.generateRunId();
    const logDir = path.join(this.outputDir, runId, pluginName);
    const outputFile = path.join(logDir, 'console-output.log');

    await fs.mkdir(logDir, { recursive: true });

    const content = consoleOutput.map(line => 
      `[${new Date().toISOString()}] ${line}`
    ).join('\n');

    await fs.writeFile(outputFile, content + '\n', 'utf-8');

    return outputFile;
  }

  getLogBuffer(): LogEntry[] {
    return [...this.logBuffer];
  }

  clearBuffer(): void {
    this.logBuffer = [];
  }

  private generateRunId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  async loadLogFile(logPath: string): Promise<LogEntry[]> {
    try {
      const content = await fs.readFile(logPath, 'utf-8');
      const lines = content.trim().split('\n');
      return lines.map(line => JSON.parse(line) as LogEntry);
    } catch (error) {
      this.error(`Failed to load log file: ${(error as Error).message}`);
      return [];
    }
  }
}

export default PluginLogger;

import * as fs from 'fs';
import * as path from 'path';
import { exec, ExecOptions } from 'child_process';
import { promisify } from 'util';
import {
  CodeSnippet,
  CodeExecutionResult,
  RunSnippetsResult,
  Issue,
  Config,
  IssueType,
} from '../types';
import {
  getExecutableForLanguage,
  getFileExtensionForLanguage,
  createIssue,
  normalizePath,
  RUNNABLE_LANGUAGES,
} from '../utils';

const execAsync = promisify(exec);

export interface SnippetRunnerOptions {
  rootPath: string;
  config: Config;
  snippets: CodeSnippet[];
  sections?: string[];
  timeout?: number;
}

export class SnippetRunner {
  private options: SnippetRunnerOptions;
  private tempDir: string | null = null;
  private issues: Issue[] = [];
  private results: CodeExecutionResult[] = [];

  constructor(options: SnippetRunnerOptions) {
    this.options = options;
  }

  private getTimeout(): number {
    return this.options.timeout || this.options.config.execution.timeout;
  }

  private createTempDir(): void {
    const baseTempDir = path.join(this.options.rootPath, '.temp-snippets');
    const uniqueDir = path.join(baseTempDir, Date.now().toString());
    fs.mkdirSync(uniqueDir, { recursive: true });
    this.tempDir = uniqueDir;
  }

  private cleanupTempDir(): void {
    if (this.tempDir && fs.existsSync(this.tempDir)) {
      const deleteRecursive = (dirPath: string): void => {
        if (fs.existsSync(dirPath)) {
          const files = fs.readdirSync(dirPath);
          for (const file of files) {
            const fullPath = path.join(dirPath, file);
            if (fs.statSync(fullPath).isDirectory()) {
              deleteRecursive(fullPath);
            } else {
              fs.unlinkSync(fullPath);
            }
          }
          fs.rmdirSync(dirPath);
        }
      };
      deleteRecursive(this.tempDir);
    }
  }

  private shouldIgnoreSnippet(snippet: CodeSnippet): boolean {
    const ignoreSnippets = this.options.config.ignore.snippets;
    const idMatch = ignoreSnippets.includes(snippet.id);
    const fileMatch = ignoreSnippets.some(pattern => {
      if (pattern.includes('*')) {
        const regex = new RegExp(
          '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
          'i'
        );
        return regex.test(snippet.file);
      }
      return snippet.file.includes(pattern);
    });
    return idMatch || fileMatch;
  }

  private filterSnippets(): CodeSnippet[] {
    let filtered = this.options.snippets.filter(s =>
      RUNNABLE_LANGUAGES.includes(s.language)
    );

    if (this.options.sections && this.options.sections.length > 0) {
      filtered = filtered.filter(s =>
        this.options.sections!.some(section =>
          s.section.toLowerCase().includes(section.toLowerCase())
        )
      );
    }

    filtered = filtered.filter(s => !this.shouldIgnoreSnippet(s));

    return filtered;
  }

  private async writeSnippetToFile(snippet: CodeSnippet): Promise<string> {
    if (!this.tempDir) {
      throw new Error('临时目录未创建');
    }

    const ext = getFileExtensionForLanguage(snippet.language);
    const filename = `snippet-${snippet.id.slice(0, 8)}${ext}`;
    const filepath = path.join(this.tempDir, filename);

    fs.writeFileSync(filepath, snippet.code, 'utf8');

    return filepath;
  }

  private async executeSnippet(
    snippet: CodeSnippet,
    filepath: string
  ): Promise<CodeExecutionResult> {
    const executable = getExecutableForLanguage(snippet.language);
    const timeout = this.getTimeout();

    if (!executable) {
      return {
        snippetId: snippet.id,
        success: false,
        exitCode: -1,
        stdout: '',
        stderr: `不支持的语言: ${snippet.language}`,
        duration: 0,
        timedOut: false,
      };
    }

    if (snippet.isDangerous && !this.options.config.validation.allowDangerousCommands) {
      this.issues.push(
        createIssue(
          'dangerous_command' as IssueType,
          `检测到危险命令，跳过执行: ${snippet.code.substring(0, 50)}...`,
          snippet.file,
          snippet.line,
          snippet.column,
          `语言: ${snippet.language}, 代码: ${snippet.code.substring(0, 100)}`
        )
      );

      return {
        snippetId: snippet.id,
        success: false,
        exitCode: -1,
        stdout: '',
        stderr: '危险命令，已跳过',
        duration: 0,
        timedOut: false,
      };
    }

    const command = `${executable} "${filepath}"`;
    const startTime = Date.now();
    let timedOut = false;

    try {
      const options: ExecOptions = {
        timeout: timeout,
        cwd: this.tempDir || this.options.rootPath,
        env: {
          ...process.env,
          ...this.options.config.execution.environments,
        },
      };

      const { stdout, stderr } = await execAsync(command, options);
      const duration = Date.now() - startTime;

      return {
        snippetId: snippet.id,
        success: true,
        exitCode: 0,
        stdout: typeof stdout === 'string' ? stdout.trim() : '',
        stderr: typeof stderr === 'string' ? stderr.trim() : '',
        duration,
        timedOut: false,
      };
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      const execError = error as { code?: number; stdout?: string; stderr?: string; signal?: string };

      timedOut = execError.signal === 'SIGTERM' || duration >= timeout;

      const exitCode = execError.code || -1;

      if (!snippet.isDangerous) {
        this.issues.push(
          createIssue(
            'code_error' as IssueType,
            `代码执行失败 (退出码: ${exitCode}): ${(execError.stderr || execError.stdout || '').substring(0, 200)}`,
            snippet.file,
            snippet.line,
            snippet.column,
            `语言: ${snippet.language}, 代码: ${snippet.code.substring(0, 100)}`
          )
        );
      }

      return {
        snippetId: snippet.id,
        success: false,
        exitCode,
        stdout: execError.stdout || '',
        stderr: execError.stderr || '',
        duration,
        timedOut,
      };
    }
  }

  private getByLanguageCount(filteredSnippets: CodeSnippet[]): Record<string, number> {
    const byLanguage: Record<string, number> = {};
    for (const snippet of filteredSnippets) {
      byLanguage[snippet.language] = (byLanguage[snippet.language] || 0) + 1;
    }
    return byLanguage;
  }

  async run(): Promise<RunSnippetsResult> {
    this.issues = [];
    this.results = [];

    const filteredSnippets = this.filterSnippets();

    if (filteredSnippets.length === 0) {
      return {
        executedAt: new Date(),
        rootPath: normalizePath(this.options.rootPath),
        snippets: [],
        results: [],
        issues: [],
        summary: {
          totalSnippets: 0,
          passed: 0,
          failed: 0,
          skipped: this.options.snippets.length,
          byLanguage: {},
        },
      };
    }

    this.createTempDir();

    try {
      for (const snippet of filteredSnippets) {
        const filepath = await this.writeSnippetToFile(snippet);
        const result = await this.executeSnippet(snippet, filepath);
        this.results.push(result);
      }
    } finally {
      this.cleanupTempDir();
    }

    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const skipped = this.options.snippets.length - filteredSnippets.length;

    return {
      executedAt: new Date(),
      rootPath: normalizePath(this.options.rootPath),
      snippets: filteredSnippets,
      results: this.results,
      issues: this.issues,
      summary: {
        totalSnippets: this.options.snippets.length,
        passed,
        failed,
        skipped,
        byLanguage: this.getByLanguageCount(filteredSnippets),
      },
    };
  }
}

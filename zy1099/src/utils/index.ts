import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { FileType, Issue, IssueType } from '../types';

export const FILE_EXTENSIONS: Record<string, FileType> = {
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.html': 'html',
  '.htm': 'html',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.png': 'image',
  '.gif': 'image',
  '.svg': 'image',
  '.webp': 'image',
  '.pdf': 'attachment',
  '.doc': 'attachment',
  '.docx': 'attachment',
  '.xls': 'attachment',
  '.xlsx': 'attachment',
  '.ppt': 'attachment',
  '.pptx': 'attachment',
  '.zip': 'attachment',
  '.rar': 'attachment',
  '.7z': 'attachment',
  '.js': 'code',
  '.ts': 'code',
  '.py': 'code',
  '.sh': 'code',
  '.json': 'code',
  '.yaml': 'code',
  '.yml': 'code',
  '.css': 'code',
  '.scss': 'code',
  '.less': 'code',
};

export const RUNNABLE_LANGUAGES = ['javascript', 'js', 'python', 'py', 'shell', 'bash', 'sh'];

export const DANGEROUS_COMMANDS = [
  'rm -rf',
  'rm -fr',
  'sudo rm',
  'chmod 777',
  '\\|\\s*bash',
  '\\|\\s*sh',
  'curl.*\\|\\s*bash',
  'wget.*\\|\\s*bash',
  'eval\\(',
  'exec\\(',
];

export function getFileType(filePath: string): FileType {
  const ext = path.extname(filePath).toLowerCase();
  return FILE_EXTENSIONS[ext] || 'other';
}

export function generateId(): string {
  return uuidv4();
}

export function isExternalLink(href: string): boolean {
  return /^(https?:\/\/|mailto:|tel:|ftp:\/\/)/.test(href);
}

export function isAnchorLink(href: string): boolean {
  return href.startsWith('#');
}

export function normalizePath(filePath: string): string {
  return path.normalize(filePath).replace(/\\/g, '/');
}

export function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

export function directoryExists(dirPath: string): boolean {
  try {
    return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

export function resolveRelativeLink(basePath: string, linkPath: string): string {
  const dirname = path.dirname(basePath);
  const decodedLink = decodeURIComponent(linkPath.replace(/^file:\/\//, ''));
  const withoutAnchor = decodedLink.split('#')[0];
  const resolved = path.resolve(dirname, withoutAnchor);
  return normalizePath(resolved);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function isDangerousCode(language: string, code: string): boolean {
  if (language === 'shell' || language === 'bash' || language === 'sh') {
    return DANGEROUS_COMMANDS.some(cmd => new RegExp(cmd, 'i').test(code));
  }
  if (language === 'javascript' || language === 'js') {
    return /eval\(|Function\(|new Function\(/.test(code) ||
           /process\.(exit|kill|chmod|chown)/.test(code);
  }
  if (language === 'python' || language === 'py') {
    return /os\.(system|popen|exec|spawn)/.test(code) ||
           /subprocess\.(call|Popen|run)/.test(code) ||
           /eval\(|exec\(/.test(code) ||
           /shutil\.rmtree/.test(code);
  }
  return false;
}

export function createIssue(
  type: IssueType,
  message: string,
  file: string,
  line: number = 0,
  column: number = 0,
  context?: string
): Issue {
  const severityMap: Record<IssueType, 'error' | 'warning' | 'info'> = {
    missing_file: 'error',
    broken_link: 'error',
    bad_anchor: 'warning',
    code_error: 'error',
    dangerous_command: 'error',
    config_error: 'warning',
  };

  const suggestions: Record<IssueType, (msg: string) => string> = {
    missing_file: (msg) => `请检查文件路径是否正确，或创建缺失的文件。提示: ${msg}`,
    broken_link: (msg) => `请检查链接目标文件是否存在，或修正链接路径。提示: ${msg}`,
    bad_anchor: (msg) => `请检查锚点是否存在，或修正锚点名称。提示: ${msg}`,
    code_error: (msg) => `请检查代码语法错误或运行时错误。提示: ${msg}`,
    dangerous_command: (msg) => `检测到危险命令，请确认其安全性后添加到忽略列表。提示: ${msg}`,
    config_error: (msg) => `请检查配置文件格式或参数设置。提示: ${msg}`,
  };

  return {
    id: generateId(),
    type,
    severity: severityMap[type],
    file,
    line,
    column,
    message,
    suggestion: suggestions[type](message),
    context,
  };
}

export function getExecutableForLanguage(language: string): string | null {
  const map: Record<string, string> = {
    'javascript': 'node',
    'js': 'node',
    'python': 'python3',
    'py': 'python3',
    'shell': 'bash',
    'bash': 'bash',
    'sh': 'sh',
  };
  return map[language.toLowerCase()] || null;
}

export function getFileExtensionForLanguage(language: string): string {
  const map: Record<string, string> = {
    'javascript': '.js',
    'js': '.js',
    'python': '.py',
    'py': '.py',
    'shell': '.sh',
    'bash': '.sh',
    'sh': '.sh',
  };
  return map[language.toLowerCase()] || '.txt';
}

export async function readFileAsync(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}

export async function writeFileAsync(filePath: string, content: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.writeFile(filePath, content, 'utf8', (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export async function ensureDirAsync(dirPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.mkdir(dirPath, { recursive: true }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function calculateRiskLevel(errorCount: number, warningCount: number): 'low' | 'medium' | 'high' {
  if (errorCount > 0) return 'high';
  if (warningCount > 3) return 'medium';
  return 'low';
}

export function calculateScore(
  totalChecks: number,
  passedChecks: number,
  errors: number,
  warnings: number
): number {
  if (totalChecks === 0) return 100;
  
  const errorPenalty = errors * 10;
  const warningPenalty = warnings * 2;
  const baseScore = Math.round((passedChecks / totalChecks) * 100);
  
  return Math.max(0, Math.min(100, baseScore - errorPenalty - warningPenalty));
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

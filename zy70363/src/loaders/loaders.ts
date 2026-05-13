import * as fs from 'fs';
import * as path from 'path';
import {
  KeySnapshot,
  AuditRules,
  AcceptedIssuesStore,
  AcceptedIssue,
} from '../types';

function readJSONFile<T>(filePath: string): T {
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`文件不存在: ${filePath}`);
  }
  try {
    const content = fs.readFileSync(absolutePath, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    throw new Error(`解析 JSON 失败: ${filePath}, 错误: ${(e as Error).message}`);
  }
}

export function loadSnapshot(filePath: string): KeySnapshot {
  return readJSONFile<KeySnapshot>(filePath);
}

export function loadRules(filePath: string): AuditRules {
  return readJSONFile<AuditRules>(filePath);
}

export function ensureDataDir(dataDir: string): void {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function getDefaultDataDir(): string {
  return path.resolve(process.cwd(), 'data');
}

function getAcceptedIssuesPath(dataDir?: string): string {
  const dir = dataDir || getDefaultDataDir();
  ensureDataDir(dir);
  return path.join(dir, 'accepted-issues.json');
}

export function loadAcceptedIssues(dataDir?: string): AcceptedIssuesStore {
  const storePath = getAcceptedIssuesPath(dataDir);
  if (!fs.existsSync(storePath)) {
    return {
      version: '1.0',
      updatedAt: Math.floor(Date.now() / 1000),
      accepted: [],
    };
  }
  return readJSONFile<AcceptedIssuesStore>(storePath);
}

export function saveAcceptedIssues(
  store: AcceptedIssuesStore,
  dataDir?: string
): void {
  const storePath = getAcceptedIssuesPath(dataDir);
  ensureDataDir(path.dirname(storePath));
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf-8');
}

export function addAcceptedIssue(
  issue: AcceptedIssue,
  dataDir?: string
): void {
  const store = loadAcceptedIssues(dataDir);
  const existingIndex = store.accepted.findIndex(
    (a) => a.key === issue.key && a.issueType === issue.issueType
  );
  
  if (existingIndex >= 0) {
    store.accepted[existingIndex] = issue;
  } else {
    store.accepted.push(issue);
  }
  
  store.updatedAt = Math.floor(Date.now() / 1000);
  saveAcceptedIssues(store, dataDir);
}

export function getExpiredAcceptances(
  store: AcceptedIssuesStore,
  now: number = Math.floor(Date.now() / 1000)
): AcceptedIssue[] {
  return store.accepted.filter((a) => a.expiresAt <= now);
}

export function isIssueAccepted(
  key: string,
  issueType: string,
  store: AcceptedIssuesStore,
  now: number = Math.floor(Date.now() / 1000)
): boolean {
  const existing = store.accepted.find(
    (a) => a.key === key && a.issueType === issueType
  );
  return !!existing && existing.expiresAt > now;
}

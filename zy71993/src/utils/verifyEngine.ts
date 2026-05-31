import type {
  DirectorySnapshot,
  ChecksumManifest,
  FailureLog,
  RollbackRecord,
  VerificationIssue,
  VerificationResult,
  BackupPackage,
  VerificationSummary,
  IssueDetail,
} from '@/types';

function genId(): string {
  return `issue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function hasSpaces(path: string): boolean {
  return path.includes(' ');
}

function findRelatedLogSnippet(logs: FailureLog | null, path: string): string | undefined {
  if (!logs) return undefined;
  const entries = logs.entries.filter(
    (e) => e.path === path || e.message.includes(path.split('/').pop() || '')
  );
  if (entries.length === 0) return undefined;
  return entries
    .slice(0, 3)
    .map((e) => `[${e.timestamp}] ${e.level}: ${e.message}`)
    .join('\n');
}

export function runVerification(
  machineId: string,
  snapshot: DirectorySnapshot | null,
  checksum: ChecksumManifest | null,
  failureLog: FailureLog | null,
  rollback: RollbackRecord | null
): VerificationResult {
  const issues: VerificationIssue[] = [];
  const packages: BackupPackage[] = [];
  const now = new Date().toISOString();

  if (!snapshot) {
    return {
      machineId,
      timestamp: now,
      summary: { total: 0, normal: 0, missingFile: 0, corrupted: 0, duplicate: 0, staleChecksum: 0, other: 0 },
      issues: [],
      packages: [],
    };
  }

  const checksumMap = new Map<string, { expected: string; actual?: string; match?: boolean }>();
  if (checksum) {
    for (const entry of checksum.entries) {
      checksumMap.set(entry.path, { expected: entry.expected, actual: entry.actual, match: entry.match });
    }
  }

  const rollbackPaths = new Map<string, { preChecksum?: string; postChecksum?: string; reason: string; timestamp: string }>();
  if (rollback) {
    for (const entry of rollback.entries) {
      rollbackPaths.set(entry.targetPath, {
        preChecksum: entry.preChecksum,
        postChecksum: entry.postChecksum,
        reason: entry.reason,
        timestamp: entry.timestamp,
      });
    }
  }

  const fileTimestamps = new Map<string, string[]>();
  for (const file of snapshot.files) {
    const dateKey = file.modified.slice(0, 10);
    const baseName = file.name.replace(/_v\d+/, '');
    const key = `${baseName}-${dateKey}`;
    const existing = fileTimestamps.get(key) || [];
    existing.push(file.modified);
    fileTimestamps.set(key, existing);
  }

  const missingFromSnapshot = new Set<string>();
  if (checksum) {
    for (const entry of checksum.entries) {
      const found = snapshot.files.some((f) => f.path === entry.path);
      if (!found) {
        missingFromSnapshot.add(entry.path);
      }
    }
  }

  for (const missingPath of missingFromSnapshot) {
    const ck = checksumMap.get(missingPath);
    const snippet = findRelatedLogSnippet(failureLog, missingPath);
    issues.push({
      id: genId(),
      type: 'missing_file',
      severity: 'needs_backup',
      path: missingPath,
      description: `备份文件缺失: ${missingPath.split('/').pop()}`,
      detail: { expectedPath: missingPath },
      relatedLogSnippet: snippet,
      timestamp: now,
    });
    packages.push({
      name: missingPath.split('/').pop() || missingPath,
      path: missingPath,
      size: 0,
      status: 'missing',
      checksumMatch: ck?.match,
      timestamp: now,
      issues: [issues[issues.length - 1].id],
    });
  }

  for (const file of snapshot.files) {
    const pkgIssues: string[] = [];
    let status: BackupPackage['status'] = 'ok';
    let checksumMatch: boolean | undefined = undefined;
    const ck = checksumMap.get(file.path);

    if (hasSpaces(file.path)) {
      const snippet = findRelatedLogSnippet(failureLog, file.path);
      const issue: VerificationIssue = {
        id: genId(),
        type: 'path_with_spaces',
        severity: 'ignorable',
        path: file.path,
        description: `路径含空格: "${file.path}"，可能影响自动化脚本执行`,
        detail: { actualPath: file.path },
        relatedLogSnippet: snippet,
        timestamp: now,
      };
      issues.push(issue);
      pkgIssues.push(issue.id);
    }

    if (ck) {
      checksumMatch = ck.match;
      if (ck.match === false) {
        const snippet = findRelatedLogSnippet(failureLog, file.path);
        const issue: VerificationIssue = {
          id: genId(),
          type: 'corrupted_archive',
          severity: 'needs_backup',
          path: file.path,
          description: `校验值不匹配: ${file.name}`,
          detail: {
            expectedChecksum: ck.expected,
            actualChecksum: ck.actual,
          },
          relatedLogSnippet: snippet,
          timestamp: now,
        };
        issues.push(issue);
        pkgIssues.push(issue.id);
        status = 'corrupted';
      }
    }

    const dateKey = file.modified.slice(0, 10);
    const baseName = file.name.replace(/_v\d+/, '');
    const dupKey = `${baseName}-${dateKey}`;
    const timestamps = fileTimestamps.get(dupKey);
    if (timestamps && timestamps.length > 1 && file.name.includes('_v2')) {
      const snippet = findRelatedLogSnippet(failureLog, file.path);
      const issue: VerificationIssue = {
        id: genId(),
        type: 'duplicate_backup',
        severity: 'ignorable',
        path: file.path,
        description: `同日重复备份: ${file.name}`,
        detail: { duplicateTimestamps: timestamps },
        relatedLogSnippet: snippet,
        timestamp: now,
      };
      issues.push(issue);
      pkgIssues.push(issue.id);
      if (status === 'ok') status = 'duplicate';
    }

    const rb = rollbackPaths.get(file.path);
    if (rb && rb.preChecksum === rb.postChecksum) {
      const snippet = findRelatedLogSnippet(failureLog, file.path);
      const issue: VerificationIssue = {
        id: genId(),
        type: 'stale_checksum',
        severity: 'dev_required',
        path: file.path,
        description: `回滚后校验值未更新: ${file.name} (回滚原因: ${rb.reason})`,
        detail: {
          expectedChecksum: rb.preChecksum,
          actualChecksum: rb.postChecksum,
          rollbackTimestamp: rb.timestamp,
        },
        relatedLogSnippet: snippet,
        timestamp: now,
      };
      issues.push(issue);
      pkgIssues.push(issue.id);
      if (status === 'ok') status = 'stale_checksum';
    }

    packages.push({
      name: file.name,
      path: file.path,
      size: file.size,
      status,
      checksumMatch,
      timestamp: file.modified,
      issues: pkgIssues,
    });
  }

  const summary: VerificationSummary = {
    total: packages.length,
    normal: packages.filter((p) => p.status === 'ok').length,
    missingFile: packages.filter((p) => p.status === 'missing').length,
    corrupted: packages.filter((p) => p.status === 'corrupted').length,
    duplicate: packages.filter((p) => p.status === 'duplicate').length,
    staleChecksum: packages.filter((p) => p.status === 'stale_checksum').length,
    other: 0,
  };

  return {
    machineId: machineId || snapshot.path.split('/').pop() || 'unknown',
    timestamp: now,
    summary,
    issues,
    packages,
  };
}

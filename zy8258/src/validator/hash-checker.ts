import * as fs from 'fs';
import * as crypto from 'crypto';
import { ManifestEntry, Issue } from '../types';
import { createIssue, RULES } from './issue-factory';

export interface HashCheckResult {
  issues: Issue[];
  verifiedCount: number;
  failedCount: number;
  missingCount: number;
}

export async function checkHashes(
  manifestEntries: ManifestEntry[],
  hashMap: Map<string, { hash: string; algorithm: string }>,
  dossierRoot: string,
  verifyActualFiles: boolean = true
): Promise<HashCheckResult> {
  const issues: Issue[] = [];
  let verifiedCount = 0;
  let failedCount = 0;
  let missingCount = 0;
  
  for (const entry of manifestEntries) {
    const result = await checkSingleFileHash(
      entry,
      hashMap,
      dossierRoot,
      verifyActualFiles
    );
    
    if (result.issue) {
      issues.push(result.issue);
    }
    
    if (result.status === 'verified') verifiedCount++;
    else if (result.status === 'failed') failedCount++;
    else if (result.status === 'missing') missingCount++;
  }
  
  return {
    issues,
    verifiedCount,
    failedCount,
    missingCount
  };
}

interface SingleFileHashResult {
  status: 'verified' | 'failed' | 'missing' | 'skipped';
  issue?: Issue;
}

async function checkSingleFileHash(
  entry: ManifestEntry,
  hashMap: Map<string, { hash: string; algorithm: string }>,
  dossierRoot: string,
  verifyActualFiles: boolean
): Promise<SingleFileHashResult> {
  const possiblePaths = [
    entry.filePath,
    normalizePath(entry.filePath),
    entry.filePath.toLowerCase(),
    entry.filePath.toUpperCase(),
    normalizePathForComparison(entry.filePath)
  ];
  
  let recordedHash: { hash: string; algorithm: string } | undefined;
  let matchedPath: string | undefined;
  
  for (const path of possiblePaths) {
    const hashEntry = hashMap.get(path);
    if (hashEntry) {
      recordedHash = hashEntry;
      matchedPath = path;
      break;
    }
  }
  
  if (!recordedHash) {
    return {
      status: 'missing',
      issue: createIssue(
        entry.caseNumber,
        RULES.HASH_NOT_FOUND.id,
        RULES.HASH_NOT_FOUND.name,
        RULES.HASH_NOT_FOUND.severity,
        RULES.HASH_NOT_FOUND.category,
        `哈希记录缺失: ${entry.fileName || entry.filePath}`,
        `在 hashes.txt 中未找到文件 "${entry.filePath}" 的哈希记录`,
        [entry.filePath]
      )
    };
  }
  
  if (!verifyActualFiles) {
    return { status: 'verified' };
  }
  
  const actualFilePath = findActualFile(dossierRoot, entry.filePath);
  
  if (!actualFilePath) {
    return {
      status: 'missing',
      issue: createIssue(
        entry.caseNumber,
        RULES.FILE_NOT_FOUND.id,
        RULES.FILE_NOT_FOUND.name,
        RULES.FILE_NOT_FOUND.severity,
        RULES.FILE_NOT_FOUND.category,
        `文件不存在: ${entry.fileName || entry.filePath}`,
        `清单中记录的文件 "${entry.filePath}" 在卷宗目录中不存在`,
        [entry.filePath]
      )
    };
  }
  
  try {
    const actualHash = await calculateFileHash(actualFilePath, recordedHash.algorithm);
    
    if (actualHash.toLowerCase() !== recordedHash.hash.toLowerCase()) {
      return {
        status: 'failed',
        issue: createIssue(
          entry.caseNumber,
          RULES.HASH_MISMATCH.id,
          RULES.HASH_MISMATCH.name,
          RULES.HASH_MISMATCH.severity,
          RULES.HASH_MISMATCH.category,
          `哈希值不一致: ${entry.fileName || entry.filePath}`,
          `记录的哈希值: ${recordedHash.hash} (${recordedHash.algorithm})\n实际文件哈希值: ${actualHash}\n文件路径: ${actualFilePath}`,
          [entry.filePath, actualFilePath]
        )
      };
    }
    
    return { status: 'verified' };
  } catch (error) {
    return {
      status: 'missing',
      issue: createIssue(
        entry.caseNumber,
        RULES.FILE_NOT_FOUND.id,
        RULES.FILE_NOT_FOUND.name,
        RULES.FILE_NOT_FOUND.severity,
        RULES.FILE_NOT_FOUND.category,
        `文件读取失败: ${entry.fileName || entry.filePath}`,
        `无法读取文件 "${actualFilePath}": ${(error as Error).message}`,
        [entry.filePath]
      )
    };
  }
}

function normalizePath(path: string): string {
  return path.replace(/[\\/]+/g, '/').replace(/^[.\\/]+/, '');
}

function normalizePathForComparison(path: string): string {
  return normalizePath(path).toLowerCase();
}

function findActualFile(root: string, relativePath: string): string | null {
  const path = require('path');
  const possiblePaths = [
    path.join(root, relativePath),
    path.join(root, normalizePath(relativePath)),
    path.join(root, relativePath.replace(/\\/g, '/')),
    path.join(root, relativePath.replace(/\//g, '\\'))
  ];
  
  for (const p of possiblePaths) {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      return p;
    }
  }
  
  const dir = path.dirname(path.join(root, relativePath));
  const baseName = path.basename(relativePath).toLowerCase();
  
  if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (file.toLowerCase() === baseName) {
        return path.join(dir, file);
      }
    }
  }
  
  return null;
}

async function calculateFileHash(filePath: string, algorithm: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash(algorithm.toLowerCase());
    const stream = fs.createReadStream(filePath);
    
    stream.on('data', (data) => {
      hash.update(data);
    });
    
    stream.on('end', () => {
      resolve(hash.digest('hex'));
    });
    
    stream.on('error', (error) => {
      reject(error);
    });
  });
}

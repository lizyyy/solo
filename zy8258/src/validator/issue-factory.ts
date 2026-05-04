import { Issue } from '../types';
import { randomUUID } from 'crypto';

export function createIssue(
  caseNumber: string,
  ruleId: string,
  ruleName: string,
  severity: 'error' | 'warning' | 'info',
  category: string,
  message: string,
  details: string,
  affectedFiles: string[] = []
): Issue {
  return {
    id: randomUUID(),
    caseNumber,
    ruleId,
    ruleName,
    severity,
    category,
    message,
    details,
    affectedFiles,
    timestamp: new Date().toISOString()
  };
}

export const RULES = {
  REQUIRED_DOCUMENT_MISSING: {
    id: 'R001',
    name: '必备文书缺失',
    severity: 'error' as const,
    category: '文书完整性'
  },
  HASH_MISMATCH: {
    id: 'R002',
    name: '哈希值不一致',
    severity: 'error' as const,
    category: '文件完整性'
  },
  FILE_NOT_FOUND: {
    id: 'R003',
    name: '文件不存在',
    severity: 'error' as const,
    category: '文件完整性'
  },
  DUPLICATE_FILE_ACROSS_DISKS: {
    id: 'R004',
    name: '同一文件跨盘重复',
    severity: 'warning' as const,
    category: '数据一致性'
  },
  SECRET_LEVEL_MISPLACED: {
    id: 'R005',
    name: '密级文件误放目录',
    severity: 'error' as const,
    category: '密级管理'
  },
  PATH_CASE_SENSITIVITY: {
    id: 'R006',
    name: '路径大小写差异',
    severity: 'warning' as const,
    category: '路径规范'
  },
  BATCH_APPEND: {
    id: 'R007',
    name: '同案号多批次追加',
    severity: 'info' as const,
    category: '批次管理'
  },
  CASE_NOT_IN_MANIFEST: {
    id: 'R008',
    name: '案件未在清单中',
    severity: 'warning' as const,
    category: '数据一致性'
  },
  MANIFEST_CASE_NOT_IN_CASES: {
    id: 'R009',
    name: '清单案件未备案',
    severity: 'warning' as const,
    category: '数据一致性'
  },
  HASH_NOT_FOUND: {
    id: 'R010',
    name: '哈希记录缺失',
    severity: 'warning' as const,
    category: '文件完整性'
  }
};

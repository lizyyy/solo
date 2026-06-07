import { v4 as uuidv4 } from 'uuid';
import { records, selfCheck as selfCheckDb } from '../database';
import { SelfCheckType, SelfCheckResult, AnnotationRecord } from '../types';
import { checkPhoneLeaked } from './maskService';

export function runSelfCheck(): SelfCheckResult[] {
  const allRecords = records.getAll();
  const results: SelfCheckResult[] = [];
  const now = Date.now();

  const sessionMap = new Map<string, AnnotationRecord[]>();
  allRecords.forEach((r) => {
    if (!sessionMap.has(r.session_id)) sessionMap.set(r.session_id, []);
    sessionMap.get(r.session_id)!.push(r);
  });

  for (const [sessionId, sessionRecords] of sessionMap.entries()) {
    if (sessionRecords.length > 1) {
      sessionRecords.slice(1).forEach((record) => {
        results.push({
          id: uuidv4(),
          record_id: record.id,
          check_type: SelfCheckType.DUPLICATE_IMPORT,
          description: `会话 ${sessionId} 存在重复导入记录（共 ${sessionRecords.length} 条）`,
          severity: 'medium',
          is_resolved: false,
          created_at: now,
        });
      });
    }
  }

  allRecords.forEach((record) => {
    const hasPhoneInComment = record.annotator_comment && checkPhoneLeaked(record.annotator_comment);
    const hasPhoneInOutput = record.model_output && checkPhoneLeaked(record.model_output);
    const hasPhoneInQuery = record.user_query && checkPhoneLeaked(record.user_query);

    if (hasPhoneInComment || hasPhoneInOutput || hasPhoneInQuery) {
      const locations = [];
      if (hasPhoneInQuery) locations.push('用户问题');
      if (hasPhoneInComment) locations.push('标注员留言');
      if (hasPhoneInOutput) locations.push('模型输出');
      results.push({
        id: uuidv4(),
        record_id: record.id,
        check_type: SelfCheckType.PHONE_LEAKED,
        description: `手机号在导出中可能漏遮，涉及位置：${locations.join('、')}`,
        severity: 'high',
        is_resolved: false,
        created_at: now,
      });
    }
  });

  allRecords.forEach((record) => {
    if (record.version > 1 && record.review_status === 'pending') {
      results.push({
        id: uuidv4(),
        record_id: record.id,
        check_type: SelfCheckType.RECALC_NEEDED,
        description: `记录已补录更新（版本 ${record.version}），需要重新计算审核结果`,
        severity: 'medium',
        is_resolved: false,
        created_at: now,
      });
    }
  });

  selfCheckDb.clear();
  results.forEach((r) => selfCheckDb.add(r));

  return results;
}

export function getSelfCheckResults(onlyUnresolved: boolean = true): SelfCheckResult[] {
  let results = selfCheckDb.getAll();
  if (onlyUnresolved) {
    results = results.filter((r) => !r.is_resolved);
  }
  results.sort((a, b) => {
    const sevOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const sevDiff = sevOrder[a.severity] - sevOrder[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return b.created_at - a.created_at;
  });
  return results;
}

export function resolveSelfCheck(id: string): void {
  selfCheckDb.resolve(id);
}

import { diff_match_patch, Diff } from 'diff-match-patch';
import type { DiffResult, CriticalChange } from '@/types';

const dmp = new diff_match_patch();

export const compareVersions = (v1: string, v2: string): DiffResult[] => {
  const diffs: Diff[] = dmp.diff_main(v1, v2);
  dmp.diff_cleanupSemantic(diffs);

  const results: DiffResult[] = [];
  let lineNumber = 1;

  const v1Lines = v1.split('\n');
  const v2Lines = v2.split('\n');
  const maxLines = Math.max(v1Lines.length, v2Lines.length);

  for (let i = 0; i < maxLines; i++) {
    const line1 = v1Lines[i] || '';
    const line2 = v2Lines[i] || '';

    if (line1 !== line2) {
      if (!line1 && line2) {
        results.push({
          type: 'added',
          line: i + 1,
          content: line2,
        });
      } else if (line1 && !line2) {
        results.push({
          type: 'removed',
          line: i + 1,
          content: line1,
        });
      } else {
        results.push({
          type: 'modified',
          line: i + 1,
          content: `${line1} → ${line2}`,
        });
      }
    }
    lineNumber++;
  }

  return results;
};

export const detectCriticalChanges = (diffs: DiffResult[]): CriticalChange[] => {
  const criticalChanges: CriticalChange[] = [];
  const scoreKeywords = ['分数', '得分', '评分', '成绩', '合格', '不合格', '通过', '不通过'];
  const conclusionKeywords = ['结论', '判定', '结果', '最终', '总结'];

  diffs.forEach((diff) => {
    const content = diff.content.toLowerCase();

    if (scoreKeywords.some((k) => content.includes(k))) {
      criticalChanges.push({
        severity: 'high',
        description: `评分相关内容变更: ${diff.content}`,
        location: `第 ${diff.line} 行`,
      });
    } else if (conclusionKeywords.some((k) => content.includes(k))) {
      criticalChanges.push({
        severity: 'high',
        description: `结论相关内容变更: ${diff.content}`,
        location: `第 ${diff.line} 行`,
      });
    } else if (diff.type === 'removed') {
      criticalChanges.push({
        severity: 'medium',
        description: `内容删除: ${diff.content}`,
        location: `第 ${diff.line} 行`,
      });
    }
  });

  return criticalChanges;
};

export const generateChangeSummary = (diffs: DiffResult[]): string => {
  const added = diffs.filter((d) => d.type === 'added').length;
  const removed = diffs.filter((d) => d.type === 'removed').length;
  const modified = diffs.filter((d) => d.type === 'modified').length;

  const parts: string[] = [];
  if (added > 0) parts.push(`新增 ${added} 行`);
  if (removed > 0) parts.push(`删除 ${removed} 行`);
  if (modified > 0) parts.push(`修改 ${modified} 行`);

  return parts.length > 0 ? parts.join('，') : '无变更';
};

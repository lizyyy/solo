import { diff_match_patch, Diff } from 'diff-match-patch';
import type { StepRecord, DataSource } from '@/types';

const dmp = new diff_match_patch();

export interface DiffResult {
  text: string;
  type: 'equal' | 'insert' | 'delete';
}

export function computeDiff(oldText: string, newText: string): DiffResult[] {
  const diffs: Diff[] = dmp.diff_main(oldText, newText);
  dmp.diff_cleanupSemantic(diffs);
  return diffs.map(([op, text]) => ({
    text,
    type: op === 0 ? 'equal' : op === 1 ? 'insert' : 'delete',
  }));
}

export interface StepDiff {
  stepNumber: number;
  stepName: string;
  studentRecord?: StepRecord;
  scoreRecord?: StepRecord;
  status: 'match' | 'mismatch' | 'missing_in_student' | 'missing_in_score' | 'status_mismatch';
  timeGap?: string;
}

export function compareStudentAndScoreRecords(
  studentRecords: StepRecord[],
  scoreRecords: StepRecord[]
): StepDiff[] {
  const allStepNumbers = new Set<number>();
  studentRecords.forEach((r) => allStepNumbers.add(r.stepNumber));
  scoreRecords.forEach((r) => allStepNumbers.add(r.stepNumber));

  const result: StepDiff[] = [];

  for (const stepNum of Array.from(allStepNumbers).sort((a, b) => a - b)) {
    const studentRec = studentRecords.find((r) => r.stepNumber === stepNum);
    const scoreRec = scoreRecords.find((r) => r.stepNumber === stepNum);

    let status: StepDiff['status'] = 'match';
    if (!studentRec && scoreRec) status = 'missing_in_student';
    else if (studentRec && !scoreRec) status = 'missing_in_score';
    else if (studentRec && scoreRec && studentRec.status !== scoreRec.status) status = 'status_mismatch';
    else if (studentRec && scoreRec && studentRec.content !== scoreRec.content) status = 'mismatch';

    result.push({
      stepNumber: stepNum,
      stepName: studentRec?.stepName || scoreRec?.stepName || `步骤${stepNum}`,
      studentRecord: studentRec,
      scoreRecord: scoreRec,
      status,
    });
  }

  return result;
}

export function getSourceName(source: DataSource): string {
  const names: Record<DataSource, string> = {
    student: '学生记录',
    score_sheet: '评分表',
    manual: '手工补录',
    script_mod: '脚本修改',
  };
  return names[source];
}

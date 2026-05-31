import { useMemo } from 'react';
import type { StepRecord } from '@/types';
import { compareStudentAndScoreRecords, computeDiff, type StepDiff, type DiffResult } from '@/utils/diff';

export function useDiff(studentRecords: StepRecord[], scoreRecords: StepRecord[]) {
  const stepDiffs = useMemo(
    () => compareStudentAndScoreRecords(studentRecords, scoreRecords),
    [studentRecords, scoreRecords]
  );

  const mismatchedSteps = useMemo(
    () => stepDiffs.filter((d) => d.status !== 'match'),
    [stepDiffs]
  );

  const getTextDiff = (oldText: string, newText: string): DiffResult[] => {
    return computeDiff(oldText, newText);
  };

  return {
    stepDiffs,
    mismatchedSteps,
    getTextDiff,
  };
}

export function useScriptDiff(versions: { version: string; content: string }[]) {
  const getVersionDiff = (oldVersion: string, newVersion: string): DiffResult[] => {
    const old = versions.find((v) => v.version === oldVersion);
    const newV = versions.find((v) => v.version === newVersion);
    if (!old || !newV) return [];
    return computeDiff(old.content, newV.content);
  };

  return {
    getVersionDiff,
  };
}

import { SubtitleCue, SyncRule, SceneMark } from '../parser/types';
import { DriftInfo } from '../alignment/aligner';

export interface ValidationIssue {
  type: 'error' | 'warning';
  code: string;
  message: string;
  location?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export function validateSubtitleCues(cues: SubtitleCue[]): ValidationResult {
  const issues: ValidationIssue[] = [];

  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];

    if (cue.startTime < 0) {
      issues.push({
        type: 'error',
        code: 'NEGATIVE_START',
        message: `Subtitle ${i + 1} has negative start time: ${cue.startTime}ms`,
        location: `cue ${i + 1}`
      });
    }

    if (cue.endTime < cue.startTime) {
      issues.push({
        type: 'error',
        code: 'END_BEFORE_START',
        message: `Subtitle ${i + 1} ends before it starts (start: ${cue.startTime}ms, end: ${cue.endTime}ms)`,
        location: `cue ${i + 1}`
      });
    }

    if (cue.endTime - cue.startTime < 100) {
      issues.push({
        type: 'warning',
        code: 'SHORT_DURATION',
        message: `Subtitle ${i + 1} duration is less than 100ms: ${cue.endTime - cue.startTime}ms`,
        location: `cue ${i + 1}`
      });
    }

    if (!cue.text || cue.text.trim().length === 0) {
      issues.push({
        type: 'error',
        code: 'EMPTY_TEXT',
        message: `Subtitle ${i + 1} has empty text`,
        location: `cue ${i + 1}`
      });
    }
  }

  for (let i = 0; i < cues.length - 1; i++) {
    const current = cues[i];
    const next = cues[i + 1];

    if (current.endTime > next.startTime) {
      issues.push({
        type: 'error',
        code: 'OVERLAPPING_CUES',
        message: `Subtitle ${i + 1} overlaps with subtitle ${i + 2} by ${current.endTime - next.startTime}ms`,
        location: `cues ${i + 1} and ${i + 2}`
      });
    }

    if (next.startTime - current.endTime < 0) {
      issues.push({
        type: 'error',
        code: 'NEGATIVE_GAP',
        message: `Negative gap between subtitle ${i + 1} and ${i + 2}`,
        location: `cues ${i + 1} and ${i + 2}`
      });
    }
  }

  return {
    valid: issues.filter(i => i.type === 'error').length === 0,
    issues
  };
}

export function validateSyncRules(rules: SyncRule): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!rules.anchorPoints && !rules.linearDrift) {
    issues.push({
      type: 'warning',
      code: 'NO_ALIGNMENT_RULES',
      message: 'No anchor points or linear drift configuration provided'
    });
  }

  if (rules.linearDrift) {
    const { slope, intercept } = rules.linearDrift;

    if (slope < 0.9 || slope > 1.1) {
      issues.push({
        type: 'warning',
        code: 'UNUSUAL_SLOPE',
        message: `Linear drift slope ${slope} is unusual (expected ~1.0)`
      });
    }

    if (Math.abs(intercept) > 10000) {
      issues.push({
        type: 'warning',
        code: 'LARGE_INTERCEPT',
        message: `Linear drift intercept ${intercept}ms is large`
      });
    }
  }

  if (rules.maxDrift && rules.maxDrift < 0) {
    issues.push({
      type: 'error',
      code: 'NEGATIVE_MAX_DRIFT',
      message: 'maxDrift cannot be negative'
    });
  }

  if (rules.anchorPoints) {
    for (let i = 0; i < rules.anchorPoints.length; i++) {
      const anchor = rules.anchorPoints[i];

      if (anchor.originalTime < 0) {
        issues.push({
          type: 'error',
          code: 'NEGATIVE_ANCHOR_TIME',
          message: `Anchor point ${i + 1} has negative original time: ${anchor.originalTime}ms`
        });
      }

      if (anchor.translatedTime < 0) {
        issues.push({
          type: 'error',
          code: 'NEGATIVE_TRANSLATED_TIME',
          message: `Anchor point ${i + 1} has negative translated time: ${anchor.translatedTime}ms`
        });
      }
    }

    const sorted = [...rules.anchorPoints].sort((a, b) => a.originalTime - b.originalTime);
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].originalTime === sorted[i + 1].originalTime) {
        issues.push({
          type: 'warning',
          code: 'DUPLICATE_ANCHOR_TIME',
          message: `Duplicate anchor time at ${sorted[i].originalTime}ms`
        });
      }
    }
  }

  return {
    valid: issues.filter(i => i.type === 'error').length === 0,
    issues
  };
}

export function validateDriftInfo(driftInfos: DriftInfo[], sceneMarks: SceneMark[]): ValidationResult {
  const issues: ValidationIssue[] = [];

  const avgDrift = driftInfos.reduce((sum, d) => sum + d.drift, 0) / driftInfos.length;
  const maxAllowedDrift = 5000;

  if (Math.abs(avgDrift) > maxAllowedDrift) {
    issues.push({
      type: 'warning',
      code: 'LARGE_AVG_DRIFT',
      message: `Average drift ${avgDrift.toFixed(2)}ms exceeds ${maxAllowedDrift}ms threshold`
    });
  }

  const driftRateVariance = driftInfos.reduce((sum, d) => sum + Math.pow(d.driftRate - 1, 2), 0) / driftInfos.length;
  if (driftRateVariance > 0.01) {
    issues.push({
      type: 'warning',
      code: 'VARIABLE_DRIFT_RATE',
      message: `Drift rate varies significantly across subtitles (variance: ${driftRateVariance.toFixed(6)})`
    });
  }

  for (const sceneMark of sceneMarks) {
    const nearDrift = driftInfos.find(
      d => Math.abs(d.originalTime - sceneMark.timestamp) < 1000
    );

    if (nearDrift && Math.abs(nearDrift.drift) > 2000) {
      issues.push({
        type: 'warning',
        code: 'SCENE_MARK_DRIFT',
        message: `Large drift (${nearDrift.drift.toFixed(2)}ms) detected near scene mark: ${sceneMark.label} at ${sceneMark.timestamp}ms`
      });
    }
  }

  return {
    valid: issues.filter(i => i.type === 'error').length === 0,
    issues
  };
}

export function validateAll(
  cues: SubtitleCue[],
  rules: SyncRule,
  driftInfos: DriftInfo[],
  sceneMarks: SceneMark[]
): ValidationResult {
  const allIssues: ValidationIssue[] = [];

  const cueValidation = validateSubtitleCues(cues);
  allIssues.push(...cueValidation.issues);

  const rulesValidation = validateSyncRules(rules);
  allIssues.push(...rulesValidation.issues);

  const driftValidation = validateDriftInfo(driftInfos, sceneMarks);
  allIssues.push(...driftValidation.issues);

  return {
    valid: allIssues.filter(i => i.type === 'error').length === 0,
    issues: allIssues
  };
}

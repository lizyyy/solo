import { Speaker, CalculationResult, ValidationError, PhaseIntermediate } from '../types';

function generateId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function checkDelayDirection(
  speakers: Speaker[],
  results: CalculationResult[]
): ValidationError | null {
  if (speakers.length < 2) return null;

  const avgDistances = speakers.map((speaker) => {
    const distances = results.map((r) => {
      const intermediate = r.intermediates.find((im) => im.speakerId === speaker.id);
      return intermediate?.distance || 0;
    });
    const avgDist = distances.reduce((a, b) => a + b, 0) / distances.length;
    return { speaker, avgDist };
  });

  avgDistances.sort((a, b) => a.avgDist - b.avgDist);

  const problematicPairs: Array<{ s1: Speaker; s2: Speaker; reason: string }> = [];

  for (let i = 0; i < avgDistances.length - 1; i++) {
    for (let j = i + 1; j < avgDistances.length; j++) {
      const closer = avgDistances[i];
      const farther = avgDistances[j];

      if (closer.avgDist < farther.avgDist * 0.8 && closer.speaker.delay > farther.speaker.delay * 1.5) {
        problematicPairs.push({
          s1: closer.speaker,
          s2: farther.speaker,
          reason: `音箱"${closer.speaker.name}"(距离${closer.avgDist.toFixed(1)}m)延时${closer.speaker.delay}ms 大于 音箱"${farther.speaker.name}"(距离${farther.avgDist.toFixed(1)}m)延时${farther.speaker.delay}ms`,
        });
      }
    }
  }

  if (problematicPairs.length === 0) return null;

  const affectedResultIds: string[] = [];

  results.forEach((result) => {
    const hasIssue = problematicPairs.some((pair) => {
      const im1 = result.intermediates.find((im) => im.speakerId === pair.s1.id);
      const im2 = result.intermediates.find((im) => im.speakerId === pair.s2.id);
      if (!im1 || !im2) return false;
      return im1.distance < im2.distance * 0.8 && im1.totalTime > im2.totalTime * 1.2;
    });
    if (hasIssue) {
      affectedResultIds.push(result.id);
    }
  });

  if (affectedResultIds.length === 0) return null;

  return {
    id: generateId(),
    type: 'delay_direction',
    severity: 'error',
    description: `检测到${problematicPairs.length}组延时方向可能错误：${problematicPairs.map((p) => p.reason).join('；')}。延时设置应与物理距离匹配，远距离音箱通常需要更小或相等的延时。`,
    affectedResultIds,
    affectedCount: affectedResultIds.length,
  };
}

export function checkPhaseMissed(
  results: CalculationResult[]
): ValidationError | null {
  const affectedResultIds: string[] = [];
  const problematicPhases: Array<{ resultId: string; phase: PhaseIntermediate }> = [];

  results.forEach((result) => {
    result.phaseIntermediates.forEach((pi) => {
      if (pi.phaseDiff >= 150 && pi.phaseDiff <= 210 && pi.cancelFactor > 0.3) {
        if (!affectedResultIds.includes(result.id)) {
          affectedResultIds.push(result.id);
        }
        problematicPhases.push({ resultId: result.id, phase: pi });
      }
    });
  });

  if (affectedResultIds.length === 0) return null;

  const example = problematicPhases.slice(0, 3).map((p) =>
    `测点(${results.find((r) => r.id === p.resultId)?.x},${results.find((r) => r.id === p.resultId)?.y}): "${p.phase.speakerName1}"与"${p.phase.speakerName2}"相位差${p.phase.phaseDiff.toFixed(0)}°，抵消系数${p.phase.cancelFactor.toFixed(2)}`
  ).join('；');

  return {
    id: generateId(),
    type: 'phase_missed',
    severity: 'warning',
    description: `检测到${problematicPhases.length}处可能的相位抵消漏算：相位差在150°~210°范围但抵消系数偏高。示例：${example}。请检查这些位置是否需要额外的延时校准。`,
    affectedResultIds,
    affectedCount: affectedResultIds.length,
  };
}

export function checkSplOverlimit(
  results: CalculationResult[],
  threshold: number
): ValidationError | null {
  const affectedResults = results.filter((r) => r.totalSpl > threshold);

  if (affectedResults.length === 0) return null;

  const affectedResultIds = affectedResults.map((r) => r.id);
  const maxSpl = Math.max(...affectedResults.map((r) => r.totalSpl));
  const examples = affectedResults.slice(0, 5).map((r) =>
    `(${r.x},${r.y}): ${r.totalSpl.toFixed(1)}dB`
  ).join('；');

  return {
    id: generateId(),
    type: 'spl_overlimit',
    severity: 'error',
    description: `检测到${affectedResults.length}个测点声压超过阈值${threshold}dB，最大值${maxSpl.toFixed(1)}dB。超限位置：${examples}。长期暴露在高声压环境可能导致听力损伤，请调整音箱位置或降低功率。`,
    affectedResultIds,
    affectedCount: affectedResults.length,
  };
}

export function validateResults(
  speakers: Speaker[],
  results: CalculationResult[],
  splThreshold: number
): ValidationError[] {
  const errors: ValidationError[] = [];

  const delayError = checkDelayDirection(speakers, results);
  if (delayError) errors.push(delayError);

  const phaseError = checkPhaseMissed(results);
  if (phaseError) errors.push(phaseError);

  const splError = checkSplOverlimit(results, splThreshold);
  if (splError) errors.push(splError);

  return errors;
}

export function attachErrorsToResults(
  results: CalculationResult[],
  errors: ValidationError[]
): CalculationResult[] {
  return results.map((result) => {
    const resultErrors = errors.filter((e) =>
      e.affectedResultIds.includes(result.id)
    );
    return {
      ...result,
      errors: resultErrors,
    };
  });
}

export function hasCriticalErrors(errors: ValidationError[]): boolean {
  return errors.some((e) => e.severity === 'error');
}

export function getErrorCountByType(errors: ValidationError[]): Record<string, number> {
  return errors.reduce((acc, err) => {
    acc[err.type] = (acc[err.type] || 0) + err.affectedCount;
    return acc;
  }, {} as Record<string, number>);
}

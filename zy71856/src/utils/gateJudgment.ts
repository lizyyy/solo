import type {
  GateStandardStep,
  GateStudentOperation,
  GateJudgment,
  JudgmentReason,
  JudgmentResult,
  GateJudgmentConfig
} from '@/types/gate';
import { DEFAULT_JUDGMENT_CONFIG } from '@/types/gate';
import { generateId } from './time';

export function compareParameter(
  paramName: string,
  expected: number,
  actual: number,
  config: GateJudgmentConfig = DEFAULT_JUDGMENT_CONFIG
): { score: number; reason: string; passed: boolean } {
  const tolerance = config.parameterTolerances[paramName] || 10;
  const diff = Math.abs(expected - actual);
  const diffPercent = (diff / expected) * 100;

  let score = 100;
  let reason = '';
  let passed = true;

  if (diffPercent <= tolerance / 2) {
    score = 100;
    reason = `${paramName}参数准确，误差${diff.toFixed(1)}%，在允许范围内`;
  } else if (diffPercent <= tolerance) {
    score = 80;
    reason = `${paramName}参数略有偏差，误差${diff.toFixed(1)}%，接近允许范围上限`;
  } else if (diffPercent <= tolerance * 1.5) {
    score = 60;
    reason = `${paramName}参数偏差较大，误差${diff.toFixed(1)}%，超出允许范围`;
    passed = false;
  } else {
    score = Math.max(0, 100 - diffPercent * 2);
    reason = `${paramName}参数严重偏差，误差${diff.toFixed(1)}%，显著超出允许范围`;
    passed = false;
  }

  return { score, reason, passed };
}

export function checkDuration(
  expected: number,
  actual: number,
  config: GateJudgmentConfig = DEFAULT_JUDGMENT_CONFIG
): { score: number; reason: string; passed: boolean } {
  const tolerance = config.parameterTolerances.duration || 15;
  const diffPercent = Math.abs(expected - actual) / expected * 100;

  let score = 100;
  let reason = '';
  let passed = true;

  if (actual < expected * 0.5) {
    score = 40;
    reason = `操作过快，用时${actual}秒，预期${expected}秒，可能操作不完整`;
    passed = false;
  } else if (diffPercent <= tolerance) {
    score = 100;
    reason = `操作时长合理，用时${actual}秒，预期${expected}秒`;
  } else if (diffPercent <= tolerance * 2) {
    score = 70;
    reason = `操作偏慢，用时${actual}秒，预期${expected}秒，效率有待提升`;
  } else {
    score = 50;
    reason = `操作过慢，用时${actual}秒，预期${expected}秒，熟练度不足`;
    passed = false;
  }

  return { score, reason, passed };
}

export function generateJudgment(
  step: GateStandardStep,
  operation: GateStudentOperation,
  config: GateJudgmentConfig = DEFAULT_JUDGMENT_CONFIG
): GateJudgment {
  const reasons: JudgmentReason[] = [];
  let totalScore = 0;
  let factorCount = 0;
  let allPassed = true;

  const durationResult = checkDuration(step.expectedDuration, operation.duration, config);
  totalScore += durationResult.score;
  factorCount++;
  if (!durationResult.passed) allPassed = false;
  reasons.push({
    id: generateId(),
    description: durationResult.reason,
    evidenceRef: operation.rawData?.durationEvidence || '',
    confidence: durationResult.score,
    parameterName: 'duration',
    expectedValue: step.expectedDuration,
    actualValue: operation.duration
  });

  for (const [paramName, value] of Object.entries(operation.parameters)) {
    const expected = operation.rawData?.expectedParams?.[paramName];
    if (expected !== undefined) {
      const result = compareParameter(paramName, expected, value, config);
      totalScore += result.score;
      factorCount++;
      if (!result.passed) allPassed = false;
      reasons.push({
        id: generateId(),
        description: result.reason,
        evidenceRef: operation.rawData?.paramEvidence?.[paramName] || '',
        confidence: result.score,
        parameterName: paramName,
        expectedValue: expected,
        actualValue: value
      });
    }
  }

  const averageScore = factorCount > 0 ? totalScore / factorCount : 0;
  const finalScore = Math.round((averageScore / 100) * step.maxScore);

  let result: JudgmentResult = 'pending';
  if (allPassed && averageScore >= config.warningThreshold) {
    result = 'pass';
  } else if (averageScore < config.passThreshold) {
    result = 'fail';
  }

  const teachingReason = generateTeachingReason(result, reasons, step);
  const nextStep = generateNextStep(result, reasons, step);
  const rawReason = generateRawReason(reasons, averageScore);

  return {
    id: generateId(),
    eventId: '',
    stepId: step.id,
    result,
    score: finalScore,
    maxScore: step.maxScore,
    teachingReason,
    nextStep,
    rawReason,
    reasons,
    createdAt: Date.now(),
    isFinal: result !== 'pending'
  };
}

function generateTeachingReason(
  result: JudgmentResult,
  reasons: JudgmentReason[],
  step: GateStandardStep
): string {
  const failedReasons = reasons.filter(r => r.confidence < 60);

  if (result === 'pass') {
    return `学生在"${step.name}"环节表现良好，操作规范，各项指标均符合标准要求。主要优点：${reasons.slice(0, 2).map(r => r.description).join('；')}`;
  } else if (result === 'fail') {
    const mainIssues = failedReasons.slice(0, 3).map(r => r.description).join('；');
    return `学生在"${step.name}"环节存在明显不足，主要问题：${mainIssues}。需要加强相关操作的训练。`;
  } else {
    return `学生在"${step.name}"环节的表现需要进一步确认，部分操作指标接近合格边缘，请人工复核。`;
  }
}

function generateNextStep(
  result: JudgmentResult,
  reasons: JudgmentReason[],
  step: GateStandardStep
): string {
  if (result === 'pass') {
    return '建议进入下一环节学习，可以适当增加操作难度，提升熟练度。';
  } else if (result === 'fail') {
    const weakPoints = reasons
      .filter(r => r.confidence < 60)
      .map(r => r.parameterName || '操作')
      .filter((v, i, a) => a.indexOf(v) === i)
      .join('、');
    return `建议针对${weakPoints}进行专项训练，可回放操作视频进行复盘，待熟练后重新考核。`;
  } else {
    return '请培训老师人工复核该步骤的操作记录和视频，确认最终评分结果。';
  }
}

function generateRawReason(reasons: JudgmentReason[], averageScore: number): string {
  return `综合得分: ${averageScore.toFixed(1)}分\n` +
    reasons.map((r, i) => `${i + 1}. ${r.description} (置信度: ${r.confidence}%)`).join('\n');
}

export function detectStepSkipped(
  steps: GateStandardStep[],
  operations: GateStudentOperation[]
): string[] {
  const operatedStepIds = new Set(operations.map(o => o.stepId));
  return steps
    .filter(s => !operatedStepIds.has(s.id))
    .map(s => s.id);
}

export function detectViewReset(
  operation: GateStudentOperation,
  initialView: Record<string, number>
): boolean {
  const viewParams = ['cameraX', 'cameraY', 'cameraZ', 'rotation'];
  let resetCount = 0;

  for (const param of viewParams) {
    const current = operation.parameters[param];
    const initial = initialView[param];
    if (current !== undefined && initial !== undefined) {
      if (Math.abs(current - initial) < 0.1) {
        resetCount++;
      }
    }
  }

  return resetCount >= 3;
}

export function detectDragLost(operation: GateStudentOperation): boolean {
  const hasDragStart = operation.rawData?.dragStart !== undefined;
  const hasDragEnd = operation.rawData?.dragEnd !== undefined;

  if (hasDragStart && !hasDragEnd) return true;

  if (hasDragStart && hasDragEnd) {
    const start = operation.rawData.dragStart;
    const end = operation.rawData.dragEnd;
    const distance = Math.sqrt(
      Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)
    );
    if (distance < 5) return true;
  }

  return false;
}

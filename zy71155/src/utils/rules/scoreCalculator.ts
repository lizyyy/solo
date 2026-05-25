import type { PlacedItem, Violation, BoxType, SettlementResult, Grade } from '../../types/game';
import {
  runAllChecks,
  checkFatalViolations,
  calculateSpaceUtilization,
  calculateCenterOfGravity,
  calculateTotalWeight,
} from './rulesEngine';

export const calculateGrade = (score: number): Grade => {
  if (score >= 90) return 'S';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  return 'F';
};

export const calculateScore = (
  placedItems: PlacedItem[],
  boxType: BoxType,
  timeElapsed: number,
  timeLimit: number,
  totalCommodities: number
): SettlementResult => {
  let baseScore = 100;
  
  const violations = runAllChecks(placedItems, boxType);
  const fatalViolation = checkFatalViolations(violations);
  
  for (const violation of violations) {
    baseScore += violation.penalty;
  }
  
  if (placedItems.length < totalCommodities) {
    const missingItems = totalCommodities - placedItems.length;
    baseScore -= missingItems * 10;
    violations.push({
      id: Math.random().toString(36).substring(2, 11),
      type: 'space_waste',
      description: `还有${missingItems}件商品未装箱`,
      penalty: -missingItems * 10,
      commodityId: '',
      isFatal: false,
    });
  }
  
  if (timeLimit > 0 && timeElapsed > timeLimit) {
    const overtime = timeElapsed - timeLimit;
    const overtimePenalty = Math.min(20, Math.floor(overtime / 10) * 5);
    baseScore -= overtimePenalty;
    violations.push({
      id: Math.random().toString(36).substring(2, 11),
      type: 'time_position',
      description: `超时${overtime}秒，扣${overtimePenalty}分`,
      penalty: -overtimePenalty,
      commodityId: '',
      isFatal: false,
    });
  }
  
  const spaceUtilization = calculateSpaceUtilization(placedItems, boxType);
  if (spaceUtilization >= 0.9) {
    baseScore += 5;
  }
  
  const finalScore = Math.max(0, Math.min(100, baseScore));
  const grade = calculateGrade(finalScore);
  
  let isPassed = finalScore >= 60;
  if (fatalViolation) {
    isPassed = false;
  }
  
  return {
    score: finalScore,
    grade,
    violations,
    spaceUtilization,
    centerOfGravity: calculateCenterOfGravity(placedItems),
    totalWeight: calculateTotalWeight(placedItems),
    isPassed,
    fatalViolation,
  };
};

export const getScoreBreakdown = (result: SettlementResult) => {
  const breakdown = [
    { name: '基础分', score: 100, color: '#165DFF' },
  ];
  
  const violationTypes: Record<string, string> = {
    heavy_on_fragile: '重物压易碎',
    fragile_under: '易碎品被压',
    time_position: '时效件位置',
    space_waste: '空间浪费',
    unstable: '重心不稳',
    overweight: '超重',
  };
  
  for (const violation of result.violations) {
    breakdown.push({
      name: violationTypes[violation.type] || violation.type,
      score: violation.penalty,
      color: violation.isFatal ? '#F53F3F' : '#FF7D00',
    });
  }
  
  if (result.spaceUtilization >= 0.9) {
    breakdown.push({
      name: '空间利用率奖励',
      score: 5,
      color: '#00B42A',
    });
  }
  
  return breakdown;
};

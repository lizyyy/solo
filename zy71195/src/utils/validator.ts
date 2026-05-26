import { Vehicle, ValidationResult } from '../types';
import { SCORE_RULES } from '../data/levels';

export function validateInspection(
  vehicle: Vehicle,
  action: 'pass' | 'intercept'
): ValidationResult {
  const containerMismatch = vehicle.container.containerNo !== vehicle.reservation.containerNo;
  const licenseMismatch = vehicle.container.licensePlate !== vehicle.reservation.licensePlate;
  const dangerousWithoutPermission = vehicle.container.hasDangerous && !vehicle.reservation.allowDangerous;
  const reservationInvalid = !vehicle.reservation.isValid;

  const shouldIntercept = containerMismatch || licenseMismatch || dangerousWithoutPermission || reservationInvalid;

  if (action === 'pass') {
    if (shouldIntercept) {
      let errorReason = '';
      if (containerMismatch) errorReason = '箱号不匹配';
      else if (licenseMismatch) errorReason = '车牌不匹配';
      else if (dangerousWithoutPermission) errorReason = '危品未拦截';
      else if (reservationInvalid) errorReason = '预约无效';
      
      return {
        isCorrect: false,
        errorReason,
        scoreChange: SCORE_RULES.WRONG_PASS,
      };
    }
    
    return {
      isCorrect: true,
      scoreChange: SCORE_RULES.CORRECT_PASS,
    };
  }

  if (action === 'intercept') {
    if (shouldIntercept) {
      let scoreChange = SCORE_RULES.CORRECT_INTERCEPT;
      if (dangerousWithoutPermission) {
        scoreChange += SCORE_RULES.DANGEROUS_INTERCEPT_BONUS;
      }
      
      return {
        isCorrect: true,
        scoreChange,
      };
    }
    
    return {
      isCorrect: false,
      errorReason: '错误拦截正常车辆',
      scoreChange: SCORE_RULES.WRONG_INTERCEPT,
    };
  }

  return {
    isCorrect: false,
    errorReason: '未知操作',
    scoreChange: 0,
  };
}

export function getVehicleIssues(vehicle: Vehicle): string[] {
  const issues: string[] = [];
  
  if (vehicle.container.containerNo !== vehicle.reservation.containerNo) {
    issues.push('箱号不匹配');
  }
  if (vehicle.container.licensePlate !== vehicle.reservation.licensePlate) {
    issues.push('车牌不匹配');
  }
  if (vehicle.container.hasDangerous && !vehicle.reservation.allowDangerous) {
    issues.push('危品未申报');
  }
  if (!vehicle.reservation.isValid) {
    issues.push('预约无效');
  }
  
  return issues;
}

export function calculateAccuracy(correctCount: number, totalCount: number): number {
  if (totalCount === 0) return 0;
  return Math.round((correctCount / totalCount) * 100);
}

export function calculateStars(score: number, passScore: number, maxScore: number): number {
  if (score < passScore) return 0;
  if (score >= maxScore * 0.9) return 3;
  if (score >= maxScore * 0.7) return 2;
  return 1;
}

export function calculateMaxPossibleScore(vehicleCount: number): number {
  return vehicleCount * SCORE_RULES.CORRECT_PASS;
}

import {
  Scratch,
  CleanerType,
  ScratchSeverity,
  ErrorType,
  CLEANER_INFO,
  Noise,
  NoiseType,
} from '../types';

export interface ValidationResult {
  isCorrect: boolean;
  scoreDelta: number;
  patienceDelta: number;
  errorType?: ErrorType;
  errorDescription?: string;
  inventoryDelta?: { item: string; amount: number };
}

export class RulesEngine {
  static validateScratchJudgment(
    scratch: Scratch,
    userJudgment: { isScratch: boolean; severity: ScratchSeverity }
  ): ValidationResult {
    const actualIsScratch = !scratch.isFalsePositive;
    const actualSeverity = scratch.severity;

    if (userJudgment.isScratch !== actualIsScratch) {
      return {
        isCorrect: false,
        scoreDelta: -15,
        patienceDelta: -10,
        errorType: 'scratch_misjudgment',
        errorDescription: userJudgment.isScratch
          ? `误判：位置${scratch.position}%处不存在真实划痕`
          : `漏判：位置${scratch.position}%处的划痕未被检测到`,
      };
    }

    if (userJudgment.isScratch && userJudgment.severity !== actualSeverity) {
      const severityLevels: Record<ScratchSeverity, number> = { light: 1, medium: 2, deep: 3 };
      const diff = Math.abs(severityLevels[userJudgment.severity] - severityLevels[actualSeverity]);
      return {
        isCorrect: false,
        scoreDelta: -5 * diff,
        patienceDelta: -5,
        errorType: 'scratch_misjudgment',
        errorDescription: `划痕严重程度误判：应为${actualSeverity}，判断为${userJudgment.severity}`,
      };
    }

    return {
      isCorrect: true,
      scoreDelta: 10,
      patienceDelta: 5,
    };
  }

  static validateCleaning(
    cleanerType: CleanerType,
    amount: number,
    scratch: Scratch,
    inventoryCount: number
  ): ValidationResult {
    const cleaner = CLEANER_INFO.find(c => c.type === cleanerType)!;
    const isSuitable = cleaner.suitableFor.includes(scratch.severity);

    let scoreDelta = 0;
    let patienceDelta = 0;
    let errorType: ErrorType | undefined;
    let errorDescription: string | undefined;

    const recommendedAmount = this.getRecommendedAmount(scratch.severity);
    const overAmountThreshold = recommendedAmount * 1.5;
    const isOverCleaning = amount > overAmountThreshold;

    if (!isSuitable) {
      scoreDelta -= 10;
      patienceDelta -= 8;
      errorType = 'over_cleaning';
      errorDescription = `清洗剂类型不匹配：${cleaner.name}不适用于${scratch.severity}划痕`;
    }

    if (isOverCleaning) {
      scoreDelta -= 15;
      patienceDelta -= 10;
      errorType = 'over_cleaning';
      errorDescription = errorDescription
        ? `${errorDescription}；清洗过度：使用${amount}ml，推荐${recommendedAmount}ml`
        : `清洗过度：使用${amount}ml，推荐${recommendedAmount}ml`;
    }

    if (amount < recommendedAmount * 0.5) {
      scoreDelta -= 5;
      patienceDelta -= 3;
    }

    if (inventoryCount < amount) {
      scoreDelta -= 20;
      patienceDelta -= 15;
    }

    const isCorrect = scoreDelta >= 0;

    if (isCorrect) {
      scoreDelta += 15;
      patienceDelta += 8;
    }

    return {
      isCorrect,
      scoreDelta,
      patienceDelta,
      errorType,
      errorDescription,
      inventoryDelta: { item: cleanerType, amount: -amount },
    };
  }

  static validateListeningRecord(
    hasRecorded: boolean,
    noises: Noise[],
    userAssessment: { noiseTypes: NoiseType[]; qualityScore: number }
  ): ValidationResult {
    if (!hasRecorded) {
      return {
        isCorrect: false,
        scoreDelta: -20,
        patienceDelta: -15,
        errorType: 'missing_listening_record',
        errorDescription: '未记录试听结果',
      };
    }

    const actualNoiseTypes = noises.map(n => n.type);
    const missedNoises = actualNoiseTypes.filter(n => !userAssessment.noiseTypes.includes(n));
    const falseNoises = userAssessment.noiseTypes.filter(n => !actualNoiseTypes.includes(n));

    let scoreDelta = 0;
    let patienceDelta = 0;

    if (missedNoises.length > 0) {
      scoreDelta -= 8 * missedNoises.length;
      patienceDelta -= 5 * missedNoises.length;
    }

    if (falseNoises.length > 0) {
      scoreDelta -= 5 * falseNoises.length;
      patienceDelta -= 3 * falseNoises.length;
    }

    const expectedQuality = this.calculateExpectedQuality(noises);
    const qualityDiff = Math.abs(userAssessment.qualityScore - expectedQuality);
    if (qualityDiff > 20) {
      scoreDelta -= Math.floor(qualityDiff / 10) * 3;
      patienceDelta -= Math.floor(qualityDiff / 10) * 2;
    }

    const isCorrect = scoreDelta >= -10;

    if (isCorrect) {
      scoreDelta += 20;
      patienceDelta += 10;
    }

    return {
      isCorrect,
      scoreDelta,
      patienceDelta,
    };
  }

  static validateNoiseAnalysis(
    noise: Noise,
    userAnalysis: { type: NoiseType; note?: string }
  ): ValidationResult {
    const isCorrect = userAnalysis.type === noise.type;

    if (!isCorrect) {
      return {
        isCorrect: false,
        scoreDelta: -8,
        patienceDelta: -5,
        errorDescription: `噪声类型误判：应为${noise.type}，判断为${userAnalysis.type}`,
      };
    }

    let bonus = 0;
    if (userAnalysis.note && userAnalysis.note.length > 10) {
      bonus = 5;
    }

    return {
      isCorrect: true,
      scoreDelta: 8 + bonus,
      patienceDelta: 5,
    };
  }

  private static getRecommendedAmount(severity: ScratchSeverity): number {
    switch (severity) {
      case 'light':
        return 3;
      case 'medium':
        return 5;
      case 'deep':
        return 8;
    }
  }

  private static calculateExpectedQuality(noises: Noise[]): number {
    if (noises.length === 0) return 95;

    const totalAmplitude = noises.reduce((sum, n) => sum + n.amplitude, 0);
    const avgAmplitude = totalAmplitude / noises.length;

    const baseScore = 100;
    const noisePenalty = avgAmplitude * 0.5;
    const countPenalty = noises.length * 3;

    return Math.max(30, Math.min(95, baseScore - noisePenalty - countPenalty));
  }

  static calculateFinalScore(
    baseQuality: number,
    errorTracking: { scratchMisjudgment: number; overCleaning: number; missingListeningRecord: number },
    totalSteps: number
  ): number {
    const errorPenalty =
      errorTracking.scratchMisjudgment * 12 +
      errorTracking.overCleaning * 15 +
      errorTracking.missingListeningRecord * 20;

    const stepBonus = totalSteps * 2;

    return Math.max(0, Math.min(100, baseQuality - errorPenalty + stepBonus));
  }
}

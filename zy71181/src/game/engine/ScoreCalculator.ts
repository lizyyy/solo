import { InjurySeverity, EquipmentType, DispatchRecord } from '../types';
import { INJURY_SCORES, EQUIPMENT_MATCH_BONUS, DETERIORATION_PENALTY, RESCUE_FAILURE_PENALTY } from '../data/constants';
import { getRequiredEquipment } from '../data/equipment';

export class ScoreCalculator {
  static calculateRescueScore(
    injury: InjurySeverity,
    timeRemaining: number,
    maxTime: number,
    equipmentUsed: EquipmentType[],
    deteriorated: boolean
  ): number {
    let score = 0;

    score += INJURY_SCORES[injury];

    const timeRatio = timeRemaining / maxTime;
    const speedBonus = Math.floor(timeRatio * 100);
    score += speedBonus;

    const requiredEquipment = getRequiredEquipment(injury);
    const hasAllRequired = requiredEquipment.every(req =>
      equipmentUsed.some(used => used === req.type)
    );
    if (hasAllRequired && requiredEquipment.length > 0) {
      score += EQUIPMENT_MATCH_BONUS;
    }

    if (deteriorated) {
      score -= DETERIORATION_PENALTY;
    }

    return Math.max(0, score);
  }

  static calculateRescueFailurePenalty(): number {
    return -RESCUE_FAILURE_PENALTY;
  }

  static calculateDeteriorationPenalty(): number {
    return -DETERIORATION_PENALTY;
  }

  static getFinalRating(score: number, totalVictims: number): 'S' | 'A' | 'B' | 'C' | 'D' {
    const maxPossibleScore = totalVictims * 650;
    const ratio = score / maxPossibleScore;

    if (ratio >= 0.9) return 'S';
    if (ratio >= 0.75) return 'A';
    if (ratio >= 0.6) return 'B';
    if (ratio >= 0.4) return 'C';
    return 'D';
  }

  static getScoreBreakdown(records: DispatchRecord[]): {
    baseRescue: number;
    speedBonus: number;
    equipmentBonus: number;
    deteriorationPenalty: number;
    failurePenalty: number;
  } {
    let baseRescue = 0;
    let speedBonus = 0;
    let equipmentBonus = 0;
    let deteriorationPenalty = 0;
    let failurePenalty = 0;

    records.forEach(record => {
      if (record.success) {
        baseRescue += 200;
        speedBonus += Math.floor(record.estimatedTime / record.actualTime! * 50);
        equipmentBonus += record.equipment.length > 0 ? EQUIPMENT_MATCH_BONUS : 0;
      } else {
        failurePenalty += RESCUE_FAILURE_PENALTY;
      }
    });

    return { baseRescue, speedBonus, equipmentBonus, deteriorationPenalty, failurePenalty };
  }
}

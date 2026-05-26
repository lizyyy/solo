import { ScoreBreakdown, Truck, TurnAction } from '../types/game';

export class ScoreCalculator {
  static BASE_SCORE_PER_TURN = 100;
  static EFFICIENCY_BONUS_PER_UNIT = 2;
  static CAPACITY_BONUS_MULTIPLIER = 50;
  static OVERFLOW_PENALTY = 200;
  static COMPLAINT_PENALTY = 150;
  static TURN_BONUS_PER_REMAINING = 300;

  static calculateTurnScore(
    totalDistance: number,
    maxDistance: number,
    collectedOil: number,
    truckCapacity: number,
    overflowCount: number,
    complaintsThisTurn: number,
    eventBonus: number = 0
  ): number {
    const baseScore = this.BASE_SCORE_PER_TURN;
    const remainingDistance = Math.max(0, maxDistance - totalDistance);
    const efficiencyBonus = remainingDistance * this.EFFICIENCY_BONUS_PER_UNIT;
    const capacityUtilization = collectedOil > 0 ? collectedOil / truckCapacity : 0;
    const capacityBonus = Math.round(capacityUtilization * this.CAPACITY_BONUS_MULTIPLIER);
    const overflowPenalty = overflowCount * this.OVERFLOW_PENALTY;
    const complaintPenalty = complaintsThisTurn * this.COMPLAINT_PENALTY;

    return (
      baseScore +
      efficiencyBonus +
      capacityBonus -
      overflowPenalty -
      complaintPenalty +
      eventBonus
    );
  }

  static calculateFinalScore(
    turnHistory: TurnAction[],
    maxTurns: number,
    isWin: boolean
  ): ScoreBreakdown {
    let baseScore = 0;
    let efficiencyBonus = 0;
    let capacityBonus = 0;
    let overflowPenalty = 0;
    let complaintPenalty = 0;

    for (const turn of turnHistory) {
      baseScore += this.BASE_SCORE_PER_TURN;
      
      const turnScoreWithoutBase = turn.scoreThisTurn - this.BASE_SCORE_PER_TURN;
      if (turnScoreWithoutBase > 0) {
        if (turnScoreWithoutBase <= (turn.totalDistance > 0 ? 
            (turn.route.length > 0 ? 100 : 0) : 0)) {
          efficiencyBonus += turnScoreWithoutBase;
        } else {
          capacityBonus += turnScoreWithoutBase;
        }
      }
    }

    const totalOverflowCount = turnHistory.reduce(
      (sum, turn) => sum + turn.restaurantStates.filter(r => r.isOverflowing).length,
      0
    );
    overflowPenalty = totalOverflowCount * this.OVERFLOW_PENALTY;

    const totalComplaints = turnHistory.reduce((sum, turn) => sum + turn.complaints, 0);
    complaintPenalty = totalComplaints * this.COMPLAINT_PENALTY;

    const usedTurns = turnHistory.length;
    const remainingTurns = isWin ? Math.max(0, maxTurns - usedTurns) : 0;
    const turnBonus = remainingTurns * this.TURN_BONUS_PER_REMAINING;

    const total = baseScore + efficiencyBonus + capacityBonus + turnBonus - overflowPenalty - complaintPenalty;

    return {
      baseScore,
      efficiencyBonus,
      capacityBonus,
      overflowPenalty,
      complaintPenalty,
      turnBonus,
      total,
    };
  }

  static calculateTurnScoreBreakdown(
    turn: TurnAction,
    truck: Truck
  ): {
    baseScore: number;
    efficiencyBonus: number;
    capacityBonus: number;
    overflowPenalty: number;
    complaintPenalty: number;
    total: number;
  } {
    const baseScore = this.BASE_SCORE_PER_TURN;
    const remainingDistance = Math.max(0, truck.maxDistancePerTurn - turn.totalDistance);
    const efficiencyBonus = remainingDistance * this.EFFICIENCY_BONUS_PER_UNIT;
    
    const totalCollected = Object.values(turn.collectedOil).reduce((sum, amount) => sum + amount, 0);
    const capacityUtilization = totalCollected > 0 ? totalCollected / truck.capacity : 0;
    const capacityBonus = Math.round(capacityUtilization * this.CAPACITY_BONUS_MULTIPLIER);
    
    const overflowCount = turn.restaurantStates.filter(r => r.isOverflowing).length;
    const overflowPenalty = overflowCount * this.OVERFLOW_PENALTY;
    const complaintPenalty = turn.complaints * this.COMPLAINT_PENALTY;

    const total = baseScore + efficiencyBonus + capacityBonus - overflowPenalty - complaintPenalty;

    return {
      baseScore,
      efficiencyBonus,
      capacityBonus,
      overflowPenalty,
      complaintPenalty,
      total,
    };
  }
}

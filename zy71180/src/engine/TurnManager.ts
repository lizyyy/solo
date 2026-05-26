import { Restaurant, Level } from '../types/game';

export class TurnManager {
  private complaints: { current: number };

  constructor(complaints: { current: number }) {
    this.complaints = complaints;
  }

  incrementOil(restaurants: Restaurant[]): Restaurant[] {
    for (const restaurant of restaurants) {
      restaurant.currentOil += restaurant.oilPerTurn;
    }

    const overflowing = this.checkOverflow(restaurants);
    this.complaints.current += overflowing.length;

    return overflowing;
  }

  checkOverflow(restaurants: Restaurant[]): Restaurant[] {
    return restaurants.filter(
      (restaurant) => restaurant.currentOil > restaurant.barrelCapacity
    );
  }

  checkVictory(restaurants: Restaurant[]): boolean {
    return restaurants.every((restaurant) => restaurant.currentOil === 0);
  }

  checkGameOver(currentTurn: number, level: Level): boolean {
    return (
      this.complaints.current >= level.maxComplaints ||
      currentTurn >= level.maxTurns
    );
  }

  getFailureReason(currentTurn: number, level: Level): string {
    if (this.complaints.current >= level.maxComplaints) {
      return `投诉次数已达上限 (${this.complaints.current}/${level.maxComplaints})，居民不满情绪过高，游戏结束。`;
    }
    if (currentTurn >= level.maxTurns) {
      return `回合数已用尽 (${currentTurn}/${level.maxTurns})，未能在规定时间内完成回收任务。`;
    }
    return '游戏结束。';
  }
}

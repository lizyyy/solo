import { Tide } from '../types';

export class TideSystem {
  static calculateCurrentLevel(tide: Tide, currentTime: number): number {
    const { minLevel, maxLevel, cycleTime, nextHighTime } = tide;
    const midLevel = (minLevel + maxLevel) / 2;
    const amplitude = (maxLevel - minLevel) / 2;
    const phase = ((currentTime - nextHighTime) / cycleTime) * 2 * Math.PI;
    return midLevel + amplitude * Math.cos(phase);
  }

  static updateTide(tide: Tide, currentTime: number): Tide {
    const currentLevel = this.calculateCurrentLevel(tide, currentTime);
    let { nextHighTime, nextLowTime, cycleTime } = tide;
    while (nextHighTime < currentTime) {
      nextHighTime += cycleTime;
    }
    while (nextLowTime < currentTime) {
      nextLowTime += cycleTime;
    }
    if (Math.abs(nextHighTime - nextLowTime) < cycleTime / 2) {
      if (nextHighTime < nextLowTime) {
        nextLowTime = nextHighTime + cycleTime / 2;
      } else {
        nextHighTime = nextLowTime + cycleTime / 2;
      }
    }
    return {
      ...tide,
      currentLevel,
      nextHighTime,
      nextLowTime,
    };
  }

  static canNavigate(tide: Tide, draft: number): boolean {
    return tide.currentLevel >= draft;
  }

  static getTideWindowStatus(
    tide: Tide,
    draft: number,
    currentTime: number
  ): {
    canNav: boolean;
    timeToNextWindow: number;
    windowDuration: number;
  } {
    const canNav = this.canNavigate(tide, draft);
    const midLevel = (tide.minLevel + tide.maxLevel) / 2;
    const amplitude = (tide.maxLevel - tide.minLevel) / 2;
    const criticalLevel = draft - midLevel;
    if (Math.abs(criticalLevel) > amplitude) {
      return {
        canNav,
        timeToNextWindow: Infinity,
        windowDuration: 0,
      };
    }
    const halfCycle = tide.cycleTime / 2;
    const angleOffset = Math.acos(criticalLevel / amplitude);
    const windowDuration = (2 * angleOffset / (2 * Math.PI)) * tide.cycleTime;
    let timeToNextWindow = 0;
    if (!canNav) {
      const timeSinceHigh = (currentTime - tide.nextHighTime + tide.cycleTime) % tide.cycleTime;
      if (timeSinceHigh < halfCycle) {
        timeToNextWindow = halfCycle - timeSinceHigh - windowDuration / 2;
      } else {
        timeToNextWindow = tide.cycleTime - timeSinceHigh - windowDuration / 2;
      }
      timeToNextWindow = Math.max(0, timeToNextWindow);
    }
    return {
      canNav,
      timeToNextWindow,
      windowDuration,
    };
  }
}

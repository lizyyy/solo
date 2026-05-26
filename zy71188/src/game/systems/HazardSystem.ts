import type { Hazard, HazardType, LevelConfig, Shelf, Position } from '../types';
import { HAZARD_DESCRIPTIONS } from '../data/levels';

export class HazardSystem {
  private tileSize = 40;

  generateHazards(config: LevelConfig, shelves: Shelf[], mapWidth: number, mapHeight: number): Hazard[] {
    const hazards: Hazard[] = [];
    const hazardTypes: HazardType[] = ['blocked_path', 'expired_extinguisher', 'illegal_charging'];
    const normalTypes: HazardType[] = ['normal_extinguisher', 'normal_charging'];

    for (let i = 0; i < config.hazardCount; i++) {
      const type = hazardTypes[i % hazardTypes.length];
      const hazard = this.createHazard(type, i, shelves, mapWidth, mapHeight, hazards);
      if (hazard) hazards.push(hazard);
    }

    for (let i = 0; i < config.normalItemCount; i++) {
      const type = normalTypes[i % normalTypes.length];
      const hazard = this.createHazard(type, i + 100, shelves, mapWidth, mapHeight, hazards);
      if (hazard) hazards.push(hazard);
    }

    return hazards;
  }

  private createHazard(
    type: HazardType,
    index: number,
    shelves: Shelf[],
    mapWidth: number,
    mapHeight: number,
    existingHazards: Hazard[]
  ): Hazard | null {
    const info = HAZARD_DESCRIPTIONS[type];
    let attempts = 0;
    const maxAttempts = 100;

    while (attempts < maxAttempts) {
      attempts++;
      const size = type.includes('path') ? this.tileSize : 30;
      const x = Math.floor(Math.random() * (mapWidth - 4) + 2) * this.tileSize + 5;
      const y = Math.floor(Math.random() * (mapHeight - 4) + 2) * this.tileSize + 5;

      let overlaps = false;
      const newRect = { x, y, width: size, height: size };

      for (const shelf of shelves) {
        if (this.rectsOverlap(newRect, shelf, 5)) {
          overlaps = true;
          break;
        }
      }

      if (!overlaps) {
        for (const h of existingHazards) {
          if (this.rectsOverlap(newRect, h, 20)) {
            overlaps = true;
            break;
          }
        }
      }

      if (!overlaps) {
        return {
          id: `hazard-${index}-${Date.now()}`,
          type,
          x,
          y,
          width: size,
          height: size,
          isHazard: info.hazard,
          description: info.name,
          detected: false,
          marked: false
        };
      }
    }

    return null;
  }

  private rectsOverlap(
    r1: { x: number; y: number; width: number; height: number },
    r2: { x: number; y: number; width: number; height: number },
    padding: number
  ): boolean {
    return !(
      r1.x + r1.width + padding < r2.x ||
      r2.x + r2.width + padding < r1.x ||
      r1.y + r1.height + padding < r2.y ||
      r2.y + r2.height + padding < r1.y
    );
  }

  checkNearbyHazard(
    playerX: number,
    playerY: number,
    hazards: Hazard[],
    range: number = 60
  ): Hazard | null {
    for (const hazard of hazards) {
      const centerX = hazard.x + hazard.width / 2;
      const centerY = hazard.y + hazard.height / 2;
      const distance = Math.sqrt(
        Math.pow(playerX - centerX, 2) + Math.pow(playerY - centerY, 2)
      );

      if (distance < range && !hazard.marked) {
        return hazard;
      }
    }
    return null;
  }

  markHazard(hazard: Hazard): { isCorrect: boolean; isDuplicate: boolean } {
    if (hazard.marked) {
      return { isCorrect: false, isDuplicate: true };
    }
    return { isCorrect: hazard.isHazard, isDuplicate: false };
  }

  getHazardStats(hazards: Hazard[]): { total: number; found: number; missed: number; wrong: number } {
    const realHazards = hazards.filter(h => h.isHazard);
    const found = realHazards.filter(h => h.marked && h.markCorrect).length;
    const wrong = hazards.filter(h => h.marked && !h.markCorrect).length;

    return {
      total: realHazards.length,
      found,
      missed: realHazards.length - found,
      wrong
    };
  }
}

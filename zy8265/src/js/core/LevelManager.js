import { Grid } from './Grid.js';
import { Player } from '../entities/Player.js';
import { Box } from '../entities/Box.js';
import { Elevator } from '../entities/Elevator.js';

export class LevelManager {
  constructor() {
    this.levels = [];
    this.currentLevelIndex = 0;
  }

  registerLevel(levelConfig) {
    this.levels.push(levelConfig);
  }

  registerLevels(levelConfigs) {
    levelConfigs.forEach(config => this.registerLevel(config));
  }

  getLevelCount() {
    return this.levels.length;
  }

  getCurrentLevel() {
    return this.levels[this.currentLevelIndex];
  }

  getCurrentLevelIndex() {
    return this.currentLevelIndex;
  }

  getLevel(index) {
    return this.levels[index];
  }

  setCurrentLevel(index) {
    if (index >= 0 && index < this.levels.length) {
      this.currentLevelIndex = index;
      return true;
    }
    return false;
  }

  nextLevel() {
    if (this.currentLevelIndex < this.levels.length - 1) {
      this.currentLevelIndex++;
      return true;
    }
    return false;
  }

  previousLevel() {
    if (this.currentLevelIndex > 0) {
      this.currentLevelIndex--;
      return true;
    }
    return false;
  }

  buildLevel(levelConfig) {
    const grid = new Grid(levelConfig.width, levelConfig.height);
    const player = new Player(levelConfig.player.x, levelConfig.player.y);
    const boxes = levelConfig.boxes.map(box => 
      new Box(box.x, box.y, box.weight || 1)
    );
    const elevators = levelConfig.elevators ? levelConfig.elevators.map(elevator =>
      new Elevator(elevator.x, elevator.y, elevator.maxCapacity || 2, elevator.floors || [1])
    ) : [];

    if (levelConfig.walls) {
      levelConfig.walls.forEach(pos => {
        grid.setCell(pos.x, pos.y, { wall: true });
      });
    }

    if (levelConfig.humidityAreas) {
      levelConfig.humidityAreas.forEach(pos => {
        grid.setCell(pos.x, pos.y, { humidity: true });
      });
    }

    if (levelConfig.patrolPaths) {
      levelConfig.patrolPaths.forEach(pos => {
        grid.setCell(pos.x, pos.y, { patrolPath: true });
      });
    }

    if (levelConfig.storagePositions) {
      levelConfig.storagePositions.forEach(pos => {
        grid.setCell(pos.x, pos.y, { storage: true });
      });
    }

    if (levelConfig.elevators) {
      levelConfig.elevators.forEach(elevator => {
        grid.setCell(elevator.x, elevator.y, { elevator: true });
      });
    }

    return {
      grid,
      player,
      boxes,
      elevators,
      config: levelConfig
    };
  }

  buildCurrentLevel() {
    return this.buildLevel(this.getCurrentLevel());
  }
}

import type { GameMap, MapTile, Shelf, LevelConfig } from '../types';

export class MapSystem {
  private tileSize = 40;

  generateMap(config: LevelConfig): GameMap {
    const { width, height } = config.mapSize;
    const tiles: MapTile[] = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let type: MapTile['type'] = 'floor';
        if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
          type = 'wall';
        }
        if (x === width - 1 && y === Math.floor(height / 2)) {
          type = 'fire_exit';
        }
        tiles.push({ x, y, type });
      }
    }

    const shelves = this.generateShelves(config);

    return {
      width,
      height,
      tileSize: this.tileSize,
      tiles,
      shelves
    };
  }

  private generateShelves(config: LevelConfig): Shelf[] {
    const shelves: Shelf[] = [];
    const { width, height } = config.mapSize;
    const margin = 3;
    const maxAttempts = 100;
    let attempts = 0;

    while (shelves.length < config.shelfCount && attempts < maxAttempts) {
      attempts++;
      const isHorizontal = Math.random() > 0.5;
      const shelfWidth = isHorizontal ? (Math.floor(Math.random() * 3) + 2) : 1;
      const shelfHeight = isHorizontal ? 1 : (Math.floor(Math.random() * 3) + 2);
      const x = Math.floor(Math.random() * (width - shelfWidth - margin * 2)) + margin;
      const y = Math.floor(Math.random() * (height - shelfHeight - margin * 2)) + margin;

      const newShelf: Shelf = {
        x: x * this.tileSize,
        y: y * this.tileSize,
        width: shelfWidth * this.tileSize,
        height: shelfHeight * this.tileSize
      };

      let overlaps = false;
      for (const shelf of shelves) {
        if (this.rectsOverlap(newShelf, shelf, this.tileSize)) {
          overlaps = true;
          break;
        }
      }

      if (!overlaps) {
        shelves.push(newShelf);
      }
    }

    return shelves;
  }

  private rectsOverlap(r1: Shelf, r2: Shelf, padding: number): boolean {
    return !(
      r1.x + r1.width + padding < r2.x ||
      r2.x + r2.width + padding < r1.x ||
      r1.y + r1.height + padding < r2.y ||
      r2.y + r2.height + padding < r1.y
    );
  }

  isWalkable(x: number, y: number, width: number, height: number, shelves: Shelf[], mapWidth: number, mapHeight: number): boolean {
    if (x < this.tileSize || y < this.tileSize ||
        x + width > (mapWidth - 1) * this.tileSize ||
        y + height > (mapHeight - 1) * this.tileSize) {
      return false;
    }

    for (const shelf of shelves) {
      if (this.rectsOverlap(
        { x, y, width, height },
        shelf,
        0
      )) {
        return false;
      }
    }

    return true;
  }

  getTileSize(): number {
    return this.tileSize;
  }

  findValidPosition(
    shelves: Shelf[],
    mapWidth: number,
    mapHeight: number,
    size: number = 30
  ): { x: number; y: number } {
    let attempts = 0;
    const maxAttempts = 200;

    while (attempts < maxAttempts) {
      attempts++;
      const x = Math.floor(Math.random() * (mapWidth - 4) + 2) * this.tileSize + 5;
      const y = Math.floor(Math.random() * (mapHeight - 4) + 2) * this.tileSize + 5;

      if (this.isWalkable(x, y, size, size, shelves, mapWidth, mapHeight)) {
        return { x, y };
      }
    }

    return { x: this.tileSize * 2, y: this.tileSize * 2 };
  }
}

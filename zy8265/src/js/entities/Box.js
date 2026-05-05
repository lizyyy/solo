import { Entity } from './Entity.js';

export class Box extends Entity {
  constructor(x, y, weight = 1) {
    super(x, y, 'box');
    this.weight = weight;
    this.inStorage = false;
    this.inElevator = false;
  }

  isStuck(grid, otherBoxes) {
    const directions = [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 }
    ];

    const blockedSides = directions.filter(dir => {
      const nextX = this.x + dir.dx;
      const nextY = this.y + dir.dy;

      if (!grid.isValidPosition(nextX, nextY)) return true;
      if (grid.isWall(nextX, nextY)) return true;
      
      const hasBoxAtPos = otherBoxes.some(box => 
        box.id !== this.id && box.x === nextX && box.y === nextY
      );
      
      return hasBoxAtPos;
    });

    return blockedSides.length >= 2;
  }

  isInCorner(grid) {
    const isLeftBlocked = grid.isWall(this.x - 1, this.y);
    const isRightBlocked = grid.isWall(this.x + 1, this.y);
    const isUpBlocked = grid.isWall(this.x, this.y - 1);
    const isDownBlocked = grid.isWall(this.x, this.y + 1);

    return (isLeftBlocked || isRightBlocked) && (isUpBlocked || isDownBlocked);
  }
}

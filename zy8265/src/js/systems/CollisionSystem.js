export class CollisionSystem {
  constructor(grid, boxes, elevators = []) {
    this.grid = grid;
    this.boxes = boxes;
    this.elevators = elevators;
  }

  canMoveTo(x, y, excludeEntity = null) {
    if (!this.grid.isValidPosition(x, y)) return false;
    if (this.grid.isWall(x, y)) return false;

    const hasBox = this.boxes.some(box => 
      box.id !== excludeEntity?.id && box.x === x && box.y === y
    );
    if (hasBox) return false;

    return true;
  }

  getBoxAtPosition(x, y) {
    return this.boxes.find(box => box.x === x && box.y === y);
  }

  getElevatorAtPosition(x, y) {
    return this.elevators.find(elevator => elevator.x === x && elevator.y === y);
  }

  canPushBox(box, dx, dy) {
    const newX = box.x + dx;
    const newY = box.y + dy;

    if (!this.grid.isValidPosition(newX, newY)) return false;
    if (this.grid.isWall(newX, newY)) return false;

    const hasBoxAtNewPos = this.boxes.some(b => 
      b.id !== box.id && b.x === newX && b.y === newY
    );
    if (hasBoxAtNewPos) return false;

    return true;
  }

  isPositionBlocked(x, y) {
    return !this.canMoveTo(x, y);
  }

  checkBoxStuck(box) {
    const directions = [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 }
    ];

    const blockedDirections = directions.filter(dir => {
      const nextX = box.x + dir.dx;
      const nextY = box.y + dir.dy;

      if (!this.grid.isValidPosition(nextX, nextY)) return true;
      if (this.grid.isWall(nextX, nextY)) return true;
      
      const hasBox = this.boxes.some(b => 
        b.id !== box.id && b.x === nextX && b.y === nextY
      );
      return hasBox;
    });

    if (blockedDirections.length >= 2) {
      return {
        stuck: true,
        inCorner: this.isInCorner(box),
        blockedDirections: blockedDirections.length
      };
    }

    return { stuck: false };
  }

  isInCorner(box) {
    const isLeftBlocked = !this.canMoveTo(box.x - 1, box.y);
    const isRightBlocked = !this.canMoveTo(box.x + 1, box.y);
    const isUpBlocked = !this.canMoveTo(box.x, box.y - 1);
    const isDownBlocked = !this.canMoveTo(box.x, box.y + 1);

    return (isLeftBlocked || isRightBlocked) && (isUpBlocked || isDownBlocked);
  }
}

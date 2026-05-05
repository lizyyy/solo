export class Grid {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.cells = this.createEmptyGrid();
  }

  createEmptyGrid() {
    const grid = [];
    for (let y = 0; y < this.height; y++) {
      grid[y] = [];
      for (let x = 0; x < this.width; x++) {
        grid[y][x] = {
          type: 'floor',
          humidity: false,
          patrolPath: false,
          storage: false,
          elevator: false,
          wall: false
        };
      }
    }
    return grid;
  }

  isValidPosition(x, y) {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  getCell(x, y) {
    if (!this.isValidPosition(x, y)) return null;
    return this.cells[y][x];
  }

  setCell(x, y, properties) {
    if (!this.isValidPosition(x, y)) return;
    Object.assign(this.cells[y][x], properties);
  }

  isWall(x, y) {
    const cell = this.getCell(x, y);
    return cell ? cell.wall : true;
  }

  isHumidity(x, y) {
    const cell = this.getCell(x, y);
    return cell ? cell.humidity : false;
  }

  isPatrolPath(x, y) {
    const cell = this.getCell(x, y);
    return cell ? cell.patrolPath : false;
  }

  isStorage(x, y) {
    const cell = this.getCell(x, y);
    return cell ? cell.storage : false;
  }

  isElevator(x, y) {
    const cell = this.getCell(x, y);
    return cell ? cell.elevator : false;
  }
}

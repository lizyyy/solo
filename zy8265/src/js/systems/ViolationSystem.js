export const ViolationTypes = {
  HUMIDITY: 'humidity',
  PATROL: 'patrol',
  BOX_STUCK: 'box_stuck',
  ELEVATOR_OVERLOAD: 'elevator_overload',
  WALL_COLLISION: 'wall_collision'
};

export class ViolationSystem {
  constructor(grid, boxes, elevators = []) {
    this.grid = grid;
    this.boxes = boxes;
    this.elevators = elevators;
    this.violations = [];
  }

  checkPlayerPosition(player) {
    const violations = [];

    if (this.grid.isHumidity(player.x, player.y)) {
      violations.push({
        type: ViolationTypes.HUMIDITY,
        message: '搬运员进入了湿度超标区域！',
        position: { x: player.x, y: player.y },
        penalty: 50
      });
    }

    if (this.grid.isPatrolPath(player.x, player.y)) {
      violations.push({
        type: ViolationTypes.PATROL,
        message: '搬运员进入了巡检路线！',
        position: { x: player.x, y: player.y },
        penalty: 100
      });
    }

    return violations;
  }

  checkBoxPosition(box) {
    const violations = [];

    if (this.grid.isHumidity(box.x, box.y)) {
      violations.push({
        type: ViolationTypes.HUMIDITY,
        message: '文物箱被推到湿度超标区域！',
        position: { x: box.x, y: box.y },
        boxId: box.id,
        penalty: 200
      });
    }

    if (this.grid.isPatrolPath(box.x, box.y)) {
      violations.push({
        type: ViolationTypes.PATROL,
        message: '文物箱被推到巡检路线！',
        position: { x: box.x, y: box.y },
        boxId: box.id,
        penalty: 150
      });
    }

    return violations;
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
      const isInCorner = (
        (!this.grid.isValidPosition(box.x - 1, box.y) || this.grid.isWall(box.x - 1, box.y) || this.boxes.some(b => b.id !== box.id && b.x === box.x - 1 && b.y === box.y)) ||
        (!this.grid.isValidPosition(box.x + 1, box.y) || this.grid.isWall(box.x + 1, box.y) || this.boxes.some(b => b.id !== box.id && b.x === box.x + 1 && b.y === box.y))
      ) && (
        (!this.grid.isValidPosition(box.x, box.y - 1) || this.grid.isWall(box.x, box.y - 1) || this.boxes.some(b => b.id !== box.id && b.x === box.x && b.y === box.y - 1)) ||
        (!this.grid.isValidPosition(box.x, box.y + 1) || this.grid.isWall(box.x, box.y + 1) || this.boxes.some(b => b.id !== box.id && b.x === box.x && b.y === box.y + 1))
      );

      return {
        type: ViolationTypes.BOX_STUCK,
        message: isInCorner ? '文物箱被推到死角无法移动！' : '文物箱被卡住无法移动！',
        position: { x: box.x, y: box.y },
        boxId: box.id,
        inCorner: isInCorner,
        penalty: 300,
        gameOver: true
      };
    }

    return null;
  }

  checkElevatorLoad(elevator) {
    if (elevator.isOverweight()) {
      return {
        type: ViolationTypes.ELEVATOR_OVERLOAD,
        message: `电梯载重超限！当前: ${elevator.currentCapacity}, 最大: ${elevator.maxCapacity}`,
        elevatorId: elevator.id,
        currentLoad: elevator.currentCapacity,
        maxCapacity: elevator.maxCapacity,
        penalty: 250,
        gameOver: true
      };
    }
    return null;
  }

  checkAllViolations(player) {
    const allViolations = [];

    allViolations.push(...this.checkPlayerPosition(player));

    this.boxes.forEach(box => {
      allViolations.push(...this.checkBoxPosition(box));
      
      const stuckViolation = this.checkBoxStuck(box);
      if (stuckViolation) {
        allViolations.push(stuckViolation);
      }
    });

    this.elevators.forEach(elevator => {
      const overloadViolation = this.checkElevatorLoad(elevator);
      if (overloadViolation) {
        allViolations.push(overloadViolation);
      }
    });

    return allViolations;
  }

  recordViolation(violation) {
    this.violations.push({
      ...violation,
      timestamp: Date.now()
    });
  }

  getViolations() {
    return [...this.violations];
  }

  clearViolations() {
    this.violations = [];
  }

  getTotalPenalty() {
    return this.violations.reduce((sum, v) => sum + (v.penalty || 0), 0);
  }

  hasGameOverViolation() {
    return this.violations.some(v => v.gameOver);
  }

  getViolationsByType(type) {
    return this.violations.filter(v => v.type === type);
  }
}

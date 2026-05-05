import { CollisionSystem } from './CollisionSystem.js';

export class MovementSystem {
  constructor(grid, player, boxes, elevators = []) {
    this.grid = grid;
    this.player = player;
    this.boxes = boxes;
    this.elevators = elevators;
    this.collisionSystem = new CollisionSystem(grid, boxes, elevators);
    this.moveHistory = [];
  }

  movePlayer(dx, dy) {
    if (!this.player) return { success: false, reason: 'no_player' };

    this.player.setDirection(dx, dy);

    const newX = this.player.x + dx;
    const newY = this.player.y + dy;

    const boxAtNewPos = this.collisionSystem.getBoxAtPosition(newX, newY);

    if (boxAtNewPos) {
      const pushResult = this.tryPushBox(boxAtNewPos, dx, dy);
      if (pushResult.success) {
        const previousPos = { 
          player: { x: this.player.x, y: this.player.y },
          boxes: this.boxes.map(b => ({ x: b.x, y: b.y, id: b.id }))
        };
        
        this.player.move(dx, dy);
        
        this.recordMove({
          type: 'push',
          direction: { dx, dy },
          previousPos,
          boxId: boxAtNewPos.id
        });
        
        return { success: true, type: 'push', box: boxAtNewPos };
      }
      return { success: false, reason: pushResult.reason };
    }

    if (this.collisionSystem.canMoveTo(newX, newY, this.player)) {
      const previousPos = { 
        player: { x: this.player.x, y: this.player.y },
        boxes: this.boxes.map(b => ({ x: b.x, y: b.y, id: b.id }))
      };
      
      this.player.move(dx, dy);
      
      this.recordMove({
        type: 'move',
        direction: { dx, dy },
        previousPos
      });
      
      return { success: true, type: 'move' };
    }

    return { success: false, reason: 'blocked' };
  }

  tryPushBox(box, dx, dy) {
    const boxNewX = box.x + dx;
    const boxNewY = box.y + dy;

    const elevatorAtNewPos = this.collisionSystem.getElevatorAtPosition(boxNewX, boxNewY);
    if (elevatorAtNewPos) {
      if (!elevatorAtNewPos.canAddWeight(box.weight)) {
        return { success: false, reason: 'elevator_full' };
      }
      elevatorAtNewPos.addBox(box);
    }

    const elevatorAtCurrentPos = this.collisionSystem.getElevatorAtPosition(box.x, box.y);
    if (elevatorAtCurrentPos && !elevatorAtNewPos) {
      elevatorAtCurrentPos.removeBox(box);
    }

    if (this.collisionSystem.canPushBox(box, dx, dy)) {
      box.move(dx, dy);

      if (this.grid.isStorage(box.x, box.y)) {
        box.inStorage = true;
      }

      return { success: true };
    }

    return { success: false, reason: 'box_blocked' };
  }

  recordMove(moveData) {
    this.moveHistory.push({
      ...moveData,
      timestamp: Date.now(),
      step: this.moveHistory.length + 1
    });
  }

  getMoveHistory() {
    return [...this.moveHistory];
  }

  clearHistory() {
    this.moveHistory = [];
  }

  getLastMove() {
    if (this.moveHistory.length === 0) return null;
    return this.moveHistory[this.moveHistory.length - 1];
  }

  getMoveCount() {
    return this.moveHistory.length;
  }

  getPushCount() {
    return this.moveHistory.filter(m => m.type === 'push').length;
  }
}

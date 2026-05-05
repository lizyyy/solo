import { Entity } from './Entity.js';

export class Player extends Entity {
  constructor(x, y) {
    super(x, y, 'player');
    this.floor = 1;
    this.direction = 'down';
  }

  setDirection(dx, dy) {
    if (dx > 0) this.direction = 'right';
    else if (dx < 0) this.direction = 'left';
    else if (dy > 0) this.direction = 'down';
    else if (dy < 0) this.direction = 'up';
  }
}

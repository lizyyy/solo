export class Entity {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.id = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  move(dx, dy) {
    this.x += dx;
    this.y += dy;
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }

  getPosition() {
    return { x: this.x, y: this.y };
  }
}

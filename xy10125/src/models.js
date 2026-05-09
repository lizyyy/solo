let idCounter = 1;

export class ParkingSpot {
  constructor(x, y, width = 2.5, length = 5.0, angle = 0) {
    this.id = idCounter++;
    this.type = 'parking';
    this.x = x;
    this.y = y;
    this.width = width;
    this.length = length;
    this.angle = angle;
    this.label = `P${this.id}`;
  }

  getBounds() {
    return {
      x: this.x,
      y: this.y,
      width: this.width,
      length: this.length,
      angle: this.angle
    };
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      x: this.x,
      y: this.y,
      width: this.width,
      length: this.length,
      angle: this.angle,
      label: this.label
    };
  }

  static fromJSON(data) {
    const spot = new ParkingSpot(data.x, data.y, data.width, data.length, data.angle);
    spot.id = data.id;
    spot.label = data.label;
    if (data.id >= idCounter) idCounter = data.id + 1;
    return spot;
  }
}

export class FireLane {
  constructor(x, y, width = 4, length = 10) {
    this.id = idCounter++;
    this.type = 'fireLane';
    this.x = x;
    this.y = y;
    this.width = width;
    this.length = length;
    this.label = `F${this.id}`;
  }

  getBounds() {
    return {
      x: this.x,
      y: this.y,
      width: this.width,
      length: this.length,
      angle: 0
    };
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      x: this.x,
      y: this.y,
      width: this.width,
      length: this.length,
      label: this.label
    };
  }

  static fromJSON(data) {
    const lane = new FireLane(data.x, data.y, data.width, data.length);
    lane.id = data.id;
    lane.label = data.label;
    if (data.id >= idCounter) idCounter = data.id + 1;
    return lane;
  }
}

export class TurningRadius {
  constructor(x, y, radius = 6) {
    this.id = idCounter++;
    this.type = 'turningRadius';
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.label = `T${this.id}`;
  }

  getBounds() {
    return {
      x: this.x - this.radius,
      y: this.y - this.radius,
      width: this.radius * 2,
      length: this.radius * 2,
      angle: 0
    };
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      x: this.x,
      y: this.y,
      radius: this.radius,
      label: this.label
    };
  }

  static fromJSON(data) {
    const tr = new TurningRadius(data.x, data.y, data.radius);
    tr.id = data.id;
    tr.label = data.label;
    if (data.id >= idCounter) idCounter = data.id + 1;
    return tr;
  }
}

export class Obstacle {
  constructor(x, y, width = 2, length = 2) {
    this.id = idCounter++;
    this.type = 'obstacle';
    this.x = x;
    this.y = y;
    this.width = width;
    this.length = length;
    this.label = `O${this.id}`;
  }

  getBounds() {
    return {
      x: this.x,
      y: this.y,
      width: this.width,
      length: this.length,
      angle: 0
    };
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      x: this.x,
      y: this.y,
      width: this.width,
      length: this.length,
      label: this.label
    };
  }

  static fromJSON(data) {
    const obs = new Obstacle(data.x, data.y, data.width, data.length);
    obs.id = data.id;
    obs.label = data.label;
    if (data.id >= idCounter) idCounter = data.id + 1;
    return obs;
  }
}

export function createFromJSON(data) {
  switch (data.type) {
    case 'parking':
      return ParkingSpot.fromJSON(data);
    case 'fireLane':
      return FireLane.fromJSON(data);
    case 'turningRadius':
      return TurningRadius.fromJSON(data);
    case 'obstacle':
      return Obstacle.fromJSON(data);
    default:
      return null;
  }
}

export function resetIdCounter() {
  idCounter = 1;
}

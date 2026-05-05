import { Entity } from './Entity.js';

export class Elevator extends Entity {
  constructor(x, y, maxCapacity = 2, floors = [1, 2]) {
    super(x, y, 'elevator');
    this.maxCapacity = maxCapacity;
    this.currentCapacity = 0;
    this.currentFloor = 1;
    this.floors = floors;
    this.boxes = [];
  }

  addBox(box) {
    if (this.currentCapacity + box.weight <= this.maxCapacity) {
      this.boxes.push(box);
      this.currentCapacity += box.weight;
      box.inElevator = true;
      return true;
    }
    return false;
  }

  removeBox(box) {
    const index = this.boxes.findIndex(b => b.id === box.id);
    if (index !== -1) {
      this.boxes.splice(index, 1);
      this.currentCapacity -= box.weight;
      box.inElevator = false;
      return true;
    }
    return false;
  }

  isOverweight() {
    return this.currentCapacity > this.maxCapacity;
  }

  moveToFloor(floor) {
    if (this.floors.includes(floor)) {
      this.currentFloor = floor;
      return true;
    }
    return false;
  }

  canAddWeight(weight) {
    return this.currentCapacity + weight <= this.maxCapacity;
  }
}

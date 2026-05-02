class BaseModel {
  constructor(id, name) {
    this.id = id || this.generateId();
    this.name = name || this.constructor.name + '_' + this.id.slice(0, 8);
  }

  generateId() {
    return 'obj_' + Math.random().toString(36).substr(2, 16);
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.constructor.name
    };
  }

  static fromJSON(json) {
    const obj = new this();
    Object.assign(obj, json);
    return obj;
  }
}

class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  add(v) {
    return new Vector3(this.x + v.x, this.y + v.y, this.z + v.z);
  }

  subtract(v) {
    return new Vector3(this.x - v.x, this.y - v.y, this.z - v.z);
  }

  multiply(s) {
    return new Vector3(this.x * s, this.y * s, this.z * s);
  }

  dot(v) {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }

  cross(v) {
    return new Vector3(
      this.y * v.z - this.z * v.y,
      this.z * v.x - this.x * v.z,
      this.x * v.y - this.y * v.x
    );
  }

  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  normalize() {
    const len = this.length();
    if (len === 0) return new Vector3(0, 0, 0);
    return this.multiply(1 / len);
  }

  clone() {
    return new Vector3(this.x, this.y, this.z);
  }

  toArray() {
    return [this.x, this.y, this.z];
  }

  toJSON() {
    return { x: this.x, y: this.y, z: this.z };
  }

  static fromJSON(json) {
    return new Vector3(json.x, json.y, json.z);
  }

  static fromArray(arr) {
    return new Vector3(arr[0], arr[1], arr[2]);
  }
}

class BoundingBox {
  constructor(min = null, max = null) {
    this.min = min || new Vector3(Infinity, Infinity, Infinity);
    this.max = max || new Vector3(-Infinity, -Infinity, -Infinity);
  }

  expandByPoint(point) {
    this.min.x = Math.min(this.min.x, point.x);
    this.min.y = Math.min(this.min.y, point.y);
    this.min.z = Math.min(this.min.z, point.z);
    this.max.x = Math.max(this.max.x, point.x);
    this.max.y = Math.max(this.max.y, point.y);
    this.max.z = Math.max(this.max.z, point.z);
  }

  expandByBox(box) {
    this.expandByPoint(box.min);
    this.expandByPoint(box.max);
  }

  getCenter() {
    return new Vector3(
      (this.min.x + this.max.x) / 2,
      (this.min.y + this.max.y) / 2,
      (this.min.z + this.max.z) / 2
    );
  }

  getSize() {
    return new Vector3(
      this.max.x - this.min.x,
      this.max.y - this.min.y,
      this.max.z - this.min.z
    );
  }

  intersectsBox(box) {
    return (
      this.min.x <= box.max.x && this.max.x >= box.min.x &&
      this.min.y <= box.max.y && this.max.y >= box.min.y &&
      this.min.z <= box.max.z && this.max.z >= box.min.z
    );
  }

  containsPoint(point) {
    return (
      point.x >= this.min.x && point.x <= this.max.x &&
      point.y >= this.min.y && point.y <= this.max.y &&
      point.z >= this.min.z && point.z <= this.max.z
    );
  }

  toJSON() {
    return {
      min: this.min.toJSON(),
      max: this.max.toJSON()
    };
  }

  static fromJSON(json) {
    return new BoundingBox(
      Vector3.fromJSON(json.min),
      Vector3.fromJSON(json.max)
    );
  }
}

class Stage extends BaseModel {
  constructor(id, name) {
    super(id, name);
    this.width = 16;
    this.depth = 12;
    this.height = 0;
    this.position = new Vector3(0, 0, 0);
    this.description = '';
  }

  getBoundingBox() {
    const halfW = this.width / 2;
    const halfD = this.depth / 2;
    return new BoundingBox(
      new Vector3(this.position.x - halfW, this.position.y, this.position.z - halfD),
      new Vector3(this.position.x + halfW, this.position.y + this.height, this.position.z + halfD)
    );
  }

  toJSON() {
    return {
      ...super.toJSON(),
      width: this.width,
      depth: this.depth,
      height: this.height,
      position: this.position.toJSON(),
      description: this.description
    };
  }

  static fromJSON(json) {
    const stage = super.fromJSON(json);
    stage.position = Vector3.fromJSON(json.position);
    return stage;
  }
}

class HangingPoint extends BaseModel {
  constructor(id, name) {
    super(id, name);
    this.position = new Vector3(0, 8, 0);
    this.maxLoad = 500;
    this.currentLoad = 0;
    this.safetyFactor = 5;
    this.motorType = '1t';
    this.connectedTrusses = [];
    this.status = 'ok';
    this.color = '#4a9eff';
  }

  getMaxSafeLoad() {
    return this.maxLoad / this.safetyFactor;
  }

  isOverloaded() {
    return this.currentLoad > this.getMaxSafeLoad();
  }

  getLoadPercentage() {
    return (this.currentLoad / this.getMaxSafeLoad()) * 100;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      position: this.position.toJSON(),
      maxLoad: this.maxLoad,
      currentLoad: this.currentLoad,
      safetyFactor: this.safetyFactor,
      motorType: this.motorType,
      connectedTrusses: [...this.connectedTrusses],
      status: this.status,
      color: this.color
    };
  }

  static fromJSON(json) {
    const point = super.fromJSON(json);
    point.position = Vector3.fromJSON(json.position);
    return point;
  }
}

class Truss extends BaseModel {
  constructor(id, name) {
    super(id, name);
    this.position = new Vector3(0, 7, 0);
    this.rotation = new Vector3(0, 0, 0);
    this.type = 'square';
    this.length = 3;
    this.width = 0.5;
    this.height = 0.5;
    this.weightPerMeter = 15;
    this.devices = [];
    this.hangingPoints = [];
    this.color = '#c0c0c0';
    this.notes = '';
  }

  getTotalWeight() {
    let weight = this.weightPerMeter * this.length;
    for (const deviceId of this.devices) {
      const device = SceneModel.instance?.getDeviceById(deviceId);
      if (device) {
        weight += device.weight;
      }
    }
    return weight;
  }

  getBoundingBox() {
    const halfLen = this.length / 2;
    const halfW = this.width / 2;
    const halfH = this.height / 2;
    
    return new BoundingBox(
      new Vector3(
        this.position.x - halfLen,
        this.position.y - halfH,
        this.position.z - halfW
      ),
      new Vector3(
        this.position.x + halfLen,
        this.position.y + halfH,
        this.position.z + halfW
      )
    );
  }

  toJSON() {
    return {
      ...super.toJSON(),
      position: this.position.toJSON(),
      rotation: this.rotation.toJSON(),
      type: this.type,
      length: this.length,
      width: this.width,
      height: this.height,
      weightPerMeter: this.weightPerMeter,
      devices: [...this.devices],
      hangingPoints: [...this.hangingPoints],
      color: this.color,
      notes: this.notes
    };
  }

  static fromJSON(json) {
    const truss = super.fromJSON(json);
    truss.position = Vector3.fromJSON(json.position);
    truss.rotation = Vector3.fromJSON(json.rotation);
    return truss;
  }
}

class Device extends BaseModel {
  constructor(id, name) {
    super(id, name);
    this.position = new Vector3(0, 0, 0);
    this.rotation = new Vector3(0, 0, 0);
    this.type = 'light';
    this.subType = 'spot';
    this.manufacturer = '';
    this.model = '';
    this.weight = 10;
    this.dimensions = new Vector3(0.3, 0.5, 0.4);
    this.power = 500;
    this.color = '#ffcc00';
    this.status = 'ok';
    this.notes = '';
    this.attachedTrussId = null;
  }

  getBoundingBox() {
    const halfX = this.dimensions.x / 2;
    const halfY = this.dimensions.y / 2;
    const halfZ = this.dimensions.z / 2;
    
    return new BoundingBox(
      new Vector3(
        this.position.x - halfX,
        this.position.y - halfY,
        this.position.z - halfZ
      ),
      new Vector3(
        this.position.x + halfX,
        this.position.y + halfY,
        this.position.z + halfZ
      )
    );
  }

  toJSON() {
    return {
      ...super.toJSON(),
      position: this.position.toJSON(),
      rotation: this.rotation.toJSON(),
      type: this.type,
      subType: this.subType,
      manufacturer: this.manufacturer,
      model: this.model,
      weight: this.weight,
      dimensions: this.dimensions.toJSON(),
      power: this.power,
      color: this.color,
      status: this.status,
      notes: this.notes,
      attachedTrussId: this.attachedTrussId
    };
  }

  static fromJSON(json) {
    const device = super.fromJSON(json);
    device.position = Vector3.fromJSON(json.position);
    device.rotation = Vector3.fromJSON(json.rotation);
    device.dimensions = Vector3.fromJSON(json.dimensions);
    return device;
  }
}

class Obstacle extends BaseModel {
  constructor(id, name) {
    super(id, name);
    this.position = new Vector3(0, 0, 0);
    this.rotation = new Vector3(0, 0, 0);
    this.type = 'curtain';
    this.dimensions = new Vector3(10, 8, 0.2);
    this.color = '#8844aa';
    this.clearanceRequired = 0.5;
    this.notes = '';
  }

  getBoundingBox() {
    const halfX = this.dimensions.x / 2;
    const halfY = this.dimensions.y / 2;
    const halfZ = this.dimensions.z / 2;
    
    return new BoundingBox(
      new Vector3(
        this.position.x - halfX,
        this.position.y - halfY,
        this.position.z - halfZ
      ),
      new Vector3(
        this.position.x + halfX,
        this.position.y + halfY,
        this.position.z + halfZ
      )
    );
  }

  toJSON() {
    return {
      ...super.toJSON(),
      position: this.position.toJSON(),
      rotation: this.rotation.toJSON(),
      type: this.type,
      dimensions: this.dimensions.toJSON(),
      color: this.color,
      clearanceRequired: this.clearanceRequired,
      notes: this.notes
    };
  }

  static fromJSON(json) {
    const obstacle = super.fromJSON(json);
    obstacle.position = Vector3.fromJSON(json.position);
    obstacle.rotation = Vector3.fromJSON(json.rotation);
    obstacle.dimensions = Vector3.fromJSON(json.dimensions);
    return obstacle;
  }
}

class Counterweight extends BaseModel {
  constructor(id, name) {
    super(id, name);
    this.position = new Vector3(0, 0, 0);
    this.weight = 0;
    this.targetTrussId = null;
    this.isRecommended = false;
    this.color = '#666666';
  }

  toJSON() {
    return {
      ...super.toJSON(),
      position: this.position.toJSON(),
      weight: this.weight,
      targetTrussId: this.targetTrussId,
      isRecommended: this.isRecommended,
      color: this.color
    };
  }

  static fromJSON(json) {
    const cw = super.fromJSON(json);
    cw.position = Vector3.fromJSON(json.position);
    return cw;
  }
}

class LoadResult {
  constructor() {
    this.hangingPointLoads = {};
    this.totalWeight = 0;
    this.centerOfGravity = new Vector3(0, 0, 0);
    this.isBalanced = true;
    this.warnings = [];
    this.errors = [];
  }

  addWarning(message, objectId = null) {
    this.warnings.push({ message, objectId, timestamp: Date.now() });
  }

  addError(message, objectId = null) {
    this.errors.push({ message, objectId, timestamp: Date.now() });
    this.isBalanced = false;
  }

  hasIssues() {
    return this.warnings.length > 0 || this.errors.length > 0;
  }

  toJSON() {
    return {
      hangingPointLoads: this.hangingPointLoads,
      totalWeight: this.totalWeight,
      centerOfGravity: this.centerOfGravity.toJSON(),
      isBalanced: this.isBalanced,
      warnings: this.warnings,
      errors: this.errors
    };
  }
}

class CollisionResult {
  constructor() {
    this.collisions = [];
    this.clearanceWarnings = [];
  }

  addCollision(obj1Id, obj2Id, details = '') {
    this.collisions.push({
      obj1Id,
      obj2Id,
      details,
      timestamp: Date.now()
    });
  }

  addClearanceWarning(obj1Id, obj2Id, distance, details = '') {
    this.clearanceWarnings.push({
      obj1Id,
      obj2Id,
      distance,
      details,
      timestamp: Date.now()
    });
  }

  hasCollisions() {
    return this.collisions.length > 0;
  }

  hasWarnings() {
    return this.clearanceWarnings.length > 0 || this.collisions.length > 0;
  }

  toJSON() {
    return {
      collisions: this.collisions,
      clearanceWarnings: this.clearanceWarnings
    };
  }
}

class SceneModel {
  constructor() {
    this.id = 'scene_' + Math.random().toString(36).substr(2, 12);
    this.name = '未命名场景';
    this.description = '';
    this.createdAt = new Date().toISOString();
    this.modifiedAt = this.createdAt;
    
    this.stage = new Stage();
    this.hangingPoints = [];
    this.trusses = [];
    this.devices = [];
    this.obstacles = [];
    this.counterweights = [];
    
    this.loadResult = null;
    this.collisionResult = null;
    
    SceneModel.instance = this;
  }

  getHangingPointById(id) {
    return this.hangingPoints.find(p => p.id === id);
  }

  getTrussById(id) {
    return this.trusses.find(t => t.id === id);
  }

  getDeviceById(id) {
    return this.devices.find(d => d.id === id);
  }

  getObstacleById(id) {
    return this.obstacles.find(o => o.id === id);
  }

  getCounterweightById(id) {
    return this.counterweights.find(c => c.id === id);
  }

  addHangingPoint(point) {
    this.hangingPoints.push(point);
    this.markModified();
    return point;
  }

  addTruss(truss) {
    this.trusses.push(truss);
    this.markModified();
    return truss;
  }

  addDevice(device) {
    this.devices.push(device);
    this.markModified();
    return device;
  }

  addObstacle(obstacle) {
    this.obstacles.push(obstacle);
    this.markModified();
    return obstacle;
  }

  addCounterweight(counterweight) {
    this.counterweights.push(counterweight);
    this.markModified();
    return counterweight;
  }

  removeHangingPoint(id) {
    const index = this.hangingPoints.findIndex(p => p.id === id);
    if (index !== -1) {
      this.hangingPoints.splice(index, 1);
      this.markModified();
      return true;
    }
    return false;
  }

  removeTruss(id) {
    const index = this.trusses.findIndex(t => t.id === id);
    if (index !== -1) {
      this.trusses.splice(index, 1);
      this.markModified();
      return true;
    }
    return false;
  }

  removeDevice(id) {
    const device = this.getDeviceById(id);
    if (device && device.attachedTrussId) {
      const truss = this.getTrussById(device.attachedTrussId);
      if (truss) {
        const idx = truss.devices.indexOf(id);
        if (idx !== -1) truss.devices.splice(idx, 1);
      }
    }
    const index = this.devices.findIndex(d => d.id === id);
    if (index !== -1) {
      this.devices.splice(index, 1);
      this.markModified();
      return true;
    }
    return false;
  }

  removeObstacle(id) {
    const index = this.obstacles.findIndex(o => o.id === id);
    if (index !== -1) {
      this.obstacles.splice(index, 1);
      this.markModified();
      return true;
    }
    return false;
  }

  removeCounterweight(id) {
    const index = this.counterweights.findIndex(c => c.id === id);
    if (index !== -1) {
      this.counterweights.splice(index, 1);
      this.markModified();
      return true;
    }
    return false;
  }

  attachDeviceToTruss(deviceId, trussId) {
    const device = this.getDeviceById(deviceId);
    const truss = this.getTrussById(trussId);
    
    if (!device || !truss) return false;
    
    if (device.attachedTrussId) {
      const oldTruss = this.getTrussById(device.attachedTrussId);
      if (oldTruss) {
        const idx = oldTruss.devices.indexOf(deviceId);
        if (idx !== -1) oldTruss.devices.splice(idx, 1);
      }
    }
    
    device.attachedTrussId = trussId;
    if (!truss.devices.includes(deviceId)) {
      truss.devices.push(deviceId);
    }
    
    this.markModified();
    return true;
  }

  detachDeviceFromTruss(deviceId) {
    const device = this.getDeviceById(deviceId);
    if (!device || !device.attachedTrussId) return false;
    
    const truss = this.getTrussById(device.attachedTrussId);
    if (truss) {
      const idx = truss.devices.indexOf(deviceId);
      if (idx !== -1) truss.devices.splice(idx, 1);
    }
    
    device.attachedTrussId = null;
    this.markModified();
    return true;
  }

  connectTrussToHangingPoint(trussId, pointId) {
    const truss = this.getTrussById(trussId);
    const point = this.getHangingPointById(pointId);
    
    if (!truss || !point) return false;
    
    if (!truss.hangingPoints.includes(pointId)) {
      truss.hangingPoints.push(pointId);
    }
    if (!point.connectedTrusses.includes(trussId)) {
      point.connectedTrusses.push(trussId);
    }
    
    this.markModified();
    return true;
  }

  disconnectTrussFromHangingPoint(trussId, pointId) {
    const truss = this.getTrussById(trussId);
    const point = this.getHangingPointById(pointId);
    
    if (!truss || !point) return false;
    
    const idx1 = truss.hangingPoints.indexOf(pointId);
    if (idx1 !== -1) truss.hangingPoints.splice(idx1, 1);
    
    const idx2 = point.connectedTrusses.indexOf(trussId);
    if (idx2 !== -1) point.connectedTrusses.splice(idx2, 1);
    
    this.markModified();
    return true;
  }

  markModified() {
    this.modifiedAt = new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      createdAt: this.createdAt,
      modifiedAt: this.modifiedAt,
      stage: this.stage.toJSON(),
      hangingPoints: this.hangingPoints.map(p => p.toJSON()),
      trusses: this.trusses.map(t => t.toJSON()),
      devices: this.devices.map(d => d.toJSON()),
      obstacles: this.obstacles.map(o => o.toJSON()),
      counterweights: this.counterweights.map(c => c.toJSON())
    };
  }

  static fromJSON(json) {
    const scene = new SceneModel();
    scene.id = json.id || scene.id;
    scene.name = json.name || scene.name;
    scene.description = json.description || '';
    scene.createdAt = json.createdAt || scene.createdAt;
    scene.modifiedAt = json.modifiedAt || scene.modifiedAt;
    
    if (json.stage) {
      scene.stage = Stage.fromJSON(json.stage);
    }
    
    if (json.hangingPoints) {
      scene.hangingPoints = json.hangingPoints.map(p => HangingPoint.fromJSON(p));
    }
    
    if (json.trusses) {
      scene.trusses = json.trusses.map(t => Truss.fromJSON(t));
    }
    
    if (json.devices) {
      scene.devices = json.devices.map(d => Device.fromJSON(d));
    }
    
    if (json.obstacles) {
      scene.obstacles = json.obstacles.map(o => Obstacle.fromJSON(o));
    }
    
    if (json.counterweights) {
      scene.counterweights = json.counterweights.map(c => Counterweight.fromJSON(c));
    }
    
    SceneModel.instance = scene;
    return scene;
  }
}

class SceneManager {
  constructor() {
    this.currentScene = new SceneModel();
    this.scenes = [];
  }

  createNewScene(name = '新场景') {
    const scene = new SceneModel();
    scene.name = name;
    this.currentScene = scene;
    return scene;
  }

  setCurrentScene(scene) {
    this.currentScene = scene;
    SceneModel.instance = scene;
  }

  duplicateScene(scene, newName = null) {
    const json = scene.toJSON();
    json.id = 'scene_' + Math.random().toString(36).substr(2, 12);
    json.name = newName || scene.name + ' (副本)';
    json.createdAt = new Date().toISOString();
    json.modifiedAt = json.createdAt;
    return SceneModel.fromJSON(json);
  }
}

const sceneManager = new SceneManager();

export {
  BaseModel,
  Vector3,
  BoundingBox,
  Stage,
  HangingPoint,
  Truss,
  Device,
  Obstacle,
  Counterweight,
  LoadResult,
  CollisionResult,
  SceneModel,
  SceneManager,
  sceneManager
};

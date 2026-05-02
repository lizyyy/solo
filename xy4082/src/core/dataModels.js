/**
 * 核心数据模型定义
 */

// 岩点类型
export const HoldType = {
  JUG: 'jug',           // 大把手点
  CRIMP: 'crimp',       // 小抠点
  SLOPER: 'sloper',     // 大斜坡点
  POCKET: 'pocket',     // 指洞点
  PINCH: 'pinch',       // 捏点
  FOOT: 'foot',         // 脚点
  VOLUME: 'volume'      // 造型大岩点
};

// 难度级别
export const DifficultyLevel = {
  V0: 'V0', V1: 'V1', V2: 'V2', V3: 'V3', V4: 'V4',
  V5: 'V5', V6: 'V6', V7: 'V7', V8: 'V8', V9: 'V9', V10: 'V10'
};

// 岩点颜色（常用定线颜色）
export const HoldColors = {
  RED: '#FF4444',
  BLUE: '#4444FF',
  GREEN: '#44AA44',
  YELLOW: '#FFDD44',
  ORANGE: '#FF8844',
  PURPLE: '#AA44AA',
  BLACK: '#222222',
  WHITE: '#EEEEEE',
  PINK: '#FF88AA',
  CYAN: '#44CCDD'
};

// 身高分段
export const HeightSegments = {
  KID_SHORT: { min: 100, max: 120, label: '儿童矮小 (100-120cm)' },
  KID: { min: 120, max: 140, label: '儿童 (120-140cm)' },
  TEEN: { min: 140, max: 160, label: '青少年 (140-160cm)' },
  ADULT_SHORT: { min: 160, max: 170, label: '成人矮小 (160-170cm)' },
  ADULT: { min: 170, max: 180, label: '成人 (170-180cm)' },
  ADULT_TALL: { min: 180, max: 195, label: '成人高大 (180-195cm)' }
};

/**
 * 3D 向量
 */
export class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  clone() {
    return new Vector3(this.x, this.y, this.z);
  }

  add(v) {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }

  sub(v) {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
  }

  multiplyScalar(s) {
    this.x *= s;
    this.y *= s;
    this.z *= s;
    return this;
  }

  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  distanceTo(v) {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    const dz = this.z - v.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  distanceTo2D(v) {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}

/**
 * 墙面定义
 */
export class Wall {
  constructor(config = {}) {
    this.id = config.id || this._generateId();
    this.name = config.name || '未命名墙面';
    
    // 尺寸（米）
    this.width = config.width || 4;
    this.height = config.height || 3;
    
    // 墙面类型
    this.type = config.type || 'flat'; // flat, overhanging, vertical, slab
    
    // 仰角（度）- 正数为仰角，负数为俯角
    this.angle = config.angle || 0;
    
    // 儿童区域标记
    this.isKidsZone = config.isKidsZone || false;
    
    // 落地区域边界
    this.landingZone = config.landingZone || {
      front: 1.5,  // 墙面前方安全距离（米）
      sides: 0.8   // 两侧安全距离（米）
    };
    
    // 可用岩点列表
    this.holds = [];
  }

  _generateId() {
    return 'wall_' + Math.random().toString(36).substr(2, 9);
  }

  addHold(hold) {
    hold.wallId = this.id;
    this.holds.push(hold);
  }

  removeHold(holdId) {
    const index = this.holds.findIndex(h => h.id === holdId);
    if (index >= 0) {
      this.holds.splice(index, 1);
    }
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      width: this.width,
      height: this.height,
      type: this.type,
      angle: this.angle,
      isKidsZone: this.isKidsZone,
      landingZone: { ...this.landingZone },
      holds: this.holds.map(h => h.toJSON())
    };
  }

  static fromJSON(json) {
    const wall = new Wall({
      id: json.id,
      name: json.name,
      width: json.width,
      height: json.height,
      type: json.type,
      angle: json.angle,
      isKidsZone: json.isKidsZone,
      landingZone: json.landingZone
    });
    if (json.holds) {
      json.holds.forEach(h => wall.addHold(Hold.fromJSON(h)));
    }
    return wall;
  }
}

/**
 * 岩点定义
 */
export class Hold {
  constructor(config = {}) {
    this.id = config.id || this._generateId();
    this.wallId = config.wallId || null;
    
    // 位置（相对于墙面左下角，米）
    this.position = config.position instanceof Vector3 
      ? config.position.clone() 
      : new Vector3(config.x || 0, config.y || 0, config.z || 0);
    
    // 类型
    this.type = config.type || HoldType.JUG;
    
    // 颜色
    this.color = config.color || '#FF4444';
    this.colorName = config.colorName || 'RED';
    
    // 尺寸（米）
    this.size = config.size || { width: 0.15, height: 0.15, depth: 0.08 };
    
    // 可使用性
    this.usable = config.usable !== undefined ? config.usable : true;
    
    // 备注
    this.notes = config.notes || '';
  }

  _generateId() {
    return 'hold_' + Math.random().toString(36).substr(2, 9);
  }

  get x() { return this.position.x; }
  set x(v) { this.position.x = v; }
  
  get y() { return this.position.y; }
  set y(v) { this.position.y = v; }
  
  get z() { return this.position.z; }
  set z(v) { this.position.z = v; }

  clone() {
    return Hold.fromJSON(this.toJSON());
  }

  toJSON() {
    return {
      id: this.id,
      wallId: this.wallId,
      position: { x: this.position.x, y: this.position.y, z: this.position.z },
      type: this.type,
      color: this.color,
      colorName: this.colorName,
      size: { ...this.size },
      usable: this.usable,
      notes: this.notes
    };
  }

  static fromJSON(json) {
    return new Hold({
      id: json.id,
      wallId: json.wallId,
      x: json.position?.x ?? 0,
      y: json.position?.y ?? 0,
      z: json.position?.z ?? 0,
      type: json.type,
      color: json.color,
      colorName: json.colorName,
      size: json.size,
      usable: json.usable,
      notes: json.notes
    });
  }
}

/**
 * 线路定义
 */
export class Route {
  constructor(config = {}) {
    this.id = config.id || this._generateId();
    this.name = config.name || '未命名线路';
    
    // 难度
    this.difficulty = config.difficulty || DifficultyLevel.V0;
    
    // 颜色（用于标记整条线路）
    this.color = config.color || '#FF4444';
    this.colorName = config.colorName || 'RED';
    
    // 岩点序列 (hold id 数组)
    this.holdIds = config.holdIds || [];
    
    // 起步岩点 (hold id)
    this.startHoldId = config.startHoldId || null;
    
    // 结束岩点 (hold id)
    this.endHoldId = config.endHoldId || null;
    
    // 线路类型
    this.type = config.type || 'boulder'; // boulder, lead, toprope
    
    // 是否为儿童线路
    this.isKidsRoute = config.isKidsRoute || false;
    
    // 备注
    this.notes = config.notes || '';
  }

  _generateId() {
    return 'route_' + Math.random().toString(36).substr(2, 9);
  }

  addHold(holdId) {
    if (!this.holdIds.includes(holdId)) {
      this.holdIds.push(holdId);
    }
  }

  removeHold(holdId) {
    const index = this.holdIds.indexOf(holdId);
    if (index >= 0) {
      this.holdIds.splice(index, 1);
    }
    if (this.startHoldId === holdId) this.startHoldId = null;
    if (this.endHoldId === holdId) this.endHoldId = null;
  }

  setStart(holdId) {
    if (this.holdIds.includes(holdId)) {
      this.startHoldId = holdId;
    }
  }

  setEnd(holdId) {
    if (this.holdIds.includes(holdId)) {
      this.endHoldId = holdId;
    }
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      difficulty: this.difficulty,
      color: this.color,
      colorName: this.colorName,
      holdIds: [...this.holdIds],
      startHoldId: this.startHoldId,
      endHoldId: this.endHoldId,
      type: this.type,
      isKidsRoute: this.isKidsRoute,
      notes: this.notes
    };
  }

  static fromJSON(json) {
    return new Route({
      id: json.id,
      name: json.name,
      difficulty: json.difficulty,
      color: json.color,
      colorName: json.colorName,
      holdIds: json.holdIds,
      startHoldId: json.startHoldId,
      endHoldId: json.endHoldId,
      type: json.type,
      isKidsRoute: json.isKidsRoute,
      notes: json.notes
    });
  }
}

/**
 * Session（完整定线会话）
 * 包含墙面、岩点、多条线路
 */
export class Session {
  constructor(config = {}) {
    this.id = config.id || this._generateId();
    this.name = config.name || '未命名方案';
    this.createdAt = config.createdAt || new Date().toISOString();
    this.updatedAt = config.updatedAt || new Date().toISOString();
    
    // 墙面
    this.wall = config.wall ? Wall.fromJSON(config.wall) : null;
    
    // 线路列表
    this.routes = (config.routes || []).map(r => Route.fromJSON(r));
    
    // 备注
    this.notes = config.notes || '';
  }

  _generateId() {
    return 'session_' + Math.random().toString(36).substr(2, 9);
  }

  addRoute(route) {
    this.routes.push(route);
    this.updatedAt = new Date().toISOString();
  }

  removeRoute(routeId) {
    const index = this.routes.findIndex(r => r.id === routeId);
    if (index >= 0) {
      this.routes.splice(index, 1);
      this.updatedAt = new Date().toISOString();
    }
  }

  updateTimestamp() {
    this.updatedAt = new Date().toISOString();
  }

  clone() {
    return Session.fromJSON(this.toJSON());
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      wall: this.wall ? this.wall.toJSON() : null,
      routes: this.routes.map(r => r.toJSON()),
      notes: this.notes
    };
  }

  static fromJSON(json) {
    return new Session({
      id: json.id,
      name: json.name,
      createdAt: json.createdAt,
      updatedAt: json.updatedAt,
      wall: json.wall,
      routes: json.routes,
      notes: json.notes
    });
  }
}

/**
 * 校验结果
 */
export class ValidationResult {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.info = [];
  }

  addError(message, context = {}) {
    this.errors.push({ type: 'error', message, context, timestamp: Date.now() });
  }

  addWarning(message, context = {}) {
    this.warnings.push({ type: 'warning', message, context, timestamp: Date.now() });
  }

  addInfo(message, context = {}) {
    this.info.push({ type: 'info', message, context, timestamp: Date.now() });
  }

  hasErrors() {
    return this.errors.length > 0;
  }

  hasWarnings() {
    return this.warnings.length > 0;
  }

  getAll() {
    return [...this.errors, ...this.warnings, ...this.info];
  }

  toJSON() {
    return {
      errors: [...this.errors],
      warnings: [...this.warnings],
      info: [...this.info]
    };
  }
}

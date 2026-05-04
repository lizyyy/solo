const { v4: uuidv4 } = require('uuid');

class BaseModel {
  constructor() {
    this.id = uuidv4();
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  update() {
    this.updatedAt = new Date();
  }
}

class Material extends BaseModel {
  constructor(name, type, nozzleTempMin, nozzleTempMax, bedTemp, color = null) {
    super();
    this.name = name;
    this.type = type; // PLA, ABS, PETG, TPU, etc.
    this.nozzleTempMin = nozzleTempMin;
    this.nozzleTempMax = nozzleTempMax;
    this.bedTemp = bedTemp;
    this.color = color;
  }

  isCompatible(nozzleTemp) {
    return nozzleTemp >= this.nozzleTempMin && nozzleTemp <= this.nozzleTempMax;
  }

  static fromJSON(json) {
    const material = new Material(
      json.name,
      json.type,
      json.nozzleTempMin,
      json.nozzleTempMax,
      json.bedTemp,
      json.color
    );
    material.id = json.id || material.id;
    return material;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      nozzleTempMin: this.nozzleTempMin,
      nozzleTempMax: this.nozzleTempMax,
      bedTemp: this.bedTemp,
      color: this.color,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

class MaterialInventory extends BaseModel {
  constructor(materialId, spoolId, remainingWeight, totalWeight, location, lastUpdated = null) {
    super();
    this.materialId = materialId;
    this.spoolId = spoolId;
    this.remainingWeight = remainingWeight; // 剩余重量（克）
    this.totalWeight = totalWeight; // 总重量（克）
    this.location = location; // 存放位置
    this.lastUpdated = lastUpdated || new Date();
  }

  get remainingPercentage() {
    return (this.remainingWeight / this.totalWeight) * 100;
  }

  isLow() {
    return this.remainingPercentage < 20;
  }

  static fromJSON(json) {
    const inventory = new MaterialInventory(
      json.materialId,
      json.spoolId,
      json.remainingWeight,
      json.totalWeight,
      json.location,
      json.lastUpdated
    );
    inventory.id = json.id || inventory.id;
    return inventory;
  }

  toJSON() {
    return {
      id: this.id,
      materialId: this.materialId,
      spoolId: this.spoolId,
      remainingWeight: this.remainingWeight,
      totalWeight: this.totalWeight,
      location: this.location,
      lastUpdated: this.lastUpdated,
      remainingPercentage: this.remainingPercentage,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

class Nozzle extends BaseModel {
  constructor(machineId, size, material, lastChangedDate, printHoursSinceChange, maxPrintHours = 1000) {
    super();
    this.machineId = machineId;
    this.size = size; // 喷嘴尺寸，如 0.4mm
    this.material = material; // 喷嘴材质，如 brass, steel
    this.lastChangedDate = lastChangedDate; // 上次更换日期
    this.printHoursSinceChange = printHoursSinceChange; // 更换后的打印小时数
    this.maxPrintHours = maxPrintHours; // 最大打印小时数
  }

  isMaintenanceOverdue() {
    return this.printHoursSinceChange >= this.maxPrintHours;
  }

  get remainingHours() {
    return Math.max(0, this.maxPrintHours - this.printHoursSinceChange);
  }

  static fromJSON(json) {
    const nozzle = new Nozzle(
      json.machineId,
      json.size,
      json.material,
      json.lastChangedDate,
      json.printHoursSinceChange,
      json.maxPrintHours
    );
    nozzle.id = json.id || nozzle.id;
    return nozzle;
  }

  toJSON() {
    return {
      id: this.id,
      machineId: this.machineId,
      size: this.size,
      material: this.material,
      lastChangedDate: this.lastChangedDate,
      printHoursSinceChange: this.printHoursSinceChange,
      maxPrintHours: this.maxPrintHours,
      remainingHours: this.remainingHours,
      isMaintenanceOverdue: this.isMaintenanceOverdue(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

class Machine extends BaseModel {
  constructor(name, model, type, status = 'available', currentTaskId = null, nozzle = null) {
    super();
    this.name = name;
    this.model = model;
    this.type = type; // FDM, SLA, SLS, etc.
    this.status = status; // available, busy, maintenance, offline
    this.currentTaskId = currentTaskId;
    this.nozzle = nozzle; // Nozzle 对象
  }

  isAvailable() {
    return this.status === 'available';
  }

  static fromJSON(json) {
    const machine = new Machine(
      json.name,
      json.model,
      json.type,
      json.status,
      json.currentTaskId,
      json.nozzle ? Nozzle.fromJSON(json.nozzle) : null
    );
    machine.id = json.id || machine.id;
    return machine;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      model: this.model,
      type: this.type,
      status: this.status,
      currentTaskId: this.currentTaskId,
      nozzle: this.nozzle ? this.nozzle.toJSON() : null,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

class GCodeInfo extends BaseModel {
  constructor(fileName, estimatedPrintTime, nozzleTemp, bedTemp, materialType, layerHeight, infillPercentage) {
    super();
    this.fileName = fileName;
    this.estimatedPrintTime = estimatedPrintTime; // 预计打印时间（分钟）
    this.nozzleTemp = nozzleTemp;
    this.bedTemp = bedTemp;
    this.materialType = materialType;
    this.layerHeight = layerHeight;
    this.infillPercentage = infillPercentage;
  }

  static fromJSON(json) {
    const gcode = new GCodeInfo(
      json.fileName,
      json.estimatedPrintTime,
      json.nozzleTemp,
      json.bedTemp,
      json.materialType,
      json.layerHeight,
      json.infillPercentage
    );
    gcode.id = json.id || gcode.id;
    return gcode;
  }

  toJSON() {
    return {
      id: this.id,
      fileName: this.fileName,
      estimatedPrintTime: this.estimatedPrintTime,
      nozzleTemp: this.nozzleTemp,
      bedTemp: this.bedTemp,
      materialType: this.materialType,
      layerHeight: this.layerHeight,
      infillPercentage: this.infillPercentage,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

class Task extends BaseModel {
  constructor(userId, userName, machineId, gcodeInfo, materialId, scheduledStartTime, scheduledEndTime, status = 'pending', priority = 'normal') {
    super();
    this.userId = userId;
    this.userName = userName;
    this.machineId = machineId;
    this.gcodeInfo = gcodeInfo; // GCodeInfo 对象
    this.materialId = materialId;
    this.scheduledStartTime = scheduledStartTime;
    this.scheduledEndTime = scheduledEndTime;
    this.status = status; // pending, printing, completed, cancelled
    this.priority = priority; // low, normal, high, urgent
  }

  get scheduledDuration() {
    const start = new Date(this.scheduledStartTime);
    const end = new Date(this.scheduledEndTime);
    return (end - start) / (1000 * 60); // 分钟
  }

  isTimeOverdue() {
    if (!this.gcodeInfo) return false;
    return this.gcodeInfo.estimatedPrintTime > this.scheduledDuration;
  }

  static fromJSON(json) {
    const task = new Task(
      json.userId,
      json.userName,
      json.machineId,
      json.gcodeInfo ? GCodeInfo.fromJSON(json.gcodeInfo) : null,
      json.materialId,
      json.scheduledStartTime,
      json.scheduledEndTime,
      json.status,
      json.priority
    );
    task.id = json.id || task.id;
    return task;
  }

  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      userName: this.userName,
      machineId: this.machineId,
      gcodeInfo: this.gcodeInfo ? this.gcodeInfo.toJSON() : null,
      materialId: this.materialId,
      scheduledStartTime: this.scheduledStartTime,
      scheduledEndTime: this.scheduledEndTime,
      scheduledDuration: this.scheduledDuration,
      isTimeOverdue: this.isTimeOverdue(),
      status: this.status,
      priority: this.priority,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

class MaintenanceRecord extends BaseModel {
  constructor(machineId, type, description, performedBy, performedDate, nextMaintenanceDate = null, notes = '') {
    super();
    this.machineId = machineId;
    this.type = type; // nozzle_change, calibration, cleaning, repair, etc.
    this.description = description;
    this.performedBy = performedBy;
    this.performedDate = performedDate;
    this.nextMaintenanceDate = nextMaintenanceDate;
    this.notes = notes;
  }

  isOverdue() {
    if (!this.nextMaintenanceDate) return false;
    return new Date() > new Date(this.nextMaintenanceDate);
  }

  static fromJSON(json) {
    const record = new MaintenanceRecord(
      json.machineId,
      json.type,
      json.description,
      json.performedBy,
      json.performedDate,
      json.nextMaintenanceDate,
      json.notes
    );
    record.id = json.id || record.id;
    return record;
  }

  toJSON() {
    return {
      id: this.id,
      machineId: this.machineId,
      type: this.type,
      description: this.description,
      performedBy: this.performedBy,
      performedDate: this.performedDate,
      nextMaintenanceDate: this.nextMaintenanceDate,
      isOverdue: this.isOverdue(),
      notes: this.notes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

class Issue extends BaseModel {
  constructor(type, severity, description, relatedEntityType, relatedEntityId, details = {}) {
    super();
    this.type = type; // temperature_incompatible, time_overdue, maintenance_overdue, queue_conflict, material_low
    this.severity = severity; // low, medium, high, critical
    this.description = description;
    this.relatedEntityType = relatedEntityType; // task, machine, material, maintenance
    this.relatedEntityId = relatedEntityId;
    this.details = details;
    this.status = 'open'; // open, resolved, dismissed
    this.resolvedBy = null;
    this.resolvedAt = null;
    this.notes = '';
  }

  resolve(resolvedBy, notes = '') {
    this.status = 'resolved';
    this.resolvedBy = resolvedBy;
    this.resolvedAt = new Date();
    this.notes = notes;
    this.update();
  }

  dismiss(dismissedBy, notes = '') {
    this.status = 'dismissed';
    this.resolvedBy = dismissedBy;
    this.resolvedAt = new Date();
    this.notes = notes;
    this.update();
  }

  static fromJSON(json) {
    const issue = new Issue(
      json.type,
      json.severity,
      json.description,
      json.relatedEntityType,
      json.relatedEntityId,
      json.details
    );
    issue.id = json.id || issue.id;
    issue.status = json.status || issue.status;
    issue.resolvedBy = json.resolvedBy;
    issue.resolvedAt = json.resolvedAt;
    issue.notes = json.notes || '';
    return issue;
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      severity: this.severity,
      description: this.description,
      relatedEntityType: this.relatedEntityType,
      relatedEntityId: this.relatedEntityId,
      details: this.details,
      status: this.status,
      resolvedBy: this.resolvedBy,
      resolvedAt: this.resolvedAt,
      notes: this.notes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = {
  BaseModel,
  Material,
  MaterialInventory,
  Nozzle,
  Machine,
  GCodeInfo,
  Task,
  MaintenanceRecord,
  Issue
};
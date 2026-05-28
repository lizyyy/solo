// ==========================================
// 3D打印农场调度 - 数据模型
// ==========================================

(function() {

// 材料类型枚举
const MaterialType = {
  PLA: 'PLA',
  ABS: 'ABS',
  PETG: 'PETG',
  TPU: 'TPU',
  NYLON: 'NYLON'
};

// 喷嘴尺寸枚举
const NozzleSize = {
  S_0_2: '0.2mm',
  S_0_4: '0.4mm',
  S_0_6: '0.6mm',
  S_0_8: '0.8mm',
  S_1_0: '1.0mm'
};

// 故障类型枚举
const FaultType = {
  NOZZLE_CLOG: 'nozzle_clog',
  MATERIAL_RUNOUT: 'material_runout',
  MECHANICAL_FAILURE: 'mechanical_failure',
  POWER_OUTAGE: 'power_outage'
};

// 订单状态枚举
const OrderStatus = {
  PENDING: 'pending',
  SCHEDULED: 'scheduled',
  PRINTING: 'printing',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

// 调度异常类型
const IssueType = {
  MATERIAL_MISMATCH: 'material_mismatch',
  NOZZLE_CLOG: 'nozzle_clog',
  DEADLINE_MISS: 'deadline_miss',
  INSUFFICIENT_MATERIAL: 'insufficient_material',
  PRINTER_BUSY: 'printer_busy',
  UNSUITABLE_NOZZLE: 'unsuitable_nozzle'
};

// 复核状态
const ReviewStatus = {
  NORMAL: 'normal',
  PENDING_REVIEW: 'pending_review'
};

// 打印机类
class Printer {
  constructor(id, name, supportedMaterials, maxNozzleSize, baseSpeed = 1.0) {
    this.id = id;
    this.name = name;
    this.supportedMaterials = supportedMaterials;
    this.maxNozzleSize = maxNozzleSize;
    this.baseSpeed = baseSpeed;
    this.currentMaterial = null;
    this.currentNozzle = null;
    this.currentTask = null;
    this.totalPrintHours = 0;
    this.failureCount = 0;
  }

  isMaterialSupported(materialType) {
    return this.supportedMaterials.includes(materialType);
  }

  isNozzleCompatible(nozzleSize) {
    const sizeOrder = ['0.2mm', '0.4mm', '0.6mm', '0.8mm', '1.0mm'];
    const currentIdx = sizeOrder.indexOf(nozzleSize);
    const maxIdx = sizeOrder.indexOf(this.maxNozzleSize);
    return currentIdx <= maxIdx;
  }

  isAvailable() {
    return this.currentTask === null;
  }

  getStatus() {
    if (this.currentTask) {
      return `打印中: ${this.currentTask.orderId}`;
    }
    if (this.failureCount > 2) {
      return '需要维护';
    }
    return '空闲';
  }
}

// 材料卷类
class MaterialRoll {
  constructor(id, materialType, color, totalLength, spoolWeight = 1000) {
    this.id = id;
    this.materialType = materialType;
    this.color = color;
    this.totalLength = totalLength;
    this.remainingLength = totalLength;
    this.spoolWeight = spoolWeight;
    this.currentPrinterId = null;
    this.batchNumber = `BAT${Date.now()}${Math.floor(Math.random() * 1000)}`;
    this.expiryDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  }

  getRemainingPercentage() {
    return Math.round((this.remainingLength / this.totalLength) * 100);
  }

  consume(length) {
    if (length > this.remainingLength) {
      const consumed = this.remainingLength;
      this.remainingLength = 0;
      return { consumed, insufficient: true };
    }
    this.remainingLength -= length;
    return { consumed: length, insufficient: false };
  }

  isEmpty() {
    return this.remainingLength <= 0;
  }

  isExpired() {
    return new Date() > this.expiryDate;
  }
}

// 喷嘴类
class Nozzle {
  constructor(id, size, material = 'brass', maxPrintHours = 200) {
    this.id = id;
    this.size = size;
    this.material = material;
    this.maxPrintHours = maxPrintHours;
    this.usedHours = 0;
    this.currentPrinterId = null;
    this.clogCount = 0;
    this.cleanCount = 0;
    this.temperatureResistance = this.getTempResistance();
  }

  getTempResistance() {
    const resistances = {
      brass: 300,
      steel: 450,
      hardened_steel: 500,
      ruby: 600
    };
    return resistances[this.material] || 300;
  }

  getWearPercentage() {
    return Math.min(100, Math.round((this.usedHours / this.maxPrintHours) * 100));
  }

  getClogRisk() {
    const wearFactor = this.getWearPercentage() / 100;
    const clogFactor = this.clogCount * 0.1;
    const cleanFactor = Math.max(0, 1 - this.cleanCount * 0.05);
    return Math.min(100, (wearFactor * 30 + clogFactor * 50) * cleanFactor);
  }

  use(hours) {
    this.usedHours += hours;
  }

  clean() {
    this.cleanCount++;
    this.clogCount = Math.max(0, this.clogCount - 1);
  }

  needsReplacement() {
    return this.getWearPercentage() >= 90 || this.clogCount >= 3;
  }

  willClog(probabilityFactor = 1.0) {
    const risk = this.getClogRisk() * probabilityFactor;
    return Math.random() * 100 < risk;
  }
}

// 订单类
class Order {
  constructor(id, name, requiredMaterial, requiredNozzleSize, 
              printLength, estimatedHours, deadline, priority = 1) {
    this.id = id;
    this.name = name;
    this.requiredMaterial = requiredMaterial;
    this.requiredNozzleSize = requiredNozzleSize;
    this.printLength = printLength;
    this.estimatedHours = estimatedHours;
    this.deadline = deadline;
    this.priority = priority;
    this.status = OrderStatus.PENDING;
    this.assignedPrinterId = null;
    this.startTime = null;
    this.endTime = null;
    this.actualHours = 0;
    this.materialUsed = 0;
    this.issues = [];
    this.reviewStatus = ReviewStatus.NORMAL;
    this.reviewNotes = [];
  }

  getTimeRemaining(currentTime) {
    if (!this.deadline) return Infinity;
    return this.deadline.getTime() - currentTime.getTime();
  }

  isUrgent(currentTime) {
    const remaining = this.getTimeRemaining(currentTime);
    return remaining < this.estimatedHours * 2 * 60 * 60 * 1000;
  }

  isOverdue(currentTime) {
    if (this.status === OrderStatus.COMPLETED) {
      return this.endTime > this.deadline;
    }
    return currentTime > this.deadline;
  }

  addIssue(issue) {
    this.issues.push(issue);
  }

  markForReview(note) {
    this.reviewStatus = ReviewStatus.PENDING_REVIEW;
    if (note) {
      this.reviewNotes.push(note);
    }
  }
}

// 故障事件类
class FaultEvent {
  constructor(id, type, printerId, timestamp, details = {}) {
    this.id = id;
    this.type = type;
    this.printerId = printerId;
    this.timestamp = timestamp;
    this.details = details;
    this.resolved = false;
    this.resolvedAt = null;
    this.resolutionNotes = '';
    this.downtimeMinutes = 0;
    this.affectedOrders = [];
  }

  getTypeName() {
    const names = {
      [FaultType.NOZZLE_CLOG]: '喷嘴堵塞',
      [FaultType.MATERIAL_RUNOUT]: '材料用尽',
      [FaultType.MECHANICAL_FAILURE]: '机械故障',
      [FaultType.POWER_OUTAGE]: '断电'
    };
    return names[this.type] || this.type;
  }

  getSeverity() {
    const severities = {
      [FaultType.NOZZLE_CLOG]: 'low',
      [FaultType.MATERIAL_RUNOUT]: 'medium',
      [FaultType.MECHANICAL_FAILURE]: 'high',
      [FaultType.POWER_OUTAGE]: 'critical'
    };
    return severities[this.type] || 'medium';
  }

  getEstimatedDowntime() {
    const downtimes = {
      [FaultType.NOZZLE_CLOG]: 15,
      [FaultType.MATERIAL_RUNOUT]: 10,
      [FaultType.MECHANICAL_FAILURE]: 120,
      [FaultType.POWER_OUTAGE]: 60
    };
    return downtimes[this.type] || 30;
  }

  resolve(notes = '', actualDowntime = null) {
    this.resolved = true;
    this.resolvedAt = new Date();
    this.resolutionNotes = notes;
    this.downtimeMinutes = actualDowntime || this.getEstimatedDowntime();
  }
}

// 调度问题类
class SchedulingIssue {
  constructor(type, affectedObjects, reason, severity = 'error') {
    this.type = type;
    this.affectedObjects = affectedObjects;
    this.reason = reason;
    this.severity = severity;
    this.timestamp = new Date();
    this.resolved = false;
  }

  getTypeName() {
    const names = {
      [IssueType.MATERIAL_MISMATCH]: '材料错配',
      [IssueType.NOZZLE_CLOG]: '喷嘴堵塞',
      [IssueType.DEADLINE_MISS]: '交期超时',
      [IssueType.INSUFFICIENT_MATERIAL]: '材料不足',
      [IssueType.PRINTER_BUSY]: '打印机占用',
      [IssueType.UNSUITABLE_NOZZLE]: '喷嘴不适用'
    };
    return names[this.type] || this.type;
  }
}

// 调度任务类
class ScheduledTask {
  constructor(order, printer, material, nozzle, startTime) {
    this.orderId = order.id;
    this.printerId = printer.id;
    this.materialId = material.id;
    this.nozzleId = nozzle.id;
    this.startTime = startTime;
    this.estimatedEndTime = new Date(startTime.getTime() + order.estimatedHours * 60 * 60 * 1000);
    this.actualEndTime = null;
    this.progress = 0;
    this.paused = false;
    this.pauseReason = '';
  }
}

// 调度报告类
class SchedulingReport {
  constructor() {
    this.generatedAt = new Date();
    this.totalOrders = 0;
    this.completedOrders = 0;
    this.failedOrders = 0;
    this.pendingOrders = 0;
    this.issues = [];
    this.materialUsage = {};
    this.printerUtilization = {};
    this.scoreBreakdown = {};
    this.totalScore = 0;
    this.maxScore = 100;
    this.pendingReviewItems = [];
    this.lessonsLearned = [];
  }
}

const _modelsExports = {
  MaterialType,
  NozzleSize,
  FaultType,
  OrderStatus,
  IssueType,
  ReviewStatus,
  Printer,
  MaterialRoll,
  Nozzle,
  Order,
  FaultEvent,
  SchedulingIssue,
  ScheduledTask,
  SchedulingReport
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = _modelsExports;
} else {
  Object.assign(window, _modelsExports);
}

})();

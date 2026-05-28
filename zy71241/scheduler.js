// ==========================================
// 3D打印农场调度 - 调度引擎与错误检测
// ==========================================

(function() {

let MaterialType, NozzleSize, FaultType, OrderStatus, IssueType, ReviewStatus,
    Printer, MaterialRoll, Nozzle, Order, FaultEvent, SchedulingIssue,
    ScheduledTask, SchedulingReport;

if (typeof module !== 'undefined' && module.exports) {
  const models = require('./models');
  ({
    MaterialType, NozzleSize, FaultType, OrderStatus, IssueType, ReviewStatus,
    Printer, MaterialRoll, Nozzle, Order, FaultEvent, SchedulingIssue,
    ScheduledTask, SchedulingReport
  } = models);
} else {
  ({
    MaterialType, NozzleSize, FaultType, OrderStatus, IssueType, ReviewStatus,
    Printer, MaterialRoll, Nozzle, Order, FaultEvent, SchedulingIssue,
    ScheduledTask, SchedulingReport
  } = window);
}

// 输入验证结果类
class ValidationResult {
  constructor() {
    this.valid = true;
    this.missingFields = [];
    this.warnings = [];
  }

  addMissing(field, description) {
    this.valid = false;
    this.missingFields.push({ field, description });
  }

  addWarning(warning) {
    this.warnings.push(warning);
  }
}

// 调度引擎类
class SchedulingEngine {
  constructor() {
    this.printers = new Map();
    this.materials = new Map();
    this.nozzles = new Map();
    this.orders = new Map();
    this.faultEvents = [];
    this.scheduledTasks = new Map();
    this.completedTasks = [];
    this.issues = [];
    this.currentTime = new Date();
    this.eventLog = [];
    this.idCounter = 1;
  }

  // ========== 输入验证方法 ==========

  validatePrinterInput(data) {
    const result = new ValidationResult();
    if (!data.id) result.addMissing('id', '打印机ID不能为空');
    if (!data.name) result.addMissing('name', '打印机名称不能为空');
    if (!data.supportedMaterials || data.supportedMaterials.length === 0) {
      result.addMissing('supportedMaterials', '打印机必须支持至少一种材料');
    }
    if (!data.maxNozzleSize) result.addMissing('maxNozzleSize', '必须指定最大喷嘴尺寸');
    return result;
  }

  validateMaterialInput(data) {
    const result = new ValidationResult();
    if (!data.id) result.addMissing('id', '材料卷ID不能为空');
    if (!data.materialType) result.addMissing('materialType', '材料类型不能为空');
    if (!data.color) result.addMissing('color', '材料颜色不能为空');
    if (!data.totalLength || data.totalLength <= 0) {
      result.addMissing('totalLength', '材料总长度必须大于0');
    }
    if (!Object.values(MaterialType).includes(data.materialType)) {
      result.addWarning(`未知材料类型: ${data.materialType}`);
    }
    return result;
  }

  validateNozzleInput(data) {
    const result = new ValidationResult();
    if (!data.id) result.addMissing('id', '喷嘴ID不能为空');
    if (!data.size) result.addMissing('size', '喷嘴尺寸不能为空');
    if (!Object.values(NozzleSize).includes(data.size)) {
      result.addWarning(`未知喷嘴尺寸: ${data.size}`);
    }
    return result;
  }

  validateOrderInput(data) {
    const result = new ValidationResult();
    if (!data.id) result.addMissing('id', '订单ID不能为空');
    if (!data.name) result.addMissing('name', '订单名称不能为空');
    if (!data.requiredMaterial) result.addMissing('requiredMaterial', '必须指定所需材料');
    if (!data.requiredNozzleSize) result.addMissing('requiredNozzleSize', '必须指定所需喷嘴尺寸');
    if (!data.printLength || data.printLength <= 0) {
      result.addMissing('printLength', '打印长度必须大于0');
    }
    if (!data.estimatedHours || data.estimatedHours <= 0) {
      result.addMissing('estimatedHours', '预计打印时间必须大于0');
    }
    if (!data.deadline) {
      result.addWarning('订单未设置截止日期，将不会进行交期超时检测');
    }
    if (data.deadline && !(data.deadline instanceof Date)) {
      try {
        data.deadline = new Date(data.deadline);
      } catch (e) {
        result.addMissing('deadline', '截止日期格式无效');
      }
    }
    return result;
  }

  validateFaultEventInput(data) {
    const result = new ValidationResult();
    if (!data.id) result.addMissing('id', '故障事件ID不能为空');
    if (!data.type) result.addMissing('type', '故障类型不能为空');
    if (!data.printerId) result.addMissing('printerId', '必须指定受影响的打印机');
    if (!data.timestamp) {
      result.addWarning('未指定故障时间，将使用当前时间');
      data.timestamp = new Date();
    }
    return result;
  }

  // ========== 实体管理方法 ==========

  addPrinter(data) {
    const validation = this.validatePrinterInput(data);
    if (!validation.valid) {
      return { success: false, validation, printer: null };
    }
    const printer = new Printer(
      data.id, data.name, data.supportedMaterials, 
      data.maxNozzleSize, data.baseSpeed
    );
    this.printers.set(printer.id, printer);
    this.logEvent('打印机已添加', { printerId: printer.id, name: printer.name });
    return { success: true, validation, printer };
  }

  addMaterial(data) {
    const validation = this.validateMaterialInput(data);
    if (!validation.valid) {
      return { success: false, validation, material: null };
    }
    const material = new MaterialRoll(
      data.id, data.materialType, data.color, 
      data.totalLength, data.spoolWeight
    );
    this.materials.set(material.id, material);
    this.logEvent('材料卷已添加', { 
      materialId: material.id, 
      type: material.materialType,
      color: material.color 
    });
    return { success: true, validation, material };
  }

  addNozzle(data) {
    const validation = this.validateNozzleInput(data);
    if (!validation.valid) {
      return { success: false, validation, nozzle: null };
    }
    const nozzle = new Nozzle(data.id, data.size, data.material, data.maxPrintHours);
    this.nozzles.set(nozzle.id, nozzle);
    this.logEvent('喷嘴已添加', { nozzleId: nozzle.id, size: nozzle.size });
    return { success: true, validation, nozzle };
  }

  addOrder(data) {
    const validation = this.validateOrderInput(data);
    if (!validation.valid) {
      return { success: false, validation, order: null };
    }
    const order = new Order(
      data.id, data.name, data.requiredMaterial, data.requiredNozzleSize,
      data.printLength, data.estimatedHours, data.deadline, data.priority
    );
    this.orders.set(order.id, order);
    this.logEvent('订单已添加', { orderId: order.id, name: order.name });
    return { success: true, validation, order };
  }

  addFaultEvent(data) {
    const validation = this.validateFaultEventInput(data);
    if (!validation.valid) {
      return { success: false, validation, fault: null };
    }
    const fault = new FaultEvent(
      data.id, data.type, data.printerId, 
      data.timestamp, data.details
    );
    this.faultEvents.push(fault);
    
    if (this.printers.has(data.printerId)) {
      this.printers.get(data.printerId).failureCount++;
    }
    
    this.processFaultImpact(fault);
    this.logEvent('故障事件已记录', { 
      faultId: fault.id, 
      type: fault.getTypeName(),
      printerId: fault.printerId 
    });
    return { success: true, validation, fault };
  }

  // ========== 安装与配置方法 ==========

  installMaterial(printerId, materialId) {
    const printer = this.printers.get(printerId);
    const material = this.materials.get(materialId);
    
    if (!printer || !material) {
      return { success: false, issue: '打印机或材料不存在' };
    }

    if (!printer.isMaterialSupported(material.materialType)) {
      const issue = new SchedulingIssue(
        IssueType.MATERIAL_MISMATCH,
        { printerId, materialId },
        `打印机 ${printer.name} 不支持材料类型 ${material.materialType}`,
        'error'
      );
      this.issues.push(issue);
      return { success: false, issue };
    }

    if (material.currentPrinterId) {
      const oldPrinter = this.printers.get(material.currentPrinterId);
      if (oldPrinter) oldPrinter.currentMaterial = null;
    }

    if (printer.currentMaterial) {
      const oldMaterial = this.materials.get(printer.currentMaterial);
      if (oldMaterial) oldMaterial.currentPrinterId = null;
    }

    printer.currentMaterial = materialId;
    material.currentPrinterId = printerId;
    this.logEvent('材料已安装', { printerId, materialId });
    return { success: true };
  }

  installNozzle(printerId, nozzleId) {
    const printer = this.printers.get(printerId);
    const nozzle = this.nozzles.get(nozzleId);
    
    if (!printer || !nozzle) {
      return { success: false, issue: '打印机或喷嘴不存在' };
    }

    if (!printer.isNozzleCompatible(nozzle.size)) {
      const issue = new SchedulingIssue(
        IssueType.UNSUITABLE_NOZZLE,
        { printerId, nozzleId },
        `打印机 ${printer.name} 最大支持喷嘴尺寸 ${printer.maxNozzleSize}，无法安装 ${nozzle.size}`,
        'error'
      );
      this.issues.push(issue);
      return { success: false, issue };
    }

    if (nozzle.currentPrinterId) {
      const oldPrinter = this.printers.get(nozzle.currentPrinterId);
      if (oldPrinter) oldPrinter.currentNozzle = null;
    }

    if (printer.currentNozzle) {
      const oldNozzle = this.nozzles.get(printer.currentNozzle);
      if (oldNozzle) oldNozzle.currentPrinterId = null;
    }

    printer.currentNozzle = nozzleId;
    nozzle.currentPrinterId = printerId;
    this.logEvent('喷嘴已安装', { printerId, nozzleId });
    return { success: true };
  }

  // ========== 调度核心方法 ==========

  checkSchedulingFeasibility(orderId, printerId) {
    const order = this.orders.get(orderId);
    const printer = this.printers.get(printerId);
    const issues = [];

    if (!order || !printer) {
      issues.push(new SchedulingIssue(
        IssueType.PRINTER_BUSY,
        { orderId, printerId },
        '订单或打印机不存在',
        'error'
      ));
      return { feasible: false, issues };
    }

    if (!printer.isAvailable()) {
      issues.push(new SchedulingIssue(
        IssueType.PRINTER_BUSY,
        { orderId, printerId, currentTask: printer.currentTask },
        `打印机 ${printer.name} 正在处理任务 ${printer.currentTask}`,
        'warning'
      ));
    }

    if (!printer.currentMaterial) {
      issues.push(new SchedulingIssue(
        IssueType.MATERIAL_MISMATCH,
        { orderId, printerId },
        `打印机 ${printer.name} 未安装材料`,
        'error'
      ));
    } else {
      const material = this.materials.get(printer.currentMaterial);
      if (material && material.materialType !== order.requiredMaterial) {
        issues.push(new SchedulingIssue(
          IssueType.MATERIAL_MISMATCH,
          { orderId, printerId, materialId: material.id },
          `材料错配：订单需要 ${order.requiredMaterial}，打印机安装的是 ${material.materialType}`,
          'error'
        ));
      }
      if (material && material.remainingLength < order.printLength) {
        issues.push(new SchedulingIssue(
          IssueType.INSUFFICIENT_MATERIAL,
          { orderId, printerId, materialId: material.id },
          `材料不足：需要 ${order.printLength}mm，剩余 ${material.remainingLength}mm`,
          'error'
        ));
      }
    }

    if (!printer.currentNozzle) {
      issues.push(new SchedulingIssue(
        IssueType.UNSUITABLE_NOZZLE,
        { orderId, printerId },
        `打印机 ${printer.name} 未安装喷嘴`,
        'error'
      ));
    } else {
      const nozzle = this.nozzles.get(printer.currentNozzle);
      if (nozzle && nozzle.size !== order.requiredNozzleSize) {
        issues.push(new SchedulingIssue(
          IssueType.UNSUITABLE_NOZZLE,
          { orderId, printerId, nozzleId: nozzle.id },
          `喷嘴不适用：订单需要 ${order.requiredNozzleSize}，打印机安装的是 ${nozzle.size}`,
          'error'
        ));
      }
    }

    const deadlineIssue = this.checkDeadline(order, printer);
    if (deadlineIssue) {
      issues.push(deadlineIssue);
    }

    return {
      feasible: issues.filter(i => i.severity === 'error').length === 0,
      issues
    };
  }

  checkDeadline(order, printer) {
    if (!order.deadline) return null;

    const estimatedEnd = new Date(
      this.currentTime.getTime() + 
      (order.estimatedHours / printer.baseSpeed) * 60 * 60 * 1000
    );

    if (estimatedEnd > order.deadline) {
      const delayHours = ((estimatedEnd - order.deadline) / (1000 * 60 * 60)).toFixed(1);
      return new SchedulingIssue(
        IssueType.DEADLINE_MISS,
        { orderId: order.id, printerId: printer.id },
        `交期超时：预计 ${estimatedEnd.toLocaleString()} 完成，截止日期为 ${order.deadline.toLocaleString()}，延迟 ${delayHours} 小时`,
        'warning'
      );
    }
    return null;
  }

  scheduleOrder(orderId, printerId, startTime = null) {
    const feasibility = this.checkSchedulingFeasibility(orderId, printerId);
    
    if (!feasibility.feasible) {
      feasibility.issues.forEach(issue => this.issues.push(issue));
      return { 
        success: false, 
        issues: feasibility.issues,
        message: '调度不可行，请检查错误'
      };
    }

    const order = this.orders.get(orderId);
    const printer = this.printers.get(printerId);
    const material = this.materials.get(printer.currentMaterial);
    const nozzle = this.nozzles.get(printer.currentNozzle);
    const actualStartTime = startTime || new Date(this.currentTime);

    const task = new ScheduledTask(order, printer, material, nozzle, actualStartTime);
    this.scheduledTasks.set(orderId, task);

    order.status = OrderStatus.SCHEDULED;
    order.assignedPrinterId = printerId;
    order.startTime = actualStartTime;
    printer.currentTask = orderId;

    feasibility.issues.forEach(issue => {
      order.addIssue(issue);
      this.issues.push(issue);
      if (issue.severity === 'warning' && issue.type === IssueType.DEADLINE_MISS) {
        order.markForReview('存在交期超时风险，需要复核');
      }
    });

    this.logEvent('订单已调度', { 
      orderId, 
      printerId, 
      startTime: actualStartTime,
      estimatedEnd: task.estimatedEndTime 
    });

    return {
      success: true,
      task,
      warnings: feasibility.issues.filter(i => i.severity === 'warning')
    };
  }

  // ========== 打印执行与故障处理 ==========

  startPrinting(orderId) {
    const order = this.orders.get(orderId);
    const task = this.scheduledTasks.get(orderId);
    
    if (!order || !task) {
      return { success: false, message: '订单或任务不存在' };
    }

    const printer = this.printers.get(order.assignedPrinterId);
    if (!printer) {
      return { success: false, message: '打印机不存在' };
    }

    order.status = OrderStatus.PRINTING;
    order.startTime = new Date(this.currentTime);
    task.startTime = order.startTime;
    this.logEvent('开始打印', { orderId, printerId: printer.id });
    return { success: true };
  }

  simulatePrintProgress(orderId, elapsedHours) {
    const order = this.orders.get(orderId);
    const task = this.scheduledTasks.get(orderId);
    
    if (!order || !task) return { success: false };
    if (order.status !== OrderStatus.PRINTING) return { success: false };

    const printer = this.printers.get(order.assignedPrinterId);
    const nozzle = this.nozzles.get(printer.currentNozzle);
    const material = this.materials.get(printer.currentMaterial);

    order.actualHours += elapsedHours;
    task.progress = Math.min(100, (order.actualHours / order.estimatedHours) * 100);
    nozzle.use(elapsedHours);

    const materialConsumed = (elapsedHours / order.estimatedHours) * order.printLength;
    const consumeResult = material.consume(materialConsumed);
    order.materialUsed += consumeResult.consumed;

    if (consumeResult.insufficient) {
      this.handleMaterialRunout(order, printer, material);
      return { success: false, completed: false, issue: '材料用尽' };
    }

    const clogFactor = 1 + (task.progress / 100);
    if (nozzle.willClog(clogFactor)) {
      this.handleNozzleClog(order, printer, nozzle);
      return { success: false, completed: false, issue: '喷嘴堵塞' };
    }

    if (order.actualHours >= order.estimatedHours) {
      return this.completeOrder(orderId);
    }

    return { success: true, completed: false, progress: task.progress };
  }

  handleMaterialRunout(order, printer, material) {
    const fault = new FaultEvent(
      `FAULT-${this.idCounter++}`,
      FaultType.MATERIAL_RUNOUT,
      printer.id,
      new Date(this.currentTime),
      { materialId: material.id, orderId: order.id }
    );
    this.faultEvents.push(fault);
    fault.affectedOrders.push(order.id);

    const issue = new SchedulingIssue(
      IssueType.INSUFFICIENT_MATERIAL,
      { orderId: order.id, printerId: printer.id, materialId: material.id },
      `材料用尽：卷 ${material.id} 已耗尽，打印中断`,
      'error'
    );
    this.issues.push(issue);
    order.addIssue(issue);
    order.status = OrderStatus.PAUSED;
    order.markForReview('材料用尽导致打印中断，需要人工复核');
    printer.failureCount++;

    this.logEvent('材料用尽', { 
      orderId: order.id, 
      printerId: printer.id, 
      materialId: material.id 
    });
  }

  handleNozzleClog(order, printer, nozzle) {
    nozzle.clogCount++;
    
    const fault = new FaultEvent(
      `FAULT-${this.idCounter++}`,
      FaultType.NOZZLE_CLOG,
      printer.id,
      new Date(this.currentTime),
      { nozzleId: nozzle.id, orderId: order.id }
    );
    this.faultEvents.push(fault);
    fault.affectedOrders.push(order.id);

    const issue = new SchedulingIssue(
      IssueType.NOZZLE_CLOG,
      { orderId: order.id, printerId: printer.id, nozzleId: nozzle.id },
      `喷嘴堵塞：喷嘴 ${nozzle.id} (${nozzle.size}) 堵塞，磨损度 ${nozzle.getWearPercentage()}%，堵塞次数 ${nozzle.clogCount}`,
      'error'
    );
    this.issues.push(issue);
    order.addIssue(issue);
    order.status = OrderStatus.PAUSED;
    order.markForReview('喷嘴堵塞导致打印中断，需要人工复核处理方案');
    printer.failureCount++;

    this.logEvent('喷嘴堵塞', { 
      orderId: order.id, 
      printerId: printer.id, 
      nozzleId: nozzle.id,
      clogCount: nozzle.clogCount
    });
  }

  completeOrder(orderId) {
    const order = this.orders.get(orderId);
    const task = this.scheduledTasks.get(orderId);
    
    if (!order || !task) return { success: false };

    order.status = OrderStatus.COMPLETED;
    order.endTime = new Date(this.currentTime);
    task.actualEndTime = order.endTime;
    task.progress = 100;

    const printer = this.printers.get(order.assignedPrinterId);
    if (printer) {
      printer.currentTask = null;
      printer.totalPrintHours += order.actualHours;
    }

    if (order.isOverdue(this.currentTime)) {
      const delayHours = ((order.endTime - order.deadline) / (1000 * 60 * 60)).toFixed(1);
      const issue = new SchedulingIssue(
        IssueType.DEADLINE_MISS,
        { orderId: order.id, printerId: order.assignedPrinterId },
        `交期超时：实际完成时间 ${order.endTime.toLocaleString()}，截止日期 ${order.deadline.toLocaleString()}，延迟 ${delayHours} 小时`,
        'error'
      );
      this.issues.push(issue);
      order.addIssue(issue);
    }

    this.completedTasks.push(task);
    this.scheduledTasks.delete(orderId);

    this.logEvent('订单完成', { 
      orderId, 
      actualHours: order.actualHours,
      materialUsed: order.materialUsed 
    });

    return { success: true, completed: true, order };
  }

  processFaultImpact(fault) {
    const printer = this.printers.get(fault.printerId);
    if (!printer || !printer.currentTask) return;

    const orderId = printer.currentTask;
    const order = this.orders.get(orderId);
    if (order) {
      fault.affectedOrders.push(orderId);
      order.status = OrderStatus.PAUSED;
      order.markForReview(`故障 ${fault.getTypeName()} 影响，需要复核`);
    }
  }

  resolveFault(faultId, notes = '', actualDowntime = null) {
    const fault = this.faultEvents.find(f => f.id === faultId);
    if (!fault) return { success: false };

    fault.resolve(notes, actualDowntime);
    
    fault.affectedOrders.forEach(orderId => {
      const order = this.orders.get(orderId);
      if (order && order.status === OrderStatus.PAUSED) {
        order.status = OrderStatus.PENDING;
        order.assignedPrinterId = null;
      }
    });

    this.logEvent('故障已解决', { faultId, downtime: fault.downtimeMinutes });
    return { success: true, fault };
  }

  // ========== 时间控制 ==========

  advanceTime(hours) {
    const ms = hours * 60 * 60 * 1000;
    this.currentTime = new Date(this.currentTime.getTime() + ms);
    this.logEvent('时间推进', { hours, newTime: this.currentTime });
    return this.currentTime;
  }

  setCurrentTime(time) {
    this.currentTime = new Date(time);
    this.logEvent('设置当前时间', { newTime: this.currentTime });
    return this.currentTime;
  }

  // ========== 日志 ==========

  logEvent(type, details = {}) {
    this.eventLog.push({
      timestamp: new Date(this.currentTime),
      type,
      details
    });
  }

  getEventLog(filterType = null) {
    if (!filterType) return this.eventLog;
    return this.eventLog.filter(e => e.type === filterType);
  }
}

const _schedulerExports = {
  ValidationResult,
  SchedulingEngine
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = _schedulerExports;
} else {
  Object.assign(window, _schedulerExports);
}

})();

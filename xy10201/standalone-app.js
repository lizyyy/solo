const STATUS_FLOW = {
  REPLENISHMENT: {
    PENDING: ['APPROVED', 'REJECTED'],
    APPROVED: ['FULFILLED'],
    REJECTED: [],
    FULFILLED: []
  }
};

const STATUS_LABELS = {
  PENDING: '待审核',
  APPROVED: '已通过',
  REJECTED: '已拒绝',
  FULFILLED: '已补货'
};

const STATUS_COLORS = {
  PENDING: '#f59e0b',
  APPROVED: '#10b981',
  REJECTED: '#ef4444',
  FULFILLED: '#3b82f6'
};

const STOCK_STATUS = {
  NORMAL: { label: '正常', color: '#10b981' },
  LOW_STOCK: { label: '库存不足', color: '#f59e0b' },
  OUT_OF_STOCK: { label: '已断货', color: '#ef4444' },
  OVER_STOCK: { label: '过量', color: '#8b5cf6' }
};

const DEFAULT_DATA = {
  departments: [
    { id: 1, name: '口腔内科', code: 'NE', description: '龋病、牙髓病等' },
    { id: 2, name: '口腔外科', code: 'OS', description: '拔牙、种植等' },
    { id: 3, name: '口腔修复', code: 'PR', description: '义齿、冠桥等' },
    { id: 4, name: '口腔正畸', code: 'OR', description: '牙齿矫正等' }
  ],
  materials: [
    { id: 1, name: '高速金刚砂车针', code: 'B001', unit: '支', category: '口腔内科',
      quantity: 30, warning_threshold: 20, max_threshold: 100, unit_price: 15.5 },
    { id: 2, name: '一次性检查盘', code: 'C001', unit: '个', category: '综合',
      quantity: 5, warning_threshold: 10, max_threshold: 50, unit_price: 3.0 },
    { id: 3, name: '光固化复合树脂', code: 'R001', unit: 'ml', category: '口腔修复',
      quantity: 3, warning_threshold: 10, max_threshold: 50, unit_price: 85.0 },
    { id: 4, name: '牙科粘接剂', code: 'A001', unit: '支', category: '口腔修复',
      quantity: 8, warning_threshold: 5, max_threshold: 30, unit_price: 120.0 },
    { id: 5, name: '树脂抛光条', code: 'P001', unit: '片', category: '口腔修复',
      quantity: 2, warning_threshold: 10, max_threshold: 100, unit_price: 8.5 },
    { id: 6, name: '根管锉K型', code: 'K001', unit: '支', category: '口腔内科',
      quantity: 15, warning_threshold: 20, max_threshold: 100, unit_price: 25.0 },
    { id: 7, name: '牙胶尖', code: 'G001', unit: '盒', category: '口腔内科',
      quantity: 8, warning_threshold: 5, max_threshold: 30, unit_price: 45.0 },
    { id: 8, name: '碧兰麻', code: 'M001', unit: '支', category: '口腔外科',
      quantity: 0, warning_threshold: 10, max_threshold: 50, unit_price: 18.0 },
    { id: 9, name: '明胶海绵', code: 'S001', unit: '片', category: '口腔外科',
      quantity: 12, warning_threshold: 10, max_threshold: 50, unit_price: 5.5 },
    { id: 10, name: '正畸托槽', code: 'B002', unit: '副', category: '口腔正畸',
      quantity: 6, warning_threshold: 10, max_threshold: 30, unit_price: 200.0 }
  ],
  treatments: [
    { id: 1, name: '常规补牙', code: 'T001', department_id: 1, description: '浅/中龋充填治疗' },
    { id: 2, name: '根管治疗', code: 'T002', department_id: 1, description: '牙髓炎/根尖周炎治疗' },
    { id: 3, name: '复杂牙拔除', code: 'T003', department_id: 2, description: '智齿/阻生齿拔除' },
    { id: 4, name: '超声波洁牙', code: 'T004', department_id: 1, description: '牙周洁治' },
    { id: 5, name: '牙齿美白', code: 'T005', department_id: 3, description: '冷光美白' }
  ],
  treatmentMaterials: [
    { id: 1, treatment_id: 1, material_id: 1, quantity: 2 },
    { id: 2, treatment_id: 1, material_id: 2, quantity: 1 },
    { id: 3, treatment_id: 1, material_id: 3, quantity: 5 },
    { id: 4, treatment_id: 1, material_id: 4, quantity: 1 },
    { id: 5, treatment_id: 1, material_id: 5, quantity: 2 },
    { id: 6, treatment_id: 2, material_id: 6, quantity: 4 },
    { id: 7, treatment_id: 2, material_id: 7, quantity: 2 },
    { id: 8, treatment_id: 2, material_id: 2, quantity: 1 },
    { id: 9, treatment_id: 3, material_id: 8, quantity: 2 },
    { id: 10, treatment_id: 3, material_id: 9, quantity: 3 },
    { id: 11, treatment_id: 3, material_id: 2, quantity: 1 },
    { id: 12, treatment_id: 4, material_id: 2, quantity: 1 }
  ],
  consumptionRecords: [],
  replenishmentRequests: [],
  auditRecords: [],
  inventorySnapshots: [],
  operationLogs: []
};

function getStockStatus(quantity, warningThreshold, maxThreshold = null) {
  if (quantity <= 0) return 'OUT_OF_STOCK';
  if (quantity < warningThreshold) return 'LOW_STOCK';
  if (maxThreshold && quantity > maxThreshold) return 'OVER_STOCK';
  return 'NORMAL';
}

function canTransition(current, next) {
  const allowed = STATUS_FLOW.REPLENISHMENT[current] || [];
  return allowed.includes(next);
}

function generateRequestNo() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  return `RP-${date}-${seq}`;
}

function nowISO() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

class DentalStore {
  constructor() {
    this.load();
  }

  load() {
    const saved = localStorage.getItem('dental_store_data');
    if (saved) {
      this.data = JSON.parse(saved);
    } else {
      this.data = JSON.parse(JSON.stringify(DEFAULT_DATA));
      this.save();
    }
  }

  save() {
    localStorage.setItem('dental_store_data', JSON.stringify(this.data));
  }

  reset() {
    this.data = JSON.parse(JSON.stringify(DEFAULT_DATA));
    this.save();
  }

  getMaterials() {
    return this.data.materials.map(m => ({
      ...m,
      stock_status: getStockStatus(m.quantity, m.warning_threshold, m.max_threshold),
      stock_label: STOCK_STATUS[getStockStatus(m.quantity, m.warning_threshold, m.max_threshold)].label,
      stock_color: STOCK_STATUS[getStockStatus(m.quantity, m.warning_threshold, m.max_threshold)].color
    }));
  }

  getLowStockMaterials() {
    return this.getMaterials().filter(m =>
      m.stock_status === 'LOW_STOCK' || m.stock_status === 'OUT_OF_STOCK'
    );
  }

  getDepartments() {
    return this.data.departments;
  }

  getTreatments(departmentId = null) {
    let treatments = this.data.treatments;
    if (departmentId) {
      treatments = treatments.filter(t => t.department_id === parseInt(departmentId));
    }
    return treatments.map(t => ({
      ...t,
      department_name: this.data.departments.find(d => d.id === t.department_id)?.name
    }));
  }

  getTreatmentBindings(treatmentId) {
    const bindings = this.data.treatmentMaterials.filter(b =>
      b.treatment_id === parseInt(treatmentId)
    );
    return bindings.map(b => {
      const material = this.data.materials.find(m => m.id === b.material_id);
      const stockStatus = getStockStatus(material.quantity, material.warning_threshold);
      return {
        ...b,
        material_name: material.name,
        material_code: material.code,
        unit: material.unit,
        current_stock: material.quantity,
        warning_threshold: material.warning_threshold,
        stock_status: stockStatus,
        stock_label: STOCK_STATUS[stockStatus].label,
        stock_color: STOCK_STATUS[stockStatus].color
      };
    });
  }

  checkTreatmentStock(treatmentId, quantity = 1) {
    const bindings = this.getTreatmentBindings(treatmentId);
    const canExecute = bindings.every(b => b.current_stock >= b.quantity * quantity);
    const insufficientItems = bindings.filter(b => b.current_stock < b.quantity * quantity);
    return {
      canExecute,
      totalBindings: bindings.length,
      insufficientCount: insufficientItems.length,
      bindings,
      insufficientItems
    };
  }

  consumeByTreatment(treatmentId, patientCount = 1, operator, patientName = '') {
    const check = this.checkTreatmentStock(treatmentId, patientCount);
    if (!check.canExecute) {
      const missing = check.insufficientItems.map(i =>
        `${i.material_name}(需要${i.quantity * patientCount}${i.unit}，现有${i.current_stock}${i.unit})`
      ).join('、');
      throw new Error(`库存不足，无法执行：${missing}`);
    }

    const treatment = this.data.treatments.find(t => t.id === parseInt(treatmentId));
    const records = [];

    check.bindings.forEach(b => {
      const material = this.data.materials.find(m => m.id === b.material_id);
      const before = material.quantity;
      const consumed = b.quantity * patientCount;
      material.quantity -= consumed;
      const after = material.quantity;

      const record = {
        id: this.data.consumptionRecords.length + 1,
        consumption_type: 'TREATMENT',
        material_id: b.material_id,
        material_name: material.name,
        department_id: treatment.department_id,
        department_name: this.data.departments.find(d => d.id === treatment.department_id)?.name,
        treatment_id: treatmentId,
        treatment_name: treatment.name,
        quantity: consumed,
        unit: material.unit,
        unit_price: material.unit_price,
        total_amount: consumed * material.unit_price,
        patient_name: patientName,
        operator,
        created_at: nowISO()
      };
      records.push(record);
      this.data.consumptionRecords.push(record);

      this.data.inventorySnapshots.push({
        id: this.data.inventorySnapshots.length + 1,
        material_id: b.material_id,
        material_name: material.name,
        before_quantity: before,
        change_quantity: -consumed,
        after_quantity: after,
        change_reason: `诊疗消耗：${treatment.name}`,
        reference_type: 'CONSUMPTION',
        reference_id: record.id,
        operator,
        created_at: nowISO()
      });

      this.data.operationLogs.push({
        id: this.data.operationLogs.length + 1,
        module: 'CONSUMPTION',
        action: '消耗',
        target_type: 'MATERIAL',
        target_id: b.material_id,
        before_data: JSON.stringify({ quantity: before }),
        after_data: JSON.stringify({ quantity: after }),
        operator,
        created_at: nowISO()
      });
    });

    this.save();
    return { success: true, records };
  }

  consumeManual(materialId, quantity, operator, reason = '') {
    const material = this.data.materials.find(m => m.id === parseInt(materialId));
    if (!material) throw new Error('耗材不存在');
    if (material.quantity < quantity) {
      throw new Error(`库存不足：当前${material.quantity}${material.unit}，需要${quantity}${material.unit}`);
    }

    const before = material.quantity;
    material.quantity -= quantity;
    const after = material.quantity;

    const record = {
      id: this.data.consumptionRecords.length + 1,
      consumption_type: 'MANUAL',
      material_id: parseInt(materialId),
      material_name: material.name,
      department_id: null,
      department_name: null,
      treatment_id: null,
      treatment_name: null,
      quantity,
      unit: material.unit,
      unit_price: material.unit_price,
      total_amount: quantity * material.unit_price,
      patient_name: null,
      operator,
      created_at: nowISO()
    };
    this.data.consumptionRecords.push(record);

    this.data.inventorySnapshots.push({
      id: this.data.inventorySnapshots.length + 1,
      material_id: parseInt(materialId),
      material_name: material.name,
      before_quantity: before,
      change_quantity: -quantity,
      after_quantity: after,
      change_reason: reason || '手动消耗',
      reference_type: 'CONSUMPTION',
      reference_id: record.id,
      operator,
      created_at: nowISO()
    });

    this.data.operationLogs.push({
      id: this.data.operationLogs.length + 1,
      module: 'CONSUMPTION',
      action: '手动消耗',
      target_type: 'MATERIAL',
      target_id: parseInt(materialId),
      before_data: JSON.stringify({ quantity: before }),
      after_data: JSON.stringify({ quantity: after }),
      operator,
      created_at: nowISO()
    });

    this.save();
    return { success: true, record };
  }

  createReplenishmentRequest(materialId, quantity, requester, reason = '') {
    const material = this.data.materials.find(m => m.id === parseInt(materialId));
    if (!material) throw new Error('耗材不存在');

    const request = {
      id: this.data.replenishmentRequests.length + 1,
      request_no: generateRequestNo(),
      material_id: parseInt(materialId),
      material_name: material.name,
      unit: material.unit,
      unit_price: material.unit_price,
      requested_quantity: parseInt(quantity),
      approved_quantity: null,
      status: 'PENDING',
      status_label: STATUS_LABELS.PENDING,
      status_color: STATUS_COLORS.PENDING,
      department_id: null,
      department_name: null,
      requester,
      reason,
      reject_reason: null,
      created_at: nowISO(),
      fulfilled_at: null
    };

    this.data.replenishmentRequests.push(request);

    this.data.operationLogs.push({
      id: this.data.operationLogs.length + 1,
      module: 'REPLENISHMENT',
      action: '创建',
      target_type: 'REPLENISHMENT',
      target_id: request.id,
      before_data: null,
      after_data: JSON.stringify(request),
      operator: requester,
      created_at: nowISO()
    });

    this.save();
    return request;
  }

  getReplenishmentRequests(status = null) {
    let requests = this.data.replenishmentRequests;
    if (status) {
      requests = requests.filter(r => r.status === status);
    }
    return requests.map(r => ({ ...r }));
  }

  getReplenishmentRequest(id) {
    const request = this.data.replenishmentRequests.find(r => r.id === parseInt(id));
    if (!request) return null;
    const audits = this.data.auditRecords.filter(a => a.request_id === parseInt(id));
    return {
      ...request,
      audit_history: audits
    };
  }

  approveRequest(id, approvedQuantity, auditor) {
    const request = this.data.replenishmentRequests.find(r => r.id === parseInt(id));
    if (!request) throw new Error('申请不存在');
    if (!canTransition(request.status, 'APPROVED')) {
      throw new Error(`当前状态"${STATUS_LABELS[request.status]}"不允许通过`);
    }

    request.status = 'APPROVED';
    request.status_label = STATUS_LABELS.APPROVED;
    request.status_color = STATUS_COLORS.APPROVED;
    request.approved_quantity = parseInt(approvedQuantity);

    this.data.auditRecords.push({
      id: this.data.auditRecords.length + 1,
      request_id: parseInt(id),
      action: 'APPROVED',
      action_label: '审核通过',
      auditor,
      approved_quantity: parseInt(approvedQuantity),
      reason: null,
      created_at: nowISO()
    });

    this.save();
    return request;
  }

  rejectRequest(id, reason, auditor) {
    const request = this.data.replenishmentRequests.find(r => r.id === parseInt(id));
    if (!request) throw new Error('申请不存在');
    if (!canTransition(request.status, 'REJECTED')) {
      throw new Error(`当前状态"${STATUS_LABELS[request.status]}"不允许拒绝`);
    }

    request.status = 'REJECTED';
    request.status_label = STATUS_LABELS.REJECTED;
    request.status_color = STATUS_COLORS.REJECTED;
    request.reject_reason = reason;

    this.data.auditRecords.push({
      id: this.data.auditRecords.length + 1,
      request_id: parseInt(id),
      action: 'REJECTED',
      action_label: '审核拒绝',
      auditor,
      approved_quantity: null,
      reason,
      created_at: nowISO()
    });

    this.save();
    return request;
  }

  fulfillRequest(id, operator) {
    const request = this.data.replenishmentRequests.find(r => r.id === parseInt(id));
    if (!request) throw new Error('申请不存在');
    if (!canTransition(request.status, 'FULFILLED')) {
      throw new Error(`当前状态"${STATUS_LABELS[request.status]}"不允许完成补货`);
    }

    const material = this.data.materials.find(m => m.id === request.material_id);
    const before = material.quantity;
    material.quantity += request.approved_quantity;
    const after = material.quantity;

    request.status = 'FULFILLED';
    request.status_label = STATUS_LABELS.FULFILLED;
    request.status_color = STATUS_COLORS.FULFILLED;
    request.fulfilled_at = nowISO();

    this.data.auditRecords.push({
      id: this.data.auditRecords.length + 1,
      request_id: parseInt(id),
      action: 'FULFILLED',
      action_label: '完成补货',
      auditor: operator,
      approved_quantity: request.approved_quantity,
      reason: null,
      created_at: nowISO()
    });

    this.data.inventorySnapshots.push({
      id: this.data.inventorySnapshots.length + 1,
      material_id: request.material_id,
      material_name: request.material_name,
      before_quantity: before,
      change_quantity: request.approved_quantity,
      after_quantity: after,
      change_reason: `补货入库 [${request.request_no}]`,
      reference_type: 'REPLENISHMENT',
      reference_id: request.id,
      operator,
      created_at: nowISO()
    });

    this.data.operationLogs.push({
      id: this.data.operationLogs.length + 1,
      module: 'INVENTORY',
      action: '补货入库',
      target_type: 'MATERIAL',
      target_id: request.material_id,
      before_data: JSON.stringify({ quantity: before }),
      after_data: JSON.stringify({ quantity: after }),
      operator,
      created_at: nowISO()
    });

    this.save();
    return request;
  }

  getMaterialHistory(materialId) {
    return this.data.inventorySnapshots
      .filter(s => s.material_id === parseInt(materialId))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  getConsumptionRecords(limit = 50) {
    return this.data.consumptionRecords
      .slice(-limit)
      .reverse();
  }

  getOperationLogs(limit = 50) {
    return this.data.operationLogs
      .slice(-limit)
      .reverse();
  }

  getDashboardStats() {
    const materials = this.getMaterials();
    const lowStock = materials.filter(m =>
      m.stock_status === 'LOW_STOCK' || m.stock_status === 'OUT_OF_STOCK'
    );
    const outOfStock = materials.filter(m => m.stock_status === 'OUT_OF_STOCK');

    const requests = this.data.replenishmentRequests;
    const pendingCount = requests.filter(r => r.status === 'PENDING').length;
    const approvedCount = requests.filter(r => r.status === 'APPROVED').length;
    const fulfilledCount = requests.filter(r => r.status === 'FULFILLED').length;

    const totalConsumption = this.data.consumptionRecords.reduce((sum, r) => sum + r.total_amount, 0);

    return {
      totalMaterials: materials.length,
      lowStockCount: lowStock.length,
      outOfStockCount: outOfStock.length,
      pendingRequests: pendingCount,
      approvedRequests: approvedCount,
      fulfilledRequests: fulfilledCount,
      totalConsumption: totalConsumption.toFixed(2)
    };
  }

  getFlowStatus() {
    const lowStock = this.getLowStockMaterials();
    const pending = this.data.replenishmentRequests.filter(r => r.status === 'PENDING');
    const approved = this.data.replenishmentRequests.filter(r => r.status === 'APPROVED');

    return {
      material_status: {
        normal: this.getMaterials().length - lowStock.length,
        low_stock: lowStock.filter(m => m.stock_status === 'LOW_STOCK').length,
        out_of_stock: lowStock.filter(m => m.stock_status === 'OUT_OF_STOCK').length
      },
      request_status: {
        pending: pending.length,
        approved: approved.length,
        fulfilled: this.data.replenishmentRequests.filter(r => r.status === 'FULFILLED').length,
        rejected: this.data.replenishmentRequests.filter(r => r.status === 'REJECTED').length
      },
      next_action: pending.length > 0 ? '审核' :
        approved.length > 0 ? '补货' :
        lowStock.length > 0 ? '申请补货' : '正常运营'
    };
  }

  getBlockages() {
    const blockages = [];
    const lowStock = this.getLowStockMaterials();
    const pending = this.data.replenishmentRequests.filter(r => r.status === 'PENDING');
    const approved = this.data.replenishmentRequests.filter(r => r.status === 'APPROVED');

    if (lowStock.length > 0) {
      blockages.push({
        type: 'LOW_STOCK',
        title: '库存预警',
        severity: lowStock.some(m => m.stock_status === 'OUT_OF_STOCK') ? 'high' : 'medium',
        message: `${lowStock.length} 种耗材库存不足`,
        details: lowStock.slice(0, 5).map(m => `${m.name}（${m.quantity}${m.unit}）`),
        action: '建议申请补货'
      });
    }

    if (pending.length > 0) {
      blockages.push({
        type: 'PENDING_REVIEW',
        title: '待审核申请',
        severity: 'medium',
        message: `${pending.length} 个补货申请等待审核`,
        details: pending.slice(0, 3).map(r => `${r.material_name} x ${r.requested_quantity}`),
        action: '请护士长审核'
      });
    }

    if (approved.length > 0) {
      blockages.push({
        type: 'PENDING_FULFILL',
        title: '待补货入库',
        severity: 'low',
        message: `${approved.length} 个申请已通过等待入库`,
        details: approved.slice(0, 3).map(r => `${r.material_name} x ${r.approved_quantity}`),
        action: '请库管确认入库'
      });
    }

    return blockages;
  }

  getSuggestions() {
    const suggestions = [];
    const blockages = this.getBlockages();

    blockages.forEach(b => {
      suggestions.push({
        type: b.type,
        priority: b.severity === 'high' ? 1 : b.severity === 'medium' ? 2 : 3,
        title: b.title,
        message: b.message,
        action: b.action
      });
    });

    const lowStock = this.getLowStockMaterials();
    if (lowStock.length === 0 && blockages.length === 0) {
      suggestions.push({
        type: 'NORMAL',
        priority: 99,
        title: '运营正常',
        message: '所有耗材库存充足，无待处理事项',
        action: '继续保持'
      });
    }

    return suggestions.sort((a, b) => a.priority - b.priority);
  }
}

window.DentalStore = DentalStore;
window.STATUS_LABELS = STATUS_LABELS;
window.STATUS_COLORS = STATUS_COLORS;
window.STOCK_STATUS = STOCK_STATUS;
window.STATUS_FLOW = STATUS_FLOW;
window.canTransition = canTransition;

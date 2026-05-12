const db = require('../config/db');
const SparePart = require('../models/sparePart');
const Equipment = require('../models/equipment');
const Consumption = require('../models/consumption');
const AlternativePart = require('../models/alternativePart');
const PurchaseOrder = require('../models/purchaseOrder');
const Reception = require('../models/reception');
const ManualCorrection = require('../models/manualCorrection');
const { RECEPTION_STATUS, REPLACEMENT_STATUS } = require('../utils/constants');
const alertService = require('./alertService');

const createReception = (data) => {
  if (data.idempotentKey) {
    const existing = Reception.findByIdempotentKey(data.idempotentKey);
    if (existing) {
      return {
        reception: existing,
        history: Reception.getHistory(existing.id),
        isDuplicate: true,
        message: '幂等处理：领用单已存在'
      };
    }
  }
  
  const part = SparePart.findById(data.partId);
  if (!part) {
    throw new Error(`备件不存在: ${data.partId}`);
  }
  
  if (data.equipmentId) {
    const equipment = Equipment.findById(data.equipmentId);
    if (!equipment) {
      throw new Error(`设备不存在: ${data.equipmentId}`);
    }
  }
  
  const receptionId = Reception.create({
    ...data,
    status: RECEPTION_STATUS.PENDING,
    currentStep: 'CREATE'
  });
  
  Reception.addHistory(receptionId, null, RECEPTION_STATUS.PENDING, data.operator || 'system', '创建领用单');
  
  const reception = Reception.findById(receptionId);
  return {
    reception,
    history: Reception.getHistory(receptionId),
    isDuplicate: false,
    message: '领用单创建成功'
  };
};

const approveReception = (receptionId, operator = 'system') => {
  const reception = Reception.findById(receptionId);
  if (!reception) throw new Error('领用单不存在');
  
  if (reception.status !== RECEPTION_STATUS.PENDING) {
    return {
      reception,
      history: Reception.getHistory(receptionId),
      success: false,
      message: `当前状态 ${reception.status} 不可审批`
    };
  }
  
  const fromStatus = reception.status;
  Reception.update(receptionId, {
    status: RECEPTION_STATUS.APPROVING,
    currentStep: 'APPROVE'
  });
  Reception.addHistory(receptionId, fromStatus, RECEPTION_STATUS.APPROVING, operator, '领用单审批通过，进入出库处理');
  
  return {
    reception: Reception.findById(receptionId),
    history: Reception.getHistory(receptionId),
    success: true,
    message: '审批通过'
  };
};

const processReception = (receptionId, operator = 'system') => {
  const reception = Reception.findById(receptionId);
  if (!reception) throw new Error('领用单不存在');
  
  if (reception.status !== RECEPTION_STATUS.APPROVING) {
    return {
      reception,
      history: Reception.getHistory(receptionId),
      success: false,
      message: `当前状态 ${reception.status} 不可处理`
    };
  }
  
  const part = SparePart.findById(reception.part_id);
  const needed = reception.requested_quantity;
  
  if (part.current_stock >= needed) {
    const fromStatus = reception.status;
    Reception.update(receptionId, {
      status: RECEPTION_STATUS.PROCESSING,
      currentStep: 'PROCESS'
    });
    Reception.addHistory(receptionId, fromStatus, RECEPTION_STATUS.PROCESSING, operator, '库存充足，准备出库');
    
    return {
      reception: Reception.findById(receptionId),
      history: Reception.getHistory(receptionId),
      success: true,
      hasAlternative: false,
      canProcess: true,
      message: '库存充足，进入出库处理'
    };
  }
  
  const inTransit = PurchaseOrder.getInTransitQuantity(reception.part_id);
  const alternatives = reception.equipment_id
    ? AlternativePart.findCompatibleForEquipment(reception.part_id, reception.equipment_id)
    : AlternativePart.findAlternatives(reception.part_id);
  
  const availableAlternatives = alternatives
    .filter(a => a.compatibility_status !== REPLACEMENT_STATUS.INCOMPATIBLE)
    .filter(a => a.alt_stock > 0)
    .map(a => ({
      id: a.alternative_part_id,
      code: a.alt_code,
      name: a.alt_name,
      stock: a.alt_stock,
      compatibility: a.compatibility_status,
      limitedEquipments: a.limit_equipment_ids ? JSON.parse(a.limit_equipment_ids) : null
    }));
  
  if (availableAlternatives.length > 0) {
    const fromStatus = reception.status;
    Reception.update(receptionId, {
      status: RECEPTION_STATUS.NEED_ALTERNATIVE,
      currentStep: 'CHECK_ALTERNATIVE'
    });
    Reception.addHistory(receptionId, fromStatus, RECEPTION_STATUS.NEED_ALTERNATIVE, operator,
      `库存不足。当前库存: ${part.current_stock}, 需要: ${needed}, 在途: ${inTransit}`);
    
    return {
      reception: Reception.findById(receptionId),
      history: Reception.getHistory(receptionId),
      success: true,
      canProcess: false,
      hasAlternative: true,
      alternatives: availableAlternatives,
      inTransit,
      currentStock: part.current_stock,
      needed,
      message: '库存不足，有可用替代件'
    };
  }
  
  const fromStatus = reception.status;
  Reception.update(receptionId, {
    status: RECEPTION_STATUS.FAILED,
    currentStep: 'PROCESS_FAILED'
  });
  Reception.addHistory(receptionId, fromStatus, RECEPTION_STATUS.FAILED, operator,
    `库存不足且无替代件。当前库存: ${part.current_stock}, 需要: ${needed}, 在途: ${inTransit}`);
  
  return {
    reception: Reception.findById(receptionId),
    history: Reception.getHistory(receptionId),
    success: false,
    canProcess: false,
    hasAlternative: false,
    inTransit,
    currentStock: part.current_stock,
    needed,
    message: '库存不足且无替代件，领用失败'
  };
};

const useAlternative = (receptionId, alternativePartId, operator = 'system') => {
  const reception = Reception.findById(receptionId);
  if (!reception) throw new Error('领用单不存在');
  
  if (reception.status !== RECEPTION_STATUS.NEED_ALTERNATIVE) {
    return {
      reception,
      history: Reception.getHistory(receptionId),
      success: false,
      message: `当前状态 ${reception.status} 不可使用替代件`
    };
  }
  
  const altPart = SparePart.findById(alternativePartId);
  if (!altPart) throw new Error('替代备件不存在');
  
  if (altPart.current_stock < reception.requested_quantity) {
    return {
      reception,
      history: Reception.getHistory(receptionId),
      success: false,
      message: `替代件库存不足: ${altPart.current_stock} < ${reception.requested_quantity}`
    };
  }
  
  const fromStatus = reception.status;
  Reception.update(receptionId, {
    status: RECEPTION_STATUS.PROCESSING,
    currentStep: 'USE_ALTERNATIVE',
    usedAlternativePartId: alternativePartId
  });
  Reception.addHistory(receptionId, fromStatus, RECEPTION_STATUS.PROCESSING, operator,
    `使用替代件: ${altPart.code} ${altPart.name}, 库存: ${altPart.current_stock}`);
  
  return {
    reception: Reception.findById(receptionId),
    history: Reception.getHistory(receptionId),
    success: true,
    alternativePart: altPart,
    message: '已选择替代件，进入出库处理'
  };
};

const completeReception = (receptionId, operator = 'system') => {
  const reception = Reception.findById(receptionId);
  if (!reception) throw new Error('领用单不存在');
  
  if (reception.status !== RECEPTION_STATUS.PROCESSING) {
    return {
      reception,
      history: Reception.getHistory(receptionId),
      success: false,
      message: `当前状态 ${reception.status} 不可完成`
    };
  }
  
  const transaction = db.transaction(() => {
    const partId = reception.used_alternative_part_id || reception.part_id;
    const part = SparePart.findById(partId);
    const needed = reception.requested_quantity;
    
    if (part.current_stock < needed) {
      throw new Error('库存不足，无法完成出库');
    }
    
    SparePart.updateStock(partId, -needed);
    
    Consumption.create({
      partId,
      equipmentId: reception.equipment_id,
      quantity: needed,
      consumptionDate: Date.now()
    });
    
    const fromStatus = reception.status;
    Reception.update(receptionId, {
      status: RECEPTION_STATUS.COMPLETED,
      currentStep: 'COMPLETE',
      actualQuantity: needed
    });
    Reception.addHistory(receptionId, fromStatus, RECEPTION_STATUS.COMPLETED, operator,
      `出库完成: ${part.code} ${part.name}, 数量: ${needed}`);
    
    return { part, consumed: needed };
  });
  
  try {
    const result = transaction();
    alertService.checkAndCreateAlert(reception.used_alternative_part_id || reception.part_id);
    
    return {
      reception: Reception.findById(receptionId),
      history: Reception.getHistory(receptionId),
      success: true,
      part: result.part,
      consumed: result.consumed,
      message: '领用完成'
    };
  } catch (e) {
    const fromStatus = reception.status;
    Reception.update(receptionId, {
      status: RECEPTION_STATUS.FAILED,
      currentStep: 'COMPLETE_FAILED'
    });
    Reception.addHistory(receptionId, fromStatus, RECEPTION_STATUS.FAILED, operator, `出库失败: ${e.message}`);
    
    return {
      reception: Reception.findById(receptionId),
      history: Reception.getHistory(receptionId),
      success: false,
      message: `出库失败: ${e.message}`
    };
  }
};

const callbackReception = (receptionId, callbackKey, operator = 'system') => {
  const reception = Reception.findById(receptionId);
  if (!reception) throw new Error('领用单不存在');
  
  const now = Date.now();
  
  if (reception.idempotent_key && reception.idempotent_key === callbackKey) {
    Reception.update(receptionId, {
      callbackCount: reception.callback_count + 1,
      lastCallbackAt: now
    });
    Reception.addHistory(receptionId, reception.status, reception.status, operator,
      `幂等回调重复执行: ${callbackKey}, 第 ${reception.callback_count + 1} 次`);
    
    return {
      reception: Reception.findById(receptionId),
      history: Reception.getHistory(receptionId),
      isDuplicate: true,
      message: `回调已存在，已记录第 ${reception.callback_count + 1} 次`
    };
  }
  
  const newCount = reception.callback_count + 1;
  const fromStatus = reception.status;
  Reception.update(receptionId, {
    idempotentKey: callbackKey,
    callbackCount: newCount,
    lastCallbackAt: now
  });
  Reception.addHistory(receptionId, fromStatus, reception.status, operator,
    `收到回调: ${callbackKey}, 第 ${newCount} 次`);
  
  return {
    reception: Reception.findById(receptionId),
    history: Reception.getHistory(receptionId),
    isDuplicate: false,
    message: '回调记录成功'
  };
};

const manualCorrect = (targetType, targetId, beforeValue, afterValue, operator, reason) => {
  const diff = {};
  Object.keys(afterValue).forEach(key => {
    if (JSON.stringify(beforeValue[key]) !== JSON.stringify(afterValue[key])) {
      diff[key] = { before: beforeValue[key], after: afterValue[key] };
    }
  });
  
  const correctionId = ManualCorrection.create({
    targetType,
    targetId,
    beforeValue,
    afterValue,
    diff,
    operator,
    reason
  });
  
  return {
    id: correctionId,
    diff,
    message: '人工修正已记录'
  };
};

const getReceptionDetail = (receptionId) => {
  const reception = Reception.findById(receptionId);
  if (!reception) return null;
  
  const history = Reception.getHistory(receptionId);
  const part = SparePart.findById(reception.part_id);
  const equipment = reception.equipment_id ? Equipment.findById(reception.equipment_id) : null;
  const altPart = reception.used_alternative_part_id ? SparePart.findById(reception.used_alternative_part_id) : null;
  
  return {
    reception,
    history,
    part,
    equipment,
    altPart
  };
};

module.exports = {
  createReception,
  approveReception,
  processReception,
  useAlternative,
  completeReception,
  callbackReception,
  manualCorrect,
  getReceptionDetail
};

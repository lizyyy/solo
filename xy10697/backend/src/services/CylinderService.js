const storage = require('../storage/memoryStorage');
const { CylinderStatus, StatusTransitions } = require('../models/CylinderStatus');
const { addDays, isBefore } = require('date-fns');

class CylinderService {
  static validateStatusTransition(fromStatus, toStatus) {
    const allowedTransitions = StatusTransitions[fromStatus] || [];
    return allowedTransitions.includes(toStatus);
  }

  static createCylinder(data, operator = 'system') {
    const { cylinderNo, requestId } = data;

    if (requestId && storage.isDuplicateRequest(requestId)) {
      const existing = storage.getCylinderByNo(cylinderNo);
      return { success: true, data: existing, isDuplicate: true };
    }

    if (storage.getCylinderByNo(cylinderNo)) {
      return { success: false, error: '气瓶编号已存在' };
    }

    const cylinder = storage.addCylinder({
      ...data,
      currentStatus: CylinderStatus.EMPTY
    });

    storage.addHistory({
      cylinderId: cylinder.id,
      cylinderNo: cylinder.cylinderNo,
      fromStatus: null,
      toStatus: CylinderStatus.EMPTY,
      changeReason: '气瓶初始化',
      operator,
      newValues: { cylinderNo, specification: data.specification },
      requestId
    });

    return { success: true, data: cylinder };
  }

  static transitionStatus(cylinderId, toStatus, options = {}) {
    const { operator = 'system', reason, batchNo, customer, remark, requestId } = options;

    if (requestId && storage.isDuplicateRequest(requestId)) {
      const histories = storage.getHistoriesByCylinder(cylinderId);
      const latest = histories[0];
      return { success: true, data: latest, isDuplicate: true };
    }

    const cylinder = storage.getCylinder(cylinderId);
    if (!cylinder) {
      return { success: false, error: '气瓶不存在' };
    }

    if (cylinder.isScrapped) {
      return { success: false, error: '气瓶已报废，无法变更状态' };
    }

    if (!this.validateStatusTransition(cylinder.currentStatus, toStatus)) {
      return { success: false, error: `不允许从 ${cylinder.currentStatus} 变更到 ${toStatus}` };
    }

    const oldValues = {
      currentStatus: cylinder.currentStatus,
      currentBatchNo: cylinder.currentBatchNo,
      currentCustomer: cylinder.currentCustomer
    };

    const updateData = { currentStatus: toStatus };
    if (batchNo) updateData.currentBatchNo = batchNo;
    if (customer) updateData.currentCustomer = customer;

    if (toStatus === CylinderStatus.SCRAPPED) {
      updateData.isScrapped = true;
      updateData.scrapDate = new Date().toISOString();
      updateData.scrapReason = reason || '报废处理';
    }

    const updatedCylinder = storage.updateCylinder(cylinderId, updateData);

    const newValues = {
      currentStatus: toStatus,
      currentBatchNo: batchNo || oldValues.currentBatchNo,
      currentCustomer: customer || oldValues.currentCustomer
    };

    storage.addHistory({
      cylinderId,
      cylinderNo: cylinder.cylinderNo,
      fromStatus: cylinder.currentStatus,
      toStatus,
      changeReason: reason || `状态变更为 ${toStatus}`,
      operator,
      batchNo: batchNo || cylinder.currentBatchNo,
      customer: customer || cylinder.currentCustomer,
      oldValues,
      newValues,
      remark,
      requestId
    });

    return { success: true, data: updatedCylinder };
  }

  static correctStatus(cylinderId, newStatus, options = {}) {
    const { operator = 'system', reason, remark, requestId } = options;

    if (requestId && storage.isDuplicateRequest(requestId)) {
      const histories = storage.getHistoriesByCylinder(cylinderId);
      const latest = histories[0];
      return { success: true, data: latest, isDuplicate: true };
    }

    const cylinder = storage.getCylinder(cylinderId);
    if (!cylinder) {
      return { success: false, error: '气瓶不存在' };
    }

    const oldValues = { currentStatus: cylinder.currentStatus };

    const updatedCylinder = storage.updateCylinder(cylinderId, { currentStatus: newStatus });

    storage.addHistory({
      cylinderId,
      cylinderNo: cylinder.cylinderNo,
      fromStatus: cylinder.currentStatus,
      toStatus: newStatus,
      changeReason: `状态修正: ${reason || '人工修正'}`,
      operator,
      oldValues,
      newValues: { currentStatus: newStatus },
      remark,
      requestId
    });

    return { success: true, data: updatedCylinder };
  }

  static updateCylinderInfo(cylinderId, data, operator = 'system') {
    const cylinder = storage.getCylinder(cylinderId);
    if (!cylinder) {
      return { success: false, error: '气瓶不存在' };
    }

    const oldValues = {};
    const newValues = {};

    const fieldsToTrack = ['cylinderNo', 'specification', 'material', 'nextInspectionDate'];
    fieldsToTrack.forEach(field => {
      if (data[field] !== undefined && data[field] !== cylinder[field]) {
        oldValues[field] = cylinder[field];
        newValues[field] = data[field];
      }
    });

    const updatedCylinder = storage.updateCylinder(cylinderId, data);

    if (Object.keys(oldValues).length > 0) {
      storage.addHistory({
        cylinderId,
        cylinderNo: cylinder.cylinderNo,
        fromStatus: cylinder.currentStatus,
        toStatus: cylinder.currentStatus,
        changeReason: '信息修改',
        operator,
        oldValues,
        newValues
      });
    }

    return { success: true, data: updatedCylinder };
  }

  static checkOverdueCylinders() {
    const cylinders = storage.getAllCylinders();
    const now = new Date();
    const overdueList = [];

    cylinders.forEach(cylinder => {
      if (cylinder.currentStatus === CylinderStatus.IN_USE && cylinder.nextInspectionDate) {
        const inspectionDate = new Date(cylinder.nextInspectionDate);
        if (isBefore(inspectionDate, now)) {
          this.transitionStatus(cylinder.id, CylinderStatus.OVERDUE, {
            operator: 'system',
            reason: '检验超期自动标记',
            remark: '系统自动检测到检验超期'
          });
          overdueList.push(cylinder);
        }
      }
    });

    return overdueList;
  }

  static getCylinderDetail(cylinderId) {
    const cylinder = storage.getCylinder(cylinderId);
    if (!cylinder) {
      return { success: false, error: '气瓶不存在' };
    }

    const histories = storage.getHistoriesByCylinder(cylinderId);

    return {
      success: true,
      data: {
        cylinder,
        histories
      }
    };
  }

  static batchImport(cylindersData, operator = 'system') {
    const results = {
      success: [],
      failed: [],
      total: cylindersData.length
    };

    cylindersData.forEach((data, index) => {
      const result = this.createCylinder(data, operator);
      if (result.success) {
        results.success.push({
          index,
          cylinderNo: data.cylinderNo,
          data: result.data
        });
      } else {
        results.failed.push({
          index,
          cylinderNo: data.cylinderNo,
          error: result.error
        });
      }
    });

    return results;
  }
}

module.exports = CylinderService;

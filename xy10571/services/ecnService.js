const dataStore = require('../models/dataStore');
const { ECN_STATUS, ITEM_STATUS, PURCHASE_CONFIRM_STATUS } = require('../models/types');
const BusinessRules = require('./rules');

class ECNService {
  
  static createECN(data) {
    const requiredFields = ['title', 'reason', 'urgency', 'createdBy', 'changeDescription'];
    
    const missingFields = requiredFields.filter(f => !data[f]);
    if (missingFields.length > 0) {
      return {
        success: false,
        error: `缺少必填字段: ${missingFields.join(', ')}`,
        errorCode: 'MISSING_FIELDS'
      };
    }

    const ecn = dataStore.createECN(data);
    return {
      success: true,
      data: ecn,
      message: '工程变更单创建成功'
    };
  }

  static submitECN(ecnId, operator) {
    const ecn = dataStore.getECN(ecnId);
    if (!ecn) {
      return {
        success: false,
        error: '工程变更单不存在',
        errorCode: 'ECN_NOT_FOUND'
      };
    }

    if (ecn.status !== ECN_STATUS.DRAFT) {
      return {
        success: false,
        error: `只有草稿状态才能提交，当前状态: ${ecn.status}`,
        errorCode: 'INVALID_STATUS'
      };
    }

    const updated = dataStore.updateECN(ecnId, { status: ECN_STATUS.SUBMITTED }, operator);
    
    return {
      success: true,
      data: updated,
      message: '工程变更单已提交'
    };
  }

  static addImpactAnalysis(ecnId, impactData, operator) {
    const ecn = dataStore.getECN(ecnId);
    if (!ecn) {
      return {
        success: false,
        error: '工程变更单不存在',
        errorCode: 'ECN_NOT_FOUND'
      };
    }

    if (impactData.materials) {
      dataStore.addMaterialImpact(ecnId, impactData.materials);
    }

    if (impactData.productionOrders) {
      dataStore.addProductionOrder(ecnId, impactData.productionOrders);
    }

    if (impactData.purchaseOrders) {
      dataStore.addPurchaseOrder(ecnId, impactData.purchaseOrders);
    }

    if (impactData.customerOrders) {
      dataStore.addCustomerOrder(ecnId, impactData.customerOrders);
    }

    const updated = dataStore.updateECN(ecnId, { 
      status: ECN_STATUS.IMPACT_ANALYZED,
      impactAnalysisComplete: true 
    }, operator);

    return {
      success: true,
      data: {
        ecn: updated,
        statistics: dataStore.getStatistics(ecnId)
      },
      message: '影响分析完成'
    };
  }

  static approveECN(ecnId, approver) {
    const ecn = dataStore.getECN(ecnId);
    if (!ecn) {
      return {
        success: false,
        error: '工程变更单不存在',
        errorCode: 'ECN_NOT_FOUND'
      };
    }

    if (ecn.status !== ECN_STATUS.IMPACT_ANALYZED) {
      return {
        success: false,
        error: `只有已完成影响分析的变更单才能审批，当前状态: ${ecn.status}`,
        errorCode: 'INVALID_STATUS'
      };
    }

    const updated = dataStore.updateECN(ecnId, { 
      status: ECN_STATUS.APPROVED,
      approvedBy: approver,
      approvedAt: new Date().toISOString()
    }, approver);

    return {
      success: true,
      data: updated,
      message: '工程变更单已审批通过'
    };
  }

  static startExecution(ecnId, operator) {
    const ecn = dataStore.getECN(ecnId);
    if (!ecn) {
      return {
        success: false,
        error: '工程变更单不存在',
        errorCode: 'ECN_NOT_FOUND'
      };
    }

    if (ecn.status !== ECN_STATUS.APPROVED) {
      return {
        success: false,
        error: `只有已审批的变更单才能执行，当前状态: ${ecn.status}`,
        errorCode: 'INVALID_STATUS'
      };
    }

    const updated = dataStore.updateECN(ecnId, { 
      status: ECN_STATUS.IN_PROGRESS,
      executionStartedAt: new Date().toISOString()
    }, operator);

    const freezeResult = BusinessRules.handleUrgentFreeze(ecn, dataStore);
    const shippedResult = BusinessRules.handleShippedOrders(ecn, dataStore);

    return {
      success: true,
      data: {
        ecn: updated,
        urgentFreeze: freezeResult,
        shippedOrders: shippedResult
      },
      message: '执行已开始，已根据业务规则处理相关订单'
    };
  }

  static notifyItem(ecnId, itemType, itemId, operator) {
    const eventKey = BusinessRules.generateEventKey(ecnId, 'NOTIFY', itemType, itemId);
    const idempotencyCheck = BusinessRules.checkIdempotency(eventKey, dataStore);
    
    if (idempotencyCheck.isDuplicate) {
      return {
        success: true,
        data: {
          isDuplicate: true,
          message: '该通知已发送过（幂等保护）'
        },
        message: '通知已处理（幂等）'
      };
    }

    let result;
    switch (itemType) {
      case 'MATERIAL':
        result = dataStore.updateMaterialImpact(ecnId, itemId, {
          status: ITEM_STATUS.NOTIFIED,
          notifiedAt: new Date().toISOString()
        }, operator);
        break;
      case 'PRODUCTION':
        result = dataStore.updateProductionOrder(ecnId, itemId, {
          status: ITEM_STATUS.NOTIFIED,
          notifiedAt: new Date().toISOString()
        }, operator);
        break;
      case 'PURCHASE':
        result = dataStore.updatePurchaseOrder(ecnId, itemId, {
          status: ITEM_STATUS.NOTIFIED,
          notifiedAt: new Date().toISOString()
        }, operator);
        break;
      case 'CUSTOMER':
        result = dataStore.updateCustomerOrder(ecnId, itemId, {
          status: ITEM_STATUS.NOTIFIED,
          notifiedAt: new Date().toISOString()
        }, operator);
        break;
      default:
        return {
          success: false,
          error: '无效的项目类型',
          errorCode: 'INVALID_ITEM_TYPE'
        };
    }

    if (!result) {
      return {
        success: false,
        error: '项目不存在',
        errorCode: 'ITEM_NOT_FOUND'
      };
    }

    return {
      success: true,
      data: result,
      message: '通知发送成功'
    };
  }

  static acknowledgeItem(ecnId, itemType, itemId, operator, confirmationData = {}) {
    let result;
    
    switch (itemType) {
      case 'MATERIAL':
        result = dataStore.updateMaterialImpact(ecnId, itemId, {
          status: ITEM_STATUS.ACKNOWLEDGED,
          acknowledgedAt: new Date().toISOString()
        }, operator);
        break;
      case 'PRODUCTION':
        result = dataStore.updateProductionOrder(ecnId, itemId, {
          status: ITEM_STATUS.ACKNOWLEDGED,
          acknowledgedAt: new Date().toISOString()
        }, operator);
        break;
      case 'PURCHASE':
        result = dataStore.updatePurchaseOrder(ecnId, itemId, {
          status: ITEM_STATUS.ACKNOWLEDGED,
          acknowledgedAt: new Date().toISOString(),
          confirmStatus: confirmationData.confirmStatus || PURCHASE_CONFIRM_STATUS.CONFIRMED
        }, operator);
        break;
      case 'CUSTOMER':
        result = dataStore.updateCustomerOrder(ecnId, itemId, {
          status: ITEM_STATUS.ACKNOWLEDGED,
          acknowledgedAt: new Date().toISOString(),
          customerResponse: confirmationData.customerResponse
        }, operator);
        break;
      default:
        return {
          success: false,
          error: '无效的项目类型',
          errorCode: 'INVALID_ITEM_TYPE'
        };
    }

    if (!result) {
      return {
        success: false,
        error: '项目不存在',
        errorCode: 'ITEM_NOT_FOUND'
      };
    }

    return {
      success: true,
      data: result,
      message: '确认成功'
    };
  }

  static completeItem(ecnId, itemType, itemId, operator, completionData = {}) {
    let result;
    
    switch (itemType) {
      case 'MATERIAL':
        result = dataStore.updateMaterialImpact(ecnId, itemId, {
          status: ITEM_STATUS.COMPLETED,
          completedAt: new Date().toISOString(),
          ...completionData
        }, operator);
        break;
      case 'PRODUCTION':
        result = dataStore.updateProductionOrder(ecnId, itemId, {
          status: ITEM_STATUS.COMPLETED,
          completedAt: new Date().toISOString(),
          ...completionData
        }, operator);
        break;
      case 'PURCHASE':
        result = dataStore.updatePurchaseOrder(ecnId, itemId, {
          status: ITEM_STATUS.COMPLETED,
          completedAt: new Date().toISOString(),
          ...completionData
        }, operator);
        break;
      case 'CUSTOMER':
        result = dataStore.updateCustomerOrder(ecnId, itemId, {
          status: ITEM_STATUS.COMPLETED,
          completedAt: new Date().toISOString(),
          ...completionData
        }, operator);
        break;
      default:
        return {
          success: false,
          error: '无效的项目类型',
          errorCode: 'INVALID_ITEM_TYPE'
        };
    }

    if (!result) {
      return {
        success: false,
        error: '项目不存在',
        errorCode: 'ITEM_NOT_FOUND'
      };
    }

    return {
      success: true,
      data: result,
      message: '项目处理完成'
    };
  }

  static completeECN(ecnId, operator) {
    const ecn = dataStore.getECN(ecnId);
    if (!ecn) {
      return {
        success: false,
        error: '工程变更单不存在',
        errorCode: 'ECN_NOT_FOUND'
      };
    }

    if (ecn.status !== ECN_STATUS.IN_PROGRESS) {
      return {
        success: false,
        error: `只有执行中的变更单才能完成，当前状态: ${ecn.status}`,
        errorCode: 'INVALID_STATUS'
      };
    }

    const closeCheck = BusinessRules.canCloseECN(ecn, dataStore);
    if (!closeCheck.canClose) {
      return {
        success: false,
        error: closeCheck.reason,
        errorCode: 'CANNOT_CLOSE',
        details: closeCheck
      };
    }

    const updated = dataStore.updateECN(ecnId, { 
      status: ECN_STATUS.COMPLETED,
      completedAt: new Date().toISOString(),
      closedBy: operator
    }, operator);

    return {
      success: true,
      data: {
        ecn: updated,
        finalStatistics: dataStore.getStatistics(ecnId)
      },
      message: '工程变更单已完成'
    };
  }

  static handleException(ecnId, errorInfo, operator) {
    const ecn = dataStore.getECN(ecnId);
    if (!ecn) {
      return {
        success: false,
        error: '工程变更单不存在',
        errorCode: 'ECN_NOT_FOUND'
      };
    }

    dataStore.addHistory(ecnId, 'EXCEPTION', {
      action: '异常处理记录',
      errorCode: errorInfo.errorCode,
      errorMessage: errorInfo.errorMessage,
      affectedItems: errorInfo.affectedItems || [],
      operator,
      timestamp: new Date().toISOString()
    });

    const updated = dataStore.updateECN(ecnId, { 
      status: ECN_STATUS.FAILED,
      lastError: {
        code: errorInfo.errorCode,
        message: errorInfo.errorMessage,
        timestamp: new Date().toISOString()
      }
    }, operator);

    return {
      success: true,
      data: updated,
      message: '异常已记录，变更单标记为失败'
    };
  }

  static retryFromFailure(ecnId, operator) {
    const ecn = dataStore.getECN(ecnId);
    if (!ecn) {
      return {
        success: false,
        error: '工程变更单不存在',
        errorCode: 'ECN_NOT_FOUND'
      };
    }

    if (ecn.status !== ECN_STATUS.FAILED) {
      return {
        success: false,
        error: `只有失败状态的变更单才能重试，当前状态: ${ecn.status}`,
        errorCode: 'INVALID_STATUS'
      };
    }

    const updated = dataStore.updateECN(ecnId, { 
      status: ECN_STATUS.IN_PROGRESS,
      retryCount: (ecn.retryCount || 0) + 1
    }, operator);

    dataStore.addHistory(ecnId, 'RETRY', {
      action: '重试执行',
      retryNumber: (ecn.retryCount || 0) + 1,
      operator,
      timestamp: new Date().toISOString()
    });

    return {
      success: true,
      data: updated,
      message: '已重新进入执行状态'
    };
  }

  static getECNDetail(ecnId) {
    const ecn = dataStore.getECN(ecnId);
    if (!ecn) {
      return {
        success: false,
        error: '工程变更单不存在',
        errorCode: 'ECN_NOT_FOUND'
      };
    }

    return {
      success: true,
      data: {
        ecn,
        impacts: {
          materials: dataStore.getMaterialImpacts(ecnId),
          productionOrders: dataStore.getProductionOrders(ecnId),
          purchaseOrders: dataStore.getPurchaseOrders(ecnId),
          customerOrders: dataStore.getCustomerOrders(ecnId)
        },
        history: dataStore.getHistory(ecnId),
        statistics: dataStore.getStatistics(ecnId)
      }
    };
  }

  static getAllECNs(filter) {
    return {
      success: true,
      data: dataStore.getAllECNs(filter)
    };
  }

  static getResponsiblePersons(ecnId) {
    const ecn = dataStore.getECN(ecnId);
    if (!ecn) {
      return {
        success: false,
        error: '工程变更单不存在',
        errorCode: 'ECN_NOT_FOUND'
      };
    }

    return {
      success: true,
      data: BusinessRules.identifyResponsiblePersons(ecn, dataStore)
    };
  }

  static generateReport(ecnId) {
    const ecn = dataStore.getECN(ecnId);
    if (!ecn) {
      return {
        success: false,
        error: '工程变更单不存在',
        errorCode: 'ECN_NOT_FOUND'
      };
    }

    const detail = this.getECNDetail(ecnId);
    const responsible = this.getResponsiblePersons(ecnId);

    const report = {
      reportId: `RPT-${Date.now()}`,
      generatedAt: new Date().toISOString(),
      ecn: {
        id: ecn.id,
        title: ecn.title,
        status: ecn.status,
        urgency: ecn.urgency,
        createdBy: ecn.createdBy,
        createdAt: ecn.createdAt
      },
      summary: {
        totalImpacts: detail.data.statistics.total,
        completed: this.countStatus(detail.data.statistics.byStatus, 'COMPLETED'),
        pending: this.countStatus(detail.data.statistics.byStatus, 'PENDING') + 
                 this.countStatus(detail.data.statistics.byStatus, 'NOTIFIED'),
        failed: this.countStatus(detail.data.statistics.byStatus, 'FAILED')
      },
      responsible: responsible.data,
      closureStatus: BusinessRules.canCloseECN(ecn, dataStore),
      history: detail.data.history
    };

    return {
      success: true,
      data: report,
      format: 'JSON'
    };
  }

  static countStatus(byStatus, statusValue) {
    let count = 0;
    Object.values(byStatus).forEach(category => {
      count += category[statusValue] || 0;
    });
    return count;
  }

  static manualUpdate(ecnId, itemType, itemId, updates, operator) {
    if (!operator) {
      return {
        success: false,
        error: '人工修正必须指定操作者',
        errorCode: 'OPERATOR_REQUIRED'
      };
    }

    let beforeData;
    switch (itemType) {
      case 'MATERIAL':
        beforeData = dataStore.getMaterialImpacts(ecnId).find(m => m.id === itemId);
        break;
      case 'PRODUCTION':
        beforeData = dataStore.getProductionOrders(ecnId).find(p => p.id === itemId);
        break;
      case 'PURCHASE':
        beforeData = dataStore.getPurchaseOrders(ecnId).find(p => p.id === itemId);
        break;
      case 'CUSTOMER':
        beforeData = dataStore.getCustomerOrders(ecnId).find(c => c.id === itemId);
        break;
      default:
        return {
          success: false,
          error: '无效的项目类型',
          errorCode: 'INVALID_ITEM_TYPE'
        };
    }

    if (!beforeData) {
      return {
        success: false,
        error: '项目不存在',
        errorCode: 'ITEM_NOT_FOUND'
      };
    }

    const validation = BusinessRules.validateManualUpdate(beforeData, { ...beforeData, ...updates }, operator);
    
    let result;
    switch (itemType) {
      case 'MATERIAL':
        result = dataStore.updateMaterialImpact(ecnId, itemId, { ...updates, operator }, operator);
        break;
      case 'PRODUCTION':
        result = dataStore.updateProductionOrder(ecnId, itemId, { ...updates, operator }, operator);
        break;
      case 'PURCHASE':
        result = dataStore.updatePurchaseOrder(ecnId, itemId, { ...updates, operator }, operator);
        break;
      case 'CUSTOMER':
        result = dataStore.updateCustomerOrder(ecnId, itemId, { ...updates, operator }, operator);
        break;
    }

    return {
      success: true,
      data: {
        updatedItem: result,
        diff: validation.diff
      },
      message: '人工修正已记录'
    };
  }
}

module.exports = ECNService;

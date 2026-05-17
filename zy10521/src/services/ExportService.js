const { Parser } = require('json2csv');
const store = require('../store/memoryStore');
const { ROTATION_STATUS } = require('../models/RotationStatus');

class ExportService {
  exportRotationsToCSV(filters = {}) {
    const rotations = store.listRotations(filters);
    
    const fields = [
      { label: '轮转ID', value: 'id' },
      { label: '服务名称', value: 'serviceName' },
      { label: '当前负责人', value: 'currentOwner' },
      { label: '候选负责人', value: 'candidateOwner' },
      { label: '交接原因', value: 'reason' },
      { label: '状态', value: 'status' },
      { label: '告警引用数', value: row => row.alertReferences.length },
      { label: '创建时间', value: 'createdAt' },
      { label: '更新时间', value: 'updatedAt' },
      { label: '到期时间', value: 'expireAt' },
      { label: '完成时间', value: 'completedAt' },
      { label: '是否已确认', value: row => row.confirmationReceipt ? '是' : '否' }
    ];

    const json2csvParser = new Parser({ fields });
    return json2csvParser.parse(rotations);
  }

  exportRotationReport(rotationId) {
    const rotation = store.getRotation(rotationId);
    if (!rotation) {
      throw new Error('轮转记录不存在');
    }

    const history = store.getHistory(rotationId);
    const exceptions = store.listExceptions({ rotationId });

    const report = {
      rotation: {
        id: rotation.id,
        serviceName: rotation.serviceName,
        currentOwner: rotation.currentOwner,
        candidateOwner: rotation.candidateOwner,
        reason: rotation.reason,
        status: rotation.status,
        alertReferences: rotation.alertReferences,
        confirmationReceipt: rotation.confirmationReceipt,
        createdAt: rotation.createdAt,
        completedAt: rotation.completedAt
      },
      history: history.map(h => ({
        id: h.id,
        action: h.action,
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        operator: h.operator,
        timestamp: h.timestamp,
        hasRawInput: !!h.rawInput
      })),
      exceptions: exceptions.map(e => ({
        id: e.id,
        type: e.type,
        description: e.description,
        resolved: e.resolved,
        createdAt: e.createdAt,
        resolvedAt: e.resolvedAt,
        hasRawInput: !!e.rawInput,
        hasHandlingBasis: !!e.handlingBasis
      })),
      summary: {
        totalHistoryEntries: history.length,
        totalExceptions: exceptions.length,
        unresolvedExceptions: exceptions.filter(e => !e.resolved).length,
        durationDays: rotation.completedAt 
          ? Math.ceil((new Date(rotation.completedAt) - new Date(rotation.createdAt)) / (24 * 60 * 60 * 1000))
          : Math.ceil((Date.now() - new Date(rotation.createdAt)) / (24 * 60 * 60 * 1000))
      }
    };

    return report;
  }

  exportAllServicesReport() {
    const services = store.listServices();
    const rotations = store.listRotations();

    const serviceStats = services.map(service => {
      const serviceRotations = rotations.filter(r => r.serviceId === service.id);
      const completedRotations = serviceRotations.filter(r => r.status === ROTATION_STATUS.COMPLETED);
      const activeRotation = service.activeRotationId 
        ? rotations.find(r => r.id === service.activeRotationId)
        : null;

      return {
        serviceName: service.serviceName,
        currentOwner: service.currentOwner,
        hasActiveRotation: !!activeRotation,
        activeRotationStatus: activeRotation?.status || null,
        totalRotations: serviceRotations.length,
        completedRotations: completedRotations.length,
        createdAt: service.createdAt
      };
    });

    return {
      generatedAt: new Date().toISOString(),
      totalServices: services.length,
      servicesWithActiveRotation: services.filter(s => s.activeRotationId).length,
      serviceStats
    };
  }

  exportHistoryAudit(rotationId) {
    const history = store.getHistory(rotationId);
    
    const fields = [
      { label: '记录ID', value: 'id' },
      { label: '操作类型', value: 'action' },
      { label: '原状态', value: 'fromStatus' },
      { label: '目标状态', value: 'toStatus' },
      { label: '操作人', value: 'operator' },
      { label: '时间', value: 'timestamp' },
      { label: '修正原因', value: 'correctionReason' },
      { label: '关联异常ID', value: 'exceptionId' }
    ];

    const json2csvParser = new Parser({ fields });
    return json2csvParser.parse(history);
  }
}

module.exports = new ExportService();

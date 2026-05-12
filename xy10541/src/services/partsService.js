const store = require('../stores/memoryStore');
const EventService = require('./eventService');
const { EVENT_TYPES } = require('../config/constants');

class PartsService {
  static checkAvailability(partCodes) {
    const results = [];
    for (const code of partCodes) {
      const part = store.getPartByCode(code);
      if (!part) {
        results.push({
          code,
          available: false,
          reason: '配件不存在'
        });
      } else {
        const availableQuantity = part.totalQuantity - part.allocations.length;
        results.push({
          code,
          name: part.name,
          available: availableQuantity > 0,
          totalQuantity: part.totalQuantity,
          allocatedQuantity: part.allocations.length,
          availableQuantity
        });
      }
    }
    return results;
  }

  static allocateParts(orderId, partCodes, operator = 'system') {
    const allocations = [];
    const failedParts = [];

    for (const code of partCodes) {
      const part = store.getPartByCode(code);
      if (!part) {
        failedParts.push({ code, reason: '配件不存在' });
        continue;
      }

      const availableQuantity = part.totalQuantity - part.allocations.length;
      if (availableQuantity <= 0) {
        failedParts.push({ code, reason: '配件库存不足' });
        continue;
      }

      const allocation = {
        orderId,
        allocatedAt: store.now(),
        allocatedBy: operator
      };

      store.updatePart(part.id, {
        allocations: [...part.allocations, allocation]
      });

      allocations.push({
        partId: part.id,
        partCode: code,
        partName: part.name,
        ...allocation
      });
    }

    if (allocations.length > 0) {
      EventService.logEvent(orderId, EVENT_TYPES.PARTS_ALLOCATED, {
        allocatedParts: allocations,
        failedParts
      }, operator);
    }

    return {
      success: failedParts.length === 0,
      allocatedParts: allocations,
      failedParts
    };
  }

  static releaseParts(orderId, operator = 'system') {
    const releasedParts = [];
    const allParts = store.listParts();

    for (const part of allParts) {
      const orderAllocations = part.allocations.filter(a => a.orderId === orderId);
      if (orderAllocations.length > 0) {
        const remainingAllocations = part.allocations.filter(a => a.orderId !== orderId);
        
        store.updatePart(part.id, {
          allocations: remainingAllocations
        });

        for (const allocation of orderAllocations) {
          releasedParts.push({
            partId: part.id,
            partCode: part.code,
            partName: part.name,
            releasedAt: store.now()
          });
        }
      }
    }

    if (releasedParts.length > 0) {
      EventService.logEvent(orderId, EVENT_TYPES.PARTS_RELEASED, {
        releasedParts
      }, operator);
    }

    return releasedParts;
  }

  static getPartStatus() {
    return store.listParts().map(part => ({
      id: part.id,
      code: part.code,
      name: part.name,
      totalQuantity: part.totalQuantity,
      allocatedQuantity: part.allocations.length,
      availableQuantity: part.totalQuantity - part.allocations.length,
      allocations: part.allocations.map(a => ({
        orderId: a.orderId,
        allocatedAt: a.allocatedAt
      }))
    }));
  }

  static initializeParts() {
    const parts = [
      { code: 'AIRCON-BRACKET', name: '空调支架', totalQuantity: 10 },
      { code: 'AIRCON-PIPE', name: '空调铜管', totalQuantity: 20 },
      { code: 'WASHING-MACHINE-HOSE', name: '洗衣机进水管', totalQuantity: 15 },
      { code: 'REFRIGERATOR-STAND', name: '冰箱底座', totalQuantity: 5 },
      { code: 'TV-MOUNT', name: '电视挂架', totalQuantity: 8 }
    ];

    for (const part of parts) {
      if (!store.getPartByCode(part.code)) {
        store.createPart(part);
      }
    }
  }
}

module.exports = PartsService;

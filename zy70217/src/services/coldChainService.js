const store = require('../models/store');
const AppError = require('../utils/errors');

function reportColdBoxException(coldBoxId, exceptionType, temperature, details = {}) {
  const coldBox = store.getColdBoxById(coldBoxId);
  if (!coldBox) {
    throw new AppError('冷链箱不存在', 404);
  }

  store.updateColdBox(coldBoxId, {
    status: 'exception',
    currentTemp: temperature
  });

  const exception = store.createExceptionRecord({
    coldBoxId,
    coldBoxName: coldBox.name,
    type: exceptionType,
    temperature,
    status: 'open',
    details
  });

  const relatedInventory = store.getInventoryByVaccineId('v1').filter(inv => inv.coldBoxId === coldBoxId);
  const allInventory = store.getAllInventory().filter(inv => inv.coldBoxId === coldBoxId);
  
  allInventory.forEach(inv => {
    const newFrozenDoses = inv.lockedDoses + inv.availableDoses;
    store.updateInventory(inv.id, {
      frozenDoses: newFrozenDoses,
      lockedDoses: 0,
      availableDoses: 0,
      status: 'frozen'
    });
  });

  return {
    exception,
    coldBox: store.getColdBoxById(coldBoxId),
    affectedInventory: allInventory.map(inv => ({
      id: inv.id,
      batchNo: inv.batchNo,
      vaccineId: inv.vaccineId,
      totalFrozen: inv.lockedDoses + inv.availableDoses
    })),
    message: `冷链箱 ${coldBox.name} 异常，所有相关批次已冻结，共冻结 ${allInventory.reduce((sum, inv) => sum + inv.lockedDoses + inv.availableDoses, 0)} 剂次`
  };
}

function resolveColdBoxException(coldBoxId, resolution, manualCorrection = false) {
  const coldBox = store.getColdBoxById(coldBoxId);
  if (!coldBox) {
    throw new AppError('冷链箱不存在', 404);
  }

  if (coldBox.status !== 'exception') {
    throw new AppError('冷链箱当前无异常状态', 400);
  }

  const allInventory = store.getAllInventory().filter(inv => inv.coldBoxId === coldBoxId);

  if (resolution === 'dispose') {
    allInventory.forEach(inv => {
      store.updateInventory(inv.id, {
        status: 'disposed',
        frozenDoses: 0,
        availableDoses: 0,
        lockedDoses: 0,
        totalDoses: 0
      });
    });

    store.updateColdBox(coldBoxId, {
      status: 'normal',
      currentTemp: 5
    });

    const exceptions = store.getExceptionsByColdBoxId(coldBoxId).filter(e => e.status === 'open');
    exceptions.forEach(exc => {
      store.updateException(exc.id, {
        status: 'resolved',
        resolution: '销毁所有疫苗',
        resolvedAt: new Date().toISOString()
      });
    });

    return {
      coldBox: store.getColdBoxById(coldBoxId),
      affectedInventory: allInventory.map(inv => ({
        id: inv.id,
        batchNo: inv.batchNo,
        vaccineId: inv.vaccineId,
        action: '全部销毁'
      })),
      message: '异常已处理，所有相关疫苗已销毁，冷链箱恢复正常'
    };
  } else if (resolution === 'release' || manualCorrection) {
    const restoredInventory = allInventory.map(inv => {
      let restoredAvailable = inv.frozenDoses;
      let restoredLocked = 0;
      
      const activeLocks = store.getLocksByInventoryId(inv.id);
      activeLocks.forEach(lock => {
        store.releaseLock(lock.id);
      });

      store.updateInventory(inv.id, {
        frozenDoses: 0,
        availableDoses: restoredAvailable,
        lockedDoses: restoredLocked,
        status: 'available'
      });

      return {
        id: inv.id,
        batchNo: inv.batchNo,
        vaccineId: inv.vaccineId,
        releasedDoses: restoredAvailable,
        previouslyLockedDoses: activeLocks.length,
        action: manualCorrection ? '人工解冻释放' : '自动解冻释放'
      };
    });

    store.updateColdBox(coldBoxId, {
      status: 'normal',
      currentTemp: 5
    });

    const exceptions = store.getExceptionsByColdBoxId(coldBoxId).filter(e => e.status === 'open');
    exceptions.forEach(exc => {
      store.updateException(exc.id, {
        status: 'resolved',
        resolution: manualCorrection ? '人工修正后释放' : '问题修复后释放',
        manualCorrection,
        resolvedAt: new Date().toISOString()
      });
    });

    return {
      coldBox: store.getColdBoxById(coldBoxId),
      affectedInventory: restoredInventory,
      manualCorrection,
      message: manualCorrection 
        ? '人工修正：异常已解冻，所有相关疫苗已释放，原有预约锁定已解除' 
        : '异常已修复，所有相关疫苗已释放，原有预约锁定已解除'
    };
  } else {
    throw new AppError('无效的处理方案', 400);
  }
}

function getColdChainStatus() {
  const coldBoxes = store.getAllColdBoxes();
  const inventory = store.getAllInventory();
  const exceptions = store.getAllExceptions();

  return {
    coldBoxes: coldBoxes.map(box => ({
      ...box,
      relatedBatches: inventory.filter(inv => inv.coldBoxId === box.id).length
    })),
    openExceptions: exceptions.filter(e => e.status === 'open'),
    summary: {
      totalColdBoxes: coldBoxes.length,
      normalColdBoxes: coldBoxes.filter(b => b.status === 'normal').length,
      exceptionColdBoxes: coldBoxes.filter(b => b.status === 'exception').length,
      totalInventory: inventory.length,
      availableDoses: inventory.reduce((sum, inv) => sum + inv.availableDoses, 0),
      lockedDoses: inventory.reduce((sum, inv) => sum + inv.lockedDoses, 0),
      frozenDoses: inventory.reduce((sum, inv) => sum + inv.frozenDoses, 0)
    }
  };
}

module.exports = {
  reportColdBoxException,
  resolveColdBoxException,
  getColdChainStatus
};

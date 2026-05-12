const {
  PACKAGE_STATES,
  MedicalPackage,
  SterilizationBatch,
  packages,
  batches,
  idempotencyManager
} = require('./models');

class SterilizationService {
  createPackage(data) {
    const { packageId, name, items, operator, requestId } = data;
    
    const idempotentKey = idempotencyManager.generateKey('create', packageId, requestId || '');
    const cacheCheck = idempotencyManager.checkAndSet(idempotentKey, { success: true });
    if (cacheCheck.exists) {
      return { ...cacheCheck.data.result, idempotent: true };
    }

    if (packages.has(packageId)) {
      throw new Error(`器械包 ${packageId} 已存在`);
    }

    const pkg = new MedicalPackage({ packageId, name, items, operator });
    packages.set(packageId, pkg);
    
    const result = { success: true, data: this._packageToDTO(pkg) };
    idempotencyManager.checkAndSet(idempotentKey, result);
    return result;
  }

  usePackage(packageId, data) {
    const { operator, patientId, surgeryId, requestId } = data;
    
    const idempotentKey = idempotencyManager.generateKey('use', packageId, requestId || '');
    const cacheCheck = idempotencyManager.checkAndSet(idempotentKey, { success: true });
    if (cacheCheck.exists) {
      return { ...cacheCheck.data.result, idempotent: true };
    }

    const pkg = this._getPackage(packageId);
    pkg.transitionTo(PACKAGE_STATES.IN_USE, operator, '使用发放', { patientId, surgeryId });
    
    const result = { success: true, data: this._packageToDTO(pkg) };
    idempotencyManager.checkAndSet(idempotentKey, result);
    return result;
  }

  recyclePackage(packageId, data) {
    const { operator, condition, notes, requestId } = data;
    
    const idempotentKey = idempotencyManager.generateKey('recycle', packageId, requestId || '');
    const cacheCheck = idempotencyManager.checkAndSet(idempotentKey, { success: true });
    if (cacheCheck.exists) {
      return { ...cacheCheck.data.result, idempotent: true };
    }

    const pkg = this._getPackage(packageId);
    pkg.transitionTo(PACKAGE_STATES.RECYCLED, operator, '回收登记', { condition, notes });
    
    const result = { success: true, data: this._packageToDTO(pkg) };
    idempotencyManager.checkAndSet(idempotentKey, result);
    return result;
  }

  cleanPackage(packageId, data) {
    const { operator, method, temperature, duration, requestId } = data;
    
    const idempotentKey = idempotencyManager.generateKey('clean', packageId, requestId || '');
    const cacheCheck = idempotencyManager.checkAndSet(idempotentKey, { success: true });
    if (cacheCheck.exists) {
      return { ...cacheCheck.data.result, idempotent: true };
    }

    const pkg = this._getPackage(packageId);
    
    if (pkg.status !== PACKAGE_STATES.RECYCLED && pkg.status !== PACKAGE_STATES.STERILIZATION_FAILED && pkg.status !== PACKAGE_STATES.EXPIRED) {
      throw new Error('只有已回收、灭菌失败或已过期的器械包才能清洗');
    }

    pkg.transitionTo(PACKAGE_STATES.CLEANING, operator, '开始清洗', { method, temperature, duration });
    pkg.transitionTo(PACKAGE_STATES.CLEANED, operator, '清洗完成', { method, temperature, duration });
    
    const result = { success: true, data: this._packageToDTO(pkg) };
    idempotencyManager.checkAndSet(idempotentKey, result);
    return result;
  }

  disinfectPackage(packageId, data) {
    const { operator, method, temperature, duration, requestId } = data;
    
    const idempotentKey = idempotencyManager.generateKey('disinfect', packageId, requestId || '');
    const cacheCheck = idempotencyManager.checkAndSet(idempotentKey, { success: true });
    if (cacheCheck.exists) {
      return { ...cacheCheck.data.result, idempotent: true };
    }

    const pkg = this._getPackage(packageId);
    pkg.transitionTo(PACKAGE_STATES.DISINFECTING, operator, '开始消毒', { method, temperature, duration });
    pkg.transitionTo(PACKAGE_STATES.DISINFECTED, operator, '消毒完成', { method, temperature, duration });
    
    const result = { success: true, data: this._packageToDTO(pkg) };
    idempotencyManager.checkAndSet(idempotentKey, result);
    return result;
  }

  sterilizePackage(packageId, data) {
    const { operator, batchNo, method, temperature, duration, pressure, result, requestId } = data;
    
    const idempotentKey = idempotencyManager.generateKey('sterilize', packageId, batchNo, requestId || '');
    const cacheCheck = idempotencyManager.checkAndSet(idempotentKey, { success: true });
    if (cacheCheck.exists) {
      return { ...cacheCheck.data.result, idempotent: true };
    }

    const pkg = this._getPackage(packageId);

    if (pkg.status !== PACKAGE_STATES.DISINFECTED) {
      throw new Error('器械包必须先消毒才能灭菌');
    }

    if (pkg.currentBatchNo && pkg.currentBatchNo !== batchNo) {
      throw new Error(`器械包已在灭菌批次 ${pkg.currentBatchNo} 中，不能重复入批`);
    }

    let batch;
    if (batches.has(batchNo)) {
      batch = batches.get(batchNo);
      if (batch.packages.includes(packageId)) {
        throw new Error(`器械包 ${packageId} 已在批次 ${batchNo} 中`);
      }
    } else {
      batch = new SterilizationBatch(batchNo, { method, temperature, duration, pressure, operator, result });
      batches.set(batchNo, batch);
    }

    batch.addPackage(packageId);

    pkg.transitionTo(PACKAGE_STATES.STERILIZING, operator, '开始灭菌', { batchNo, method, temperature, duration, pressure });

    if (result === 'pass') {
      pkg.transitionTo(PACKAGE_STATES.STERILIZED, operator, '灭菌通过', { batchNo, result: '通过' });
      pkg.currentBatchNo = batchNo;
      pkg.sterilizationExpiry = batch.expiryDate;
    } else {
      pkg.transitionTo(PACKAGE_STATES.STERILIZATION_FAILED, operator, '灭菌失败', { batchNo, result: '失败' });
      pkg.currentBatchNo = null;
    }

    const response = { success: true, data: this._packageToDTO(pkg), batch: this._batchToDTO(batch) };
    idempotencyManager.checkAndSet(idempotentKey, response);
    return response;
  }

  distributePackage(packageId, data) {
    const { operator, department, receiver, requestId } = data;
    
    const idempotentKey = idempotencyManager.generateKey('distribute', packageId, requestId || '');
    const cacheCheck = idempotencyManager.checkAndSet(idempotentKey, { success: true });
    if (cacheCheck.exists) {
      return { ...cacheCheck.data.result, idempotent: true };
    }

    const pkg = this._getPackage(packageId);

    if (pkg.status === PACKAGE_STATES.STERILIZATION_FAILED) {
      throw new Error('灭菌失败的器械包不能发放');
    }

    if (pkg.status !== PACKAGE_STATES.STERILIZED) {
      throw new Error('只有灭菌通过的器械包才能发放');
    }

    if (pkg.currentBatchNo) {
      const batch = batches.get(pkg.currentBatchNo);
      if (batch && batch.isExpired()) {
        pkg.transitionTo(PACKAGE_STATES.EXPIRED, '系统', '批次过期', { batchNo: pkg.currentBatchNo });
        throw new Error('该批次已过期，请重新灭菌');
      }
    }

    pkg.transitionTo(PACKAGE_STATES.DISTRIBUTED, operator, '发放登记', { department, receiver });
    pkg.currentBatchNo = null;

    const result = { success: true, data: this._packageToDTO(pkg) };
    idempotencyManager.checkAndSet(idempotentKey, result);
    return result;
  }

  getPackage(packageId) {
    const pkg = this._getPackage(packageId);
    return { success: true, data: this._packageToDTO(pkg) };
  }

  getPackageHistory(packageId) {
    const pkg = this._getPackage(packageId);
    return { success: true, data: pkg.history };
  }

  getAllPackages() {
    const result = Array.from(packages.values()).map(pkg => this._packageToDTO(pkg));
    return { success: true, data: result };
  }

  getBatch(batchNo) {
    const batch = batches.get(batchNo);
    if (!batch) {
      throw new Error(`批次 ${batchNo} 不存在`);
    }
    return { success: true, data: this._batchToDTO(batch) };
  }

  _getPackage(packageId) {
    const pkg = packages.get(packageId);
    if (!pkg) {
      throw new Error(`器械包 ${packageId} 不存在`);
    }
    return pkg;
  }

  _packageToDTO(pkg) {
    return {
      packageId: pkg.packageId,
      name: pkg.name,
      items: pkg.items,
      status: pkg.status,
      currentBatchNo: pkg.currentBatchNo,
      sterilizationExpiry: pkg.sterilizationExpiry,
      createdAt: pkg.createdAt,
      createdBy: pkg.createdBy,
      lastUpdatedAt: pkg.lastUpdatedAt
    };
  }

  _batchToDTO(batch) {
    return {
      batchNo: batch.batchNo,
      method: batch.method,
      temperature: batch.temperature,
      duration: batch.duration,
      pressure: batch.pressure,
      operator: batch.operator,
      packages: batch.packages,
      result: batch.result,
      startTime: batch.startTime,
      completedAt: batch.completedAt,
      expiryDate: batch.expiryDate,
      isExpired: batch.isExpired()
    };
  }
}

module.exports = new SterilizationService();

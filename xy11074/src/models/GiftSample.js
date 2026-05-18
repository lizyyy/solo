class GiftSample {
  constructor(data = {}) {
    this.sampleId = data.sampleId || this.generateId();
    this.companyId = data.companyId || '';
    this.companyName = data.companyName || '';
    this.contactPerson = data.contactPerson || '';
    this.contactPhone = data.contactPhone || '';
    this.giftCategory = data.giftCategory || '';
    this.giftName = data.giftName || '';
    this.giftModel = data.giftModel || '';
    this.material = data.material || '';
    this.specification = data.specification || '';
    this.color = data.color || '';
    this.quantity = data.quantity || 0;
    this.unitPrice = data.unitPrice || 0;
    this.totalAmount = data.totalAmount || 0;
    this.customizationType = data.customizationType || '';
    this.printingMethod = data.printingMethod || '';
    this.logoPosition = data.logoPosition || '';
    this.designVersion = data.designVersion || 'V1';
    this.designConfirmed = data.designConfirmed || false;
    this.designConfirmedBy = data.designConfirmedBy || '';
    this.designConfirmedAt = data.designConfirmedAt || null;
    this.sampleStatus = data.sampleStatus || '待打样';
    this.sampleTracker = data.sampleTracker || [];
    this.orderId = data.orderId || '';
    this.oldDesignOrderId = data.oldDesignOrderId || '';
    this.sampler = data.sampler || '';
    this.sampleStartTime = data.sampleStartTime || null;
    this.sampleEndTime = data.sampleEndTime || null;
    this.actualDeliveryDate = data.actualDeliveryDate || null;
    this.expectedDeliveryDate = data.expectedDeliveryDate || null;
    this.qualityCheckResult = data.qualityCheckResult || '';
    this.qualityCheckBy = data.qualityCheckBy || '';
    this.qualityCheckAt = data.qualityCheckAt || null;
    this.customerFeedback = data.customerFeedback || '';
    this.customerFeedbackAt = data.customerFeedbackAt || null;
    this.remarks = data.remarks || '';
    this.materialsNeeded = data.materialsNeeded || [];
    this.materialsProvided = data.materialsProvided || [];
    this.createdBy = data.createdBy || '';
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedBy = data.updatedBy || '';
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.isBatchImport = data.isBatchImport || false;
    this.batchId = data.batchId || '';
  }

  generateId() {
    return 'SMP' + Date.now() + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  }

  addTracker(action, operator, remarks = '') {
    this.sampleTracker.push({
      action,
      operator,
      remarks,
      timestamp: new Date().toISOString()
    });
    this.updatedAt = new Date().toISOString();
    this.updatedBy = operator;
  }

  getMissingMaterials() {
    return this.materialsNeeded.filter(
      needed => !this.materialsProvided.some(provided => provided.materialCode === needed.materialCode)
    );
  }

  toJSON() {
    return {
      sampleId: this.sampleId,
      companyId: this.companyId,
      companyName: this.companyName,
      contactPerson: this.contactPerson,
      contactPhone: this.contactPhone,
      giftCategory: this.giftCategory,
      giftName: this.giftName,
      giftModel: this.giftModel,
      material: this.material,
      specification: this.specification,
      color: this.color,
      quantity: this.quantity,
      unitPrice: this.unitPrice,
      totalAmount: this.totalAmount,
      customizationType: this.customizationType,
      printingMethod: this.printingMethod,
      logoPosition: this.logoPosition,
      designVersion: this.designVersion,
      designConfirmed: this.designConfirmed,
      designConfirmedBy: this.designConfirmedBy,
      designConfirmedAt: this.designConfirmedAt,
      sampleStatus: this.sampleStatus,
      sampleTracker: this.sampleTracker,
      orderId: this.orderId,
      oldDesignOrderId: this.oldDesignOrderId,
      sampler: this.sampler,
      sampleStartTime: this.sampleStartTime,
      sampleEndTime: this.sampleEndTime,
      actualDeliveryDate: this.actualDeliveryDate,
      expectedDeliveryDate: this.expectedDeliveryDate,
      qualityCheckResult: this.qualityCheckResult,
      qualityCheckBy: this.qualityCheckBy,
      qualityCheckAt: this.qualityCheckAt,
      customerFeedback: this.customerFeedback,
      customerFeedbackAt: this.customerFeedbackAt,
      remarks: this.remarks,
      materialsNeeded: this.materialsNeeded,
      materialsProvided: this.materialsProvided,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedBy: this.updatedBy,
      updatedAt: this.updatedAt,
      isBatchImport: this.isBatchImport,
      batchId: this.batchId,
      missingMaterials: this.getMissingMaterials()
    };
  }
}

module.exports = GiftSample;
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const checkRecipientQualification = async (recipientId) => {
  const recipient = await prisma.recipient.findUnique({
    where: { id: recipientId }
  });

  if (!recipient) {
    return { valid: false, error: '接收人不存在' };
  }

  if (!recipient.isActive) {
    return { valid: false, error: '接收人资质已被禁用' };
  }

  const today = new Date();
  if (new Date(recipient.expiryDate) <= today) {
    return { valid: false, error: '接收人资质已过期' };
  }

  return { valid: true, recipient };
};

const checkSampleBatch = async (batchId) => {
  const batch = await prisma.sampleBatch.findUnique({
    where: { id: batchId }
  });

  if (!batch) {
    return { valid: false, error: '样本批次不存在' };
  }

  if (!batch.batchNumber || batch.batchNumber.trim() === '') {
    return { valid: false, error: '样本批号缺失' };
  }

  const today = new Date();
  if (new Date(batch.expiryDate) <= today) {
    return { valid: false, error: '样本批次已过期' };
  }

  return { valid: true, batch };
};

const checkDuplicateShipment = async (batchId, institutionId, recipientId) => {
  const existingShipments = await prisma.shipment.findMany({
    where: {
      batchId,
      institutionId,
      recipientId,
      status: {
        in: ['PENDING', 'APPROVED', 'SHIPPED', 'DELIVERED']
      }
    }
  });

  if (existingShipments.length > 0) {
    return { valid: false, error: '存在重复寄送申请', existingShipments };
  }

  return { valid: true };
};

const checkTemperatureReview = async (shipmentId) => {
  const tempRecords = await prisma.temperatureRecord.findMany({
    where: {
      shipmentId,
      status: 'EXCEEDED'
    }
  });

  const unreviewedRecords = tempRecords.filter(r => !r.reviewedBy);
  
  if (unreviewedRecords.length > 0) {
    return { 
      valid: false, 
      error: `存在 ${unreviewedRecords.length} 条温控超限记录未复核`,
      unreviewedCount: unreviewedRecords.length
    };
  }

  return { valid: true };
};

const checkDestructionReceipt = async (shipmentId) => {
  const receipt = await prisma.destructionReceipt.findUnique({
    where: { shipmentId }
  });

  if (!receipt) {
    return { valid: false, error: '销毁回执缺失' };
  }

  return { valid: true, receipt };
};

const validateShipmentCreation = async (data) => {
  const errors = [];

  const batchCheck = await checkSampleBatch(data.batchId);
  if (!batchCheck.valid) errors.push(batchCheck.error);

  const recipientCheck = await checkRecipientQualification(data.recipientId);
  if (!recipientCheck.valid) errors.push(recipientCheck.error);

  const duplicateCheck = await checkDuplicateShipment(
    data.batchId,
    data.institutionId,
    data.recipientId
  );
  if (!duplicateCheck.valid) errors.push(duplicateCheck.error);

  return {
    valid: errors.length === 0,
    errors
  };
};

const validateShipmentClosure = async (shipmentId) => {
  const errors = [];

  const tempReviewCheck = await checkTemperatureReview(shipmentId);
  if (!tempReviewCheck.valid) errors.push(tempReviewCheck.error);

  const destructionCheck = await checkDestructionReceipt(shipmentId);
  if (!destructionCheck.valid) errors.push(destructionCheck.error);

  return {
    valid: errors.length === 0,
    errors
  };
};

module.exports = {
  checkRecipientQualification,
  checkSampleBatch,
  checkDuplicateShipment,
  checkTemperatureReview,
  checkDestructionReceipt,
  validateShipmentCreation,
  validateShipmentClosure
};

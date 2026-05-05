const { v4: uuidv4 } = require('uuid');
const prescriptionDao = require('../dao/prescriptionDao');
const inventoryDao = require('../dao/inventoryDao');
const auditDao = require('../dao/auditDao');

class BusinessError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
    this.name = 'BusinessError';
  }
}

const generatePrescriptionNo = () => {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `RX${dateStr}${random}`;
};

const createPrescription = (data, operator = 'system', requestIp = '') => {
  const { patientName, patientIdCard, items } = data;

  if (!items || items.length === 0) {
    throw new BusinessError('处方药品明细不能为空', 'EMPTY_ITEMS');
  }

  for (const item of items) {
    const inventory = inventoryDao.getInventoryByDrugCode(item.drugCode);
    if (!inventory) {
      throw new BusinessError(`药品编码 ${item.drugCode} 不存在`, 'DRUG_NOT_FOUND');
    }
    if (item.quantity <= 0) {
      throw new BusinessError(`药品 ${inventory.drug_name} 数量必须大于0`, 'INVALID_QUANTITY');
    }
  }

  let totalAmount = 0;
  const enrichedItems = items.map(item => {
    const inventory = inventoryDao.getInventoryByDrugCode(item.drugCode);
    const itemAmount = inventory.price * item.quantity;
    totalAmount += itemAmount;
    return {
      ...item,
      drugName: inventory.drug_name,
      price: inventory.price,
      amount: itemAmount
    };
  });

  const medicalInsuranceAmount = totalAmount * 0.7;
  const personalPaymentAmount = totalAmount * 0.3;

  const prescriptionNo = generatePrescriptionNo();

  const prescription = prescriptionDao.createPrescription({
    prescriptionNo,
    patientName,
    patientIdCard,
    totalAmount: parseFloat(totalAmount.toFixed(2)),
    medicalInsuranceAmount: parseFloat(medicalInsuranceAmount.toFixed(2)),
    personalPaymentAmount: parseFloat(personalPaymentAmount.toFixed(2)),
    items: enrichedItems
  });

  auditDao.createAuditLog({
    operationType: 'CREATE_PRESCRIPTION',
    operationDesc: `创建处方 ${prescriptionNo}`,
    resourceType: 'prescription',
    resourceId: prescription.id,
    operator,
    requestIp,
    success: true
  });

  return prescription;
};

const getPrescription = (idOrNo) => {
  if (typeof idOrNo === 'number' || /^\d+$/.test(idOrNo)) {
    return prescriptionDao.getPrescriptionById(parseInt(idOrNo));
  }
  return prescriptionDao.getPrescriptionByNo(idOrNo);
};

const listPrescriptions = () => {
  return prescriptionDao.getAllPrescriptions();
};

module.exports = {
  createPrescription,
  getPrescription,
  listPrescriptions,
  BusinessError
};

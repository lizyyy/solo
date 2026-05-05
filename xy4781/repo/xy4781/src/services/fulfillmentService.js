const { v4: uuidv4 } = require('uuid');
const { getDb, runSql, getOne, saveDatabase } = require('../database/connection');
const prescriptionDao = require('../dao/prescriptionDao');
const inventoryDao = require('../dao/inventoryDao');
const fulfillmentDao = require('../dao/fulfillmentDao');
const auditDao = require('../dao/auditDao');

class FulfillmentError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
    this.name = 'FulfillmentError';
  }
}

const generateFulfillmentNo = () => {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `FL${dateStr}${random}`;
};

const generatePaymentNo = () => {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `PY${dateStr}${random}`;
};

const isInTransaction = () => {
  try {
    const result = runSql('SELECT 1');
    return true;
  } catch (err) {
    return false;
  }
};

const executeTransaction = (db, executeFn) => {
  runSql('BEGIN TRANSACTION');
  try {
    const result = executeFn();
    runSql('COMMIT');
    saveDatabase();
    return result;
  } catch (err) {
    try {
      runSql('ROLLBACK');
    } catch (rollbackErr) {
      console.warn('Transaction rollback failed (may have already been rolled back):', rollbackErr.message);
    }
    throw err;
  }
};

const fulfillPrescription = (data, operator = 'system', requestIp = '') => {
  const db = getDb();
  const { prescriptionNo, pharmacistName } = data;

  const prescription = prescriptionDao.getPrescriptionByNo(prescriptionNo);
  if (!prescription) {
    throw new FulfillmentError(`处方 ${prescriptionNo} 不存在`, 'PRESCRIPTION_NOT_FOUND');
  }

  if (prescription.status === 'FULFILLED') {
    throw new FulfillmentError(`处方 ${prescriptionNo} 已核销，不可重复操作`, 'PRESCRIPTION_ALREADY_FULFILLED');
  }

  if (prescription.status === 'CANCELLED') {
    throw new FulfillmentError(`处方 ${prescriptionNo} 已作废`, 'PRESCRIPTION_CANCELLED');
  }

  for (const item of prescription.items) {
    const inventory = inventoryDao.getInventoryByDrugCode(item.drugCode);
    if (!inventory) {
      throw new FulfillmentError(`药品 ${item.drugName} 不存在`, 'DRUG_NOT_FOUND');
    }
    if (inventory.quantity < item.quantity) {
      throw new FulfillmentError(`药品 ${item.drugName} 库存不足，当前库存: ${inventory.quantity}, 需要: ${item.quantity}`, 'INSUFFICIENT_INVENTORY');
    }
  }

  const executeFn = () => {
    const fulfillmentNo = generateFulfillmentNo();
    const paymentNo = generatePaymentNo();
    const paymentTime = new Date().toISOString();

    const fulfillment = fulfillmentDao.createFulfillment({
      fulfillmentNo,
      prescriptionId: prescription.id,
      prescriptionNo: prescription.prescription_no,
      pharmacistName,
      items: prescription.items
    });

    const paymentRecord = fulfillmentDao.createPaymentRecord({
      paymentNo,
      fulfillmentId: fulfillment.id,
      prescriptionId: prescription.id,
      prescriptionNo: prescription.prescription_no,
      totalAmount: prescription.total_amount,
      medicalInsuranceAmount: prescription.medical_insurance_amount,
      personalPaymentAmount: prescription.personal_payment_amount,
      paymentStatus: 'SUCCESS',
      paymentTime
    });

    for (const item of prescription.items) {
      const inventory = inventoryDao.getInventoryByDrugCode(item.drugCode);
      const newBalance = inventory.quantity - item.quantity;
      
      const result = inventoryDao.deductInventory(item.drugCode, item.quantity);
      if (result.changes === 0) {
        throw new FulfillmentError(`药品 ${item.drugName} 扣减库存失败`, 'INVENTORY_DEDUCTION_FAILED');
      }

      inventoryDao.createInventoryTransaction({
        inventoryId: inventory.id,
        drugCode: item.drugCode,
        drugName: item.drugName,
        transactionType: 'DEDUCT',
        quantity: item.quantity,
        balanceAfter: newBalance,
        referenceType: 'FULFILLMENT',
        referenceId: fulfillment.id
      });
    }

    fulfillmentDao.updateFulfillmentStatus(fulfillment.id, 'COMPLETED');
    fulfillmentDao.updatePaymentStatus(paymentRecord.id, 'SUCCESS', paymentTime);
    prescriptionDao.updatePrescriptionStatus(prescription.id, 'FULFILLED');

    return {
      fulfillment: fulfillmentDao.getFulfillmentById(fulfillment.id),
      paymentRecord: fulfillmentDao.getPaymentRecordById(paymentRecord.id),
      prescription: prescriptionDao.getPrescriptionById(prescription.id)
    };
  };

  try {
    const result = executeTransaction(db, executeFn);

    auditDao.createAuditLog({
      operationType: 'FULFILL_PRESCRIPTION',
      operationDesc: `核销处方 ${prescriptionNo}`,
      resourceType: 'fulfillment',
      resourceId: result.fulfillment.id,
      operator,
      requestIp,
      success: true
    });
    saveDatabase();

    return {
      ...result,
      resourceId: result.fulfillment.id
    };
  } catch (error) {
    auditDao.createAuditLog({
      operationType: 'FULFILL_PRESCRIPTION',
      operationDesc: `核销处方 ${prescriptionNo} 失败`,
      resourceType: 'prescription',
      resourceId: prescription.id,
      operator,
      requestIp,
      success: false,
      errorMessage: error.message
    });
    saveDatabase();
    throw error;
  }
};

const cancelFulfillment = (data, operator = 'system', requestIp = '') => {
  const db = getDb();
  const { fulfillmentNo, reason } = data;

  const fulfillment = fulfillmentDao.getFulfillmentByNo(fulfillmentNo);
  if (!fulfillment) {
    throw new FulfillmentError(`核销单 ${fulfillmentNo} 不存在`, 'FULFILLMENT_NOT_FOUND');
  }

  if (fulfillment.status === 'CANCELLED') {
    throw new FulfillmentError(`核销单 ${fulfillmentNo} 已撤销`, 'FULFILLMENT_ALREADY_CANCELLED');
  }

  const prescription = prescriptionDao.getPrescriptionById(fulfillment.prescription_id);
  if (!prescription) {
    throw new FulfillmentError(`关联处方不存在`, 'PRESCRIPTION_NOT_FOUND');
  }

  const executeFn = () => {
    const paymentRecord = fulfillmentDao.getPaymentRecordByFulfillmentId(fulfillment.id);

    for (const item of fulfillment.items) {
      const inventory = inventoryDao.getInventoryByDrugCode(item.drugCode);
      const newBalance = inventory.quantity + item.quantity;

      inventoryDao.addInventory(item.drugCode, item.quantity);

      inventoryDao.createInventoryTransaction({
        inventoryId: inventory.id,
        drugCode: item.drugCode,
        drugName: item.drugName,
        transactionType: 'ADD',
        quantity: item.quantity,
        balanceAfter: newBalance,
        referenceType: 'FULFILLMENT_CANCEL',
        referenceId: fulfillment.id
      });
    }

    fulfillmentDao.updateFulfillmentStatus(fulfillment.id, 'CANCELLED');
    if (paymentRecord) {
      fulfillmentDao.updatePaymentStatus(paymentRecord.id, 'REFUNDED', new Date().toISOString());
    }
    prescriptionDao.updatePrescriptionStatus(prescription.id, 'CREATED');

    return {
      fulfillment: fulfillmentDao.getFulfillmentById(fulfillment.id),
      paymentRecord: paymentRecord ? fulfillmentDao.getPaymentRecordById(paymentRecord.id) : null,
      prescription: prescriptionDao.getPrescriptionById(prescription.id),
      reason
    };
  };

  try {
    const result = executeTransaction(db, executeFn);

    auditDao.createAuditLog({
      operationType: 'CANCEL_FULFILLMENT',
      operationDesc: `撤销核销单 ${fulfillmentNo}，原因: ${reason || '未说明'}`,
      resourceType: 'fulfillment',
      resourceId: fulfillment.id,
      operator,
      requestIp,
      success: true
    });
    saveDatabase();

    return {
      ...result,
      resourceId: fulfillment.id
    };
  } catch (error) {
    auditDao.createAuditLog({
      operationType: 'CANCEL_FULFILLMENT',
      operationDesc: `撤销核销单 ${fulfillmentNo} 失败`,
      resourceType: 'fulfillment',
      resourceId: fulfillment.id,
      operator,
      requestIp,
      success: false,
      errorMessage: error.message
    });
    saveDatabase();
    throw error;
  }
};

const getFulfillment = (idOrNo) => {
  if (typeof idOrNo === 'number' || /^\d+$/.test(idOrNo)) {
    return fulfillmentDao.getFulfillmentById(parseInt(idOrNo));
  }
  return fulfillmentDao.getFulfillmentByNo(idOrNo);
};

const listFulfillments = () => {
  return fulfillmentDao.getAllFulfillments();
};

const listPayments = () => {
  return fulfillmentDao.getAllPaymentRecords();
};

module.exports = {
  fulfillPrescription,
  cancelFulfillment,
  getFulfillment,
  listFulfillments,
  listPayments,
  FulfillmentError
};

const { getOne, getAll } = require('../database/connection');
const prescriptionDao = require('../dao/prescriptionDao');
const fulfillmentDao = require('../dao/fulfillmentDao');
const inventoryDao = require('../dao/inventoryDao');
const auditDao = require('../dao/auditDao');

const checkInventoryDiscrepancies = () => {
  const discrepancies = [];
  const inventoryItems = inventoryDao.getAllInventory();

  for (const item of inventoryItems) {
    const transactions = getOne(`
      SELECT 
        SUM(CASE WHEN transaction_type = 'DEDUCT' THEN -quantity ELSE quantity END) as net_change
      FROM inventory_transactions
      WHERE inventory_id = ?
    `, [item.id]);

    const expectedQuantity = transactions && transactions.net_change !== null 
      ? (item.quantity - transactions.net_change) + transactions.net_change 
      : item.quantity;

    if (expectedQuantity !== item.quantity) {
      discrepancies.push({
        type: 'INVENTORY_BALANCE_MISMATCH',
        drugCode: item.drug_code,
        drugName: item.drug_name,
        currentQuantity: item.quantity,
        expectedQuantity,
        message: `药品 ${item.drug_name} 库存账面余额与交易记录不符`
      });
    }
  }

  return discrepancies;
};

const checkPrescriptionFulfillmentDiscrepancies = () => {
  const discrepancies = [];
  
  const fulfilledPrescriptions = getAll(`
    SELECT p.*, f.id as fulfillment_id, f.status as fulfillment_status, f.fulfillment_no
    FROM prescriptions p
    LEFT JOIN fulfillments f ON p.id = f.prescription_id
    WHERE p.status = 'FULFILLED'
  `);

  for (const prescription of fulfilledPrescriptions) {
    if (!prescription.fulfillment_id) {
      discrepancies.push({
        type: 'PRESCRIPTION_WITHOUT_FULFILLMENT',
        prescriptionNo: prescription.prescription_no,
        patientName: prescription.patient_name,
        message: `处方状态为已核销但无核销记录`
      });
      continue;
    }

    const paymentRecord = fulfillmentDao.getPaymentRecordByFulfillmentId(prescription.fulfillment_id);
    if (!paymentRecord) {
      discrepancies.push({
        type: 'FULFILLMENT_WITHOUT_PAYMENT',
        prescriptionNo: prescription.prescription_no,
        fulfillmentNo: prescription.fulfillment_no,
        message: `核销单无对应的支付记录`
      });
      continue;
    }

    if (paymentRecord.payment_status !== 'SUCCESS') {
      discrepancies.push({
        type: 'PAYMENT_STATUS_MISMATCH',
        prescriptionNo: prescription.prescription_no,
        fulfillmentNo: prescription.fulfillment_no,
        paymentStatus: paymentRecord.payment_status,
        message: `支付状态异常，当前状态: ${paymentRecord.payment_status}`
      });
    }

    if (Math.abs(paymentRecord.total_amount - prescription.total_amount) > 0.01) {
      discrepancies.push({
        type: 'AMOUNT_MISMATCH',
        prescriptionNo: prescription.prescription_no,
        fulfillmentNo: prescription.fulfillment_no,
        prescriptionAmount: prescription.total_amount,
        paymentAmount: paymentRecord.total_amount,
        message: `处方金额与支付金额不一致`
      });
    }
  }

  return discrepancies;
};

const checkInventoryTransactionDiscrepancies = () => {
  const discrepancies = [];
  
  const fulfillments = getAll(`
    SELECT f.*, p.status as prescription_status
    FROM fulfillments f
    LEFT JOIN prescriptions p ON f.prescription_id = p.id
    WHERE f.status = 'COMPLETED'
  `);

  for (const fulfillment of fulfillments) {
    const transactions = inventoryDao.getInventoryTransactionsByReference('FULFILLMENT', fulfillment.id);
    
    if (transactions.length === 0) {
      discrepancies.push({
        type: 'FULFILLMENT_WITHOUT_INVENTORY_TRANSACTION',
        fulfillmentNo: fulfillment.fulfillment_no,
        prescriptionNo: fulfillment.prescription_no,
        message: `核销单无对应的库存扣减记录`
      });
    }

    const items = JSON.parse(fulfillment.items);
    if (transactions.length > 0 && transactions.length !== items.length) {
      discrepancies.push({
        type: 'INVENTORY_TRANSACTION_COUNT_MISMATCH',
        fulfillmentNo: fulfillment.fulfillment_no,
        expectedCount: items.length,
        actualCount: transactions.length,
        message: `库存交易记录数量与核销药品数量不符`
      });
    }
  }

  return discrepancies;
};

const getReconciliationReport = () => {
  const inventoryDiscrepancies = checkInventoryDiscrepancies();
  const prescriptionDiscrepancies = checkPrescriptionFulfillmentDiscrepancies();
  const inventoryTransactionDiscrepancies = checkInventoryTransactionDiscrepancies();

  const allDiscrepancies = [
    ...inventoryDiscrepancies,
    ...prescriptionDiscrepancies,
    ...inventoryTransactionDiscrepancies
  ];

  const stats = {
    total: allDiscrepancies.length,
    byType: {
      inventory: inventoryDiscrepancies.length,
      prescription: prescriptionDiscrepancies.length,
      inventoryTransaction: inventoryTransactionDiscrepancies.length
    }
  };

  return {
    reportTime: new Date().toISOString(),
    stats,
    discrepancies: allDiscrepancies
  };
};

module.exports = {
  getReconciliationReport,
  checkInventoryDiscrepancies,
  checkPrescriptionFulfillmentDiscrepancies,
  checkInventoryTransactionDiscrepancies
};

const { runSql, getOne, getAll } = require('../database/connection');

const createFulfillment = (data) => {
  const { fulfillmentNo, prescriptionId, prescriptionNo, pharmacistName, items } = data;
  const itemsJson = JSON.stringify(items);
  
  runSql(`
    INSERT INTO fulfillments (fulfillment_no, prescription_id, prescription_no, pharmacist_name, items)
    VALUES (?, ?, ?, ?, ?)
  `, [fulfillmentNo, prescriptionId, prescriptionNo, pharmacistName, itemsJson]);
  
  return getFulfillmentByNo(fulfillmentNo);
};

const getFulfillmentById = (id) => {
  const row = getOne('SELECT * FROM fulfillments WHERE id = ?', [id]);
  if (row) {
    row.items = JSON.parse(row.items);
  }
  return row;
};

const getFulfillmentByNo = (fulfillmentNo) => {
  const row = getOne('SELECT * FROM fulfillments WHERE fulfillment_no = ?', [fulfillmentNo]);
  if (row) {
    row.items = JSON.parse(row.items);
  }
  return row;
};

const getFulfillmentByPrescriptionId = (prescriptionId) => {
  const rows = getAll('SELECT * FROM fulfillments WHERE prescription_id = ? ORDER BY created_at DESC', [prescriptionId]);
  return rows.map(row => ({
    ...row,
    items: JSON.parse(row.items)
  }));
};

const updateFulfillmentStatus = (id, status) => {
  return runSql(`
    UPDATE fulfillments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `, [status, id]);
};

const createPaymentRecord = (data) => {
  const { paymentNo, fulfillmentId, prescriptionId, prescriptionNo, totalAmount, medicalInsuranceAmount, personalPaymentAmount, paymentStatus, paymentTime } = data;
  
  runSql(`
    INSERT INTO payment_records (payment_no, fulfillment_id, prescription_id, prescription_no, total_amount, medical_insurance_amount, personal_payment_amount, payment_status, payment_time)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [paymentNo, fulfillmentId, prescriptionId, prescriptionNo, totalAmount, medicalInsuranceAmount, personalPaymentAmount, paymentStatus, paymentTime]);
  
  return getPaymentRecordByFulfillmentId(fulfillmentId);
};

const getPaymentRecordById = (id) => {
  return getOne('SELECT * FROM payment_records WHERE id = ?', [id]);
};

const getPaymentRecordByFulfillmentId = (fulfillmentId) => {
  return getOne('SELECT * FROM payment_records WHERE fulfillment_id = ?', [fulfillmentId]);
};

const updatePaymentStatus = (id, paymentStatus, paymentTime) => {
  return runSql(`
    UPDATE payment_records SET payment_status = ?, payment_time = ? WHERE id = ?
  `, [paymentStatus, paymentTime, id]);
};

const getAllFulfillments = () => {
  const rows = getAll('SELECT * FROM fulfillments ORDER BY created_at DESC');
  return rows.map(row => ({
    ...row,
    items: JSON.parse(row.items)
  }));
};

const getAllPaymentRecords = () => {
  return getAll('SELECT * FROM payment_records ORDER BY created_at DESC');
};

module.exports = {
  createFulfillment,
  getFulfillmentById,
  getFulfillmentByNo,
  getFulfillmentByPrescriptionId,
  updateFulfillmentStatus,
  createPaymentRecord,
  getPaymentRecordById,
  getPaymentRecordByFulfillmentId,
  updatePaymentStatus,
  getAllFulfillments,
  getAllPaymentRecords
};

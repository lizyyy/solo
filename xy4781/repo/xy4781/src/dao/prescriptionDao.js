const { runSql, getOne, getAll } = require('../database/connection');

const createPrescription = (data) => {
  const { prescriptionNo, patientName, patientIdCard, totalAmount, medicalInsuranceAmount, personalPaymentAmount, items } = data;
  const itemsJson = JSON.stringify(items);
  
  runSql(`
    INSERT INTO prescriptions (prescription_no, patient_name, patient_id_card, total_amount, medical_insurance_amount, personal_payment_amount, items)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [prescriptionNo, patientName, patientIdCard, totalAmount, medicalInsuranceAmount, personalPaymentAmount, itemsJson]);
  
  return getPrescriptionByNo(prescriptionNo);
};

const getPrescriptionById = (id) => {
  const row = getOne('SELECT * FROM prescriptions WHERE id = ?', [id]);
  if (row) {
    row.items = JSON.parse(row.items);
  }
  return row;
};

const getPrescriptionByNo = (prescriptionNo) => {
  const row = getOne('SELECT * FROM prescriptions WHERE prescription_no = ?', [prescriptionNo]);
  if (row) {
    row.items = JSON.parse(row.items);
  }
  return row;
};

const updatePrescriptionStatus = (id, status) => {
  return runSql(`
    UPDATE prescriptions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `, [status, id]);
};

const getAllPrescriptions = () => {
  const rows = getAll('SELECT * FROM prescriptions ORDER BY created_at DESC');
  return rows.map(row => ({
    ...row,
    items: JSON.parse(row.items)
  }));
};

module.exports = {
  createPrescription,
  getPrescriptionById,
  getPrescriptionByNo,
  updatePrescriptionStatus,
  getAllPrescriptions
};

const { initDatabase, runSql, getOne, getAll } = require('./src/database/connection');
const initSchema = require('./src/database/schema');

const test = async () => {
  console.log('Initializing database...');
  await initDatabase();
  console.log('Database initialized');
  
  console.log('Running schema...');
  initSchema();
  console.log('Schema done');
  
  console.log('Testing insert...');
  
  const timestamp = Date.now();
  const prescriptionNo = `RX${timestamp}`;
  
  const result = runSql(`
    INSERT INTO prescriptions (prescription_no, patient_name, patient_id_card, total_amount, medical_insurance_amount, personal_payment_amount, items)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [prescriptionNo, 'Test Patient', '123456', 100.00, 70.00, 30.00, '[]']);
  
  console.log('Insert result:', result);
  console.log('lastInsertRowid:', result.lastInsertRowid);
  console.log('changes:', result.changes);
  
  if (result.lastInsertRowid) {
    const row = getOne('SELECT * FROM prescriptions WHERE id = ?', [result.lastInsertRowid]);
    console.log('Retrieved row:', row);
  } else {
    console.log('No lastInsertRowid, trying to get by prescription_no...');
    const row = getOne('SELECT * FROM prescriptions WHERE prescription_no = ?', [prescriptionNo]);
    console.log('Retrieved row:', row);
  }
  
  console.log('All prescriptions:', getAll('SELECT * FROM prescriptions'));
};

test().catch(console.error);

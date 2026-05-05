const { initDatabase } = require('./src/database/connection');
const initSchema = require('./src/database/schema');
const prescriptionService = require('./src/services/prescriptionService');

const test = async () => {
  console.log('Initializing database...');
  await initDatabase();
  console.log('Database initialized');
  
  console.log('Running schema...');
  initSchema();
  console.log('Schema done');
  
  console.log('Testing createPrescription...');
  
  try {
    const prescription = prescriptionService.createPrescription({
      patientName: 'Test Patient',
      patientIdCard: '123456',
      items: [
        { drugCode: 'DRUG001', quantity: 2 },
        { drugCode: 'DRUG002', quantity: 1 }
      ]
    }, 'Dr. Test', '127.0.0.1');
    
    console.log('Prescription created:', prescription);
    console.log('Prescription ID:', prescription.id);
    console.log('Prescription No:', prescription.prescription_no);
  } catch (error) {
    console.error('Error:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error stack:', error.stack);
  }
};

test().catch(console.error);

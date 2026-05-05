const { initDatabase } = require('./src/database/connection');
const initSchema = require('./src/database/schema');
const prescriptionService = require('./src/services/prescriptionService');
const fulfillmentService = require('./src/services/fulfillmentService');
const idempotencyService = require('./src/services/idempotencyService');
const inventoryDao = require('./src/dao/inventoryDao');

const test = async () => {
  console.log('Initializing database...');
  await initDatabase();
  console.log('Database initialized');
  
  console.log('Running schema...');
  initSchema();
  console.log('Schema done');
  
  console.log('\n=== Testing Fulfillment ===');
  
  console.log('\n1. Checking initial inventory...');
  const initialInventory = inventoryDao.getAllInventory();
  const drug1 = initialInventory.find(d => d.drug_code === 'DRUG001');
  const drug2 = initialInventory.find(d => d.drug_code === 'DRUG002');
  console.log('   DRUG001 (阿莫西林胶囊):', drug1.quantity);
  console.log('   DRUG002 (布洛芬缓释胶囊):', drug2.quantity);
  
  console.log('\n2. Creating prescription...');
  let prescription;
  try {
    prescription = prescriptionService.createPrescription({
      patientName: 'Test Patient',
      patientIdCard: '123456',
      items: [
        { drugCode: 'DRUG001', quantity: 2 },
        { drugCode: 'DRUG002', quantity: 1 }
      ]
    }, 'Dr. Test', '127.0.0.1');
    console.log('   Prescription created:', prescription.prescription_no);
    console.log('   Prescription ID:', prescription.id);
  } catch (error) {
    console.error('   Error creating prescription:', error.message);
    console.error('   Error stack:', error.stack);
    return;
  }
  
  console.log('\n3. Fulfilling prescription with idempotency key...');
  const idempotencyKey = 'TEST-FULFILL-' + Date.now();
  
  try {
    const result = await idempotencyService.executeWithIdempotency(
      idempotencyKey,
      'FULFILL_PRESCRIPTION',
      async (ctx) => {
        console.log('      Inside executeWithIdempotency operation...');
        return fulfillmentService.fulfillPrescription(
          { prescriptionNo: prescription.prescription_no, pharmacistName: 'Dr. Test' },
          'Dr. Test',
          '127.0.0.1'
        );
      }
    );
    console.log('   Fulfillment result:', result.isDuplicate ? 'Duplicate' : 'New');
    console.log('   Fulfillment data:', JSON.stringify(result.data, null, 2));
  } catch (error) {
    console.error('   Error fulfilling prescription:', error.message);
    console.error('   Error name:', error.name);
    console.error('   Error code:', error.code);
    console.error('   Error stack:', error.stack);
  }
  
  console.log('\n4. Checking inventory after fulfillment...');
  const afterInventory = inventoryDao.getAllInventory();
  const drug1After = afterInventory.find(d => d.drug_code === 'DRUG001');
  const drug2After = afterInventory.find(d => d.drug_code === 'DRUG002');
  console.log('   DRUG001 (阿莫西林胶囊):', drug1After.quantity, '(expected:', drug1.quantity - 2, ')');
  console.log('   DRUG002 (布洛芬缓释胶囊):', drug2After.quantity, '(expected:', drug2.quantity - 1, ')');
  
  console.log('\n=== Test Complete ===');
};

test().catch(console.error);

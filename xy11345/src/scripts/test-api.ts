import 'reflect-metadata';
import '../config/env';
import axios from 'axios';

const API_BASE = 'http://localhost:3000/api';
const ADMIN_KEY = 'admin-qc-key-2024';
const QC_KEY = 'qc_test_001';
const OP_KEY = 'op_test_001';

const headers = {
  'x-api-key': ADMIN_KEY,
  'Content-Type': 'application/json',
};

async function testAPI() {
  console.log('=== Testing QC System API ===\n');

  try {
    console.log('1. Testing health check...');
    const health = await axios.get('http://localhost:3000/health', { headers: {} });
    console.log('   Health check:', health.data.success ? 'PASS' : 'FAIL');
  } catch (e: any) {
    console.log('   Health check: FAIL -', e.message);
  }

  try {
    console.log('\n2. Testing batch import...');
    const testBatch = {
      batchNumber: 'BATCH-TEST-001',
      productName: 'Test Product A',
      customerName: 'Customer XYZ',
      quantity: 1000,
      paperBatchNumber: 'PAPER-001',
      productionDate: new Date().toISOString().split('T')[0],
      machineId: 'MACHINE-A',
      operator: 'John Doe',
      standardLabValues: {
        L: 95.0,
        a: 0.5,
        b: -1.0,
        tolerance: 2.0,
      },
      labRecords: [
        {
          L: 94.5,
          a: 0.8,
          b: -0.7,
          tolerance: 2.0,
          measurePoint: 'Top-Left',
          measureOrder: 1,
        },
        {
          L: 95.2,
          a: 0.3,
          b: -1.2,
          tolerance: 2.0,
          measurePoint: 'Top-Right',
          measureOrder: 2,
        },
        {
          L: 94.8,
          a: 0.6,
          b: -0.9,
          tolerance: 2.0,
          measurePoint: 'Bottom-Left',
          measureOrder: 3,
        },
      ],
      remark: 'Test batch',
    };

    const importRes = await axios.post(`${API_BASE}/batches/import`, testBatch, { headers });
    console.log('   Import result:', importRes.data.success ? 'PASS' : 'FAIL');
    console.log('   Batch created:', importRes.data.isNew);
  } catch (e: any) {
    console.log('   Import failed:', e.response?.data?.message || e.message);
  }

  try {
    console.log('\n3. Testing idempotent import (same batch)...');
    const testBatch = {
      batchNumber: 'BATCH-TEST-001',
      productName: 'Test Product A',
      customerName: 'Customer XYZ',
      productionDate: new Date().toISOString().split('T')[0],
      standardLabValues: {
        L: 95.0,
        a: 0.5,
        b: -1.0,
        tolerance: 2.0,
      },
      labRecords: [
        {
          L: 94.5,
          a: 0.8,
          b: -0.7,
          tolerance: 2.0,
          measurePoint: 'Top-Left',
          measureOrder: 1,
        },
      ],
    };

    const importRes = await axios.post(`${API_BASE}/batches/import`, testBatch, { headers });
    console.log('   Import result:', importRes.data.success ? 'PASS' : 'FAIL');
    console.log('   Is new batch:', importRes.data.isNew, '(should be false)');
  } catch (e: any) {
    console.log('   Import failed:', e.response?.data?.message || e.message);
  }

  try {
    console.log('\n4. Testing batch judgment (QC role)...');
    const qcHeaders = { ...headers, 'x-api-key': QC_KEY };
    const judgmentRes = await axios.post(
      `${API_BASE}/batches/judgment`,
      {
        batchNumber: 'BATCH-TEST-001',
        isPassed: true,
        remark: 'All measurements within tolerance',
        judgeName: 'QC Inspector',
      },
      { headers: qcHeaders }
    );
    console.log('   Judgment result:', judgmentRes.data.success ? 'PASS' : 'FAIL');
    console.log('   Batch status:', judgmentRes.data.data.status);
  } catch (e: any) {
    console.log('   Judgment failed:', e.response?.data?.message || e.message);
  }

  try {
    console.log('\n5. Testing batch review...');
    const reviewRes = await axios.post(
      `${API_BASE}/batches/review`,
      {
        batchNumber: 'BATCH-TEST-001',
        reviewResult: 'confirm_pass',
        remark: 'Review passed, ready for shipping',
        reviewerName: 'Senior QC',
      },
      { headers }
    );
    console.log('   Review result:', reviewRes.data.success ? 'PASS' : 'FAIL');
    console.log('   Batch status:', reviewRes.data.data.status);
  } catch (e: any) {
    console.log('   Review failed:', e.response?.data?.message || e.message);
  }

  try {
    console.log('\n6. Testing quality order generation...');
    const orderRes = await axios.post(
      `${API_BASE}/batches/quality-order`,
      {
        batchNumber: 'BATCH-TEST-001',
        inspector: 'Inspector A',
      },
      { headers }
    );
    console.log('   Quality order result:', orderRes.data.success ? 'PASS' : 'FAIL');
    console.log('   Order number:', orderRes.data.data.orderNumber);
  } catch (e: any) {
    console.log('   Quality order failed:', e.response?.data?.message || e.message);
  }

  try {
    console.log('\n7. Testing get batch...');
    const getRes = await axios.get(`${API_BASE}/batches/BATCH-TEST-001`, { headers });
    console.log('   Get batch result:', getRes.data.success ? 'PASS' : 'FAIL');
    console.log('   Batch number:', getRes.data.data.batchNumber);
    console.log('   Lab records count:', getRes.data.data.labRecords?.length || 0);
    console.log('   Customer name (masked?):', getRes.data.data.customerName);
  } catch (e: any) {
    console.log('   Get batch failed:', e.response?.data?.message || e.message);
  }

  try {
    console.log('\n8. Testing list batches...');
    const listRes = await axios.get(`${API_BASE}/batches`, { headers });
    console.log('   List batches result:', listRes.data.success ? 'PASS' : 'FAIL');
    console.log('   Total batches:', listRes.data.data.total);
  } catch (e: any) {
    console.log('   List batches failed:', e.response?.data?.message || e.message);
  }

  try {
    console.log('\n9. Testing trend data...');
    const trendRes = await axios.get(`${API_BASE}/batches/trend`, { headers });
    console.log('   Trend data result:', trendRes.data.success ? 'PASS' : 'FAIL');
    console.log('   Periods count:', trendRes.data.data.length);
  } catch (e: any) {
    console.log('   Trend data failed:', e.response?.data?.message || e.message);
  }

  try {
    console.log('\n10. Testing audit logs (admin only)...');
    const auditRes = await axios.get(`${API_BASE}/audit-logs`, { headers });
    console.log('   Audit logs result:', auditRes.data.success ? 'PASS' : 'FAIL');
    console.log('   Logs count:', auditRes.data.data.total);
  } catch (e: any) {
    console.log('   Audit logs failed:', e.response?.data?.message || e.message);
  }

  try {
    console.log('\n11. Testing non-admin audit log access (should fail)...');
    const opHeaders = { ...headers, 'x-api-key': OP_KEY };
    try {
      await axios.get(`${API_BASE}/audit-logs`, { headers: opHeaders });
      console.log('   Non-admin audit access: FAIL (should have been rejected)');
    } catch (e: any) {
      console.log('   Non-admin audit access: PASS (correctly rejected)');
      console.log('   Status code:', e.response?.status);
    }
  } catch (e: any) {
    console.log('   Test failed:', e.message);
  }

  try {
    console.log('\n12. Testing mark batch complete...');
    const completeRes = await axios.patch(
      `${API_BASE}/batches/BATCH-TEST-001/complete`,
      {},
      { headers }
    );
    console.log('   Mark complete result:', completeRes.data.success ? 'PASS' : 'FAIL');
    console.log('   Final status:', completeRes.data.data.status);
  } catch (e: any) {
    console.log('   Mark complete failed:', e.response?.data?.message || e.message);
  }

  console.log('\n=== Test Complete ===');
}

testAPI();

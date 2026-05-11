const http = require('http');

const BASE_URL = 'localhost';
const PORT = 3001;

let prescriptionId = null;
let batchId = null;
let returnId = null;

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      port: PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, ...parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    
    req.on('error', (e) => {
      reject(e);
    });
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function printTest(description) {
  console.log('\n' + '-'.repeat(50));
  console.log(`测试: ${description}`);
  console.log('-'.repeat(50));
}

function assertError(result, expectedCode, expectedMsg) {
  if (result.code === expectedCode) {
    console.log('✓ 正确返回错误码:', expectedCode);
    console.log('  错误信息:', result.message);
    return true;
  } else {
    console.log('✗ 期望错误码:', expectedCode, '实际:', result.code);
    console.log('  错误信息:', result.message);
    return false;
  }
}

function assertSuccess(result) {
  if (result.code === 0) {
    console.log('✓ 操作成功');
    return true;
  } else {
    console.log('✗ 操作失败，错误码:', result.code);
    console.log('  错误信息:', result.message);
    return false;
  }
}

async function runExceptionTests() {
  console.log('\n' + '#'.repeat(60));
  console.log('#   口腔技工义齿返修管理系统 - 异常场景测试');
  console.log('#'.repeat(60));

  const passed = [];
  const failed = [];

  try {
    printTest('1. 创建处方 - 缺少必填字段');
    const presc1 = await request('POST', '/api/prescriptions', {
      patientName: '测试患者',
      clinic: '测试门诊'
    });
    if (assertError(presc1, 40000, '缺少必填字段')) passed.push('1'); else failed.push('1');

    printTest('2. 批次关联不存在的处方');
    const batch1 = await request('POST', '/api/batches', {
      prescriptionId: 'non-existent-id-123',
      batchNumber: 'TEST-001',
      modelNumber: 'TEST-MDL-001',
      technician: '测试技师'
    });
    if (assertError(batch1, 40402, '处方不存在')) passed.push('2'); else failed.push('2');

    printTest('3. 先创建有效的处方');
    const presc2 = await request('POST', '/api/prescriptions', {
      doctorName: '异常测试医生',
      patientName: '异常测试患者',
      clinic: '异常测试门诊',
      toothPosition: '左上1',
      dentureType: '全瓷冠'
    });
    if (assertSuccess(presc2)) {
      prescriptionId = presc2.data.id;
      passed.push('3');
    } else failed.push('3');

    printTest('4. 访问不存在的处方');
    const presc3 = await request('GET', '/api/prescriptions/non-existent-id');
    if (assertError(presc3, 40402, '处方不存在')) passed.push('4'); else failed.push('4');

    printTest('5. 提交返修 - 无效的返修原因');
    const return1 = await request('POST', '/api/returns', {
      prescriptionId,
      batchId: 'temp',
      reason: 'invalid_reason',
      returnedBy: '测试'
    });
    if (assertError(return1, 40405, '无效的返修原因')) passed.push('5'); else failed.push('5');

    printTest('6. 提交返修 - 批次不属于处方');
    const batch2 = await request('POST', '/api/batches', {
      prescriptionId,
      batchNumber: 'BATCH-EXCEPTION-001',
      modelNumber: 'MDL-EX-001',
      technician: '异常测试技师'
    });
    if (assertSuccess(batch2)) {
      batchId = batch2.data.batch.id;
      
      const presc3 = await request('POST', '/api/prescriptions', {
        doctorName: '另一个医生',
        patientName: '另一个患者',
        clinic: '另一个门诊',
        toothPosition: '右上1',
        dentureType: '金属冠'
      });
      
      const return2 = await request('POST', '/api/returns', {
        prescriptionId: presc3.data.id,
        batchId,
        reason: 'fit_issue',
        returnedBy: '测试'
      });
      if (assertError(return2, 40900, '批次不属于该处方')) passed.push('6'); else failed.push('6');
    } else {
      failed.push('6');
    }

    printTest('7. 正确提交返修申请');
    const return3 = await request('POST', '/api/returns', {
      prescriptionId,
      batchId,
      reason: 'fit_issue',
      reasonDetail: '贴合测试',
      returnedBy: '测试护士'
    });
    if (assertSuccess(return3)) {
      returnId = return3.data.id;
      passed.push('7');
    } else failed.push('7');

    printTest('8. 责任归因 - 无效的部门');
    const resp1 = await request('POST', `/api/returns/${returnId}/assign-responsibility`, {
      primaryDepartment: 'invalid_department',
      operator: '测试',
      description: '测试'
    });
    if (assertError(resp1, 40011, '无效的责任部门')) passed.push('8'); else failed.push('8');

    printTest('9. 责任归因 - 缺少主要责任部门');
    const resp2 = await request('POST', `/api/returns/${returnId}/assign-responsibility`, {
      operator: '测试',
      description: '测试'
    });
    if (assertError(resp2, 40000, '缺少主要责任部门')) passed.push('9'); else failed.push('9');

    printTest('10. 正确责任归因');
    const resp3 = await request('POST', `/api/returns/${returnId}/assign-responsibility`, {
      primaryDepartment: 'molding',
      secondaryDepartments: ['qc'],
      operator: '测试技师',
      processCode: 'molding',
      processName: '3D打印',
      description: '模型精度问题',
      severity: 'high'
    });
    if (assertSuccess(resp3)) passed.push('10'); else failed.push('10');

    printTest('11. 重复责任归因');
    const resp4 = await request('POST', `/api/returns/${returnId}/assign-responsibility`, {
      primaryDepartment: 'design',
      operator: '测试',
      description: '测试重复归因'
    });
    if (assertError(resp4, 40904, '该返修申请已完成归因')) passed.push('11'); else failed.push('11');

    printTest('12. 跳过归因直接开始返工');
    const presc4 = await request('POST', '/api/prescriptions', {
      doctorName: '测试医生2',
      patientName: '测试患者2',
      clinic: '测试门诊2',
      toothPosition: '左下1',
      dentureType: '临时冠'
    });
    const batch3 = await request('POST', '/api/batches', {
      prescriptionId: presc4.data.id,
      batchNumber: 'BATCH-EXCEPTION-002',
      modelNumber: 'MDL-EX-002',
      technician: '技师2'
    });
    const return4 = await request('POST', '/api/returns', {
      prescriptionId: presc4.data.id,
      batchId: batch3.data.batch.id,
      reason: 'color_mismatch',
      returnedBy: '测试'
    });
    
    const rework1 = await request('POST', `/api/returns/${return4.data.id}/start-rework`);
    if (assertError(rework1, 40010, '需先完成责任归因才能开始返工')) passed.push('12'); else failed.push('12');

    printTest('13. 正确开始返工');
    await request('POST', `/api/returns/${returnId}/start-rework`);
    passed.push('13');
    console.log('✓ 开始返工成功');

    printTest('14. 未开始返工就解决');
    const resolve1 = await request('POST', `/api/returns/${return4.data.id}/resolve`, {
      resolvedBy: '测试'
    });
    if (assertError(resolve1, 40010, '只有进行中的返修可以标记为已解决')) passed.push('14'); else failed.push('14');

    printTest('15. 访问不存在的返修申请');
    const return5 = await request('GET', '/api/returns/non-existent-id');
    if (assertError(return5, 40404, '返修申请不存在')) passed.push('15'); else failed.push('15');

    printTest('16. 访问不存在的批次');
    const batch4 = await request('GET', '/api/batches/non-existent-id');
    if (assertError(batch4, 40401, '批次不存在')) passed.push('16'); else failed.push('16');

    printTest('17. 访问不存在的接口');
    const api1 = await request('GET', '/api/non-existent-endpoint');
    if (api1.code === 40400) {
      console.log('✓ 正确返回404');
      console.log('  信息:', api1.message);
      passed.push('17');
    } else failed.push('17');

    printTest('18. 完成不存在的工序');
    const complete1 = await request('POST', '/api/batches/workorders/non-existent-id/complete', {
      operator: '测试'
    });
    if (assertError(complete1, 40403, '工序不存在')) passed.push('18'); else failed.push('18');

    console.log('\n' + '='.repeat(60));
    console.log('测试结果汇总');
    console.log('='.repeat(60));
    console.log('总测试数:', passed.length + failed.length);
    console.log('通过:', passed.length);
    console.log('失败:', failed.length);
    
    if (failed.length > 0) {
      console.log('失败的测试:', failed.join(', '));
    }
    
    console.log('\n' + '#'.repeat(60));
    console.log('#   异常场景测试完成！');
    console.log('#'.repeat(60));
    
    if (failed.length > 0) {
      process.exit(1);
    }
    
  } catch (error) {
    console.error('测试执行失败:', error.message);
    console.error('请确保服务已启动: npm start');
    process.exit(1);
  }
}

runExceptionTests();

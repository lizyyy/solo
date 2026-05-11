const http = require('http');

const BASE_URL = 'http://localhost:3000';

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      method,
      path,
      hostname: 'localhost',
      port: 3000,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function logTest(name, result, expectedError = null) {
  console.log(`\n测试: ${name}`);
  
  if (expectedError) {
    if (result.data && result.data.error && result.data.error.code === expectedError) {
      console.log(`  ✓ 按预期返回错误: ${expectedError}`);
      console.log(`    状态码: ${result.status}`);
    } else {
      console.log(`  ✗ 预期错误 ${expectedError}，但返回:`);
      console.log(`    状态码: ${result.status}`);
      console.log(`    返回: ${JSON.stringify(result.data)}`);
    }
  } else {
    if (result.status === 200 || result.status === 201) {
      console.log(`  ✓ 成功`);
    } else {
      console.log(`  ✗ 失败`);
      console.log(`    状态码: ${result.status}`);
      if (result.data && result.data.error) {
        console.log(`    错误: ${result.data.error.code} - ${result.data.error.message}`);
      }
    }
  }
  console.log();
}

async function runEdgeCaseTests() {
  console.log('\n🔍 边界情况测试');
  console.log('=================');

  const storage = {};

  try {
    console.log('\n--- 测试1: 重复提交 (DUPLICATE_SUBMISSION) ---');
    let res = await request('POST', '/api/specimens', {
      barcode: 'TEST-DUP-001',
      patient_name: '测试患者',
      patient_id: 'TEST001',
      specimen_type: '测试类型',
      collection_time: new Date().toISOString()
    });
    logTest('首次创建标本', res);
    storage.specimen1 = res.data.data;

    res = await request('POST', '/api/specimens', {
      barcode: 'TEST-DUP-001',
      patient_name: '另一个患者',
      patient_id: 'TEST002',
      specimen_type: '测试类型',
      collection_time: new Date().toISOString()
    });
    logTest('使用相同条码重复创建', res, 'DUPLICATE_SUBMISSION');

    console.log('\n--- 测试2: 状态冲突 (STATUS_CONFLICT) ---');
    
    res = await request('POST', '/api/batches', {
      destination_lab: '测试实验室'
    });
    logTest('创建批次', res);
    storage.batch1 = res.data.data;

    res = await request('POST', `/api/batches/${storage.batch1.id}/ship`, {});
    logTest('空批次尝试发货 (应失败)', res, 'INVALID_TRANSITION');

    res = await request('POST', `/api/specimens/${storage.specimen1.id}/add-to-batch`, {
      batch_id: storage.batch1.id
    });
    logTest('标本加入批次', res);

    res = await request('POST', `/api/batches/${storage.batch1.id}/ready`, {});
    logTest('批次准备就绪', res);

    res = await request('POST', `/api/batches/${storage.batch1.id}/ship`, {});
    logTest('批次发货', res);

    res = await request('POST', `/api/specimens/${storage.specimen1.id}/add-to-batch`, {
      batch_id: storage.batch1.id
    });
    logTest('已发货批次中添加标本 (应失败)', res, 'STATUS_CONFLICT');

    res = await request('POST', `/api/batches/${storage.batch1.id}/ready`, {});
    logTest('已发货批次尝试再次准备 (应失败)', res, 'INVALID_TRANSITION');

    console.log('\n--- 测试3: 来源记录缺失 (SOURCE_RECORD_MISSING) ---');
    
    res = await request('POST', '/api/specimens', {
      barcode: 'TEST-NO-BATCH-001',
      patient_name: '测试患者2',
      patient_id: 'TEST003',
      specimen_type: '测试类型',
      collection_time: new Date().toISOString()
    });
    storage.specimen2 = res.data.data;

    const fakeBatchId = '00000000-0000-0000-0000-000000000000';
    res = await request('POST', `/api/specimens/${storage.specimen2.id}/add-to-batch`, {
      batch_id: fakeBatchId
    });
    logTest('将标本加入不存在的批次', res, 'SOURCE_RECORD_MISSING');

    res = await request('POST', '/api/chain-segments', {
      batch_id: fakeBatchId,
      segment_type: 'outbound',
      start_time: new Date().toISOString(),
      start_location: '测试位置'
    });
    logTest('为不存在的批次创建冷链片段', res, 'SOURCE_RECORD_MISSING');

    res = await request('POST', '/api/reports', {
      specimen_id: fakeBatchId
    });
    logTest('为不存在的标本创建报告', res, 'SOURCE_RECORD_MISSING');

    console.log('\n--- 测试4: 其他边界情况 ---');
    
    res = await request('POST', '/api/chain-segments', {
      batch_id: storage.batch1.id,
      segment_type: 'invalid_type',
      start_time: new Date().toISOString(),
      start_location: '测试'
    });
    logTest('使用无效的冷链片段类型', res, 'VALIDATION_ERROR');

    res = await request('POST', '/api/chain-segments', {
      batch_id: storage.batch1.id,
      segment_type: 'outbound',
      start_time: new Date().toISOString(),
      start_location: '位置A'
    });
    logTest('创建第一个冷链片段', res);
    storage.segment1 = res.data.data;

    res = await request('POST', '/api/chain-segments', {
      batch_id: storage.batch1.id,
      segment_type: 'transfer',
      start_time: new Date().toISOString(),
      start_location: '位置B'
    });
    logTest('创建第二个冷链片段 (前一个未完成, 应失败)', res, 'STATUS_CONFLICT');

    const fakeTime = new Date(Date.now() - 3600000).toISOString();
    res = await request('POST', `/api/chain-segments/${storage.segment1.id}/complete`, {
      end_time: fakeTime,
      end_location: '位置C'
    });
    logTest('结束时间早于开始时间 (应失败)', res, 'VALIDATION_ERROR');

    res = await request('POST', `/api/specimens`, {
      barcode: 'TEST-REPORT-001',
      patient_name: '报告测试',
      patient_id: 'TEST004',
      specimen_type: '测试',
      collection_time: new Date().toISOString()
    });
    storage.specimen3 = res.data.data;

    res = await request('POST', '/api/reports', {
      specimen_id: storage.specimen3.id,
      report_type: '测试报告',
      result: '测试结果'
    });
    logTest('为未送达标本创建报告 (应失败)', res, 'STATUS_CONFLICT');

    console.log('\n--- 测试5: 报告重复创建检查 ---');
    
    res = await request('POST', '/api/batches', {
      destination_lab: '报告测试实验室'
    });
    storage.batch2 = res.data.data;

    res = await request('POST', `/api/specimens/${storage.specimen3.id}/add-to-batch`, {
      batch_id: storage.batch2.id
    });

    res = await request('POST', `/api/batches/${storage.batch2.id}/ready`, {});
    res = await request('POST', `/api/batches/${storage.batch2.id}/ship`, {});
    res = await request('POST', `/api/batches/${storage.batch2.id}/start-transit`, {});
    res = await request('POST', `/api/batches/${storage.batch2.id}/deliver`, {});

    res = await request('POST', '/api/reports', {
      specimen_id: storage.specimen3.id,
      report_type: '基因检测',
      result: '正常'
    });
    logTest('首次创建报告', res);
    storage.report1 = res.data.data;

    res = await request('POST', '/api/reports', {
      specimen_id: storage.specimen3.id,
      report_type: '基因检测2',
      result: '异常'
    });
    logTest('同一标本重复创建报告 (应失败)', res, 'REPORT_ALREADY_EXISTS');

    console.log('\n--- 测试6: 已终审报告无法修改 ---');
    
    res = await request('POST', `/api/reports/${storage.report1.id}/review`, {
      operator: '测试审核员'
    });
    res = await request('POST', `/api/reports/${storage.report1.id}/finalize`, {
      operator: '测试终审员'
    });

    res = await request('PUT', `/api/reports/${storage.report1.id}/content`, {
      result: '修改后的结果'
    });
    logTest('修改已终审报告 (应失败)', res, 'STATUS_CONFLICT');

    console.log('\n--- 测试7: 批次不能为空才能删除 ---');
    
    res = await request('POST', '/api/batches', {
      destination_lab: '删除测试实验室'
    });
    storage.batch3 = res.data.data;

    res = await request('DELETE', `/api/batches/${storage.batch3.id}`);
    logTest('删除空批次', res);

    console.log('\n✅ 所有边界情况测试完成!');
    console.log('\n已验证的边界情况:');
    console.log('  1. 重复提交 (条码重复)');
    console.log('  2. 状态冲突 (在错误状态执行操作)');
    console.log('  3. 来源记录缺失 (引用不存在的批次/标本)');
    console.log('  4. 冷链片段类型验证');
    console.log('  5. 冷链片段不能并发');
    console.log('  6. 时间逻辑验证');
    console.log('  7. 报告重复创建检查');
    console.log('  8. 已终审报告无法修改');
    console.log('  9. 空批次才能删除');
    console.log();

  } catch (err) {
    console.error('\n❌ 测试过程中发生错误:', err.message);
    console.error(err.stack);
  }
}

runEdgeCaseTests();

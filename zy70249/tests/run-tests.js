const http = require('http');

const BASE_URL = 'http://localhost:3000';

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(`${BASE_URL}${path}`, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(data)
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: null,
            raw: data
          });
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

async function runTests() {
  console.log('========================================');
  console.log('  城市树池积水巡检器 - API测试');
  console.log('========================================\n');

  let passed = 0;
  let failed = 0;

  function test(name, result, expected = true) {
    const passedTest = result === expected;
    if (passedTest) {
      console.log(`✅  PASS: ${name}`);
      passed++;
    } else {
      console.log(`❌  FAIL: ${name}`);
      failed++;
    }
    return passedTest;
  }

  try {
    console.log('--- 1. 基础API可用性测试 ---\n');
    
    let res = await makeRequest('GET', '/api/tree-ponds');
    test('GET /api/tree-ponds 返回200', res.status === 200);
    test('响应包含success字段', res.data.success === true);
    test('响应包含count字段', typeof res.data.count === 'number');
    test('响应包含data数组', Array.isArray(res.data.data));

    res = await makeRequest('GET', '/api/tree-species');
    test('GET /api/tree-species 返回200', res.status === 200);

    res = await makeRequest('GET', '/api/disease-records');
    test('GET /api/disease-records 返回200', res.status === 200);

    res = await makeRequest('GET', '/api/statistics');
    test('GET /api/statistics 返回200', res.status === 200);

    console.log('\n--- 2. 数据验证测试 ---\n');

    res = await makeRequest('GET', '/api/tree-ponds');
    const ponds = res.data.data;
    
    if (ponds.length > 0) {
      test('树池数据包含必填字段', 
        ponds.every(p => p.id && p.code && p.location));
      
      test('积水等级在有效范围内 (0-3)', 
        ponds.every(p => p.waterLevel >= 0 && p.waterLevel <= 3));
      
      test('状态值在有效范围内', 
        ponds.every(p => ['pending', 'in_progress', 'completed'].includes(p.status)));

      const hasHighPriority = ponds.some(p => p.waterLevel >= 2 && p.status !== 'completed');
      test('存在需要优先处理的积水树池', hasHighPriority);
    } else {
      console.log('⚠️  跳过: 树池数据为空');
    }

    res = await makeRequest('GET', '/api/tree-species');
    const species = res.data.data;
    if (species.length > 0) {
      test('树种数据包含名称字段', species.every(s => s.name));
      
      const uniqueNames = new Set(species.map(s => s.name));
      test('树种名称唯一', uniqueNames.size === species.length);
    } else {
      console.log('⚠️  跳过: 树种数据为空');
    }

    console.log('\n--- 3. 统计接口验证 ---\n');

    res = await makeRequest('GET', '/api/statistics');
    const stats = res.data.data;
    
    test('统计包含树池总数', typeof stats.totalTreePonds === 'number');
    test('统计包含积水等级分布', stats.byWaterLevel !== undefined);
    test('统计包含状态分布', stats.byStatus !== undefined);
    test('统计包含紧急处置列表', Array.isArray(stats.urgentPonds));
    test('紧急列表最多5项', stats.urgentPonds.length <= 5);

    if (stats.urgentPonds.length > 0) {
      test('紧急列表按优先级排序', 
        stats.urgentPonds.every(p => p.waterLevel >= 2 && p.status !== 'completed'));
      
      let isSorted = true;
      for (let i = 1; i < stats.urgentPonds.length; i++) {
        if (stats.urgentPonds[i-1].waterLevel < stats.urgentPonds[i].waterLevel) {
          isSorted = false;
          break;
        }
      }
      test('紧急列表按积水等级降序排列', isSorted);
    }

    console.log('\n--- 4. 创建操作验证 ---\n');

    const newPond = {
      code: 'TEST-001-' + Date.now(),
      location: '测试路999号',
      treeSpecies: '测试树',
      waterLevel: 2,
      status: 'pending',
      notes: '测试记录'
    };

    res = await makeRequest('POST', '/api/tree-ponds', newPond);
    test('POST /api/tree-ponds 创建成功', res.status === 201 && res.data.success);
    
    const createdId = res.data.data?.id;
    test('创建后返回ID', createdId !== undefined);

    console.log('\n--- 5. 冲突检测验证 ---\n');

    res = await makeRequest('POST', '/api/tree-ponds', newPond);
    test('重复编号返回409冲突', res.status === 409);
    test('冲突响应包含冲突字段信息', res.data.conflictField === 'code');
    test('冲突响应包含已存在记录ID', res.data.existingId !== undefined);

    console.log('\n--- 6. 必填字段验证 ---\n');

    const invalidPond = {
      waterLevel: 1,
      status: 'pending'
    };

    res = await makeRequest('POST', '/api/tree-ponds', invalidPond);
    test('缺失必填字段返回400', res.status === 400);
    test('响应包含missingFields', Array.isArray(res.data.missingFields));
    test('缺失字段包含code', res.data.missingFields.includes('code'));
    test('缺失字段包含location', res.data.missingFields.includes('location'));

    console.log('\n--- 7. 更新操作验证 ---\n');

    if (createdId) {
      res = await makeRequest('PUT', `/api/tree-ponds/${createdId}`, {
        status: 'in_progress',
        notes: '已更新'
      });
      test('PUT 更新状态成功', res.status === 200 && res.data.success);
      test('更新后状态正确', res.data.data.status === 'in_progress');
      test('更新后包含updatedAt', res.data.data.updatedAt !== undefined);
    }

    console.log('\n--- 8. 删除操作验证 ---\n');

    if (createdId) {
      res = await makeRequest('DELETE', `/api/tree-ponds/${createdId}`);
      test('DELETE 删除成功', res.status === 200 && res.data.success);

      res = await makeRequest('GET', '/api/tree-ponds');
      const stillExists = res.data.data.some(p => p.id === createdId);
      test('删除后数据不再存在', !stillExists);
    }

    console.log('\n--- 9. 导出功能验证 ---\n');

    res = await makeRequest('GET', '/api/export');
    test('GET /api/export 返回200', res.status === 200 && res.data.success);
    test('导出数据包含统计信息', res.data.data.statistics !== undefined);
    test('导出数据包含树池列表', Array.isArray(res.data.data.treePonds));
    test('导出数据包含导出时间', res.data.data.exportTime !== undefined);

    console.log('\n--- 10. 带筛选的导出验证 ---\n');

    res = await makeRequest('GET', '/api/export?status=pending');
    const filteredExport = res.data.data;
    
    if (filteredExport.treePonds.length > 0) {
      test('按状态筛选导出正确', 
        filteredExport.treePonds.every(p => p.status === 'pending'));
    } else {
      console.log('⚠️  跳过: 无pending状态数据');
    }

    res = await makeRequest('GET', '/api/export?waterLevel=3');
    const level3Export = res.data.data;
    
    if (level3Export.treePonds.length > 0) {
      test('按积水等级筛选导出正确', 
        level3Export.treePonds.every(p => p.waterLevel === 3));
    } else {
      console.log('⚠️  跳过: 无3级积水数据');
    }

    console.log('\n--- 11. 工作区保存验证 ---\n');

    const workspace = {
      filters: { waterLevel: '2', status: 'pending', species: '' },
      sortBy: 'priority'
    };

    res = await makeRequest('POST', '/api/workspaces/test-workspace', workspace);
    test('POST /api/workspaces 保存成功', res.status === 200 && res.data.success);

    res = await makeRequest('GET', '/api/workspaces');
    test('GET /api/workspaces 返回工作区', res.status === 200 && res.data.success);

    console.log('\n--- 12. 边界条件测试 ---\n');

    res = await makeRequest('PUT', '/api/tree-ponds/99999', { status: 'completed' });
    test('更新不存在的记录返回404', res.status === 404);

    res = await makeRequest('DELETE', '/api/tree-ponds/99999');
    test('删除不存在的记录返回404', res.status === 404);

    const invalidSpecies = { scientificName: 'Test' };
    res = await makeRequest('POST', '/api/tree-species', invalidSpecies);
    test('创建树种缺失name返回400', res.status === 400);

    console.log('\n========================================');
    console.log(`  测试完成: ${passed} 通过, ${failed} 失败`);
    console.log('========================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ 测试执行错误:', error.message);
    console.log('请确保服务器已启动: npm start');
    process.exit(1);
  }
}

runTests();
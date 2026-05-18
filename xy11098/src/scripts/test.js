const http = require('http');

const BASE_URL = 'http://localhost:3000';

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };
    
    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                  花卉温室病害预警系统 - 验收测试              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const results = [];
  let passed = 0;
  let failed = 0;

  function logTest(name, status, data = null) {
    if (status) {
      console.log(`✅ ${name}`);
      passed++;
      results.push({ name, status: 'PASS' });
    } else {
      console.log(`❌ ${name}`);
      if (data) console.log('   错误详情:', JSON.stringify(data, null, 2).slice(0, 500));
      failed++;
      results.push({ name, status: 'FAIL', error: data });
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('1. 测试: 创建正常预警记录');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const normalWarning = {
    greenhouse_id: 'GH-002',
    warning_no: '2024-GH002-DIS-TEST-001',
    disease_type: '锈病',
    severity_level: 'medium',
    affected_area: 120.0,
    detected_date: '2024-05-15 10:00:00',
    reporter: '测试员A',
    description: '叶片出现黄褐色锈状斑点，初期阶段',
    temperature: 24.0,
    humidity: 80,
    ph_value: 6.0,
    fertilizer_used: '有机复合肥',
    pesticide_applied: ''
  };
  
  try {
    const res = await request(`${BASE_URL}/api/warnings`, {
      method: 'POST',
      body: normalWarning
    });
    const isSuccess = res.status === 201 && res.data.success === true;
    logTest('创建正常预警记录', isSuccess, !isSuccess ? res.data : null);
    if (isSuccess) {
      console.log('   预警ID:', res.data.data.id);
      console.log('   预警编号:', res.data.data.warning_no);
    }
  } catch (e) {
    logTest('创建正常预警记录', false, e.message);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('2. 测试: 冲突预警 - 同一区域连续预警未升级');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const conflictWarning = {
    greenhouse_id: 'GH-001',
    warning_no: '2024-GH001-DIS-TEST-002',
    disease_type: '白粉病',
    severity_level: 'low',
    affected_area: 100.0,
    detected_date: '2024-05-15 11:00:00',
    reporter: '测试员B',
    description: '这应该被拒绝 - 因为级别比已存在的medium更低'
  };
  
  try {
    const res = await request(`${BASE_URL}/api/warnings`, {
      method: 'POST',
      body: conflictWarning
    });
    const isConflict = res.status === 409 && 
                       res.data.error.code === 'CONSECUTIVE_WARNING_NOT_UPGRADED';
    logTest('冲突预警（未升级）被正确拒绝', isConflict, !isConflict ? res.data : null);
    if (isConflict) {
      console.log('   错误码:', res.data.error.code);
      console.log('   错误信息:', res.data.error.message.slice(0, 100) + '...');
    }
  } catch (e) {
    logTest('冲突预警（未升级）被正确拒绝', false, e.message);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('3. 测试: 导出CSV数据');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    const res = await request(`${BASE_URL}/api/import-export/export`);
    const hasData = typeof res.data === 'string' && res.data.includes('warning_no');
    logTest('导出CSV数据成功', hasData, !hasData ? '返回数据格式错误' : null);
    if (hasData) {
      const lines = res.data.split('\n').length;
      console.log('   CSV记录数:', lines - 1);
    }
  } catch (e) {
    logTest('导出CSV数据成功', false, e.message);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('4. 测试: 导入CSV（包含坏行）');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const csvContent = `greenhouse_id,warning_no,disease_type,severity_level,affected_area,detected_date,reporter,status,description
GH-003,2024-GH003-DIS-IMP-001,炭疽病,high,85.5,2024-05-13 09:00:00,测试员C,pending,叶片有黑色圆形凹陷病斑
GH-003,2024-GH001-DIS-001,白粉病,medium,50.0,2024-05-14 10:00:00,测试员D,pending,坏行-预警编号重复
,2024-GH003-DIS-IMP-003,灰霉病,low,30.0,2024-05-14 11:00:00,测试员E,pending,坏行-缺少greenhouse_id
GH-004,2024-GH004-DIS-IMP-004,根腐病,critical,200.0,2024-05-15 08:00:00,测试员F,pending,根部腐烂发臭`;
  
  try {
    const res = await request(`${BASE_URL}/api/import-export/import`, {
      method: 'POST',
      body: { csv_content: csvContent, operator: '测试员' }
    });
    const hasSummary = res.data.success === true && res.data.summary;
    logTest('导入CSV（包含坏行）成功', hasSummary, !hasSummary ? res.data : null);
    if (hasSummary) {
      console.log('   总行数:', res.data.summary.totalRows);
      console.log('   成功行数:', res.data.summary.successCount);
      console.log('   失败行数:', res.data.summary.errorCount);
      if (res.data.errorRows.length > 0) {
        console.log('   坏行示例: 第' + res.data.errorRows[0].rowNumber + '行 - ' + res.data.errorRows[0].error);
      }
    }
  } catch (e) {
    logTest('导入CSV（包含坏行）成功', false, e.message);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('5. 测试: 静默覆盖保护');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    const res = await request(`${BASE_URL}/api/warnings/WARN-001`, {
      method: 'PUT',
      body: {
        status: 'confirmed',
        version: 999,
        operator: '测试员'
      }
    });
    const isProtected = res.status === 409 && res.data.error.code === 'SILENT_OVERWRITE_ATTEMPT';
    logTest('静默覆盖保护生效', isProtected, !isProtected ? res.data : null);
    if (isProtected) {
      console.log('   错误码:', res.data.error.code);
    }
  } catch (e) {
    logTest('静默覆盖保护生效', false, e.message);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('6. 测试: 撤回后重新进入流程（单独路径）');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    const withdrawRes = await request(`${BASE_URL}/api/warnings/WARN-002/withdraw`, {
      method: 'POST',
      body: {
        operator: '测试主管',
        reason: '误报，重新核实',
        version: 1
      }
    });
    const withdrawSuccess = withdrawRes.status === 200 && withdrawRes.data.success === true;
    
    if (withdrawSuccess) {
      const reapplyRes = await request(`${BASE_URL}/api/warnings/WARN-002/reapply`, {
        method: 'POST',
        body: {
          new_severity_level: 'critical',
          new_affected_area: 350.0,
          new_description: '经重新核实，病斑扩散速度快，级别提升为critical',
          operator: '测试主管',
          version: 2
        }
      });
      const reapplySuccess = reapplyRes.status === 201 && 
                             reapplyRes.data.success === true &&
                             reapplyRes.data.data.status === 'reapplied';
      logTest('撤回后重新申请成功（新建记录）', reapplySuccess, !reapplySuccess ? reapplyRes.data : null);
      if (reapplySuccess) {
        console.log('   新预警ID:', reapplyRes.data.data.id);
        console.log('   关联原预警ID:', reapplyRes.data.originalWarningId);
        console.log('   新状态:', reapplyRes.data.data.status);
      }
    } else {
      logTest('撤回后重新申请成功', false, withdrawRes.data);
    }
  } catch (e) {
    logTest('撤回后重新申请成功', false, e.message);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('7. 测试: 预警清单一致性检查');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    const res = await request(`${BASE_URL}/api/warnings/consistency/GH-001`);
    const isConsistent = res.data.success === true && res.data.isConsistent === true;
    logTest('预警清单一致性检查通过', isConsistent, !isConsistent ? res.data : null);
    if (isConsistent) {
      console.log('   预警总数:', res.data.totalWarnings);
    }
  } catch (e) {
    logTest('预警清单一致性检查通过', false, e.message);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('8. 测试: 查询预警变更历史');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    const res = await request(`${BASE_URL}/api/warnings/WARN-003/history`);
    const hasHistory = res.data.success === true && res.data.data.length > 0;
    logTest('查询预警变更历史成功', hasHistory, !hasHistory ? res.data : null);
    if (hasHistory) {
      console.log('   历史记录数:', res.data.count);
      console.log('   最近变更:', res.data.data[0].field_changed);
    }
  } catch (e) {
    logTest('查询预警变更历史成功', false, e.message);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('9. 测试: 禁止直接删除预警');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    const res = await request(`${BASE_URL}/api/warnings/WARN-001`, {
      method: 'DELETE'
    });
    const deleteForbidden = res.status === 405;
    logTest('直接删除预警被禁止', deleteForbidden, !deleteForbidden ? res.data : null);
    if (deleteForbidden) {
      console.log('   错误信息:', res.data.error.message);
    }
  } catch (e) {
    logTest('直接删除预警被禁止', false, e.message);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('10. 测试: 查询所有预警记录');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    const res = await request(`${BASE_URL}/api/warnings`);
    const hasWarnings = res.data.success === true && res.data.count > 0;
    logTest('查询所有预警记录成功', hasWarnings, !hasWarnings ? res.data : null);
    if (hasWarnings) {
      console.log('   总预警数:', res.data.count);
      const statuses = {};
      res.data.data.forEach(w => {
        statuses[w.status] = (statuses[w.status] || 0) + 1;
      });
      console.log('   各状态统计:', JSON.stringify(statuses));
    }
  } catch (e) {
    logTest('查询所有预警记录成功', false, e.message);
  }

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                        测试结果汇总                           ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  总测试数: ${String(results.length).padEnd(43)}║`);
  console.log(`║  通过: ${String(passed).padEnd(49)}║`);
  console.log(`║  失败: ${String(failed).padEnd(49)}║`);
  console.log(`║  通过率: ${String(((passed / results.length) * 100).toFixed(1)) + '%'.padEnd(43)}║`);
  console.log('╚══════════════════════════════════════════════════════════════╝');
  
  if (failed === 0) {
    console.log('\n🎉 所有测试通过！系统验收合格！');
  } else {
    console.log('\n⚠️  部分测试失败，请检查上述错误信息。');
  }
  console.log();
}

setTimeout(runTests, 2000);
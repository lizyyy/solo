const http = require('http');

const BASE_URL = 'localhost';
const PORT = 3000;

function request(method, path, data = null) {
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
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

function printHeader(title) {
  console.log('\n' + '═'.repeat(60));
  console.log(`  ${title}`);
  console.log('═'.repeat(60));
}

function printResult(success, message) {
  const icon = success ? '✓' : '✗';
  const color = success ? '\x1b[32m' : '\x1b[31m';
  const reset = '\x1b[0m';
  console.log(`${color}${icon}${reset} ${message}`);
}

async function runTests() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║                                                          ║');
  console.log('║       校园宿舍维修队宿舍维修合并 API - 完整测试流程       ║');
  console.log('║                                                          ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  const recordIds = [];
  const results = {
    pass: 0,
    fail: 0
  };

  try {
    printHeader('1. 基础连通性测试');
    try {
      const res = await request('GET', '/health');
      if (res.status === 200 && res.data.status === 'success') {
        printResult(true, '健康检查通过');
        results.pass++;
      } else {
        printResult(false, '健康检查失败');
        results.fail++;
      }
    } catch (e) {
      printResult(false, '服务未启动，请先运行 npm start');
      console.log('  错误信息:', e.message);
      return;
    }

    printHeader('2. 获取测试数据');
    const recordsRes = await request('GET', '/api/v1/repair-records?building=' + encodeURIComponent('3号楼') + '&roomNumber=' + encodeURIComponent('302'));
    if (recordsRes.status === 200) {
      recordsRes.data.data.forEach((r, i) => {
        recordIds.push(r.id);
        console.log(`  ${i + 1}. ${r.id} - ${r.reporter} - ${r.assignedTeam}`);
      });
      printResult(true, `获取到 ${recordIds.length} 条3号楼302的维修记录`);
      results.pass++;
    } else {
      printResult(false, '获取维修记录失败');
      results.fail++;
      return;
    }

    printHeader('📌 验收用例1: 正常记录合并');
    console.log('  合并前两条记录（同一队伍）');
    const merge1Res = await request('POST', '/api/v1/repair-records/merge', {
      recordIds: [recordIds[0], recordIds[1]],
      mergeOperator: '测试管理员',
      mergeReason: '验收测试-正常合并'
    });

    if (merge1Res.status === 200 && merge1Res.data.status === 'success') {
      printResult(true, '正常合并成功');
      console.log(`    合并记录数: ${merge1Res.data.data.mergedCount}`);
      console.log(`    主记录ID: ${merge1Res.data.data.mergedRecord.id}`);
      results.pass++;
    } else {
      printResult(false, '正常合并失败');
      console.log('    错误:', merge1Res.data.message || merge1Res.data.errorCode);
      results.fail++;
    }

    printHeader('📌 验收用例2: 冲突记录（同寝室不同队伍）');
    console.log('  尝试合并三条记录（第三条属于不同队伍）');
    const merge2Res = await request('POST', '/api/v1/repair-records/merge', {
      recordIds: recordIds.slice(0, 3),
      mergeOperator: '测试管理员',
      mergeReason: '验收测试-冲突合并'
    });

    if (merge2Res.status === 409 && merge2Res.data.errorCode === 'DORM_TEAM_CONFLICT') {
      printResult(true, '冲突检测正常工作');
      console.log(`    错误码: ${merge2Res.data.errorCode}`);
      console.log(`    提示信息: ${merge2Res.data.message}`);
      console.log(`    解决方案: ${merge2Res.data.details.resolution}`);
      results.pass++;
    } else {
      printResult(false, '冲突检测未正常工作');
      console.log('    实际状态码:', merge2Res.status);
      console.log('    实际响应:', merge2Res.data.errorCode || merge2Res.data.message);
      results.fail++;
    }

    printHeader('📌 验收用例3: 导入坏行');
    console.log('  导入4条记录（2条正常 + 2条坏数据）');
    const importRes = await request('POST', '/api/v1/repair-records/import', {
      records: [
        { building: '1号楼', roomNumber: '101', repairType: '水电', description: '灯不亮', reporter: '小明', reporterPhone: '13800138001' },
        { building: '1号楼', roomNumber: '102' },
        { building: '2号楼', roomNumber: '201', repairType: '土木', description: '门锁坏', reporter: '小红', reporterPhone: '13800138002' },
        { description: '窗户漏风' }
      ],
      dryRun: false,
      importOperator: '测试导入员'
    });

    if (importRes.status === 200) {
      const { success, failed } = importRes.data.data;
      console.log(`    总记录数: ${importRes.data.summary.total}`);
      console.log(`    成功数: ${importRes.data.summary.success}`);
      console.log(`    失败数: ${importRes.data.summary.failed}`);
      
      if (success.length === 2 && failed.length === 2) {
        printResult(true, '导入坏行处理正确（2成功2失败）');
        results.pass++;
      } else {
        printResult(false, `导入结果不符合预期（期望2成功2失败，实际${success.length}成功${failed.length}失败）`);
        results.fail++;
      }
    } else {
      printResult(false, '导入请求失败');
      results.fail++;
    }

    printHeader('3. 班组交接复核口径测试');
    const allRecordsRes = await request('GET', '/api/v1/repair-records');
    const reviewRecord = allRecordsRes.data.data.find(r => r.reviewLog && r.reviewLog.length > 0);
    
    if (reviewRecord) {
      printResult(true, '找到带复核日志的演示记录');
      console.log(`    记录ID: ${reviewRecord.id}`);
      console.log(`    复核阶段数: ${reviewRecord.reviewLog.length}`);
      
      const stageNames = {
        'temporary_change': '临时改动',
        'manager_confirm': '负责人确认',
        'final_archive': '最终归档'
      };
      
      reviewRecord.reviewLog.forEach((log, i) => {
        console.log(`      ${i + 1}. ${stageNames[log.stage] || log.stage} - ${log.operator} (${log.operatorRole})`);
      });
      results.pass++;
    } else {
      printResult(false, '未找到带复核日志的记录');
      results.fail++;
    }

    printHeader('4. 导出功能测试');
    const exportRes = await request('GET', '/api/v1/repair-records/export/csv');
    if (exportRes.status === 200 && exportRes.raw) {
      const lines = exportRes.raw.trim().split('\n');
      printResult(true, 'CSV导出成功');
      console.log(`    数据行数: ${lines.length - 1}（不含表头）`);
      console.log(`    表头: ${lines[0].substring(0, 60)}...`);
      results.pass++;
    } else {
      printResult(false, 'CSV导出失败');
      results.fail++;
    }

    printHeader('5. 版本控制测试（防止静默覆盖）');
    const updateRes = await request('PUT', `/api/v1/repair-records/${recordIds[0]}`, {
      expectedVersion: 999,
      status: 'in_progress'
    });

    if (updateRes.status === 409 && updateRes.data.errorCode === 'VERSION_CONFLICT') {
      printResult(true, '版本冲突检测正常工作');
      console.log(`    期望版本: 999`);
      console.log(`    当前版本: ${updateRes.data.details.currentVersion}`);
      results.pass++;
    } else {
      printResult(false, '版本冲突检测未正常工作');
      results.fail++;
    }

    printHeader('6. 周报统计测试');
    const reportRes = await request('GET', '/api/v1/repair-records/report/weekly?weekStart=2024-01-01&weekEnd=2024-12-31');
    if (reportRes.status === 200 && reportRes.data.data.statistics) {
      const stats = reportRes.data.data.statistics;
      printResult(true, '周报统计正常');
      console.log(`    总记录数: ${stats.totalRecords}`);
      console.log(`    按状态统计:`, JSON.stringify(stats.byStatus));
      results.pass++;
    } else {
      printResult(false, '周报统计失败');
      results.fail++;
    }

    printHeader('测试结果汇总');
    console.log(`
  通过率: ${((results.pass / (results.pass + results.fail)) * 100).toFixed(1)}%
  通过: ${results.pass} 项
  失败: ${results.fail} 项
    `);

    if (results.fail === 0) {
      console.log('\x1b[32m%s\x1b[0m', '  ✅ 所有测试通过！系统工作正常！');
    } else {
      console.log('\x1b[33m%s\x1b[0m', '  ⚠️  部分测试未通过，请检查以上日志');
    }

    console.log('\n' + '═'.repeat(60));
    console.log('  提示: 详细的curl命令请查看 tests/curl-commands.md');
    console.log('═'.repeat(60) + '\n');

  } catch (e) {
    console.error('\n❌ 测试过程出错:', e.message);
    console.error(e.stack);
  }
}

runTests();

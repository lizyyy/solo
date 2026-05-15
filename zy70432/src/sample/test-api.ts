#!/usr/bin/env node

import * as http from 'http';

const BASE_URL = 'http://localhost:3000';

function request(method: string, path: string, data?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          resolve({ statusCode: res.statusCode, ...result });
        } catch {
          resolve({ statusCode: res.statusCode, body });
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

function printHeader(title: string) {
  console.log('\n' + '='.repeat(60));
  console.log(`  ${title}`);
  console.log('='.repeat(60));
}

async function runApiTests() {
  try {
    await request('GET', '/health');
  } catch {
    console.log('服务未启动，请先运行: npm run dev');
    process.exit(1);
  }

  printHeader('API测试1: 健康检查');
  const health = await request('GET', '/health');
  console.log('状态码:', health.statusCode);
  console.log(JSON.stringify(health, null, 2));

  printHeader('API测试2: 提交有效记录');
  const validRecord = {
    record: {
      keyword: '智能音箱推荐',
      searchVolume: 15234,
      clickRate: 12.5,
      conversionRate: 3.2,
      avgPosition: 3,
      competition: 'high',
      category: '消费电子',
      region: '华东',
      downloadUrl: 'https://example.com/reports/smart-speaker-2024.csv',
      reportDate: '2024-01-15',
      department: '搜索产品部',
      submittedBy: '张三'
    },
    operator: 'API测试员'
  };
  const submitResult = await request('POST', '/api/v1/recorder/submit', validRecord);
  console.log('状态码:', submitResult.statusCode);
  console.log(JSON.stringify(submitResult, null, 2));

  printHeader('API测试3: 提交下载链接失效的记录');
  const invalidUrlRecord = {
    record: {
      ...validRecord.record,
      keyword: '失效链接测试',
      downloadUrl: 'https://example.com/expired-report.csv'
    },
    operator: 'API测试员'
  };
  const invalidResult = await request('POST', '/api/v1/recorder/submit', invalidUrlRecord);
  console.log('状态码:', invalidResult.statusCode);
  console.log(JSON.stringify(invalidResult, null, 2));

  printHeader('API测试4: 冲突检测');
  const conflictRecord = {
    record: {
      ...validRecord.record,
      downloadUrl: 'https://example.com/reports/conflict.csv',
      submittedBy: '李四'
    },
    operator: 'API测试员'
  };
  const conflictResult = await request('POST', '/api/v1/recorder/submit', conflictRecord);
  console.log('状态码:', conflictResult.statusCode);
  console.log(JSON.stringify(conflictResult, null, 2));

  printHeader('API测试5: 获取所有失败记录');
  const failedRecords = await request('GET', '/api/v1/recorder/failed');
  console.log('状态码:', failedRecords.statusCode);
  console.log(JSON.stringify(failedRecords.data, null, 2));

  printHeader('API测试6: 按失败类型查询 - download_url_invalid');
  const typeQuery = await request('GET', '/api/v1/recorder/failed/download_url_invalid');
  console.log('状态码:', typeQuery.statusCode);
  console.log(`匹配记录数: ${typeQuery.data.count}`);

  printHeader('API测试7: 导出失败记录');
  const exportData = { format: 'csv' };
  const exportResult = await request('POST', '/api/v1/export/failed', exportData);
  console.log('状态码:', exportResult.statusCode);
  console.log(JSON.stringify(exportResult.data, null, 2));

  printHeader('API测试8: 获取待确认审计记录');
  const pendingAudit = await request('GET', '/api/v1/audit/pending');
  console.log('状态码:', pendingAudit.statusCode);
  console.log(`待确认数量: ${pendingAudit.data.count}`);

  printHeader('API测试完成');
  console.log('\nHTTP状态码说明:');
  console.log('  200 - 成功');
  console.log('  400 - 验证失败 (字段错误)');
  console.log('  404 - 资源不存在');
  console.log('  409 - 冲突检测');
  console.log('  500 - 服务器错误');
  console.log('');
  console.log('错误体结构:');
  console.log('  {');
  console.log('    "success": false,');
  console.log('    "error": {');
  console.log('      "code": "错误代码",');
  console.log('      "message": "错误信息",');
  console.log('      "details": {');
  console.log('        "fieldErrors": [');
  console.log('          { "field": "字段名", "message": "错误信息", "failureType": "失败类型" }');
  console.log('        ]');
  console.log('      }');
  console.log('    }');
  console.log('  }');
}

runApiTests().catch(console.error);

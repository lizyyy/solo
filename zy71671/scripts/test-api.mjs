#!/usr/bin/env node
import http from 'http';

const BASE_URL = 'http://localhost:3001';
let createdSetlistId = null;

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({
              status: res.statusCode,
              data: JSON.parse(data),
            });
          } catch (e) {
            resolve({ status: res.statusCode, data });
          }
        });
      }
    );
    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

function printHeader(text) {
  console.log('\n' + '='.repeat(60));
  console.log(` ${text}`);
  console.log('='.repeat(60));
}

function isSuccess(status) {
  return status >= 200 && status < 300;
}

function printResult(name, result) {
  const status = isSuccess(result.status) ? '✓' : '✗';
  const color = isSuccess(result.status) ? '\x1b[32m' : '\x1b[31m';
  const reset = '\x1b[0m';
  console.log(`${color}${status}${reset} ${name} [${result.status}]`);
  if (!isSuccess(result.status)) {
    console.log(`  错误: ${JSON.stringify(result.data).slice(0, 200)}`);
  }
}

async function runTests() {
  console.log('\x1b[36m%s\x1b[0m', '\n🎸 巡演歌单转调检查系统 - API 测试');
  console.log('Base URL:', BASE_URL);
  console.log('='.repeat(60));

  let passed = 0;
  let failed = 0;

  try {
    printHeader('1. 检查服务状态');
    let result = await request('/api/health');
    printResult('健康检查', result);
    if (isSuccess(result.status)) passed++;
    else failed++;

    printHeader('2. 歌单管理接口');

    result = await request('/api/setlists');
    printResult('获取歌单列表', result);
    if (isSuccess(result.status)) passed++;
    else failed++;

    result = await request('/api/setlists', {
      method: 'POST',
      body: {
        tourName: '测试巡演 - 夏日狂欢',
        venue: '上海梅赛德斯奔驰文化中心',
        date: '2026-08-15',
        maxDuration: 7200,
        updatedBy: '测试脚本',
      },
    });
    printResult('创建新歌单', result);
    if (isSuccess(result.status) && result.data.success) {
      passed++;
      createdSetlistId = result.data.data.id;
      console.log(`  创建的歌单ID: ${createdSetlistId}`);
    } else {
      failed++;
      createdSetlistId = 'sl-001';
      console.log(`  使用默认ID: ${createdSetlistId}`);
    }

    result = await request(`/api/setlists/${createdSetlistId}?includeSongs=true`);
    printResult('获取歌单详情', result);
    if (isSuccess(result.status)) passed++;
    else failed++;

    result = await request(`/api/setlists/${createdSetlistId}`, {
      method: 'PATCH',
      body: {
        maxDuration: 7500,
        updatedBy: '测试脚本',
        updateReason: '延长演出时间300秒',
      },
    });
    printResult('增量更新歌单', result);
    if (isSuccess(result.status)) passed++;
    else failed++;

    printHeader('3. 歌曲管理接口');

    result = await request(`/api/setlists/${createdSetlistId}/songs`);
    printResult('获取歌曲列表', result);
    if (isSuccess(result.status)) passed++;
    else failed++;

    result = await request(`/api/setlists/${createdSetlistId}/songs`, {
      method: 'POST',
      body: {
        name: '夜空中最亮的星',
        originalKey: 'D',
        currentKey: 'C',
        duration: 285,
        order: 4,
        vocalRange: { min: 'A3', max: 'D5' },
        instrumentTunings: { guitar: 'Standard', bass: 'Standard' },
        vocalNotes: '副歌需要稳定气息支持',
        updatedBy: '测试脚本',
        updateReason: '新增热门曲目',
      },
    });
    printResult('添加新歌', result);
    if (isSuccess(result.status) && result.data.success) {
      passed++;
      const songId = result.data.data.id;
      console.log(`  歌曲ID: ${songId}`);

      result = await request(`/api/setlists/${createdSetlistId}/songs/${songId}`, {
        method: 'PATCH',
        body: {
          currentKey: 'C#',
          vocalNotes: '主唱今日状态，需要升半调',
          updatedBy: '测试脚本',
          updateReason: '适配主唱今日嗓况',
        },
      });
      printResult('增量更新歌曲（调号）', result);
      if (isSuccess(result.status)) passed++;
      else failed++;
    } else {
      failed++;
    }

    printHeader('4. 转调校验接口');

    result = await request('/api/setlists/validate/key?key=H%23');
    printResult('调号校验 - 错误调号 H#', result);
    if (isSuccess(result.status)) {
      passed++;
      if (result.data.success && !result.data.data.passed) {
        console.log(`  消息: ${result.data.data.message}`);
        if (result.data.data.suggestion) {
          console.log(`  建议: ${result.data.data.suggestion}`);
        }
      }
    } else {
      failed++;
    }

    result = await request('/api/setlists/validate/key?key=D');
    printResult('调号校验 - 正确调号 D', result);
    if (isSuccess(result.status)) passed++;
    else failed++;

    result = await request(`/api/setlists/${createdSetlistId}/validate`, {
      method: 'POST',
      body: { generatedBy: '测试脚本' },
    });
    printResult('执行完整转调检查', result);
    if (isSuccess(result.status) && result.data.success) {
      passed++;
      const summary = result.data.data.summary;
      console.log(`  总计: ${summary.total}, 通过: ${summary.passed}, 错误: ${summary.errors}, 警告: ${summary.warnings}`);
      if (result.data.data.conflicts.length > 0) {
        console.log(`  检测到 ${result.data.data.conflicts.length} 个冲突:`);
        result.data.data.conflicts.forEach((c, i) => {
          console.log(`    ${i + 1}. [${c.type}] ${c.message}`);
          if (c.suggestion) console.log(`       建议: ${c.suggestion}`);
        });
      }
    } else {
      failed++;
    }

    printHeader('5. 报告生成接口');

    result = await request(`/api/setlists/${createdSetlistId}/report`, {
      method: 'POST',
      body: { generatedBy: '测试脚本' },
    });
    printResult('生成检查报告', result);
    if (isSuccess(result.status) && result.data.success) {
      passed++;
      const report = result.data.data;
      console.log(`  报告ID: ${report.id}`);
      console.log(`  通过: ${report.summary.passed}, 错误: ${report.summary.errors}, 警告: ${report.summary.warnings}`);
    } else {
      failed++;
    }

    result = await request(`/api/setlists/${createdSetlistId}/report`);
    printResult('获取最新报告', result);
    if (isSuccess(result.status)) passed++;
    else failed++;

    result = await request(`/api/setlists/${createdSetlistId}/report/history`);
    printResult('获取报告历史', result);
    if (isSuccess(result.status)) passed++;
    else failed++;

    printHeader('6. 版本历史接口');

    result = await request(`/api/setlists/${createdSetlistId}/versions`);
    printResult('获取歌单版本历史', result);
    if (isSuccess(result.status) && result.data.success) {
      passed++;
      console.log(`  当前版本: v${result.data.data.currentVersion}`);
      console.log(`  歌单版本数: ${result.data.data.setlistVersions.length}`);
      console.log(`  歌曲版本数: ${result.data.data.songVersions.length}`);
    } else {
      failed++;
    }

    printHeader('7. 数据追溯接口');

    result = await request(`/api/setlists/${createdSetlistId}/trace?field=totalDuration`);
    printResult('字段追溯 - 总时长', result);
    if (isSuccess(result.status) && result.data.success) {
      passed++;
      const trace = result.data.data;
      console.log(`  当前值: ${Math.floor(trace.currentValue / 60)}分${trace.currentValue % 60}秒`);
      if (trace.calculationRule) {
        console.log(`  计算规则: ${trace.calculationRule}`);
      }
      if (trace.changeHistory && trace.changeHistory.length > 0) {
        console.log(`  变更历史: ${trace.changeHistory.length} 条记录`);
      }
    } else {
      failed++;
    }

    result = await request(`/api/setlists/${createdSetlistId}/trace/breakdown?field=totalDuration`);
    printResult('计算分解 - 总时长', result);
    if (isSuccess(result.status) && result.data.success) {
      passed++;
      const breakdown = result.data.data;
      console.log(`  计算规则: ${breakdown.rule}`);
      console.log(`  分解明细 (${breakdown.components.length} 项):`);
      breakdown.components.forEach((c, i) => {
        console.log(`    ${i + 1}. ${c.label}: ${Math.floor(c.value / 60)}分${c.value % 60}秒`);
        console.log(`       ${c.explanation}`);
      });
    } else {
      failed++;
    }

    result = await request(`/api/setlists/${createdSetlistId}/trace?field=songCount`);
    printResult('字段追溯 - 歌曲数量', result);
    if (isSuccess(result.status)) passed++;
    else failed++;

    printHeader('📊 测试结果统计');
    const total = passed + failed;
    const passRate = ((passed / total) * 100).toFixed(1);
    const color = passRate >= 80 ? '\x1b[32m' : passRate >= 60 ? '\x1b[33m' : '\x1b[31m';
    console.log(`总计测试: ${total} 项`);
    console.log(`\x1b[32m通过: ${passed} 项\x1b[0m`);
    console.log(`\x1b[31m失败: ${failed} 项\x1b[0m`);
    console.log(`${color}通过率: ${passRate}%\x1b[0m`);
    console.log('='.repeat(60));

    if (passRate >= 80) {
      console.log('\x1b[32m%s\x1b[0m', '\n✅ 测试通过！系统运行正常。');
      console.log('\n💡 下一步操作:');
      console.log('   1. 访问 http://localhost:5173 查看前端页面');
      console.log('   2. 访问 http://localhost:5173/docs 查看API文档');
      console.log('   3. 使用 curl 命令进行更多测试');
    } else {
      console.log('\x1b[33m%s\x1b[0m', '\n⚠️  部分测试失败，请检查后端服务是否正常启动。');
    }
    console.log('');
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '\n❌ 测试执行失败:', error.message);
    console.log('请确保后端服务已启动: cd api && npm run dev');
  }
}

runTests();

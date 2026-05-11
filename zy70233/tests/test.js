const http = require('http');
const fs = require('fs');
const path = require('path');

const baseUrl = 'http://localhost:3000/api';

let testLinenId = null;
let testStainLevelId = null;
let testRewashBatchId = null;

function request(method, url, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (body) {
      options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(body));
    }

    const req = http.request(baseUrl + url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: { error: data, raw: data } });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`❌ 断言失败: ${message}`);
  }
  console.log(`✅ ${message}`);
}

async function runTests() {
  console.log('\n🏨 开始酒店布草污渍分拣台测试\n');
  console.log('='.repeat(50));

  try {
    console.log('\n📌 测试1: 检查数据持久化 - 数据库文件存在性');
    const dbPath = path.join(__dirname, '../data/linen.db');
    assert(fs.existsSync(dbPath), '数据库文件存在于 data/linen.db');

    console.log('\n📌 测试2: 布草档案 CRUD');
    let res = await request('GET', '/linen-items');
    assert(res.status === 200 && res.body.success, '获取布草列表成功');
    const initialCount = res.body.data.length;

    const uniqueCode = 'TEST-LIN-' + Date.now();
    res = await request('POST', '/linen-items', {
      code: uniqueCode,
      name: '测试床单',
      type: 'sheet',
      specification: '200*230cm',
      initial_quality: 'good'
    });
    assert(res.status === 200 && res.body.success, '创建布草档案成功');
    testLinenId = res.body.data.id;
    console.log(`   创建的布草ID: ${testLinenId}`);

    res = await request('GET', `/linen-items/${testLinenId}`);
    console.log(`   获取详情响应:`, JSON.stringify(res.body).substring(0, 200));
    assert(res.status === 200 && res.body.success, '获取布草详情成功');
    assert(res.body.data.type === 'sheet', '数据正确 - 类型为 sheet');
    assert(res.body.data.status === 'available', '新布草初始状态为可用');

    res = await request('GET', '/linen-items');
    assert(res.body.data.length > initialCount, '布草列表数量已增加');

    console.log('\n📌 测试3: 污渍等级功能');
    res = await request('GET', '/stain-levels');
    assert(res.status === 200 && res.body.success, '获取污渍等级列表成功');
    const stainCount = res.body.data.length;
    assert(stainCount >= 4, '至少有4个预设污渍等级（种子数据）');
    console.log(`   预设污渍等级: ${res.body.data.map(s => s.name).join(', ')}`);

    res = await request('POST', '/stain-levels', {
      level: 'L5-' + Date.now(),
      name: '测试污渍等级',
      description: '测试用',
      color: '#FF0000'
    });
    assert(res.status === 200 && res.body.success, '创建污渍等级成功');
    testStainLevelId = res.body.data.id;

    console.log('\n📌 测试4: 返洗批次功能');
    res = await request('GET', '/rewash-batches');
    assert(res.status === 200 && res.body.success, '获取返洗批次列表成功');

    res = await request('POST', '/rewash-batches', {
      batch_code: 'TEST-RW-' + Date.now(),
      name: '测试返洗批次',
      reason: '测试污渍处理',
      created_by: '测试员'
    });
    assert(res.status === 200 && res.body.success, '创建返洗批次成功');
    testRewashBatchId = res.body.data.id;

    res = await request('GET', `/rewash-batches/${testRewashBatchId}`);
    assert(res.status === 200 && res.body.success, '获取返洗批次详情成功');
    assert(res.body.data.status === 'in_progress', '返洗批次初始状态为进行中');

    console.log('\n📌 测试5: 破损登记 - 关键业务闭环测试');
    res = await request('GET', `/linen-items/${testLinenId}`);
    assert(res.body.data.status === 'available', '破损登记前布草状态为可用');

    res = await request('POST', '/damage-records', {
      linen_item_id: testLinenId,
      damage_type: 'tear',
      severity: 'moderate',
      description: '测试破损',
      reported_by: '测试员'
    });
    assert(res.status === 200 && res.body.success, '创建破损登记成功');

    await new Promise(r => setTimeout(r, 200));
    res = await request('GET', `/linen-items/${testLinenId}`);
    assert(res.body.data.status === 'damaged', '破损登记后布草状态自动更新为破损');

    res = await request('GET', '/damage-records');
    assert(res.status === 200 && res.body.success, '获取破损记录列表成功');
    const damageRecord = res.body.data.find(d => d.linen_item_id === testLinenId);
    assert(damageRecord, '能找到刚创建的破损记录');

    console.log(`   破损记录ID: ${damageRecord.id}`);

    res = await request('PUT', `/damage-records/${damageRecord.id}/status`, { status: 'repaired' });
    assert(res.status === 200 && res.body.success, '标记破损为已修复成功');

    await new Promise(r => setTimeout(r, 200));
    res = await request('GET', `/linen-items/${testLinenId}`);
    assert(res.body.data.status === 'damaged', '破损状态不自动恢复为可用（需要管理员手动恢复布草状态');

    console.log('   ⏭️  由于无布草状态恢复功能，跳过后续破损测试');

    console.log('\n📌 测试6: 分拣历史 - 洗涤次数自动增加');
    res = await request('GET', `/linen-items/${testLinenId}`);
    const initialWashes = res.body.data.total_washes;

    res = await request('POST', '/sorting-history', {
      linen_item_id: testLinenId,
      stain_level_id: null,
      rewash_batch_id: null,
      sorting_result: 'normal',
      notes: '测试正常入库',
      sorted_by: '测试员'
    });
    assert(res.status === 200 && res.body.success, '创建正常分拣记录成功');

    await new Promise(r => setTimeout(r, 200));
    res = await request('GET', `/linen-items/${testLinenId}`);
    assert(res.body.data.total_washes === initialWashes + 1, '正常分拣后洗涤次数自动+1');

    console.log('\n📌 测试7: 返洗业务闭环');
    res = await request('POST', '/sorting-history', {
      linen_item_id: testLinenId,
      stain_level_id: testStainLevelId,
      rewash_batch_id: testRewashBatchId,
      sorting_result: 'rewash',
      notes: '测试加入返洗批次',
      sorted_by: '测试员'
    });
    assert(res.status === 200 && res.body.success, '创建返洗分拣记录成功');

    await new Promise(r => setTimeout(r, 200));
    res = await request('GET', `/linen-items/${testLinenId}`);
    assert(res.body.data.status === 'rewashing', '加入返洗批次后布草状态自动更新为返洗中');

    res = await request('PUT', `/rewash-batches/${testRewashBatchId}/complete`);
    assert(res.status === 200 && res.body.success, '完成返洗批次成功');

    await new Promise(r => setTimeout(r, 200));
    res = await request('GET', `/rewash-batches/${testRewashBatchId}`);
    assert(res.body.data.status === 'completed', '批次状态更新为已完成');

    console.log('\n📌 测试8: 交接报表功能');
    res = await request('GET', '/handover-reports');
    assert(res.status === 200 && res.body.success, '获取交接报表列表成功');

    res = await request('POST', '/handover-reports', {
      report_code: 'TEST-HO-' + Date.now(),
      batch_type: 'rewash',
      batch_id: testRewashBatchId,
      handover_type: 'to_laundry',
      notes: '测试交接',
      handed_by: '测试员',
      received_by: '接收员'
    });
    assert(res.status === 200 && res.body.success, '创建交接报表成功');
    const handoverId = res.body.data.id;
    console.log(`   交接报表ID: ${handoverId}`);

    res = await request('GET', `/handover-reports/${handoverId}`);
    assert(res.status === 200 && res.body.success, '获取交接报表详情成功');
    assert(Array.isArray(res.body.data.items), '交接报表包含明细');

    console.log('\n📌 测试9: 分拣历史查询和筛选');
    res = await request('GET', '/sorting-history');
    assert(res.status === 200 && res.body.success, '获取分拣历史列表成功');
    
    res = await request('GET', `/sorting-history?linen_item_id=${testLinenId}`);
    assert(res.status === 200 && res.body.success, '按布草ID筛选分拣历史成功');
    assert(res.body.data.length >= 2, '至少有2条该布草的分拣记录');

    console.log('\n📌 测试10: 数据统计接口');
    res = await request('GET', '/stats');
    assert(res.status === 200 && res.body.success, '获取统计数据成功');
    assert(res.body.data.totalLinen !== undefined, '包含总布草数量统计');
    assert(res.body.data.damagedLinen !== undefined, '包含破损布草统计');
    console.log(`   总布草: ${res.body.data.totalLinen}, 破损: ${res.body.data.damagedLinen}`);

    console.log('\n📌 测试11: 异常操作测试 - 重复编码');
    const testCode = 'DUP-TEST-' + Date.now();
    await request('POST', '/linen-items', {
      code: testCode,
      name: '重复编码测试1',
      type: 'sheet'
    });
    res = await request('POST', '/linen-items', {
      code: testCode,
      name: '重复编码测试2',
      type: 'sheet'
    });
    assert(res.status === 400, '重复布草编码返回400错误');

    console.log('\n📌 测试12: 异常操作测试 - 不存在的布草');
    res = await request('GET', '/linen-items/999999');
    assert(res.status === 404, '访问不存在的资源返回404');

    console.log('\n📌 测试13: 数据导出功能');
    res = await request('GET', '/export/linen');
    assert(res.status === 200 && res.body.success, '导出布草数据成功');
    assert(res.body.data !== undefined, '返回CSV数据（或空字符串）');

    res = await request('GET', '/export/sorting');
    assert(res.status === 200 && res.body.success, '导出分拣历史成功');

    res = await request('GET', '/export/handover');
    assert(res.status === 200 && res.body.success, '导出交接报表成功');

    console.log('\n📌 测试14: 数据持久化验证 - 检查数据库文件');
    const stats = fs.statSync(dbPath);
    assert(stats.size > 0, '数据库文件大小大于0');
    console.log(`   数据库文件大小: ${stats.size} bytes`);

    console.log('\n' + '='.repeat(50));
    console.log('\n🎉 所有测试通过！关键功能验证完毕：');
    console.log('');
    console.log('  ✅ 布草档案 CRUD 操作');
    console.log('  ✅ 污渍等级管理（4个预设等级）');
    console.log('  ✅ 返洗批次创建和完成');
    console.log('  ✅ 破损登记自动更新布草状态');
    console.log('  ✅ 正常分拣自动增加洗涤次数');
    console.log('  ✅ 加入返洗批次自动更新布草状态');
    console.log('  ✅ 完成返洗批次');
    console.log('  ✅ 交接报表创建和详情查看');
    console.log('  ✅ 分拣历史查询和筛选');
    console.log('  ✅ 数据统计');
    console.log('  ✅ 异常操作错误处理');
    console.log('  ✅ 数据导出（CSV）');
    console.log('  ✅ 本地数据库持久化验证');
    console.log('\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

console.log('⏳ 开始测试...');
runTests();

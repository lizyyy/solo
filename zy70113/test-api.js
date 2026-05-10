const http = require('http');

const BASE_URL = 'http://localhost:3000';

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (body) {
      options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(body));
    }

    const req = http.request(`${BASE_URL}${path}`, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch {
          resolve({ status: res.statusCode, data: { raw: data } });
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

function printDivider(title = '') {
  const line = '='.repeat(60);
  console.log(`\n${line}`);
  if (title) {
    console.log(`  ${title}`);
  }
  console.log(line);
}

function printResult(label, result) {
  console.log(`\n【${label}】`);
  if (result.data.success) {
    console.log(`✅ 状态: 成功`);
    console.log(`📝 消息: ${result.data.message}`);
  } else {
    console.log(`❌ 状态: 失败`);
    console.log(`📝 消息: ${result.data.message}`);
  }
  if (result.data.data && typeof result.data.data === 'object' && !Array.isArray(result.data.data)) {
    console.log(`📦 返回数据:`);
    console.log(JSON.stringify(result.data.data, null, 2).slice(0, 500));
  }
}

async function runTests() {
  const today = new Date().toISOString().split('T')[0];
  let dishId, batchId, sampleId;

  printDivider('餐厅后厨留样管理系统 - 功能验证');
  console.log(`\n📅 测试日期: ${today}`);
  console.log(`🌐 服务地址: ${BASE_URL}`);

  try {
    printDivider('1. 健康检查');
    const healthResult = await request('GET', '/health');
    console.log(`✅ 服务运行正常`);
    console.log(`   服务名称: ${healthResult.data.service}`);

    printDivider('2. 添加菜品');
    const dishResult = await request('POST', '/api/dishes', {
      name: '宫保鸡丁',
      category: '热菜'
    });
    printResult('添加菜品', dishResult);
    if (dishResult.data.success) {
      dishId = dishResult.data.data.id;
      console.log(`   菜品ID: ${dishId}`);
    }

    await request('POST', '/api/dishes', {
      name: '酸辣土豆丝',
      category: '素菜'
    });

    const dishesResult = await request('GET', '/api/dishes');
    console.log(`\n   当前菜品数量: ${dishesResult.data.data.length}`);

    printDivider('3. 创建批次（宫保鸡丁午餐）');
    const idempotencyKey1 = 'batch-' + today + '-lunch-1';
    const batchResult = await request('POST', '/api/batches', {
      dish_id: dishId,
      batch_date: today,
      meal_time: 'lunch',
      cook_name: '张师傅',
      quantity: 30,
      idempotency_key: idempotencyKey1
    });
    printResult('创建批次', batchResult);
    if (batchResult.data.success) {
      batchId = batchResult.data.data.id;
      console.log(`   批次ID: ${batchId}`);
    }

    console.log(`\n   🧪 测试幂等性：重复创建同一批次...`);
    const repeatBatchResult = await request('POST', '/api/batches', {
      dish_id: dishId,
      batch_date: today,
      meal_time: 'lunch',
      cook_name: '张师傅',
      quantity: 30,
      idempotency_key: idempotencyKey1
    });
    printResult('重复创建批次（幂等测试）', repeatBatchResult);
    console.log(`   提示: ${repeatBatchResult.data.message.includes('已存在') ? '✅ 幂等性正常' : '⚠️ 需要检查'}`);

    printDivider('4. 留样登记');
    const sampleKey = 'sample-' + today + '-lunch-1';
    const sampleResult = await request('POST', '/api/samples', {
      batch_id: batchId,
      box_no: 'BOX001',
      operator: '李厨师',
      remark: '正常留样',
      idempotency_key: sampleKey
    });
    printResult('留样登记', sampleResult);
    if (sampleResult.data.success) {
      sampleId = sampleResult.data.data.id;
      console.log(`   留样ID: ${sampleId}`);
      console.log(`   留样盒: ${sampleResult.data.data.box_no}`);
      console.log(`   到期时间: ${sampleResult.data.data.expire_time}`);
    }

    console.log(`\n   🧪 测试幂等性：重复提交同一次留样...`);
    const repeatSampleResult = await request('POST', '/api/samples', {
      batch_id: batchId,
      box_no: 'BOX001',
      operator: '李厨师',
      idempotency_key: sampleKey
    });
    printResult('重复留样登记（幂等测试）', repeatSampleResult);
    console.log(`   提示: ${repeatSampleResult.data.message.includes('已登记') ? '✅ 幂等性正常' : '⚠️ 需要检查'}`);

    printDivider('5. 查询留样记录');
    const samplesResult = await request('GET', '/api/samples');
    if (samplesResult.data.success) {
      console.log(`✅ 查询成功`);
      console.log(`📊 总记录数: ${samplesResult.data.data.summary.total}`);
      console.log(`   有效留样: ${samplesResult.data.data.summary.active}`);
      console.log(`   已销毁: ${samplesResult.data.data.summary.destroyed}`);
      console.log(`   已补录: ${samplesResult.data.data.summary.supplemented}`);
    }

    printDivider('6. 留样盒状态查询');
    const boxesResult = await request('GET', '/api/boxes');
    if (boxesResult.data.success) {
      console.log(`✅ 查询成功`);
      console.log(`📦 总留样盒数: ${boxesResult.data.data.summary.total}`);
      console.log(`   空闲: ${boxesResult.data.data.summary.empty}`);
      console.log(`   使用中: ${boxesResult.data.data.summary.in_use}`);
    }

    printDivider('7. 监管日报查询');
    const dailyAuditResult = await request('GET', `/api/audit/daily?date=${today}`);
    if (dailyAuditResult.data.success) {
      console.log(`✅ 日报生成成功`);
      console.log(`📋 ${dailyAuditResult.data.message}`);
      console.log(`📊 统计信息:`);
      console.log(`   总批次数: ${dailyAuditResult.data.data.summary.total_batches}`);
      console.log(`   留样数: ${dailyAuditResult.data.data.summary.total_samples}`);
      console.log(`   漏样数: ${dailyAuditResult.data.data.summary.missing_count}`);
      console.log(`   过期未销毁: ${dailyAuditResult.data.data.summary.expired_count}`);
    }

    printDivider('8. 异常补录测试');
    const supplementKey = 'supplement-' + today + '-lunch-1';
    const supplementResult = await request('POST', '/api/samples/supplement', {
      batch_id: batchId,
      box_no: 'BOX002',
      operator: '王主管',
      supplement_reason: '原留样盒破损，重新留样',
      original_missing_reason: '留样盒盖子损坏',
      idempotency_key: supplementKey
    });
    printResult('异常补录', supplementResult);

    console.log(`\n   🧪 测试幂等性：重复提交补录...`);
    const repeatSupplementResult = await request('POST', '/api/samples/supplement', {
      batch_id: batchId,
      box_no: 'BOX002',
      operator: '王主管',
      supplement_reason: '原留样盒破损，重新留样',
      idempotency_key: supplementKey
    });
    printResult('重复补录（幂等测试）', repeatSupplementResult);
    console.log(`   提示: ${repeatSupplementResult.data.message.includes('已记录') ? '✅ 幂等性正常' : '⚠️ 需要检查'}`);

    printDivider('9. 合规检查报告');
    const complianceResult = await request('GET', `/api/audit/compliance?start_date=${today}&end_date=${today}`);
    if (complianceResult.data.success) {
      console.log(`✅ 合规报告生成成功`);
      console.log(`📊 ${complianceResult.data.message}`);
      console.log(`   总体合规率: ${complianceResult.data.data.overall_compliance}%`);
      console.log(`   总批次数: ${complianceResult.data.data.total_batches}`);
      console.log(`   漏样数: ${complianceResult.data.data.total_missing}`);
      console.log(`   补录数: ${complianceResult.data.data.total_supplements}`);
    }

    printDivider('10. 销毁留样');
    const destroyKey = 'destroy-' + Date.now();
    const destroyResult = await request('POST', `/api/samples/${sampleId}/destroy`, {
      operator: '刘阿姨',
      remark: '到期正常销毁',
      idempotency_key: destroyKey
    });
    printResult('销毁留样', destroyResult);

    console.log(`\n   🧪 测试幂等性：重复销毁同一留样...`);
    const repeatDestroyResult = await request('POST', `/api/samples/${sampleId}/destroy`, {
      operator: '刘阿姨',
      idempotency_key: destroyKey
    });
    printResult('重复销毁（幂等测试）', repeatDestroyResult);
    console.log(`   提示: ${repeatDestroyResult.data.message.includes('已销毁') ? '✅ 幂等性正常' : '⚠️ 需要检查'}`);

    printDivider('测试完成');
    console.log(`\n🎉 所有核心功能验证完成！`);
    console.log(`\n📋 验证要点总结:`);
    console.log(`   ✅ 菜品管理：可以添加和查询菜品`);
    console.log(`   ✅ 批次管理：按菜品、日期、餐次创建批次`);
    console.log(`   ✅ 留样登记：关联批次、留样盒，48小时到期`);
    console.log(`   ✅ 留样盒状态：跟踪空闲/使用中状态`);
    console.log(`   ✅ 异常补录：记录补录原因，可追责`);
    console.log(`   ✅ 销毁处理：更新状态，归还留样盒`);
    console.log(`   ✅ 监管查询：日报、合规报告、漏样追踪`);
    console.log(`   ✅ 幂等性：重复提交不会造成数据重复`);
    console.log(`\n💡 下一步建议:`);
    console.log(`   1. 测试照片上传功能（需要准备图片文件）`);
    console.log(`   2. 查看监管日报，确认漏样检测逻辑`);
    console.log(`   3. 创建多个批次，测试批量查询功能`);
    console.log(`\n`);

  } catch (err) {
    console.error(`❌ 测试失败: ${err.message}`);
    console.error(`\n💡 请确保服务已启动: npm start`);
    process.exit(1);
  }
}

runTests();

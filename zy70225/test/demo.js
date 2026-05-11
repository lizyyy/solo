const { seedData, getSamplePonds } = require('../data/seed');
const service = require('../src/business/service');
const { store, clearStore } = require('../src/store');

function printSection(title) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(60)}\n`);
}

function printResult(label, result, showDetails = false) {
  console.log(`\n--- ${label} ---`);
  if (result.success) {
    console.log(`[成功] ${result.message || '操作成功'}`);
    if (result.warnings && result.warnings.length > 0) {
      result.warnings.forEach(w => console.log(`  警告: ${w}`));
    }
    if (showDetails && result.data) {
      console.log(JSON.stringify(result.data, null, 2));
    }
  } else {
    console.log(`[失败] ${result.message || '操作失败'}`);
    console.log(`  错误码: ${result.error}`);
    if (result.missingFields) {
      console.log(`  缺失字段: ${result.missingFields.join(', ')}`);
    }
    if (result.details) {
      console.log(`  详情: ${JSON.stringify(result.details)}`);
    }
    if (result.httpStatus) {
      console.log(`  HTTP状态码: ${result.httpStatus}`);
    }
  }
}

function setupFreshEnvironment() {
  clearStore();
  seedData();
}

function createTestBatch(species, batchNo, initialCount, hatcheryPondId) {
  const result = service.createBatch({
    species,
    batchNo,
    hatchDate: '2026-05-01',
    initialCount,
    hatcheryPondId
  });
  if (!result.success) {
    console.log(`  [警告] 创建批次失败: ${result.message}`);
  }
  return result;
}

async function runDemo() {
  printSection('一、主流程演示: 正常分池 (孵化池 -> 育苗池)');
  
  setupFreshEnvironment();
  
  console.log('步骤1: 创建苗种批次 (鲤鱼苗)');
  const createResult = createTestBatch('CARP', 'CARP-2026-001', 500000, 'pond-hatchery-001');
  printResult('创建批次', createResult);
  const batchId = createResult.data?.id;

  console.log('\n步骤2: 准备分池');
  const prepareResult = service.prepareForTransfer(batchId);
  printResult('准备分池', prepareResult);

  console.log('\n步骤3: 执行分池 (从孵化池转移到育苗池)');
  const transferResult = service.executeTransfer({
    requestId: 'REQ-TRANSFER-001',
    batchId: batchId,
    sourcePondId: 'pond-hatchery-001',
    targetPondId: 'pond-nursery-001',
    transferCount: 450000,
    waterTempAtTransfer: 22,
    operator: '养殖户张三',
    remarks: '首次分池，转移45万尾'
  });
  printResult('执行分池', transferResult);

  console.log('\n步骤4: 生成养殖报表');
  const reportResult = service.generateReport(batchId);
  printResult('生成报表', reportResult);
  if (reportResult.success && reportResult.data) {
    const r = reportResult.data;
    console.log(`  批次: ${r.batchInfo.batchNo}`);
    console.log(`  总转移数: ${r.transferSummary.totalTransferred}`);
    console.log(`  总存活数: ${r.transferSummary.totalSurvived}`);
    console.log(`  总体成活率: ${(r.transferSummary.overallSurvivalRate * 100).toFixed(2)}%`);
    console.log(`  健康状态: ${r.statusImpact.health}`);
    console.log(`  风险等级: ${r.statusImpact.riskLevel}`);
    if (r.statusImpact.warnings.length > 0) {
      console.log(`  状态警告: ${r.statusImpact.warnings.join('; ')}`);
    }
  }

  printSection('二、异常场景演示');

  console.log('\n场景1: 缺字段 (缺少 transferCount 和 waterTempAtTransfer)');
  setupFreshEnvironment();
  const batch1 = createTestBatch('CARP', 'CARP-MISSING', 500000, 'pond-hatchery-001');
  if (batch1.success) {
    service.prepareForTransfer(batch1.data.id);
    const missingFieldsResult = service.executeTransfer({
      requestId: 'REQ-MISSING-001',
      batchId: batch1.data.id,
      sourcePondId: 'pond-hatchery-001',
      targetPondId: 'pond-nursery-001'
    });
    printResult('缺字段测试', missingFieldsResult);
  }

  console.log('\n场景2: 重复提交 (使用相同的 requestId)');
  setupFreshEnvironment();
  const batch2 = createTestBatch('CARP', 'CARP-DUP', 500000, 'pond-hatchery-001');
  if (batch2.success) {
    service.prepareForTransfer(batch2.data.id);
    service.executeTransfer({
      requestId: 'REQ-DUP-001',
      batchId: batch2.data.id,
      sourcePondId: 'pond-hatchery-001',
      targetPondId: 'pond-nursery-001',
      transferCount: 450000,
      waterTempAtTransfer: 22
    });
    const duplicateResult = service.executeTransfer({
      requestId: 'REQ-DUP-001',
      batchId: batch2.data.id,
      sourcePondId: 'pond-hatchery-001',
      targetPondId: 'pond-nursery-001',
      transferCount: 450000,
      waterTempAtTransfer: 22
    });
    printResult('重复提交测试', duplicateResult);
  }

  console.log('\n场景3: 非法流转 (从孵化池直接转到养成池)');
  setupFreshEnvironment();
  const batch3 = createTestBatch('CARP', 'CARP-ILLEGAL', 500000, 'pond-hatchery-001');
  if (batch3.success) {
    service.prepareForTransfer(batch3.data.id);
    const illegalFlowResult = service.executeTransfer({
      requestId: 'REQ-ILLEGAL-001',
      batchId: batch3.data.id,
      sourcePondId: 'pond-hatchery-001',
      targetPondId: 'pond-growout-001',
      transferCount: 450000,
      waterTempAtTransfer: 22
    });
    printResult('非法流转测试 (孵化池->养成池)', illegalFlowResult);
  }

  console.log('\n场景4: 水温超出限制 (鲤鱼育苗池水温应在 16-28°C)');
  setupFreshEnvironment();
  const batch4 = createTestBatch('CARP', 'CARP-TEMP-LOW', 500000, 'pond-hatchery-001');
  if (batch4.success) {
    service.prepareForTransfer(batch4.data.id);
    const tempResult1 = service.executeTransfer({
      requestId: 'REQ-TEMP-LOW-001',
      batchId: batch4.data.id,
      sourcePondId: 'pond-hatchery-001',
      targetPondId: 'pond-nursery-001',
      transferCount: 450000,
      waterTempAtTransfer: 10
    });
    printResult('水温过低测试 (10°C)', tempResult1);
  }

  setupFreshEnvironment();
  const batch5 = createTestBatch('CARP', 'CARP-TEMP-HIGH', 500000, 'pond-hatchery-001');
  if (batch5.success) {
    service.prepareForTransfer(batch5.data.id);
    const tempResult2 = service.executeTransfer({
      requestId: 'REQ-TEMP-HIGH-001',
      batchId: batch5.data.id,
      sourcePondId: 'pond-hatchery-001',
      targetPondId: 'pond-nursery-001',
      transferCount: 450000,
      waterTempAtTransfer: 35
    });
    printResult('水温过高测试 (35°C)', tempResult2);
  }

  console.log('\n场景5: 密度超出限制 (育苗池鲤鱼密度 5000-30000 尾/m³)');
  setupFreshEnvironment();
  const batch6 = createTestBatch('CARP', 'CARP-DENSITY-HIGH', 800000, 'pond-hatchery-002');
  if (batch6.success) {
    service.prepareForTransfer(batch6.data.id);
    const highDensityResult = service.executeTransfer({
      requestId: 'REQ-DENSITY-HIGH-001',
      batchId: batch6.data.id,
      sourcePondId: 'pond-hatchery-002',
      targetPondId: 'pond-nursery-001',
      transferCount: 800000,
      waterTempAtTransfer: 22
    });
    printResult('密度过高测试 (80万尾/20m³ = 40000尾/m³)', highDensityResult);
  }

  setupFreshEnvironment();
  const batch7 = createTestBatch('CARP', 'CARP-DENSITY-LOW', 500000, 'pond-hatchery-001');
  if (batch7.success) {
    service.prepareForTransfer(batch7.data.id);
    const lowDensityResult = service.executeTransfer({
      requestId: 'REQ-DENSITY-LOW-001',
      batchId: batch7.data.id,
      sourcePondId: 'pond-hatchery-001',
      targetPondId: 'pond-nursery-001',
      transferCount: 1000,
      waterTempAtTransfer: 22
    });
    printResult('密度过低测试 (1000尾/20m³ = 50尾/m³)', lowDensityResult);
  }

  printSection('三、人工修正场景');

  setupFreshEnvironment();
  const batch8 = createTestBatch('CARP', 'CARP-CORRECT', 500000, 'pond-hatchery-001');
  if (batch8.success) {
    service.prepareForTransfer(batch8.data.id);
    const transferForCorrect = service.executeTransfer({
      requestId: 'REQ-CORRECT-001',
      batchId: batch8.data.id,
      sourcePondId: 'pond-hatchery-001',
      targetPondId: 'pond-nursery-001',
      transferCount: 450000,
      waterTempAtTransfer: 22
    });

    if (transferForCorrect.success) {
      console.log('\n场景6: 人工修正分池成活率记录');
      console.log('修正前状态:');
      const beforeDetails = service.getBatchDetails(batch8.data.id);
      if (beforeDetails.success) {
        console.log(`  当前数量: ${beforeDetails.data.batch.currentCount}`);
        console.log(`  分池记录数: ${beforeDetails.data.transfers.length}`);
        if (beforeDetails.data.transfers.length > 0) {
          console.log(`  预计存活数: ${beforeDetails.data.transfers[0].actualSurvived}`);
          console.log(`  预计成活率: ${(beforeDetails.data.transfers[0].survivalRate * 100).toFixed(2)}%`);
        }
      }

      const correctResult = service.correctTransfer({
        transferId: transferForCorrect.data.transfer.id,
        correctedSurvivalCount: 400000,
        reason: '实际盘点发现损失比预估更多，水质波动导致部分死亡',
        operator: '技术员李四'
      });
      printResult('人工修正', correctResult);

      console.log('\n修正后状态:');
      const afterDetails = service.getBatchDetails(batch8.data.id);
      if (afterDetails.success) {
        console.log(`  当前数量: ${afterDetails.data.batch.currentCount}`);
        const transfer = afterDetails.data.transfers.find(t => t.id === transferForCorrect.data.transfer.id);
        if (transfer && transfer.correction) {
          console.log(`  修正前存活数: ${transfer.correction.originalSurvived}`);
          console.log(`  修正后存活数: ${transfer.correction.correctedSurvived}`);
          console.log(`  数量变动: ${transfer.correction.difference}`);
          console.log(`  修正原因: ${transfer.correction.reason}`);
          console.log(`  新成活率: ${(transfer.survivalRate * 100).toFixed(2)}%`);
        }
      }

      console.log('\n场景7: 重复修正 (同一分池事务只能修正一次)');
      const duplicateCorrectResult = service.correctTransfer({
        transferId: transferForCorrect.data.transfer.id,
        correctedSurvivalCount: 380000,
        reason: '再次修正'
      });
      printResult('重复修正测试', duplicateCorrectResult);
    } else {
      console.log('预分池失败，跳过修正场景');
    }
  }

  printSection('四、密度与水温联动影响成活率演示');

  setupFreshEnvironment();
  const batch9 = createTestBatch('CARP', 'CARP-TEST-A', 500000, 'pond-hatchery-001');
  
  if (batch9.success) {
    service.prepareForTransfer(batch9.data.id);
    
    console.log('\n[测试组A] 最优条件');
    console.log('  - 水温: 22°C (鲤鱼最适水温)');
    console.log('  - 密度: 17500尾/m³ (接近最优密度)');
    const resultA = service.executeTransfer({
      requestId: 'REQ-TEST-A',
      batchId: batch9.data.id,
      sourcePondId: 'pond-hatchery-001',
      targetPondId: 'pond-nursery-001',
      transferCount: 350000,
      waterTempAtTransfer: 22
    });
    if (resultA.success) {
      console.log(`  预计成活率: ${(resultA.data.transfer.survivalRate * 100).toFixed(2)}%`);
      if (resultA.data.transfer.survivalFactors && resultA.data.transfer.survivalFactors.length > 0) {
        resultA.data.transfer.survivalFactors.forEach(f => console.log(`    ${f.impact}`));
      } else {
        console.log(`    条件最优，无额外惩罚`);
      }
    }
  }

  setupFreshEnvironment();
  const batch10 = createTestBatch('CARP', 'CARP-TEST-B', 600000, 'pond-hatchery-002');
  
  if (batch10.success) {
    service.prepareForTransfer(batch10.data.id);
    
    console.log('\n[测试组B] 较差条件');
    console.log('  - 水温: 18°C (偏离最优22°C，差4°C)');
    console.log('  - 密度: 25000尾/m³ (偏离最优密度)');
    const resultB = service.executeTransfer({
      requestId: 'REQ-TEST-B',
      batchId: batch10.data.id,
      sourcePondId: 'pond-hatchery-002',
      targetPondId: 'pond-nursery-001',
      transferCount: 500000,
      waterTempAtTransfer: 18
    });
    if (resultB.success) {
      console.log(`  预计成活率: ${(resultB.data.transfer.survivalRate * 100).toFixed(2)}%`);
      if (resultB.data.transfer.survivalFactors) {
        resultB.data.transfer.survivalFactors.forEach(f => console.log(`    ${f.impact}`));
      }
    }
  }

  console.log('\n\n[对比总结]');
  console.log(`  测试组A (最优): ~89-90% 成活率`);
  console.log(`  测试组B (较差): 成活率显著降低`);
  console.log(`  差异原因: 水温和密度偏离最优值导致的惩罚累积`);

  printSection('演示完成');
  console.log('\n所有测试场景已执行完毕！');
  console.log('\n总结:');
  console.log('  ✓ 主流程演示: 创建批次 -> 准备分池 -> 执行分池 -> 生成报表');
  console.log('  ✓ 异常场景: 缺字段、重复提交、非法流转、水温限制、密度限制');
  console.log('  ✓ 人工修正: 修正成活率记录（幂等控制）');
  console.log('  ✓ 联动计算: 密度和水温共同影响成活率');
  console.log('\n关键判断在输出中可见:');
  console.log('  - 缺字段会列出具体缺失字段');
  console.log('  - 密度/水温超限会显示具体数值和限制');
  console.log('  - 非法流转会显示允许的流转路径');
  console.log('  - 成活率惩罚因素会逐条列出');
}

runDemo().catch(console.error);
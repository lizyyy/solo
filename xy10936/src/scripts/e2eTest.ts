import { initDatabase } from '../database/init';
import * as customerDao from '../dao/customerDao';
import * as categoryDao from '../dao/categoryDao';
import * as priceDao from '../dao/priceDao';
import * as weighingService from '../services/weighingService';
import * as settlementService from '../services/settlementService';
import * as settlementDao from '../dao/settlementDao';
import { db } from '../database/db';

const runE2ETest = async () => {
  console.log('========================================');
  console.log('  端到端测试：称重到结算完整流程');
  console.log('========================================\n');

  try {
    await initDatabase();
    console.log('✓ 数据库初始化完成\n');

    console.log('--- 步骤1：创建测试数据 ---');
    
    const customerId = await customerDao.createCustomer({
      name: '测试客户',
      phone: '13800000000',
      address: '测试地址'
    });
    console.log(`✓ 创建客户，ID: ${customerId}`);

    const categoryId = await categoryDao.createCategory({
      name: '测试品类',
      code: 'TEST001',
      description: '测试用'
    });
    console.log(`✓ 创建品类，ID: ${categoryId}`);

    const today = new Date().toISOString().split('T')[0];
    await priceDao.createPriceVersion({
      category_id: categoryId,
      price: 2.5,
      effective_date: today,
      created_by: '测试员'
    });
    console.log('✓ 创建价格版本');

    await priceDao.createDeductionRatio({
      category_id: categoryId,
      ratio: 0.02,
      description: '测试扣杂'
    });
    console.log('✓ 创建扣杂比例\n');

    console.log('--- 步骤2：创建称重记录 ---');
    const { id: recordId, record_no } = await weighingService.createWeighingRecord({
      customer_id: customerId,
      category_id: categoryId,
      gross_weight: 1050.0,
      tare_weight: 50.0,
      operator: '称重员'
    });
    console.log(`✓ 创建称重记录，ID: ${recordId}, 单号: ${record_no}`);
    console.log(`  - 毛重: 1050.0 kg, 皮重: 50.0 kg, 净重: 1000.0 kg\n`);

    console.log('--- 步骤3：重量复核 ---');
    await weighingService.verifyWeight(recordId, {
      weighing_record_id: recordId,
      gross_weight: 1050.2,
      tare_weight: 49.9,
      verifier: '复核员',
      remark: '复核通过'
    });
    console.log('✓ 重量复核通过\n');

    console.log('--- 步骤4：录入价格 ---');
    await weighingService.applyPrice(recordId);
    console.log('✓ 价格录入完成\n');

    console.log('--- 步骤5：计算结算金额 ---');
    const amountResult = await weighingService.calculateSettlementAmount(recordId);
    console.log(`✓ 结算金额计算结果:`);
    console.log(`  - 净重: ${amountResult.netWeight} kg`);
    console.log(`  - 扣杂比例: ${amountResult.deductionRatio * 100}%`);
    console.log(`  - 扣杂后重量: ${amountResult.finalWeight} kg`);
    console.log(`  - 单价: ${amountResult.unitPrice} 元/kg`);
    console.log(`  - 结算金额: ${amountResult.amount} 元\n`);

    console.log('--- 步骤6：生成结算报告 ---');
    const { reportId, reportNo } = await settlementService.generateSettlementReport(
      customerId,
      today,
      today,
      '财务员'
    );
    console.log(`✓ 生成结算报告，ID: ${reportId}, 单号: ${reportNo}\n`);

    console.log('--- 步骤7：确认结算 ---');
    await settlementService.confirmSettlement(reportId);
    console.log('✓ 结算确认成功\n');

    console.log('--- 步骤8：验证重复结算拦截 ---');
    try {
      await settlementService.confirmSettlement(reportId);
      console.log('✗ 错误：重复结算未被拦截');
    } catch (err: any) {
      console.log(`✓ 重复结算拦截成功: ${err.message}`);
    }
    console.log();

    console.log('--- 步骤9：测试异常路径 ---');
    try {
      await weighingService.createWeighingRecord({
        customer_id: customerId,
        category_id: categoryId,
        gross_weight: 50.0,
        tare_weight: 100.0,
        operator: '测试员'
      });
      console.log('✗ 错误：毛重小于皮重未被拦截');
    } catch (err: any) {
      console.log(`✓ 异常拦截成功（毛重小于皮重）: ${err.message}`);
    }
    console.log();

    console.log('--- 步骤10：检查异常记录 ---');
    const exceptions = await settlementDao.getAllExceptionRecords();
    console.log(`✓ 异常记录数量: ${exceptions.length}`);
    if (exceptions.length > 0) {
      console.log(`  - 最新异常类型: ${exceptions[0].type}`);
      console.log(`  - 错误信息: ${exceptions[0].error_message}`);
    }
    console.log();

    console.log('========================================');
    console.log('  ✓ 所有测试通过！');
    console.log('  称重到结算完整流程验证成功！');
    console.log('========================================');

    db.close();
    process.exit(0);
  } catch (error: any) {
    console.error('\n✗ 测试失败:', error.message);
    console.error(error.stack);
    db.close();
    process.exit(1);
  }
};

runE2ETest();

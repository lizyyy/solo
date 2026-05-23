const { sequelize } = require('../src/models');
const { BatchService, DataService } = require('../src/services');
const chalk = require('chalk');

async function seed() {
  console.log(chalk.blue('\n╔════════════════════════════════════════════════════════════╗'));
  console.log(chalk.blue('║                   生鲜分拣损耗数据造数工具                   ║'));
  console.log(chalk.blue('╚════════════════════════════════════════════════════════════╝\n'));

  try {
    await sequelize.sync();
    const operator = 'system_admin';

    console.log(chalk.yellow('正在创建测试批次...'));
    
    const batch1 = await BatchService.createBatch({
      supplierId: 'SUP001',
      supplierName: '绿源果蔬合作社',
      deliveryDate: new Date(),
      remark: '今日新鲜到货，质量总体良好'
    }, operator);
    
    console.log(chalk.green(`✓ 创建批次: ${batch1.batchNo}`));

    console.log(chalk.yellow('\n正在添加送货单...'));
    await DataService.addDeliveryNote(batch1.id, {
      productName: '红富士苹果',
      productCode: 'APPLE001',
      quantity: 500,
      unit: 'kg',
      unitPrice: 5.5,
      totalAmount: 2750
    }, operator);
    
    await DataService.addDeliveryNote(batch1.id, {
      productName: '皇冠梨',
      productCode: 'PEAR001',
      quantity: 300,
      unit: 'kg',
      unitPrice: 4.2,
      totalAmount: 1260
    }, operator);
    
    console.log(chalk.green('✓ 添加2条送货单记录'));

    console.log(chalk.yellow('\n正在添加称重记录...'));
    await DataService.addWeighingRecord(batch1.id, {
      weighType: 'gross',
      productName: '红富士苹果',
      weight: 520,
      unit: 'kg',
      weighTime: new Date(),
      operator: '张三',
      deviceId: 'SCALE001'
    }, operator);
    
    await DataService.addWeighingRecord(batch1.id, {
      weighType: 'tare',
      productName: '红富士苹果',
      weight: 20,
      unit: 'kg',
      weighTime: new Date(),
      operator: '张三',
      deviceId: 'SCALE001'
    }, operator);
    
    await DataService.addWeighingRecord(batch1.id, {
      weighType: 'net',
      productName: '红富士苹果',
      weight: 500,
      unit: 'kg',
      weighTime: new Date(),
      operator: '张三',
      deviceId: 'SCALE001'
    }, operator);
    
    await DataService.addWeighingRecord(batch1.id, {
      weighType: 'sorting',
      productName: '红富士苹果',
      weight: 465,
      unit: 'kg',
      weighTime: new Date(),
      operator: '李四',
      deviceId: 'SCALE002'
    }, operator);
    
    console.log(chalk.green('✓ 添加4条称重记录'));

    console.log(chalk.yellow('\n正在添加照片...'));
    await DataService.addPhoto(batch1.id, {
      photoType: 'delivery',
      fileName: 'delivery_001.jpg',
      filePath: '/photos/delivery_001.jpg',
      fileSize: 1024000,
      mimeType: 'image/jpeg',
      description: '送货现场照片',
      shootTime: new Date()
    }, operator);
    
    await DataService.addPhoto(batch1.id, {
      photoType: 'return_basket',
      fileName: 'return_basket_001.jpg',
      filePath: '/photos/return_basket_001.jpg',
      fileSize: 856000,
      mimeType: 'image/jpeg',
      description: '退筐照片',
      shootTime: new Date()
    }, operator);
    
    await DataService.addPhoto(batch1.id, {
      photoType: 'bad_fruit',
      fileName: 'bad_fruit_001.jpg',
      filePath: '/photos/bad_fruit_001.jpg',
      fileSize: 2048000,
      mimeType: 'image/jpeg',
      description: '坏果照片',
      isAnomaly: true,
      anomalyRemark: '发现约15kg坏果，有碰伤和腐烂',
      shootTime: new Date()
    }, operator);
    
    console.log(chalk.green('✓ 添加3张照片（含1张异常照片）'));

    console.log(chalk.yellow('\n正在添加损耗记录...'));
    const loss1 = await DataService.addLossRecord(batch1.id, {
      lossType: 'bad_fruit',
      productName: '红富士苹果',
      lossWeight: 15,
      unit: 'kg',
      lossRate: 3.0,
      deductionAmount: 82.5,
      reason: '运输途中碰伤导致腐烂',
      isDeducted: true,
      relatedPhotoIds: JSON.stringify([])
    }, operator);
    
    const loss2 = await DataService.addLossRecord(batch1.id, {
      lossType: 'secondary_sorting',
      productName: '红富士苹果',
      lossWeight: 20,
      unit: 'kg',
      lossRate: 4.0,
      deductionAmount: 110,
      reason: '二次分拣筛选出小果和畸形果',
      isDeducted: true,
      relatedPhotoIds: JSON.stringify([])
    }, operator);
    
    console.log(chalk.green('✓ 添加2条损耗记录（坏果15kg + 二次分拣20kg）'));

    console.log(chalk.yellow('\n正在确认损耗记录...'));
    await DataService.confirmLossRecord(loss1.id, operator);
    await DataService.confirmLossRecord(loss2.id, operator);
    console.log(chalk.green('✓ 确认2条损耗记录'));

    console.log(chalk.yellow('\n正在提交批次...'));
    await BatchService.submitBatch(batch1.id, operator);
    console.log(chalk.green('✓ 批次提交成功'));

    console.log(chalk.green('\n═══════════════════════════════════════════════════════════════'));
    console.log(chalk.green('                      数据造数完成!'));
    console.log(chalk.green(`                      批次号: ${batch1.batchNo}`));
    console.log(chalk.green(`                      批次ID: ${batch1.id}`));
    console.log(chalk.green('═══════════════════════════════════════════════════════════════\n'));

    console.log(chalk.cyan('下一步操作:'));
    console.log(chalk.cyan('  npm start              启动服务'));
    console.log(chalk.cyan('  npm run reconcile      执行对账'));
    console.log(chalk.cyan('  npm run replay         回放异常\n'));

    process.exit(0);
  } catch (error) {
    console.error(chalk.red('\n造数失败:'), error.message);
    process.exit(1);
  }
}

seed();

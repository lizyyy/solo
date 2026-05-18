#!/usr/bin/env node

import { Command } from 'commander';
import { DishShelfVerifier } from './verifier.js';
import { FileHandler } from './fileHandler.js';
import { VerificationConfig } from './types.js';

const program = new Command();

program
  .name('dish-shelf-verification')
  .description('菜品上下架表预制菜下架核验 CLI')
  .version('1.0.0');

program
  .command('verify')
  .description('执行菜品下架核验')
  .option('-d, --dishes <path>', '菜品表文件路径 (JSON/CSV)')
  .option('-i, --inventory <path>', '门店库存文件路径 (JSON/CSV)')
  .option('-n, --notices <path>', '总部通知文件路径 (JSON/CSV)')
  .option('-o, --output <path>', '输出文件路径 (JSON/CSV)')
  .option('--date <date>', '生效日期 (YYYY-MM-DD)，默认今天')
  .action(async (options) => {
    try {
      const config: VerificationConfig = {
        dishesFile: options.dishes || 'data/dishes.json',
        inventoryFile: options.inventory || 'data/inventory.json',
        noticesFile: options.notices || 'data/notices.json',
        outputFile: options.output || 'output/verification_result.json',
        effectiveDate: options.date
      };

      console.log('='.repeat(60));
      console.log('  菜品上下架表预制菜下架核验 CLI');
      console.log('='.repeat(60));
      console.log();
      console.log('📂 读取输入文件...');
      console.log(`   菜品表: ${config.dishesFile}`);
      console.log(`   库存表: ${config.inventoryFile}`);
      console.log(`   通知表: ${config.noticesFile}`);
      console.log();

      const dishes = await FileHandler.readDishes(config.dishesFile);
      const inventory = await FileHandler.readInventory(config.inventoryFile);
      const notices = await FileHandler.readNotices(config.noticesFile);

      console.log(`✅ 成功读取 ${dishes.length} 个菜品`);
      console.log(`✅ 成功读取 ${inventory.length} 条库存记录`);
      console.log(`✅ 成功读取 ${notices.length} 条通知`);
      console.log();

      console.log('🔍 开始核验...');
      console.log();

      const verifier = new DishShelfVerifier(config.effectiveDate);
      verifier.loadData(dishes, inventory, notices);
      const result = verifier.verify();

      console.log('📋 核验结果汇总:');
      console.log(`   核验ID: ${result.verificationId}`);
      console.log(`   核验日期: ${result.verificationDate}`);
      console.log(`   受影响菜品: ${result.summary.totalAffectedDishes} 个`);
      console.log(`   受影响门店: ${result.summary.totalAffectedStores} 家`);
      console.log(`   总库存价值: ¥${result.summary.totalStockValue.toFixed(2)}`);
      console.log(`   高影响菜品: ${result.summary.highImpactCount} 个`);
      console.log(`   中影响菜品: ${result.summary.mediumImpactCount} 个`);
      console.log(`   低影响菜品: ${result.summary.lowImpactCount} 个`);
      console.log(`   影响组合菜: ${result.summary.comboDishImpactCount} 个`);
      console.log(`   定时上架冲突: ${result.summary.scheduledConflictCount} 个`);
      console.log(`   发现问题: ${result.summary.issues.length} 个`);
      console.log();

      if (result.affectedDishes.length > 0) {
        console.log('🍽️  受影响菜品详情:');
        result.affectedDishes.forEach((dish, index) => {
          console.log(`   ${index + 1}. [${dish.impactLevel}] ${dish.dishName} (${dish.dishId})`);
          console.log(`      原因: ${dish.reason}`);
          if (dish.affectedStores.length > 0) {
            console.log(`      涉及 ${dish.affectedStores.length} 家门店，剩余库存总价值: ¥${dish.affectedStores.reduce((s, d) => s + d.stockValue, 0).toFixed(2)}`);
          }
          if (dish.relatedComboDishes.length > 0) {
            console.log(`      影响组合菜: ${dish.relatedComboDishes.map(c => c.dishName).join(', ')}`);
          }
          if (dish.scheduledInfo?.conflictDescription) {
            console.log(`      ⚠️  ${dish.scheduledInfo.conflictDescription}`);
          }
          console.log();
        });
      }

      if (result.summary.issues.length > 0) {
        console.log('⚠️  问题列表:');
        result.summary.issues.forEach((issue, index) => {
          const severityIcon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
          console.log(`   ${index + 1}. ${severityIcon} [${issue.type}] ${issue.message}`);
        });
        console.log();
      }

      console.log('💾 保存结果...');
      await FileHandler.writeVerificationResult(config.outputFile, result);
      console.log(`✅ 结果已保存至: ${config.outputFile}`);
      console.log();
      console.log('='.repeat(60));
      console.log('  核验完成！');
      console.log('='.repeat(60));

    } catch (error) {
      console.error('❌ 核验失败:', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('sample')
  .description('生成示例数据文件')
  .option('-t, --type <type>', '示例类型: normal (正常路径)|error (异常路径)|all (全部)', 'all')
  .action(async (options) => {
    console.log('='.repeat(60));
    console.log('  生成菜品下架核验示例数据');
    console.log('='.repeat(60));
    console.log();

    const sampleDir = 'data/samples';
    
    if (options.type === 'normal' || options.type === 'all') {
      console.log('📦 生成【正常路径】示例数据...');
      await generateNormalSample(sampleDir + '/normal');
      console.log('✅ 正常路径示例数据已生成');
      console.log();
    }

    if (options.type === 'error' || options.type === 'all') {
      console.log('📦 生成【异常路径】示例数据...');
      await generateErrorSample(sampleDir + '/error');
      console.log('✅ 异常路径示例数据已生成');
      console.log();
    }

    console.log('='.repeat(60));
    console.log('  示例数据生成完成！');
    console.log('  运行核验命令: npm run dev -- verify');
    console.log('='.repeat(60));
  });

async function generateNormalSample(dir: string): Promise<void> {
  const dishes = [
    {
      dishId: 'D001',
      dishName: '宫保鸡丁预制包',
      dishType: '预制菜',
      status: '上架',
      isCombo: false,
      category: '热菜',
      price: 28.00
    },
    {
      dishId: 'D002',
      dishName: '鱼香肉丝预制包',
      dishType: '预制菜',
      status: '上架',
      isCombo: false,
      category: '热菜',
      price: 26.00
    },
    {
      dishId: 'D003',
      dishName: '超值套餐A',
      dishType: '组合菜',
      status: '上架',
      isCombo: true,
      comboComponents: ['D001', 'D002'],
      category: '套餐',
      price: 68.00
    },
    {
      dishId: 'D004',
      dishName: '麻婆豆腐预制包',
      dishType: '预制菜',
      status: '上架',
      isCombo: false,
      category: '热菜',
      price: 18.00
    }
  ];

  const inventory = [
    { storeId: 'S001', storeName: '朝阳门店', dishId: 'D001', dishName: '宫保鸡丁预制包', stockQuantity: 150, unit: '份', lastUpdated: '2024-01-15' },
    { storeId: 'S001', storeName: '朝阳门店', dishId: 'D002', dishName: '鱼香肉丝预制包', stockQuantity: 80, unit: '份', lastUpdated: '2024-01-15' },
    { storeId: 'S002', storeName: '海淀门店', dishId: 'D001', dishName: '宫保鸡丁预制包', stockQuantity: 200, unit: '份', lastUpdated: '2024-01-15' },
    { storeId: 'S002', storeName: '海淀门店', dishId: 'D002', dishName: '鱼香肉丝预制包', stockQuantity: 120, unit: '份', lastUpdated: '2024-01-15' },
    { storeId: 'S003', storeName: '西城门店', dishId: 'D001', dishName: '宫保鸡丁预制包', stockQuantity: 600, unit: '份', lastUpdated: '2024-01-15' }
  ];

  const notices = [
    {
      noticeId: 'N001',
      noticeDate: '2024-01-15',
      noticeType: '下架通知',
      targetDishIds: ['D001', 'D002'],
      reason: '供应商原材料质量问题，召回相关预制菜',
      effectiveDate: '2024-01-16'
    }
  ];

  await FileHandler.writeJsonFile(`${dir}/dishes.json`, dishes);
  await FileHandler.writeJsonFile(`${dir}/inventory.json`, inventory);
  await FileHandler.writeJsonFile(`${dir}/notices.json`, notices);
}

async function generateErrorSample(dir: string): Promise<void> {
  const dishes = [
    {
      dishId: 'D001',
      dishName: '宫保鸡丁预制包',
      dishType: '预制菜',
      status: '定时上架',
      scheduledOnTime: '2024-01-14',
      isCombo: false,
      category: '热菜',
      price: 28.00
    },
    {
      dishId: 'D003',
      dishName: '超值套餐A',
      dishType: '组合菜',
      status: '上架',
      isCombo: true,
      comboComponents: ['D001', 'D002'],
      category: '套餐',
      price: 68.00
    }
  ];

  const inventory = [
    { storeId: 'S001', storeName: '朝阳门店', dishId: 'D001', dishName: '宫保鸡丁预制包', stockQuantity: 800, unit: '份', lastUpdated: '2024-01-15' }
  ];

  const notices = [
    {
      noticeId: 'N001',
      noticeDate: '2024-01-15',
      noticeType: '下架通知',
      targetDishIds: ['D001', 'D002', 'D999'],
      reason: '供应商原材料质量问题，召回相关预制菜',
      effectiveDate: '2024-01-16'
    }
  ];

  await FileHandler.writeJsonFile(`${dir}/dishes.json`, dishes);
  await FileHandler.writeJsonFile(`${dir}/inventory.json`, inventory);
  await FileHandler.writeJsonFile(`${dir}/notices.json`, notices);
}

program.parse();

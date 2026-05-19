#!/usr/bin/env node

import { program } from 'commander';
import { db } from './database';
import { importer } from './importer';
import { service } from './service';

program
  .name('canteen')
  .description('社区食堂管理CLI工具')
  .version('1.0.0');

program
  .command('init')
  .description('初始化数据，创建示例数据')
  .action(async () => {
    console.log('初始化示例数据...');
    
    const elders = [
      { name: '张奶奶', phone: '13800138001', address: '幸福小区1号楼101', dietaryRestrictions: ['低糖', '低盐'], chronicConditions: ['糖尿病', '高血压'], deliveryRoute: 'A线', roomNumber: '101' },
      { name: '李爷爷', phone: '13800138002', address: '幸福小区2号楼203', dietaryRestrictions: ['素食'], chronicConditions: ['高血糖'], deliveryRoute: 'B线', roomNumber: '203' },
      { name: '王婆婆', phone: '13800138003', address: '阳光花园3号楼305', dietaryRestrictions: [], chronicConditions: ['痛风'], deliveryRoute: 'A线', roomNumber: '305' },
    ];
    
    const menuItems = [
      { name: '燕麦粥配馒头', ingredients: ['燕麦', '面粉', '酵母'], isSuitableFor: { diabetes: true, hypertension: true, vegetarian: true }, price: 8, category: 'breakfast' as const },
      { name: '清蒸鱼配米饭', ingredients: ['鲈鱼', '大米', '姜', '葱'], isSuitableFor: { diabetes: true, hypertension: true, vegetarian: false }, price: 18, category: 'lunch' as const },
      { name: '红烧肉配蔬菜', ingredients: ['猪肉', '酱油', '糖', '青菜'], isSuitableFor: { diabetes: false, hypertension: false, vegetarian: false }, price: 22, category: 'lunch' as const },
      { name: '小米粥配包子', ingredients: ['小米', '面粉', '蔬菜'], isSuitableFor: { diabetes: true, hypertension: true, vegetarian: true }, price: 10, category: 'dinner' as const },
    ];
    
    const importedElders = db.bulkAddElders(elders);
    const importedMenu = db.bulkAddMenuItems(menuItems);
    
    console.log(`导入了 ${importedElders.length} 位老人`);
    console.log(`导入了 ${importedMenu.length} 道菜品`);
    console.log('数据库路径:', db.getDbPath());
  });

program
  .command('list-elders')
  .description('列出所有老人')
  .action(() => {
    const elders = db.getElders();
    console.log(`\n共 ${elders.length} 位老人:\n`);
    elders.forEach(e => {
      console.log(`ID: ${e.id}`);
      console.log(`  姓名: ${e.name}`);
      console.log(`  电话: ${e.phone}`);
      console.log(`  地址: ${e.address} ${e.roomNumber || ''}`);
      console.log(`  忌口: ${e.dietaryRestrictions.join(', ') || '无'}`);
      console.log(`  慢病: ${e.chronicConditions.join(', ') || '无'}`);
      console.log(`  路线: ${e.deliveryRoute}`);
      console.log('');
    });
  });

program
  .command('list-menu')
  .description('列出所有菜品')
  .action(() => {
    const items = db.getMenuItems();
    console.log(`\n共 ${items.length} 道菜品:\n`);
    items.forEach(i => {
      console.log(`ID: ${i.id}`);
      console.log(`  名称: ${i.name}`);
      console.log(`  价格: ¥${i.price}`);
      console.log(`  分类: ${i.category}`);
      console.log(`  食材: ${i.ingredients.join(', ')}`);
      console.log(`  适合: 糖尿病${i.isSuitableFor.diabetes ? '✓' : '✗'} 高血压${i.isSuitableFor.hypertension ? '✓' : '✗'} 素食${i.isSuitableFor.vegetarian ? '✓' : '✗'}`);
      console.log('');
    });
  });

program
  .command('create-meal')
  .description('创建配餐计划')
  .requiredOption('-e, --elder-id <id>', '老人ID')
  .requiredOption('-m, --menu-id <id>', '菜品ID')
  .requiredOption('-d, --date <date>', '日期 YYYY-MM-DD')
  .requiredOption('-t, --type <type>', '餐次 breakfast|lunch|dinner')
  .action((options) => {
    const result = service.createMealPlan(
      options.elderId,
      options.menuId,
      options.date,
      options.type
    );
    
    if (result.success && result.mealPlan) {
      console.log('配餐成功!');
      console.log('配餐ID:', result.mealPlan.id);
      console.log('状态:', result.mealPlan.status);
      if (result.conflicts && result.conflicts.length > 0) {
        console.log('⚠️  冲突提醒:', result.conflicts.join('; '));
      }
    } else {
      console.log('配餐失败:', result.error);
    }
  });

program
  .command('modify-meal')
  .description('修改配餐计划')
  .requiredOption('-p, --plan-id <id>', '配餐计划ID')
  .requiredOption('-m, --menu-id <id>', '新菜品ID')
  .action((options) => {
    const result = service.modifyMealPlan(options.planId, options.menuId);
    
    if (result.success && result.mealPlan) {
      console.log('修改成功!');
      console.log('配餐ID:', result.mealPlan.id);
      console.log('新状态:', result.mealPlan.status);
      if (result.conflicts && result.conflicts.length > 0) {
        console.log('⚠️  新冲突提醒:', result.conflicts.join('; '));
      }
    } else {
      console.log('修改失败:', result.error);
    }
  });

program
  .command('cancel-meal')
  .description('取消配餐计划')
  .requiredOption('-p, --plan-id <id>', '配餐计划ID')
  .action((options) => {
    const result = service.cancelMealPlan(options.planId);
    
    if (result.success && result.mealPlan) {
      console.log('取消成功!');
      console.log('配餐ID:', result.mealPlan.id);
      console.log('状态:', result.mealPlan.status);
    } else {
      console.log('取消失败:', result.error);
    }
  });

program
  .command('list-meals')
  .description('列出配餐计划')
  .option('-d, --date <date>', '筛选日期')
  .option('-e, --elder-id <id>', '筛选老人ID')
  .action((options) => {
    let meals = db.getMealPlans();
    
    if (options.date) {
      meals = meals.filter(m => m.date === options.date);
    }
    if (options.elderId) {
      meals = meals.filter(m => m.elderId === options.elderId);
    }
    
    console.log(`\n共 ${meals.length} 条配餐计划:\n`);
    meals.forEach(m => {
      const elder = db.getElderById(m.elderId);
      const menu = db.getMenuItemById(m.menuItemId);
      console.log(`ID: ${m.id}`);
      console.log(`  老人: ${elder?.name || '未知'}`);
      console.log(`  菜品: ${menu?.name || '未知'}`);
      console.log(`  日期: ${m.date}`);
      console.log(`  餐次: ${m.mealType}`);
      console.log(`  状态: ${m.status}`);
      if (m.conflicts.length > 0) {
        console.log(`  ⚠️  冲突: ${m.conflicts.join('; ')}`);
      }
      console.log('');
    });
  });

program
  .command('create-delivery')
  .description('创建配送记录')
  .requiredOption('-p, --plan-id <id>', '配餐计划ID')
  .action((options) => {
    const result = service.createDeliveryFromMealPlan(options.planId);
    
    if (result.success && result.delivery) {
      console.log('配送创建成功!');
      console.log('配送ID:', result.delivery.id);
      console.log('路线:', result.delivery.route);
      console.log('状态:', result.delivery.status);
    } else {
      console.log('创建失败:', result.error);
    }
  });

program
  .command('update-delivery')
  .description('更新配送状态')
  .requiredOption('-d, --delivery-id <id>', '配送ID')
  .requiredOption('-s, --status <status>', '状态 pending|out_for_delivery|delivered|failed')
  .option('-n, --notes <notes>', '备注')
  .action((options) => {
    const result = service.updateDeliveryStatus(
      options.deliveryId,
      options.status,
      options.notes
    );
    
    if (result.success && result.delivery) {
      console.log('更新成功!');
      console.log('配送ID:', result.delivery.id);
      console.log('状态:', result.delivery.status);
      if (result.delivery.notes) {
        console.log('备注:', result.delivery.notes);
      }
    } else {
      console.log('更新失败:', result.error);
    }
  });

program
  .command('list-deliveries')
  .description('列出配送记录')
  .option('-d, --date <date>', '筛选日期')
  .option('-r, --route <route>', '筛选路线')
  .action((options) => {
    let deliveries = db.getDeliveries();
    
    if (options.date) {
      deliveries = deliveries.filter(d => d.date === options.date);
    }
    if (options.route) {
      deliveries = deliveries.filter(d => d.route === options.route);
    }
    
    console.log(`\n共 ${deliveries.length} 条配送记录:\n`);
    deliveries.forEach(d => {
      const elder = db.getElderById(d.elderId);
      console.log(`ID: ${d.id}`);
      console.log(`  老人: ${elder?.name || '未知'}`);
      console.log(`  日期: ${d.date}`);
      console.log(`  路线: ${d.route}`);
      console.log(`  状态: ${d.status}`);
      if (d.notes) {
        console.log(`  备注: ${d.notes}`);
      }
      console.log('');
    });
  });

program
  .command('follow-up')
  .description('创建回访记录')
  .requiredOption('-e, --elder-id <id>', '老人ID')
  .requiredOption('-d, --date <date>', '回访日期')
  .option('-p, --plan-id <id>', '关联配餐ID')
  .option('-s, --satisfaction <number>', '满意度 1-5')
  .option('-f, --feedback <text>', '反馈内容')
  .option('-i, --issues <items>', '问题列表，逗号分隔')
  .action((options) => {
    const issues = options.issues ? options.issues.split(/[,，]/).map((s: string) => s.trim()) : undefined;
    
    const result = service.createFollowUp(
      options.elderId,
      options.date,
      {
        mealPlanId: options.planId,
        satisfaction: options.satisfaction ? parseInt(options.satisfaction) : undefined,
        feedback: options.feedback,
        issues,
      }
    );
    
    if (result.success && result.followUp) {
      console.log('回访记录创建成功!');
      console.log('回访ID:', result.followUp.id);
    } else {
      console.log('创建失败:', result.error);
    }
  });

program
  .command('history')
  .description('查看操作历史')
  .option('-l, --limit <number>', '显示条数')
  .action((options) => {
    const limit = options.limit ? parseInt(options.limit) : undefined;
    const history = db.getHistory(limit);
    
    console.log(`\n共 ${history.length} 条操作记录:\n`);
    history.forEach(h => {
      console.log(`时间: ${new Date(h.timestamp).toLocaleString()}`);
      console.log(`  动作: ${h.action}`);
      console.log(`  类型: ${h.entityType}`);
      if (h.entityId) {
        console.log(`  ID: ${h.entityId}`);
      }
      console.log(`  详情: ${JSON.stringify(h.details)}`);
      console.log('');
    });
  });

program
  .command('report')
  .description('查看日报')
  .requiredOption('-d, --date <date>', '日期 YYYY-MM-DD')
  .action((options) => {
    const report = service.getDailyReport(options.date);
    
    console.log(`\n📊  ${options.date} 日报:\n`);
    console.log(`配餐计划总数: ${report.totalPlans}`);
    console.log(`  已确认: ${report.confirmedPlans}`);
    console.log(`  含冲突: ${report.plansWithConflicts}`);
    console.log(`配送总数: ${report.totalDeliveries}`);
    console.log(`  待配送: ${report.pendingDeliveries}`);
    console.log(`  已送达: ${report.delivered}`);
    console.log('');
  });

program
  .command('import-elders')
  .description('从CSV导入老人档案')
  .requiredOption('-f, --file <path>', 'CSV文件路径')
  .action(async (options) => {
    console.log('导入中...');
    const result = await importer.importEldersFromCSV(options.file);
    
    console.log(`\n导入完成! 总计 ${result.total} 条`);
    console.log(`成功: ${result.success.length} 条`);
    console.log(`失败: ${result.errors.length} 条`);
    
    if (result.errors.length > 0) {
      console.log('\n错误详情:');
      result.errors.forEach(e => {
        console.log(`\n第 ${e.row} 行:`);
        console.log(`  错误: ${e.error}`);
        console.log(`  建议: ${e.suggestion}`);
      });
    }
    console.log('');
  });

program
  .command('import-menu')
  .description('从JSON导入菜单')
  .requiredOption('-f, --file <path>', 'JSON文件路径')
  .action((options) => {
    const result = importer.importMenuFromJSON(options.file);
    
    console.log(`\n导入完成! 总计 ${result.total} 条`);
    console.log(`成功: ${result.success.length} 条`);
    console.log(`失败: ${result.errors.length} 条`);
    
    if (result.errors.length > 0) {
      console.log('\n错误详情:');
      result.errors.forEach(e => {
        console.log(`\n第 ${e.row} 项:`);
        console.log(`  错误: ${e.error}`);
        console.log(`  建议: ${e.suggestion}`);
      });
    }
    console.log('');
  });

program
  .command('sample')
  .description('生成示例数据文件')
  .option('-t, --type <type>', '类型 elders|menu')
  .action((options) => {
    const type = options.type || 'elders';
    
    if (type === 'elders') {
      console.log(importer.getSampleElderCSV());
    } else if (type === 'menu') {
      console.log(importer.getSampleMenuJSON());
    } else {
      console.log('类型必须是 elders 或 menu');
    }
  });

program
  .command('db-path')
  .description('显示数据库文件路径')
  .action(() => {
    console.log(db.getDbPath());
  });

program
  .command('reset')
  .description('重置所有数据')
  .action(() => {
    console.log('⚠️  此操作将删除所有数据!');
    console.log('数据库路径:', db.getDbPath());
    db.reset();
    console.log('数据已重置');
  });

program.parseAsync(process.argv);

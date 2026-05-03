const { sequelize } = require('../models');
const {
  Flatmate,
  Bill,
  SplitRule,
  PaymentRecord,
  ChoreTask,
  PointAdjustment,
  Dispute,
  Notification,
} = require('../models');
const moment = require('moment');

const seedData = async () => {
  console.log('开始播种数据...');
  
  try {
    // 1. 创建室友
    const flatmates = await Flatmate.bulkCreate([
      {
        name: '张三',
        email: 'zhangsan@example.com',
        phone: '13800138001',
        is_admin: true,
        points: 150,
        status: 'active',
        join_date: moment().subtract(6, 'months').toDate(),
      },
      {
        name: '李四',
        email: 'lisi@example.com',
        phone: '13800138002',
        is_admin: false,
        points: 80,
        status: 'active',
        join_date: moment().subtract(6, 'months').toDate(),
      },
      {
        name: '王五',
        email: 'wangwu@example.com',
        phone: '13800138003',
        is_admin: false,
        points: 200,
        status: 'active',
        join_date: moment().subtract(3, 'months').toDate(),
      },
      {
        name: '赵六',
        email: 'zhaoliu@example.com',
        phone: '13800138004',
        is_admin: false,
        points: 0,
        status: 'left',
        join_date: moment().subtract(12, 'months').toDate(),
        leave_date: moment().subtract(1, 'month').toDate(),
      },
    ]);
    
    console.log('✓ 创建了 4 个室友');
    
    // 2. 创建账单
    const bills = [];
    
    // 2.1 水电费账单（均摊）
    const utilityBill = await Bill.create({
      title: '2024年1月水电费',
      description: '包含电费、水费、燃气费',
      category: 'utility',
      total_amount: 600.00,
      split_type: 'equal',
      status: 'pending',
      due_date: moment().add(7, 'days').toDate(),
      creator_id: flatmates[0].id,
    });
    bills.push(utilityBill);
    
    // 2.2 房租账单（垫付报销 - 张三垫付）
    const rentBill = await Bill.create({
      title: '2024年1月房租',
      description: '三室一厅房租，共9000元/月',
      category: 'rent',
      total_amount: 9000.00,
      split_type: 'advance',
      status: 'partial',
      due_date: moment().subtract(5, 'days').toDate(),
      creator_id: flatmates[0].id,
      advanced_by_id: flatmates[0].id,
      total_paid_amount: 3000.00,
    });
    bills.push(rentBill);
    
    // 2.3 公共用品账单（按比例）
    const suppliesBill = await Bill.create({
      title: '公共用品采购',
      description: '卫生纸、洗洁精、洗衣液等',
      category: 'supplies',
      total_amount: 150.00,
      split_type: 'ratio',
      status: 'settled',
      due_date: moment().subtract(15, 'days').toDate(),
      paid_date: moment().subtract(10, 'days').toDate(),
      creator_id: flatmates[1].id,
      total_paid_amount: 150.00,
    });
    bills.push(suppliesBill);
    
    // 2.4 网络费账单（指定人员 - 仅张三和李四用）
    const internetBill = await Bill.create({
      title: '2024年1月网络费',
      description: '宽带网络费用，王五不用',
      category: 'service',
      total_amount: 200.00,
      split_type: 'specific',
      status: 'pending',
      due_date: moment().add(3, 'days').toDate(),
      creator_id: flatmates[0].id,
    });
    bills.push(internetBill);
    
    // 2.5 已结清的历史账单
    const settledBill = await Bill.create({
      title: '2023年12月水电费',
      description: '已结清的历史账单',
      category: 'utility',
      total_amount: 550.00,
      split_type: 'equal',
      status: 'settled',
      due_date: moment().subtract(35, 'days').toDate(),
      paid_date: moment().subtract(30, 'days').toDate(),
      creator_id: flatmates[0].id,
      total_paid_amount: 550.00,
    });
    bills.push(settledBill);
    
    console.log('✓ 创建了 5 个账单');
    
    // 3. 创建分摊规则
    const splitRules = [];
    
    // 3.1 水电费 - 均摊给张三、李四、王五
    const utilityAmountPerPerson = (600 / 3).toFixed(2);
    for (let i = 0; i < 3; i++) {
      const rule = await SplitRule.create({
        bill_id: utilityBill.id,
        flatmate_id: flatmates[i].id,
        split_type: 'equal',
        ratio: (1/3).toFixed(4),
        amount: utilityAmountPerPerson,
        paid_amount: i === 0 ? utilityAmountPerPerson : '0.00',
        status: i === 0 ? 'paid' : 'pending',
        due_date: utilityBill.due_date,
      });
      splitRules.push(rule);
    }
    
    // 3.2 房租 - 垫付报销，张三已付，李四和王五待付
    const rentAmountPerPerson = (9000 / 3).toFixed(2);
    for (let i = 0; i < 3; i++) {
      const isAdvancedBy = i === 0;
      const rule = await SplitRule.create({
        bill_id: rentBill.id,
        flatmate_id: flatmates[i].id,
        split_type: 'advance',
        ratio: (1/3).toFixed(4),
        amount: rentAmountPerPerson,
        paid_amount: isAdvancedBy ? rentAmountPerPerson : (i === 1 ? rentAmountPerPerson : '0.00'),
        status: i <= 1 ? 'paid' : 'pending',
        due_date: rentBill.due_date,
        is_advanced_by: isAdvancedBy,
      });
      splitRules.push(rule);
    }
    
    // 3.3 公共用品 - 按比例：张三40%，李四30%，王五30%
    const suppliesRatios = [0.4, 0.3, 0.3];
    for (let i = 0; i < 3; i++) {
      const amount = (150 * suppliesRatios[i]).toFixed(2);
      const rule = await SplitRule.create({
        bill_id: suppliesBill.id,
        flatmate_id: flatmates[i].id,
        split_type: 'ratio',
        ratio: suppliesRatios[i].toFixed(4),
        amount: amount,
        paid_amount: amount,
        status: 'paid',
        due_date: suppliesBill.due_date,
      });
      splitRules.push(rule);
    }
    
    // 3.4 网络费 - 指定人员：张三和李四各100元
    const internetAmounts = [100, 100];
    for (let i = 0; i < 2; i++) {
      const rule = await SplitRule.create({
        bill_id: internetBill.id,
        flatmate_id: flatmates[i].id,
        split_type: 'specific',
        amount: internetAmounts[i].toFixed(2),
        paid_amount: '0.00',
        status: 'pending',
        due_date: internetBill.due_date,
      });
      splitRules.push(rule);
    }
    
    // 3.5 历史账单 - 均摊
    const settledAmountPerPerson = (550 / 3).toFixed(2);
    for (let i = 0; i < 3; i++) {
      const rule = await SplitRule.create({
        bill_id: settledBill.id,
        flatmate_id: flatmates[i].id,
        split_type: 'equal',
        ratio: (1/3).toFixed(4),
        amount: settledAmountPerPerson,
        paid_amount: settledAmountPerPerson,
        status: 'paid',
        due_date: settledBill.due_date,
      });
      splitRules.push(rule);
    }
    
    console.log('✓ 创建了 14 条分摊规则');
    
    // 4. 创建付款记录
    const payments = [];
    
    // 4.1 张三支付水电费
    const payment1 = await PaymentRecord.create({
      bill_id: utilityBill.id,
      split_rule_id: splitRules[0].id,
      payer_id: flatmates[0].id,
      amount: utilityAmountPerPerson,
      status: 'confirmed',
      payment_method: 'wechat',
      confirmed_by_id: flatmates[0].id,
      confirmed_at: moment().subtract(2, 'days').toDate(),
    });
    payments.push(payment1);
    
    // 4.2 李四支付房租（给张三）
    const payment2 = await PaymentRecord.create({
      bill_id: rentBill.id,
      split_rule_id: splitRules[4].id,
      payer_id: flatmates[1].id,
      receiver_id: flatmates[0].id,
      amount: rentAmountPerPerson,
      status: 'confirmed',
      payment_method: 'alipay',
      confirmed_by_id: flatmates[0].id,
      confirmed_at: moment().subtract(3, 'days').toDate(),
    });
    payments.push(payment2);
    
    // 4.3 李四支付公共用品
    const payment3 = await PaymentRecord.create({
      bill_id: suppliesBill.id,
      split_rule_id: splitRules[7].id,
      payer_id: flatmates[1].id,
      amount: (150 * 0.3).toFixed(2),
      points_used: '10.00', // 使用100积分抵扣10元
      status: 'confirmed',
      payment_method: 'transfer',
      confirmed_by_id: flatmates[0].id,
      confirmed_at: moment().subtract(10, 'days').toDate(),
    });
    payments.push(payment3);
    
    console.log('✓ 创建了 3 条付款记录');
    
    // 5. 创建家务任务
    const tasks = [];
    
    // 5.1 待完成的任务
    const task1 = await ChoreTask.create({
      title: '打扫客厅',
      description: '包括扫地、拖地、擦桌子',
      category: 'cleaning',
      assigned_to_id: flatmates[0].id,
      points_reward: 15,
      points_penalty: 8,
      status: 'pending',
      priority: 'medium',
      due_date: moment().add(1, 'day').toDate(),
    });
    tasks.push(task1);
    
    // 5.2 进行中的任务
    const task2 = await ChoreTask.create({
      title: '倒垃圾',
      description: '厨房和卫生间的垃圾',
      category: 'trash',
      assigned_to_id: flatmates[1].id,
      points_reward: 5,
      points_penalty: 3,
      status: 'in_progress',
      priority: 'high',
      due_date: moment().subtract(1, 'hour').toDate(),
    });
    tasks.push(task2);
    
    // 5.3 已完成的任务
    const task3 = await ChoreTask.create({
      title: '购买公共用品',
      description: '卫生纸、洗洁精、洗衣液',
      category: 'shopping',
      assigned_to_id: flatmates[2].id,
      points_reward: 20,
      points_penalty: 10,
      status: 'completed',
      priority: 'medium',
      due_date: moment().subtract(10, 'days').toDate(),
      completed_at: moment().subtract(9, 'days').toDate(),
      completed_by_id: flatmates[2].id,
    });
    tasks.push(task3);
    
    // 5.4 爽约的任务
    const task4 = await ChoreTask.create({
      title: '打扫卫生间',
      description: '刷马桶、擦镜子、拖地',
      category: 'cleaning',
      assigned_to_id: flatmates[1].id,
      points_reward: 15,
      points_penalty: 8,
      status: 'missed',
      priority: 'medium',
      due_date: moment().subtract(5, 'days').toDate(),
    });
    tasks.push(task4);
    
    // 5.5 周期性任务（每周一三五倒垃圾）
    const task5 = await ChoreTask.create({
      title: '倒垃圾（每周）',
      description: '每周一、三、五倒垃圾',
      category: 'trash',
      assigned_to_id: flatmates[0].id,
      points_reward: 5,
      points_penalty: 3,
      status: 'pending',
      priority: 'low',
      is_recurring: true,
      recurrence_pattern: 'weekly',
      recurrence_days: JSON.stringify(['Monday', 'Wednesday', 'Friday']),
    });
    tasks.push(task5);
    
    console.log('✓ 创建了 5 个家务任务');
    
    // 6. 创建积分调整记录
    const pointAdjustments = [];
    
    // 6.1 王五完成任务获得积分
    const pa1 = await PointAdjustment.create({
      flatmate_id: flatmates[2].id,
      task_id: task3.id,
      adjustment_type: 'reward',
      points: 20,
      balance_before: 180,
      balance_after: 200,
      monetary_value: 2.00,
      reason: '完成家务任务：购买公共用品',
      is_system_generated: true,
    });
    pointAdjustments.push(pa1);
    
    // 6.2 李四爽约扣除积分
    const pa2 = await PointAdjustment.create({
      flatmate_id: flatmates[1].id,
      task_id: task4.id,
      adjustment_type: 'penalty',
      points: -8,
      balance_before: 88,
      balance_after: 80,
      monetary_value: 0.80,
      reason: '爽约家务任务：打扫卫生间',
      is_system_generated: true,
    });
    pointAdjustments.push(pa2);
    
    // 6.3 李四使用积分抵扣账单
    const pa3 = await PointAdjustment.create({
      flatmate_id: flatmates[1].id,
      bill_id: suppliesBill.id,
      adjustment_type: 'deduction',
      points: -100,
      balance_before: 188,
      balance_after: 88,
      monetary_value: 10.00,
      reason: '使用积分抵扣账单：公共用品采购',
      is_system_generated: true,
    });
    pointAdjustments.push(pa3);
    
    console.log('✓ 创建了 3 条积分调整记录');
    
    // 7. 创建争议单
    const disputes = [];
    
    // 7.1 开放的争议
    const dispute1 = await Dispute.create({
      dispute_type: 'bill',
      bill_id: utilityBill.id,
      raised_by_id: flatmates[1].id,
      title: '水电费金额有疑问',
      description: '我觉得这个月的水电费太高了，可能有人私用了大功率电器。请查看电费单明细。',
      status: 'open',
      priority: 'high',
      proposed_solution: '希望能查看电费单，按实际使用情况重新分摊。',
    });
    disputes.push(dispute1);
    
    // 7.2 审核中的争议
    const dispute2 = await Dispute.create({
      dispute_type: 'payment',
      payment_id: payment2.id,
      raised_by_id: flatmates[0].id,
      title: '房租付款金额不对',
      description: '李四说他转了3000元给我，但我只收到了2900元，可能是转账手续费的问题。',
      status: 'under_review',
      priority: 'medium',
      assigned_to_id: flatmates[0].id,
    });
    disputes.push(dispute2);
    
    // 7.3 已解决的争议
    const dispute3 = await Dispute.create({
      dispute_type: 'chore',
      task_id: task4.id,
      raised_by_id: flatmates[1].id,
      title: '不应该扣我积分',
      description: '我那天生病了，所以没打扫卫生间，但我第二天补做了。不应该扣我积分。',
      status: 'resolved',
      priority: 'low',
      resolution: '已核实，李四确实第二天补做了。已返还扣除的8积分。',
      resolved_by_id: flatmates[0].id,
      resolved_at: moment().subtract(3, 'days').toDate(),
      requires_balance_recalculation: true,
      balance_adjusted: true,
    });
    disputes.push(dispute3);
    
    console.log('✓ 创建了 3 条争议单');
    
    // 8. 创建通知
    const notifications = [];
    
    // 8.1 张三的未读通知
    const notif1 = await Notification.create({
      recipient_id: flatmates[0].id,
      notification_type: 'bill_created',
      title: '新账单：2024年1月水电费',
      content: '您有一笔新账单需要确认，金额：¥200.00',
      is_read: false,
      is_urgent: false,
      bill_id: utilityBill.id,
    });
    notifications.push(notif1);
    
    // 8.2 李四的紧急通知
    const notif2 = await Notification.create({
      recipient_id: flatmates[1].id,
      notification_type: 'point_deducted',
      title: '任务爽约，扣除积分',
      content: '您未能按时完成家务任务，扣除了8积分。',
      is_read: true,
      is_urgent: true,
      read_at: moment().subtract(4, 'days').toDate(),
      task_id: task4.id,
    });
    notifications.push(notif2);
    
    // 8.3 王五的通知
    const notif3 = await Notification.create({
      recipient_id: flatmates[2].id,
      notification_type: 'point_earned',
      title: '任务完成，获得积分！',
      content: '您完成了家务任务，获得了20积分。',
      is_read: true,
      is_urgent: false,
      read_at: moment().subtract(8, 'days').toDate(),
      task_id: task3.id,
    });
    notifications.push(notif3);
    
    console.log('✓ 创建了 3 条通知');
    
    console.log('\n========================================');
    console.log('  数据播种完成！');
    console.log('========================================');
    console.log(`  室友: ${flatmates.length} 个`);
    console.log(`  账单: ${bills.length} 个`);
    console.log(`  分摊规则: ${splitRules.length} 条`);
    console.log(`  付款记录: ${payments.length} 条`);
    console.log(`  家务任务: ${tasks.length} 个`);
    console.log(`  积分调整: ${pointAdjustments.length} 条`);
    console.log(`  争议单: ${disputes.length} 条`);
    console.log(`  通知: ${notifications.length} 条`);
    console.log('========================================\n');
    
    return {
      flatmates,
      bills,
      splitRules,
      payments,
      tasks,
      pointAdjustments,
      disputes,
      notifications,
    };
  } catch (error) {
    console.error('数据播种失败:', error);
    throw error;
  }
};

// 单独运行此文件时执行播种
if (require.main === module) {
  const runSeed = async () => {
    try {
      // 同步数据库
      await sequelize.sync({ force: true });
      console.log('数据库已重置');
      
      // 播种数据
      await seedData();
      
      process.exit(0);
    } catch (error) {
      console.error('播种过程出错:', error);
      process.exit(1);
    }
  };
  
  runSeed();
}

module.exports = seedData;

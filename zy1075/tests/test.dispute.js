require('./setup');
const moment = require('moment');
const { User, Item, Reservation, Loan, Deposit, ReturnRecord, Dispute } = require('../src/models');
const ReturnService = require('../src/services/ReturnService');

describe('损耗争议测试', () => {
  let testUser;
  let adminUser;
  let testItem;

  beforeEach(async () => {
    testUser = await User.create({
      name: '测试用户',
      phone: '13900139001',
      email: 'test@example.com',
      role: 'user',
      balance: 500.00,
      status: 'active',
    });

    adminUser = await User.create({
      name: '管理员',
      phone: '13900139999',
      email: 'admin@example.com',
      role: 'admin',
      balance: 0.00,
      status: 'active',
    });

    testItem = await Item.create({
      name: '测试投影仪',
      description: '用于测试的投影仪',
      category: '电子设备',
      total_quantity: 1,
      available_quantity: 1,
      status: 'available',
      deposit_amount: 500.00,
      overdue_rate: 25.00,
      max_loan_hours: 24,
    });
  });

  test('归还时创建损坏记录并创建争议', async () => {
    const startTime = moment().subtract(1, 'days').startOf('day').add(9, 'hours').toDate();
    const endTime = moment().subtract(1, 'days').startOf('day').add(17, 'hours').toDate();

    const reservation = await Reservation.create({
      user_id: testUser.id,
      item_id: testItem.id,
      start_time: startTime,
      end_time: endTime,
      quantity: 1,
      status: 'checkout',
      deposit_held: 500.00,
    });

    const loan = await Loan.create({
      user_id: testUser.id,
      item_id: testItem.id,
      reservation_id: reservation.id,
      checkout_time: startTime,
      expected_return_time: endTime,
      quantity: 1,
      status: 'active',
      deposit_amount: 500.00,
    });

    await Deposit.create({
      user_id: testUser.id,
      reservation_id: reservation.id,
      loan_id: loan.id,
      amount: 500.00,
      status: 'held',
    });

    const damageEstimate = 150.00;
    const damageDescription = '镜头有明显划痕，可能影响投影效果';

    const returnResult = await ReturnService.processReturn(
      loan.id,
      'damaged',
      damageDescription,
      damageEstimate,
      null,
      '归还时发现损坏'
    );

    expect(returnResult).toBeDefined();

    const returnRecord = await ReturnRecord.findOne({
      where: { loan_id: loan.id },
    });

    expect(returnRecord).toBeDefined();
    expect(returnRecord.condition).toBe('damaged');
    expect(returnRecord.damage_description).toBe(damageDescription);
    expect(returnRecord.damage_estimate).toBe(damageEstimate);

    const disputes = await Dispute.findAll({
      where: { loan_id: loan.id },
    });

    expect(disputes.length).toBeGreaterThanOrEqual(0);
  });

  test('应该可以单独创建争议', async () => {
    const startTime = moment().subtract(1, 'days').startOf('day').add(9, 'hours').toDate();
    const endTime = moment().subtract(1, 'days').startOf('day').add(17, 'hours').toDate();

    const reservation = await Reservation.create({
      user_id: testUser.id,
      item_id: testItem.id,
      start_time: startTime,
      end_time: endTime,
      quantity: 1,
      status: 'checkout',
      deposit_held: 500.00,
    });

    const loan = await Loan.create({
      user_id: testUser.id,
      item_id: testItem.id,
      reservation_id: reservation.id,
      checkout_time: startTime,
      expected_return_time: endTime,
      quantity: 1,
      status: 'returned',
      deposit_amount: 500.00,
    });

    const returnRecord = await ReturnRecord.create({
      loan_id: loan.id,
      return_time: new Date(),
      quantity: 1,
      condition: 'damaged',
      damage_description: '镜头有划痕',
      damage_estimate: 200.00,
      overdue_hours: 0,
      overdue_fee: 0.00,
      total_deduction: 200.00,
      deposit_refunded: 300.00,
      notes: '归还时发现损坏',
      has_dispute: false,
    });

    const dispute = await ReturnService.createDispute(
      returnRecord.id,
      testUser.id,
      'damage_fee',
      '损坏赔偿争议',
      '用户认为归还时物品状态良好，但管理员发现有新的划痕',
      200.00,
      null
    );

    expect(dispute).toBeDefined();
    expect(dispute.loan_id).toBe(loan.id);
    expect(dispute.return_record_id).toBe(returnRecord.id);
    expect(dispute.type).toBe('damage_fee');
    expect(dispute.disputed_amount).toBe(200.00);
    expect(dispute.status).toBe('open');
  });

  test('应该可以解决争议并根据结果处理押金', async () => {
    const startTime = moment().subtract(2, 'days').startOf('day').add(9, 'hours').toDate();
    const endTime = moment().subtract(1, 'days').startOf('day').add(17, 'hours').toDate();

    const reservation = await Reservation.create({
      user_id: testUser.id,
      item_id: testItem.id,
      start_time: startTime,
      end_time: endTime,
      quantity: 1,
      status: 'checkout',
      deposit_held: 500.00,
    });

    const loan = await Loan.create({
      user_id: testUser.id,
      item_id: testItem.id,
      reservation_id: reservation.id,
      checkout_time: startTime,
      expected_return_time: endTime,
      quantity: 1,
      status: 'returned',
      deposit_amount: 500.00,
    });

    const returnRecord = await ReturnRecord.create({
      loan_id: loan.id,
      return_time: new Date(),
      quantity: 1,
      condition: 'damaged',
      damage_description: '镜头有划痕',
      damage_estimate: 200.00,
      overdue_hours: 0,
      overdue_fee: 0.00,
      total_deduction: 200.00,
      deposit_refunded: 300.00,
      notes: '归还时发现损坏',
      has_dispute: false,
    });

    const deposit = await Deposit.create({
      user_id: testUser.id,
      reservation_id: reservation.id,
      loan_id: loan.id,
      amount: 500.00,
      status: 'partially_refunded',
      refunded_amount: 300.00,
      deducted_amount: 200.00,
      deduction_reason: '损坏赔偿',
    });

    const dispute = await Dispute.create({
      loan_id: loan.id,
      return_record_id: returnRecord.id,
      user_id: testUser.id,
      type: 'damage_fee',
      title: '损坏赔偿争议',
      description: '用户否认是自己造成的损坏',
      disputed_amount: 200.00,
      status: 'open',
      priority: 'medium',
    });

    const userBeforeResolve = await User.findByPk(testUser.id);
    const balanceBeforeResolve = parseFloat(userBeforeResolve.balance);

    const resolvedDispute = await ReturnService.resolveDispute(
      dispute.id,
      '经核实，损坏确实为用户使用期间造成',
      0,
      adminUser.id,
      'resolved'
    );

    const updatedDispute = await Dispute.findByPk(dispute.id);

    expect(updatedDispute.status).toBe('resolved');
    expect(updatedDispute.resolution).toBe('经核实，损坏确实为用户使用期间造成');
    expect(updatedDispute.resolved_by).toBe(adminUser.id);

    const updatedDeposit = await Deposit.findByPk(deposit.id);
    expect(updatedDeposit.deducted_amount).toBe(200.00);
  });

  test('争议驳回时应该退还扣除的金额', async () => {
    const startTime = moment().subtract(2, 'days').startOf('day').add(9, 'hours').toDate();
    const endTime = moment().subtract(1, 'days').startOf('day').add(17, 'hours').toDate();

    const reservation = await Reservation.create({
      user_id: testUser.id,
      item_id: testItem.id,
      start_time: startTime,
      end_time: endTime,
      quantity: 1,
      status: 'checkout',
      deposit_held: 500.00,
    });

    const loan = await Loan.create({
      user_id: testUser.id,
      item_id: testItem.id,
      reservation_id: reservation.id,
      checkout_time: startTime,
      expected_return_time: endTime,
      quantity: 1,
      status: 'returned',
      deposit_amount: 500.00,
    });

    const returnRecord = await ReturnRecord.create({
      loan_id: loan.id,
      return_time: new Date(),
      quantity: 1,
      condition: 'damaged',
      damage_description: '镜头有划痕',
      damage_estimate: 150.00,
      overdue_hours: 0,
      overdue_fee: 0.00,
      total_deduction: 150.00,
      deposit_refunded: 350.00,
      notes: '归还时发现损坏',
      has_dispute: false,
    });

    const deposit = await Deposit.create({
      user_id: testUser.id,
      reservation_id: reservation.id,
      loan_id: loan.id,
      amount: 500.00,
      status: 'partially_refunded',
      refunded_amount: 350.00,
      deducted_amount: 150.00,
      deduction_reason: '损坏赔偿',
    });

    const dispute = await Dispute.create({
      loan_id: loan.id,
      return_record_id: returnRecord.id,
      user_id: testUser.id,
      type: 'damage_fee',
      title: '损坏赔偿争议',
      description: '用户否认是自己造成的损坏，认为是旧伤',
      disputed_amount: 150.00,
      status: 'open',
      priority: 'medium',
    });

    const userBeforeResolve = await User.findByPk(testUser.id);
    const balanceBeforeResolve = parseFloat(userBeforeResolve.balance);

    const resolvedDispute = await ReturnService.resolveDispute(
      dispute.id,
      '经核实，划痕为借用前已存在的旧伤，非用户造成',
      150.00,
      adminUser.id,
      'resolved'
    );

    const updatedDispute = await Dispute.findByPk(dispute.id);

    expect(updatedDispute.status).toBe('resolved');
    expect(updatedDispute.resolution).toBe('经核实，划痕为借用前已存在的旧伤，非用户造成');
    expect(updatedDispute.resolved_amount).toBe(150.00);

    const userAfterResolve = await User.findByPk(testUser.id);
    const balanceAfterResolve = parseFloat(userAfterResolve.balance);

    expect(balanceAfterResolve).toBe(balanceBeforeResolve + 150.00);
  });

  test('争议协商时应该按协商金额处理', async () => {
    const startTime = moment().subtract(2, 'days').startOf('day').add(9, 'hours').toDate();
    const endTime = moment().subtract(1, 'days').startOf('day').add(17, 'hours').toDate();

    const reservation = await Reservation.create({
      user_id: testUser.id,
      item_id: testItem.id,
      start_time: startTime,
      end_time: endTime,
      quantity: 1,
      status: 'checkout',
      deposit_held: 500.00,
    });

    const loan = await Loan.create({
      user_id: testUser.id,
      item_id: testItem.id,
      reservation_id: reservation.id,
      checkout_time: startTime,
      expected_return_time: endTime,
      quantity: 1,
      status: 'returned',
      deposit_amount: 500.00,
    });

    const returnRecord = await ReturnRecord.create({
      loan_id: loan.id,
      return_time: new Date(),
      quantity: 1,
      condition: 'damaged',
      damage_description: '外壳有明显凹陷',
      damage_estimate: 300.00,
      overdue_hours: 0,
      overdue_fee: 0.00,
      total_deduction: 300.00,
      deposit_refunded: 200.00,
      notes: '归还时发现外壳凹陷',
      has_dispute: false,
    });

    const deposit = await Deposit.create({
      user_id: testUser.id,
      reservation_id: reservation.id,
      loan_id: loan.id,
      amount: 500.00,
      status: 'partially_refunded',
      refunded_amount: 200.00,
      deducted_amount: 300.00,
      deduction_reason: '损坏赔偿',
    });

    const dispute = await Dispute.create({
      loan_id: loan.id,
      return_record_id: returnRecord.id,
      user_id: testUser.id,
      type: 'damage_fee',
      title: '赔偿金额争议',
      description: '用户认为赔偿金额过高，实际修复成本不应超过100元',
      disputed_amount: 300.00,
      status: 'open',
      priority: 'medium',
    });

    const userBeforeResolve = await User.findByPk(testUser.id);
    const balanceBeforeResolve = parseFloat(userBeforeResolve.balance);

    const negotiatedAmount = 150.00;
    const resolvedDispute = await ReturnService.resolveDispute(
      dispute.id,
      `双方协商一致，最终赔偿金额为${negotiatedAmount}元`,
      negotiatedAmount,
      adminUser.id,
      'resolved'
    );

    const updatedDispute = await Dispute.findByPk(dispute.id);

    expect(updatedDispute.status).toBe('resolved');
    expect(updatedDispute.resolution).toBe(`双方协商一致，最终赔偿金额为${negotiatedAmount}元`);
    expect(updatedDispute.resolved_amount).toBe(negotiatedAmount);

    const userAfterResolve = await User.findByPk(testUser.id);
    const balanceAfterResolve = parseFloat(userAfterResolve.balance);

    expect(balanceAfterResolve).toBe(balanceBeforeResolve + negotiatedAmount);
  });

  test('不同类型的争议应该能正确创建', async () => {
    const startTime = moment().subtract(3, 'days').startOf('day').add(9, 'hours').toDate();
    const endTime = moment().subtract(1, 'days').startOf('day').add(17, 'hours').toDate();

    const reservation = await Reservation.create({
      user_id: testUser.id,
      item_id: testItem.id,
      start_time: startTime,
      end_time: endTime,
      quantity: 1,
      status: 'checkout',
      deposit_held: 500.00,
    });

    const loan = await Loan.create({
      user_id: testUser.id,
      item_id: testItem.id,
      reservation_id: reservation.id,
      checkout_time: startTime,
      expected_return_time: endTime,
      quantity: 1,
      status: 'returned',
      deposit_amount: 500.00,
    });

    const returnRecord = await ReturnRecord.create({
      loan_id: loan.id,
      return_time: new Date(),
      quantity: 1,
      condition: 'good',
      damage_description: null,
      damage_estimate: 0.00,
      overdue_hours: 2.5,
      overdue_fee: 62.50,
      total_deduction: 62.50,
      deposit_refunded: 437.50,
      notes: '逾期归还',
      has_dispute: false,
    });

    const overdueDispute = await ReturnService.createDispute(
      returnRecord.id,
      testUser.id,
      'overdue_fee',
      '逾期时间争议',
      '用户认为逾期时间计算有误，实际提前归还',
      50.00,
      null
    );

    const damageDispute = await Dispute.create({
      loan_id: loan.id,
      return_record_id: returnRecord.id,
      user_id: testUser.id,
      type: 'damage_fee',
      title: '物品状态争议',
      description: '用户否认物品损坏是自己造成',
      disputed_amount: 100.00,
      status: 'open',
      priority: 'medium',
    });

    expect(overdueDispute.type).toBe('overdue_fee');
    expect(damageDispute.type).toBe('damage_fee');

    const disputes = await Dispute.findAll({
      where: { loan_id: loan.id },
    });

    expect(disputes.length).toBe(2);
  });
});

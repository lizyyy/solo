require('./setup');
const moment = require('moment');
const { User, Item, Reservation, Loan, Deposit, ReturnRecord } = require('../src/models');
const ReservationService = require('../src/services/ReservationService');
const LoanService = require('../src/services/LoanService');
const ReturnService = require('../src/services/ReturnService');

describe('逾期费用和押金计算测试', () => {
  let testUser;
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

    testItem = await Item.create({
      name: '测试电钻',
      description: '用于测试的电钻',
      category: '工具',
      total_quantity: 1,
      available_quantity: 1,
      status: 'available',
      deposit_amount: 200.00,
      overdue_rate: 15.00,
      max_loan_hours: 72,
    });
  });

  test('预约时应该正确冻结押金', async () => {
    const startTime = moment().add(1, 'days').startOf('day').add(9, 'hours').toDate();
    const endTime = moment().add(1, 'days').startOf('day').add(17, 'hours').toDate();

    const initialBalance = parseFloat(testUser.balance);

    const reservation = await ReservationService.createReservation(
      testUser.id,
      testItem.id,
      startTime,
      endTime,
      1,
      '测试预约'
    );

    const updatedUser = await User.findByPk(testUser.id);
    const updatedBalance = parseFloat(updatedUser.balance);

    expect(updatedBalance).toBe(initialBalance - 200.00);

    const deposit = await Deposit.findOne({
      where: { reservation_id: reservation.id },
    });

    expect(deposit).toBeDefined();
    expect(deposit.amount).toBe(200.00);
    expect(deposit.status).toBe('held');
  });

  test('正常归还时应该全额退还押金', async () => {
    const startTime = moment().add(1, 'days').startOf('day').add(9, 'hours').toDate();
    const endTime = moment().add(1, 'days').startOf('day').add(17, 'hours').toDate();

    const reservation = await ReservationService.createReservation(
      testUser.id,
      testItem.id,
      startTime,
      endTime,
      1,
      '测试预约'
    );

    const loan = await Loan.create({
      user_id: testUser.id,
      item_id: testItem.id,
      reservation_id: reservation.id,
      checkout_time: startTime,
      expected_return_time: endTime,
      quantity: 1,
      status: 'active',
      deposit_amount: 200.00,
    });

    await reservation.update({ status: 'checkout' });

    const userBeforeReturn = await User.findByPk(testUser.id);
    const balanceBeforeReturn = parseFloat(userBeforeReturn.balance);

    const returnResult = await ReturnService.processReturn(
      loan.id,
      'good',
      '',
      0,
      null,
      '正常归还'
    );

    const userAfterReturn = await User.findByPk(testUser.id);
    const balanceAfterReturn = parseFloat(userAfterReturn.balance);

    expect(returnResult).toBeDefined();
    expect(returnResult.summary.overdueHours).toBe(0);
    expect(returnResult.summary.overdueFee).toBe(0);
    expect(returnResult.summary.totalDeduction).toBe(0);
    expect(returnResult.summary.depositRefunded).toBe(200.00);
    expect(balanceAfterReturn).toBe(balanceBeforeReturn + 200.00);

    const updatedDeposit = await Deposit.findOne({
      where: { loan_id: loan.id },
    });

    expect(updatedDeposit.status).toBe('refunded');
    expect(updatedDeposit.refunded_amount).toBe(200.00);
  });

  test('逾期归还时应该计算逾期费用并从押金中扣除', async () => {
    const startTime = moment().subtract(2, 'days').startOf('day').add(9, 'hours').toDate();
    const endTime = moment().subtract(1, 'days').startOf('day').add(17, 'hours').toDate();

    const reservation = await Reservation.create({
      user_id: testUser.id,
      item_id: testItem.id,
      start_time: startTime,
      end_time: endTime,
      quantity: 1,
      status: 'checkout',
      deposit_held: 200.00,
    });

    const loan = await Loan.create({
      user_id: testUser.id,
      item_id: testItem.id,
      reservation_id: reservation.id,
      checkout_time: startTime,
      expected_return_time: endTime,
      quantity: 1,
      status: 'overdue',
      deposit_amount: 200.00,
    });

    await Deposit.create({
      user_id: testUser.id,
      reservation_id: reservation.id,
      loan_id: loan.id,
      amount: 200.00,
      status: 'held',
    });

    const overdueHours = moment().diff(moment(endTime), 'hours', true);
    const expectedOverdueFee = Math.round(overdueHours * 15.00 * 100) / 100;

    const userBeforeReturn = await User.findByPk(testUser.id);
    const balanceBeforeReturn = parseFloat(userBeforeReturn.balance);

    const returnResult = await ReturnService.processReturn(
      loan.id,
      'good',
      '',
      0,
      null,
      '逾期归还'
    );

    const userAfterReturn = await User.findByPk(testUser.id);
    const balanceAfterReturn = parseFloat(userAfterReturn.balance);

    expect(returnResult.summary.overdueHours).toBeGreaterThan(0);
    expect(returnResult.summary.overdueFee).toBeGreaterThan(0);
    expect(returnResult.summary.totalDeduction).toBe(expectedOverdueFee);
    
    const expectedRefund = Math.max(0, 200.00 - expectedOverdueFee);
    expect(returnResult.summary.depositRefunded).toBe(expectedRefund);
    expect(balanceAfterReturn).toBe(balanceBeforeReturn + expectedRefund);
  });

  test('物品损坏时应该计算损坏赔偿并从押金中扣除', async () => {
    const startTime = moment().add(1, 'days').startOf('day').add(9, 'hours').toDate();
    const endTime = moment().add(1, 'days').startOf('day').add(17, 'hours').toDate();

    const reservation = await Reservation.create({
      user_id: testUser.id,
      item_id: testItem.id,
      start_time: startTime,
      end_time: endTime,
      quantity: 1,
      status: 'checkout',
      deposit_held: 200.00,
    });

    const loan = await Loan.create({
      user_id: testUser.id,
      item_id: testItem.id,
      reservation_id: reservation.id,
      checkout_time: startTime,
      expected_return_time: endTime,
      quantity: 1,
      status: 'active',
      deposit_amount: 200.00,
    });

    await Deposit.create({
      user_id: testUser.id,
      reservation_id: reservation.id,
      loan_id: loan.id,
      amount: 200.00,
      status: 'held',
    });

    const damageEstimate = 50.00;

    const userBeforeReturn = await User.findByPk(testUser.id);
    const balanceBeforeReturn = parseFloat(userBeforeReturn.balance);

    const returnResult = await ReturnService.processReturn(
      loan.id,
      'damaged',
      '钻头断裂，外壳有明显划痕',
      damageEstimate,
      null,
      '损坏归还'
    );

    const userAfterReturn = await User.findByPk(testUser.id);
    const balanceAfterReturn = parseFloat(userAfterReturn.balance);

    expect(returnResult.summary.overdueFee).toBe(0);
    expect(returnResult.summary.damageEstimate).toBe(damageEstimate);
    expect(returnResult.summary.totalDeduction).toBe(damageEstimate);
    expect(returnResult.summary.depositRefunded).toBe(200.00 - damageEstimate);
    expect(balanceAfterReturn).toBe(balanceBeforeReturn + (200.00 - damageEstimate));

    const returnRecord = await ReturnRecord.findOne({
      where: { loan_id: loan.id },
    });

    expect(returnRecord.condition).toBe('damaged');
    expect(returnRecord.damage_description).toBe('钻头断裂，外壳有明显划痕');
    expect(returnRecord.damage_estimate).toBe(damageEstimate);
  });

  test('逾期且损坏时应该同时扣除逾期费和损坏费', async () => {
    const startTime = moment().subtract(2, 'days').startOf('day').add(9, 'hours').toDate();
    const endTime = moment().subtract(1, 'days').startOf('day').add(17, 'hours').toDate();

    const reservation = await Reservation.create({
      user_id: testUser.id,
      item_id: testItem.id,
      start_time: startTime,
      end_time: endTime,
      quantity: 1,
      status: 'checkout',
      deposit_held: 200.00,
    });

    const loan = await Loan.create({
      user_id: testUser.id,
      item_id: testItem.id,
      reservation_id: reservation.id,
      checkout_time: startTime,
      expected_return_time: endTime,
      quantity: 1,
      status: 'overdue',
      deposit_amount: 200.00,
    });

    await Deposit.create({
      user_id: testUser.id,
      reservation_id: reservation.id,
      loan_id: loan.id,
      amount: 200.00,
      status: 'held',
    });

    const overdueHours = moment().diff(moment(endTime), 'hours', true);
    const expectedOverdueFee = Math.round(overdueHours * 15.00 * 100) / 100;
    const damageEstimate = 30.00;
    const expectedTotalDeduction = expectedOverdueFee + damageEstimate;

    const returnResult = await ReturnService.processReturn(
      loan.id,
      'poor',
      '外壳有明显磨损',
      damageEstimate,
      null,
      '逾期且损坏归还'
    );

    expect(returnResult.summary.overdueFee).toBeGreaterThan(0);
    expect(returnResult.summary.damageEstimate).toBe(damageEstimate);
    expect(returnResult.summary.totalDeduction).toBe(expectedTotalDeduction);
    expect(returnResult.summary.depositRefunded).toBe(Math.max(0, 200.00 - expectedTotalDeduction));
  });

  test('扣除费用超过押金时应该退还0元', async () => {
    const expensiveItem = await Item.create({
      name: '贵重投影仪',
      category: '电子设备',
      total_quantity: 1,
      available_quantity: 1,
      status: 'available',
      deposit_amount: 500.00,
      overdue_rate: 100.00,
      max_loan_hours: 24,
    });

    const startTime = moment().subtract(10, 'days').startOf('day').add(9, 'hours').toDate();
    const endTime = moment().subtract(9, 'days').startOf('day').add(17, 'hours').toDate();

    const wealthyUser = await User.create({
      name: '有钱用户',
      phone: '13900139999',
      email: 'wealthy@example.com',
      role: 'user',
      balance: 2000.00,
      status: 'active',
    });

    const reservation = await Reservation.create({
      user_id: wealthyUser.id,
      item_id: expensiveItem.id,
      start_time: startTime,
      end_time: endTime,
      quantity: 1,
      status: 'checkout',
      deposit_held: 500.00,
    });

    const loan = await Loan.create({
      user_id: wealthyUser.id,
      item_id: expensiveItem.id,
      reservation_id: reservation.id,
      checkout_time: startTime,
      expected_return_time: endTime,
      quantity: 1,
      status: 'overdue',
      deposit_amount: 500.00,
    });

    await Deposit.create({
      user_id: wealthyUser.id,
      reservation_id: reservation.id,
      loan_id: loan.id,
      amount: 500.00,
      status: 'held',
    });

    const overdueHours = moment().diff(moment(endTime), 'hours', true);
    const expectedOverdueFee = Math.round(overdueHours * 100.00 * 100) / 100;

    const returnResult = await ReturnService.processReturn(
      loan.id,
      'lost',
      '物品丢失',
      1000.00,
      null,
      '物品丢失归还'
    );

    expect(returnResult.summary.totalDeduction).toBeGreaterThan(500.00);
    expect(returnResult.summary.depositRefunded).toBe(0);
  });

  test('借出服务应该能正确识别逾期状态', async () => {
    const startTime = moment().subtract(3, 'days').startOf('day').add(9, 'hours').toDate();
    const endTime = moment().subtract(2, 'days').startOf('day').add(17, 'hours').toDate();

    const reservation = await Reservation.create({
      user_id: testUser.id,
      item_id: testItem.id,
      start_time: startTime,
      end_time: endTime,
      quantity: 1,
      status: 'checkout',
      deposit_held: 200.00,
    });

    const loan = await Loan.create({
      user_id: testUser.id,
      item_id: testItem.id,
      reservation_id: reservation.id,
      checkout_time: startTime,
      expected_return_time: endTime,
      quantity: 1,
      status: 'active',
      deposit_amount: 200.00,
    });

    const result = await LoanService.checkAndUpdateOverdueStatus();

    expect(result.total).toBeGreaterThan(0);

    const updatedLoan = await Loan.findByPk(loan.id);
    expect(updatedLoan.status).toBe('overdue');
  });
});

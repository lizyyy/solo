require('./setup');
const moment = require('moment');
const { User, Item, Reservation, Deposit } = require('../src/models');
const ReservationService = require('../src/services/ReservationService');

describe('冲突预约测试', () => {
  let testUser;
  let testItem;
  let anotherUser;

  beforeEach(async () => {
    testUser = await User.create({
      name: '测试用户',
      phone: '13900139001',
      email: 'test@example.com',
      role: 'user',
      balance: 500.00,
      status: 'active',
    });

    anotherUser = await User.create({
      name: '另一个用户',
      phone: '13900139002',
      email: 'another@example.com',
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

  test('应该成功创建正常预约', async () => {
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

    expect(reservation).toBeDefined();
    expect(reservation.user_id).toBe(testUser.id);
    expect(reservation.item_id).toBe(testItem.id);
    expect(reservation.status).toBe('confirmed');
    expect(reservation.deposit_held).toBe(200.00);

    const updatedUser = await User.findByPk(testUser.id);
    expect(parseFloat(updatedUser.balance)).toBe(300.00);

    const deposit = await Deposit.findOne({
      where: { reservation_id: reservation.id },
    });
    expect(deposit).toBeDefined();
    expect(deposit.amount).toBe(200.00);
    expect(deposit.status).toBe('held');
  });

  test('应该拒绝时间重叠的预约', async () => {
    const startTime = moment().add(1, 'days').startOf('day').add(9, 'hours').toDate();
    const endTime = moment().add(1, 'days').startOf('day').add(17, 'hours').toDate();

    await ReservationService.createReservation(
      testUser.id,
      testItem.id,
      startTime,
      endTime,
      1,
      '第一个预约'
    );

    await expect(
      ReservationService.createReservation(
        anotherUser.id,
        testItem.id,
        startTime,
        endTime,
        1,
        '冲突预约'
      )
    ).rejects.toThrow();
  });

  test('应该拒绝部分时间重叠的预约（前半段重叠）', async () => {
    const startTime1 = moment().add(1, 'days').startOf('day').add(9, 'hours').toDate();
    const endTime1 = moment().add(1, 'days').startOf('day').add(17, 'hours').toDate();

    await ReservationService.createReservation(
      testUser.id,
      testItem.id,
      startTime1,
      endTime1,
      1,
      '第一个预约'
    );

    const startTime2 = moment().add(1, 'days').startOf('day').add(14, 'hours').toDate();
    const endTime2 = moment().add(1, 'days').startOf('day').add(20, 'hours').toDate();

    await expect(
      ReservationService.createReservation(
        anotherUser.id,
        testItem.id,
        startTime2,
        endTime2,
        1,
        '冲突预约'
      )
    ).rejects.toThrow();
  });

  test('应该拒绝部分时间重叠的预约（后半段重叠）', async () => {
    const startTime1 = moment().add(1, 'days').startOf('day').add(9, 'hours').toDate();
    const endTime1 = moment().add(1, 'days').startOf('day').add(17, 'hours').toDate();

    await ReservationService.createReservation(
      testUser.id,
      testItem.id,
      startTime1,
      endTime1,
      1,
      '第一个预约'
    );

    const startTime2 = moment().add(1, 'days').startOf('day').add(6, 'hours').toDate();
    const endTime2 = moment().add(1, 'days').startOf('day').add(12, 'hours').toDate();

    await expect(
      ReservationService.createReservation(
        anotherUser.id,
        testItem.id,
        startTime2,
        endTime2,
        1,
        '冲突预约'
      )
    ).rejects.toThrow();
  });

  test('应该拒绝完全包含在已有预约内的预约', async () => {
    const startTime1 = moment().add(1, 'days').startOf('day').add(9, 'hours').toDate();
    const endTime1 = moment().add(1, 'days').startOf('day').add(17, 'hours').toDate();

    await ReservationService.createReservation(
      testUser.id,
      testItem.id,
      startTime1,
      endTime1,
      1,
      '第一个预约'
    );

    const startTime2 = moment().add(1, 'days').startOf('day').add(10, 'hours').toDate();
    const endTime2 = moment().add(1, 'days').startOf('day').add(16, 'hours').toDate();

    await expect(
      ReservationService.createReservation(
        anotherUser.id,
        testItem.id,
        startTime2,
        endTime2,
        1,
        '冲突预约'
      )
    ).rejects.toThrow();
  });

  test('应该允许边界时间不重叠的预约', async () => {
    const startTime1 = moment().add(1, 'days').startOf('day').add(9, 'hours').toDate();
    const endTime1 = moment().add(1, 'days').startOf('day').add(17, 'hours').toDate();

    await ReservationService.createReservation(
      testUser.id,
      testItem.id,
      startTime1,
      endTime1,
      1,
      '第一个预约'
    );

    const startTime2 = moment().add(1, 'days').startOf('day').add(17, 'hours').toDate();
    const endTime2 = moment().add(1, 'days').startOf('day').add(21, 'hours').toDate();

    const reservation2 = await ReservationService.createReservation(
      anotherUser.id,
      testItem.id,
      startTime2,
      endTime2,
      1,
      '边界预约'
    );

    expect(reservation2).toBeDefined();
    expect(reservation2.status).toBe('confirmed');
  });

  test('应该拒绝维护中物品的预约', async () => {
    const maintenanceItem = await Item.create({
      name: '维护中的电钻',
      category: '工具',
      total_quantity: 1,
      available_quantity: 1,
      status: 'maintenance',
      deposit_amount: 200.00,
      overdue_rate: 15.00,
    });

    const startTime = moment().add(1, 'days').startOf('day').add(9, 'hours').toDate();
    const endTime = moment().add(1, 'days').startOf('day').add(17, 'hours').toDate();

    await expect(
      ReservationService.createReservation(
        testUser.id,
        maintenanceItem.id,
        startTime,
        endTime,
        1,
        '维护中物品预约'
      )
    ).rejects.toThrow();
  });

  test('应该拒绝余额不足用户的预约', async () => {
    const poorUser = await User.create({
      name: '余额不足用户',
      phone: '13900139003',
      email: 'poor@example.com',
      role: 'user',
      balance: 100.00,
      status: 'active',
    });

    const expensiveItem = await Item.create({
      name: '昂贵物品',
      category: '电子设备',
      total_quantity: 1,
      available_quantity: 1,
      status: 'available',
      deposit_amount: 500.00,
      overdue_rate: 25.00,
    });

    const startTime = moment().add(1, 'days').startOf('day').add(9, 'hours').toDate();
    const endTime = moment().add(1, 'days').startOf('day').add(17, 'hours').toDate();

    await expect(
      ReservationService.createReservation(
        poorUser.id,
        expensiveItem.id,
        startTime,
        endTime,
        1,
        '余额不足预约'
      )
    ).rejects.toThrow();
  });

  test('应该拒绝超过最大借用时长的预约', async () => {
    const startTime = moment().add(1, 'days').startOf('day').toDate();
    const endTime = moment().add(5, 'days').startOf('day').toDate();

    await expect(
      ReservationService.createReservation(
        testUser.id,
        testItem.id,
        startTime,
        endTime,
        1,
        '超时长预约'
      )
    ).rejects.toThrow();
  });

  test('多件库存应该允许不同用户在同一时间段预约', async () => {
    const multiItem = await Item.create({
      name: '多件折叠桌',
      category: '户外用品',
      total_quantity: 3,
      available_quantity: 3,
      status: 'available',
      deposit_amount: 50.00,
      overdue_rate: 5.00,
      max_loan_hours: 168,
    });

    const user3 = await User.create({
      name: '用户三',
      phone: '13900139004',
      email: 'user3@example.com',
      role: 'user',
      balance: 500.00,
      status: 'active',
    });

    const startTime = moment().add(1, 'days').startOf('day').add(9, 'hours').toDate();
    const endTime = moment().add(1, 'days').startOf('day').add(17, 'hours').toDate();

    const reservation1 = await ReservationService.createReservation(
      testUser.id,
      multiItem.id,
      startTime,
      endTime,
      1,
      '用户一预约'
    );

    const reservation2 = await ReservationService.createReservation(
      anotherUser.id,
      multiItem.id,
      startTime,
      endTime,
      1,
      '用户二预约'
    );

    const reservation3 = await ReservationService.createReservation(
      user3.id,
      multiItem.id,
      startTime,
      endTime,
      1,
      '用户三预约'
    );

    expect(reservation1.status).toBe('confirmed');
    expect(reservation2.status).toBe('confirmed');
    expect(reservation3.status).toBe('confirmed');
  });
});

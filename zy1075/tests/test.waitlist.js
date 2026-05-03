require('./setup');
const moment = require('moment');
const { User, Item, Reservation, Waitlist, Deposit } = require('../src/models');
const ReservationService = require('../src/services/ReservationService');
const WaitlistService = require('../src/services/WaitlistService');

describe('候补补位测试', () => {
  let testUser;
  let anotherUser;
  let user3;
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

    anotherUser = await User.create({
      name: '候补用户',
      phone: '13900139002',
      email: 'waitlist@example.com',
      role: 'user',
      balance: 500.00,
      status: 'active',
    });

    user3 = await User.create({
      name: '用户三',
      phone: '13900139003',
      email: 'user3@example.com',
      role: 'user',
      balance: 500.00,
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

  test('应该成功加入候补队列', async () => {
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

    const waitlist = await WaitlistService.addToWaitlist(
      anotherUser.id,
      testItem.id,
      startTime,
      endTime,
      1,
      null,
      '候补预约'
    );

    expect(waitlist).toBeDefined();
    expect(waitlist.user_id).toBe(anotherUser.id);
    expect(waitlist.item_id).toBe(testItem.id);
    expect(waitlist.status).toBe('waiting');
    expect(waitlist.position).toBe(1);
  });

  test('候补队列应该按加入顺序排列', async () => {
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

    const waitlist1 = await WaitlistService.addToWaitlist(
      anotherUser.id,
      testItem.id,
      startTime,
      endTime,
      1,
      null,
      '第一个候补'
    );

    const waitlist2 = await WaitlistService.addToWaitlist(
      user3.id,
      testItem.id,
      startTime,
      endTime,
      1,
      null,
      '第二个候补'
    );

    expect(waitlist1.position).toBe(1);
    expect(waitlist2.position).toBe(2);
  });

  test('原预约取消后，第一个候补应该自动补位', async () => {
    const startTime = moment().add(1, 'days').startOf('day').add(9, 'hours').toDate();
    const endTime = moment().add(1, 'days').startOf('day').add(17, 'hours').toDate();

    const reservation = await ReservationService.createReservation(
      testUser.id,
      testItem.id,
      startTime,
      endTime,
      1,
      '第一个预约'
    );

    const waitlist = await WaitlistService.addToWaitlist(
      anotherUser.id,
      testItem.id,
      startTime,
      endTime,
      1,
      reservation.id,
      '候补预约'
    );

    const cancelResult = await ReservationService.cancelReservation(
      reservation.id,
      '用户主动取消'
    );

    expect(cancelResult).toBeDefined();
    expect(cancelResult.waitlistProcessed).toBeDefined();
    expect(cancelResult.waitlistProcessed.length).toBeGreaterThan(0);

    const updatedWaitlist = await Waitlist.findByPk(waitlist.id);
    expect(updatedWaitlist.status).toBe('converted');
    expect(updatedWaitlist.convert_reason).toBe('原预约取消，候补成功');

    const newReservation = await Reservation.findByPk(
      updatedWaitlist.converted_reservation_id,
      {
        include: [{ model: Deposit, as: 'deposits' }],
      }
    );
    
    expect(newReservation).toBeDefined();
    expect(newReservation.user_id).toBe(anotherUser.id);
    expect(newReservation.status).toBe('confirmed');

    const updatedUser = await User.findByPk(anotherUser.id);
    expect(parseFloat(updatedUser.balance)).toBe(0.00);
  });

  test('应该可以从候补队列中取消', async () => {
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

    const waitlist1 = await WaitlistService.addToWaitlist(
      anotherUser.id,
      testItem.id,
      startTime,
      endTime,
      1,
      null,
      '第一个候补'
    );

    const waitlist2 = await WaitlistService.addToWaitlist(
      user3.id,
      testItem.id,
      startTime,
      endTime,
      1,
      null,
      '第二个候补'
    );

    const removeResult = await WaitlistService.removeFromWaitlist(
      waitlist1.id,
      anotherUser.id,
      '用户主动取消'
    );

    expect(removeResult).toBeDefined();

    const updatedWaitlist1 = await Waitlist.findByPk(waitlist1.id);
    expect(updatedWaitlist1.status).toBe('cancelled');

    const updatedWaitlist2 = await Waitlist.findByPk(waitlist2.id);
    expect(updatedWaitlist2.position).toBe(1);
  });

  test('多件库存时，多个预约应该正常，候补不触发', async () => {
    const multiItem = await Item.create({
      name: '多件折叠桌',
      category: '户外用品',
      total_quantity: 2,
      available_quantity: 2,
      status: 'available',
      deposit_amount: 50.00,
      overdue_rate: 5.00,
      max_loan_hours: 168,
    });

    const startTime = moment().add(1, 'days').startOf('day').add(9, 'hours').toDate();
    const endTime = moment().add(1, 'days').startOf('day').add(17, 'hours').toDate();

    const reservation1 = await ReservationService.createReservation(
      testUser.id,
      multiItem.id,
      startTime,
      endTime,
      1,
      '第一个预约'
    );

    const reservation2 = await ReservationService.createReservation(
      anotherUser.id,
      multiItem.id,
      startTime,
      endTime,
      1,
      '第二个预约'
    );

    expect(reservation1.status).toBe('confirmed');
    expect(reservation2.status).toBe('confirmed');

    const waitlists = await Waitlist.findAll({
      where: { item_id: multiItem.id, status: 'waiting' },
    });

    expect(waitlists.length).toBe(0);
  });

  test('候补用户余额不足时，应该跳过并尝试下一个', async () => {
    const poorUser = await User.create({
      name: '余额不足用户',
      phone: '13900139004',
      email: 'poor2@example.com',
      role: 'user',
      balance: 100.00,
      status: 'active',
    });

    const startTime = moment().add(1, 'days').startOf('day').add(9, 'hours').toDate();
    const endTime = moment().add(1, 'days').startOf('day').add(17, 'hours').toDate();

    const reservation = await ReservationService.createReservation(
      testUser.id,
      testItem.id,
      startTime,
      endTime,
      1,
      '第一个预约'
    );

    const waitlist1 = await WaitlistService.addToWaitlist(
      poorUser.id,
      testItem.id,
      startTime,
      endTime,
      1,
      reservation.id,
      '第一个候补（余额不足）'
    );

    const waitlist2 = await WaitlistService.addToWaitlist(
      anotherUser.id,
      testItem.id,
      startTime,
      endTime,
      1,
      reservation.id,
      '第二个候补（余额充足）'
    );

    const cancelResult = await ReservationService.cancelReservation(
      reservation.id,
      '用户主动取消'
    );

    const updatedWaitlist1 = await Waitlist.findByPk(waitlist1.id);
    const updatedWaitlist2 = await Waitlist.findByPk(waitlist2.id);

    expect(updatedWaitlist1.status).toBe('expired');
    expect(updatedWaitlist2.status).toBe('converted');
  });

  test('过期时间的候补应该被标记为过期', async () => {
    const startTime = moment().subtract(2, 'days').startOf('day').add(9, 'hours').toDate();
    const endTime = moment().subtract(2, 'days').startOf('day').add(17, 'hours').toDate();

    const futureStartTime = moment().add(1, 'days').startOf('day').add(9, 'hours').toDate();
    const futureEndTime = moment().add(1, 'days').startOf('day').add(17, 'hours').toDate();

    await ReservationService.createReservation(
      testUser.id,
      testItem.id,
      futureStartTime,
      futureEndTime,
      1,
      '当前预约'
    );

    await Waitlist.create({
      user_id: anotherUser.id,
      item_id: testItem.id,
      position: 1,
      requested_start_time: startTime,
      requested_end_time: endTime,
      quantity: 1,
      status: 'waiting',
      notes: '过期候补',
    });

    const result = await WaitlistService.checkWaitlistExpiration();

    expect(result.total).toBeGreaterThan(0);

    const waitlists = await Waitlist.findAll({
      where: { item_id: testItem.id },
    });

    const expiredWaitlist = waitlists.find(w => w.requested_end_time < new Date());
    expect(expiredWaitlist.status).toBe('expired');
  });
});

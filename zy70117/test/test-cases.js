const { 
  createBooking, 
  rescheduleBooking, 
  cancelBooking, 
  getBooking,
  getAvailableHalls,
  getAvailableWaiters
} = require('../src/services/booking-service');

const {
  OPERATION_TYPES,
  checkAndRecordOperation,
  updateOperationResult,
  markOperationFailed,
  getOperation,
  isOperationSuccessful
} = require('../src/services/idempotency-service');

const { initSampleData } = require('../src/models');

initSampleData();

const testCases = [];

const runTests = async () => {
  console.log('开始运行测试用例...\n');
  
  await test1_NormalBookingFlow();
  await test2_ResourceConflict();
  await test3_RescheduleBooking();
  await test4_CancelBooking();
  await test5_IdempotentOperation();
  await test6_OverCapacity();
  await test7_DuplicateReschedule();
  
  console.log('\n=== 测试结果汇总 ===');
  let passed = 0;
  let failed = 0;
  
  testCases.forEach((test, index) => {
    const status = test.passed ? '✓ 通过' : '✗ 失败';
    console.log(`${index + 1}. ${test.name}: ${status}`);
    if (test.passed) passed++;
    else failed++;
    
    if (!test.passed && test.error) {
      console.log(`   错误: ${test.error}`);
    }
  });
  
  console.log(`\n总计: ${passed} 个通过, ${failed} 个失败`);
};

const test1_NormalBookingFlow = async () => {
  const testName = '正常预订流程';
  console.log(`\n--- 测试: ${testName} ---`);
  
  try {
    const startTime = '2026-05-20T18:00:00.000Z';
    const endTime = '2026-05-20T22:00:00.000Z';
    const operationId = 'test-op-001';
    
    const availableHallsBefore = getAvailableHalls(startTime, endTime);
    console.log(`预订前可用宴会厅数量: ${availableHallsBefore.length}`);
    
    const bookingData = {
      hallId: 'hall-a',
      menuId: 'menu-v1',
      waiterIds: ['waiter-1', 'waiter-2', 'waiter-3'],
      startTime,
      endTime,
      customerName: '张先生',
      guestsCount: 150
    };
    
    const booking = await createBooking(bookingData, operationId);
    console.log(`预订成功，订单ID: ${booking.id}`);
    console.log(`订单总价: ${booking.totalPrice} 元`);
    
    const availableHallsAfter = getAvailableHalls(startTime, endTime);
    console.log(`预订后可用宴会厅数量: ${availableHallsAfter.length}`);
    
    const retrievedBooking = getBooking(booking.id);
    console.log(`订单状态: ${retrievedBooking.status}`);
    
    testCases.push({ name: testName, passed: true });
    console.log('✓ 正常预订流程测试通过');
  } catch (error) {
    testCases.push({ name: testName, passed: false, error: error.message });
    console.log(`✗ 正常预订流程测试失败: ${error.message}`);
  }
};

const test2_ResourceConflict = async () => {
  const testName = '资源冲突拦截';
  console.log(`\n--- 测试: ${testName} ---`);
  
  try {
    const startTime = '2026-05-21T18:00:00.000Z';
    const endTime = '2026-05-21T22:00:00.000Z';
    
    const bookingData1 = {
      hallId: 'hall-a',
      menuId: 'menu-v1',
      waiterIds: ['waiter-4', 'waiter-5', 'waiter-6'],
      startTime,
      endTime,
      customerName: '李先生',
      guestsCount: 100
    };
    
    const booking1 = await createBooking(bookingData1, 'test-op-002');
    console.log(`第一个预订成功，订单ID: ${booking1.id}`);
    
    const bookingData2 = {
      hallId: 'hall-a',
      menuId: 'menu-v2',
      waiterIds: ['waiter-7', 'waiter-8', 'waiter-9'],
      startTime,
      endTime,
      customerName: '王先生',
      guestsCount: 120
    };
    
    try {
      await createBooking(bookingData2, 'test-op-003');
      throw new Error('应该抛出资源冲突错误');
    } catch (error) {
      console.log(`成功拦截资源冲突: ${error.message}`);
    }
    
    testCases.push({ name: testName, passed: true });
    console.log('✓ 资源冲突拦截测试通过');
  } catch (error) {
    testCases.push({ name: testName, passed: false, error: error.message });
    console.log(`✗ 资源冲突拦截测试失败: ${error.message}`);
  }
};

const test3_RescheduleBooking = async () => {
  const testName = '改期功能测试';
  console.log(`\n--- 测试: ${testName} ---`);
  
  try {
    const startTime = '2026-05-22T18:00:00.000Z';
    const endTime = '2026-05-22T22:00:00.000Z';
    const newStartTime = '2026-05-23T18:00:00.000Z';
    const newEndTime = '2026-05-23T22:00:00.000Z';
    
    const bookingData = {
      hallId: 'hall-b',
      menuId: 'menu-v3',
      waiterIds: ['waiter-10', 'waiter-1', 'waiter-2'],
      startTime,
      endTime,
      customerName: '赵女士',
      guestsCount: 80
    };
    
    const booking = await createBooking(bookingData, 'test-op-004');
    console.log(`预订成功，订单ID: ${booking.id}`);
    console.log(`原预订时间: ${booking.startTime} - ${booking.endTime}`);
    
    const availableHallsBefore = getAvailableHalls(newStartTime, newEndTime);
    console.log(`改期前新时间段可用宴会厅数量: ${availableHallsBefore.length}`);
    
    const updatedBooking = await rescheduleBooking(booking.id, newStartTime, newEndTime, 'test-op-005');
    console.log(`改期成功，新预订时间: ${updatedBooking.startTime} - ${updatedBooking.endTime}`);
    
    const availableHallsAfter = getAvailableHalls(newStartTime, newEndTime);
    console.log(`改期后新时间段可用宴会厅数量: ${availableHallsAfter.length}`);
    
    const availableHallsOriginal = getAvailableHalls(startTime, endTime);
    console.log(`改期后原时间段可用宴会厅数量: ${availableHallsOriginal.length}`);
    
    testCases.push({ name: testName, passed: true });
    console.log('✓ 改期功能测试通过');
  } catch (error) {
    testCases.push({ name: testName, passed: false, error: error.message });
    console.log(`✗ 改期功能测试失败: ${error.message}`);
  }
};

const test4_CancelBooking = async () => {
  const testName = '取消预订功能测试';
  console.log(`\n--- 测试: ${testName} ---`);
  
  try {
    const startTime = '2026-05-24T18:00:00.000Z';
    const endTime = '2026-05-24T22:00:00.000Z';
    
    const bookingData = {
      hallId: 'hall-a',
      menuId: 'menu-v2',
      waiterIds: ['waiter-3', 'waiter-4', 'waiter-5'],
      startTime,
      endTime,
      customerName: '孙先生',
      guestsCount: 180
    };
    
    const booking = await createBooking(bookingData, 'test-op-006');
    console.log(`预订成功，订单ID: ${booking.id}`);
    console.log(`订单状态: ${booking.status}`);
    
    const availableHallsBefore = getAvailableHalls(startTime, endTime);
    console.log(`取消前该时间段可用宴会厅数量: ${availableHallsBefore.length}`);
    
    const cancelledBooking = await cancelBooking(booking.id, 'test-op-007');
    console.log(`取消成功，订单状态: ${cancelledBooking.status}`);
    
    const availableHallsAfter = getAvailableHalls(startTime, endTime);
    console.log(`取消后该时间段可用宴会厅数量: ${availableHallsAfter.length}`);
    
    testCases.push({ name: testName, passed: true });
    console.log('✓ 取消预订功能测试通过');
  } catch (error) {
    testCases.push({ name: testName, passed: false, error: error.message });
    console.log(`✗ 取消预订功能测试失败: ${error.message}`);
  }
};

const test5_IdempotentOperation = async () => {
  const testName = '幂等性操作测试';
  console.log(`\n--- 测试: ${testName} ---`);
  
  try {
    const operationId = 'test-op-008';
    const startTime = '2026-05-25T18:00:00.000Z';
    const endTime = '2026-05-25T22:00:00.000Z';
    
    const bookingData = {
      hallId: 'hall-b',
      menuId: 'menu-v1',
      waiterIds: ['waiter-6', 'waiter-7', 'waiter-8'],
      startTime,
      endTime,
      customerName: '周女士',
      guestsCount: 100
    };
    
    const result1 = await checkAndRecordOperation(operationId, OPERATION_TYPES.CREATE_BOOKING, bookingData);
    console.log(`第一次操作检查: isDuplicate=${result1.isDuplicate}`);
    
    if (!result1.isDuplicate) {
      const booking = await createBooking(bookingData, operationId);
      await updateOperationResult(operationId, booking);
      console.log(`第一次操作成功，订单ID: ${booking.id}`);
    }
    
    const result2 = await checkAndRecordOperation(operationId, OPERATION_TYPES.CREATE_BOOKING, bookingData);
    console.log(`第二次操作检查: isDuplicate=${result2.isDuplicate}`);
    
    if (result2.isDuplicate && result2.operation.status === 'success') {
      console.log(`成功识别重复操作，返回上次结果`);
      console.log(`重复操作返回的订单ID: ${result2.operation.result.id}`);
    }
    
    testCases.push({ name: testName, passed: true });
    console.log('✓ 幂等性操作测试通过');
  } catch (error) {
    testCases.push({ name: testName, passed: false, error: error.message });
    console.log(`✗ 幂等性操作测试失败: ${error.message}`);
  }
};

const test6_OverCapacity = async () => {
  const testName = '容量超限拦截';
  console.log(`\n--- 测试: ${testName} ---`);
  
  try {
    const startTime = '2026-05-26T18:00:00.000Z';
    const endTime = '2026-05-26T22:00:00.000Z';
    
    const bookingData = {
      hallId: 'hall-b',
      menuId: 'menu-v2',
      waiterIds: ['waiter-9', 'waiter-10', 'waiter-1'],
      startTime,
      endTime,
      customerName: '吴先生',
      guestsCount: 200
    };
    
    try {
      await createBooking(bookingData, 'test-op-009');
      throw new Error('应该抛出容量超限错误');
    } catch (error) {
      console.log(`成功拦截容量超限: ${error.message}`);
    }
    
    testCases.push({ name: testName, passed: true });
    console.log('✓ 容量超限拦截测试通过');
  } catch (error) {
    testCases.push({ name: testName, passed: false, error: error.message });
    console.log(`✗ 容量超限拦截测试失败: ${error.message}`);
  }
};

const test7_DuplicateReschedule = async () => {
  const testName = '重复改期测试';
  console.log(`\n--- 测试: ${testName} ---`);
  
  try {
    const startTime = '2026-05-27T18:00:00.000Z';
    const endTime = '2026-05-27T22:00:00.000Z';
    const newStartTime = '2026-05-28T18:00:00.000Z';
    const newEndTime = '2026-05-28T22:00:00.000Z';
    const operationId = 'test-op-011';
    
    const bookingData = {
      hallId: 'hall-a',
      menuId: 'menu-v3',
      waiterIds: ['waiter-2', 'waiter-3', 'waiter-4'],
      startTime,
      endTime,
      customerName: '郑女士',
      guestsCount: 120
    };
    
    const booking = await createBooking(bookingData, 'test-op-010');
    console.log(`预订成功，订单ID: ${booking.id}`);
    
    const rescheduleData = { bookingId: booking.id, newStartTime, newEndTime };
    const result1 = await checkAndRecordOperation(operationId, OPERATION_TYPES.RESCHEDULE_BOOKING, rescheduleData);
    console.log(`第一次改期检查: isDuplicate=${result1.isDuplicate}`);
    
    if (!result1.isDuplicate) {
      const updatedBooking = await rescheduleBooking(booking.id, newStartTime, newEndTime, operationId);
      await updateOperationResult(operationId, updatedBooking);
      console.log(`第一次改期成功，新时间: ${updatedBooking.startTime} - ${updatedBooking.endTime}`);
    }
    
    const result2 = await checkAndRecordOperation(operationId, OPERATION_TYPES.RESCHEDULE_BOOKING, rescheduleData);
    console.log(`第二次改期检查: isDuplicate=${result2.isDuplicate}`);
    
    if (result2.isDuplicate && result2.operation.status === 'success') {
      console.log(`成功识别重复改期操作，返回上次结果`);
      console.log(`重复改期返回的时间: ${result2.operation.result.startTime} - ${result2.operation.result.endTime}`);
    }
    
    testCases.push({ name: testName, passed: true });
    console.log('✓ 重复改期测试通过');
  } catch (error) {
    testCases.push({ name: testName, passed: false, error: error.message });
    console.log(`✗ 重复改期测试失败: ${error.message}`);
  }
};

runTests();

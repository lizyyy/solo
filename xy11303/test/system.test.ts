import { initDatabase } from '../models/database';
import { OrderModel } from '../models/OrderModel';
import { TaskService } from '../services/TaskService';
import { ReworkService } from '../services/ReworkService';
import { DeductionService } from '../services/DeductionService';
import { SettlementService } from '../services/SettlementService';
import { ValidationEngine } from '../rules/ValidationEngine';
import { PhotoValidationRule } from '../rules/PhotoValidationRule';
import { OvertimeValidationRule } from '../rules/OvertimeValidationRule';
import { ReworkValidationRule } from '../rules/ReworkValidationRule';
import { UserModel } from '../models/UserModel';
import { PhotoModel } from '../models/PhotoModel';
import { UserRole, DeductionType, TaskStatus } from '../types';
import { DataMaskingService } from '../utils/DataMaskingService';
import dayjs from 'dayjs';

describe('幂等性测试', () => {
  let cleaner: any;
  let order: any;

  beforeAll(async () => {
    process.env.DB_PATH = ':memory:';
    initDatabase();
    
    cleaner = UserModel.create({
      username: 'test_cleaner',
      name: '测试保洁',
      phone: '13800138000',
      role: UserRole.CLEANER,
      isActive: true
    }, 'test123');

    order = OrderModel.create({
      orderNo: 'TEST001',
      homestayId: 'HS001',
      homestayName: '测试民宿',
      guestName: '测试客人',
      guestPhone: '13900139000',
      checkInDate: '2024-01-01',
      checkOutDate: '2024-01-02',
      roomCount: 1,
      cleaningFee: 100,
      status: 'active'
    });
  });

  test('重复派单应返回已有任务而不创建新任务', async () => {
    const scheduledDate = dayjs().format('YYYY-MM-DD HH:mm:ss');
    const deadline = dayjs().add(1, 'day').format('YYYY-MM-DD HH:mm:ss');

    const result1 = await TaskService.assignTask({
      orderId: order.id,
      cleanerId: cleaner.id,
      scheduledDate,
      deadline,
      operatorId: 'system'
    });

    expect(result1.success).toBe(true);
    expect(result1.isDuplicate).toBe(false);

    const result2 = await TaskService.assignTask({
      orderId: order.id,
      cleanerId: cleaner.id,
      scheduledDate,
      deadline,
      operatorId: 'system'
    });

    expect(result2.success).toBe(true);
    expect(result2.isDuplicate).toBe(true);
    expect(result2.task!.id).toBe(result1.task!.id);
  });

  test('重复创建返工应返回已有返工而不创建新返工', async () => {
    const taskResult = await TaskService.assignTask({
      orderId: order.id,
      cleanerId: cleaner.id,
      scheduledDate: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      deadline: dayjs().add(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
      operatorId: 'system'
    });

    const result1 = await ReworkService.createRework({
      taskId: taskResult.task!.id,
      reason: '测试返工',
      requesterId: 'system',
      deadline: dayjs().add(1, 'day').toISOString()
    });

    expect(result1.success).toBe(true);
    expect(result1.isDuplicate).toBe(false);

    const result2 = await ReworkService.createRework({
      taskId: taskResult.task!.id,
      reason: '测试返工',
      requesterId: 'system',
      deadline: dayjs().add(1, 'day').toISOString()
    });

    expect(result2.success).toBe(true);
    expect(result2.isDuplicate).toBe(true);
  });

  test('重复创建扣款应返回已有扣款而不创建新扣款', async () => {
    const taskResult = await TaskService.assignTask({
      orderId: order.id,
      cleanerId: cleaner.id,
      scheduledDate: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      deadline: dayjs().add(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
      operatorId: 'system'
    });

    const result1 = await DeductionService.createDeduction({
      taskId: taskResult.task!.id,
      type: DeductionType.MISSING_PHOTOS,
      amount: 20,
      reason: '缺图测试',
      operatorId: 'system'
    });

    expect(result1.success).toBe(true);
    expect(result1.isDuplicate).toBe(false);

    const result2 = await DeductionService.createDeduction({
      taskId: taskResult.task!.id,
      type: DeductionType.MISSING_PHOTOS,
      amount: 20,
      reason: '缺图测试',
      operatorId: 'system',
      relatedId: result1.deduction!.relatedId
    });

    expect(result2.success).toBe(true);
    expect(result2.isDuplicate).toBe(true);
  });
});

describe('业务规则测试', () => {
  let cleaner: any;
  let order: any;
  let task: any;

  beforeAll(async () => {
    process.env.DB_PATH = ':memory:';
    initDatabase();
    
    cleaner = UserModel.create({
      username: 'test_cleaner2',
      name: '测试保洁',
      phone: '13800138001',
      role: UserRole.CLEANER,
      isActive: true
    }, 'test123');

    order = OrderModel.create({
      orderNo: 'TEST002',
      homestayId: 'HS002',
      homestayName: '测试民宿2',
      guestName: '测试客人2',
      guestPhone: '13900139002',
      checkInDate: '2024-01-01',
      checkOutDate: '2024-01-02',
      roomCount: 1,
      cleaningFee: 100,
      status: 'active'
    });

    const taskResult = await TaskService.assignTask({
      orderId: order.id,
      cleanerId: cleaner.id,
      scheduledDate: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      deadline: dayjs().add(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
      operatorId: 'system'
    });
    task = taskResult.task;
  });

  test('缺图拦截规则应正确校验照片数量', async () => {
    const result1 = await PhotoValidationRule.validate({
      taskId: task.id,
      requiredPhotos: 5,
      submittedPhotos: 0
    });

    expect(result1.passed).toBe(false);
    expect(result1.rule).toBe('MISSING_PHOTOS');
    expect(result1.deductionAmount).toBe(100);

    for (let i = 0; i < 5; i++) {
      PhotoModel.create({
        taskId: task.id,
        uploaderId: cleaner.id,
        photoType: 'general',
        photoUrl: `http://example.com/photo${i}.jpg`,
        fileName: `photo${i}.jpg`,
        fileSize: 1024
      });
    }

    const result2 = await PhotoValidationRule.validate({
      taskId: task.id,
      requiredPhotos: 5
    });

    expect(result2.passed).toBe(true);
  });

  test('超时扣分规则应正确计算超时扣款', async () => {
    const result1 = await OvertimeValidationRule.validate({
      taskId: task.id,
      deadline: dayjs().subtract(2, 'hour').toISOString(),
      submittedAt: dayjs().toISOString(),
      status: TaskStatus.SUBMITTED
    });

    expect(result1.passed).toBe(false);
    expect(result1.rule).toBe('OVERTIME_SUBMIT');
    expect(result1.deductionAmount).toBe(20);

    const result2 = await OvertimeValidationRule.validate({
      taskId: task.id,
      deadline: dayjs().add(2, 'hour').toISOString(),
      submittedAt: dayjs().toISOString(),
      status: TaskStatus.SUBMITTED
    });

    expect(result2.passed).toBe(true);
  });

  test('返工影响结算规则应正确计算返工扣款', async () => {
    const result1 = await ReworkValidationRule.validate({
      taskId: task.id
    });
    expect(result1.passed).toBe(true);

    await ReworkService.createRework({
      taskId: task.id,
      reason: '测试返工',
      requesterId: 'system',
      deadline: dayjs().add(1, 'day').toISOString()
    });

    const result2 = await ReworkValidationRule.validate({
      taskId: task.id
    });
    expect(result2.passed).toBe(false);
    expect(result2.rule).toBe('REWORK_IMPACT');
  });

  test('综合校验应正确判断任务是否可验收', async () => {
    const report = await ValidationEngine.validateTaskById(task.id);
    
    expect(report.canApprove).toBeDefined();
    expect(report.results.length).toBeGreaterThan(0);
    expect(report.blockingRules).toBeDefined();
  });
});

describe('数据脱敏测试', () => {
  test('电话号码应正确脱敏', () => {
    const masked = DataMaskingService.maskPhone('13812345678');
    expect(masked).toBe('138****5678');
  });

  test('姓名应正确脱敏', () => {
    const masked = DataMaskingService.maskName('张三丰');
    expect(masked).toBe('张**');
  });

  test('敏感金额应对保洁员隐藏', () => {
    const order = {
      id: 'test',
      orderNo: 'TEST001',
      cleaningFee: 100
    };

    const sanitized = DataMaskingService.sanitize(order, UserRole.CLEANER, 'orders');
    
    expect((sanitized as any).cleaningFee).toBeNull();
  });

  test('管理员应能看到完整金额', () => {
    const order = {
      id: 'test',
      orderNo: 'TEST001',
      cleaningFee: 100
    };

    const sanitized = DataMaskingService.sanitize(order, UserRole.ADMIN, 'orders');
    
    expect((sanitized as any).cleaningFee).toBe(100);
  });
});

describe('结算流程测试', () => {
  let cleaner: any;
  let order1: any;
  let order2: any;

  beforeAll(async () => {
    process.env.DB_PATH = ':memory:';
    initDatabase();
    
    cleaner = UserModel.create({
      username: 'test_cleaner3',
      name: '测试保洁3',
      phone: '13800138003',
      role: UserRole.CLEANER,
      isActive: true
    }, 'test123');

    order1 = OrderModel.create({
      orderNo: 'TEST003',
      homestayId: 'HS003',
      homestayName: '测试民宿3',
      guestName: '测试客人3',
      guestPhone: '13900139003',
      checkInDate: '2024-01-10',
      checkOutDate: '2024-01-11',
      roomCount: 1,
      cleaningFee: 100,
      status: 'active'
    });

    order2 = OrderModel.create({
      orderNo: 'TEST004',
      homestayId: 'HS004',
      homestayName: '测试民宿4',
      guestName: '测试客人4',
      guestPhone: '13900139004',
      checkInDate: '2024-01-12',
      checkOutDate: '2024-01-13',
      roomCount: 1,
      cleaningFee: 100,
      status: 'active'
    });
  });

  test('完整结算流程应正确计算金额', async () => {
    const taskResult1 = await TaskService.assignTask({
      orderId: order1.id,
      cleanerId: cleaner.id,
      scheduledDate: '2024-01-11 12:00:00',
      deadline: '2024-01-11 18:00:00',
      operatorId: 'system'
    });

    const taskResult2 = await TaskService.assignTask({
      orderId: order2.id,
      cleanerId: cleaner.id,
      scheduledDate: '2024-01-13 12:00:00',
      deadline: '2024-01-13 18:00:00',
      operatorId: 'system'
    });

    await TaskService.startTask(taskResult1.task!.id, cleaner.id);
    await TaskService.submitTask(taskResult1.task!.id, cleaner.id);

    for (let i = 0; i < 5; i++) {
      PhotoModel.create({
        taskId: taskResult1.task!.id,
        uploaderId: cleaner.id,
        photoType: 'general',
        photoUrl: `http://example.com/photo${i}.jpg`,
        fileName: `photo${i}.jpg`,
        fileSize: 1024
      });
    }

    await TaskService.approveTask(taskResult1.task!.id, 'system');
    await TaskService.completeTask(taskResult1.task!.id, 'system');

    await TaskService.startTask(taskResult2.task!.id, cleaner.id);
    await TaskService.submitTask(taskResult2.task!.id, cleaner.id);

    for (let i = 0; i < 3; i++) {
      PhotoModel.create({
        taskId: taskResult2.task!.id,
        uploaderId: cleaner.id,
        photoType: 'general',
        photoUrl: `http://example.com/photo2-${i}.jpg`,
        fileName: `photo2-${i}.jpg`,
        fileSize: 1024
      });
    }

    await DeductionService.createDeduction({
      taskId: taskResult2.task!.id,
      type: DeductionType.MISSING_PHOTOS,
      amount: 40,
      reason: '缺少2张照片',
      operatorId: 'system',
      autoConfirm: true
    });

    await TaskService.approveTask(taskResult2.task!.id, 'system');
    await TaskService.completeTask(taskResult2.task!.id, 'system');

    const settlementResult = await SettlementService.createSettlement({
      cleanerId: cleaner.id,
      startDate: '2024-01-01',
      endDate: '2024-01-31',
      operatorId: 'system'
    });

    expect(settlementResult.success).toBe(true);
    const settlement = settlementResult.settlement!;
    
    expect(settlement.totalTasks).toBe(2);
    expect(settlement.totalBaseAmount).toBe(200);
    expect(settlement.totalPhotoDeduction).toBe(40);
    expect(settlement.totalDeduction).toBe(40);
    expect(settlement.netAmount).toBe(160);

    const items = SettlementService.getSettlementItems(settlement.id);
    expect(items.items.length).toBe(2);

    const confirmResult = await SettlementService.confirmSettlement(settlement.id, 'system');
    expect(confirmResult.success).toBe(true);

    const payResult = await SettlementService.markAsPaid(settlement.id, 'system');
    expect(payResult.success).toBe(true);
  });
});

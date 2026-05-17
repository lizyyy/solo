import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Customer } from '../entities/Customer';
import { PersonInCharge } from '../entities/PersonInCharge';
import { VisitSchedule, VisitStatus, VisitType, VisitChannel } from '../entities/VisitSchedule';
import { DelayRecord } from '../entities/DelayRecord';
import { VisitReport } from '../entities/VisitReport';
import { MasterDataService } from '../services/MasterDataService';
import { VisitScheduleService } from '../services/VisitScheduleService';
import { ExportService } from '../services/ExportService';

describe('客户回访排期系统 - 集成测试', () => {
  let testDataSource: DataSource;
  let masterService: MasterDataService;
  let scheduleService: VisitScheduleService;
  let exportService: ExportService;
  let testCustomer: Customer;
  let testPerson: PersonInCharge;

  beforeAll(async () => {
    testDataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      logging: false,
      entities: [Customer, PersonInCharge, VisitSchedule, DelayRecord, VisitReport]
    });

    await testDataSource.initialize();

    masterService = new MasterDataService();
    scheduleService = new VisitScheduleService();
    exportService = new ExportService();

    (masterService as any).customerRepository = testDataSource.getRepository(Customer);
    (masterService as any).personRepository = testDataSource.getRepository(PersonInCharge);
    (scheduleService as any).scheduleRepository = testDataSource.getRepository(VisitSchedule);
    (scheduleService as any).delayRepository = testDataSource.getRepository(DelayRecord);
    (scheduleService as any).reportRepository = testDataSource.getRepository(VisitReport);
    (scheduleService as any).customerRepository = testDataSource.getRepository(Customer);
    (scheduleService as any).personRepository = testDataSource.getRepository(PersonInCharge);
  });

  afterAll(async () => {
    await testDataSource.destroy();
  });

  beforeEach(async () => {
    await testDataSource.getRepository(VisitReport).clear();
    await testDataSource.getRepository(DelayRecord).clear();
    await testDataSource.getRepository(VisitSchedule).clear();
    await testDataSource.getRepository(Customer).clear();
    await testDataSource.getRepository(PersonInCharge).clear();

    testCustomer = await masterService.createCustomer({
      accountNumber: 'CUST001',
      name: '测试客户有限公司',
      contactPerson: '张三',
      phone: '13800138000',
      email: 'zhangsan@test.com'
    });

    testPerson = await masterService.createPersonInCharge({
      employeeId: 'EMP001',
      name: '李四',
      department: '客户成功部',
      phone: '13900139000',
      email: 'lisi@test.com'
    });
  });

  describe('1. 正常流程测试', () => {
    it('应该成功创建回访排期', async () => {
      const startTime = new Date();
      startTime.setHours(startTime.getHours() + 2);
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);

      const schedule = await scheduleService.createSchedule({
        customerId: testCustomer.id,
        personInChargeId: testPerson.id,
        visitType: VisitType.REGULAR_FOLLOWUP,
        visitChannel: VisitChannel.PHONE,
        scheduledStartTime: startTime,
        scheduledEndTime: endTime,
        subject: '季度客户回访',
        description: '了解客户近期使用情况',
        createdBy: 'admin'
      });

      expect(schedule).toBeDefined();
      expect(schedule.id).toBeDefined();
      expect(schedule.scheduleNumber).toMatch(/^VS\d+/);
      expect(schedule.status).toBe(VisitStatus.SCHEDULED);
      expect(schedule.customerId).toBe(testCustomer.id);
      expect(schedule.personInChargeId).toBe(testPerson.id);
    });

    it('应该能查询排期列表和详情', async () => {
      const startTime = new Date();
      startTime.setHours(startTime.getHours() + 2);
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);

      const created = await scheduleService.createSchedule({
        customerId: testCustomer.id,
        personInChargeId: testPerson.id,
        visitType: VisitType.NEW_CUSTOMER,
        visitChannel: VisitChannel.VIDEO,
        scheduledStartTime: startTime,
        scheduledEndTime: endTime,
        subject: '新客户欢迎回访'
      });

      const schedules = await scheduleService.getSchedules();
      expect(schedules.length).toBe(1);

      const detail = await scheduleService.getScheduleById(created.id);
      expect(detail).toBeDefined();
      expect(detail?.scheduleNumber).toBe(created.scheduleNumber);
    });

    it('应该能导出排期数据为Excel', async () => {
      const startTime = new Date();
      startTime.setHours(startTime.getHours() + 2);
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);

      await scheduleService.createSchedule({
        customerId: testCustomer.id,
        personInChargeId: testPerson.id,
        visitType: VisitType.REGULAR_FOLLOWUP,
        visitChannel: VisitChannel.PHONE,
        scheduledStartTime: startTime,
        scheduledEndTime: endTime,
        subject: '测试导出'
      });

      const schedules = await scheduleService.getSchedules();
      const excelBuffer = exportService.exportToExcel(schedules);
      expect(excelBuffer).toBeInstanceOf(Buffer);
      expect(excelBuffer.length).toBeGreaterThan(0);
    });

    it('应该能导出排期数据为CSV', async () => {
      const startTime = new Date();
      startTime.setHours(startTime.getHours() + 2);
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);

      await scheduleService.createSchedule({
        customerId: testCustomer.id,
        personInChargeId: testPerson.id,
        visitType: VisitType.COMPLAINT_HANDLING,
        visitChannel: VisitChannel.ONSITE,
        scheduledStartTime: startTime,
        scheduledEndTime: endTime,
        subject: '投诉处理回访'
      });

      const schedules = await scheduleService.getSchedules();
      const csv = exportService.exportToCSV(schedules);
      expect(csv).toContain('排期编号');
      expect(csv).toContain('投诉处理回访');
    });
  });

  describe('2. 状态推进和防重复测试', () => {
    it('应该能按顺序推进排期状态', async () => {
      const startTime = new Date();
      startTime.setHours(startTime.getHours() + 1);
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);

      const schedule = await scheduleService.createSchedule({
        customerId: testCustomer.id,
        personInChargeId: testPerson.id,
        visitType: VisitType.REGULAR_FOLLOWUP,
        visitChannel: VisitChannel.PHONE,
        scheduledStartTime: startTime,
        scheduledEndTime: endTime,
        subject: '状态测试'
      });

      expect(schedule.status).toBe(VisitStatus.SCHEDULED);

      const confirmed = await scheduleService.confirmByPerson(schedule.id, 'lisi');
      expect(confirmed.status).toBe(VisitStatus.CONFIRMED);
      expect(confirmed.isConfirmedByPerson).toBe(true);

      const inProgress = await scheduleService.advanceStatus(
        schedule.id,
        VisitStatus.IN_PROGRESS,
        'operator1',
        '开始回访'
      );
      expect(inProgress.status).toBe(VisitStatus.IN_PROGRESS);

      const completed = await scheduleService.advanceStatus(
        schedule.id,
        VisitStatus.COMPLETED,
        'operator1',
        '回访完成'
      );
      expect(completed.status).toBe(VisitStatus.COMPLETED);
    });

    it('重复确认应该抛出错误', async () => {
      const startTime = new Date();
      startTime.setHours(startTime.getHours() + 1);
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);

      const schedule = await scheduleService.createSchedule({
        customerId: testCustomer.id,
        personInChargeId: testPerson.id,
        visitType: VisitType.REGULAR_FOLLOWUP,
        visitChannel: VisitChannel.PHONE,
        scheduledStartTime: startTime,
        scheduledEndTime: endTime,
        subject: '重复确认测试'
      });

      await scheduleService.confirmByPerson(schedule.id, 'lisi');

      await expect(
        scheduleService.confirmByPerson(schedule.id, 'lisi')
      ).rejects.toThrow('当前状态 CONFIRMED 无法确认');
    });

    it('重复推进同一状态应该抛出错误', async () => {
      const startTime = new Date();
      startTime.setHours(startTime.getHours() + 1);
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);

      const schedule = await scheduleService.createSchedule({
        customerId: testCustomer.id,
        personInChargeId: testPerson.id,
        visitType: VisitType.REGULAR_FOLLOWUP,
        visitChannel: VisitChannel.PHONE,
        scheduledStartTime: startTime,
        scheduledEndTime: endTime,
        subject: '重复推进测试'
      });

      await scheduleService.confirmByPerson(schedule.id, 'lisi');
      await scheduleService.advanceStatus(schedule.id, VisitStatus.IN_PROGRESS, 'operator1');

      await expect(
        scheduleService.advanceStatus(schedule.id, VisitStatus.IN_PROGRESS, 'operator1')
      ).rejects.toThrow('无法从 IN_PROGRESS 状态转换到 IN_PROGRESS');
    });

    it('非法状态转换应该抛出错误', async () => {
      const startTime = new Date();
      startTime.setHours(startTime.getHours() + 1);
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);

      const schedule = await scheduleService.createSchedule({
        customerId: testCustomer.id,
        personInChargeId: testPerson.id,
        visitType: VisitType.REGULAR_FOLLOWUP,
        visitChannel: VisitChannel.PHONE,
        scheduledStartTime: startTime,
        scheduledEndTime: endTime,
        subject: '非法转换测试'
      });

      await expect(
        scheduleService.advanceStatus(schedule.id, VisitStatus.COMPLETED, 'operator1')
      ).rejects.toThrow('无法从 SCHEDULED 状态转换到 COMPLETED');
    });
  });

  describe('3. 时间冲突检查', () => {
    it('同一负责人时间重叠应该检测到冲突', async () => {
      const startTime1 = new Date();
      startTime1.setHours(startTime1.getHours() + 2);
      const endTime1 = new Date(startTime1.getTime() + 60 * 60 * 1000);

      await scheduleService.createSchedule({
        customerId: testCustomer.id,
        personInChargeId: testPerson.id,
        visitType: VisitType.REGULAR_FOLLOWUP,
        visitChannel: VisitChannel.PHONE,
        scheduledStartTime: startTime1,
        scheduledEndTime: endTime1,
        subject: '第一个排期'
      });

      const startTime2 = new Date(startTime1.getTime() + 30 * 60 * 1000);
      const endTime2 = new Date(startTime2.getTime() + 30 * 60 * 1000);

      await expect(
        scheduleService.createSchedule({
          customerId: testCustomer.id,
          personInChargeId: testPerson.id,
          visitType: VisitType.NEW_CUSTOMER,
          visitChannel: VisitChannel.VIDEO,
          scheduledStartTime: startTime2,
          scheduledEndTime: endTime2,
          subject: '冲突排期'
        })
      ).rejects.toThrow('时间冲突');
    });

    it('不同负责人同一时间不应检测到冲突', async () => {
      const person2 = await masterService.createPersonInCharge({
        employeeId: 'EMP002',
        name: '王五',
        department: '客户成功部'
      });

      const startTime = new Date();
      startTime.setHours(startTime.getHours() + 2);
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

      await scheduleService.createSchedule({
        customerId: testCustomer.id,
        personInChargeId: testPerson.id,
        visitType: VisitType.REGULAR_FOLLOWUP,
        visitChannel: VisitChannel.PHONE,
        scheduledStartTime: startTime,
        scheduledEndTime: endTime,
        subject: '李四的排期'
      });

      const schedule2 = await scheduleService.createSchedule({
        customerId: testCustomer.id,
        personInChargeId: person2.id,
        visitType: VisitType.NEW_CUSTOMER,
        visitChannel: VisitChannel.VIDEO,
        scheduledStartTime: startTime,
        scheduledEndTime: endTime,
        subject: '王五的排期'
      });

      expect(schedule2).toBeDefined();
    });
  });

  describe('4. 异常处理流程', () => {
    it('应该能创建延期记录', async () => {
      const startTime = new Date();
      startTime.setHours(startTime.getHours() + 1);
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);

      const schedule = await scheduleService.createSchedule({
        customerId: testCustomer.id,
        personInChargeId: testPerson.id,
        visitType: VisitType.REGULAR_FOLLOWUP,
        visitChannel: VisitChannel.PHONE,
        scheduledStartTime: startTime,
        scheduledEndTime: endTime,
        subject: '延期测试'
      });

      const newTime = new Date(startTime.getTime() + 24 * 60 * 60 * 1000);
      const delayRecord = await scheduleService.createDelayRecord(schedule.id, {
        reason: 'CUSTOMER_UNAVAILABLE' as any,
        reasonDescription: '客户临时有事，申请延期一天',
        newScheduledTime: newTime,
        requestedBy: 'customer_service'
      });

      expect(delayRecord).toBeDefined();
      expect(delayRecord.visitScheduleId).toBe(schedule.id);

      const updatedSchedule = await scheduleService.getScheduleById(schedule.id);
      expect(updatedSchedule?.status).toBe(VisitStatus.DELAYED);
    });

    it('应该能人工修正排期信息', async () => {
      const startTime = new Date();
      startTime.setHours(startTime.getHours() + 1);
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);

      const schedule = await scheduleService.createSchedule({
        customerId: testCustomer.id,
        personInChargeId: testPerson.id,
        visitType: VisitType.REGULAR_FOLLOWUP,
        visitChannel: VisitChannel.PHONE,
        scheduledStartTime: startTime,
        scheduledEndTime: endTime,
        subject: '原始主题'
      });

      const updated = await scheduleService.manualUpdate(
        schedule.id,
        {
          subject: '修正后的主题',
          visitType: VisitType.CONTRACT_RENEWAL
        },
        'admin'
      );

      expect(updated.subject).toBe('修正后的主题');
      expect(updated.visitType).toBe(VisitType.CONTRACT_RENEWAL);
      expect(updated.lastProcessingBasis).toContain('人工修正');
    });

    it('应该能标记漏访', async () => {
      const startTime = new Date();
      startTime.setHours(startTime.getHours() - 2);
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);

      const schedule = await scheduleService.createSchedule({
        customerId: testCustomer.id,
        personInChargeId: testPerson.id,
        visitType: VisitType.REGULAR_FOLLOWUP,
        visitChannel: VisitChannel.PHONE,
        scheduledStartTime: startTime,
        scheduledEndTime: endTime,
        subject: '漏访测试'
      });

      const missed = await scheduleService.markAsMissed(schedule.id, 'system');
      expect(missed.status).toBe(VisitStatus.MISSED);
    });

    it('应该能取消排期', async () => {
      const startTime = new Date();
      startTime.setHours(startTime.getHours() + 1);
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);

      const schedule = await scheduleService.createSchedule({
        customerId: testCustomer.id,
        personInChargeId: testPerson.id,
        visitType: VisitType.REGULAR_FOLLOWUP,
        visitChannel: VisitChannel.PHONE,
        scheduledStartTime: startTime,
        scheduledEndTime: endTime,
        subject: '取消测试'
      });

      const cancelled = await scheduleService.cancelSchedule(
        schedule.id,
        '客户终止合作',
        'admin'
      );

      expect(cancelled.status).toBe(VisitStatus.CANCELLED);
      expect(cancelled.cancelReason).toBe('客户终止合作');
    });
  });

  describe('5. 回访报告功能', () => {
    it('已完成的排期应该能创建报告', async () => {
      const startTime = new Date();
      startTime.setHours(startTime.getHours() - 2);
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);

      const schedule = await scheduleService.createSchedule({
        customerId: testCustomer.id,
        personInChargeId: testPerson.id,
        visitType: VisitType.REGULAR_FOLLOWUP,
        visitChannel: VisitChannel.PHONE,
        scheduledStartTime: startTime,
        scheduledEndTime: endTime,
        subject: '报告测试'
      });

      await scheduleService.confirmByPerson(schedule.id, 'lisi');
      await scheduleService.advanceStatus(schedule.id, VisitStatus.IN_PROGRESS, 'operator1');
      await scheduleService.advanceStatus(schedule.id, VisitStatus.COMPLETED, 'operator1');

      const report = await scheduleService.createReport(
        schedule.id,
        {
          visitSummary: '回访顺利，客户对产品表示满意',
          customerFeedback: '整体体验良好，希望增加XX功能',
          issuesIdentified: '无重大问题',
          actionItems: '跟进功能需求',
          followUpRequired: '下月例行回访',
          satisfactionScore: 9
        },
        'lisi'
      );

      expect(report).toBeDefined();
      expect(report.reportNumber).toMatch(/^VR\d+/);
      expect(report.visitScheduleId).toBe(schedule.id);
      expect(report.satisfactionScore).toBe(9);
    });

    it('未完成的排期不能创建报告', async () => {
      const startTime = new Date();
      startTime.setHours(startTime.getHours() + 1);
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);

      const schedule = await scheduleService.createSchedule({
        customerId: testCustomer.id,
        personInChargeId: testPerson.id,
        visitType: VisitType.REGULAR_FOLLOWUP,
        visitChannel: VisitChannel.PHONE,
        scheduledStartTime: startTime,
        scheduledEndTime: endTime,
        subject: '未完成排期'
      });

      await expect(
        scheduleService.createReport(schedule.id, {}, 'lisi')
      ).rejects.toThrow('只有已完成的排期才能创建报告');
    });
  });

  describe('6. 原始输入和处理依据记录', () => {
    it('应该保存原始输入数据', async () => {
      const startTime = new Date();
      startTime.setHours(startTime.getHours() + 1);
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);

      const schedule = await scheduleService.createSchedule({
        customerId: testCustomer.id,
        personInChargeId: testPerson.id,
        visitType: VisitType.REGULAR_FOLLOWUP,
        visitChannel: VisitChannel.PHONE,
        scheduledStartTime: startTime,
        scheduledEndTime: endTime,
        subject: '原始输入测试',
        createdBy: 'tester'
      });

      expect(schedule.originalInput).toBeDefined();
      expect(schedule.originalInput.subject).toBe('原始输入测试');
      expect(schedule.originalInput.createdBy).toBe('tester');
    });

    it('每次操作应该记录处理依据', async () => {
      const startTime = new Date();
      startTime.setHours(startTime.getHours() + 1);
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);

      const schedule = await scheduleService.createSchedule({
        customerId: testCustomer.id,
        personInChargeId: testPerson.id,
        visitType: VisitType.REGULAR_FOLLOWUP,
        visitChannel: VisitChannel.PHONE,
        scheduledStartTime: startTime,
        scheduledEndTime: endTime,
        subject: '处理依据测试'
      });

      const confirmed = await scheduleService.confirmByPerson(schedule.id, 'lisi');
      expect(confirmed.lastProcessingBasis).toContain('确认排期');

      const cancelled = await scheduleService.cancelSchedule(
        schedule.id,
        '测试原因',
        'admin'
      );
      expect(cancelled.lastProcessingBasis).toContain('测试原因');
    });
  });
});

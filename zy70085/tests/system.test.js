const { sequelize, RoadSection, FineRule } = require('../src/models');
const { initializeDatabase } = require('../src/app');
const {
  ApplicationService, ExtensionService, WithdrawalService,
  FineService, FineRuleService, TaskService,
  StatusManager, StateConsistencyService
} = require('../src/services');
const {
  ApplicationStatus, ExtensionStatus, WithdrawalStatus,
  FineStatus, TaskStatus, TaskType
} = require('../src/constants/status');
const fs = require('fs');
const path = require('path');

async function createTestRoadSection() {
  return await RoadSection.create({
    roadName: '测试大道',
    sectionName: 'K0+000-K0+500',
    startMileage: 0,
    endMileage: 500,
    totalLength: 500,
    availableLength: 500,
    lanes: 4,
    roadClass: '主干道',
    status: 'AVAILABLE'
  });
}

async function createTestApplication(roadSectionId, options = {}) {
  const now = new Date();
  const startDate = new Date(now);
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + (options.days || 30));

  return await ApplicationService.createDraft({
    contractorId: 'TEST001',
    contractorName: '测试施工单位',
    projectName: options.projectName || '测试施工项目',
    projectType: '管道维修',
    roadSectionId,
    occupiedLength: options.occupiedLength || 100,
    occupiedLanes: 1,
    startDate,
    endDate,
    purpose: '测试申请'
  }, 'test-operator');
}

async function createApprovedApplication(roadSectionId) {
  const application = await createTestApplication(roadSectionId);
  await ApplicationService.submitApplication(application.id);
  await ApplicationService.approveApplication(application.id, '审批通过');
  return await ApplicationService.getApplication(application.id);
}

async function createInProgressApplication(roadSectionId) {
  const application = await createApprovedApplication(roadSectionId);
  await ApplicationService.startOccupation(application.id);
  return await ApplicationService.getApplication(application.id);
}

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  const dbPath = path.join(__dirname, '../data/road_approval_test.sqlite');
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
  await initializeDatabase();
});

afterAll(async () => {
  await sequelize.close();
});

describe('StatusManager - 状态机测试', () => {
  test('应该允许合法的状态转换', async () => {
    const isValid = await StatusManager.validateApplicationTransition(
      ApplicationStatus.DRAFT,
      ApplicationStatus.SUBMITTED
    );
    expect(isValid).toBe(true);
  });

  test('应该拒绝非法的状态转换', async () => {
    const isValid = await StatusManager.validateApplicationTransition(
      ApplicationStatus.COMPLETED,
      ApplicationStatus.IN_PROGRESS
    );
    expect(isValid).toBe(false);
  });

  test('应该正确获取允许的转换列表', () => {
    const allowed = StatusManager.getApplicationAllowedTransitions(ApplicationStatus.DRAFT);
    expect(allowed).toContain(ApplicationStatus.SUBMITTED);
    expect(allowed).toContain(ApplicationStatus.CANCELLED);
  });
});

describe('ApplicationService - 占道申请主流程', () => {
  let roadSection;

  beforeEach(async () => {
    roadSection = await createTestRoadSection();
  });

  test('应该创建申请草稿', async () => {
    const application = await createTestApplication(roadSection.id);

    expect(application).toBeDefined();
    expect(application.applicationNo).toBeDefined();
    expect(application.status).toBe(ApplicationStatus.DRAFT);
    expect(application.contractorId).toBe('TEST001');
  });

  test('应该提交申请', async () => {
    const application = await createTestApplication(roadSection.id);

    const submitted = await ApplicationService.submitApplication(application.id);
    expect(submitted.status).toBe(ApplicationStatus.SUBMITTED);
    expect(submitted.submittedAt).toBeDefined();
  });

  test('应该审批通过申请并占用路段资源', async () => {
    const application = await createTestApplication(roadSection.id);
    await ApplicationService.submitApplication(application.id);

    const approved = await ApplicationService.approveApplication(application.id, '同意审批');

    expect(approved.status).toBe(ApplicationStatus.APPROVED);
    expect(approved.approvedAt).toBeDefined();

    const updatedRoadSection = await RoadSection.findByPk(roadSection.id);
    expect(updatedRoadSection.availableLength).toBe(400);
    expect(updatedRoadSection.status).toBe('PARTIALLY_OCCUPIED');
  });

  test('应该开始占道施工', async () => {
    const application = await createTestApplication(roadSection.id);
    await ApplicationService.submitApplication(application.id);
    await ApplicationService.approveApplication(application.id);

    const inProgress = await ApplicationService.startOccupation(application.id);
    expect(inProgress.status).toBe(ApplicationStatus.IN_PROGRESS);
  });

  test('应该拒绝从草稿直接进入进行中状态', async () => {
    const application = await createTestApplication(roadSection.id);

    await expect(
      ApplicationService.startOccupation(application.id)
    ).rejects.toThrow();
  });

  test('应该撤销申请并释放路段资源', async () => {
    const application = await createTestApplication(roadSection.id);
    await ApplicationService.submitApplication(application.id);
    await ApplicationService.approveApplication(application.id);

    const cancelled = await ApplicationService.cancelApplication(application.id);
    expect(cancelled.status).toBe(ApplicationStatus.CANCELLED);

    const updatedRoadSection = await RoadSection.findByPk(roadSection.id);
    expect(updatedRoadSection.availableLength).toBe(500);
  });
});

describe('ExtensionService - 延期审批流程', () => {
  let roadSection;

  beforeEach(async () => {
    roadSection = await createTestRoadSection();
  });

  test('应该创建延期申请', async () => {
    const application = await createInProgressApplication(roadSection.id);

    const extensionDate = new Date(application.endDate);
    extensionDate.setDate(extensionDate.getDate() + 15);

    const extension = await ExtensionService.createExtension(
      application.id,
      {
        requestedEndDate: extensionDate,
        reason: '施工进度延误'
      }
    );

    expect(extension).toBeDefined();
    expect(extension.status).toBe(ExtensionStatus.PENDING);
    expect(extension.extensionDays).toBe(15);

    const updatedApplication = await ApplicationService.getApplication(application.id);
    expect(updatedApplication.status).toBe(ApplicationStatus.EXTENSION_PENDING);
    expect(updatedApplication.hasActiveExtension).toBe(true);
  });

  test('应该拒绝重复的延期申请', async () => {
    const application = await createInProgressApplication(roadSection.id);

    const extensionDate = new Date(application.endDate);
    extensionDate.setDate(extensionDate.getDate() + 15);

    await ExtensionService.createExtension(
      application.id,
      { requestedEndDate: extensionDate, reason: '第一次延期' }
    );

    await expect(
      ExtensionService.createExtension(
        application.id,
        { requestedEndDate: extensionDate, reason: '第二次延期' }
      )
    ).rejects.toThrow();
  });

  test('应该审批通过延期申请', async () => {
    const application = await createInProgressApplication(roadSection.id);
    const originalEndDate = new Date(application.endDate);

    const extensionDate = new Date(originalEndDate);
    extensionDate.setDate(extensionDate.getDate() + 15);

    const extension = await ExtensionService.createExtension(
      application.id,
      { requestedEndDate: extensionDate, reason: '施工延误' }
    );

    const result = await ExtensionService.approveExtension(extension.id, '同意延期');

    expect(result.extension.status).toBe(ExtensionStatus.APPROVED);
    expect(result.application.endDate.getTime()).toBe(extensionDate.getTime());
    expect(result.application.status).toBe(ApplicationStatus.IN_PROGRESS);
  });

  test('应该拒绝延期申请', async () => {
    const application = await createInProgressApplication(roadSection.id);
    const originalEndDate = new Date(application.endDate);

    const extensionDate = new Date(originalEndDate);
    extensionDate.setDate(extensionDate.getDate() + 15);

    const extension = await ExtensionService.createExtension(
      application.id,
      { requestedEndDate: extensionDate, reason: '施工延误' }
    );

    const result = await ExtensionService.rejectExtension(extension.id, '理由不充分');

    expect(result.extension.status).toBe(ExtensionStatus.REJECTED);
    expect(result.application.status).toBe(ApplicationStatus.EXTENSION_REJECTED);
    expect(result.application.hasActiveExtension).toBe(false);
  });
});

describe('WithdrawalService - 撤场验收流程', () => {
  let roadSection;

  beforeEach(async () => {
    roadSection = await createTestRoadSection();
  });

  test('应该创建撤场申请', async () => {
    const application = await createInProgressApplication(roadSection.id);

    const withdrawal = await WithdrawalService.createWithdrawal(
      application.id,
      { reason: '施工完成' }
    );

    expect(withdrawal).toBeDefined();
    expect(withdrawal.status).toBe(WithdrawalStatus.PENDING);

    const updatedApplication = await ApplicationService.getApplication(application.id);
    expect(updatedApplication.status).toBe(ApplicationStatus.WITHDRAWAL_PENDING);
    expect(updatedApplication.hasPendingWithdrawal).toBe(true);
  });

  test('应该通过撤场验收并释放路段', async () => {
    const application = await createInProgressApplication(roadSection.id);

    const withdrawal = await WithdrawalService.createWithdrawal(
      application.id,
      { reason: '施工完成' }
    );

    const result = await WithdrawalService.passInspection(
      withdrawal.id,
      { result: '验收合格', score: 95 }
    );

    expect(result.withdrawal.status).toBe(WithdrawalStatus.PASSED);
    expect(result.application.status).toBe(ApplicationStatus.COMPLETED);
    expect(result.application.hasPendingWithdrawal).toBe(false);
    expect(result.application.completedAt).toBeDefined();

    const updatedRoadSection = await RoadSection.findByPk(roadSection.id);
    expect(updatedRoadSection.availableLength).toBe(500);
  });

  test('应该驳回撤场验收并返回进行中状态', async () => {
    const application = await createInProgressApplication(roadSection.id);

    const withdrawal = await WithdrawalService.createWithdrawal(
      application.id,
      { reason: '施工完成' }
    );

    const result = await WithdrawalService.failInspection(
      withdrawal.id,
      {
        result: '需要整改',
        score: 40,
        failureReason: '路面未清理干净',
        requiredRepairs: ['清理路面', '恢复标线']
      }
    );

    expect(result.withdrawal.status).toBe(WithdrawalStatus.FAILED);
    expect(result.application.status).toBe(ApplicationStatus.IN_PROGRESS);
    expect(result.application.hasPendingWithdrawal).toBe(false);
  });

  test('应该支持复检流程', async () => {
    const application = await createInProgressApplication(roadSection.id);

    const withdrawal = await WithdrawalService.createWithdrawal(
      application.id,
      { reason: '施工完成' }
    );

    await WithdrawalService.failInspection(
      withdrawal.id,
      { failureReason: '需要整改' }
    );

    const reinspectResult = await WithdrawalService.requestReinspection(withdrawal.id);

    expect(reinspectResult.withdrawal.status).toBe(WithdrawalStatus.REINSPECTION_PENDING);
    expect(reinspectResult.application.status).toBe(ApplicationStatus.WITHDRAWAL_PENDING);
    expect(reinspectResult.application.hasPendingWithdrawal).toBe(true);

    const passResult = await WithdrawalService.passInspection(
      withdrawal.id,
      { result: '复检通过', score: 90 }
    );

    expect(passResult.withdrawal.status).toBe(WithdrawalStatus.PASSED);
    expect(passResult.application.status).toBe(ApplicationStatus.COMPLETED);
  });
});

describe('FineService - 罚款管理', () => {
  let roadSection;

  beforeEach(async () => {
    roadSection = await createTestRoadSection();
  });

  test('应该签发罚款', async () => {
    const application = await createInProgressApplication(roadSection.id);

    const fine = await FineService.issueFine(
      application.id,
      'SAFETY_GENERAL',
      { reason: '未设置安全警示标志' }
    );

    expect(fine).toBeDefined();
    expect(fine.fineNo).toBeDefined();
    expect(fine.status).toBe(FineStatus.ISSUED);
    expect(parseFloat(fine.totalAmount)).toBeGreaterThan(0);

    const updatedApplication = await ApplicationService.getApplication(application.id);
    expect(updatedApplication.hasActiveFine).toBe(true);
  });

  test('应该支付罚款', async () => {
    const application = await createInProgressApplication(roadSection.id);

    const fine = await FineService.issueFine(
      application.id,
      'SAFETY_GENERAL',
      { reason: '违规操作' }
    );

    const result = await FineService.payFine(fine.id);

    expect(result.fine.status).toBe(FineStatus.PAID);
    expect(result.fine.paidAt).toBeDefined();
    expect(result.fine.isActive).toBe(false);
    expect(result.application.hasActiveFine).toBe(false);
  });

  test('应该豁免罚款', async () => {
    const application = await createInProgressApplication(roadSection.id);

    const fine = await FineService.issueFine(
      application.id,
      'SAFETY_GENERAL',
      { reason: '轻微违规' }
    );

    const result = await FineService.waiveFine(fine.id, '情节轻微，首次警告');

    expect(result.fine.status).toBe(FineStatus.WAIVED);
    expect(result.fine.waivedAt).toBeDefined();
    expect(result.fine.isActive).toBe(false);
  });
});

describe('StateConsistencyService - 状态一致性修复', () => {
  let roadSection;

  beforeEach(async () => {
    roadSection = await createTestRoadSection();
  });

  test('应该检测并修复标志位不一致', async () => {
    const application = await createInProgressApplication(roadSection.id);

    application.hasActiveExtension = true;
    application.hasActiveFine = true;
    await application.save();

    const result = await StateConsistencyService.verifyAndRepairApplication(application.id);

    expect(result.wasModified).toBe(true);
    expect(result.repairs.length).toBeGreaterThan(0);

    const repairedApplication = await ApplicationService.getApplication(application.id);
    expect(repairedApplication.hasActiveExtension).toBe(false);
    expect(repairedApplication.hasActiveFine).toBe(false);
  });
});

describe('TaskService - 后台任务与重试', () => {
  test('应该创建后台任务', async () => {
    const task = await TaskService.createTask(
      TaskType.RECALCULATE_STATUS,
      'OccupationApplication',
      'test-id',
      { applicationId: 'test-id' }
    );

    expect(task).toBeDefined();
    expect(task.status).toBe(TaskStatus.PENDING);
    expect(task.retryCount).toBe(0);
  });

  test('应该支持手动重试失败任务', async () => {
    const task = await TaskService.createTask(
      TaskType.RECALCULATE_STATUS,
      'OccupationApplication',
      'test-id',
      { applicationId: 'test-id' }
    );

    task.status = TaskStatus.FAILED;
    await task.save();

    const retriedTask = await TaskService.retryTask(task.id);

    expect(retriedTask.status).toBe(TaskStatus.RETRYABLE);
    expect(retriedTask.retryCount).toBe(0);
  });
});

describe('ReportService - 监管报表', () => {
  let roadSection;

  beforeEach(async () => {
    roadSection = await createTestRoadSection();
  });

  test('应该生成仪表盘统计', async () => {
    const app1 = await createTestApplication(roadSection.id);
    await ApplicationService.submitApplication(app1.id);

    const app2 = await createInProgressApplication(roadSection.id);

    const { ReportService } = require('../src/services');
    const stats = await ReportService.getDashboardStats();

    expect(stats.summary.totalApplications).toBeGreaterThan(0);
    expect(stats.summary.pendingApprovals).toBeGreaterThanOrEqual(1);
    expect(stats.summary.inProgress).toBeGreaterThanOrEqual(1);
  });

  test('应该生成状态分布报表', async () => {
    await createTestApplication(roadSection.id);

    const { ReportService } = require('../src/services');
    const breakdown = await ReportService.getApplicationStatusBreakdown();

    expect(breakdown.length).toBeGreaterThan(0);
    const draftStatus = breakdown.find(b => b.status === ApplicationStatus.DRAFT);
    expect(draftStatus).toBeDefined();
    expect(draftStatus.count).toBeGreaterThanOrEqual(1);
  });
});

describe('完整业务流程测试', () => {
  let roadSection;

  beforeEach(async () => {
    roadSection = await createTestRoadSection();
  });

  test('应该完成从申请到撤场的完整流程', async () => {
    const application = await createTestApplication(roadSection.id, {
      projectName: '完整流程测试项目',
      days: 10
    });
    expect(application.status).toBe(ApplicationStatus.DRAFT);

    await ApplicationService.submitApplication(application.id);
    let app = await ApplicationService.getApplication(application.id);
    expect(app.status).toBe(ApplicationStatus.SUBMITTED);

    await ApplicationService.approveApplication(application.id, '同意审批');
    app = await ApplicationService.getApplication(application.id);
    expect(app.status).toBe(ApplicationStatus.APPROVED);

    await ApplicationService.startOccupation(application.id);
    app = await ApplicationService.getApplication(application.id);
    expect(app.status).toBe(ApplicationStatus.IN_PROGRESS);

    const extensionDate = new Date(app.endDate);
    extensionDate.setDate(extensionDate.getDate() + 5);
    const extension = await ExtensionService.createExtension(
      application.id,
      { requestedEndDate: extensionDate, reason: '需要延期' }
    );
    await ExtensionService.approveExtension(extension.id);
    app = await ApplicationService.getApplication(application.id);
    expect(app.status).toBe(ApplicationStatus.IN_PROGRESS);

    const withdrawal = await WithdrawalService.createWithdrawal(
      application.id,
      { reason: '全部完工' }
    );
    await WithdrawalService.passInspection(withdrawal.id, { result: '验收合格', score: 95 });

    app = await ApplicationService.getApplication(application.id);
    expect(app.status).toBe(ApplicationStatus.COMPLETED);

    const finalRoadSection = await RoadSection.findByPk(roadSection.id);
    expect(finalRoadSection.availableLength).toBe(500);
  });

  test('应该处理延期被拒后的撤场流程', async () => {
    const application = await createInProgressApplication(roadSection.id);

    const extensionDate = new Date(application.endDate);
    extensionDate.setDate(extensionDate.getDate() + 10);
    const extension = await ExtensionService.createExtension(
      application.id,
      { requestedEndDate: extensionDate, reason: '申请延期' }
    );

    await ExtensionService.rejectExtension(extension.id, '不允许延期');

    let app = await ApplicationService.getApplication(application.id);
    expect(app.status).toBe(ApplicationStatus.EXTENSION_REJECTED);

    const withdrawal = await WithdrawalService.createWithdrawal(
      application.id,
      { reason: '必须撤场' }
    );
    await WithdrawalService.passInspection(withdrawal.id, { result: '验收通过' });

    app = await ApplicationService.getApplication(application.id);
    expect(app.status).toBe(ApplicationStatus.COMPLETED);
  });

  test('应该处理撤场失败后的整改和复检', async () => {
    const application = await createInProgressApplication(roadSection.id);

    const withdrawal = await WithdrawalService.createWithdrawal(
      application.id,
      { reason: '施工完成' }
    );

    await WithdrawalService.failInspection(
      withdrawal.id,
      { failureReason: '需要整改' }
    );

    let app = await ApplicationService.getApplication(application.id);
    expect(app.status).toBe(ApplicationStatus.IN_PROGRESS);

    await WithdrawalService.requestReinspection(withdrawal.id);
    await WithdrawalService.passInspection(withdrawal.id, { result: '整改完成' });

    app = await ApplicationService.getApplication(application.id);
    expect(app.status).toBe(ApplicationStatus.COMPLETED);
  });
});

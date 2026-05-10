import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Vulnerability } from '../src/entities/Vulnerability';
import { Assignment } from '../src/entities/Assignment';
import { StatusLog } from '../src/entities/StatusLog';
import { Batch } from '../src/entities/Batch';
import { UpgradeTask } from '../src/entities/UpgradeTask';
import { DelayRequest } from '../src/entities/DelayRequest';
import { RiskItem } from '../src/entities/RiskItem';
import {
  VulnerabilityService,
  BatchService,
  DelayService,
  RiskService
} from '../src/services';
import { VulnerabilityStatus, Severity, RiskLevel } from '../src/types';

let dataSource: DataSource;
let vulnerabilityService: VulnerabilityService;
let batchService: BatchService;
let delayService: DelayService;
let riskService: RiskService;

beforeAll(async () => {
  dataSource = new DataSource({
    type: 'sqlite',
    database: ':memory:',
    synchronize: true,
    logging: false,
    entities: [
      Vulnerability,
      Assignment,
      StatusLog,
      Batch,
      UpgradeTask,
      DelayRequest,
      RiskItem
    ]
  });

  await dataSource.initialize();

  vulnerabilityService = new VulnerabilityService(
    dataSource.getRepository(Vulnerability),
    dataSource.getRepository(Assignment),
    dataSource.getRepository(StatusLog)
  );

  batchService = new BatchService(
    dataSource.getRepository(Batch),
    dataSource.getRepository(Vulnerability),
    dataSource.getRepository(UpgradeTask)
  );

  delayService = new DelayService(
    dataSource.getRepository(DelayRequest),
    dataSource.getRepository(RiskItem),
    dataSource.getRepository(Vulnerability)
  );

  riskService = new RiskService(
    dataSource.getRepository(RiskItem),
    dataSource.getRepository(Vulnerability)
  );
});

afterAll(async () => {
  if (dataSource.isInitialized) {
    await dataSource.destroy();
  }
});

describe('VulnerabilityService 集成测试', () => {
  describe('正常处理流程', () => {
    it('应该创建漏洞并自动设置修复窗口', async () => {
      const vuln = await vulnerabilityService.createVulnerability({
        cveId: 'CVE-TEST-001',
        packageName: 'log4j',
        packageVersion: '2.14.1',
        description: '测试漏洞',
        severity: Severity.CRITICAL
      });

      expect(vuln.id).toBeDefined();
      expect(vuln.status).toBe(VulnerabilityStatus.NEW);
      expect(vuln.dueDate).toBeDefined();
      expect(vuln.assigneeId).toBeNull();
    });

    it('应该完整执行漏洞修复流程', async () => {
      const vuln = await vulnerabilityService.createVulnerability({
        cveId: 'CVE-TEST-002',
        packageName: 'spring-core',
        packageVersion: '5.3.0',
        description: 'Spring RCE 漏洞',
        severity: Severity.HIGH
      });

      const assignResult = await vulnerabilityService.assignVulnerability(
        vuln.id,
        'user-123',
        '张三',
        '负责该漏洞的修复工作',
        'admin',
        '管理员',
        false
      );

      expect(assignResult.vulnerability.status).toBe(VulnerabilityStatus.ASSIGNED);
      expect(assignResult.vulnerability.assigneeId).toBe('user-123');
      expect(assignResult.assignment.isActive).toBe(true);

      await vulnerabilityService.changeStatus(
        vuln.id,
        VulnerabilityStatus.IN_PROGRESS,
        '开始分析漏洞',
        'user-123',
        '张三',
        false
      );

      const updatedVuln1 = await vulnerabilityService.getVulnerability(vuln.id);
      expect(updatedVuln1?.status).toBe(VulnerabilityStatus.IN_PROGRESS);

      await vulnerabilityService.changeStatus(
        vuln.id,
        VulnerabilityStatus.FIXED,
        '修复完成，PR已合并',
        'user-123',
        '张三',
        false
      );

      const updatedVuln2 = await vulnerabilityService.getVulnerability(vuln.id);
      expect(updatedVuln2?.status).toBe(VulnerabilityStatus.FIXED);
      expect(updatedVuln2?.fixedAt).toBeDefined();

      await vulnerabilityService.changeStatus(
        vuln.id,
        VulnerabilityStatus.DEPLOYED,
        '已上线部署',
        'admin',
        '管理员',
        false
      );

      await vulnerabilityService.changeStatus(
        vuln.id,
        VulnerabilityStatus.CLOSED,
        '验证通过，关闭漏洞',
        'admin',
        '管理员',
        false
      );

      const finalVuln = await vulnerabilityService.getVulnerability(vuln.id);
      expect(finalVuln?.status).toBe(VulnerabilityStatus.CLOSED);
    });

    it('应该记录完整的状态历史', async () => {
      const vuln = await vulnerabilityService.createVulnerability({
        cveId: 'CVE-TEST-003',
        packageName: 'test-pkg',
        packageVersion: '1.0.0',
        description: '测试历史记录',
        severity: Severity.LOW
      });

      await vulnerabilityService.assignVulnerability(
        vuln.id,
        'user-456',
        '李四',
        '测试分配',
        'admin',
        '管理员',
        false
      );

      await vulnerabilityService.changeStatus(
        vuln.id,
        VulnerabilityStatus.IN_PROGRESS,
        '开始处理',
        'user-456',
        '李四',
        false
      );

      const history = await vulnerabilityService.getStatusHistory(vuln.id);
      expect(history.length).toBeGreaterThanOrEqual(2);

      const assignments = await vulnerabilityService.getAssignments(vuln.id);
      expect(assignments.length).toBe(1);
      expect(assignments[0].assigneeId).toBe('user-456');
    });
  });

  describe('异常拦截', () => {
    it('应该阻止重复分配同一负责人', async () => {
      const vuln = await vulnerabilityService.createVulnerability({
        cveId: 'CVE-TEST-004',
        packageName: 'test-pkg-2',
        packageVersion: '1.0.0',
        description: '测试重复分配',
        severity: Severity.LOW
      });

      await vulnerabilityService.assignVulnerability(
        vuln.id,
        'user-789',
        '王五',
        '第一次分配',
        'admin',
        '管理员',
        false
      );

      await expect(
        vulnerabilityService.assignVulnerability(
          vuln.id,
          'user-789',
          '王五',
          '重复分配',
          'admin',
          '管理员',
          false
        )
      ).rejects.toThrow(/重复/);
    });

    it('应该阻止非法状态转换', async () => {
      const vuln = await vulnerabilityService.createVulnerability({
        cveId: 'CVE-TEST-005',
        packageName: 'test-pkg-3',
        packageVersion: '1.0.0',
        description: '测试非法状态转换',
        severity: Severity.LOW
      });

      await expect(
        vulnerabilityService.changeStatus(
          vuln.id,
          VulnerabilityStatus.FIXED,
          '直接跳到已修复',
          'admin',
          '管理员',
          false
        )
      ).rejects.toThrow(/状态转换不允许/);
    });

    it('应该阻止关闭未上线的漏洞', async () => {
      const vuln = await vulnerabilityService.createVulnerability({
        cveId: 'CVE-TEST-006',
        packageName: 'test-pkg-4',
        packageVersion: '1.0.0',
        description: '测试关闭未上线漏洞',
        severity: Severity.LOW
      });

      await vulnerabilityService.assignVulnerability(
        vuln.id,
        'user-111',
        '测试用户',
        '分配',
        'admin',
        '管理员',
        false
      );

      await vulnerabilityService.changeStatus(
        vuln.id,
        VulnerabilityStatus.IN_PROGRESS,
        '进行中',
        'user-111',
        '测试用户',
        false
      );

      await vulnerabilityService.changeStatus(
        vuln.id,
        VulnerabilityStatus.FIXED,
        '已修复',
        'user-111',
        '测试用户',
        false
      );

      await expect(
        vulnerabilityService.changeStatus(
          vuln.id,
          VulnerabilityStatus.CLOSED,
          '直接关闭',
          'admin',
          '管理员',
          false
        )
      ).rejects.toThrow(/只有已上线的漏洞才能关闭/);
    });
  });

  describe('人工修正', () => {
    it('应该允许人工修正非法状态转换并保留历史', async () => {
      const vuln = await vulnerabilityService.createVulnerability({
        cveId: 'CVE-TEST-007',
        packageName: 'test-pkg-5',
        packageVersion: '1.0.0',
        description: '测试人工修正',
        severity: Severity.MEDIUM
      });

      await vulnerabilityService.assignVulnerability(
        vuln.id,
        'user-222',
        '测试用户2',
        '分配',
        'admin',
        '管理员',
        false
      );

      await vulnerabilityService.changeStatus(
        vuln.id,
        VulnerabilityStatus.IN_PROGRESS,
        '进行中',
        'user-222',
        '测试用户2',
        false
      );

      await vulnerabilityService.changeStatus(
        vuln.id,
        VulnerabilityStatus.FIXED,
        '已修复',
        'user-222',
        '测试用户2',
        false
      );

      const result = await vulnerabilityService.changeStatus(
        vuln.id,
        VulnerabilityStatus.IN_PROGRESS,
        '发现修复不完整，需要重新处理 - 管理员人工回退',
        'admin',
        '管理员',
        true
      );

      expect(result.vulnerability.manuallyCorrected).toBe(true);
      expect(result.vulnerability.status).toBe(VulnerabilityStatus.IN_PROGRESS);

      const history = await vulnerabilityService.getStatusHistory(vuln.id);
      const manualLog = history.find(h => h.isManualOverride);
      expect(manualLog).toBeDefined();
      expect(manualLog?.fromStatus).toBe(VulnerabilityStatus.FIXED);
      expect(manualLog?.toStatus).toBe(VulnerabilityStatus.IN_PROGRESS);
    });

    it('统计数据应该包含人工修正计数', async () => {
      const stats = await vulnerabilityService.getStatistics();
      expect(stats.manuallyCorrected).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('BatchService 集成测试', () => {
  it('应该创建批次并添加漏洞', async () => {
    const plannedDate = new Date();
    plannedDate.setDate(plannedDate.getDate() + 14);

    const batch = await batchService.createBatch({
      name: '测试批次',
      code: 'TEST-BATCH-001',
      description: '测试批次描述',
      plannedDate,
      ownerId: 'owner-1',
      ownerName: '批次负责人'
    });

    expect(batch.id).toBeDefined();
    expect(batch.code).toBe('TEST-BATCH-001');

    const vuln1 = await vulnerabilityService.createVulnerability({
      cveId: 'CVE-BATCH-001',
      packageName: 'pkg-a',
      packageVersion: '1.0.0',
      description: '批次漏洞1',
      severity: Severity.HIGH
    });

    const vuln2 = await vulnerabilityService.createVulnerability({
      cveId: 'CVE-BATCH-002',
      packageName: 'pkg-b',
      packageVersion: '1.0.0',
      description: '批次漏洞2',
      severity: Severity.MEDIUM
    });

    await batchService.addVulnerabilityToBatch(batch.id, vuln1.id);
    await batchService.addVulnerabilityToBatch(batch.id, vuln2.id);

    const vulnerabilities = await batchService.getBatchVulnerabilities(batch.id);
    expect(vulnerabilities.length).toBe(2);
  });

  it('应该阻止重复编码的批次', async () => {
    const plannedDate = new Date();
    plannedDate.setDate(plannedDate.getDate() + 7);

    await expect(
      batchService.createBatch({
        name: '重复编码测试',
        code: 'TEST-BATCH-001',
        description: '测试重复编码',
        plannedDate
      })
    ).rejects.toThrow(/已存在/);
  });

  it('应该创建升级任务并自动推进漏洞状态', async () => {
    const vuln = await vulnerabilityService.createVulnerability({
      cveId: 'CVE-TASK-001',
      packageName: 'task-pkg',
      packageVersion: '1.0.0',
      description: '测试升级任务',
      severity: Severity.LOW
    });

    await vulnerabilityService.assignVulnerability(
      vuln.id,
      'user-task',
      '任务处理人',
      '分配',
      'admin',
      '管理员',
      false
    );

    const task = await batchService.createUpgradeTask({
      vulnerabilityId: vuln.id,
      title: '升级依赖包',
      description: '升级到安全版本',
      packageName: 'task-pkg',
      fromVersion: '1.0.0',
      toVersion: '1.1.0',
      assigneeId: 'user-task',
      assigneeName: '任务处理人'
    });

    expect(task.id).toBeDefined();

    const updatedVuln = await vulnerabilityService.getVulnerability(vuln.id);
    expect(updatedVuln?.status).toBe(VulnerabilityStatus.IN_PROGRESS);
  });

  it('完成所有升级任务后应该标记漏洞为已修复', async () => {
    const vuln = await vulnerabilityService.createVulnerability({
      cveId: 'CVE-TASK-002',
      packageName: 'task-pkg-2',
      packageVersion: '1.0.0',
      description: '测试多任务',
      severity: Severity.LOW
    });

    await vulnerabilityService.assignVulnerability(
      vuln.id,
      'user-task-2',
      '任务处理人2',
      '分配',
      'admin',
      '管理员',
      false
    );

    const task1 = await batchService.createUpgradeTask({
      vulnerabilityId: vuln.id,
      title: '任务1',
      description: '第一个任务',
      packageName: 'task-pkg-2',
      fromVersion: '1.0.0',
      toVersion: '1.1.0',
      assigneeId: 'user-task-2',
      assigneeName: '任务处理人2'
    });

    const task2 = await batchService.createUpgradeTask({
      vulnerabilityId: vuln.id,
      title: '任务2',
      description: '第二个任务',
      packageName: 'task-pkg-2',
      fromVersion: '1.0.0',
      toVersion: '1.1.0',
      assigneeId: 'user-task-2',
      assigneeName: '任务处理人2'
    });

    await batchService.completeUpgradeTask(task1.id, '完成任务1');
    const midVuln = await vulnerabilityService.getVulnerability(vuln.id);
    expect(midVuln?.status).toBe(VulnerabilityStatus.IN_PROGRESS);

    await batchService.completeUpgradeTask(task2.id, '完成任务2');
    const finalVuln = await vulnerabilityService.getVulnerability(vuln.id);
    expect(finalVuln?.status).toBe(VulnerabilityStatus.FIXED);
  });
});

describe('DelayService 集成测试', () => {
  it('应该创建延期申请并在审批后更新漏洞', async () => {
    const vuln = await vulnerabilityService.createVulnerability({
      cveId: 'CVE-DELAY-001',
      packageName: 'delay-pkg',
      packageVersion: '1.0.0',
      description: '测试延期',
      severity: Severity.HIGH
    });

    await vulnerabilityService.assignVulnerability(
      vuln.id,
      'user-delay',
      '延期申请人',
      '分配',
      'admin',
      '管理员',
      false
    );

    await vulnerabilityService.changeStatus(
      vuln.id,
      VulnerabilityStatus.IN_PROGRESS,
      '开始处理',
      'user-delay',
      '延期申请人',
      false
    );

    const originalDueDate = vuln.dueDate!;
    const newDueDate = new Date(originalDueDate);
    newDueDate.setDate(newDueDate.getDate() + 10);

    const delayResult = await delayService.createDelayRequest(
      vuln.id,
      'user-delay',
      '延期申请人',
      newDueDate,
      '需要协调多个团队进行测试，预计需要额外的时间来确保质量',
      '期间将使用临时防护措施和监控机制来减少风险暴露',
      false
    );

    expect(delayResult.request.id).toBeDefined();

    await delayService.approveDelayRequest(
      delayResult.request.id,
      'admin',
      '管理员',
      '同意延期'
    );

    const updatedVuln = await vulnerabilityService.getVulnerability(vuln.id);
    expect(updatedVuln?.status).toBe(VulnerabilityStatus.DELAYED);
    expect(updatedVuln?.delayCount).toBe(1);
    expect(updatedVuln?.dueDate?.toDateString()).toBe(newDueDate.toDateString());
  });

  it('应该阻止同一漏洞的多个待审批延期申请', async () => {
    const vuln = await vulnerabilityService.createVulnerability({
      cveId: 'CVE-DELAY-002',
      packageName: 'delay-pkg-2',
      packageVersion: '1.0.0',
      description: '测试重复延期',
      severity: Severity.MEDIUM
    });

    await vulnerabilityService.assignVulnerability(
      vuln.id,
      'user-delay-2',
      '延期申请人2',
      '分配',
      'admin',
      '管理员',
      false
    );

    await vulnerabilityService.changeStatus(
      vuln.id,
      VulnerabilityStatus.IN_PROGRESS,
      '开始处理',
      'user-delay-2',
      '延期申请人2',
      false
    );

    const newDueDate = new Date();
    newDueDate.setDate(newDueDate.getDate() + 45);

    await delayService.createDelayRequest(
      vuln.id,
      'user-delay-2',
      '延期申请人2',
      newDueDate,
      '需要协调多个团队进行测试，预计需要额外的时间',
      '期间将使用临时防护措施和监控机制来减少风险暴露',
      false
    );

    await expect(
      delayService.createDelayRequest(
        vuln.id,
        'user-delay-2',
        '延期申请人2',
        newDueDate,
        '又需要更多时间来完成修复工作和测试验证',
        '继续使用临时防护措施和增强的监控机制',
        false
      )
    ).rejects.toThrow(/已有待审批的延期申请/);
  });
});

describe('RiskService 集成测试', () => {
  it('应该创建风险项并更新状态', async () => {
    const risk = await riskService.createRiskItem({
      title: '测试风险项',
      description: '这是一个测试风险项',
      level: RiskLevel.HIGH,
      mitigationPlan: '制定缓解计划',
      ownerId: 'risk-owner',
      ownerName: '风险负责人'
    });

    expect(risk.id).toBeDefined();
    expect(risk.status).toBe('OPEN');

    const updatedRisk = await riskService.updateRiskStatus(
      risk.id,
      'MITIGATED' as any,
      '风险已缓解',
      'admin',
      '管理员'
    );

    expect(updatedRisk.status).toBe('MITIGATED');
    expect(updatedRisk.resolvedAt).toBeDefined();
  });

  it('应该获取风险看板数据', async () => {
    await riskService.createRiskItem({
      title: '看板测试风险1',
      description: '测试风险',
      level: RiskLevel.EXTREME,
      mitigationPlan: '缓解计划'
    });

    await riskService.createRiskItem({
      title: '看板测试风险2',
      description: '测试风险',
      level: RiskLevel.MEDIUM,
      mitigationPlan: '缓解计划'
    });

    const dashboard = await riskService.getRiskDashboard();
    expect(dashboard.summary.total).toBeGreaterThanOrEqual(2);
    expect(dashboard.topRisks.length).toBeGreaterThan(0);
    expect(dashboard.recentlyAdded.length).toBeGreaterThan(0);
  });
});

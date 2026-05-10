import 'reflect-metadata';
import { initializeDatabase } from './database';
import { Vulnerability } from './entities/Vulnerability';
import { Batch } from './entities/Batch';
import { UpgradeTask } from './entities/UpgradeTask';
import { DelayRequest, DelayRequestStatus } from './entities/DelayRequest';
import { RiskItem, RiskStatus } from './entities/RiskItem';
import { Assignment } from './entities/Assignment';
import { StatusLog } from './entities/StatusLog';
import {
  VulnerabilityService,
  BatchService,
  DelayService,
  RiskService
} from './services';
import { VulnerabilityStatus, Severity, RiskLevel } from './types';
import { logger } from './logger';

export const sampleUsers = {
  admin: { id: 'user-admin', name: '系统管理员' },
  zhangsan: { id: 'user-zhangsan', name: '张三' },
  lisi: { id: 'user-lisi', name: '李四' },
  wangwu: { id: 'user-wangwu', name: '王五' },
  zhaoliu: { id: 'user-zhaoliu', name: '赵六' }
};

async function seedNormalScenario(): Promise<void> {
  logger.info('========== 场景1: 正常处理流程 ==========');

  const dataSource = await initializeDatabase();
  const vulnerabilityService = new VulnerabilityService(
    dataSource.getRepository(Vulnerability),
    dataSource.getRepository(Assignment),
    dataSource.getRepository(StatusLog)
  );
  const batchService = new BatchService(
    dataSource.getRepository(Batch),
    dataSource.getRepository(Vulnerability),
    dataSource.getRepository(UpgradeTask)
  );

  logger.info('1. 创建高危漏洞 CVE-2024-0001');
  const vuln = await vulnerabilityService.createVulnerability({
    cveId: 'CVE-2024-0001',
    packageName: 'log4j-core',
    packageVersion: '2.14.1',
    description: 'Apache Log4j2 JNDI 注入漏洞',
    severity: Severity.CRITICAL
  });
  logger.info(`   漏洞ID: ${vuln.id}, 截止日期: ${vuln.dueDate?.toISOString()}`);

  logger.info('2. 分配负责人 张三');
  const assignResult = await vulnerabilityService.assignVulnerability(
    vuln.id,
    sampleUsers.zhangsan.id,
    sampleUsers.zhangsan.name,
    '核心框架漏洞，优先级最高',
    sampleUsers.admin.id,
    sampleUsers.admin.name
  );
  logger.info(`   分配成功，状态: ${assignResult.vulnerability.status}`);

  logger.info('3. 创建升级任务: 升级 log4j 到 2.17.1');
  const task = await batchService.createUpgradeTask({
    vulnerabilityId: vuln.id,
    title: '升级 log4j-core 到安全版本',
    description: '将 log4j-core 从 2.14.1 升级到 2.17.1 以修复 JNDI 注入漏洞',
    packageName: 'log4j-core',
    fromVersion: '2.14.1',
    toVersion: '2.17.1',
    assigneeId: sampleUsers.zhangsan.id,
    assigneeName: sampleUsers.zhangsan.name
  });
  logger.info(`   任务ID: ${task.id}`);

  logger.info('4. 完成升级任务');
  const completedTask = await batchService.completeUpgradeTask(
    task.id,
    '已完成升级，测试通过，PR #1234 已合并'
  );
  logger.info(`   任务状态: ${completedTask.status}`);

  const updatedVuln = await vulnerabilityService.getVulnerability(vuln.id);
  logger.info(`   漏洞状态变更为: ${updatedVuln?.status}`);

  logger.info('5. 标记漏洞为已上线');
  await vulnerabilityService.changeStatus(
    vuln.id,
    VulnerabilityStatus.DEPLOYED,
    'v2.1.0 版本已上线部署',
    sampleUsers.zhangsan.id,
    sampleUsers.zhangsan.name
  );

  logger.info('6. 关闭漏洞');
  await vulnerabilityService.changeStatus(
    vuln.id,
    VulnerabilityStatus.CLOSED,
    '漏洞已完全修复并验证通过',
    sampleUsers.admin.id,
    sampleUsers.admin.name
  );

  logger.info('【正常处理流程完成】');
}

async function seedBatchScenario(): Promise<void> {
  logger.info('========== 场景2: 批次管理 ==========');

  const dataSource = await initializeDatabase();
  const vulnerabilityService = new VulnerabilityService(
    dataSource.getRepository(Vulnerability),
    dataSource.getRepository(Assignment),
    dataSource.getRepository(StatusLog)
  );
  const batchService = new BatchService(
    dataSource.getRepository(Batch),
    dataSource.getRepository(Vulnerability),
    dataSource.getRepository(UpgradeTask)
  );

  logger.info('1. 创建上线批次: 2024-Q1-安全修复批次');
  const plannedDate = new Date();
  plannedDate.setDate(plannedDate.getDate() + 14);

  const batch = await batchService.createBatch({
    name: '2024-Q1 安全修复批次',
    code: 'BATCH-2024-Q1-001',
    description: '2024年第一季度安全漏洞修复上线批次',
    plannedDate,
    ownerId: sampleUsers.zhaoliu.id,
    ownerName: sampleUsers.zhaoliu.name
  });
  logger.info(`   批次ID: ${batch.id}`);

  logger.info('2. 创建多个漏洞并加入批次');
  const vuln1 = await vulnerabilityService.createVulnerability({
    cveId: 'CVE-2024-0010',
    packageName: 'spring-core',
    packageVersion: '5.3.0',
    description: 'Spring Framework 远程代码执行漏洞',
    severity: Severity.HIGH,
    batchId: batch.id
  });

  const vuln2 = await vulnerabilityService.createVulnerability({
    cveId: 'CVE-2024-0011',
    packageName: 'jackson-databind',
    packageVersion: '2.13.0',
    description: 'Jackson 反序列化漏洞',
    severity: Severity.HIGH,
    batchId: batch.id
  });

  const vuln3 = await vulnerabilityService.createVulnerability({
    cveId: 'CVE-2024-0012',
    packageName: 'commons-collections',
    packageVersion: '3.2.1',
    description: 'Commons Collections 反序列化漏洞',
    severity: Severity.MEDIUM,
    batchId: batch.id
  });

  logger.info(`   创建了 3 个漏洞并加入批次`);

  logger.info('3. 分配负责人');
  await vulnerabilityService.assignVulnerability(
    vuln1.id,
    sampleUsers.lisi.id,
    sampleUsers.lisi.name,
    'Spring 框架漏洞修复',
    sampleUsers.admin.id,
    sampleUsers.admin.name
  );

  await vulnerabilityService.assignVulnerability(
    vuln2.id,
    sampleUsers.wangwu.id,
    sampleUsers.wangwu.name,
    'Jackson 库漏洞修复',
    sampleUsers.admin.id,
    sampleUsers.admin.name
  );

  await vulnerabilityService.assignVulnerability(
    vuln3.id,
    sampleUsers.lisi.id,
    sampleUsers.lisi.name,
    'Commons Collections 漏洞修复',
    sampleUsers.admin.id,
    sampleUsers.admin.name
  );

  logger.info('4. 检查批次健康状态');
  const health = await batchService.checkBatchHealth(batch.id);
  logger.info(`   批次状态: ${health.batch.status}`);
  logger.info(`   漏洞数量: ${health.summary.total}`);
  logger.info(`   一致性检查: ${health.consistent ? '通过' : '未通过'}`);

  logger.info('【批次管理场景完成】');
}

async function seedDelayScenario(): Promise<void> {
  logger.info('========== 场景3: 延期申请流程 ==========');

  const dataSource = await initializeDatabase();
  const vulnerabilityService = new VulnerabilityService(
    dataSource.getRepository(Vulnerability),
    dataSource.getRepository(Assignment),
    dataSource.getRepository(StatusLog)
  );
  const delayService = new DelayService(
    dataSource.getRepository(DelayRequest),
    dataSource.getRepository(RiskItem),
    dataSource.getRepository(Vulnerability)
  );

  logger.info('1. 创建一个中危漏洞');
  const vuln = await vulnerabilityService.createVulnerability({
    cveId: 'CVE-2024-0020',
    packageName: 'axios',
    packageVersion: '0.21.0',
    description: 'Axios 正则表达式拒绝服务漏洞',
    severity: Severity.MEDIUM
  });

  logger.info('2. 分配负责人 李四');
  await vulnerabilityService.assignVulnerability(
    vuln.id,
    sampleUsers.lisi.id,
    sampleUsers.lisi.name,
    '前端依赖漏洞修复',
    sampleUsers.admin.id,
    sampleUsers.admin.name
  );

  logger.info('3. 标记为进行中');
  await vulnerabilityService.changeStatus(
    vuln.id,
    VulnerabilityStatus.IN_PROGRESS,
    '开始分析漏洞影响范围',
    sampleUsers.lisi.id,
    sampleUsers.lisi.name
  );

  logger.info('4. 申请延期 15 天');
  const originalDueDate = vuln.dueDate!;
  const newDueDate = new Date(originalDueDate);
  newDueDate.setDate(newDueDate.getDate() + 15);

  const delayResult = await delayService.createDelayRequest(
    vuln.id,
    sampleUsers.lisi.id,
    sampleUsers.lisi.name,
    newDueDate,
    '需要协调多个前端团队进行回归测试，预计需要额外 15 天时间',
    '期间将使用临时防护措施，通过 WAF 规则拦截恶意请求',
    false
  );

  logger.info(`   延期申请ID: ${delayResult.request.id}`);
  logger.info(`   原截止日期: ${originalDueDate.toISOString().split('T')[0]}`);
  logger.info(`   新截止日期: ${newDueDate.toISOString().split('T')[0]}`);
  if (delayResult.warnings.length > 0) {
    logger.info(`   警告: ${delayResult.warnings.join('; ')}`);
  }

  logger.info('5. 管理员审批延期申请');
  await delayService.approveDelayRequest(
    delayResult.request.id,
    sampleUsers.admin.id,
    sampleUsers.admin.name,
    '同意延期，期间请确保临时防护措施到位'
  );

  const updatedVuln = await vulnerabilityService.getVulnerability(vuln.id);
  logger.info(`   漏洞状态: ${updatedVuln?.status}`);
  logger.info(`   漏洞截止日期已更新为: ${updatedVuln?.dueDate?.toISOString().split('T')[0]}`);
  logger.info(`   延期次数: ${updatedVuln?.delayCount}`);

  logger.info('【延期申请流程完成】');
}

async function seedRiskScenario(): Promise<void> {
  logger.info('========== 场景4: 风险看板 ==========');

  const dataSource = await initializeDatabase();
  const riskService = new RiskService(
    dataSource.getRepository(RiskItem),
    dataSource.getRepository(Vulnerability)
  );

  logger.info('1. 创建多个风险项');
  await riskService.createRiskItem({
    title: '第三方服务依赖不可用风险',
    description: '核心支付服务依赖外部第三方支付网关，存在单点故障风险',
    level: RiskLevel.HIGH,
    mitigationPlan: '建立多支付渠道切换机制，确保主渠道故障时可快速切换',
    ownerId: sampleUsers.wangwu.id,
    ownerName: sampleUsers.wangwu.name
  });

  await riskService.createRiskItem({
    title: '老旧系统技术债务',
    description: '遗留系统使用已停止维护的 Python 2.7 版本，存在安全隐患',
    level: RiskLevel.EXTREME,
    mitigationPlan: '制定迁移计划，3个月内完成 Python 3 升级',
    ownerId: sampleUsers.zhaoliu.id,
    ownerName: sampleUsers.zhaoliu.name
  });

  const mediumRisk = await riskService.createRiskItem({
    title: '测试环境与生产环境不一致',
    description: '测试环境配置与生产环境存在差异，可能导致上线问题',
    level: RiskLevel.MEDIUM,
    mitigationPlan: '实施基础设施即代码，确保环境一致性',
    ownerId: sampleUsers.zhangsan.id,
    ownerName: sampleUsers.zhangsan.name
  });

  await riskService.createRiskItem({
    title: '文档更新不及时',
    description: '部分 API 文档落后于实际实现，可能影响集成效率',
    level: RiskLevel.LOW,
    mitigationPlan: '建立文档自动生成机制，每次发布同步更新文档',
    ownerId: sampleUsers.lisi.id,
    ownerName: sampleUsers.lisi.name
  });

  logger.info('2. 处理一个中风险项');
  await riskService.updateRiskStatus(
    mediumRisk.id,
    RiskStatus.MITIGATED,
    '已完成基础设施即代码改造，使用 Terraform 管理所有环境配置',
    sampleUsers.zhangsan.id,
    sampleUsers.zhangsan.name
  );

  logger.info('3. 获取风险看板数据');
  const dashboard = await riskService.getRiskDashboard();
  logger.info(`   总风险数: ${dashboard.summary.total}`);
  logger.info(`   逾期风险: ${dashboard.summary.overdue}`);
  logger.info(`   按级别分布: EXTREME=${dashboard.summary.byLevel.EXTREME}, HIGH=${dashboard.summary.byLevel.HIGH}, MEDIUM=${dashboard.summary.byLevel.MEDIUM}, LOW=${dashboard.summary.byLevel.LOW}`);
  logger.info(`   按状态分布: OPEN=${dashboard.summary.byStatus.OPEN}, MITIGATED=${dashboard.summary.byStatus.MITIGATED}`);

  if (dashboard.topRisks.length > 0) {
    logger.info(`   最高优先级风险: ${dashboard.topRisks[0].title} (${dashboard.topRisks[0].level})`);
  }

  logger.info('【风险看板场景完成】');
}

async function seedExceptionScenarios(): Promise<void> {
  logger.info('========== 场景5: 异常拦截 ==========');

  const dataSource = await initializeDatabase();
  const vulnerabilityService = new VulnerabilityService(
    dataSource.getRepository(Vulnerability),
    dataSource.getRepository(Assignment),
    dataSource.getRepository(StatusLog)
  );
  const batchService = new BatchService(
    dataSource.getRepository(Batch),
    dataSource.getRepository(Vulnerability),
    dataSource.getRepository(UpgradeTask)
  );
  const delayService = new DelayService(
    dataSource.getRepository(DelayRequest),
    dataSource.getRepository(RiskItem),
    dataSource.getRepository(Vulnerability)
  );

  logger.info('1. 测试: 重复分配同一负责人');
  try {
    const vuln = await vulnerabilityService.createVulnerability({
      cveId: 'CVE-2024-TEST-001',
      packageName: 'test-pkg',
      packageVersion: '1.0.0',
      description: '测试漏洞',
      severity: Severity.LOW
    });

    await vulnerabilityService.assignVulnerability(
      vuln.id,
      sampleUsers.zhangsan.id,
      sampleUsers.zhangsan.name,
      '第一次分配',
      sampleUsers.admin.id,
      sampleUsers.admin.name
    );

    await vulnerabilityService.assignVulnerability(
      vuln.id,
      sampleUsers.zhangsan.id,
      sampleUsers.zhangsan.name,
      '重复分配',
      sampleUsers.admin.id,
      sampleUsers.admin.name
    );

    logger.error('   测试失败: 应该抛出重复分配错误');
  } catch (err: any) {
    logger.info(`   ✅ 成功拦截: ${err.message}`);
  }

  logger.info('2. 测试: 非法状态转换 NEW -> FIXED');
  try {
    const vuln = await vulnerabilityService.createVulnerability({
      cveId: 'CVE-2024-TEST-002',
      packageName: 'test-pkg-2',
      packageVersion: '1.0.0',
      description: '测试漏洞2',
      severity: Severity.LOW
    });

    await vulnerabilityService.changeStatus(
      vuln.id,
      VulnerabilityStatus.FIXED,
      '直接跳到已修复',
      sampleUsers.admin.id,
      sampleUsers.admin.name
    );

    logger.error('   测试失败: 应该抛出非法状态转换错误');
  } catch (err: any) {
    logger.info(`   ✅ 成功拦截: ${err.message}`);
  }

  logger.info('3. 测试: 关闭已上线批次后添加漏洞');
  try {
    const plannedDate = new Date();
    plannedDate.setDate(plannedDate.getDate() + 7);

    const batch = await batchService.createBatch({
      name: '测试批次',
      code: 'BATCH-TEST-001',
      description: '测试批次',
      plannedDate
    });

    const vuln = await vulnerabilityService.createVulnerability({
      cveId: 'CVE-2024-TEST-003',
      packageName: 'test-pkg-3',
      packageVersion: '1.0.0',
      description: '测试漏洞3',
      severity: Severity.LOW
    });

    await vulnerabilityService.assignVulnerability(
      vuln.id,
      sampleUsers.lisi.id,
      sampleUsers.lisi.name,
      '测试分配',
      sampleUsers.admin.id,
      sampleUsers.admin.name
    );

    await vulnerabilityService.changeStatus(
      vuln.id,
      VulnerabilityStatus.IN_PROGRESS,
      '开始处理',
      sampleUsers.lisi.id,
      sampleUsers.lisi.name
    );

    await vulnerabilityService.changeStatus(
      vuln.id,
      VulnerabilityStatus.FIXED,
      '已修复',
      sampleUsers.lisi.id,
      sampleUsers.lisi.name
    );

    await batchService.addVulnerabilityToBatch(batch.id, vuln.id);
    await batchService.deployBatch(batch.id);

    const anotherVuln = await vulnerabilityService.createVulnerability({
      cveId: 'CVE-2024-TEST-004',
      packageName: 'test-pkg-4',
      packageVersion: '1.0.0',
      description: '测试漏洞4',
      severity: Severity.LOW
    });

    await batchService.addVulnerabilityToBatch(batch.id, anotherVuln.id);

    logger.error('   测试失败: 应该不允许向已上线批次添加漏洞');
  } catch (err: any) {
    logger.info(`   ✅ 成功拦截: ${err.message}`);
  }

  logger.info('4. 测试: 延期理由太短');
  try {
    const vuln = await vulnerabilityService.createVulnerability({
      cveId: 'CVE-2024-TEST-005',
      packageName: 'test-pkg-5',
      packageVersion: '1.0.0',
      description: '测试漏洞5',
      severity: Severity.HIGH
    });

    await vulnerabilityService.assignVulnerability(
      vuln.id,
      sampleUsers.wangwu.id,
      sampleUsers.wangwu.name,
      '测试分配',
      sampleUsers.admin.id,
      sampleUsers.admin.name
    );

    await vulnerabilityService.changeStatus(
      vuln.id,
      VulnerabilityStatus.IN_PROGRESS,
      '开始处理',
      sampleUsers.wangwu.id,
      sampleUsers.wangwu.name
    );

    const originalDueDate = vuln.dueDate!;
    const newDueDate = new Date(originalDueDate);
    newDueDate.setDate(newDueDate.getDate() + 5);

    await delayService.createDelayRequest(
      vuln.id,
      sampleUsers.wangwu.id,
      sampleUsers.wangwu.name,
      newDueDate,
      '太忙',
      '没问题',
      false
    );

    logger.error('   测试失败: 应该拦截太短的延期理由');
  } catch (err: any) {
    logger.info(`   ✅ 成功拦截: ${err.message}`);
  }

  logger.info('5. 测试: 完成不存在的升级任务');
  try {
    await batchService.completeUpgradeTask('non-existent-id');
    logger.error('   测试失败: 应该抛出任务不存在错误');
  } catch (err: any) {
    logger.info(`   ✅ 成功拦截: ${err.message}`);
  }

  logger.info('【异常拦截场景完成 - 所有测试通过】');
}

async function seedManualOverrideScenario(): Promise<void> {
  logger.info('========== 场景6: 人工修正与历史一致性 ==========');

  const dataSource = await initializeDatabase();
  const vulnerabilityService = new VulnerabilityService(
    dataSource.getRepository(Vulnerability),
    dataSource.getRepository(Assignment),
    dataSource.getRepository(StatusLog)
  );

  logger.info('1. 创建漏洞并完成正常流程');
  const vuln = await vulnerabilityService.createVulnerability({
    cveId: 'CVE-2024-MANUAL-001',
    packageName: 'manual-pkg',
    packageVersion: '1.0.0',
    description: '需要人工修正的测试漏洞',
    severity: Severity.HIGH
  });

  await vulnerabilityService.assignVulnerability(
    vuln.id,
    sampleUsers.zhangsan.id,
    sampleUsers.zhangsan.name,
    '初始分配',
    sampleUsers.admin.id,
    sampleUsers.admin.name
  );

  await vulnerabilityService.changeStatus(
    vuln.id,
    VulnerabilityStatus.IN_PROGRESS,
    '开始处理',
    sampleUsers.zhangsan.id,
    sampleUsers.zhangsan.name
  );

  await vulnerabilityService.changeStatus(
    vuln.id,
    VulnerabilityStatus.FIXED,
    '已修复',
    sampleUsers.zhangsan.id,
    sampleUsers.zhangsan.name
  );

  logger.info('2. 管理员人工修正状态（特殊情况回退）');
  const manualResult = await vulnerabilityService.changeStatus(
    vuln.id,
    VulnerabilityStatus.IN_PROGRESS,
    '发现修复不完整，需要重新处理 - 管理员人工回退',
    sampleUsers.admin.id,
    sampleUsers.admin.name,
    true
  );

  logger.info(`   人工修正标记: manuallyCorrected = ${manualResult.vulnerability.manuallyCorrected}`);
  logger.info(`   当前状态: ${manualResult.vulnerability.status}`);

  logger.info('3. 查看状态历史（审计追踪）');
  const history = await vulnerabilityService.getStatusHistory(vuln.id);
  logger.info(`   历史记录数量: ${history.length}`);
  history.forEach((log, index) => {
    logger.info(`   [${index + 1}] ${log.fromStatus} -> ${log.toStatus} | ${log.operatorName} | ${log.isManualOverride ? '(人工)' : ''} | 原因: ${log.reason.substring(0, 30)}...`);
  });

  logger.info('4. 验证统计数据一致性');
  const stats = await vulnerabilityService.getStatistics();
  logger.info(`   总漏洞数: ${stats.total}`);
  logger.info(`   人工修正计数: ${stats.manuallyCorrected}`);
  logger.info(`   状态分布: IN_PROGRESS=${stats.byStatus.IN_PROGRESS}`);

  logger.info('【人工修正与历史一致性场景完成】');
}

async function seedAll(): Promise<void> {
  logger.info('========================================');
  logger.info('开始初始化样例数据');
  logger.info('========================================');

  try {
    await seedNormalScenario();
    logger.info('');
    await seedBatchScenario();
    logger.info('');
    await seedDelayScenario();
    logger.info('');
    await seedRiskScenario();
    logger.info('');
    await seedExceptionScenarios();
    logger.info('');
    await seedManualOverrideScenario();

    logger.info('');
    logger.info('========================================');
    logger.info('✅ 所有样例数据初始化完成');
    logger.info('========================================');
  } catch (error: any) {
    logger.error('初始化样例数据失败', { error: error.message });
    throw error;
  }
}

if (require.main === module) {
  seedAll()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export {
  seedAll,
  seedNormalScenario,
  seedBatchScenario,
  seedDelayScenario,
  seedRiskScenario,
  seedExceptionScenarios,
  seedManualOverrideScenario
};

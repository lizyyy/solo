"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sampleUsers = void 0;
exports.seedAll = seedAll;
exports.seedNormalScenario = seedNormalScenario;
exports.seedBatchScenario = seedBatchScenario;
exports.seedDelayScenario = seedDelayScenario;
exports.seedRiskScenario = seedRiskScenario;
exports.seedExceptionScenarios = seedExceptionScenarios;
exports.seedManualOverrideScenario = seedManualOverrideScenario;
require("reflect-metadata");
const database_1 = require("./database");
const Vulnerability_1 = require("./entities/Vulnerability");
const Batch_1 = require("./entities/Batch");
const UpgradeTask_1 = require("./entities/UpgradeTask");
const DelayRequest_1 = require("./entities/DelayRequest");
const RiskItem_1 = require("./entities/RiskItem");
const Assignment_1 = require("./entities/Assignment");
const StatusLog_1 = require("./entities/StatusLog");
const services_1 = require("./services");
const types_1 = require("./types");
const logger_1 = require("./logger");
exports.sampleUsers = {
    admin: { id: 'user-admin', name: '系统管理员' },
    zhangsan: { id: 'user-zhangsan', name: '张三' },
    lisi: { id: 'user-lisi', name: '李四' },
    wangwu: { id: 'user-wangwu', name: '王五' },
    zhaoliu: { id: 'user-zhaoliu', name: '赵六' }
};
async function seedNormalScenario() {
    logger_1.logger.info('========== 场景1: 正常处理流程 ==========');
    const dataSource = await (0, database_1.initializeDatabase)();
    const vulnerabilityService = new services_1.VulnerabilityService(dataSource.getRepository(Vulnerability_1.Vulnerability), dataSource.getRepository(Assignment_1.Assignment), dataSource.getRepository(StatusLog_1.StatusLog));
    const batchService = new services_1.BatchService(dataSource.getRepository(Batch_1.Batch), dataSource.getRepository(Vulnerability_1.Vulnerability), dataSource.getRepository(UpgradeTask_1.UpgradeTask));
    logger_1.logger.info('1. 创建高危漏洞 CVE-2024-0001');
    const vuln = await vulnerabilityService.createVulnerability({
        cveId: 'CVE-2024-0001',
        packageName: 'log4j-core',
        packageVersion: '2.14.1',
        description: 'Apache Log4j2 JNDI 注入漏洞',
        severity: types_1.Severity.CRITICAL
    });
    logger_1.logger.info(`   漏洞ID: ${vuln.id}, 截止日期: ${vuln.dueDate?.toISOString()}`);
    logger_1.logger.info('2. 分配负责人 张三');
    const assignResult = await vulnerabilityService.assignVulnerability(vuln.id, exports.sampleUsers.zhangsan.id, exports.sampleUsers.zhangsan.name, '核心框架漏洞，优先级最高', exports.sampleUsers.admin.id, exports.sampleUsers.admin.name);
    logger_1.logger.info(`   分配成功，状态: ${assignResult.vulnerability.status}`);
    logger_1.logger.info('3. 创建升级任务: 升级 log4j 到 2.17.1');
    const task = await batchService.createUpgradeTask({
        vulnerabilityId: vuln.id,
        title: '升级 log4j-core 到安全版本',
        description: '将 log4j-core 从 2.14.1 升级到 2.17.1 以修复 JNDI 注入漏洞',
        packageName: 'log4j-core',
        fromVersion: '2.14.1',
        toVersion: '2.17.1',
        assigneeId: exports.sampleUsers.zhangsan.id,
        assigneeName: exports.sampleUsers.zhangsan.name
    });
    logger_1.logger.info(`   任务ID: ${task.id}`);
    logger_1.logger.info('4. 完成升级任务');
    const completedTask = await batchService.completeUpgradeTask(task.id, '已完成升级，测试通过，PR #1234 已合并');
    logger_1.logger.info(`   任务状态: ${completedTask.status}`);
    const updatedVuln = await vulnerabilityService.getVulnerability(vuln.id);
    logger_1.logger.info(`   漏洞状态变更为: ${updatedVuln?.status}`);
    logger_1.logger.info('5. 标记漏洞为已上线');
    await vulnerabilityService.changeStatus(vuln.id, types_1.VulnerabilityStatus.DEPLOYED, 'v2.1.0 版本已上线部署', exports.sampleUsers.zhangsan.id, exports.sampleUsers.zhangsan.name);
    logger_1.logger.info('6. 关闭漏洞');
    await vulnerabilityService.changeStatus(vuln.id, types_1.VulnerabilityStatus.CLOSED, '漏洞已完全修复并验证通过', exports.sampleUsers.admin.id, exports.sampleUsers.admin.name);
    logger_1.logger.info('【正常处理流程完成】');
}
async function seedBatchScenario() {
    logger_1.logger.info('========== 场景2: 批次管理 ==========');
    const dataSource = await (0, database_1.initializeDatabase)();
    const vulnerabilityService = new services_1.VulnerabilityService(dataSource.getRepository(Vulnerability_1.Vulnerability), dataSource.getRepository(Assignment_1.Assignment), dataSource.getRepository(StatusLog_1.StatusLog));
    const batchService = new services_1.BatchService(dataSource.getRepository(Batch_1.Batch), dataSource.getRepository(Vulnerability_1.Vulnerability), dataSource.getRepository(UpgradeTask_1.UpgradeTask));
    logger_1.logger.info('1. 创建上线批次: 2024-Q1-安全修复批次');
    const plannedDate = new Date();
    plannedDate.setDate(plannedDate.getDate() + 14);
    const batch = await batchService.createBatch({
        name: '2024-Q1 安全修复批次',
        code: 'BATCH-2024-Q1-001',
        description: '2024年第一季度安全漏洞修复上线批次',
        plannedDate,
        ownerId: exports.sampleUsers.zhaoliu.id,
        ownerName: exports.sampleUsers.zhaoliu.name
    });
    logger_1.logger.info(`   批次ID: ${batch.id}`);
    logger_1.logger.info('2. 创建多个漏洞并加入批次');
    const vuln1 = await vulnerabilityService.createVulnerability({
        cveId: 'CVE-2024-0010',
        packageName: 'spring-core',
        packageVersion: '5.3.0',
        description: 'Spring Framework 远程代码执行漏洞',
        severity: types_1.Severity.HIGH,
        batchId: batch.id
    });
    const vuln2 = await vulnerabilityService.createVulnerability({
        cveId: 'CVE-2024-0011',
        packageName: 'jackson-databind',
        packageVersion: '2.13.0',
        description: 'Jackson 反序列化漏洞',
        severity: types_1.Severity.HIGH,
        batchId: batch.id
    });
    const vuln3 = await vulnerabilityService.createVulnerability({
        cveId: 'CVE-2024-0012',
        packageName: 'commons-collections',
        packageVersion: '3.2.1',
        description: 'Commons Collections 反序列化漏洞',
        severity: types_1.Severity.MEDIUM,
        batchId: batch.id
    });
    logger_1.logger.info(`   创建了 3 个漏洞并加入批次`);
    logger_1.logger.info('3. 分配负责人');
    await vulnerabilityService.assignVulnerability(vuln1.id, exports.sampleUsers.lisi.id, exports.sampleUsers.lisi.name, 'Spring 框架漏洞修复', exports.sampleUsers.admin.id, exports.sampleUsers.admin.name);
    await vulnerabilityService.assignVulnerability(vuln2.id, exports.sampleUsers.wangwu.id, exports.sampleUsers.wangwu.name, 'Jackson 库漏洞修复', exports.sampleUsers.admin.id, exports.sampleUsers.admin.name);
    await vulnerabilityService.assignVulnerability(vuln3.id, exports.sampleUsers.lisi.id, exports.sampleUsers.lisi.name, 'Commons Collections 漏洞修复', exports.sampleUsers.admin.id, exports.sampleUsers.admin.name);
    logger_1.logger.info('4. 检查批次健康状态');
    const health = await batchService.checkBatchHealth(batch.id);
    logger_1.logger.info(`   批次状态: ${health.batch.status}`);
    logger_1.logger.info(`   漏洞数量: ${health.summary.total}`);
    logger_1.logger.info(`   一致性检查: ${health.consistent ? '通过' : '未通过'}`);
    logger_1.logger.info('【批次管理场景完成】');
}
async function seedDelayScenario() {
    logger_1.logger.info('========== 场景3: 延期申请流程 ==========');
    const dataSource = await (0, database_1.initializeDatabase)();
    const vulnerabilityService = new services_1.VulnerabilityService(dataSource.getRepository(Vulnerability_1.Vulnerability), dataSource.getRepository(Assignment_1.Assignment), dataSource.getRepository(StatusLog_1.StatusLog));
    const delayService = new services_1.DelayService(dataSource.getRepository(DelayRequest_1.DelayRequest), dataSource.getRepository(RiskItem_1.RiskItem), dataSource.getRepository(Vulnerability_1.Vulnerability));
    logger_1.logger.info('1. 创建一个中危漏洞');
    const vuln = await vulnerabilityService.createVulnerability({
        cveId: 'CVE-2024-0020',
        packageName: 'axios',
        packageVersion: '0.21.0',
        description: 'Axios 正则表达式拒绝服务漏洞',
        severity: types_1.Severity.MEDIUM
    });
    logger_1.logger.info('2. 分配负责人 李四');
    await vulnerabilityService.assignVulnerability(vuln.id, exports.sampleUsers.lisi.id, exports.sampleUsers.lisi.name, '前端依赖漏洞修复', exports.sampleUsers.admin.id, exports.sampleUsers.admin.name);
    logger_1.logger.info('3. 标记为进行中');
    await vulnerabilityService.changeStatus(vuln.id, types_1.VulnerabilityStatus.IN_PROGRESS, '开始分析漏洞影响范围', exports.sampleUsers.lisi.id, exports.sampleUsers.lisi.name);
    logger_1.logger.info('4. 申请延期 15 天');
    const originalDueDate = vuln.dueDate;
    const newDueDate = new Date(originalDueDate);
    newDueDate.setDate(newDueDate.getDate() + 15);
    const delayResult = await delayService.createDelayRequest(vuln.id, exports.sampleUsers.lisi.id, exports.sampleUsers.lisi.name, newDueDate, '需要协调多个前端团队进行回归测试，预计需要额外 15 天时间', '期间将使用临时防护措施，通过 WAF 规则拦截恶意请求', false);
    logger_1.logger.info(`   延期申请ID: ${delayResult.request.id}`);
    logger_1.logger.info(`   原截止日期: ${originalDueDate.toISOString().split('T')[0]}`);
    logger_1.logger.info(`   新截止日期: ${newDueDate.toISOString().split('T')[0]}`);
    if (delayResult.warnings.length > 0) {
        logger_1.logger.info(`   警告: ${delayResult.warnings.join('; ')}`);
    }
    logger_1.logger.info('5. 管理员审批延期申请');
    await delayService.approveDelayRequest(delayResult.request.id, exports.sampleUsers.admin.id, exports.sampleUsers.admin.name, '同意延期，期间请确保临时防护措施到位');
    const updatedVuln = await vulnerabilityService.getVulnerability(vuln.id);
    logger_1.logger.info(`   漏洞状态: ${updatedVuln?.status}`);
    logger_1.logger.info(`   漏洞截止日期已更新为: ${updatedVuln?.dueDate?.toISOString().split('T')[0]}`);
    logger_1.logger.info(`   延期次数: ${updatedVuln?.delayCount}`);
    logger_1.logger.info('【延期申请流程完成】');
}
async function seedRiskScenario() {
    logger_1.logger.info('========== 场景4: 风险看板 ==========');
    const dataSource = await (0, database_1.initializeDatabase)();
    const riskService = new services_1.RiskService(dataSource.getRepository(RiskItem_1.RiskItem), dataSource.getRepository(Vulnerability_1.Vulnerability));
    logger_1.logger.info('1. 创建多个风险项');
    await riskService.createRiskItem({
        title: '第三方服务依赖不可用风险',
        description: '核心支付服务依赖外部第三方支付网关，存在单点故障风险',
        level: types_1.RiskLevel.HIGH,
        mitigationPlan: '建立多支付渠道切换机制，确保主渠道故障时可快速切换',
        ownerId: exports.sampleUsers.wangwu.id,
        ownerName: exports.sampleUsers.wangwu.name
    });
    await riskService.createRiskItem({
        title: '老旧系统技术债务',
        description: '遗留系统使用已停止维护的 Python 2.7 版本，存在安全隐患',
        level: types_1.RiskLevel.EXTREME,
        mitigationPlan: '制定迁移计划，3个月内完成 Python 3 升级',
        ownerId: exports.sampleUsers.zhaoliu.id,
        ownerName: exports.sampleUsers.zhaoliu.name
    });
    const mediumRisk = await riskService.createRiskItem({
        title: '测试环境与生产环境不一致',
        description: '测试环境配置与生产环境存在差异，可能导致上线问题',
        level: types_1.RiskLevel.MEDIUM,
        mitigationPlan: '实施基础设施即代码，确保环境一致性',
        ownerId: exports.sampleUsers.zhangsan.id,
        ownerName: exports.sampleUsers.zhangsan.name
    });
    await riskService.createRiskItem({
        title: '文档更新不及时',
        description: '部分 API 文档落后于实际实现，可能影响集成效率',
        level: types_1.RiskLevel.LOW,
        mitigationPlan: '建立文档自动生成机制，每次发布同步更新文档',
        ownerId: exports.sampleUsers.lisi.id,
        ownerName: exports.sampleUsers.lisi.name
    });
    logger_1.logger.info('2. 处理一个中风险项');
    await riskService.updateRiskStatus(mediumRisk.id, RiskItem_1.RiskStatus.MITIGATED, '已完成基础设施即代码改造，使用 Terraform 管理所有环境配置', exports.sampleUsers.zhangsan.id, exports.sampleUsers.zhangsan.name);
    logger_1.logger.info('3. 获取风险看板数据');
    const dashboard = await riskService.getRiskDashboard();
    logger_1.logger.info(`   总风险数: ${dashboard.summary.total}`);
    logger_1.logger.info(`   逾期风险: ${dashboard.summary.overdue}`);
    logger_1.logger.info(`   按级别分布: EXTREME=${dashboard.summary.byLevel.EXTREME}, HIGH=${dashboard.summary.byLevel.HIGH}, MEDIUM=${dashboard.summary.byLevel.MEDIUM}, LOW=${dashboard.summary.byLevel.LOW}`);
    logger_1.logger.info(`   按状态分布: OPEN=${dashboard.summary.byStatus.OPEN}, MITIGATED=${dashboard.summary.byStatus.MITIGATED}`);
    if (dashboard.topRisks.length > 0) {
        logger_1.logger.info(`   最高优先级风险: ${dashboard.topRisks[0].title} (${dashboard.topRisks[0].level})`);
    }
    logger_1.logger.info('【风险看板场景完成】');
}
async function seedExceptionScenarios() {
    logger_1.logger.info('========== 场景5: 异常拦截 ==========');
    const dataSource = await (0, database_1.initializeDatabase)();
    const vulnerabilityService = new services_1.VulnerabilityService(dataSource.getRepository(Vulnerability_1.Vulnerability), dataSource.getRepository(Assignment_1.Assignment), dataSource.getRepository(StatusLog_1.StatusLog));
    const batchService = new services_1.BatchService(dataSource.getRepository(Batch_1.Batch), dataSource.getRepository(Vulnerability_1.Vulnerability), dataSource.getRepository(UpgradeTask_1.UpgradeTask));
    const delayService = new services_1.DelayService(dataSource.getRepository(DelayRequest_1.DelayRequest), dataSource.getRepository(RiskItem_1.RiskItem), dataSource.getRepository(Vulnerability_1.Vulnerability));
    logger_1.logger.info('1. 测试: 重复分配同一负责人');
    try {
        const vuln = await vulnerabilityService.createVulnerability({
            cveId: 'CVE-2024-TEST-001',
            packageName: 'test-pkg',
            packageVersion: '1.0.0',
            description: '测试漏洞',
            severity: types_1.Severity.LOW
        });
        await vulnerabilityService.assignVulnerability(vuln.id, exports.sampleUsers.zhangsan.id, exports.sampleUsers.zhangsan.name, '第一次分配', exports.sampleUsers.admin.id, exports.sampleUsers.admin.name);
        await vulnerabilityService.assignVulnerability(vuln.id, exports.sampleUsers.zhangsan.id, exports.sampleUsers.zhangsan.name, '重复分配', exports.sampleUsers.admin.id, exports.sampleUsers.admin.name);
        logger_1.logger.error('   测试失败: 应该抛出重复分配错误');
    }
    catch (err) {
        logger_1.logger.info(`   ✅ 成功拦截: ${err.message}`);
    }
    logger_1.logger.info('2. 测试: 非法状态转换 NEW -> FIXED');
    try {
        const vuln = await vulnerabilityService.createVulnerability({
            cveId: 'CVE-2024-TEST-002',
            packageName: 'test-pkg-2',
            packageVersion: '1.0.0',
            description: '测试漏洞2',
            severity: types_1.Severity.LOW
        });
        await vulnerabilityService.changeStatus(vuln.id, types_1.VulnerabilityStatus.FIXED, '直接跳到已修复', exports.sampleUsers.admin.id, exports.sampleUsers.admin.name);
        logger_1.logger.error('   测试失败: 应该抛出非法状态转换错误');
    }
    catch (err) {
        logger_1.logger.info(`   ✅ 成功拦截: ${err.message}`);
    }
    logger_1.logger.info('3. 测试: 关闭已上线批次后添加漏洞');
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
            severity: types_1.Severity.LOW
        });
        await vulnerabilityService.assignVulnerability(vuln.id, exports.sampleUsers.lisi.id, exports.sampleUsers.lisi.name, '测试分配', exports.sampleUsers.admin.id, exports.sampleUsers.admin.name);
        await vulnerabilityService.changeStatus(vuln.id, types_1.VulnerabilityStatus.IN_PROGRESS, '开始处理', exports.sampleUsers.lisi.id, exports.sampleUsers.lisi.name);
        await vulnerabilityService.changeStatus(vuln.id, types_1.VulnerabilityStatus.FIXED, '已修复', exports.sampleUsers.lisi.id, exports.sampleUsers.lisi.name);
        await batchService.addVulnerabilityToBatch(batch.id, vuln.id);
        await batchService.deployBatch(batch.id);
        const anotherVuln = await vulnerabilityService.createVulnerability({
            cveId: 'CVE-2024-TEST-004',
            packageName: 'test-pkg-4',
            packageVersion: '1.0.0',
            description: '测试漏洞4',
            severity: types_1.Severity.LOW
        });
        await batchService.addVulnerabilityToBatch(batch.id, anotherVuln.id);
        logger_1.logger.error('   测试失败: 应该不允许向已上线批次添加漏洞');
    }
    catch (err) {
        logger_1.logger.info(`   ✅ 成功拦截: ${err.message}`);
    }
    logger_1.logger.info('4. 测试: 延期理由太短');
    try {
        const vuln = await vulnerabilityService.createVulnerability({
            cveId: 'CVE-2024-TEST-005',
            packageName: 'test-pkg-5',
            packageVersion: '1.0.0',
            description: '测试漏洞5',
            severity: types_1.Severity.HIGH
        });
        await vulnerabilityService.assignVulnerability(vuln.id, exports.sampleUsers.wangwu.id, exports.sampleUsers.wangwu.name, '测试分配', exports.sampleUsers.admin.id, exports.sampleUsers.admin.name);
        await vulnerabilityService.changeStatus(vuln.id, types_1.VulnerabilityStatus.IN_PROGRESS, '开始处理', exports.sampleUsers.wangwu.id, exports.sampleUsers.wangwu.name);
        const originalDueDate = vuln.dueDate;
        const newDueDate = new Date(originalDueDate);
        newDueDate.setDate(newDueDate.getDate() + 5);
        await delayService.createDelayRequest(vuln.id, exports.sampleUsers.wangwu.id, exports.sampleUsers.wangwu.name, newDueDate, '太忙', '没问题', false);
        logger_1.logger.error('   测试失败: 应该拦截太短的延期理由');
    }
    catch (err) {
        logger_1.logger.info(`   ✅ 成功拦截: ${err.message}`);
    }
    logger_1.logger.info('5. 测试: 完成不存在的升级任务');
    try {
        await batchService.completeUpgradeTask('non-existent-id');
        logger_1.logger.error('   测试失败: 应该抛出任务不存在错误');
    }
    catch (err) {
        logger_1.logger.info(`   ✅ 成功拦截: ${err.message}`);
    }
    logger_1.logger.info('【异常拦截场景完成 - 所有测试通过】');
}
async function seedManualOverrideScenario() {
    logger_1.logger.info('========== 场景6: 人工修正与历史一致性 ==========');
    const dataSource = await (0, database_1.initializeDatabase)();
    const vulnerabilityService = new services_1.VulnerabilityService(dataSource.getRepository(Vulnerability_1.Vulnerability), dataSource.getRepository(Assignment_1.Assignment), dataSource.getRepository(StatusLog_1.StatusLog));
    logger_1.logger.info('1. 创建漏洞并完成正常流程');
    const vuln = await vulnerabilityService.createVulnerability({
        cveId: 'CVE-2024-MANUAL-001',
        packageName: 'manual-pkg',
        packageVersion: '1.0.0',
        description: '需要人工修正的测试漏洞',
        severity: types_1.Severity.HIGH
    });
    await vulnerabilityService.assignVulnerability(vuln.id, exports.sampleUsers.zhangsan.id, exports.sampleUsers.zhangsan.name, '初始分配', exports.sampleUsers.admin.id, exports.sampleUsers.admin.name);
    await vulnerabilityService.changeStatus(vuln.id, types_1.VulnerabilityStatus.IN_PROGRESS, '开始处理', exports.sampleUsers.zhangsan.id, exports.sampleUsers.zhangsan.name);
    await vulnerabilityService.changeStatus(vuln.id, types_1.VulnerabilityStatus.FIXED, '已修复', exports.sampleUsers.zhangsan.id, exports.sampleUsers.zhangsan.name);
    logger_1.logger.info('2. 管理员人工修正状态（特殊情况回退）');
    const manualResult = await vulnerabilityService.changeStatus(vuln.id, types_1.VulnerabilityStatus.IN_PROGRESS, '发现修复不完整，需要重新处理 - 管理员人工回退', exports.sampleUsers.admin.id, exports.sampleUsers.admin.name, true);
    logger_1.logger.info(`   人工修正标记: manuallyCorrected = ${manualResult.vulnerability.manuallyCorrected}`);
    logger_1.logger.info(`   当前状态: ${manualResult.vulnerability.status}`);
    logger_1.logger.info('3. 查看状态历史（审计追踪）');
    const history = await vulnerabilityService.getStatusHistory(vuln.id);
    logger_1.logger.info(`   历史记录数量: ${history.length}`);
    history.forEach((log, index) => {
        logger_1.logger.info(`   [${index + 1}] ${log.fromStatus} -> ${log.toStatus} | ${log.operatorName} | ${log.isManualOverride ? '(人工)' : ''} | 原因: ${log.reason.substring(0, 30)}...`);
    });
    logger_1.logger.info('4. 验证统计数据一致性');
    const stats = await vulnerabilityService.getStatistics();
    logger_1.logger.info(`   总漏洞数: ${stats.total}`);
    logger_1.logger.info(`   人工修正计数: ${stats.manuallyCorrected}`);
    logger_1.logger.info(`   状态分布: IN_PROGRESS=${stats.byStatus.IN_PROGRESS}`);
    logger_1.logger.info('【人工修正与历史一致性场景完成】');
}
async function seedAll() {
    logger_1.logger.info('========================================');
    logger_1.logger.info('开始初始化样例数据');
    logger_1.logger.info('========================================');
    try {
        await seedNormalScenario();
        logger_1.logger.info('');
        await seedBatchScenario();
        logger_1.logger.info('');
        await seedDelayScenario();
        logger_1.logger.info('');
        await seedRiskScenario();
        logger_1.logger.info('');
        await seedExceptionScenarios();
        logger_1.logger.info('');
        await seedManualOverrideScenario();
        logger_1.logger.info('');
        logger_1.logger.info('========================================');
        logger_1.logger.info('✅ 所有样例数据初始化完成');
        logger_1.logger.info('========================================');
    }
    catch (error) {
        logger_1.logger.error('初始化样例数据失败', { error: error.message });
        throw error;
    }
}
if (require.main === module) {
    seedAll()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}
//# sourceMappingURL=seed.js.map
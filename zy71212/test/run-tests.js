
const path = require('path');

const TEST_DATA_DIR = path.join(__dirname, '..', 'test-data');

const { FileProcessor } = require('../services');

async function runTests() {
    console.log('='.repeat(60));
    console.log('🚀 保险保费续缴宽限期管理系统 - 综合测试');
    console.log('='.repeat(60));
    console.log();

    let passed = 0;
    let failed = 0;

    async function test(name, testFn) {
        try {
            process.stdout.write(`  测试: ${name}... `);
            await testFn();
            console.log('✅ 通过');
            passed++;
        } catch (error) {
            console.log('❌ 失败');
            console.log(`     错误: ${error.message}`);
            failed++;
        }
    }

    console.log('📁 测试1: 目录批量处理和错误容忍');
    console.log('-'.repeat(60));
    
    await test('处理整个目录，遇到坏文件不中断', async () => {
        const processor = new FileProcessor({ stopOnError: false });
        const result = await processor.processDirectory(TEST_DATA_DIR);
        const totalFiles = result.totalFiles;
        const successCount = result.successCount;
        const failedCount = result.failedCount;
        if (totalFiles !== 4) {
            throw new Error(`期望处理4个文件，实际处理${totalFiles}个`);
        }
        if (successCount < 3) {
            throw new Error(`期望至少3个成功，实际${successCount}个`);
        }
        if (failedCount !== 1) {
            throw new Error(`期望1个失败，实际${failedCount}个`);
        }
        if (!result.failed || result.failed.length === 0) {
            throw new Error('应该有失败的文件记录');
        }
        console.log(` [成功:${successCount}, 失败:${failedCount}]`);
    });

    await test('输入类型自动识别', async () => {
        const processor = new FileProcessor();
        const result = await processor.processDirectory(TEST_DATA_DIR);
        const types = [];
        result.success.forEach(fileResult => {
            fileResult.records.forEach(record => {
                if (record.type) types.push(record.type);
            });
        });
        const uniqueTypes = [...new Set(types)];
        if (!uniqueTypes.includes('policy')) {
            throw new Error('应该识别到保单数据');
        }
        if (!uniqueTypes.includes('paymentPlan')) {
            throw new Error('应该识别到缴费计划数据');
        }
        if (!uniqueTypes.includes('visitRecord')) {
            throw new Error('应该识别到回访记录数据');
        }
        console.log(` [识别类型: ${uniqueTypes.join(', ')}]`);
    });

    await test('缺失字段检测', async () => {
        const processor = new FileProcessor();
        const result = await processor.processDirectory(TEST_DATA_DIR);
        let missingCount = 0;
        result.success.forEach(fileResult => {
            fileResult.records.forEach(record => {
                if (record.missingFields && record.missingFields.length > 0) {
                    missingCount++;
                }
            });
        });
        console.log(` [发现${missingCount}条记录有缺失字段]`);
    });

    console.log();
    console.log('📊 测试2: 数据模型验证');
    console.log('-'.repeat(60));

    const { Policy, PaymentPlan, VisitRecord, AdvancePaymentRecord, ReminderRecord, RenewalReport } = require('../models');

    await test('保单模型验证', async () => {
        const policy = new Policy({
            policyNo: 'TEST001',
            policyholder: '测试用户',
            premium: 5000,
            policyEffectiveDate: '2020-01-01'
        });
        const isValid = policy.validate();
        if (!isValid) {
            throw new Error('保单验证失败: ' + policy.missingFields.join(', '));
        }
        if (policy.missingFields.length !== 0) {
            throw new Error('应该没有缺失字段');
        }
    });

    await test('缴费计划宽限期状态判断', async () => {
        const today = new Date();
        const dueDate = new Date(today);
        dueDate.setDate(dueDate.getDate() - 10);
        
        const paymentPlan = new PaymentPlan({
            policyNo: 'TEST001',
            period: '2025年度',
            dueDate: dueDate.toISOString().slice(0, 10),
            premium: 5000,
            status: '待缴费'
        });
        
        const { HolidayService } = require('../services');
        const holidayService = new HolidayService();
        const graceEnd = holidayService.calculateGraceEndDate(dueDate, 60);
        paymentPlan.graceEndDate = graceEnd;
        
        const isInGrace = paymentPlan.isInGracePeriod();
        if (!isInGrace) {
            throw new Error('应该在宽限期内');
        }
        const daysRemaining = paymentPlan.getDaysRemainingInGrace();
        console.log(` [宽限剩余: ${daysRemaining}天]`);
    });

    await test('回访记录意愿锁定判断', async () => {
        const visit = new VisitRecord({
            policyNo: 'TEST001',
            visitDate: new Date().toISOString().slice(0, 10),
            visitType: '电话',
            customerIntent: '停保',
            intentConfirmed: true,
            contactResult: '已联系',
            remark: '客户确认停保'
        });
        if (!visit.isIntentLocked()) {
            throw new Error('停保意愿应该被锁定');
        }
        if (!visit.isStopIntent()) {
            throw new Error('应该识别为停保意愿');
        }
    });

    await test('催缴记录去重键生成', async () => {
        const policyNo = 'TEST001';
        const period = '2025年度';
        const reminderType = 'first';
        const reminderDate = new Date().toISOString().slice(0, 10);
        
        const key = ReminderRecord.generateDeduplicationKey(policyNo, period, reminderType, reminderDate);
        if (!key || !key.includes('TEST001')) {
            throw new Error('去重键应该包含保单号');
        }
        console.log(` [去重键: ${key}]`);
    });

    await test('垫交记录利息计算', async () => {
        const advanceDate = new Date();
        advanceDate.setMonth(advanceDate.getMonth() - 3);
        
        const advance = new AdvancePaymentRecord({
            policyNo: 'TEST001',
            period: '2025年度',
            advanceDate: advanceDate.toISOString().slice(0, 10),
            advanceAmount: 5000,
            interestRate: 5
        });
        
        const interest = advance.calculateCurrentInterest();
        const total = advance.getTotalAmountOwed();
        if (interest <= 0) {
            throw new Error('利息应该大于0');
        }
        console.log(` [利息: ¥${interest.toFixed(2)}, 总额: ¥${total.toFixed(2)}]`);
    });

    console.log();
    console.log('🔧 测试3: 业务服务');
    console.log('-'.repeat(60));

    await test('宽限期计算（含节假日顺延）', async () => {
        const { HolidayService } = require('../services');
        const holidayService = new HolidayService();
        const dueDate = new Date('2025-04-04');
        const graceEnd = holidayService.calculateGraceEndDate(dueDate, 60, true);
        console.log(` [应缴日: 2025-04-04, 宽限结束: ${graceEnd}]`);
    });

    await test('数据一致性检查', async () => {
        const { DataConsistencyManager } = require('../services');
        const manager = new DataConsistencyManager();
        
        const existing = {
            policyNo: 'TEST001',
            premium: 5000,
            createdAt: '2020-01-01',
            status: '待缴费'
        };
        
        const updateWithProtectedField = {
            policyNo: 'TEST002',
            premium: 8000,
            status: '已缴费'
        };
        
        const result = manager.safeUpdateRecord(existing, updateWithProtectedField);
        if (!result.hasConflicts) {
            throw new Error('应该检测到保护字段修改');
        }
        console.log(` [检测到${result.conflicts.length}个保护字段冲突]`);
    });

    console.log();
    console.log('💾 测试4: 持久化存储');
    console.log('-'.repeat(60));

    await test('数据保存和读取', async () => {
        const { StorageService } = require('../services');
        const storage = new StorageService();
        const testData = { test: 'data', timestamp: Date.now() };
        const success = storage.saveAllData({
            policies: [{ testData }]
        });
        if (!success) {
            throw new Error('数据保存失败');
        }
        const loaded = storage.getPolicies();
        if (!loaded || loaded.length === 0) {
            throw new Error('数据读取失败');
        }
        console.log(' [数据持久化正常]');
    });

    await test('备份创建', async () => {
        const { StorageService } = require('../services');
        const storage = new StorageService();
        const result = storage.backupData();
        if (!result || !result.success) {
            throw new Error('备份创建失败: ' + (result.error || '未知错误'));
        }
        console.log(` [备份文件: ${result.backupFile}]`);
    });

    console.log();
    console.log('📋 测试5: 业务流程链路');
    console.log('-'.repeat(60));

    await test('完整业务流程协调', async () => {
        const { BusinessWorkflowService } = require('../services');
        const workflow = new BusinessWorkflowService();
        
        const nextSteps = workflow.getNextSteps();
        
        if (!nextSteps || !nextSteps.nextSteps) {
            throw new Error('业务流程执行失败');
        }
        console.log(` [待办事项: ${nextSteps.nextSteps.length}条]`);
        if (nextSteps.nextSteps.length > 0) {
            console.log(`   1. ${nextSteps.nextSteps[0].type}: ${nextSteps.nextSteps[0].description}`);
        }
    });

    await test('数据一致性全面检查', async () => {
        const { BusinessWorkflowService } = require('../services');
        const workflow = new BusinessWorkflowService();
        
        const result = workflow.checkDataConsistency();
        
        if (!result || result.issues === undefined) {
            throw new Error('一致性检查执行失败');
        }
        console.log(` [发现${result.errors?.length || 0}个错误, ${result.warnings?.length || 0}个警告]`);
    });

    await test('生成续缴报告', async () => {
        const { BusinessWorkflowService } = require('../services');
        const workflow = new BusinessWorkflowService();
        
        const result = workflow.generateRenewalReport({
            reportPeriod: '2025年6月',
            generatedBy: '测试系统'
        });
        
        if (!result || !result.report) {
            throw new Error('报告生成失败');
        }
        console.log(` [报告ID: ${result.report.reportId}, 保单数: ${result.report.totalPolicies}]`);
    });

    console.log();
    console.log('='.repeat(60));
    console.log('📝 测试结果汇总');
    console.log('='.repeat(60));
    console.log(`  ✅ 通过: ${passed}`);
    console.log(`  ❌ 失败: ${failed}`);
    console.log(`  📊 通过率: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
    console.log();

    if (failed > 0) {
        console.log('⚠️  部分测试失败，请检查相关代码');
        process.exit(1);
    } else {
        console.log('🎉 所有测试通过！系统运行正常');
        process.exit(0);
    }
}

runTests().catch(error => {
    console.error('❌ 测试执行出错:', error);
    process.exit(1);
});

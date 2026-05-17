const db = require('../src/db');
const recoveryService = require('../src/services/recoveryService');
const { ERROR_CODES, ERROR_MESSAGES } = require('../src/constants/status');

class TestRunner {
    constructor() {
        this.passed = 0;
        this.failed = 0;
        this.results = [];
    }

    async test(name, fn) {
        console.log(`\n=== 测试: ${name} ===`);
        try {
            await fn();
            this.passed++;
            this.results.push({ name, status: 'PASS' });
            console.log('✓ 通过');
        } catch (err) {
            this.failed++;
            this.results.push({ name, status: 'FAIL', error: err.message });
            console.log(`✗ 失败: ${err.message}`);
        }
    }

    assertEqual(actual, expected, message = '') {
        if (actual !== expected) {
            throw new Error(`${message} 预期: ${expected}, 实际: ${actual}`);
        }
    }

    assertTrue(condition, message = '') {
        if (!condition) {
            throw new Error(message || '断言失败');
        }
    }

    assertFalse(condition, message = '') {
        if (condition) {
            throw new Error(message || '断言失败');
        }
    }

    summary() {
        console.log('\n\n========================================');
        console.log('           测试结果汇总');
        console.log('========================================');
        console.log(`总测试数: ${this.passed + this.failed}`);
        console.log(`通过: ${this.passed}`);
        console.log(`失败: ${this.failed}`);
        console.log('========================================');
        
        if (this.failed > 0) {
            console.log('\n失败的测试:');
            this.results.filter(r => r.status === 'FAIL').forEach(r => {
                console.log(`  - ${r.name}: ${r.error}`);
            });
        }
        
        return this.failed === 0;
    }
}

async function runTests() {
    const runner = new TestRunner();
    
    console.log('========================================');
    console.log('    在线考试服务补考资格恢复测试');
    console.log('========================================');

    console.log('\n--- 场景1: 完整流程测试 ---');
    
    let testAppId = null;
    
    await runner.test('创建申请成功', async () => {
        const result = await recoveryService.createApplication({
            registrationId: 7,
            absenceReasonId: 1,
            reasonDetail: '测试急性肠胃炎住院',
            applicantRemark: '请批准',
            operatorId: 2,
            operatorName: '李四'
        });
        runner.assertTrue(result.success, '创建申请失败');
        testAppId = result.applicationId;
        console.log('  申请ID:', testAppId);
    });

    await runner.test('提交申请成功', async () => {
        const result = await recoveryService.submitApplication(testAppId, 1, '张三');
        runner.assertTrue(result.success, '提交申请失败');
    });

    await runner.test('审核通过成功', async () => {
        const result = await recoveryService.reviewApplication(testAppId, true, 100, '管理员', '情况属实');
        runner.assertTrue(result.success, '审核失败');
    });

    await runner.test('验证申请状态为已恢复', async () => {
        const detail = await recoveryService.getApplicationDetail(testAppId);
        runner.assertEqual(detail.status, 2, '申请状态不正确');
    });

    await runner.test('验证操作日志存在', async () => {
        const logs = await recoveryService.getOperationLogs(testAppId);
        runner.assertTrue(logs.length >= 3, '操作日志记录不足');
    });

    console.log('\n--- 场景2: 考生已补考仍再次申请恢复资格 ---');

    await runner.test('已补考考生申请失败', async () => {
        const result = await recoveryService.createApplication({
            registrationId: 3,
            absenceReasonId: 1,
            reasonDetail: '再次申请',
            applicantRemark: '请批准',
            operatorId: 3,
            operatorName: '王五'
        });
        runner.assertFalse(result.success, '应该失败但成功了');
        runner.assertEqual(result.errorCode, ERROR_CODES.ALREADY_RETOOK, '错误码不正确');
        console.log('  错误信息:', result.errorMessage);
        runner.assertEqual(result.errorMessage, ERROR_MESSAGES[ERROR_CODES.ALREADY_RETOOK], '错误信息不匹配');
    });

    console.log('\n--- 场景3: 重复请求测试 ---');

    let duplicateTestAppId = null;

    await runner.test('创建第一个申请', async () => {
        const result = await recoveryService.createApplication({
            registrationId: 8,
            absenceReasonId: 2,
            reasonDetail: '家庭原因',
            applicantRemark: '第一个申请',
            operatorId: 3,
            operatorName: '王五'
        });
        runner.assertTrue(result.success, '第一个申请创建失败');
        duplicateTestAppId = result.applicationId;
    });

    await runner.test('重复提交失败', async () => {
        const result = await recoveryService.createApplication({
            registrationId: 8,
            absenceReasonId: 2,
            reasonDetail: '重复申请',
            applicantRemark: '第二个申请',
            operatorId: 3,
            operatorName: '王五'
        });
        runner.assertFalse(result.success, '应该失败但成功了');
        runner.assertEqual(result.errorCode, ERROR_CODES.DUPLICATE_REQUEST, '错误码不正确');
        console.log('  错误信息:', result.errorMessage);
        runner.assertEqual(result.errorMessage, ERROR_MESSAGES[ERROR_CODES.DUPLICATE_REQUEST], '错误信息不匹配');
    });

    console.log('\n--- 场景4: 撤回后再提交测试 ---');

    let withdrawTestAppId = null;

    await runner.test('创建申请', async () => {
        const result = await recoveryService.createApplication({
            registrationId: 9,
            absenceReasonId: 3,
            reasonDetail: '工作原因',
            applicantRemark: '撤回测试',
            operatorId: 4,
            operatorName: '赵六'
        });
        runner.assertTrue(result.success, '创建申请失败');
        withdrawTestAppId = result.applicationId;
    });

    await runner.test('提交申请', async () => {
        const result = await recoveryService.submitApplication(withdrawTestAppId, 5, '钱七');
        runner.assertTrue(result.success, '提交失败');
    });

    await runner.test('撤回申请', async () => {
        const result = await recoveryService.withdrawApplication(withdrawTestAppId, 5, '钱七', '材料不全');
        runner.assertTrue(result.success, '撤回失败');
    });

    await runner.test('验证申请状态为已撤回', async () => {
        const detail = await recoveryService.getApplicationDetail(withdrawTestAppId);
        runner.assertEqual(detail.status, 4, '撤回后状态不正确');
    });

    await runner.test('撤回后可以重新提交新申请', async () => {
        const result = await recoveryService.createApplication({
            registrationId: 10,
            absenceReasonId: 3,
            reasonDetail: '补充完整后重新申请',
            applicantRemark: '重新申请',
            operatorId: 5,
            operatorName: '钱七'
        });
        runner.assertTrue(result.success, '撤回后重新申请失败');
        console.log('  新申请ID:', result.applicationId);
    });

    console.log('\n--- 场景5: 未缺考考生申请失败 ---');

    await runner.test('未缺考考生申请失败', async () => {
        const result = await recoveryService.createApplication({
            registrationId: 2,
            absenceReasonId: 1,
            reasonDetail: '未缺考申请',
            applicantRemark: '测试',
            operatorId: 2,
            operatorName: '李四'
        });
        runner.assertFalse(result.success, '应该失败但成功了');
        runner.assertEqual(result.errorCode, ERROR_CODES.NOT_ABSENT, '错误码不正确');
        console.log('  错误信息:', result.errorMessage);
    });

    console.log('\n--- 场景6: 查询功能测试 ---');

    await runner.test('查询申请列表', async () => {
        const result = await recoveryService.getApplicationList({ page: 1, pageSize: 10 });
        runner.assertTrue(result.total > 0, '应该有数据');
        runner.assertTrue(result.list.length > 0, '列表应该有数据');
        console.log('  总记录数:', result.total);
    });

    await runner.test('按状态筛选', async () => {
        const result = await recoveryService.getApplicationList({ status: 2, page: 1, pageSize: 10 });
        result.list.forEach(item => {
            runner.assertEqual(item.status, 2, '筛选结果状态不正确');
        });
    });

    console.log('\n--- 场景7: 批量导入测试 ---');

    await runner.test('批量导入（含坏行）', async () => {
        const importData = [
            {
                registrationId: 11,
                absenceReasonId: 1,
                reasonDetail: '导入的有效数据',
                applicantRemark: '导入',
                operatorId: 1,
                operatorName: '张三'
            },
            {
                registrationId: 999,
                absenceReasonId: 1,
                reasonDetail: '不存在的报名ID',
                applicantRemark: '坏行',
                operatorId: 1,
                operatorName: '张三'
            },
            {
                registrationId: 3,
                absenceReasonId: 1,
                reasonDetail: '已补考的考生',
                applicantRemark: '坏行',
                operatorId: 3,
                operatorName: '王五'
            }
        ];

        const result = await recoveryService.importApplications('BATCH001', importData);
        console.log('  成功:', result.success, ', 失败:', result.failed);
        runner.assertEqual(result.success, 1, '成功数量不正确');
        runner.assertEqual(result.failed, 2, '失败数量不正确');
    });

    await runner.test('查询导入错误', async () => {
        const errors = await recoveryService.getImportErrors('BATCH001');
        runner.assertEqual(errors.length, 2, '错误记录数不正确');
        errors.forEach(err => {
            console.log(`  行${err.row_number}: ${err.error_message}`);
        });
    });

    await new Promise(resolve => setTimeout(resolve, 100));
    
    const allPassed = runner.summary();
    process.exit(allPassed ? 0 : 1);
}

runTests().catch(err => {
    console.error('测试运行出错:', err);
    process.exit(1);
});

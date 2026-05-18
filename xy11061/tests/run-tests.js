const { initDatabase, runQuery, allQuery, canTransition } = require('../database/db');
const service = require('../services/pointRecordService');

async function runTests() {
    console.log('========================================');
    console.log('开始运行影院会员部积分补录系统测试');
    console.log('========================================\n');

    let passed = 0;
    let failed = 0;

    async function test(name, fn) {
        try {
            await fn();
            console.log(`✅ ${name}`);
            passed++;
        } catch (error) {
            console.log(`❌ ${name}`);
            console.log(`   错误: ${error.message}`);
            failed++;
        }
    }

    await test('状态流转验证 - normal 可以转为 rejected', () => {
        if (!canTransition('normal', 'rejected')) {
            throw new Error('normal 应该可以转为 rejected');
        }
    });

    await test('状态流转验证 - normal 可以转为 completed', () => {
        if (!canTransition('normal', 'completed')) {
            throw new Error('normal 应该可以转为 completed');
        }
    });

    await test('状态流转验证 - rejected 只能转为 supplemented', () => {
        if (canTransition('rejected', 'completed')) {
            throw new Error('rejected 不应该直接转为 completed');
        }
        if (!canTransition('rejected', 'supplemented')) {
            throw new Error('rejected 应该可以转为 supplemented');
        }
    });

    await test('状态流转验证 - supplemented 可以转为 rejected 或 completed', () => {
        if (!canTransition('supplemented', 'rejected')) {
            throw new Error('supplemented 应该可以转为 rejected');
        }
        if (!canTransition('supplemented', 'completed')) {
            throw new Error('supplemented 应该可以转为 completed');
        }
    });

    await test('状态流转验证 - completed 为终态，不可转换', () => {
        if (canTransition('completed', 'normal')) {
            throw new Error('completed 状态不应再转换');
        }
        if (canTransition('completed', 'rejected')) {
            throw new Error('completed 状态不应再转换');
        }
    });

    await test('创建积分补录记录 - 成功创建', async () => {
        const result = await service.createPointRecord({
            ticket_no: 'TEST_' + Date.now(),
            member_id: 'MEM001',
            cinema_id: 'CIN001',
            movie_name: '测试电影',
            show_time: '2024-01-20 19:00:00',
            seat_no: '1排1座',
            ticket_amount: 50.00,
            points_earned: 50,
            submit_source: '测试',
            operator: '测试员'
        });
        if (!result.success) {
            throw new Error('创建记录失败');
        }
        if (result.data.status !== 'normal') {
            throw new Error('新记录状态应为 normal');
        }
    });

    await test('票根去重验证 - 同一票根不能重复提交', async () => {
        const ticketNo = 'DUPLICATE_' + Date.now();
        await service.createPointRecord({
            ticket_no: ticketNo,
            member_id: 'MEM001',
            cinema_id: 'CIN001',
            movie_name: '测试电影',
            show_time: '2024-01-20 19:00:00',
            seat_no: '1排1座',
            ticket_amount: 50.00,
            points_earned: 50,
            submit_source: '测试',
            operator: '测试员'
        });

        const result = await service.createPointRecord({
            ticket_no: ticketNo,
            member_id: 'MEM002',
            cinema_id: 'CIN001',
            movie_name: '测试电影',
            show_time: '2024-01-20 19:00:00',
            seat_no: '1排1座',
            ticket_amount: 50.00,
            points_earned: 50,
            submit_source: '测试',
            operator: '测试员'
        });

        if (result.success) {
            throw new Error('同一票根应该不能重复提交');
        }
        if (result.error !== 'DUPLICATE_TICKET') {
            throw new Error('应该返回 DUPLICATE_TICKET 错误');
        }
    });

    await test('查询积分补录记录 - 成功获取列表', async () => {
        const records = await service.getAllPointRecords();
        if (!Array.isArray(records)) {
            throw new Error('应该返回数组');
        }
    });

    await test('获取操作日志 - 记录创建后应该有日志', async () => {
        const createResult = await service.createPointRecord({
            ticket_no: 'LOG_TEST_' + Date.now(),
            member_id: 'MEM001',
            cinema_id: 'CIN001',
            movie_name: '测试电影',
            show_time: '2024-01-20 19:00:00',
            seat_no: '1排1座',
            ticket_amount: 50.00,
            points_earned: 50,
            submit_source: '测试',
            operator: '测试员'
        });

        const logs = await service.getOperationLogs(createResult.data.record_id);
        if (!Array.isArray(logs) || logs.length === 0) {
            throw new Error('应该有操作日志');
        }
        if (logs[0].operation !== 'CREATE') {
            throw new Error('第一条日志应该是 CREATE 操作');
        }
    });

    await test('状态流转完整流程 - normal -> rejected -> supplemented -> completed', async () => {
        const createResult = await service.createPointRecord({
            ticket_no: 'FLOW_TEST_' + Date.now(),
            member_id: 'MEM001',
            cinema_id: 'CIN001',
            movie_name: '测试电影',
            show_time: '2024-01-20 19:00:00',
            seat_no: '1排1座',
            ticket_amount: 50.00,
            points_earned: 50,
            submit_source: '测试',
            operator: '测试员'
        });

        const recordId = createResult.data.record_id;

        const rejectResult = await service.updateStatus(recordId, 'rejected', '审核员', '票根模糊');
        if (!rejectResult.success || rejectResult.data.status !== 'rejected') {
            throw new Error('normal -> rejected 状态转换失败');
        }

        const supplementResult = await service.updateStatus(recordId, 'supplemented', '客服', '已重新上传');
        if (!supplementResult.success || supplementResult.data.status !== 'supplemented') {
            throw new Error('rejected -> supplemented 状态转换失败');
        }

        const completeResult = await service.updateStatus(recordId, 'completed', '审核员', '审核通过');
        if (!completeResult.success || completeResult.data.status !== 'completed') {
            throw new Error('supplemented -> completed 状态转换失败');
        }
    });

    await test('积分流水一致性 - 完成后应该生成积分流水', async () => {
        const createResult = await service.createPointRecord({
            ticket_no: 'FLOW_CONSISTENCY_' + Date.now(),
            member_id: 'MEM001',
            cinema_id: 'CIN001',
            movie_name: '测试电影',
            show_time: '2024-01-20 19:00:00',
            seat_no: '1排1座',
            ticket_amount: 60.00,
            points_earned: 60,
            submit_source: '测试',
            operator: '测试员'
        });

        const recordId = createResult.data.record_id;
        await service.updateStatus(recordId, 'completed', '审核员', '审核通过');

        const flows = await service.getPointFlows(recordId);
        if (flows.length === 0) {
            throw new Error('完成后应该生成积分流水');
        }
        if (flows[0].points_change !== 60) {
            throw new Error('积分流水中的积分数应该与记录一致');
        }
    });

    await test('无效状态流转验证 - 不允许的状态转换应该被拒绝', async () => {
        const createResult = await service.createPointRecord({
            ticket_no: 'INVALID_TRANS_' + Date.now(),
            member_id: 'MEM001',
            cinema_id: 'CIN001',
            movie_name: '测试电影',
            show_time: '2024-01-20 19:00:00',
            seat_no: '1排1座',
            ticket_amount: 50.00,
            points_earned: 50,
            submit_source: '测试',
            operator: '测试员'
        });

        const recordId = createResult.data.record_id;
        await service.updateStatus(recordId, 'completed', '审核员', '审核通过');

        const result = await service.updateStatus(recordId, 'normal', '测试员', '回退');
        if (result.success) {
            throw new Error('completed -> normal 应该是不允许的状态转换');
        }
    });

    await test('验证积分一致性接口 - 应该正确验证流水一致性', async () => {
        const createResult = await service.createPointRecord({
            ticket_no: 'VERIFY_TEST_' + Date.now(),
            member_id: 'MEM001',
            cinema_id: 'CIN001',
            movie_name: '测试电影',
            show_time: '2024-01-20 19:00:00',
            seat_no: '1排1座',
            ticket_amount: 45.00,
            points_earned: 45,
            submit_source: '测试',
            operator: '测试员'
        });

        const recordId = createResult.data.record_id;
        await service.updateStatus(recordId, 'completed', '审核员', '审核通过');

        const verifyResult = await service.verifyPointsConsistency(recordId);
        if (!verifyResult.success || !verifyResult.is_consistent) {
            throw new Error('积分一致性验证应该通过');
        }
    });

    console.log('\n========================================');
    console.log('测试结果汇总');
    console.log('========================================');
    console.log(`通过: ${passed} 项`);
    console.log(`失败: ${failed} 项`);
    console.log('========================================\n');

    if (failed > 0) {
        process.exit(1);
    }
}

initDatabase().then(() => {
    runTests().catch(console.error);
});

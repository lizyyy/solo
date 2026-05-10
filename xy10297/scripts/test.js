const http = require('http');

const BASE_URL = 'http://localhost:3001/api';

const httpRequest = (options, body) => {
    return new Promise((resolve, reject) => {
        const url = new URL(options.url || BASE_URL + options.path);
        const req = http.request({
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(body ? { 'Content-Length': Buffer.byteLength(JSON.stringify(body)) } : {})
            }
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const parsed = data ? JSON.parse(data) : {};
                    resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, data: { raw: data } });
                }
            });
        });
        
        req.on('error', reject);
        
        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
};

const assert = (condition, message) => {
    if (!condition) {
        throw new Error(`断言失败: ${message}`);
    }
    console.log(`  ✓ ${message}`);
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const runTests = async () => {
    console.log('='.repeat(60));
    console.log('开始运行生鲜称重标签重打 API 测试');
    console.log('='.repeat(60));
    
    let testWeighingRecordId;
    let testRequestId;
    
    try {
        console.log('\n【测试1: 创建称重记录】');
        const createRes = await httpRequest({
            path: '/weighing',
            method: 'POST'
        }, {
            sku_code: 'TEST-001',
            sku_name: '测试商品',
            weight: 2.5,
            unit_price: 10.00,
            batch_number: 'TEST-BATCH-001',
            counter_code: 'TEST-COUNTER',
            operator_id: 'user1'
        });
        
        assert(createRes.status === 201, '返回201状态码');
        assert(createRes.data.success === true, 'success为true');
        assert(createRes.data.data.weight === 2.5, '重量正确');
        assert(createRes.data.data.unit_price === 10.00, '单价正确');
        assert(createRes.data.data.total_price === 25.00, '总价计算正确 (2.5 * 10.00)');
        assert(createRes.data.data.label_version === 1, '初始标签版本为1');
        
        testWeighingRecordId = createRes.data.data.id;
        console.log(`  创建的称重记录ID: ${testWeighingRecordId}`);
        
        console.log('\n【测试2: 查询称重记录详情】');
        const getRes = await httpRequest({
            path: `/weighing/${testWeighingRecordId}`,
            method: 'GET'
        });
        
        assert(getRes.status === 200, '返回200状态码');
        assert(getRes.data.data.id === testWeighingRecordId, 'ID匹配');
        assert(Array.isArray(getRes.data.data.label_versions), '包含标签版本数组');
        
        console.log('\n【测试3: 创建重打申请】');
        const createRequestRes = await httpRequest({
            path: '/reprint',
            method: 'POST'
        }, {
            weighing_record_id: testWeighingRecordId,
            reason: '标签破损需要重打',
            requester_id: 'user1'
        });
        
        assert(createRequestRes.status === 201, '返回201状态码');
        assert(createRequestRes.data.success === true, 'success为true');
        assert(createRequestRes.data.data.status === 'PENDING', '状态为PENDING');
        assert(createRequestRes.data.data.current_version === 1, '当前版本为1');
        assert(createRequestRes.data.data.requested_version === 1, '请求版本为1');
        
        testRequestId = createRequestRes.data.data.id;
        console.log(`  创建的申请ID: ${testRequestId}`);
        
        console.log('\n【测试4: 重复申请应被拒绝】');
        const duplicateRes = await httpRequest({
            path: '/reprint',
            method: 'POST'
        }, {
            weighing_record_id: testWeighingRecordId,
            reason: '再次申请',
            requester_id: 'user1'
        });
        
        assert(duplicateRes.status === 500 || duplicateRes.data.success === false, '重复申请失败');
        assert(duplicateRes.data.message?.includes('重复') || duplicateRes.data.message?.includes('待处理'), '错误消息提示重复');
        console.log(`  错误消息: ${duplicateRes.data.message}`);
        
        console.log('\n【测试5: 审批申请 - 权限不足测试】');
        const noPermRes = await httpRequest({
            path: `/reprint/${testRequestId}/approve`,
            method: 'POST'
        }, {
            operator_id: 'user1'
        });
        
        assert(noPermRes.data.success === false, '无权限用户审批失败');
        assert(noPermRes.data.message?.includes('权限'), '错误消息提示权限');
        
        console.log('\n【测试6: 审批申请 - 正常流程】');
        const approveRes = await httpRequest({
            path: `/reprint/${testRequestId}/approve`,
            method: 'POST'
        }, {
            operator_id: 'user2'
        });
        
        assert(approveRes.data.success === true, '审批成功');
        assert(approveRes.data.data.status === 'APPROVED', '状态变为APPROVED');
        assert(approveRes.data.data.approver_id === 'user2', 'approver_id正确');
        
        console.log('\n【测试7: 执行重打 - 关键验证：价格、重量、批次一致性】');
        const executeRes = await httpRequest({
            path: `/reprint/${testRequestId}/execute`,
            method: 'POST'
        }, {
            operator_id: 'user1'
        });
        
        assert(executeRes.data.success === true, '执行成功');
        assert(executeRes.data.data.status === 'COMPLETED', '状态变为COMPLETED');
        
        const newLabel = executeRes.data.data.new_label_version;
        assert(newLabel.version_number === 2, '新版本号为2');
        assert(newLabel.printed_data.weight === 2.5, '重量与原交易一致: 2.5');
        assert(newLabel.printed_data.unit_price === 10.00, '单价与原交易一致: 10.00');
        assert(newLabel.printed_data.total_price === 25.00, '总价与原交易一致: 25.00');
        assert(newLabel.printed_data.batch_number === 'TEST-BATCH-001', '批次与原交易一致');
        console.log(`  重打标签数据验证通过 - 重量:${newLabel.printed_data.weight}, 单价:${newLabel.printed_data.unit_price}, 总价:${newLabel.printed_data.total_price}, 批次:${newLabel.printed_data.batch_number}`);
        
        console.log('\n【测试8: 查询汇总接口】');
        const summaryRes = await httpRequest({
            path: '/summary',
            method: 'GET'
        });
        
        assert(summaryRes.data.success === true, '查询成功');
        assert(summaryRes.data.data.statistics.total_requests >= 1, '至少有1条申请');
        assert(summaryRes.data.data.statistics.status_counts.COMPLETED >= 1, '至少有1条已完成');
        
        console.log('\n【测试9: 查询审计日志】');
        const auditRes = await httpRequest({
            path: '/audit',
            method: 'GET'
        });
        
        assert(auditRes.data.success === true, '查询成功');
        assert(auditRes.data.data.length > 0, '有审计记录');
        
        const createAction = auditRes.data.data.find(l => l.action === 'CREATE');
        const approveAction = auditRes.data.data.find(l => l.action === 'APPROVE');
        const executeAction = auditRes.data.data.find(l => l.action === 'EXECUTE');
        
        assert(createAction, '存在CREATE审计记录');
        assert(approveAction, '存在APPROVE审计记录');
        assert(executeAction, '存在EXECUTE审计记录');
        
        console.log('\n【测试10: 批次锁定测试】');
        const lockRes = await httpRequest({
            path: '/batch/lock',
            method: 'POST'
        }, {
            batch_number: 'LOCKED-BATCH',
            counter_code: 'TEST-COUNTER',
            operator_id: 'admin',
            reason: '批次质量问题排查'
        });
        
        assert(lockRes.data.success === true, '批次锁定成功');
        
        const lockedRecordRes = await httpRequest({
            path: '/weighing',
            method: 'POST'
        }, {
            sku_code: 'LOCKED-TEST',
            sku_name: '锁定批次测试',
            weight: 1.0,
            unit_price: 5.00,
            batch_number: 'LOCKED-BATCH',
            counter_code: 'TEST-COUNTER',
            operator_id: 'user1'
        });
        
        assert(lockedRecordRes.status === 201, '可以创建新记录');
        const lockedRecordId = lockedRecordRes.data.data.id;
        
        const lockedRequestRes = await httpRequest({
            path: '/reprint',
            method: 'POST'
        }, {
            weighing_record_id: lockedRecordId,
            reason: '测试',
            requester_id: 'user1'
        });
        
        assert(lockedRequestRes.data.success === false, '锁定批次的重打申请被拒绝');
        assert(lockedRequestRes.data.message?.includes('锁定'), '错误消息提示批次锁定');
        
        console.log('\n【测试11: 撤回申请测试】');
        const newRecordRes = await httpRequest({
            path: '/weighing',
            method: 'POST'
        }, {
            sku_code: 'CANCEL-TEST',
            sku_name: '撤回测试',
            weight: 1.0,
            unit_price: 5.00,
            batch_number: 'BATCH-CANCEL',
            counter_code: 'TEST-COUNTER',
            operator_id: 'user1'
        });
        
        const cancelRecordId = newRecordRes.data.data.id;
        
        const newRequestRes = await httpRequest({
            path: '/reprint',
            method: 'POST'
        }, {
            weighing_record_id: cancelRecordId,
            reason: '待撤回申请',
            requester_id: 'user1'
        });
        
        const cancelRequestId = newRequestRes.data.data.id;
        
        const cancelRes = await httpRequest({
            path: `/reprint/${cancelRequestId}/cancel`,
            method: 'POST'
        }, {
            operator_id: 'user1'
        });
        
        assert(cancelRes.data.success === true, '撤回成功');
        assert(cancelRes.data.data.status === 'CANCELLED', '状态变为CANCELLED');
        
        console.log('\n【测试12: 修正申请测试】');
        const modifyRecordRes = await httpRequest({
            path: '/weighing',
            method: 'POST'
        }, {
            sku_code: 'MODIFY-TEST',
            sku_name: '修正测试',
            weight: 1.0,
            unit_price: 5.00,
            batch_number: 'BATCH-MODIFY',
            counter_code: 'TEST-COUNTER',
            operator_id: 'user1'
        });
        
        const modifyRecordId = modifyRecordRes.data.data.id;
        
        const modifyRequestRes = await httpRequest({
            path: '/reprint',
            method: 'POST'
        }, {
            weighing_record_id: modifyRecordId,
            reason: '原始原因',
            requester_id: 'user1'
        });
        
        const modifyRequestId = modifyRequestRes.data.data.id;
        
        const modifyRes = await httpRequest({
            path: `/reprint/${modifyRequestId}/modify`,
            method: 'POST'
        }, {
            operator_id: 'admin',
            reason: '修正后的原因'
        });
        
        assert(modifyRes.data.success === true, '修正成功');
        assert(modifyRes.data.data.status === 'MODIFIED', '状态变为MODIFIED');
        assert(modifyRes.data.data.reason === '修正后的原因', '原因已更新');
        
        console.log('\n【测试13: 无效版本请求测试】');
        const invalidVersionRes = await httpRequest({
            path: '/reprint',
            method: 'POST'
        }, {
            weighing_record_id: testWeighingRecordId,
            reason: '测试无效版本',
            requester_id: 'user1',
            requested_version: 999
        });
        
        assert(invalidVersionRes.data.success === false, '无效版本被拒绝');
        assert(invalidVersionRes.data.message?.includes('无效'), '错误消息提示版本无效');
        
        console.log('\n【测试14: 验证标签历史版本查询】');
        const updatedRecordRes = await httpRequest({
            path: `/weighing/${testWeighingRecordId}`,
            method: 'GET'
        });
        
        const labels = updatedRecordRes.data.data.label_versions;
        assert(labels.length >= 2, '至少有2个标签版本');
        assert(labels.some(l => l.version_number === 1), '存在版本1');
        assert(labels.some(l => l.version_number === 2), '存在版本2');
        
        console.log('\n' + '='.repeat(60));
        console.log('所有测试通过！✓');
        console.log('='.repeat(60));
        console.log('\n关键验证摘要:');
        console.log('  ✓ 称重记录创建与计算正确');
        console.log('  ✓ 重复申请被正确拒绝');
        console.log('  ✓ 权限审核机制生效');
        console.log('  ✓ 重打标签数据与原交易完全一致（重量、单价、总价、批次）');
        console.log('  ✓ 标签版本号正确递增');
        console.log('  ✓ 批次锁定功能正常');
        console.log('  ✓ 撤回和修正功能正常');
        console.log('  ✓ 审计日志完整记录所有操作');
        console.log('  ✓ 汇总查询功能正常');
        
    } catch (err) {
        console.log('\n' + '='.repeat(60));
        console.error('测试失败:', err.message);
        console.log('='.repeat(60));
        process.exit(1);
    }
};

runTests();

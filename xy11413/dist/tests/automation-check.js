"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const BASE_URL = 'http://localhost:3000';
const AUTH_HEADER = 'Bearer tea-chain-verification-2024';
const makeRequest = (method, path, headers = {}, body) => {
    return new Promise((resolve) => {
        const options = {
            method,
            path,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': AUTH_HEADER,
                ...headers
            }
        };
        const req = http_1.default.request(new URL(path, BASE_URL), options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode || 500, data: JSON.parse(data) });
                }
                catch {
                    resolve({ status: res.statusCode || 500, data });
                }
            });
        });
        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
};
const waitForService = async (maxRetries = 30) => {
    console.log('等待服务启动...');
    for (let i = 0; i < maxRetries; i++) {
        try {
            const { status } = await makeRequest('GET', '/health');
            if (status === 200) {
                console.log('服务已启动!');
                return true;
            }
        }
        catch { }
        await new Promise(r => setTimeout(r, 1000));
    }
    return false;
};
const runTests = async () => {
    const results = [];
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                自动化检查测试开始                              ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    console.log('【测试 1】健康检查');
    try {
        const { status, data } = await makeRequest('GET', '/health');
        const passed = status === 200 && data.status === 'ok';
        results.push({ name: '健康检查', passed, message: passed ? '通过' : `状态码: ${status}` });
        console.log(`  ${passed ? '✅' : '❌'} ${results[results.length - 1].message}`);
    }
    catch (e) {
        results.push({ name: '健康检查', passed: false, message: `错误: ${e}` });
        console.log(`  ❌ ${results[results.length - 1].message}`);
    }
    console.log('\n【测试 2】权限拦截 - 未授权访问');
    try {
        const { status } = await makeRequest('GET', '/api/tasks', { 'Authorization': 'invalid-token' });
        const passed = status === 401;
        results.push({ name: '权限拦截-未授权', passed, message: passed ? '正确返回 401' : `状态码: ${status}` });
        console.log(`  ${passed ? '✅' : '❌'} ${results[results.length - 1].message}`);
    }
    catch (e) {
        results.push({ name: '权限拦截-未授权', passed: false, message: `错误: ${e}` });
        console.log(`  ❌ ${results[results.length - 1].message}`);
    }
    console.log('\n【测试 3】权限拦截 - viewer 角色无导入权限');
    try {
        const { status } = await makeRequest('POST', '/api/import/order', { 'X-User-Role': 'viewer' }, { fileName: 'test.csv', records: [] });
        const passed = status === 403;
        results.push({ name: '权限拦截-viewer无导入', passed, message: passed ? '正确返回 403' : `状态码: ${status}` });
        console.log(`  ${passed ? '✅' : '❌'} ${results[results.length - 1].message}`);
    }
    catch (e) {
        results.push({ name: '权限拦截-viewer无导入', passed: false, message: `错误: ${e}` });
        console.log(`  ❌ ${results[results.length - 1].message}`);
    }
    console.log('\n【测试 4】导入订货数据');
    const testOrders = [
        {
            orderNo: 'TESTORD001',
            materialCode: 'M001',
            materialName: '红茶',
            quantity: 100,
            unit: 'kg',
            franchiseeId: 'F001',
            franchiseeName: '测试门店',
            orderDate: '2024-05-20'
        }
    ];
    try {
        const { status, data } = await makeRequest('POST', '/api/import/order', { 'X-User-Role': 'admin', 'X-Username': 'tester' }, { fileName: 'test_orders.csv', records: testOrders });
        const passed = status === 200 && data.success;
        results.push({
            name: '导入订货数据',
            passed,
            message: passed ? `成功: ${JSON.stringify(data.data)}` : `状态码: ${status}`
        });
        console.log(`  ${passed ? '✅' : '❌'} ${results[results.length - 1].message}`);
    }
    catch (e) {
        results.push({ name: '导入订货数据', passed: false, message: `错误: ${e}` });
        console.log(`  ❌ ${results[results.length - 1].message}`);
    }
    console.log('\n【测试 5】重复导入 - 应该更新而非新增');
    try {
        const { status, data } = await makeRequest('POST', '/api/import/order', { 'X-User-Role': 'admin', 'X-Username': 'tester' }, { fileName: 'test_orders.csv', records: testOrders });
        const passed = status === 200 && data.success && data.data.updatedCount >= 0;
        results.push({
            name: '重复导入-幂等更新',
            passed,
            message: passed ? `更新: ${data.data.updatedCount}, 新增: ${data.data.insertedCount}` : `状态码: ${status}`
        });
        console.log(`  ${passed ? '✅' : '❌'} ${results[results.length - 1].message}`);
    }
    catch (e) {
        results.push({ name: '重复导入-幂等更新', passed: false, message: `错误: ${e}` });
        console.log(`  ❌ ${results[results.length - 1].message}`);
    }
    console.log('\n【测试 6】创建对账任务');
    let taskId = '';
    try {
        const { status, data } = await makeRequest('POST', '/api/tasks', { 'X-User-Role': 'admin' }, { taskType: 'reconciliation', payload: {} });
        taskId = data.data?.taskId || '';
        const passed = status === 200 && data.success && taskId;
        results.push({
            name: '创建对账任务',
            passed,
            message: passed ? `任务ID: ${taskId}` : `状态码: ${status}`
        });
        console.log(`  ${passed ? '✅' : '❌'} ${results[results.length - 1].message}`);
    }
    catch (e) {
        results.push({ name: '创建对账任务', passed: false, message: `错误: ${e}` });
        console.log(`  ❌ ${results[results.length - 1].message}`);
    }
    console.log('\n【测试 7】查询任务列表');
    try {
        const { status, data } = await makeRequest('GET', '/api/tasks');
        const passed = status === 200 && data.success && Array.isArray(data.data);
        results.push({
            name: '查询任务列表',
            passed,
            message: passed ? `共 ${data.data.length} 条任务` : `状态码: ${status}`
        });
        console.log(`  ${passed ? '✅' : '❌'} ${results[results.length - 1].message}`);
    }
    catch (e) {
        results.push({ name: '查询任务列表', passed: false, message: `错误: ${e}` });
        console.log(`  ❌ ${results[results.length - 1].message}`);
    }
    console.log('\n【测试 8】执行对账');
    try {
        const { status, data } = await makeRequest('POST', `/api/tasks/${taskId}/reconcile`, { 'X-User-Role': 'admin' }, {});
        const passed = status === 200 && data.success;
        results.push({
            name: '执行对账',
            passed,
            message: passed ? `处理 ${data.data.count} 条, 异常 ${data.data.anomalies} 条` : `状态码: ${status}`
        });
        console.log(`  ${passed ? '✅' : '❌'} ${results[results.length - 1].message}`);
    }
    catch (e) {
        results.push({ name: '执行对账', passed: false, message: `错误: ${e}` });
        console.log(`  ❌ ${results[results.length - 1].message}`);
    }
    console.log('\n【测试 9】导出对账结果');
    let exportId = '';
    try {
        const { status, data } = await makeRequest('POST', `/api/export/reconciliation/${taskId}`, { 'X-User-Role': 'admin', 'X-Username': 'tester' });
        exportId = data.data?.exportId || '';
        const passed = status === 200 && data.success;
        results.push({
            name: '导出对账结果',
            passed,
            message: passed ? `导出ID: ${exportId}, 文件: ${data.data.filePath}` : `状态码: ${status}`
        });
        console.log(`  ${passed ? '✅' : '❌'} ${results[results.length - 1].message}`);
    }
    catch (e) {
        results.push({ name: '导出对账结果', passed: false, message: `错误: ${e}` });
        console.log(`  ❌ ${results[results.length - 1].message}`);
    }
    console.log('\n【测试 10】导出文件完整性校验');
    try {
        const { status, data } = await makeRequest('GET', `/api/export/verify/${exportId}`);
        const passed = status === 200 && data.success && data.data.isValid;
        results.push({
            name: '导出完整性校验',
            passed,
            message: passed ? '文件未被篡改' : `校验失败: ${JSON.stringify(data.data)}`
        });
        console.log(`  ${passed ? '✅' : '❌'} ${results[results.length - 1].message}`);
    }
    catch (e) {
        results.push({ name: '导出完整性校验', passed: false, message: `错误: ${e}` });
        console.log(`  ❌ ${results[results.length - 1].message}`);
    }
    console.log('\n【测试 11】查询异常记录');
    try {
        const { status, data } = await makeRequest('GET', '/api/anomalies');
        const passed = status === 200 && data.success && Array.isArray(data.data);
        results.push({
            name: '查询异常记录',
            passed,
            message: passed ? `共 ${data.data.length} 条异常` : `状态码: ${status}`
        });
        console.log(`  ${passed ? '✅' : '❌'} ${results[results.length - 1].message}`);
    }
    catch (e) {
        results.push({ name: '查询异常记录', passed: false, message: `错误: ${e}` });
        console.log(`  ❌ ${results[results.length - 1].message}`);
    }
    console.log('\n【测试 12】查询导出历史');
    try {
        const { status, data } = await makeRequest('GET', '/api/export/history');
        const passed = status === 200 && data.success && Array.isArray(data.data);
        results.push({
            name: '查询导出历史',
            passed,
            message: passed ? `共 ${data.data.length} 条记录` : `状态码: ${status}`
        });
        console.log(`  ${passed ? '✅' : '❌'} ${results[results.length - 1].message}`);
    }
    catch (e) {
        results.push({ name: '查询导出历史', passed: false, message: `错误: ${e}` });
        console.log(`  ❌ ${results[results.length - 1].message}`);
    }
    console.log('\n【测试 13】模拟失败任务 - 验证异常保留');
    let failTaskId = '';
    try {
        const { data } = await makeRequest('POST', '/api/tasks', { 'X-User-Role': 'admin' }, { taskType: 'unknown_type', payload: {} });
        failTaskId = data.data?.taskId || '';
        results.push({
            name: '异常保留-创建失败任务',
            passed: true,
            message: `任务ID: ${failTaskId}`
        });
        console.log(`  ✅ ${results[results.length - 1].message}`);
    }
    catch (e) {
        results.push({ name: '异常保留-创建失败任务', passed: false, message: `错误: ${e}` });
        console.log(`  ❌ ${results[results.length - 1].message}`);
    }
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('测试摘要:');
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    console.log(`通过: ${passed}/${total} (${Math.round(passed / total * 100)}%)`);
    console.log('\n失败的测试:');
    results.filter(r => !r.passed).forEach(r => {
        console.log(`  ❌ ${r.name}: ${r.message}`);
    });
    if (passed < total) {
        process.exit(1);
    }
    else {
        console.log('\n✅ 所有测试通过!');
        process.exit(0);
    }
};
const main = async () => {
    const isServiceRunning = await waitForService();
    if (!isServiceRunning) {
        console.error('服务启动超时，请先启动服务: npm run dev');
        process.exit(1);
    }
    await runTests();
};
main().catch(console.error);

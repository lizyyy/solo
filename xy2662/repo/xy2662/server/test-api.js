const http = require('http');
const db = require('./database');
const { insertSampleData } = require('./sample-data');

const BASE_URL = 'http://localhost:3000';

function httpRequest(options, body = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const response = {
                        status: res.statusCode,
                        data: data ? JSON.parse(data) : null
                    };
                    resolve(response);
                } catch (error) {
                    resolve({ status: res.statusCode, data, raw: data });
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

async function apiCall(method, path, body = null) {
    const url = new URL(path, BASE_URL);
    const options = {
        hostname: url.hostname,
        port: url.port || 3000,
        path: url.pathname + url.search,
        method: method,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    if (body) {
        options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(body));
    }

    return httpRequest(options, body);
}

async function testFullWorkflow() {
    console.log('='.repeat(60));
    console.log('开始测试完整工单流程');
    console.log('='.repeat(60));

    let orderId = null;
    let allPassed = true;

    try {
        console.log('\n[步骤 1] 创建新工单...');
        const createResponse = await apiCall('POST', '/api/orders', {
            customer_name: '测试用户',
            phone: '13800000001',
            device_model: '测试手机 Pro',
            fault_description: '屏幕损坏，需要更换',
            quote_amount: 500,
            repair_parts: '屏幕总成',
            expected_pickup_time: '2026-05-05 18:00',
            notes: '测试工单'
        });

        if (createResponse.status === 201 && createResponse.data.success) {
            orderId = createResponse.data.data.id;
            console.log(`✅ 工单创建成功，ID: ${orderId}`);
        } else {
            console.log(`❌ 工单创建失败: ${createResponse.data?.message || '未知错误'}`);
            allPassed = false;
        }

        if (orderId) {
            console.log('\n[步骤 2] 获取工单详情...');
            const getResponse = await apiCall('GET', `/api/orders/${orderId}`);
            if (getResponse.status === 200 && getResponse.data.success) {
                console.log(`✅ 工单详情获取成功: ${getResponse.data.data.customer_name}`);
            } else {
                console.log(`❌ 工单详情获取失败`);
                allPassed = false;
            }

            console.log('\n[步骤 3] 状态流转: 待检测 -> 报价中...');
            const status1Response = await apiCall('PUT', `/api/orders/${orderId}/status`, {
                status: 'quoting'
            });
            if (status1Response.status === 200 && status1Response.data.success) {
                console.log(`✅ 状态更新成功: ${status1Response.data.data.status}`);
            } else {
                console.log(`❌ 状态更新失败: ${status1Response.data?.message}`);
                allPassed = false;
            }

            console.log('\n[步骤 4] 状态流转: 报价中 -> 维修中...');
            const status2Response = await apiCall('PUT', `/api/orders/${orderId}/status`, {
                status: 'repairing'
            });
            if (status2Response.status === 200 && status2Response.data.success) {
                console.log(`✅ 状态更新成功: ${status2Response.data.data.status}`);
            } else {
                console.log(`❌ 状态更新失败: ${status2Response.data?.message}`);
                allPassed = false;
            }

            console.log('\n[步骤 5] 状态流转: 维修中 -> 待取机...');
            const status3Response = await apiCall('PUT', `/api/orders/${orderId}/status`, {
                status: 'ready'
            });
            if (status3Response.status === 200 && status3Response.data.success) {
                console.log(`✅ 状态更新成功: ${status3Response.data.data.status}`);
            } else {
                console.log(`❌ 状态更新失败: ${status3Response.data?.message}`);
                allPassed = false;
            }

            console.log('\n[步骤 6] 状态流转: 待取机 -> 已完成...');
            const status4Response = await apiCall('PUT', `/api/orders/${orderId}/status`, {
                status: 'completed'
            });
            if (status4Response.status === 200 && status4Response.data.success) {
                console.log(`✅ 状态更新成功: ${status4Response.data.data.status}`);
            } else {
                console.log(`❌ 状态更新失败: ${status4Response.data?.message}`);
                allPassed = false;
            }

            console.log('\n[步骤 7] 测试无效状态跳转 (已完成 -> 待检测)...');
            const invalidStatusResponse = await apiCall('PUT', `/api/orders/${orderId}/status`, {
                status: 'pending'
            });
            if (invalidStatusResponse.status === 400) {
                console.log(`✅ 无效状态跳转被正确拒绝: ${invalidStatusResponse.data?.message}`);
            } else {
                console.log(`❌ 无效状态跳转应该被拒绝，但实际返回: ${invalidStatusResponse.status}`);
                allPassed = false;
            }

            console.log('\n[步骤 8] 更新工单信息...');
            const updateResponse = await apiCall('PUT', `/api/orders/${orderId}`, {
                customer_name: '测试用户-已更新',
                phone: '13800000001',
                device_model: '测试手机 Pro Max',
                fault_description: '屏幕损坏，需要更换',
                quote_amount: 600,
                repair_parts: '原装屏幕总成',
                expected_pickup_time: '2026-05-05 18:00',
                notes: '测试工单-已更新'
            });
            if (updateResponse.status === 200 && updateResponse.data.success) {
                console.log(`✅ 工单更新成功: ${updateResponse.data.data.customer_name}`);
            } else {
                console.log(`❌ 工单更新失败: ${updateResponse.data?.message}`);
                allPassed = false;
            }

            console.log('\n[步骤 9] 获取工单列表...');
            const listResponse = await apiCall('GET', '/api/orders');
            if (listResponse.status === 200 && listResponse.data.success) {
                console.log(`✅ 工单列表获取成功，共 ${listResponse.data.data.length} 条记录`);
            } else {
                console.log(`❌ 工单列表获取失败`);
                allPassed = false;
            }

            console.log('\n[步骤 10] 搜索工单...');
            const searchResponse = await apiCall('GET', '/api/orders?search=测试');
            if (searchResponse.status === 200 && searchResponse.data.success) {
                console.log(`✅ 搜索成功，找到 ${searchResponse.data.data.length} 条相关记录`);
            } else {
                console.log(`❌ 搜索失败`);
                allPassed = false;
            }

            console.log('\n[步骤 11] 按状态筛选...');
            const filterResponse = await apiCall('GET', '/api/orders?status=completed');
            if (filterResponse.status === 200 && filterResponse.data.success) {
                console.log(`✅ 状态筛选成功，找到 ${filterResponse.data.data.length} 条已完成工单`);
            } else {
                console.log(`❌ 状态筛选失败`);
                allPassed = false;
            }
        }

        console.log('\n[步骤 12] 测试创建工单验证...');
        const invalidCreateResponse = await apiCall('POST', '/api/orders', {
            customer_name: '',
            phone: 'invalid-phone',
            device_model: '',
            fault_description: ''
        });
        if (invalidCreateResponse.status === 400) {
            console.log(`✅ 无效数据被正确拒绝: ${invalidCreateResponse.data?.message}`);
        } else {
            console.log(`❌ 无效数据应该被拒绝，但实际返回: ${invalidCreateResponse.status}`);
            allPassed = false;
        }

        console.log('\n' + '='.repeat(60));
        if (allPassed) {
            console.log('✅ 所有测试通过！');
        } else {
            console.log('❌ 部分测试失败，请检查输出信息');
        }
        console.log('='.repeat(60));

        process.exit(allPassed ? 0 : 1);

    } catch (error) {
        console.error('\n❌ 测试过程中发生错误:', error.message);
        console.log('\n请确保服务器正在运行: npm start');
        process.exit(1);
    }
}

async function runDatabaseTests() {
    console.log('='.repeat(60));
    console.log('开始测试数据库功能');
    console.log('='.repeat(60));

    let allPassed = true;

    try {
        console.log('\n[测试 1] 测试状态流转逻辑...');
        console.log('  待检测 可以转为: 报价中、已取消');
        console.log('  报价中 可以转为: 维修中、已取消');
        console.log('  维修中 可以转为: 待取机、已取消');
        console.log('  待取机 可以转为: 已完成、已取消');
        console.log('  已完成/已取消 无法再变更状态');

        const testCases = [
            { from: 'pending', to: 'quoting', expected: true },
            { from: 'pending', to: 'cancelled', expected: true },
            { from: 'pending', to: 'repairing', expected: false },
            { from: 'quoting', to: 'repairing', expected: true },
            { from: 'quoting', to: 'ready', expected: false },
            { from: 'repairing', to: 'ready', expected: true },
            { from: 'repairing', to: 'completed', expected: false },
            { from: 'ready', to: 'completed', expected: true },
            { from: 'completed', to: 'pending', expected: false },
            { from: 'cancelled', to: 'pending', expected: false }
        ];

        let statusTestsPassed = true;
        for (const tc of testCases) {
            const result = db.canTransition(tc.from, tc.to);
            const passed = result === tc.expected;
            if (!passed) {
                console.log(`  ❌ 失败: ${db.getStatusName(tc.from)} -> ${db.getStatusName(tc.to)} 应该是 ${tc.expected}，实际是 ${result}`);
                statusTestsPassed = false;
            }
        }

        if (statusTestsPassed) {
            console.log('  ✅ 所有状态流转测试通过');
        } else {
            allPassed = false;
        }

        console.log('\n[测试 2] 测试状态名称映射...');
        const statusNames = ['pending', 'quoting', 'repairing', 'ready', 'completed', 'cancelled'];
        let nameTestsPassed = true;
        for (const status of statusNames) {
            const name = db.getStatusName(status);
            if (!name || name === status) {
                console.log(`  ❌ 状态 ${status} 缺少中文名称`);
                nameTestsPassed = false;
            }
        }

        if (nameTestsPassed) {
            console.log('  ✅ 所有状态名称映射正确');
        } else {
            allPassed = false;
        }

        console.log('\n' + '='.repeat(60));
        if (allPassed) {
            console.log('✅ 所有数据库测试通过！');
        } else {
            console.log('❌ 部分测试失败');
        }
        console.log('='.repeat(60));

    } catch (error) {
        console.error('\n❌ 数据库测试失败:', error.message);
        allPassed = false;
    }

    return allPassed;
}

async function main() {
    const args = process.argv.slice(2);

    if (args.includes('--db-only')) {
        const passed = await runDatabaseTests();
        process.exit(passed ? 0 : 1);
    } else if (args.includes('--db')) {
        await runDatabaseTests();
        console.log('\n');
    }

    await testFullWorkflow();
}

main();

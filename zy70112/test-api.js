const http = require('http');

function request(options, body = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch (e) {
                    resolve({ status: res.statusCode, data });
                }
            });
        });
        
        req.on('error', reject);
        
        if (body) {
            req.write(body);
        }
        req.end();
    });
}

const baseOptions = {
    hostname: 'localhost',
    port: 3000,
    headers: {
        'Content-Type': 'application/json',
        'X-Operator': 'test_user'
    }
};

async function runTests() {
    console.log('\n=== 农险灾损报案 API 测试 ===\n');

    // 1. 创建报案
    console.log('1. 创建报案');
    const createRes = await request(
        { ...baseOptions, path: '/api/reports', method: 'POST' },
        JSON.stringify({
            farmer_name: '张三',
            farmer_id: '110101199001011234',
            phone: '13800138000',
            insurance_policy_no: 'POL2024001',
            crop_type: '小麦',
            disaster_type: '暴雨',
            disaster_time: '2024-07-15 14:30:00',
            description: '暴雨导致小麦倒伏'
        })
    );
    console.log('状态码:', createRes.status);
    console.log('报案号:', createRes.data.data.report_no);
    console.log('状态:', createRes.data.data.status);
    
    const reportId = createRes.data.data.id;

    // 2. 添加地块
    console.log('\n2. 添加地块');
    const plotRes = await request(
        { ...baseOptions, path: `/api/reports/${reportId}/plots`, method: 'POST' },
        JSON.stringify({
            plot_name: '东地块',
            polygon_geojson: JSON.stringify({ type: 'Polygon', coordinates: [[[116.4, 39.9], [116.5, 39.9], [116.5, 40.0], [116.4, 40.0], [116.4, 39.9]]] }),
            area_sqm: 50000
        })
    );
    console.log('状态码:', plotRes.status);
    console.log('地块数量:', plotRes.data.data.report_summary.plot_count);

    // 3. 添加天气证据
    console.log('\n3. 添加天气证据');
    const weatherRes = await request(
        { ...baseOptions, path: `/api/reports/${reportId}/weather`, method: 'POST' },
        JSON.stringify({
            weather_type: '暴雨',
            occurred_time: '2024-07-15 14:00:00',
            intensity: '50mm/24h',
            source: '国家气象站',
            raw_data: '{"rainfall":50,"duration":24}'
        })
    );
    console.log('状态码:', weatherRes.status);
    console.log('天气证据数量:', weatherRes.data.data.report_summary.weather_count);

    // 4. 检查提交条件
    console.log('\n4. 检查提交条件（缺少照片）');
    const readinessRes = await request(
        { ...baseOptions, path: `/api/reports/${reportId}/check-readiness`, method: 'GET' }
    );
    console.log('状态码:', readinessRes.status);
    console.log('是否满足:', readinessRes.data.data.ready);
    console.log('缺少:', JSON.stringify(readinessRes.data.data.missing));

    // 5. 获取报案详情
    console.log('\n5. 获取报案详情');
    const detailRes = await request(
        { ...baseOptions, path: `/api/reports/${reportId}`, method: 'GET' }
    );
    console.log('状态码:', detailRes.status);
    console.log('地块数量:', detailRes.data.data.summary.plot_count);
    console.log('天气证据数量:', detailRes.data.data.summary.weather_count);
    console.log('状态日志数量:', detailRes.data.data.status_logs.length);

    // 6. 尝试非法状态转换
    console.log('\n6. 尝试非法状态转换（DRAFT -> INSPECTED）');
    const illegalTransitionRes = await request(
        { ...baseOptions, path: `/api/reports/${reportId}/status`, method: 'POST' },
        JSON.stringify({
            to_status: 'INSPECTED',
            reason: '测试非法转换'
        })
    );
    console.log('状态码:', illegalTransitionRes.status);
    console.log('错误:', illegalTransitionRes.data.error);

    // 7. 列出所有报案
    console.log('\n7. 列出所有报案');
    const listRes = await request(
        { ...baseOptions, path: '/api/reports', method: 'GET' }
    );
    console.log('状态码:', listRes.status);
    console.log('报案数量:', listRes.data.data.length);

    // 8. 导出汇总
    console.log('\n8. 导出汇总统计');
    const summaryRes = await request(
        { ...baseOptions, path: '/api/export/summary', method: 'GET' }
    );
    console.log('状态码:', summaryRes.status);
    console.log('汇总数据:', JSON.stringify(summaryRes.data.data));

    console.log('\n=== 测试完成 ===\n');
}

runTests().catch(console.error);

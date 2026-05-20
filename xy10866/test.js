const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');

function cleanData() {
    if (fs.existsSync(DATA_DIR)) {
        fs.rmSync(DATA_DIR, { recursive: true, force: true });
    }
}

async function runTests() {
    console.log('🧪 开始运行服务目录归属 API 自检测试\n');
    
    cleanData();
    
    const baseURL = 'http://localhost:3000/api';
    
    async function request(method, path, body = null) {
        const options = {
            method,
            headers: { 'Content-Type': 'application/json' }
        };
        if (body) options.body = JSON.stringify(body);
        const res = await fetch(baseURL + path, options);
        const data = await res.json();
        return { status: res.status, data };
    }
    
    let passed = 0;
    let failed = 0;
    
    function test(name, condition) {
        if (condition) {
            console.log(`✅ ${name}`);
            passed++;
        } else {
            console.log(`❌ ${name}`);
            failed++;
        }
    }
    
    try {
        console.log('📋 ===== 健康检查测试 =====');
        const health = await request('GET', '/health');
        test('API服务正常运行', health.status === 200);
        test('返回状态字段', health.data.status === 'ok');
        
        console.log('\n👤 ===== 负责人管理测试 =====');
        const owner1 = await request('POST', '/owners', {
            name: '张三',
            email: 'zhangsan@example.com',
            team: '平台架构组',
            phone: '13800138001'
        });
        test('创建负责人成功', owner1.status === 200);
        test('返回ID字段', !!owner1.data.id);
        
        const owner2 = await request('POST', '/owners', {
            name: '李四',
            email: 'lisi@example.com',
            team: '业务开发组'
        });
        const ownerId1 = owner1.data.id;
        const ownerId2 = owner2.data.id;
        
        const owners = await request('GET', '/owners');
        test('查询负责人列表', owners.status === 200 && owners.data.length >= 2);
        
        const ownerDetail = await request('GET', `/owners/${ownerId1}`);
        test('查询负责人详情', ownerDetail.status === 200);
        test('负责人详情包含服务列表', Array.isArray(ownerDetail.data.services));
        
        console.log('\n🌍 ===== 运行环境测试 =====');
        const env1 = await request('POST', '/environments', {
            name: '生产环境',
            type: 'prod',
            url: 'https://api.example.com',
            description: '对外生产环境'
        });
        test('创建运行环境成功', env1.status === 200);
        test('环境默认状态为active', env1.data.status === 'active');
        
        const env2 = await request('POST', '/environments', {
            name: '测试环境',
            type: 'test',
            description: '内部测试环境'
        });
        const envId1 = env1.data.id;
        const envId2 = env2.data.id;
        
        const environments = await request('GET', '/environments');
        test('查询环境列表', environments.status === 200 && environments.data.length >= 2);
        
        const envDetail = await request('GET', `/environments/${envId1}`);
        test('查询环境详情', envDetail.status === 200);
        test('环境详情包含部署服务列表', Array.isArray(envDetail.data.services));
        
        const filteredEnvs = await request('GET', '/environments?type=prod');
        test('按类型过滤环境', filteredEnvs.data.every(e => e.type === 'prod'));
        
        console.log('\n🔧 ===== 服务管理测试 =====');
        const service1 = await request('POST', '/services', {
            name: '用户认证服务',
            description: '负责用户登录、注册、权限验证',
            ownerId: ownerId1
        });
        test('创建服务成功', service1.status === 200);
        test('服务默认状态为planning', service1.data.status === 'planning');
        test('服务默认无失联风险', service1.data.contactLostRisk === false);
        test('服务默认环境列表为空', Array.isArray(service1.data.environments));
        
        const serviceId1 = service1.data.id;
        
        const service2 = await request('POST', '/services', {
            name: '订单处理服务',
            description: '电商订单全生命周期管理',
            ownerId: ownerId2
        });
        const serviceId2 = service2.data.id;
        
        const services = await request('GET', '/services');
        test('查询服务列表', services.status === 200 && services.data.length >= 2);
        
        const serviceDetail = await request('GET', `/services/${serviceId1}`);
        test('查询服务详情', serviceDetail.status === 200);
        test('服务详情包含负责人信息', !!serviceDetail.data.owner);
        test('服务详情包含接口列表', Array.isArray(serviceDetail.data.endpoints));
        test('服务详情包含交接记录', Array.isArray(serviceDetail.data.transitions));
        test('服务详情包含环境信息', Array.isArray(serviceDetail.data.environments));
        
        const searchResult = await request('GET', '/services?search=认证');
        test('服务搜索功能', searchResult.data.some(s => s.name.includes('认证')));
        
        const statusFilterResult = await request('GET', '/services?status=planning');
        test('按状态过滤服务', statusFilterResult.data.every(s => s.status === 'planning'));
        
        console.log('\n🔗 ===== 服务-环境绑定测试 =====');
        const bindResult = await request('POST', `/services/${serviceId1}/bind-environment`, {
            environmentId: envId1
        });
        test('绑定环境成功', bindResult.status === 200);
        
        const serviceWithEnv = await request('GET', `/services/${serviceId1}`);
        test('服务已绑定环境', serviceWithEnv.data.environments.length >= 1);
        test('绑定的环境信息正确', serviceWithEnv.data.environments.some(e => e.id === envId1));
        
        const bindEnv2 = await request('POST', `/services/${serviceId1}/bind-environment`, {
            environmentId: envId2
        });
        test('绑定第二个环境成功', bindEnv2.status === 200);
        
        const serviceWithMultiEnv = await request('GET', `/services/${serviceId1}`);
        test('服务支持多环境绑定', serviceWithMultiEnv.data.environments.length >= 2);
        
        const envWithServices = await request('GET', `/environments/${envId1}`);
        test('环境详情包含部署的服务', envWithServices.data.services.length >= 1);
        
        const unbindResult = await request('POST', `/services/${serviceId1}/unbind-environment`, {
            environmentId: envId2
        });
        test('解绑环境成功', unbindResult.status === 200);
        
        const serviceAfterUnbind = await request('GET', `/services/${serviceId1}`);
        test('环境已从服务移除', serviceAfterUnbind.data.environments.length === 1);
        
        console.log('\n📈 ===== 服务状态推进测试 =====');
        const statusFlow = await request('GET', `/services/${serviceId1}/status-flow`);
        test('获取状态流转信息', statusFlow.status === 200);
        test('返回当前状态', !!statusFlow.data.currentStatus);
        test('返回允许的状态转换', Array.isArray(statusFlow.data.allowedTransitions));
        
        const advanceToDev = await request('POST', `/services/${serviceId1}/advance-status`, {
            targetStatus: 'development',
            reason: '开始开发阶段'
        });
        test('状态推进到开发中', advanceToDev.status === 200);
        test('返回状态变更信息', advanceToDev.data.previousStatus === 'planning');
        
        const serviceAfterDev = await request('GET', `/services/${serviceId1}`);
        test('服务状态已更新为开发中', serviceAfterDev.data.status === 'development');
        
        const advanceToTest = await request('POST', `/services/${serviceId1}/advance-status`, {
            targetStatus: 'testing',
            reason: '开发完成，进入测试'
        });
        test('状态推进到测试中', advanceToTest.status === 200);
        
        const advanceToActive = await request('POST', `/services/${serviceId1}/advance-status`, {
            targetStatus: 'active',
            reason: '测试通过，正式上线'
        });
        test('状态推进到已上线', advanceToActive.status === 200);
        
        const serviceActive = await request('GET', `/services/${serviceId1}`);
        test('服务状态已更新为已上线', serviceActive.data.status === 'active');
        
        const serviceWithTransitions = await request('GET', `/services/${serviceId1}`);
        const statusTransitions = serviceWithTransitions.data.transitions.filter(t => t.transitionType === 'status_change');
        test('状态变更记录已保存', statusTransitions.length >= 3);
        
        const invalidAdvance = await request('POST', `/services/${serviceId1}/advance-status`, {
            targetStatus: 'planning'
        });
        test('非法状态转换被拒绝', invalidAdvance.status === 400);
        
        console.log('\n🔌 ===== 接口归属测试 =====');
        const endpoint1 = await request('POST', '/endpoints', {
            serviceId: serviceId1,
            method: 'POST',
            path: '/api/v1/auth/login',
            description: '用户登录接口'
        });
        test('创建接口成功', endpoint1.status === 200);
        
        const endpoint2 = await request('POST', '/endpoints', {
            serviceId: serviceId1,
            method: 'GET',
            path: '/api/v1/user/info',
            description: '获取用户信息',
            ownerId: ownerId2
        });
        const endpointId2 = endpoint2.data.id;
        
        const endpoints = await request('GET', '/endpoints');
        test('查询接口列表', endpoints.status === 200 && endpoints.data.length >= 2);
        
        const endpointDetail = await request('GET', `/endpoints/${endpointId2}`);
        test('查询接口详情', endpointDetail.status === 200);
        
        const filteredEndpoints = await request('GET', '/endpoints?method=POST');
        test('按方法过滤接口', filteredEndpoints.data.every(e => e.method === 'POST'));
        
        console.log('\n🔄 ===== 负责人变更测试 =====');
        const changeResult = await request('POST', `/services/${serviceId1}/change-owner`, {
            newOwnerId: ownerId2,
            reason: '组织架构调整，服务交接'
        });
        test('负责人变更成功', changeResult.status === 200);
        
        const updatedService = await request('GET', `/services/${serviceId1}`);
        test('服务负责人已更新', updatedService.data.ownerId === ownerId2);
        
        const ownerTransitions = updatedService.data.transitions.filter(t => t.transitionType === 'owner_change');
        test('负责人交接记录已创建', ownerTransitions.length >= 1);
        
        const transitions = await request('GET', `/transitions?serviceId=${serviceId1}`);
        test('查询交接记录列表', transitions.status === 200 && transitions.data.length >= 1);
        
        console.log('\n⚠️ ===== 失联告警测试 =====');
        const alertResult = await request('POST', `/services/${serviceId2}/alert-lost`, {
            notes: '负责人已离职多日，无法联系，服务存在维护风险'
        });
        test('标记失联风险成功', alertResult.status === 200);
        
        const serviceAtRisk = await request('GET', `/services/${serviceId2}`);
        test('服务已标记失联风险', serviceAtRisk.data.contactLostRisk === true);
        
        const alerts = await request('GET', '/alerts?status=open');
        test('告警记录已创建', alerts.data.length >= 1);
        
        console.log('\n📊 ===== 统计数据测试 =====');
        const stats = await request('GET', '/stats');
        test('获取统计数据', stats.status === 200);
        test('统计包含服务数', typeof stats.data.services === 'number');
        test('统计包含接口数', typeof stats.data.endpoints === 'number');
        test('统计包含负责人数', typeof stats.data.owners === 'number');
        test('统计包含环境数', typeof stats.data.environments === 'number');
        test('统计包含活跃告警数', typeof stats.data.activeAlerts === 'number');
        test('统计包含失联风险服务数', typeof stats.data.atRiskServices === 'number');
        test('统计包含API请求数', typeof stats.data.totalRequests === 'number');
        
        console.log('\n📝 ===== 请求日志测试 =====');
        const requests = await request('GET', '/requests');
        test('获取请求日志', requests.status === 200);
        test('请求日志有记录', requests.data.length > 0);
        
        console.log('\n📤 ===== 目录导出测试 =====');
        const exportRes = await fetch(baseURL + '/export/directory');
        const exportData = await exportRes.json();
        test('导出接口正常', exportRes.status === 200);
        test('导出包含摘要信息', !!exportData.summary);
        test('导出包含服务列表', Array.isArray(exportData.services));
        test('导出包含环境列表', Array.isArray(exportData.environments));
        test('导出服务包含负责人信息', exportData.services[0].owner !== undefined);
        test('导出服务包含环境信息', Array.isArray(exportData.services[0].environments));
        test('导出摘要包含环境总数', exportData.summary.totalEnvironments !== undefined);
        
        console.log('\n❌ ===== 异常处理测试 =====');
        const badService = await request('POST', '/services', { name: '测试' });
        test('缺少必填字段返回错误', badService.status >= 400);
        
        const notFound = await request('GET', '/services/non-existent-id');
        test('不存在资源返回404', notFound.status === 404);
        
        const badEnvBind = await request('POST', `/services/${serviceId1}/bind-environment`, {
            environmentId: 'non-existent-env'
        });
        test('绑定不存在的环境返回404', badEnvBind.status === 404);
        
        console.log('\n💾 ===== 数据持久化验证 =====');
        test('数据目录已创建', fs.existsSync(DATA_DIR));
        test('服务数据文件存在', fs.existsSync(path.join(DATA_DIR, 'services.json')));
        test('接口数据文件存在', fs.existsSync(path.join(DATA_DIR, 'endpoints.json')));
        test('负责人数据文件存在', fs.existsSync(path.join(DATA_DIR, 'owners.json')));
        test('环境数据文件存在', fs.existsSync(path.join(DATA_DIR, 'environments.json')));
        test('交接记录文件存在', fs.existsSync(path.join(DATA_DIR, 'transitions.json')));
        test('告警记录文件存在', fs.existsSync(path.join(DATA_DIR, 'alerts.json')));
        test('请求日志文件存在', fs.existsSync(path.join(DATA_DIR, 'requests.json')));
        
    } catch (e) {
        console.error('\n❌ 测试执行出错:', e.message);
        console.error(e.stack);
        failed++;
    }
    
    console.log('\n' + '='.repeat(50));
    console.log(`📊 测试结果: 通过 ${passed} / 失败 ${failed}`);
    console.log(`🎯 通过率: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
    console.log('='.repeat(50));
    
    if (failed === 0) {
        console.log('\n🎉 所有测试通过！服务目录归属 API 运行正常。');
        process.exit(0);
    } else {
        console.log('\n⚠️  部分测试失败，请检查服务配置。');
        process.exit(1);
    }
}

if (require.main === module) {
    runTests();
}

module.exports = { runTests, cleanData };

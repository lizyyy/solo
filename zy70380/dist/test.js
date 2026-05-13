"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const BASE_URL = 'http://localhost:3000/api';
function request(url, options, data) {
    return new Promise((resolve, reject) => {
        const req = http_1.default.request(url, options, (res) => {
            let body = '';
            res.on('data', (chunk) => {
                body += chunk;
            });
            res.on('end', () => {
                try {
                    const result = body ? JSON.parse(body) : {};
                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(result);
                    }
                    else {
                        reject(new Error(`${res.statusCode}: ${JSON.stringify(result)}`));
                    }
                }
                catch (e) {
                    reject(e);
                }
            });
        });
        req.on('error', reject);
        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}
const get = (path) => request(`${BASE_URL}${path}`, { method: 'GET' });
const post = (path, data) => request(`${BASE_URL}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, data);
async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
async function testAllScenarios() {
    console.log('='.repeat(80));
    console.log('积分流水重算 API 测试');
    console.log('='.repeat(80));
    try {
        console.log('\n--- 1. 创建测试数据 ---');
        console.log('\n1.1 创建旧版积分规则（按金额取整）');
        const oldRule = await post('/point-rules', {
            version: 'v1.0.0',
            name: '旧版规则-按金额取整',
            description: '旧版规则，所有品类统一1倍积分（按金额取整）',
            rules: [
                { category: 'default', multiplier: 1 }
            ],
            effectiveAt: '2026-02-01T00:00:00.000Z'
        });
        console.log('旧版规则ID:', oldRule.id);
        console.log('\n1.2 创建新版积分规则（按品类倍率）');
        const newRule = await post('/point-rules', {
            version: 'v2.0.0',
            name: '新版规则-按品类倍率',
            description: '新版规则，不同品类使用不同倍率',
            rules: [
                { category: '电子', multiplier: 3 },
                { category: '服装', multiplier: 2 },
                { category: '食品', multiplier: 1.5 },
                { category: '日用', multiplier: 1 }
            ],
            effectiveAt: '2026-05-01T00:00:00.000Z'
        });
        console.log('新版规则ID:', newRule.id);
        console.log('\n1.3 冻结新版规则');
        await post(`/point-rules/${newRule.id}/freeze`, {});
        console.log('新版规则已冻结');
        console.log('\n1.4 创建测试会员');
        const member1 = await post('/members', { name: '张三', phone: '13800138001' });
        const member2 = await post('/members', { name: '李四', phone: '13800138002' });
        const member3 = await post('/members', { name: '王五', phone: '13800138003' });
        console.log('会员1:', member1.id, member1.name);
        console.log('会员2:', member2.id, member2.name);
        console.log('会员3:', member3.id, member3.name);
        console.log('\n--- 2. 场景1：正常重算（正向差异）---');
        console.log('会员1消费并获得积分（旧规则）');
        const t1_1 = await post('/transactions', {
            memberId: member1.id,
            amount: 100,
            category: '电子',
            ruleVersionId: oldRule.id,
            createdAt: '2026-04-01T10:00:00.000Z'
        });
        const t1_2 = await post('/transactions', {
            memberId: member1.id,
            amount: 200,
            category: '服装',
            ruleVersionId: oldRule.id,
            createdAt: '2026-04-15T14:00:00.000Z'
        });
        console.log('会员1旧积分（查看积分流水）');
        const member1Logs = await get(`/members/${member1.id}/point-logs`);
        console.log('会员1当前积分流水:', JSON.stringify(member1Logs, null, 2));
        console.log('\n创建重算任务（最近三个月）');
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        const task1Result = await post('/recalculation-tasks', {
            name: 'v2规则重算-测试1',
            description: '测试正向差异重算',
            ruleVersionId: newRule.id,
            memberIds: [member1.id],
            startTime: threeMonthsAgo.toISOString(),
            endTime: new Date().toISOString(),
            autoExecute: true
        });
        console.log('重算任务ID:', task1Result.task.id);
        console.log('是否已存在任务:', task1Result.isExisting);
        await delay(1000);
        console.log('\n查询重算结果');
        const task1 = await get(`/recalculation-tasks/${task1Result.task.id}`);
        console.log('任务状态:', task1.status);
        console.log('任务进度:', task1.progress);
        const task1Results = await get(`/recalculation-tasks/${task1Result.task.id}/results`);
        console.log('会员1重算结果:', JSON.stringify(task1Results[0], null, 2));
        console.log('\n查看差异来源详情');
        const member1Result = await get(`/recalculation-tasks/${task1Result.task.id}/results/${member1.id}`);
        console.log('差异来源:', JSON.stringify(member1Result.detailSources, null, 2));
        console.log('\n应用正向补偿');
        await post(`/recalculation-tasks/${task1Result.task.id}/apply-positive`, {});
        console.log('正向补偿已应用');
        console.log('\n查看补偿后的积分流水');
        const member1LogsAfter = await get(`/members/${member1.id}/point-logs`);
        console.log('会员1积分流水:', JSON.stringify(member1LogsAfter, null, 2));
        console.log('\n查看重算报告');
        const report1 = await get(`/recalculation-tasks/${task1Result.task.id}/report`);
        console.log('重算报告摘要:', JSON.stringify(report1.summary, null, 2));
        console.log('\n--- 3. 场景2：已兑换积分锁定 ---');
        console.log('会员2消费并兑换礼品');
        await post('/transactions', {
            memberId: member2.id,
            amount: 500,
            category: '电子',
            ruleVersionId: oldRule.id,
            createdAt: '2026-04-01T10:00:00.000Z'
        });
        const redemption = await post('/redemptions', {
            memberId: member2.id,
            points: 300,
            giftName: '豪华礼品',
            giftId: 'gift001'
        });
        await post(`/redemptions/${redemption.id}/confirm`, {});
        console.log('会员2已兑换300积分');
        const member2Locked = await get(`/members/${member2.id}/locked-points`);
        console.log('会员2锁定积分:', member2Locked.lockedPoints);
        console.log('\n创建重算任务');
        const task2Result = await post('/recalculation-tasks', {
            name: 'v2规则重算-测试2',
            description: '测试已兑换锁定',
            ruleVersionId: newRule.id,
            memberIds: [member2.id],
            startTime: threeMonthsAgo.toISOString(),
            endTime: new Date().toISOString(),
            autoExecute: true
        });
        await delay(1000);
        const member2Result = await get(`/recalculation-tasks/${task2Result.task.id}/results/${member2.id}`);
        console.log('会员2重算结果:');
        console.log('  原积分:', member2Result.originalPoints);
        console.log('  新积分:', member2Result.newPoints);
        console.log('  差异:', member2Result.difference);
        console.log('  锁定积分:', member2Result.lockedPoints);
        console.log('  净差异:', member2Result.netDifference);
        console.log('  状态:', member2Result.status);
        console.log('\n已兑换锁定原因说明：');
        console.log('  会员2原有500积分（500元消费 x 1倍）');
        console.log('  已兑换300积分，这部分积分已经被使用');
        console.log('  剩余可用积分：500 - 300 = 200');
        console.log('  重算后新积分：500元 x 3倍 = 1500');
        console.log('  差异：1500 - 500 = +1000');
        console.log('  锁定积分300表示这部分积分已经兑换，不能变动');
        console.log('  净差异+1000表示可以补偿的积分');
        console.log('\n--- 4. 场景3：负差异待审核 ---');
        console.log('会员3消费高倍率品类（旧规则1倍，新规则降低）');
        await post('/transactions', {
            memberId: member3.id,
            amount: 1000,
            category: '电子',
            ruleVersionId: oldRule.id,
            createdAt: '2026-04-01T10:00:00.000Z'
        });
        const redemption3 = await post('/redemptions', {
            memberId: member3.id,
            points: 300,
            giftName: '高级礼品',
            giftId: 'gift002'
        });
        await post(`/redemptions/${redemption3.id}/confirm`, {});
        console.log('会员3已兑换300积分');
        console.log('\n创建一个特殊规则（降低电子品类倍率）');
        const lowerRule = await post('/point-rules', {
            version: 'v2.1.0',
            name: '降低倍率规则',
            description: '测试负差异场景',
            rules: [
                { category: '电子', multiplier: 0.5 },
                { category: '服装', multiplier: 2 },
                { category: '食品', multiplier: 1.5 },
                { category: '日用', multiplier: 1 }
            ],
            effectiveAt: '2026-05-01T00:00:00.000Z'
        });
        await post(`/point-rules/${lowerRule.id}/freeze`, {});
        console.log('\n创建重算任务');
        console.log('场景说明：');
        console.log('  - 会员3消费1000元（电子品类）');
        console.log('  - 旧规则：1000 x 1 = 1000积分');
        console.log('  - 新规则：1000 x 0.5 = 500积分');
        console.log('  - 差异：500 - 1000 = -500');
        console.log('  - 已兑换300积分（锁定）');
        console.log('  - 可用积分：1000 - 300 = 700');
        console.log('  - 扣减需求500 < 可用700，可以直接扣减');
        const task3Result = await post('/recalculation-tasks', {
            name: '负差异测试',
            description: '测试负差异待审核',
            ruleVersionId: lowerRule.id,
            memberIds: [member3.id],
            startTime: threeMonthsAgo.toISOString(),
            endTime: new Date().toISOString(),
            autoExecute: true
        });
        await delay(1000);
        const member3Result = await get(`/recalculation-tasks/${task3Result.task.id}/results/${member3.id}`);
        console.log('会员3重算结果:');
        console.log('  原积分:', member3Result.originalPoints);
        console.log('  新积分:', member3Result.newPoints);
        console.log('  差异:', member3Result.difference);
        console.log('  锁定积分:', member3Result.lockedPoints);
        console.log('  净差异:', member3Result.netDifference);
        console.log('  状态:', member3Result.status);
        console.log('\n创建另一个测试会员来测试待审核场景');
        const member4 = await post('/members', { name: '赵六', phone: '13800138004' });
        await post('/transactions', {
            memberId: member4.id,
            amount: 2000,
            category: '电子',
            ruleVersionId: oldRule.id,
            createdAt: '2026-04-01T10:00:00.000Z'
        });
        const redemption4 = await post('/redemptions', {
            memberId: member4.id,
            points: 1800,
            giftName: '顶级礼品',
            giftId: 'gift003'
        });
        await post(`/redemptions/${redemption4.id}/confirm`, {});
        console.log('会员4已兑换1800积分');
        console.log('\n场景说明（待审核场景）：');
        console.log('  - 会员4消费2000元（电子品类）');
        console.log('  - 旧规则：2000 x 1 = 2000积分');
        console.log('  - 新规则：2000 x 0.5 = 1000积分');
        console.log('  - 差异：1000 - 2000 = -1000');
        console.log('  - 已兑换1800积分（锁定）');
        console.log('  - 可用积分：2000 - 1800 = 200');
        console.log('  - 扣减需求1000 > 可用200，超出部分待审核');
        const task4Result = await post('/recalculation-tasks', {
            name: '负差异待审核测试',
            description: '测试负差异待审核场景',
            ruleVersionId: lowerRule.id,
            memberIds: [member4.id],
            startTime: threeMonthsAgo.toISOString(),
            endTime: new Date().toISOString(),
            autoExecute: true
        });
        await delay(1000);
        const member4Result = await get(`/recalculation-tasks/${task4Result.task.id}/results/${member4.id}`);
        console.log('会员4重算结果:');
        console.log('  原积分:', member4Result.originalPoints);
        console.log('  新积分:', member4Result.newPoints);
        console.log('  差异:', member4Result.difference);
        console.log('  锁定积分:', member4Result.lockedPoints);
        console.log('  净差异:', member4Result.netDifference);
        console.log('  状态:', member4Result.status);
        console.log('\n查看待审核扣减');
        const adjustments = await get(`/recalculation-tasks/${task4Result.task.id}/adjustments`);
        console.log('待审核调整:', JSON.stringify(adjustments, null, 2));
        if (adjustments.length > 0) {
            console.log('\n待审核扣减说明：');
            console.log('  - 理论扣减：1000积分');
            console.log('  - 可直接扣减：200积分（可用积分）');
            console.log('  - 待审核扣减：800积分（超过可用部分）');
            console.log('  - 这部分需要运营确认是否执行扣减');
            console.log('\n确认扣减');
            const member4Pre = await get(`/members/${member4.id}`);
            console.log('  确认前会员积分:', member4Pre.points);
            await post(`/compensations/${adjustments[0].id}/confirm`, {
                operator: '运营人员A'
            });
            console.log('  扣减已确认');
            const confirmedAdjustment = await get(`/recalculation-tasks/${task4Result.task.id}/adjustments`);
            console.log('  调整状态:', confirmedAdjustment[0].status);
            const member4Post = await get(`/members/${member4.id}`);
            console.log('  确认后会员积分:', member4Post.points);
        }
        console.log('\n--- 5. 场景4：重复重算（幂等）---');
        console.log('再次创建相同范围的重算任务');
        const task1Duplicate = await post('/recalculation-tasks', {
            name: 'v2规则重算-测试1',
            description: '测试重复重算',
            ruleVersionId: newRule.id,
            memberIds: [member1.id],
            startTime: threeMonthsAgo.toISOString(),
            endTime: new Date().toISOString(),
            autoExecute: true
        });
        console.log('返回的任务ID:', task1Duplicate.task.id);
        console.log('原始任务ID:', task1Result.task.id);
        console.log('是否为已有任务:', task1Duplicate.isExisting);
        console.log('任务状态:', task1Duplicate.task.status);
        if (task1Duplicate.task.id === task1Result.task.id && task1Duplicate.isExisting) {
            console.log('✓ 幂等性验证通过：重复创建同一范围任务返回已有结果');
        }
        else {
            console.log('✗ 幂等性验证失败');
        }
        console.log('\n--- 6. 查询接口测试 ---');
        console.log('\n6.1 按会员查询重算任务进度');
        const tasksByMember = await get(`/recalculation-tasks?memberId=${member1.id}`);
        console.log('会员1参与的重算任务数:', tasksByMember.length);
        console.log('\n6.2 按时间范围查询重算任务');
        const tasksByTime = await get(`/recalculation-tasks?startTime=${threeMonthsAgo.toISOString()}`);
        console.log('最近三个月的重算任务数:', tasksByTime.length);
        console.log('\n6.3 按状态查询重算任务');
        const completedTasks = await get('/recalculation-tasks?status=completed');
        console.log('已完成的重算任务数:', completedTasks.length);
        console.log('\n' + '='.repeat(80));
        console.log('所有测试场景完成！');
        console.log('='.repeat(80));
        console.log('\n--- curl 示例 ---');
        console.log('\n1. 正常重算（正向差异）：');
        console.log(`curl -X POST http://localhost:3000/api/recalculation-tasks \\`);
        console.log(`  -H "Content-Type: application/json" \\`);
        console.log(`  -d '{`);
        console.log(`    "name": "v2规则重算",`);
        console.log(`    "description": "会员积分规则从按金额取整改为按品类倍率",`);
        console.log(`    "ruleVersionId": "${newRule.id}",`);
        console.log(`    "memberIds": ["${member1.id}"],`);
        console.log(`    "startTime": "${threeMonthsAgo.toISOString()}",`);
        console.log(`    "endTime": "${new Date().toISOString()}",`);
        console.log(`    "autoExecute": true`);
        console.log(`  }'`);
        console.log('\n2. 已兑换锁定：');
        console.log(`# 会员2有已兑换积分，重算时显示lockedPoints`);
        console.log(`curl -X GET "http://localhost:3000/api/recalculation-tasks/${task2Result.task.id}/results/${member2.id}"`);
        console.log('\n3. 负差异待审核：');
        console.log(`# 查看待审核扣减`);
        console.log(`curl -X GET "http://localhost:3000/api/recalculation-tasks/${task3Result.task.id}/adjustments"`);
        console.log(`\n# 确认扣减`);
        console.log(`curl -X POST "http://localhost:3000/api/compensations/ADJUSTMENT_ID/confirm" \\`);
        console.log(`  -H "Content-Type: application/json" \\`);
        console.log(`  -d '{"operator": "运营人员"}'`);
        console.log('\n4. 重复重算（幂等）：');
        console.log(`# 再次提交相同参数，返回已有任务`);
        console.log(`curl -X POST http://localhost:3000/api/recalculation-tasks \\`);
        console.log(`  -H "Content-Type: application/json" \\`);
        console.log(`  -d '{`);
        console.log(`    "name": "v2规则重算-测试1",`);
        console.log(`    "ruleVersionId": "${newRule.id}",`);
        console.log(`    "memberIds": ["${member1.id}"],`);
        console.log(`    "startTime": "${threeMonthsAgo.toISOString()}",`);
        console.log(`    "endTime": "${new Date().toISOString()}"`);
        console.log(`  }'`);
        console.log('\n5. 查询重算报告：');
        console.log(`curl -X GET "http://localhost:3000/api/recalculation-tasks/${task1Result.task.id}/report"`);
        console.log('\n--- 边界说明 ---');
        console.log('\n主要边界：');
        console.log('1. 已兑换积分锁定：已确认兑换的积分(lockedPoints)不参与扣减');
        console.log('2. 负差异待审核：当重算差异为负且超过可用积分时，生成待审核扣减');
        console.log('3. 规则版本冻结：重算前必须冻结规则版本，防止规则变动');
        console.log('4. 幂等性：相同范围(规则版本+会员+时间)重复重算返回已有结果');
        console.log('\n一个失败路径：');
        console.log('1. 提交重算任务 → 规则版本未冻结 → 返回错误"Point rule version must be frozen"');
        console.log('2. 处理逻辑：');
        console.log('   - 创建任务前检查ruleVersion.isFrozen');
        console.log('   - 未冻结则抛出错误，阻止重算');
        console.log('3. 恢复方式：先调用/api/point-rules/:id/freeze冻结规则');
        console.log('\n一次重复执行路径：');
        console.log('1. 第一次提交重算任务（会员1 + 三个月 + v2规则）');
        console.log('   → 创建新任务 → 执行重算 → 状态completed');
        console.log('2. 第二次提交相同参数（会员1 + 三个月 + v2规则）');
        console.log('   → findExistingRecalculationTask查找匹配任务');
        console.log('   → 发现已有任务 → 直接返回已有结果（isExisting: true）');
        console.log('   → 不创建新任务，不重复执行');
    }
    catch (error) {
        console.error('测试失败:', error);
        process.exit(1);
    }
}
testAllScenarios();

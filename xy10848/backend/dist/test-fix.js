"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("./database");
const quotaService_1 = require("./services/quotaService");
async function testQuotaAmount() {
    console.log('\n=== 测试1: quota_amount 负数校验 ===');
    const db = await (0, database_1.getDb)();
    const members = await db.all('SELECT * FROM members LIMIT 1');
    const projects = await db.all('SELECT * FROM projects LIMIT 1');
    if (members.length === 0 || projects.length === 0) {
        console.log('❌ 请先运行 npm run seed 初始化数据');
        return false;
    }
    const result = await quotaService_1.quotaService.createGenerationRequest({
        member_id: members[0].id,
        project_id: projects[0].id,
        quota_amount: -100,
        idempotency_key: 'test-negative-' + Date.now()
    });
    if (result.success === false && result.error?.includes('必须为正整数')) {
        console.log('✅ 负数校验通过:', result.error);
        return true;
    }
    else {
        console.log('❌ 负数校验失败:', result);
        return false;
    }
}
async function testMemberProjectMapping() {
    console.log('\n=== 测试2: 成员-项目归属校验 ===');
    const db = await (0, database_1.getDb)();
    const members = await db.all('SELECT * FROM members LIMIT 2');
    if (members.length < 2) {
        console.log('❌ 需要至少2个成员进行测试');
        return false;
    }
    const member1Projects = await db.all('SELECT * FROM projects WHERE member_id = ? LIMIT 1', [members[0].id]);
    const member2Projects = await db.all('SELECT * FROM projects WHERE member_id = ? LIMIT 1', [members[1].id]);
    if (member1Projects.length === 0 || member2Projects.length === 0) {
        console.log('❌ 成员需要至少有一个项目');
        return false;
    }
    const result = await quotaService_1.quotaService.createGenerationRequest({
        member_id: members[0].id,
        project_id: member2Projects[0].id,
        quota_amount: 10,
        idempotency_key: 'test-mapping-' + Date.now()
    });
    if (result.success === false && result.error?.includes('项目不属于该成员')) {
        console.log('✅ 成员-项目归属校验通过:', result.error);
        return true;
    }
    else {
        console.log('❌ 成员-项目归属校验失败:', result);
        return false;
    }
}
async function testCompletedRequestFail() {
    console.log('\n=== 测试3: 已完成请求不能标记失败 ===');
    const db = await (0, database_1.getDb)();
    const members = await db.all('SELECT * FROM members LIMIT 1');
    const projects = await db.all('SELECT * FROM projects LIMIT 1');
    if (members.length === 0 || projects.length === 0) {
        console.log('❌ 请先运行 npm run seed 初始化数据');
        return false;
    }
    const createResult = await quotaService_1.quotaService.createGenerationRequest({
        member_id: members[0].id,
        project_id: projects[0].id,
        quota_amount: 10,
        idempotency_key: 'test-completed-' + Date.now()
    });
    if (!createResult.success || !createResult.request) {
        console.log('❌ 创建请求失败');
        return false;
    }
    await quotaService_1.quotaService.completeRequest(createResult.request.id);
    const failResult = await quotaService_1.quotaService.failRequest(createResult.request.id, '测试错误');
    if (failResult.success === false && failResult.error?.includes('仅 processing 状态允许')) {
        console.log('✅ 已完成请求不能标记失败校验通过:', failResult.error);
        return true;
    }
    else {
        console.log('❌ 已完成请求不能标记失败校验失败:', failResult);
        return false;
    }
}
async function testDuplicateReview() {
    console.log('\n=== 测试4: 已审核退费不能重复审核 ===');
    const db = await (0, database_1.getDb)();
    const members = await db.all('SELECT * FROM members LIMIT 1');
    const projects = await db.all('SELECT * FROM projects LIMIT 1');
    if (members.length === 0 || projects.length === 0) {
        console.log('❌ 请先运行 npm run seed 初始化数据');
        return false;
    }
    const createResult = await quotaService_1.quotaService.createGenerationRequest({
        member_id: members[0].id,
        project_id: projects[0].id,
        quota_amount: 10,
        idempotency_key: 'test-duplicate-' + Date.now()
    });
    if (!createResult.success || !createResult.request) {
        console.log('❌ 创建请求失败');
        return false;
    }
    const failResult = await quotaService_1.quotaService.failRequest(createResult.request.id, '测试错误');
    if (!failResult.success || !failResult.credit) {
        console.log('❌ 标记失败失败');
        return false;
    }
    await quotaService_1.quotaService.reviewCredit(failResult.credit.id, 'approved', '测试审核人', '测试备注');
    const secondReview = await quotaService_1.quotaService.reviewCredit(failResult.credit.id, 'approved', '测试审核人2', '重复审核');
    if (secondReview.success === false && secondReview.error?.includes('仅 pending 状态允许')) {
        console.log('✅ 重复审核校验通过:', secondReview.error);
        return true;
    }
    else {
        console.log('❌ 重复审核校验失败:', secondReview);
        return false;
    }
}
async function runAllTests() {
    console.log('🧪 开始运行修复验证测试...\n');
    const results = [
        await testQuotaAmount(),
        await testMemberProjectMapping(),
        await testCompletedRequestFail(),
        await testDuplicateReview()
    ];
    const passed = results.filter(r => r).length;
    const total = results.length;
    console.log(`\n${'='.repeat(50)}`);
    console.log(`📊 测试结果: ${passed}/${total} 项通过`);
    if (passed === total) {
        console.log('✅ 所有修复验证通过！');
        process.exit(0);
    }
    else {
        console.log('❌ 部分测试未通过，请检查修复');
        process.exit(1);
    }
}
runAllTests().catch((err) => {
    console.error('❌ 测试执行出错:', err);
    process.exit(1);
});

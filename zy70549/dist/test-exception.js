"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("./database");
const export_service_1 = require("./services/export.service");
const uuid_1 = require("uuid");
async function testExceptions() {
    console.log("=== 异常场景验证测试 ===\n");
    let passed = 0;
    let failed = 0;
    const db = await (0, database_1.initDatabase)();
    await (0, database_1.initializeSchema)(db);
    // 1. 测试：不存在的topicId不能创建申请
    console.log("[1/3] 测试：不存在的topicId不能创建申请...");
    try {
        await export_service_1.ExportService.createExportRequest("non-existent-topic", new Date().toISOString(), new Date().toISOString(), "test-user", "test reason");
        console.log("    ✗ 失败：应该抛出异常但没有");
        failed++;
    }
    catch (err) {
        if (err.message.includes("Topic not found")) {
            console.log("    ✓ 正确抛出异常: " + err.message);
            passed++;
        }
        else {
            console.log("    ✗ 错误异常信息: " + err.message);
            failed++;
        }
    }
    // 2. 创建一个有数据的主题和申请，测试未审批不能进行校验
    console.log("\n[2/3] 测试：未审批的申请不能进行哈希链校验...");
    const topicId = (0, uuid_1.v4)();
    await (0, database_1.runQuery)(`INSERT INTO log_topics (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`, [topicId, "exception-test-topic", "Exception test topic", new Date().toISOString(), new Date().toISOString()]);
    // 创建一些测试事件和哈希链
    for (let i = 1; i <= 3; i++) {
        const eventId = `test-event-${i}`;
        const eventTime = new Date(Date.now() - i * 60000).toISOString();
        await (0, database_1.runQuery)(`INSERT INTO audit_log_events (id, topic_id, event_type, actor, action, resource, details, timestamp, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [eventId, topicId, "test", "user", `action-${i}`, `res-${i}`, JSON.stringify({}), eventTime, new Date().toISOString()]);
        await (0, database_1.runQuery)(`INSERT INTO hash_chains (id, topic_id, event_id, event_timestamp, previous_hash, current_hash, event_content_hash, chain_sequence, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [(0, uuid_1.v4)(), topicId, eventId, eventTime, `prev-${i}`, `curr-${i}`, `h-${i}`, i, new Date().toISOString()]);
    }
    // 创建申请但不审批
    const startTime = new Date(Date.now() - 3600000).toISOString();
    const endTime = new Date().toISOString();
    const { request } = (await export_service_1.ExportService.createExportRequest(topicId, startTime, endTime, "test-user", "test reason", "test-exception-key"));
    try {
        await export_service_1.ExportService.verifyHashChain(request.id, "verifier");
        console.log("    ✗ 失败：应该抛出异常但没有");
        failed++;
    }
    catch (err) {
        if (err.message.includes("must be approved")) {
            console.log("    ✓ 正确抛出异常: " + err.message);
            passed++;
        }
        else {
            console.log("    ✗ 错误异常信息: " + err.message);
            failed++;
        }
    }
    // 3. 测试：0条哈希链数据时，报告不能说"数据未被篡改"
    console.log("\n[3/3] 测试：0条哈希链数据时，报告应正确标记失败...");
    // 创建一个新主题，没有哈希链数据
    const emptyTopicId = (0, uuid_1.v4)();
    await (0, database_1.runQuery)(`INSERT INTO log_topics (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`, [emptyTopicId, "empty-topic", "Empty topic test", new Date().toISOString(), new Date().toISOString()]);
    const emptyResult = await export_service_1.ExportService.createExportRequest(emptyTopicId, startTime, endTime, "test-user", "empty test", "empty-test-key");
    await export_service_1.ExportService.approveRequest(emptyResult.request.id, "approver");
    const verifyEmpty = await export_service_1.ExportService.verifyHashChain(emptyResult.request.id, "verifier");
    const reportEmpty = await export_service_1.ExportService.generateProofReport(emptyResult.request.id, "generator");
    if (!verifyEmpty.isValid &&
        reportEmpty.reportContent.conclusion.includes("未找到任何哈希链数据") &&
        !reportEmpty.reportContent.verification_details.hash_chain_integrity) {
        console.log("    ✓ 0条数据时正确标记为失败");
        console.log("      校验结果isValid:", verifyEmpty.isValid);
        console.log("      报告结论:", reportEmpty.reportContent.conclusion);
        console.log("      完整性标记:", reportEmpty.reportContent.verification_details.hash_chain_integrity);
        passed++;
    }
    else {
        console.log("    ✗ 0条数据处理不正确");
        console.log("      isValid:", verifyEmpty.isValid);
        console.log("      结论:", reportEmpty.reportContent.conclusion);
        failed++;
    }
    // 汇总
    console.log("\n=== 异常场景验证汇总 ===");
    console.log(`总测试项: ${passed + failed}`);
    console.log(`通过: ${passed}`);
    console.log(`失败: ${failed}`);
    console.log(`通过率: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
    if (failed === 0) {
        console.log("\n✓ 所有异常场景验证通过！");
        process.exit(0);
    }
    else {
        console.log("\n✗ 部分异常场景验证失败！");
        process.exit(1);
    }
}
testExceptions();

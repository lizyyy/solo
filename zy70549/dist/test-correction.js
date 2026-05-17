"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("./database");
const export_service_1 = require("./services/export.service");
const uuid_1 = require("uuid");
async function testCorrection() {
    console.log("=== 人工修正和异常处理接口测试 ===\n");
    const db = await (0, database_1.initDatabase)();
    await (0, database_1.initializeSchema)(db);
    // 创建测试主题和申请
    const topicId = (0, uuid_1.v4)();
    await (0, database_1.runQuery)(`INSERT INTO log_topics (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`, [topicId, "correction-test-topic", "Correction test", new Date().toISOString(), new Date().toISOString()]);
    const startTime = new Date(Date.now() - 3600000).toISOString();
    const endTime = new Date().toISOString();
    const { request } = await export_service_1.ExportService.createExportRequest(topicId, startTime, endTime, "test-user", "test reason", "correction-test-key");
    // 1. 测试人工修正
    console.log("[1/2] 测试：人工修正接口...");
    const correctionResult = await export_service_1.ExportService.addManualCorrection(request.id, "admin-user", "hash_chain_fix", { oldHash: "abc123" }, { newHash: "def456" }, "发现哈希链不匹配，已人工验证数据完整性后修正");
    if (correctionResult.correctionId) {
        console.log("    ✓ 人工修正成功");
        console.log("      修正ID:", correctionResult.correctionId.substring(0, 12), "...");
        console.log("      修正人:", correctionResult.corrector);
        console.log("      修正类型:", correctionResult.correctionType);
        console.log("      修正原因:", correctionResult.reason);
    }
    else {
        console.log("    ✗ 人工修正失败");
        process.exit(1);
    }
    // 2. 测试异常处理
    console.log("\n[2/2] 测试：异常处理接口...");
    const failureResult = await export_service_1.ExportService.handleFailure(request.id, "system-handler", new Error("模拟处理异常：网络连接超时"), { retryCount: 3, lastError: "Connection timeout" });
    if (failureResult && failureResult.status === "failed" && failureResult.final_conclusion) {
        console.log("    ✓ 异常处理成功");
        console.log("      请求状态:", failureResult.status);
        console.log("      失败原因:", failureResult.failure_reason);
        console.log("      最终结论:", failureResult.final_conclusion);
        console.log("      处理证据已保存:", !!failureResult.processing_evidence);
    }
    else {
        console.log("    ✗ 异常处理失败");
        process.exit(1);
    }
    // 验证处理历史记录
    const history = await export_service_1.ExportService.getProcessingHistory(request.id);
    console.log("\n处理历史记录数:", history.length);
    history.forEach((h, i) => {
        console.log(`  ${i + 1}. ${h.action} - ${h.actor} - ${new Date(h.timestamp).toLocaleTimeString()}`);
    });
    console.log("\n✓ 人工修正和异常处理接口全部验证通过！");
    process.exit(0);
}
testCorrection();

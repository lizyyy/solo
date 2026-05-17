import { initDatabase, initializeSchema, runQuery, getOne } from "./database";
import { ExportService } from "./services/export.service";
import { HashService } from "./services/hash.service";
import { v4 as uuidv4 } from "uuid";

async function testTamperDetection() {
  console.log("=== 审计日志篡改和删除检测测试 ===\n");

  const db = await initDatabase();
  await initializeSchema(db);

  // 创建测试主题
  const topicId = uuidv4();
  await runQuery(
    `INSERT INTO log_topics (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    [topicId, "tamper-test-topic", "Tamper detection test", new Date().toISOString(), new Date().toISOString()]
  );

  // 创建5个原始事件和正确的哈希链
  const startTime = new Date(Date.now() - 3600000).toISOString();
  const endTime = new Date().toISOString();
  const events: any[] = [];
  const hashChains: any[] = [];
  let prevHash = "genesis";

  for (let i = 1; i <= 5; i++) {
    const eventId = `event-${i}-${uuidv4().substring(0, 8)}`;
    const eventTime = new Date(Date.now() - (5 - i) * 60000).toISOString();
    const details = { index: i, action: `test-action-${i}`, user: "test-user" };
    const contentHash = HashService.generateHash(JSON.stringify(details));
    const currentHash = HashService.generateHash(`${eventId}|${eventTime}|${contentHash}|${prevHash}`);

    events.push({ id: eventId, topicId, timestamp: eventTime, details, contentHash, currentHash });
    hashChains.push({ id: uuidv4(), topicId, eventId, eventTime, prevHash, currentHash, contentHash, sequence: i });

    await runQuery(
      `INSERT INTO audit_log_events (id, topic_id, event_type, actor, action, resource, details, timestamp, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [eventId, topicId, "test", "test-user", `action-${i}`, `res-${i}`, JSON.stringify(details), eventTime, new Date().toISOString()]
    );
    await runQuery(
      `INSERT INTO hash_chains (id, topic_id, event_id, event_timestamp, previous_hash, current_hash, event_content_hash, chain_sequence, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), topicId, eventId, eventTime, prevHash, currentHash, contentHash, i, new Date().toISOString()]
    );

    prevHash = currentHash;
  }

  console.log("[1/4] 测试：原始未篡改数据应校验通过...");
  const result1 = await ExportService.createExportRequest(
    topicId, startTime, endTime, "tester", "original test", "original-key"
  );
  await ExportService.approveRequest(result1.request.id, "admin");
  const verify1 = await ExportService.verifyHashChain(result1.request.id, "verifier");
  const report1 = await ExportService.generateProofReport(result1.request.id, "generator");
  
  if (verify1.isValid && report1.reportContent.conclusion.includes("可以安全导出")) {
    console.log("    ✓ 原始数据校验通过，结论正确");
    console.log("      isValid:", verify1.isValid);
    console.log("      结论:", report1.reportContent.conclusion);
  } else {
    console.log("    ✗ 原始数据校验失败");
    console.log("      isValid:", verify1.isValid);
    console.log("      不匹配数:", verify1.mismatches.length);
    console.log("      结论:", report1.reportContent.conclusion);
    process.exit(1);
  }

  // 测试2：篡改事件内容应检测到
  console.log("\n[2/4] 测试：篡改事件内容应检测到哈希不匹配...");
  
  // 直接修改数据库中的第3个事件
  const tamperedEventId = events[2].id;
  const tamperedDetails = { index: 3, action: "HACKED-ACTION", user: "HACKER" };
  await runQuery(
    `UPDATE audit_log_events SET details = ? WHERE id = ?`,
    [JSON.stringify(tamperedDetails), tamperedEventId]
  );

  const result2 = await ExportService.createExportRequest(
    topicId, startTime, endTime, "tester", "tamper test", "tamper-key"
  );
  await ExportService.approveRequest(result2.request.id, "admin");
  const verify2 = await ExportService.verifyHashChain(result2.request.id, "verifier");
  const report2 = await ExportService.generateProofReport(result2.request.id, "generator");

  const contentMismatch = verify2.mismatches.find((m: any) => m.issue === "event_content_hash_mismatch");
  if (!verify2.isValid && contentMismatch && report2.reportContent.conclusion.includes("被阻止")) {
    console.log("    ✓ 内容篡改检测成功");
    console.log("      isValid:", verify2.isValid);
    console.log("      被篡改事件:", contentMismatch.event_id);
    console.log("      问题类型:", contentMismatch.issue);
    console.log("      结论:", report2.reportContent.conclusion);
  } else {
    console.log("    ✗ 内容篡改检测失败");
    console.log("      isValid:", verify2.isValid);
    console.log("      不匹配数:", verify2.mismatches.length);
    console.log("      不匹配详情:", verify2.mismatches);
    process.exit(1);
  }

  // 测试3：删除一条哈希链应检测到数量不匹配
  console.log("\n[3/4] 测试：删除哈希链应检测到数量不匹配...");
  
  // 先恢复被篡改的事件
  await runQuery(
    `UPDATE audit_log_events SET details = ? WHERE id = ?`,
    [JSON.stringify(events[2].details), tamperedEventId]
  );
  // 删除第4条哈希链（使用事件ID，不是哈希链ID）
  const deletedEventId = events[3].id;
  await runQuery(`DELETE FROM hash_chains WHERE event_id = ?`, [deletedEventId]);

  const result3 = await ExportService.createExportRequest(
    topicId, startTime, endTime, "tester", "delete test", "delete-key"
  );
  await ExportService.approveRequest(result3.request.id, "admin");
  const verify3 = await ExportService.verifyHashChain(result3.request.id, "verifier");
  const report3 = await ExportService.generateProofReport(result3.request.id, "generator");

  const countMismatch = verify3.mismatches.find((m: any) => m.issue === "hash_chain_count_mismatch");
  if (!verify3.isValid && countMismatch && report3.reportContent.conclusion.includes("数量不匹配")) {
    console.log("    ✓ 哈希链删除检测成功");
    console.log("      isValid:", verify3.isValid);
    console.log("      期望数量:", countMismatch.expected);
    console.log("      实际数量:", countMismatch.actual);
    console.log("      结论:", report3.reportContent.conclusion);
  } else {
    console.log("    ✗ 哈希链删除检测失败");
    console.log("      isValid:", verify3.isValid);
    console.log("      不匹配数:", verify3.mismatches.length);
    console.log("      不匹配详情:", verify3.mismatches);
    process.exit(1);
  }

  // 测试4：相邻哈希不匹配检测
  console.log("\n[4/4] 测试：破坏哈希链链接应检测到...");
  
  // 恢复删除的哈希链，但破坏其中一个链接
  await runQuery(
    `INSERT INTO hash_chains (id, topic_id, event_id, event_timestamp, previous_hash, current_hash, event_content_hash, chain_sequence, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuidv4(), topicId, deletedEventId, events[3].timestamp, "WRONG_PREV_HASH", events[3].currentHash, events[3].contentHash, 4, new Date().toISOString()]
  );

  const result4 = await ExportService.createExportRequest(
    topicId, startTime, endTime, "tester", "chain break test", "chain-key"
  );
  await ExportService.approveRequest(result4.request.id, "admin");
  const verify4 = await ExportService.verifyHashChain(result4.request.id, "verifier");
  const report4 = await ExportService.generateProofReport(result4.request.id, "generator");

  const prevMismatch = verify4.mismatches.find((m: any) => m.issue === "previous_hash_mismatch");
  if (!verify4.isValid && prevMismatch && report4.reportContent.conclusion.includes("被阻止")) {
    console.log("    ✓ 哈希链断裂检测成功");
    console.log("      isValid:", verify4.isValid);
    console.log("      断裂位置: 序列", prevMismatch.sequence);
    console.log("      结论:", report4.reportContent.conclusion);
  } else {
    console.log("    ✗ 哈希链断裂检测失败");
    console.log("      isValid:", verify4.isValid);
    console.log("      不匹配详情:", verify4.mismatches);
    process.exit(1);
  }

  console.log("\n✓ 所有篡改和删除检测测试通过！");
  console.log("\n检测覆盖：");
  console.log("  ✓ 事件内容篡改检测 (event_content_hash_mismatch)");
  console.log("  ✓ 哈希链数量不匹配检测 (hash_chain_count_mismatch)");
  console.log("  ✓ 哈希链断裂检测 (previous_hash_mismatch)");
  console.log("  ✓ 正确数据通过验证 (isValid: true)");
  
  process.exit(0);
}

testTamperDetection();

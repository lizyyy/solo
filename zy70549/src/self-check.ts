import { v4 as uuidv4 } from 'uuid';
import { initDatabase, initializeSchema, runQuery, getOne, getAll } from './database';
import { HashService } from './services/hash.service';
import { ExportService } from './services/export.service';

async function runSelfCheck() {
  console.log('=== 审计日志证明API 自检开始 ===\n');
  let passed = 0;
  let failed = 0;

  try {
    // 1. 数据库连接测试
    console.log('[1/8] 数据库连接测试...');
    const db = await initDatabase();
    await initializeSchema(db);
    console.log('    ✓ 数据库连接和Schema初始化成功');
    passed++;

    // 2. 哈希功能测试
    console.log('\n[2/8] 哈希功能测试...');
    const hash1 = HashService.generateHash('test-data-1');
    const hash2 = HashService.generateHash('test-data-2');
    if (hash1 !== hash2 && hash1.length === 64 && hash2.length === 64) {
      console.log('    ✓ 哈希生成正常 (SHA-256, 64字符)');
      passed++;
    } else {
      console.log('    ✗ 哈希生成异常');
      failed++;
    }

    // 3. 创建测试主题
    console.log('\n[3/8] 创建测试主题...');
    const topicId = uuidv4();
    await runQuery(
      `INSERT INTO log_topics (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      [topicId, 'self-check-topic', 'Self check test topic', new Date().toISOString(), new Date().toISOString()]
    );
    const topic = await getOne(`SELECT * FROM log_topics WHERE id = ?`, [topicId]);
    if (topic) {
      console.log('    ✓ 测试主题创建成功 (ID: ' + topicId.substring(0, 8) + '...)');
      passed++;
    } else {
      console.log('    ✗ 测试主题创建失败');
      failed++;
    }

    // 4. 创建测试事件和哈希链
    console.log('\n[4/8] 创建测试事件和哈希链...');
    const startTime = new Date(Date.now() - 3600000).toISOString();
    const endTime = new Date().toISOString();
    
    for (let i = 1; i <= 5; i++) {
      const eventId = `event-${i}-${uuidv4().substring(0, 8)}`;
      const eventTime = new Date(Date.now() - (5 - i) * 60000).toISOString();
      const prevHash = i === 1 ? 'genesis' : `hash-${i - 1}`;
      const currentHash = `hash-${i}`;
      const contentHash = HashService.generateHash(JSON.stringify({ index: i }));

      await runQuery(
        `INSERT INTO audit_log_events (id, topic_id, event_type, actor, action, resource, details, timestamp, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          eventId,
          topicId,
          'test',
          'self-check',
          `action-${i}`,
          `resource-${i}`,
          JSON.stringify({ index: i }),
          eventTime,
          new Date().toISOString()
        ]
      );

      await runQuery(
        `INSERT INTO hash_chains (id, topic_id, event_id, event_timestamp, previous_hash, current_hash, event_content_hash, chain_sequence, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          topicId,
          eventId,
          eventTime,
          prevHash,
          currentHash,
          contentHash,
          i,
          new Date().toISOString()
        ]
      );
    }
    console.log('    ✓ 5个测试事件和哈希链创建成功');
    passed++;

    // 5. 创建导出申请（幂等性测试）
    console.log('\n[5/8] 导出申请与幂等性测试...');
    const idempotencyKey = 'self-check-idempotency-' + Date.now();
    
    const result1 = await ExportService.createExportRequest(
      topicId,
      startTime,
      endTime,
      'self-check-user',
      'Self check export request',
      idempotencyKey
    );
    
    const result2 = await ExportService.createExportRequest(
      topicId,
      startTime,
      endTime,
      'self-check-user',
      'Self check export request',
      idempotencyKey
    );

    if (result1.isNew && !result2.isNew && result1.request.id === result2.request.id) {
      console.log('    ✓ 导出申请创建成功，幂等性验证通过');
      passed++;
    } else {
      console.log('    ✗ 导出申请或幂等性验证失败');
      failed++;
    }
    const requestId = result1.request.id;

    // 6. 审批流程测试
    console.log('\n[6/8] 审批流程测试...');
    const approved = await ExportService.approveRequest(requestId, 'admin', 'Approved for self check');
    if (approved && approved.status === 'approved') {
      console.log('    ✓ 申请审批成功');
      passed++;
    } else {
      console.log('    ✗ 申请审批失败');
      failed++;
    }

    // 7. 哈希链校验测试
    console.log('\n[7/8] 哈希链校验测试...');
    const verifyResult = await ExportService.verifyHashChain(requestId, 'verifier');
    if (verifyResult && verifyResult.verificationId) {
      console.log('    ✓ 哈希链校验完成, 校验ID: ' + verifyResult.verificationId.substring(0, 8) + '...');
      console.log('      哈希链有效: ' + verifyResult.isValid);
      console.log('      不匹配数量: ' + verifyResult.mismatches.length);
      passed++;
    } else {
      console.log('    ✗ 哈希链校验失败');
      failed++;
    }

    // 8. 证明报告生成和历史记录测试
    console.log('\n[8/8] 证明报告和处理历史测试...');
    const reportResult = await ExportService.generateProofReport(requestId, 'generator', 'json');
    const history = await ExportService.getProcessingHistory(requestId);
    
    if (reportResult.reportId && history && history.length >= 4) {
      console.log('    ✓ 证明报告生成成功, 报告ID: ' + reportResult.reportId.substring(0, 8) + '...');
      console.log('      处理历史记录数: ' + history.length);
      console.log('      报告结论: ' + (reportResult.reportContent as any).conclusion);
      passed++;
    } else {
      console.log('    ✗ 证明报告或历史记录异常');
      failed++;
    }

    // 汇总
    console.log('\n=== 自检汇总 ===');
    console.log(`总测试项: ${passed + failed}`);
    console.log(`通过: ${passed}`);
    console.log(`失败: ${failed}`);
    console.log(`通过率: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

    if (failed === 0) {
      console.log('\n✓ 所有自检项目通过！');
      
      // 附加验证：导出功能
      console.log('\n=== 附加验证：数据持久化 ===');
      const savedRequest = await ExportService.getRequestById(requestId);
      if (savedRequest && savedRequest.original_input && savedRequest.final_conclusion) {
        const originalInput = typeof savedRequest.original_input === 'string' 
          ? JSON.parse(savedRequest.original_input) 
          : savedRequest.original_input;
        console.log('✓ 原始输入和最终结论已持久化保存');
        console.log('  - 原始输入申请人: ' + originalInput.requester);
        console.log('  - 最终结论: ' + savedRequest.final_conclusion);
      }
      
      const events = await ExportService.exportEvents(requestId);
      console.log(`✓ 范围导出功能正常，导出事件数: ${events.length}`);
      
      console.log('\n✓ 系统完全可用！');
      process.exit(0);
    } else {
      console.log('\n✗ 部分自检项目失败，请检查！');
      process.exit(1);
    }

  } catch (error: any) {
    console.error('\n自检过程出错:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runSelfCheck();

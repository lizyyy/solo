import { QuotaService } from '../src/service';
import { QuotaWindow, QuotaStatus } from '../src/types';
import * as fs from 'fs';
import * as path from 'path';

const dataDir = path.join(process.cwd(), 'data');
if (fs.existsSync(dataDir)) {
  fs.rmSync(dataDir, { recursive: true, force: true });
}

async function runTests() {
  console.log('=== 开始测试 Quota API ===\n');
  const service = new QuotaService();

  console.log('1. 创建配额配置 (模拟真实团队交接场景)');
  console.log('--------------------------------------------------');

  const teams = [
    { team: '算法研究部', model: 'GPT-4', usage: 'research', limit: 1000000, window: QuotaWindow.MONTHLY, creator: '张总监' },
    { team: '产品研发部', model: 'GPT-4', usage: 'production', limit: 500000, window: QuotaWindow.MONTHLY, creator: '李经理' },
    { team: '测试工程部', model: 'GPT-4', usage: 'testing', limit: 100000, window: QuotaWindow.WEEKLY, creator: '王主管' },
    { team: '客户成功部', model: 'GPT-4', usage: 'customer-demo', limit: 50000, window: QuotaWindow.DAILY, creator: '赵经理' },
    { team: '内部工具部', model: 'GPT-4', usage: 'internal', limit: 200000, window: QuotaWindow.MONTHLY, creator: '陈工' }
  ];

  const quotas: any[] = [];
  for (const t of teams) {
    const quota = service.createQuota(t.team, t.model, t.usage, t.limit, t.window, t.creator);
    quotas.push(quota);
    console.log(`✓ 创建配额: ${t.team} - ${t.usage} (ID: ${quota.id.substring(0, 8)}...)`);
  }

  console.log('\n2. 模拟正常使用 (算法研究部调用模型)');
  console.log('--------------------------------------------------');

  const researchQuota = quotas[0];
  for (let i = 1; i <= 5; i++) {
    const tokens = Math.floor(Math.random() * 5000) + 1000;
    const result = service.validateUsage(
      researchQuota.teamName,
      researchQuota.modelName,
      researchQuota.usageTag,
      tokens,
      `req-${Date.now()}-${i}`
    );
    console.log(`✓ 调用成功: ${tokens} tokens, 已使用: ${result.config?.used}/${result.config?.limit}`);
  }

  console.log('\n3. 模拟配额耗尽拒绝场景');
  console.log('--------------------------------------------------');

  const testQuota = quotas[2];
  const largeTokens = testQuota.limit + 10000;
  const rejectResult = service.validateUsage(
    testQuota.teamName,
    testQuota.modelName,
    testQuota.usageTag,
    largeTokens,
    `req-${Date.now()}-exhaust`
  );
  console.log(`✗ 拒绝成功: 原因=${rejectResult.rejectEvent?.reason}`);
  console.log(`  原始输入: ${JSON.stringify(rejectResult.rejectEvent?.rawInput.teamName)} / ${rejectResult.rejectEvent?.rawInput.tokens} tokens`);
  console.log(`  处理依据: 限额=${rejectResult.rejectEvent?.processingBasis.currentLimit}, 已用=${rejectResult.rejectEvent?.processingBasis.currentUsed}`);
  console.log(`  最终结论: ${rejectResult.rejectEvent?.conclusion}`);

  console.log('\n4. 模拟无效用途标签拒绝场景');
  console.log('--------------------------------------------------');

  const invalidTagResult = service.validateUsage(
    researchQuota.teamName,
    researchQuota.modelName,
    'invalid-tag',
    1000,
    `req-${Date.now()}-invalid`
  );
  console.log(`✗ 拒绝成功: 原因=${invalidTagResult.rejectEvent?.reason}`);
  console.log(`  结论: ${invalidTagResult.rejectEvent?.conclusion}`);

  console.log('\n5. 临时增加临时额度');
  console.log('--------------------------------------------------');

  const bonusResult = service.addTempBonus(
    testQuota.id,
    50000,
    '系统管理员',
    '紧急项目临时额度审批'
  );
  console.log(`✓ 临时额度增加: +50000, 当前临时额度: ${bonusResult.tempBonus}`);

  console.log('\n6. 人工调整限额');
  console.log('--------------------------------------------------');

  const adjustResult = service.manualAdjust(
    researchQuota.id,
    { limit: 2000000, used: 500000 },
    '系统管理员',
    '季度配额调整'
  );
  console.log(`✓ 人工调整完成: 限额=${adjustResult.limit}, 已用=${adjustResult.used}`);

  console.log('\n7. 状态变更 (暂停配额)');
  console.log('--------------------------------------------------');

  const suspendResult = service.updateQuotaStatus(
    quotas[4].id,
    QuotaStatus.SUSPENDED,
    '安全管理员',
    '安全审核暂停'
  );
  console.log(`✓ 状态变更完成: ${suspendResult.status}`);

  console.log('\n8. 获取用量摘要');
  console.log('--------------------------------------------------');

  const summary = service.getSummary(researchQuota.id);
  console.log(`团队: ${summary.teamName}`);
  console.log(`模型: ${summary.modelName}`);
  console.log(`用途: ${summary.usageTag}`);
  console.log(`总限额: ${summary.totalLimit}`);
  console.log(`已使用: ${summary.totalUsed}`);
  console.log(`临时额度: ${summary.tempBonus}`);
  console.log(`剩余额度: ${summary.remaining}`);
  console.log(`利用率: ${summary.utilizationRate.toFixed(2)}%`);
  console.log(`拒绝次数: ${summary.rejectCount}`);

  console.log('\n9. 导出配额数据 (验证数据一致性)');
  console.log('--------------------------------------------------');

  const exported = service.exportQuota(researchQuota.id, '测试脚本');
  console.log(`✓ 导出成功:`);
  console.log(`  主记录存在: ${!!exported.quotaConfig}`);
  console.log(`  用量记录数: ${exported.usageRecords.length}`);
  console.log(`  拒绝事件数: ${exported.rejectEvents.length}`);
  console.log(`  摘要数据一致: ${exported.summary.teamName === exported.quotaConfig.teamName}`);
  console.log(`  导出时间: ${exported.exportTime}`);
  console.log(`  导出人: ${exported.exportBy}`);

  console.log('\n10. 查询审计日志');
  console.log('--------------------------------------------------');

  const auditLogs = service.getAuditLogs();
  console.log(`✓ 审计日志数: ${auditLogs.length}`);
  auditLogs.forEach((log: any, i: number) => {
    console.log(`  [${i + 1}] ${log.action} - ${log.operator} - ${log.reason.substring(0, 20)}...`);
  });

  console.log('\n11. 批量导出所有配额');
  console.log('--------------------------------------------------');

  const allExported = service.exportAll('批量导出任务');
  console.log(`✓ 批量导出成功: ${allExported.length} 条配额`);

  console.log('\n12. 查询所有拒绝事件');
  console.log('--------------------------------------------------');

  const allRejects = service.getRejectEvents();
  console.log(`✓ 拒绝事件总数: ${allRejects.length}`);
  allRejects.forEach((reject: any, i: number) => {
    console.log(`  [${i + 1}] ${reject.teamName} - ${reject.reason} - ${reject.timestamp}`);
  });

  console.log('\n13. 验证数据持久化 (重启不丢失)');
  console.log('--------------------------------------------------');

  const newServiceInstance = new QuotaService();
  const quotasAfterRestart = newServiceInstance.getAllQuotas();
  console.log(`✓ 重启后配额数: ${quotasAfterRestart.length}`);
  console.log(`✓ 数据持久化验证: ${quotasAfterRestart.length === quotas.length ? 'PASS' : 'FAIL'}`);

  console.log('\n=== 测试完成 ===');
  console.log('\nAPI接口列表:');
  console.log('  POST   /api/quotas          - 创建配额');
  console.log('  GET    /api/quotas          - 查询所有配额');
  console.log('  GET    /api/quotas/:id      - 查询单个配额');
  console.log('  GET    /api/quotas/:id/summary - 查询用量摘要');
  console.log('  POST   /api/validate        - 校验模型调用');
  console.log('  POST   /api/quotas/:id/bonus - 增加临时额度');
  console.log('  PATCH  /api/quotas/:id/status - 更新配额状态');
  console.log('  PATCH  /api/quotas/:id/adjust - 人工调整');
  console.log('  GET    /api/rejects         - 查询拒绝事件');
  console.log('  GET    /api/audit          - 查询审计日志');
  console.log('  GET    /api/export/:id      - 导出单个配额');
  console.log('  GET    /api/export         - 批量导出');
  console.log('  GET    /api/usage-tags     - 查询有效用途标签');
  console.log('');
}

runTests().catch(console.error);

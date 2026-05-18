import { DeprecationExtensionSDK } from './src/sdk';
import { CreateExtensionRequest } from './src/types';

const sdk = new DeprecationExtensionSDK();

const normalRecords: CreateExtensionRequest[] = [
  {
    apiName: '用户信息查询API',
    apiPath: '/api/v1/user/info',
    caller: '订单服务',
    originalDeprecationDate: '2024-06-30',
    extendedDeprecationDate: '2024-12-31',
    reason: '订单系统重构延期，需要继续使用该接口',
    contactPerson: '张三',
    contactEmail: 'zhangsan@company.com'
  },
  {
    apiName: '商品列表接口',
    apiPath: '/api/v1/product/list',
    caller: '电商前台',
    originalDeprecationDate: '2024-07-15',
    extendedDeprecationDate: '2025-01-15',
    reason: '电商大促期间不适合切换接口，延期至节后',
    contactPerson: '李四',
    contactEmail: 'lisi@company.com'
  },
  {
    apiName: '库存查询接口',
    apiPath: '/api/v1/inventory/query',
    caller: '仓储系统',
    originalDeprecationDate: '2024-08-01',
    extendedDeprecationDate: '2024-10-01',
    reason: '仓储系统迁移需要额外时间',
    contactPerson: '王五',
    contactEmail: 'wangwu@company.com'
  }
];

const abnormalRecords: CreateExtensionRequest[] = [
  {
    apiName: '',
    apiPath: '/api/v1/test',
    caller: '测试调用方',
    originalDeprecationDate: '2024-06-30',
    extendedDeprecationDate: '2024-12-31',
    reason: '测试理由',
    contactPerson: '测试人',
    contactEmail: 'test@company.com'
  },
  {
    apiName: '测试API',
    apiPath: '',
    caller: '测试调用方',
    originalDeprecationDate: '2024-06-30',
    extendedDeprecationDate: '2024-12-31',
    reason: '测试理由',
    contactPerson: '测试人',
    contactEmail: 'test@company.com'
  },
  {
    apiName: '测试API',
    apiPath: '/api/v1/test',
    caller: '',
    originalDeprecationDate: '2024-06-30',
    extendedDeprecationDate: '2024-12-31',
    reason: '测试理由',
    contactPerson: '测试人',
    contactEmail: 'test@company.com'
  },
  {
    apiName: '测试API',
    apiPath: '/api/v1/test',
    caller: '测试调用方',
    originalDeprecationDate: '2024-12-31',
    extendedDeprecationDate: '2024-06-30',
    reason: '日期错误测试',
    contactPerson: '测试人',
    contactEmail: 'test@company.com'
  },
  {
    apiName: '测试API',
    apiPath: '/api/v1/test',
    caller: '测试调用方',
    originalDeprecationDate: '2024-06-30',
    extendedDeprecationDate: '2024-12-31',
    reason: '',
    contactPerson: '测试人',
    contactEmail: 'test@company.com'
  },
  {
    apiName: '测试API',
    apiPath: '/api/v1/test',
    caller: '测试调用方',
    originalDeprecationDate: '2024-06-30',
    extendedDeprecationDate: '2024-12-31',
    reason: '测试理由',
    contactPerson: '',
    contactEmail: 'test@company.com'
  },
  {
    apiName: '测试API',
    apiPath: '/api/v1/test',
    caller: '测试调用方',
    originalDeprecationDate: '2024-06-30',
    extendedDeprecationDate: '2024-12-31',
    reason: '测试理由',
    contactPerson: '测试人',
    contactEmail: 'invalid-email'
  }
];

async function runNormalTests() {
  console.log('========== 正常记录测试 ==========\n');
  const results: any[] = [];

  for (let i = 0; i < normalRecords.length; i++) {
    console.log(`测试记录 ${i + 1}: ${normalRecords[i].apiName}`);
    try {
      const result = await sdk.createExtension(normalRecords[i]);
      results.push({
        success: true,
        id: result.id,
        apiName: result.apiName,
        status: result.status
      });
      console.log(`  ✓ 创建成功，ID: ${result.id}`);
    } catch (error: any) {
      results.push({
        success: false,
        apiName: normalRecords[i].apiName,
        error: error.message
      });
      console.log(`  ✗ 创建失败: ${error.message}`);
    }
  }

  console.log(`\n正常记录测试完成: ${results.filter(r => r.success).length}/${results.length} 成功\n`);
  return results;
}

async function runAbnormalTests() {
  console.log('========== 异常记录测试 ==========\n');
  const results: any[] = [];

  for (let i = 0; i < abnormalRecords.length; i++) {
    console.log(`异常测试 ${i + 1}`);
    try {
      const result = await sdk.createExtension(abnormalRecords[i]);
      results.push({
        success: true,
        id: result.id,
        expected: false
      });
      console.log(`  ✗ 意外创建成功（应该失败）`);
    } catch (error: any) {
      results.push({
        success: false,
        expected: true,
        error: error.message
      });
      console.log(`  ✓ 正确拒绝: ${error.message}`);
    }
  }

  console.log(`\n异常记录测试完成: ${results.filter(r => !r.success && r.expected).length}/${results.length} 正确拒绝\n`);
  return results;
}

async function runRepeatTests(extensionId: string) {
  console.log('========== 重复操作测试 ==========\n');

  console.log('1. 审批操作...');
  try {
    await sdk.approveExtension(extensionId, '管理员');
    console.log('  ✓ 首次审批成功');
  } catch (error: any) {
    console.log(`  ✗ 首次审批失败: ${error.message}`);
  }

  console.log('2. 重复审批...');
  try {
    await sdk.approveExtension(extensionId, '管理员');
    console.log('  ✗ 重复审批意外成功');
  } catch (error: any) {
    console.log(`  ✓ 重复审批正确拒绝: ${error.message}`);
  }

  console.log('3. 撤回操作...');
  try {
    await sdk.withdrawExtension(extensionId);
    console.log('  ✓ 撤回成功');
  } catch (error: any) {
    console.log(`  ✗ 撤回失败: ${error.message}`);
  }

  console.log('4. 重复撤回...');
  try {
    await sdk.withdrawExtension(extensionId);
    console.log('  ✗ 重复撤回意外成功');
  } catch (error: any) {
    console.log(`  ✓ 重复撤回正确拒绝: ${error.message}`);
  }

  console.log();
}

async function runWorkflowDemo() {
  console.log('========== 完整流程演示 ==========\n');

  console.log('1. 创建延期申请...');
  const extension = await sdk.createExtension({
    apiName: '演示测试API',
    apiPath: '/api/v1/demo/test',
    caller: '演示系统',
    originalDeprecationDate: '2024-06-30',
    extendedDeprecationDate: '2024-12-31',
    reason: '演示完整流程',
    contactPerson: '演示员',
    contactEmail: 'demo@company.com'
  });
  console.log(`  ✓ 创建成功，ID: ${extension.id}`);
  console.log(`    当前状态: ${extension.status}`);

  console.log('\n2. 审批延期申请...');
  const approved = await sdk.approveExtension(extension.id, '审批员A');
  console.log(`  ✓ 审批成功`);
  console.log(`    当前状态: ${approved.status}`);
  console.log(`    审批人: ${approved.approvedBy}`);

  console.log('\n3. 更新同步状态...');
  const synced = await sdk.updateSyncStatus(extension.id, 'synced', '已同步到告警规则');
  console.log(`  ✓ 同步状态已更新`);
  console.log(`    同步状态: ${synced.syncStatus}`);

  console.log('\n4. 查询同步状态...');
  const syncResults = await sdk.checkSyncStatus('/api/v1/demo/test', '演示系统');
  console.log(`  ✓ 同步检查完成`);
  syncResults.forEach((r, i) => {
    console.log(`    ${i + 1}. 状态: ${r.syncStatus}, 规则存在: ${r.ruleExists}, 日期匹配: ${r.ruleDateMatches}`);
  });

  console.log('\n5. 导出数据...');
  const csvData = await sdk.exportExtensions('csv');
  console.log(`  ✓ 导出CSV完成，数据行数: ${csvData.split('\n').length}`);

  console.log('\n完整流程演示完成！\n');

  return extension.id;
}

export async function runAllTests() {
  console.log('API文档中心接口废弃延期登记 - 测试套件\n');
  console.log('========================================\n');

  try {
    const normalResults = await runNormalTests();
    await runAbnormalTests();

    if (normalResults.length > 0 && normalResults[0].success) {
      await runRepeatTests(normalResults[0].id);
    }

    await runWorkflowDemo();

    console.log('========================================');
    console.log('所有测试执行完成！\n');
  } catch (error: any) {
    console.error('测试执行失败:', error.message);
  }
}

if (require.main === module) {
  setTimeout(() => {
    runAllTests();
  }, 2000);
}

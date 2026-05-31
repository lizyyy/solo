import { AccountFreezeStateMachine } from './stateMachine/AccountFreezeStateMachine';
import { recordStore } from './store/RecordStore';
import { reportGenerator } from './report/MigrationReportGenerator';
import { AccountFreezeRequest, FreezeReason, ParameterSource, FreezeStatus } from './types';
import { getStatusDisplayName, getReasonDisplayName } from './stateMachine/transitions';

console.log('\n' + '='.repeat(70));
console.log('账户冻结状态机 - 演示脚本');
console.log('='.repeat(70) + '\n');

const stateMachine = new AccountFreezeStateMachine();

function runDemo() {
  console.log('【场景1】高风险涉嫌欺诈账户 - 自动冻结');
  console.log('-'.repeat(70));

  const request1: AccountFreezeRequest = {
    requestId: 'REQ20240101001',
    accountId: 'ACC100001',
    accountName: '张三',
    freezeReason: FreezeReason.FRAUD_SUSPECTED,
    reasonDetail: '检测到多次异地登录尝试，涉嫌账户被盗',
    riskScore: 92,
    createdAt: new Date()
  };

  const result1 = stateMachine.processRequest(request1);
  console.log(`账户: ${result1.accountId} - ${result1.accountName}`);
  console.log(`状态: ${getStatusDisplayName(result1.status)}`);
  console.log(`判断理由: ${result1.decisionReason}`);
  console.log(`下一步: ${result1.nextStep}`);
  console.log(`负责人: ${result1.nextStepOwner}`);
  console.log();

  console.log('【场景2】同一请求ID再次提交 - 幂等性测试（返回历史记录）');
  console.log('-'.repeat(70));
  
  const result1ReRun = stateMachine.processRequest(request1);
  console.log(`账户: ${result1ReRun.accountId} - ${result1ReRun.accountName}`);
  console.log(`状态: ${getStatusDisplayName(result1ReRun.status)}`);
  console.log(`是否历史记录: ${result1ReRun.isHistorical ? '是 ✓' : '否'}`);
  console.log(`说明: 同一批材料第二次进来，不会创建新的成功记录`);
  console.log();

  console.log('【场景3】中等风险异常活动 - 转人工审核');
  console.log('-'.repeat(70));

  const request2: AccountFreezeRequest = {
    requestId: 'REQ20240101002',
    accountId: 'ACC100002',
    accountName: '李四',
    freezeReason: FreezeReason.ABNORMAL_ACTIVITY,
    reasonDetail: '大额转账异常',
    riskScore: 65,
    parameterSource: ParameterSource.ALARM_RECORD,
    clientParameters: {
      alarmId: 'ALM001',
      alarmType: 'transfer'
    },
    createdAt: new Date()
  };

  const result2 = stateMachine.processRequest(request2);
  console.log(`账户: ${result2.accountId} - ${result2.accountName}`);
  console.log(`状态: ${getStatusDisplayName(result2.status)}`);
  console.log(`判断理由: ${result2.decisionReason}`);
  console.log(`下一步: ${result2.nextStep}`);
  console.log(`负责人: ${result2.nextStepOwner}`);
  
  if (result2.parameterValidationIssues && result2.parameterValidationIssues.length > 0) {
    console.log(`\n参数问题 (${result2.parameterValidationIssues.length}个):`);
    result2.parameterValidationIssues.forEach((issue, i) => {
      console.log(`  ${i + 1}. [${issue.severity}] ${issue.field}: ${issue.issue}`);
      console.log(`     来源: ${issue.source === ParameterSource.ALARM_RECORD ? '报警记录' : issue.source}`);
      console.log(`     联系人: ${issue.suggestedContact}`);
    });
  }
  console.log();

  console.log('【场景4】旧版API客户端参数问题 - 提示补全');
  console.log('-'.repeat(70));

  const request3: AccountFreezeRequest = {
    requestId: 'REQ20240101003',
    accountId: 'ACC100003',
    accountName: '王五',
    freezeReason: FreezeReason.RISK_ALERT,
    reasonDetail: '风控系统告警',
    riskScore: 55,
    clientVersion: 'v1.5.2',
    parameterSource: ParameterSource.OLD_API_DOCUMENT,
    clientParameters: {
      requestId: 'REQ20240101003',
      timestamp: 'invalid-date-format'
    },
    createdAt: new Date()
  };

  const result3 = stateMachine.processRequest(request3);
  console.log(`账户: ${result3.accountId} - ${result3.accountName}`);
  console.log(`状态: ${getStatusDisplayName(result3.status)}`);
  console.log(`客户端版本: v1.5.2 (旧版本)`);
  
  if (result3.parameterValidationIssues && result3.parameterValidationIssues.length > 0) {
    console.log(`\n参数问题详情:`);
    result3.parameterValidationIssues.forEach((issue, i) => {
      console.log(`  ${i + 1}. [${issue.severity}] ${issue.field}: ${issue.issue}`);
      console.log(`     来源: ${issue.source === ParameterSource.OLD_API_DOCUMENT ? '旧接口文档' : issue.source}`);
      console.log(`     👉 下一步找谁: ${issue.suggestedContact}`);
    });
  }
  console.log();

  console.log('【场景5】生成迁移报告');
  console.log('-'.repeat(70));

  const report = reportGenerator.generateReport({ includeHistorical: true });
  console.log(reportGenerator.generateSummaryText(report));
  console.log();

  console.log('【审计日志示例 - 查看第一条记录的审计痕迹】');
  console.log('-'.repeat(70));
  
  const firstRecord = recordStore.getAllRecords()[0];
  console.log(`记录ID: ${firstRecord.recordId}`);
  console.log(`审计日志共 ${firstRecord.auditLogs.length} 条:`);
  firstRecord.auditLogs.forEach((log, i) => {
    console.log(`  ${i + 1}. [${log.action}] ${log.reason}`);
    if (log.fromStatus) {
      console.log(`     状态: ${getStatusDisplayName(log.fromStatus)} → ${getStatusDisplayName(log.toStatus!)}`);
    }
    console.log(`     时间: ${log.timestamp.toLocaleString('zh-CN')}`);
  });

  console.log('\n' + '='.repeat(70));
  console.log('演示完成！启动服务后可在浏览器中查看完整界面');
  console.log('执行命令: npm run server');
  console.log('访问地址: http://localhost:3000');
  console.log('='.repeat(70) + '\n');
}

runDemo();

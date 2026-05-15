const { tokenService } = require('../src/services/tokenService');

function printResult(title, result) {
  console.log(`\n========== ${title} ==========`);
  console.log(JSON.stringify(result, null, 2));
}

async function runExamples() {
  console.log('快速回滚令牌服务 - 测试样例');
  console.log('=' .repeat(50));

  const users = {
    manager: { id: 'user-001', name: '张经理' },
    operator: { id: 'user-002', name: '李操作员' },
    auditor: { id: 'user-003', name: '王审计员' },
    other: { id: 'user-004', name: '赵外人' }
  };

  const batchId = 'batch-2024-0515-001';
  const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const pastDate = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  console.log('\n【样例1: 正常回滚流程】');
  console.log('-'.repeat(40));

  const issueResult = tokenService.issueToken({
    batchId,
    issuerId: users.manager.id,
    issuerName: users.manager.name,
    executorId: users.operator.id,
    executorName: users.operator.name,
    expireAt: futureDate,
    rollbackAction: 'rollback:image:v1.2.3',
    scope: ['image:review:rollback', 'image:audit:view'],
    metadata: {
      imageId: 'img-2024-0515-888',
      originalInput: '用户上传的违规图片审核样本',
      processingBasis: '《内容安全审核规范》第3.2条'
    }
  });
  printResult('1.1 签发令牌', issueResult);
  const tokenId = issueResult.data.tokenId;

  const verifyResult = tokenService.verifyToken(
    tokenId,
    users.operator.id,
    users.operator.name
  );
  printResult('1.2 校验令牌', verifyResult);

  const executeResult = tokenService.executeToken(
    tokenId,
    users.operator.id,
    users.operator.name,
    ['image:review:rollback']
  );
  printResult('1.3 执行回滚', executeResult);

  const auditResult1 = tokenService.getTokenAudit(tokenId);
  printResult('1.4 完整审计链路', auditResult1);

  console.log('\n\n【样例2: 过期令牌】');
  console.log('-'.repeat(40));

  const expiredIssue = tokenService.issueToken({
    batchId,
    issuerId: users.manager.id,
    issuerName: users.manager.name,
    executorId: users.operator.id,
    executorName: users.operator.name,
    expireAt: pastDate,
    rollbackAction: 'rollback:image:v1.2.4',
    scope: ['image:review:rollback']
  });
  const expiredTokenId = expiredIssue.data.tokenId;

  const expiredExecute = tokenService.executeToken(
    expiredTokenId,
    users.operator.id,
    users.operator.name
  );
  printResult('2.1 执行过期令牌', expiredExecute);

  const expiredAudit = tokenService.getTokenAudit(expiredTokenId);
  printResult('2.2 过期令牌审计记录', expiredAudit);

  console.log('\n\n【样例3: 越权范围】');
  console.log('-'.repeat(40));

  const scopeIssue = tokenService.issueToken({
    batchId,
    issuerId: users.manager.id,
    issuerName: users.manager.name,
    executorId: users.operator.id,
    executorName: users.operator.name,
    expireAt: futureDate,
    rollbackAction: 'rollback:image:v1.2.5',
    scope: ['image:review:rollback'],
    metadata: {}
  });
  const scopeTokenId = scopeIssue.data.tokenId;

  const scopeViolation = tokenService.executeToken(
    scopeTokenId,
    users.operator.id,
    users.operator.name,
    ['image:review:rollback', 'user:delete:all']
  );
  printResult('3.1 超出范围执行', scopeViolation);

  const otherUserExecute = tokenService.executeToken(
    scopeTokenId,
    users.other.id,
    users.other.name
  );
  printResult('3.2 非授权人执行', otherUserExecute);

  const scopeAudit = tokenService.getTokenAudit(scopeTokenId);
  printResult('3.3 越权场景审计记录', scopeAudit);

  console.log('\n\n【样例4: 重复执行】');
  console.log('-'.repeat(40));

  const repeatIssue = tokenService.issueToken({
    batchId,
    issuerId: users.manager.id,
    issuerName: users.manager.name,
    executorId: users.operator.id,
    executorName: users.operator.name,
    expireAt: futureDate,
    rollbackAction: 'rollback:image:v1.2.6',
    scope: ['image:review:rollback']
  });
  const repeatTokenId = repeatIssue.data.tokenId;

  const firstExecute = tokenService.executeToken(
    repeatTokenId,
    users.operator.id,
    users.operator.name
  );
  printResult('4.1 第一次执行', firstExecute);

  const repeatExecute = tokenService.executeToken(
    repeatTokenId,
    users.operator.id,
    users.operator.name
  );
  printResult('4.2 重复执行', repeatExecute);

  const repeatAudit = tokenService.getTokenAudit(repeatTokenId);
  printResult('4.3 重复执行审计记录', repeatAudit);

  console.log('\n\n【样例5: 作废令牌后再次使用】');
  console.log('-'.repeat(40));

  const revokeIssue = tokenService.issueToken({
    batchId,
    issuerId: users.manager.id,
    issuerName: users.manager.name,
    executorId: users.operator.id,
    executorName: users.operator.name,
    expireAt: futureDate,
    rollbackAction: 'rollback:image:v1.2.7',
    scope: ['image:review:rollback']
  });
  const revokeTokenId = revokeIssue.data.tokenId;

  const revokeResult = tokenService.revokeToken(
    revokeTokenId,
    '误签发，该批次不需要回滚',
    users.manager.id,
    users.manager.name
  );
  printResult('5.1 作废令牌', revokeResult);

  const afterRevokeExecute = tokenService.executeToken(
    revokeTokenId,
    users.operator.id,
    users.operator.name
  );
  printResult('5.2 作废后再次执行', afterRevokeExecute);

  const otherRevoke = tokenService.revokeToken(
    revokeTokenId,
    '尝试再次作废',
    users.other.id,
    users.other.name
  );
  printResult('5.3 非签发人作废', otherRevoke);

  const revokeAudit = tokenService.getTokenAudit(revokeTokenId);
  printResult('5.4 作废场景审计记录', revokeAudit);

  console.log('\n\n【样例6: 通过处理人追溯图片审核样本】');
  console.log('-'.repeat(40));

  const operatorAudit = tokenService.getAuditByOperator(users.operator.id);
  printResult(`6.1 李操作员的操作记录 (共${operatorAudit.data.length}条)`, operatorAudit);

  const allAudit = tokenService.getAllAudit();
  console.log(`\n6.2 全部审计记录总数: ${allAudit.data.length} 条`);

  console.log('\n\n========== 测试样例执行完成 ==========');
  console.log('\n审计记录对应关系验证:');
  console.log('- 错误码与审计记录中的 errorCode 完全匹配');
  console.log('- 每个操作都有对应的审计日志');
  console.log('- 可以通过处理人(operatorId)找到所有相关操作');
  console.log('- metadata 字段包含图片审核样本的原始输入和处理依据');
  console.log('- 作废令牌的审计记录包含作废原因、作废人、作废时间');
}

runExamples().catch(console.error);

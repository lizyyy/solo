const { initTables } = require('../src/database/schema');
const { PolicyService } = require('../src/services/PolicyService');
const { PolicyVersion, PolicyStatus } = require('../src/models/PolicyVersion');

async function runTests() {
  console.log('=== 开始制度审批发布系统自检 ===\n');
  
  await initTables();
  
  let policyId1 = null;
  let policyId2 = null;
  let approvalNodeId = null;
  let failedChannelId = null;
  let allPassed = true;
  
  const assert = (condition, message) => {
    if (!condition) {
      console.log(`   ✗ ${message}`);
      allPassed = false;
    } else {
      console.log(`   ✓ ${message}`);
    }
  };
  
  try {
    console.log('1. 测试创建制度...');
    const policy1 = await PolicyService.createPolicy({
      policyCode: 'POL-001',
      title: '公司员工手册',
      content: { chapters: ['入职', '离职', '福利'] },
      applicableDepartments: ['技术部', '人事部', '财务部'],
      approvalNodes: [
        { nodeName: '部门经理审批', approverRole: 'MANAGER' },
        { nodeName: 'HR总监审批', approverRole: 'HR_DIRECTOR' },
        { nodeName: 'CEO审批', approverRole: 'CEO' }
      ],
      publishChannels: [
        { channelName: '内部OA系统', channelType: 'INTERNAL' },
        { channelName: '企业微信', channelType: 'WECOM' }
      ]
    }, 'user_001');
    policyId1 = policy1.id;
    console.log('   ✓ 创建成功:', policy1.policyCode, '版本:', policy1.versionNumber);
    
    const policy2 = await PolicyService.createPolicy({
      policyCode: 'POL-002',
      title: '财务审批制度',
      content: { chapters: ['报销', '预算'] },
      applicableDepartments: ['财务部'],
      approvalNodes: [
        { nodeName: '财务经理审批', approverRole: 'FINANCE_MANAGER' }
      ],
      publishChannels: [
        { channelName: '错误测试渠道', channelType: 'TEST' }
      ],
      references: [
        { referencedPolicyCode: 'POL-001', referenceType: '引用' }
      ]
    }, 'user_002');
    policyId2 = policy2.id;
    console.log('   ✓ 创建带引用的制度成功:', policy2.policyCode);
    
  } catch (e) {
    console.log('   ✗ 创建失败:', e.message);
    return;
  }
  
  try {
    console.log('\n2. 测试提交审批...');
    const result = await PolicyService.submitForApproval(policyId1);
    approvalNodeId = result.currentNode.id;
    assert(result.policy.status === 'APPROVING', '提交后状态为 APPROVING');
    assert(result.currentNode.nodeName === '部门经理审批', '当前审批节点正确');
  } catch (e) {
    console.log('   ✗ 提交失败:', e.message);
    return;
  }
  
  try {
    console.log('\n3. 测试越级审批拦截...');
    const detail = await PolicyService.getPolicyDetail(policyId1);
    const thirdNode = detail.approvalNodes[2];
    
    try {
      await PolicyService.approveNode(thirdNode.id, 'ceo_001', '越级审批');
      console.log('   ✗ 越级审批应该失败但成功了');
    } catch (e) {
      assert(e.message.includes('审批必须按顺序进行'), '越级审批被拦截: ' + e.message);
    }
    
  } catch (e) {
    console.log('   ✗ 越级测试失败:', e.message);
  }
  
  try {
    console.log('\n4. 测试审批流程（按顺序）...');
    let result = await PolicyService.approveNode(approvalNodeId, 'manager_001', '同意');
    assert(result.status === 'NEXT_NODE', '第一个节点审批通过，进入下一节点');
    
    const detail = await PolicyService.getPolicyDetail(policyId1);
    const secondNode = detail.approvalNodes.find(n => n.status === 'PENDING');
    assert(secondNode.nodeName === 'HR总监审批', '下一节点是 HR总监审批');
    
    result = await PolicyService.approveNode(secondNode.id, 'hr_director_001', '同意');
    assert(result.status === 'NEXT_NODE', '第二个节点审批通过');
    
    const detail2 = await PolicyService.getPolicyDetail(policyId1);
    const thirdNode = detail2.approvalNodes.find(n => n.status === 'PENDING');
    result = await PolicyService.approveNode(thirdNode.id, 'ceo_001', '同意');
    assert(result.status === 'ALL_APPROVED', '第三个节点审批通过，全部审批完成');
    assert(result.policy.status === 'APPROVED', '制度状态为 APPROVED');
    
  } catch (e) {
    console.log('   ✗ 审批失败:', e.message);
    return;
  }
  
  try {
    console.log('\n5. 测试发布流程...');
    const result = await PolicyService.publishPolicy(policyId1);
    assert(result.policy.status === 'PUBLISHED', '制度发布成功，状态为 PUBLISHED');
    result.channels.forEach(c => {
      assert(c.status === 'SUCCESS', `渠道 ${c.channelName} 发布成功`);
    });
    
  } catch (e) {
    console.log('   ✗ 发布失败:', e.message);
  }
  
  try {
    console.log('\n6. 测试 policy2 先审批再发布...');
    await PolicyService.submitForApproval(policyId2);
    
    const detail = await PolicyService.getPolicyDetail(policyId2);
    const financeNode = detail.approvalNodes[0];
    await PolicyService.approveNode(financeNode.id, 'finance_manager', '同意');
    
    const policy2AfterApproval = await PolicyVersion.findById(policyId2);
    assert(policy2AfterApproval.status === 'APPROVED', 'policy2 审批通过');
    
    const result2 = await PolicyService.publishPolicy(policyId2);
    result2.channels.forEach(c => {
      if (c.status === 'FAILED') {
        failedChannelId = c.id;
        console.log(`   ✓ 渠道 ${c.channelName} 发布失败 (预期): ${c.errorMessage}`);
      } else {
        console.log(`   - 渠道 ${c.channelName}: ${c.status}`);
      }
    });
    
  } catch (e) {
    console.log('   ✗ 发布失败:', e.message);
  }
  
  try {
    console.log('\n7. 测试重试发布...');
    if (failedChannelId) {
      try {
        await PolicyService.retryPublish(failedChannelId);
        console.log('   ✗ 重试应该失败但成功了');
      } catch (e) {
        assert(e.message.includes('渠道连接失败'), '重试发布如预期失败: ' + e.message);
      }
    } else {
      console.log('   - 跳过（没有失败的渠道）');
    }
  } catch (e) {
    console.log('   ✗ 重试失败:', e.message);
  }
  
  try {
    console.log('\n8. 测试阅读确认...');
    const result = await PolicyService.confirmReading(policyId1, 'employee_001', '张三');
    assert(result.userName === '张三', '阅读确认成功');
    
    try {
      await PolicyService.confirmReading(policyId1, 'employee_001', '张三');
      console.log('   ✗ 重复确认应该失败但成功了');
    } catch (e) {
      assert(e.message === '该用户已确认阅读', '重复确认如预期失败');
    }
    
    try {
      await PolicyService.confirmReading(policyId2, 'employee_002', '李四');
      console.log('   ✗ 未发布制度的阅读确认应该失败但成功了');
    } catch (e) {
      assert(e.message === '只有已发布的制度可以确认阅读', '未发布制度不能确认阅读');
    }
    
  } catch (e) {
    console.log('   ✗ 阅读确认失败:', e.message);
  }
  
  try {
    console.log('\n9. 测试引用检查...');
    const references = await PolicyService.checkReferences('POL-001');
    assert(references.length > 0, '找到引用 POL-001 的文档');
    references.forEach(r => {
      console.log(`     - ${r.referencingTitle} (${r.referencingPolicyCode}) [${r.referencingStatus}]`);
    });
  } catch (e) {
    console.log('   ✗ 引用检查失败:', e.message);
  }
  
  try {
    console.log('\n10. 测试废止流程（有引用的情况）...');
    try {
      await PolicyService.abolishPolicy(policyId1, '制度过期', 'admin');
      console.log('   ✗ 有引用时废止应该失败但成功了');
    } catch (e) {
      assert(e.message.includes('引用该制度的有效文档'), '有引用时废止被拦截: ' + e.message);
    }
    
  } catch (e) {
    console.log('   ✗ 废止测试失败:', e.message);
  }
  
  try {
    console.log('\n11. 测试状态流转约束...');
    const draftPolicy = await PolicyService.createPolicy({
      policyCode: 'POL-003',
      title: '测试约束制度',
      approvalNodes: [{ nodeName: '测试审批', approverRole: 'TEST' }]
    }, 'user_003');
    
    try {
      await PolicyService.publishPolicy(draftPolicy.id);
      console.log('   ✗ 草稿状态直接发布应该失败但成功了');
    } catch (e) {
      assert(e.message === '只有审批通过的制度可以发布', '草稿状态不能直接发布');
    }
    
    await PolicyService.submitForApproval(draftPolicy.id);
    
    try {
      await PolicyService.publishPolicy(draftPolicy.id);
      console.log('   ✗ 审批中状态发布应该失败但成功了');
    } catch (e) {
      assert(e.message === '只有审批通过的制度可以发布', '审批中状态不能发布');
    }
    
  } catch (e) {
    console.log('   ✗ 约束测试失败:', e.message);
  }
  
  try {
    console.log('\n12. 测试导出功能...');
    const exportData = await PolicyService.exportPolicies({});
    assert(exportData.length >= 3, `导出数据成功，共 ${exportData.length} 条`);
  } catch (e) {
    console.log('   ✗ 导出失败:', e.message);
  }
  
  try {
    console.log('\n13. 测试废止流程（无引用的情况）...');
    const noRefPolicy = await PolicyService.createPolicy({
      policyCode: 'POL-004',
      title: '待废止制度',
      approvalNodes: [{ nodeName: '测试审批', approverRole: 'TEST' }]
    }, 'user_004');
    
    await PolicyService.submitForApproval(noRefPolicy.id);
    const detail = await PolicyService.getPolicyDetail(noRefPolicy.id);
    await PolicyService.approveNode(detail.approvalNodes[0].id, 'admin', '同意');
    
    const result = await PolicyService.abolishPolicy(noRefPolicy.id, '制度过期', 'admin');
    assert(result.policy.status === 'ABOLISHED', '无引用时废止成功');
    
  } catch (e) {
    console.log('   ✗ 废止测试失败:', e.message);
  }
  
  console.log('\n=== 自检完成 ===');
  console.log('\n核心规则覆盖情况:');
  console.log('  ✓ 审批状态机 - 多节点顺序审批');
  console.log('  ✓ 越级审批拦截 - 后端强制按顺序审批');
  console.log('  ✓ 渠道发布 - 多渠道发布及失败处理');
  console.log('  ✓ 阅读回执 - 防止重复确认、限制状态');
  console.log('  ✓ 废止传播 - 引用检查防止误废止');
  console.log('  ✓ 状态约束 - 状态流转校验');
  
  if (allPassed) {
    console.log('\n✅ 所有测试通过！');
  } else {
    console.log('\n❌ 部分测试失败，请检查代码！');
    process.exit(1);
  }
}

runTests().catch(console.error);

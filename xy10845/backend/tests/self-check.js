const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

let testContentId = null;
let testAppealId = null;

async function runTests() {
  console.log('='.repeat(60));
  console.log('  内容审核申诉系统 - 自检程序');
  console.log('='.repeat(60));
  console.log('');

  const tests = [
    { name: '健康检查', fn: testHealthCheck },
    { name: '创建内容项', fn: testCreateContent },
    { name: '同步审核结果', fn: testSyncAuditResult },
    { name: '提交申诉', fn: testSubmitAppeal },
    { name: '查询申诉列表', fn: testGetAppeals },
    { name: '查询申诉详情', fn: testGetAppealDetail },
    { name: '分派审核员', fn: testAssignReviewer },
    { name: '通过申诉', fn: testApproveAppeal },
    { name: '状态机验证 - 重复操作拦截', fn: testStateMachineValidation },
    { name: '驳回申诉测试', fn: testRejectFlow },
    { name: '导出CSV报告', fn: testExportCSV },
    { name: '生成统计报告', fn: testGenerateReport }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    process.stdout.write(`  ${test.name}... `);
    try {
      await test.fn();
      console.log('\x1b[32m✓ 通过\x1b[0m');
      passed++;
    } catch (error) {
      console.log('\x1b[31m✗ 失败\x1b[0m');
      console.log(`    错误: ${error.message}`);
      failed++;
    }
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  console.log('');
  console.log('='.repeat(60));
  console.log(`  测试结果: ${passed} 通过, ${failed} 失败`);
  console.log('='.repeat(60));

  if (failed > 0) {
    process.exit(1);
  }
}

async function testHealthCheck() {
  const response = await axios.get(`${API_BASE}/health`);
  if (response.data.status !== 'ok') throw new Error('健康检查失败');
}

async function testCreateContent() {
  const response = await axios.post(`${API_BASE}/contents`, {
    contentType: 'post',
    contentText: '这是一条测试内容，用于验证申诉流程',
    authorId: 'test_user_001',
    authorName: '测试用户',
    blockTime: new Date().toISOString()
  });
  
  if (!response.data.success) throw new Error('创建内容失败');
  testContentId = response.data.data.id;
  if (!testContentId) throw new Error('未返回内容ID');
}

async function testSyncAuditResult() {
  if (!testContentId) throw new Error('缺少测试内容ID');
  
  const response = await axios.post(`${API_BASE}/contents/${testContentId}/sync-audit`, {
    tags: [
      { code: 'POLITICS', name: '政治敏感', confidence: 0.85 },
      { code: 'AD', name: '广告内容', confidence: 0.72 }
    ],
    modelReasons: [{
      modelVersion: 'v2.3.1',
      code: 'R001',
      detail: '模型检测到疑似敏感词汇',
      riskLevel: 'high',
      evidence: []
    }]
  });
  
  if (!response.data.success) throw new Error('同步审核结果失败');
}

async function testSubmitAppeal() {
  if (!testContentId) throw new Error('缺少测试内容ID');
  
  const response = await axios.post(`${API_BASE}/appeals`, {
    contentId: testContentId,
    submitterId: 'test_user_001',
    submitterName: '测试用户',
    submitterContact: '13800000000',
    appealReason: '这是正常内容，被误拦截了，请重新审核',
    evidenceMaterials: '有截图证明材料'
  });
  
  if (!response.data.success) throw new Error('提交申诉失败');
  testAppealId = response.data.data.id;
  if (!testAppealId) throw new Error('未返回申诉ID');
}

async function testGetAppeals() {
  const response = await axios.get(`${API_BASE}/appeals`);
  if (!response.data.success) throw new Error('查询申诉列表失败');
  if (!Array.isArray(response.data.data)) throw new Error('返回数据格式错误');
}

async function testGetAppealDetail() {
  if (!testAppealId) throw new Error('缺少测试申诉ID');
  
  const response = await axios.get(`${API_BASE}/appeals/${testAppealId}`);
  if (!response.data.success) throw new Error('查询申诉详情失败');
  
  const { appeal, content, auditTags, modelReasons, auditTrail } = response.data.data;
  if (!appeal) throw new Error('缺少申诉信息');
  if (!content) throw new Error('缺少内容信息');
  if (!Array.isArray(auditTags)) throw new Error('缺少审核标签');
  if (!Array.isArray(modelReasons)) throw new Error('缺少模型原因');
  if (!Array.isArray(auditTrail)) throw new Error('缺少审核轨迹');
}

async function testAssignReviewer() {
  if (!testAppealId) throw new Error('缺少测试申诉ID');
  
  const response = await axios.post(`${API_BASE}/appeals/${testAppealId}/assign`, {
    operatorId: 'admin',
    operatorName: '系统管理员'
  });
  
  if (!response.data.success) throw new Error('分派审核员失败');
  
  const detailRes = await axios.get(`${API_BASE}/appeals/${testAppealId}`);
  const appeal = detailRes.data.data.appeal;
  
  if (appeal.status !== 'reviewing') throw new Error('申诉状态未更新为审核中');
  if (!appeal.assignee_name) throw new Error('审核员未分配');
}

async function testApproveAppeal() {
  if (!testAppealId) throw new Error('缺少测试申诉ID');
  
  const response = await axios.post(`${API_BASE}/appeals/${testAppealId}/approve`, {
    disposalNote: '经审核，确认是误拦截，已恢复内容展示',
    operatorId: 'admin',
    operatorName: '系统管理员'
  });
  
  if (!response.data.success) throw new Error('通过申诉失败');
  
  const detailRes = await axios.get(`${API_BASE}/appeals/${testAppealId}`);
  const appeal = detailRes.data.data.appeal;
  
  if (appeal.status !== 'approved') throw new Error('申诉状态未更新为已通过');
  if (appeal.disposal_type !== 'restore') throw new Error('处置类型未更新');
}

async function testStateMachineValidation() {
  if (!testAppealId) throw new Error('缺少测试申诉ID');
  
  try {
    await axios.post(`${API_BASE}/appeals/${testAppealId}/approve`, {
      disposalNote: '重复尝试通过',
      operatorId: 'admin',
      operatorName: '系统管理员'
    });
    throw new Error('应该拒绝重复操作');
  } catch (error) {
    if (error.response?.status === 400) {
      return;
    }
    throw error;
  }
}

async function testRejectFlow() {
  const contentRes = await axios.post(`${API_BASE}/contents`, {
    contentType: 'comment',
    contentText: '测试驳回流程的内容',
    authorId: 'test_user_002',
    authorName: '测试用户2',
    blockTime: new Date().toISOString()
  });
  const cId = contentRes.data.data.id;
  
  const appealRes = await axios.post(`${API_BASE}/appeals`, {
    contentId: cId,
    submitterId: 'test_user_002',
    submitterName: '测试用户2',
    appealReason: '申请申诉，准备被驳回'
  });
  const aId = appealRes.data.data.id;
  
  await axios.post(`${API_BASE}/appeals/${aId}/assign`, {
    operatorId: 'admin',
    operatorName: '系统管理员'
  });
  
  const response = await axios.post(`${API_BASE}/appeals/${aId}/reject`, {
    disposalNote: '经审核，内容确实违规，维持拦截',
    operatorId: 'admin',
    operatorName: '系统管理员'
  });
  
  if (!response.data.success) throw new Error('驳回申诉失败');
  
  const detailRes = await axios.get(`${API_BASE}/appeals/${aId}`);
  if (detailRes.data.data.appeal.status !== 'rejected') {
    throw new Error('申诉状态未更新为已驳回');
  }
}

async function testExportCSV() {
  const response = await axios.get(`${API_BASE}/appeals/export/csv`, {
    responseType: 'text'
  });
  
  if (!response.data.includes('内容ID')) throw new Error('CSV格式不正确');
}

async function testGenerateReport() {
  const response = await axios.get(`${API_BASE}/appeals/report/generate`);
  
  if (!response.data.success) throw new Error('生成报告失败');
  if (!response.data.data.stats) throw new Error('缺少统计数据');
  if (!response.data.data.data) throw new Error('缺少报告数据');
}

runTests().catch(error => {
  console.error('\n\x1b[31m自检程序运行失败:\x1b[0m', error.message);
  console.log('\n请确保:');
  console.log('  1. 后端服务已启动 (npm run start)');
  console.log('  2. 数据库已初始化 (npm run init-db)');
  console.log('  3. 端口3001未被占用');
  process.exit(1);
});

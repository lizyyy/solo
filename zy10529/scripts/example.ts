import axios from 'axios'

const API_BASE = 'http://localhost:3000/api/promotions'
const OPERATOR = '张三'

async function example() {
  console.log('=== 制品晋级审批API示例 ===\n')

  try {
    console.log('1. 创建晋级申请...')
    const createResponse = await axios.post(API_BASE, {
      artifactName: '订单服务',
      version: '1.0.0',
      buildNumber: '20240517001',
      commitHash: 'abc123def456',
      buildBranch: 'release/1.0.0',
      fromEnvironment: 'TEST',
      toEnvironment: 'PRODUCTION',
      title: '订单服务v1.0.0生产环境晋级',
      description: '包含性能优化、Bug修复、新功能A上线',
      initiator: '张三'
    }, {
      headers: { 'x-operator': OPERATOR }
    })
    const promotionId = createResponse.data.id
    console.log(`   晋级ID: ${promotionId}`)
    console.log(`   当前状态: ${createResponse.data.status}`)
    console.log('   ✓ 创建成功\n')

    console.log('2. 启动晋级流程...')
    const startResponse = await axios.post(`${API_BASE}/${promotionId}/start`, {}, {
      headers: { 'x-operator': OPERATOR }
    })
    console.log(`   当前状态: ${startResponse.data.status}`)
    console.log(`   当前步骤: ${startResponse.data.currentStep}/${startResponse.data.totalSteps}`)
    console.log('   ✓ 启动成功\n')

    console.log('3. 提交测试结果...')
    const testResponse = await axios.post(`${API_BASE}/test-result`, {
      promotionId,
      testSuite: '集成测试套件',
      totalTests: 150,
      passedTests: 148,
      failedTests: 1,
      skippedTests: 1,
      testResult: 'PASS',
      testDuration: 180,
      testReportUrl: 'http://test-reports.example.com/run/12345',
      coveragePercent: 85.5,
      criticalIssues: [],
      gatePassed: true,
      remarks: '失败用例为已知问题，已获业务方确认',
      verifiedBy: '李四'
    }, {
      headers: { 'x-operator': OPERATOR }
    })
    console.log(`   测试通过率: ${(148/150*100).toFixed(1)}%`)
    console.log(`   门禁通过: 是`)
    console.log(`   当前状态: ${testResponse.data.status}`)
    console.log('   ✓ 测试结果提交成功\n')

    console.log('4. 提交签名...')
    const signatureResponse = await axios.post(`${API_BASE}/signature`, {
      promotionId,
      signatory: '王五',
      signatureData: '0xabcdef123456789',
      signatureAlgorithm: 'SHA256withRSA',
      certificateInfo: 'CN=王五, OU=技术部, O=公司',
      remarks: '代码评审通过，符合发布规范'
    }, {
      headers: { 'x-operator': OPERATOR }
    })
    console.log(`   签名状态: ${signatureResponse.data.signature?.signatureStatus}`)
    console.log(`   当前状态: ${signatureResponse.data.status}`)
    console.log('   ✓ 签名提交成功\n')

    console.log('5. 提交审批...')
    const approvalResponse = await axios.post(`${API_BASE}/approval`, {
      promotionId,
      approver: '赵六',
      approverRole: '技术总监',
      decision: 'APPROVE',
      comments: '符合上线要求，同意发布',
      sequenceOrder: 1
    }, {
      headers: { 'x-operator': OPERATOR }
    })
    console.log(`   审批结果: 同意`)
    console.log(`   当前状态: ${approvalResponse.data.status}`)
    console.log('   ✓ 审批提交成功\n')

    console.log('6. 完成晋级...')
    const completeResponse = await axios.post(`${API_BASE}/${promotionId}/complete`, {}, {
      headers: { 'x-operator': OPERATOR }
    })
    console.log(`   最终状态: ${completeResponse.data.status}`)
    console.log('   ✓ 晋级完成\n')

    console.log('7. 导出JSON报告...')
    const jsonResponse = await axios.get(`${API_BASE}/${promotionId}/export/json`, {
      headers: { 'x-operator': OPERATOR },
      responseType: 'text'
    })
    const reportData = JSON.parse(jsonResponse.data)
    console.log(`   报告标题: ${reportData.基本信息.晋级标题}`)
    console.log(`   制品名称: ${reportData.制品信息.制品名称}`)
    console.log(`   版本号: ${reportData.制品信息.版本号}`)
    console.log(`   测试结果: ${reportData.测试结果.测试结果}`)
    console.log(`   审批记录数: ${reportData.审批记录.length}`)
    console.log('   ✓ JSON报告导出成功\n')

    console.log('8. 查看晋级详情...')
    const detailResponse = await axios.get(`${API_BASE}/${promotionId}`, {
      headers: { 'x-operator': OPERATOR }
    })
    console.log(`   进度: ${detailResponse.data.progress}%`)
    console.log(`   审批记录: ${detailResponse.data.approvals.length}条`)
    console.log(`   审计日志: ${detailResponse.data.auditLogs.length}条`)
    console.log('   ✓ 详情查询成功\n')

    console.log('=== 示例流程执行完成 ===')
    console.log(`\n晋级ID: ${promotionId}`)
    console.log(`导出CSV: curl -O "http://localhost:3000/api/promotions/${promotionId}/export/csv"`)
    console.log(`导出PDF: curl -O "http://localhost:3000/api/promotions/${promotionId}/export/pdf"`)

  } catch (error: any) {
    console.error('❌ 执行失败:', error.response?.data || error.message)
  }
}

if (require.main === module) {
  example()
}

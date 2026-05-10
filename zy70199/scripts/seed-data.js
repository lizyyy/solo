const EmployeeService = require('../src/services/employee.service');
const DocumentService = require('../src/services/document.service');
const RemediationService = require('../src/services/remediation.service');
const ContractService = require('../src/services/contract.service');
const AccountService = require('../src/services/account.service');
const SalaryService = require('../src/services/salary.service');
const ReportService = require('../src/services/report.service');
const { EmployeeStatus, DocumentStatus } = require('../src/models');
const logger = require('../src/utils/logger');

async function seedSampleData() {
  logger.info('开始初始化样例数据...');
  
  DocumentService.initializeCatalog();
  logger.info('资料目录已初始化');
  
  logger.info('\n========== 场景1: 正常入职流程 ==========');
  const employee1 = EmployeeService.create({
    name: '张三',
    email: 'zhangsan@example.com',
    department: '技术部',
    position: '高级开发工程师',
    hireDate: '2026-06-01'
  }, 'hr-admin');
  logger.info(`创建员工: ${employee1.name} (${employee1.id})`);
  
  DocumentService.initializeEmployeeDocuments(employee1.id, 'hr-admin');
  logger.info('初始化员工资料列表');
  
  const docs1 = DocumentService.getEmployeeDocuments(employee1.id);
  
  for (const doc of docs1.documents) {
    if (doc.isRequired) {
      DocumentService.submitDocument(employee1.id, doc.id, {
        fileUrl: `https://example.com/docs/${doc.id}`,
        content: `${doc.name}的内容`
      }, 'zhangsan');
      
      DocumentService.approveDocument(employee1.id, doc.id, 'hr-admin');
    }
  }
  logger.info('所有必填资料已提交并审批通过');
  
  const employee1AfterDocs = EmployeeService.getById(employee1.id);
  logger.info(`员工状态: ${employee1AfterDocs.status}`);
  
  const contract1 = ContractService.generate(employee1.id, {
    contractType: 'FULL_TIME',
    salary: 25000,
    startDate: '2026-06-01',
    terms: '标准劳动合同条款'
  }, 'hr-admin');
  logger.info(`合同已生成: ${contract1.id} (版本 ${contract1.version})`);
  
  const account1 = AccountService.create(employee1.id, {
    username: 'zhangsan',
    role: 'EMPLOYEE',
    permissions: ['employee:read', 'employee:write:self']
  }, 'it-admin');
  logger.info(`账号已创建: ${account1.username}`);
  
  const salary1 = SalaryService.establish(employee1.id, {
    baseSalary: 25000,
    bonus: 5000,
    allowance: 2000,
    bankName: '工商银行',
    bankAccount: '6222021234567890123'
  }, 'finance-admin');
  logger.info(`薪资档案已建立: 基本工资 ${salary1.baseSalary}`);
  
  const finalEmployee1 = EmployeeService.getById(employee1.id);
  logger.info(`最终员工状态: ${finalEmployee1.status}`);
  
  
  logger.info('\n========== 场景2: 资料缺失被拦截 ==========');
  const employee2 = EmployeeService.create({
    name: '李四',
    email: 'lisi@example.com',
    department: '市场部',
    position: '市场经理',
    hireDate: '2026-06-15'
  }, 'hr-admin');
  logger.info(`创建员工: ${employee2.name} (${employee2.id})`);
  
  DocumentService.initializeEmployeeDocuments(employee2.id, 'hr-admin');
  
  const docs2 = DocumentService.getEmployeeDocuments(employee2.id);
  const identityDoc = docs2.documents.find(d => d.catalogCode === 'IDENTITY');
  const educationDoc = docs2.documents.find(d => d.catalogCode === 'EDUCATION');
  
  DocumentService.submitDocument(employee2.id, identityDoc.id, {
    fileUrl: 'https://example.com/docs/identity_lisi',
    content: '身份证复印件'
  }, 'lisi');
  DocumentService.approveDocument(employee2.id, identityDoc.id, 'hr-admin');
  logger.info('仅提交并审批了身份证，缺少学历证书等资料');
  
  try {
    ContractService.generate(employee2.id, {
      contractType: 'FULL_TIME',
      salary: 20000
    }, 'hr-admin');
    logger.error('ERROR: 应该被拦截但成功生成了合同');
  } catch (error) {
    logger.info(`✓ 合同生成被正确拦截: ${error.message}`);
  }
  
  const canGenerateResult = ContractService.canGenerate(employee2.id);
  logger.info(`合同生成检查结果: canGenerate=${canGenerateResult.canGenerate}, reason=${canGenerateResult.reason}`);
  
  const missingDocs = DocumentService.getMissingRequiredDocuments(employee2.id);
  logger.info(`缺失的必填资料: ${missingDocs.map(d => d.name).join(', ')}`);
  
  DocumentService.submitDocument(employee2.id, educationDoc.id, {
    fileUrl: 'https://example.com/docs/education_lisi',
    content: '学历证书'
  }, 'lisi');
  DocumentService.rejectDocument(employee2.id, educationDoc.id, '学历证书模糊不清，请重新提交', 'hr-admin');
  logger.info('学历证书已提交但被拒绝');
  
  DocumentService.submitDocument(employee2.id, educationDoc.id, {
    fileUrl: 'https://example.com/docs/education_lisi_v2',
    content: '清晰的学历证书'
  }, 'lisi');
  DocumentService.approveDocument(employee2.id, educationDoc.id, 'hr-admin');
  
  for (const doc of docs2.documents) {
    if (doc.isRequired && doc.catalogCode !== 'IDENTITY' && doc.catalogCode !== 'EDUCATION') {
      DocumentService.submitDocument(employee2.id, doc.id, {
        fileUrl: `https://example.com/docs/${doc.id}`,
        content: `${doc.name}的内容`
      }, 'lisi');
      DocumentService.approveDocument(employee2.id, doc.id, 'hr-admin');
    }
  }
  logger.info('补齐所有资料并审批通过');
  
  const contract2 = ContractService.generate(employee2.id, {
    contractType: 'FULL_TIME',
    salary: 20000,
    startDate: '2026-06-15'
  }, 'hr-admin');
  logger.info(`合同已成功生成: ${contract2.id}`);
  
  
  logger.info('\n========== 场景3: 重复操作测试 ==========');
  const employee3 = EmployeeService.create({
    name: '王五',
    email: 'wangwu@example.com',
    department: '财务部',
    position: '财务专员',
    hireDate: '2026-06-20'
  }, 'hr-admin');
  logger.info(`创建员工: ${employee3.name} (${employee3.id})`);
  
  DocumentService.initializeEmployeeDocuments(employee3.id, 'hr-admin');
  
  const docs3 = DocumentService.getEmployeeDocuments(employee3.id);
  const photoDoc = docs3.documents.find(d => d.catalogCode === 'PHOTO');
  
  DocumentService.submitDocument(employee3.id, photoDoc.id, {
    fileUrl: 'https://example.com/docs/photo_wangwu',
    content: '一寸照片'
  }, 'wangwu');
  DocumentService.approveDocument(employee3.id, photoDoc.id, 'hr-admin');
  logger.info('照片已提交并审批通过');
  
  try {
    DocumentService.submitDocument(employee3.id, photoDoc.id, {
      fileUrl: 'https://example.com/docs/photo_wangwu_v2',
      content: '另一张照片'
    }, 'wangwu');
    logger.error('ERROR: 应该被拦截但成功重复提交了');
  } catch (error) {
    logger.info(`✓ 重复提交被正确拦截: ${error.message}`);
  }
  
  for (const doc of docs3.documents) {
    if (doc.isRequired) {
      if (doc.catalogCode !== 'PHOTO') {
        DocumentService.submitDocument(employee3.id, doc.id, {
          fileUrl: `https://example.com/docs/${doc.id}`,
          content: `${doc.name}的内容`
        }, 'wangwu');
        DocumentService.approveDocument(employee3.id, doc.id, 'hr-admin');
      }
    }
  }
  logger.info('所有资料已完成');
  
  const contract3 = ContractService.generate(employee3.id, {
    contractType: 'FULL_TIME',
    salary: 15000,
    startDate: '2026-06-20'
  }, 'hr-admin');
  logger.info(`第一次合同已生成: ${contract3.id} (版本 ${contract3.version})`);
  
  try {
    ContractService.sign(contract3.id, 'hr-admin');
    logger.info('合同已签署');
  } catch (e) {}
  
  try {
    ContractService.sign(contract3.id, 'hr-admin');
    logger.error('ERROR: 应该被拦截但成功重复签署了');
  } catch (error) {
    logger.info(`✓ 重复签署被正确拦截: ${error.message}`);
  }
  
  
  logger.info('\n========== 场景4: 人工状态修正 ==========');
  const employee4 = EmployeeService.create({
    name: '赵六',
    email: 'zhaoliu@example.com',
    department: '人事部',
    position: 'HR专员',
    hireDate: '2026-06-25'
  }, 'hr-admin');
  logger.info(`创建员工: ${employee4.name} (${employee4.id})`);
  
  logger.info(`员工当前状态: ${employee4.status}`);
  
  const correctionResult = EmployeeService.manuallyCorrectStatus(
    employee4.id,
    EmployeeStatus.DOCUMENTS_COMPLETE,
    '特殊情况：员工资料通过线下渠道提交并已审核',
    'hr-manager'
  );
  logger.info(`人工修正结果: ${correctionResult.previousStatus} -> ${correctionResult.newStatus}`);
  logger.info(`修正原因: ${correctionResult.reason}`);
  
  const contract4 = ContractService.generate(employee4.id, {
    contractType: 'FULL_TIME',
    salary: 12000,
    startDate: '2026-06-25'
  }, 'hr-admin');
  logger.info(`人工修正后成功生成合同: ${contract4.id}`);
  
  const validation = ReportService.validateOnboardingFlow(employee4.id);
  logger.info(`流程验证结果: valid=${validation.valid}`);
  logger.info(`警告信息: ${validation.warnings.join(', ')}`);
  
  const statusHistory = ReportService.getHistoryReport(employee4.id);
  logger.info(`状态变更历史记录数: ${statusHistory.statusHistory.length}`);
  for (const h of statusHistory.statusHistory) {
    logger.info(`  - ${h.timestamp}: ${h.previousStatus} -> ${h.newStatus} (${h.reason})`);
  }
  
  
  logger.info('\n========== 样例数据初始化完成 ==========');
  logger.info('\n数据统计:');
  
  const dashboard = ReportService.getOnboardingDashboard();
  logger.info(`员工总数: ${dashboard.completionStats.totalEmployees}`);
  logger.info(`已生成合同: ${dashboard.completionStats.withContracts}`);
  logger.info(`已创建账号: ${dashboard.completionStats.withAccounts}`);
  logger.info(`已建立薪资: ${dashboard.completionStats.withSalary}`);
  logger.info(`资料合规率: 身份证 ${dashboard.documentStats.approved}/${dashboard.documentStats.required}`);
  
  logger.info('\n样例员工ID:');
  logger.info(`  张三 (正常流程): ${employee1.id}`);
  logger.info(`  李四 (资料缺失拦截): ${employee2.id}`);
  logger.info(`  王五 (重复操作测试): ${employee3.id}`);
  logger.info(`  赵六 (人工状态修正): ${employee4.id}`);
  
  return {
    employee1,
    employee2,
    employee3,
    employee4
  };
}

if (require.main === module) {
  seedSampleData().catch(error => {
    logger.error('初始化样例数据失败:', error);
    process.exit(1);
  });
}

module.exports = seedSampleData;

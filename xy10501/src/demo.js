const {
  createSupplier,
  getSuppliers,
  freezeSupplier,
  unfreezeSupplier,
  uploadCertificate,
  getCertificatesBySupplier,
  submitRenewalApplication,
  createProject,
  getProjects,
  createProjectAccess,
  updateProjectAccessStatus,
  createInspection,
  executeInspection,
  getInspectionResults,
  resolveRisk,
  getRiskReport,
  addDays,
  now,
  EXPIRING_SOON_DAYS
} = require('./services');

const { store, PROJECT_ACCESS_STATUS } = require('./models');

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function printSeparator() {
  console.log('\n' + '='.repeat(80));
}

function printTitle(title) {
  printSeparator();
  console.log(`  ${title}`);
  printSeparator();
}

function printObject(obj, indent = 0) {
  const prefix = ' '.repeat(indent);
  console.log(prefix + JSON.stringify(obj, null, 2));
}

function runDemo() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║           供应商资质到期巡检 API 系统演示                         ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  
  const today = now();
  
  printTitle('场景1: 正常准入 - 资质齐全，证照有效');
  
  const supplier1 = createSupplier({
    name: '北京科技有限公司',
    code: 'BJ-TECH-001',
    contact: '张三',
    phone: '13800000001',
    operator: 'ADMIN-001'
  });
  console.log('✅ 创建供应商:', supplier1.name, '(ID:', supplier1.id + ')');
  
  const cert1Supplier1 = uploadCertificate({
    supplierId: supplier1.id,
    type: 'BUSINESS_LICENSE',
    certificateNo: 'BL-2024-0001',
    name: '营业执照',
    issueDate: formatDate(addDays(today, -365)),
    expiryDate: formatDate(addDays(today, 365)),
    uploader: 'OPER-001'
  });
  console.log('✅ 上传证照 [营业执照]:', cert1Supplier1.certificateNo, '(有效期至:', cert1Supplier1.expiryDate + ')');
  
  const cert2Supplier1 = uploadCertificate({
    supplierId: supplier1.id,
    type: 'QUALIFICATION_CERT',
    certificateNo: 'QC-2024-0001',
    name: '资质证书',
    issueDate: formatDate(addDays(today, -180)),
    expiryDate: formatDate(addDays(today, 545)),
    uploader: 'OPER-001'
  });
  console.log('✅ 上传证照 [资质证书]:', cert2Supplier1.certificateNo, '(有效期至:', cert2Supplier1.expiryDate + ')');
  
  const project1 = createProject({
    name: '智慧园区建设项目',
    code: 'PROJECT-001',
    requiredCertificateTypes: ['BUSINESS_LICENSE', 'QUALIFICATION_CERT'],
    status: 'ACTIVE'
  });
  console.log('✅ 创建项目:', project1.name, '(ID:', project1.id + ')');
  
  const access1 = createProjectAccess({
    supplierId: supplier1.id,
    projectId: project1.id,
    operator: 'PROCUREMENT-001'
  });
  console.log('✅ 创建项目准入:', access1.id);
  
  const approvedAccess1 = updateProjectAccessStatus(
    access1.id,
    PROJECT_ACCESS_STATUS.APPROVED,
    'MANAGER-001',
    '资质审核通过'
  );
  console.log('✅ 审批准入: 状态 =', approvedAccess1.status);
  
  printTitle('场景2: 临期提醒 - 证照30天内到期');
  
  const supplier2 = createSupplier({
    name: '上海贸易有限公司',
    code: 'SH-TRADE-001',
    contact: '李四',
    phone: '13800000002',
    operator: 'ADMIN-001'
  });
  console.log('✅ 创建供应商:', supplier2.name, '(ID:', supplier2.id + ')');
  
  const cert1Supplier2 = uploadCertificate({
    supplierId: supplier2.id,
    type: 'BUSINESS_LICENSE',
    certificateNo: 'BL-2024-0002',
    name: '营业执照',
    issueDate: formatDate(addDays(today, -300)),
    expiryDate: formatDate(addDays(today, 15)),
    uploader: 'OPER-002'
  });
  console.log('⚠️ 上传证照 [营业执照]:', cert1Supplier2.certificateNo, '(有效期至:', cert1Supplier2.expiryDate + ', 仅剩15天)');
  
  const cert2Supplier2 = uploadCertificate({
    supplierId: supplier2.id,
    type: 'QUALIFICATION_CERT',
    certificateNo: 'QC-2024-0002',
    name: '资质证书',
    issueDate: formatDate(addDays(today, -200)),
    expiryDate: formatDate(addDays(today, 165)),
    uploader: 'OPER-002'
  });
  console.log('✅ 上传证照 [资质证书]:', cert2Supplier2.certificateNo, '(有效期至:', cert2Supplier2.expiryDate + ')');
  
  const project2 = createProject({
    name: '办公楼装修项目',
    code: 'PROJECT-002',
    requiredCertificateTypes: ['BUSINESS_LICENSE', 'QUALIFICATION_CERT'],
    status: 'ACTIVE'
  });
  console.log('✅ 创建项目:', project2.name, '(ID:', project2.id + ')');
  
  const access2 = createProjectAccess({
    supplierId: supplier2.id,
    projectId: project2.id,
    operator: 'PROCUREMENT-002'
  });
  console.log('✅ 创建项目准入:', access2.id);
  
  const approvedAccess2 = updateProjectAccessStatus(
    access2.id,
    PROJECT_ACCESS_STATUS.APPROVED,
    'MANAGER-002',
    '资质审核通过'
  );
  console.log('✅ 审批准入: 状态 =', approvedAccess2.status);
  
  printTitle('场景3: 过期拦截 - 证照已过期');
  
  const supplier3 = createSupplier({
    name: '广州建材有限公司',
    code: 'GZ-MAT-001',
    contact: '王五',
    phone: '13800000003',
    operator: 'ADMIN-001'
  });
  console.log('✅ 创建供应商:', supplier3.name, '(ID:', supplier3.id + ')');
  
  const cert1Supplier3 = uploadCertificate({
    supplierId: supplier3.id,
    type: 'BUSINESS_LICENSE',
    certificateNo: 'BL-2024-0003',
    name: '营业执照',
    issueDate: formatDate(addDays(today, -400)),
    expiryDate: formatDate(addDays(today, -35)),
    uploader: 'OPER-003'
  });
  console.log('❌ 上传证照 [营业执照]:', cert1Supplier3.certificateNo, '(有效期至:', cert1Supplier3.expiryDate + ', 已过期35天)');
  
  const cert2Supplier3 = uploadCertificate({
    supplierId: supplier3.id,
    type: 'QUALIFICATION_CERT',
    certificateNo: 'QC-2024-0003',
    name: '资质证书',
    issueDate: formatDate(addDays(today, -200)),
    expiryDate: formatDate(addDays(today, 165)),
    uploader: 'OPER-003'
  });
  console.log('✅ 上传证照 [资质证书]:', cert2Supplier3.certificateNo, '(有效期至:', cert2Supplier3.expiryDate + ')');
  
  const project3 = createProject({
    name: '道路改造项目',
    code: 'PROJECT-003',
    requiredCertificateTypes: ['BUSINESS_LICENSE', 'QUALIFICATION_CERT'],
    status: 'ACTIVE'
  });
  console.log('✅ 创建项目:', project3.name, '(ID:', project3.id + ')');
  
  const access3 = createProjectAccess({
    supplierId: supplier3.id,
    projectId: project3.id,
    operator: 'PROCUREMENT-003'
  });
  console.log('✅ 创建项目准入:', access3.id);
  
  const approvedAccess3 = updateProjectAccessStatus(
    access3.id,
    PROJECT_ACCESS_STATUS.APPROVED,
    'MANAGER-003',
    '资质审核通过'
  );
  console.log('✅ 审批准入: 状态 =', approvedAccess3.status);
  
  printTitle('场景4: 续期恢复 - 临期后提交续期');
  
  const supplier4 = createSupplier({
    name: '深圳电子有限公司',
    code: 'SZ-ELEC-001',
    contact: '赵六',
    phone: '13800000004',
    operator: 'ADMIN-001'
  });
  console.log('✅ 创建供应商:', supplier4.name, '(ID:', supplier4.id + ')');
  
  const cert1Supplier4 = uploadCertificate({
    supplierId: supplier4.id,
    type: 'BUSINESS_LICENSE',
    certificateNo: 'BL-2024-0004',
    name: '营业执照',
    issueDate: formatDate(addDays(today, -350)),
    expiryDate: formatDate(addDays(today, 10)),
    uploader: 'OPER-004'
  });
  console.log('⚠️ 上传证照 [营业执照]:', cert1Supplier4.certificateNo, '(有效期至:', cert1Supplier4.expiryDate + ', 仅剩10天)');
  
  const renewedCert = submitRenewalApplication(cert1Supplier4.id, {
    submitter: 'OPER-004',
    expectedExpiryDate: formatDate(addDays(today, 375))
  });
  console.log('✅ 提交续期申请: 状态 =', renewedCert.status);
  
  const cert2Supplier4 = uploadCertificate({
    supplierId: supplier4.id,
    type: 'QUALIFICATION_CERT',
    certificateNo: 'QC-2024-0004',
    name: '资质证书',
    issueDate: formatDate(addDays(today, -200)),
    expiryDate: formatDate(addDays(today, 165)),
    uploader: 'OPER-004'
  });
  console.log('✅ 上传证照 [资质证书]:', cert2Supplier4.certificateNo, '(有效期至:', cert2Supplier4.expiryDate + ')');
  
  const project4 = createProject({
    name: '电子设备采购项目',
    code: 'PROJECT-004',
    requiredCertificateTypes: ['BUSINESS_LICENSE', 'QUALIFICATION_CERT'],
    status: 'ACTIVE'
  });
  console.log('✅ 创建项目:', project4.name, '(ID:', project4.id + ')');
  
  const access4 = createProjectAccess({
    supplierId: supplier4.id,
    projectId: project4.id,
    operator: 'PROCUREMENT-004'
  });
  console.log('✅ 创建项目准入:', access4.id);
  
  const approvedAccess4 = updateProjectAccessStatus(
    access4.id,
    PROJECT_ACCESS_STATUS.APPROVED,
    'MANAGER-004',
    '资质审核通过'
  );
  console.log('✅ 审批准入: 状态 =', approvedAccess4.status);
  
  printTitle('场景5: 冻结供应商 - 已准入供应商被冻结');
  
  const supplier5 = createSupplier({
    name: '成都物流有限公司',
    code: 'CD-LOG-001',
    contact: '钱七',
    phone: '13800000005',
    operator: 'ADMIN-001'
  });
  console.log('✅ 创建供应商:', supplier5.name, '(ID:', supplier5.id + ')');
  
  const cert1Supplier5 = uploadCertificate({
    supplierId: supplier5.id,
    type: 'BUSINESS_LICENSE',
    certificateNo: 'BL-2024-0005',
    name: '营业执照',
    issueDate: formatDate(addDays(today, -200)),
    expiryDate: formatDate(addDays(today, 165)),
    uploader: 'OPER-005'
  });
  console.log('✅ 上传证照 [营业执照]:', cert1Supplier5.certificateNo, '(有效期至:', cert1Supplier5.expiryDate + ')');
  
  const cert2Supplier5 = uploadCertificate({
    supplierId: supplier5.id,
    type: 'QUALIFICATION_CERT',
    certificateNo: 'QC-2024-0005',
    name: '资质证书',
    issueDate: formatDate(addDays(today, -200)),
    expiryDate: formatDate(addDays(today, 165)),
    uploader: 'OPER-005'
  });
  console.log('✅ 上传证照 [资质证书]:', cert2Supplier5.certificateNo, '(有效期至:', cert2Supplier5.expiryDate + ')');
  
  const project5 = createProject({
    name: '物流配送项目',
    code: 'PROJECT-005',
    requiredCertificateTypes: ['BUSINESS_LICENSE', 'QUALIFICATION_CERT'],
    status: 'ACTIVE'
  });
  console.log('✅ 创建项目:', project5.name, '(ID:', project5.id + ')');
  
  const access5 = createProjectAccess({
    supplierId: supplier5.id,
    projectId: project5.id,
    operator: 'PROCUREMENT-005'
  });
  console.log('✅ 创建项目准入:', access5.id);
  
  const approvedAccess5 = updateProjectAccessStatus(
    access5.id,
    PROJECT_ACCESS_STATUS.APPROVED,
    'MANAGER-005',
    '资质审核通过'
  );
  console.log('✅ 审批准入: 状态 =', approvedAccess5.status);
  
  const frozenSupplier5 = freezeSupplier(
    supplier5.id,
    '供应商涉及重大诉讼，存在履约风险',
    'COMPLIANCE-001'
  );
  console.log('❌ 冻结供应商:', frozenSupplier5.name, '(状态 =', frozenSupplier5.status + ')');
  
  printTitle('场景6: 证照多版本 - 同一证照类型多次上传');
  
  const supplier6 = createSupplier({
    name: '杭州软件有限公司',
    code: 'HZ-SOFT-001',
    contact: '孙八',
    phone: '13800000006',
    operator: 'ADMIN-001'
  });
  console.log('✅ 创建供应商:', supplier6.name, '(ID:', supplier6.id + ')');
  
  const cert1V1 = uploadCertificate({
    supplierId: supplier6.id,
    type: 'BUSINESS_LICENSE',
    certificateNo: 'BL-2023-0006',
    name: '营业执照 (旧版)',
    issueDate: formatDate(addDays(today, -400)),
    expiryDate: formatDate(addDays(today, -40)),
    uploader: 'OPER-006'
  });
  console.log('❌ 上传证照 [营业执照 V1]:', cert1V1.certificateNo, '(版本:', cert1V1.version + ', 已过期)');
  
  const cert1V2 = uploadCertificate({
    supplierId: supplier6.id,
    type: 'BUSINESS_LICENSE',
    certificateNo: 'BL-2024-0006',
    name: '营业执照 (新版)',
    issueDate: formatDate(addDays(today, -50)),
    expiryDate: formatDate(addDays(today, 315)),
    uploader: 'OPER-006'
  });
  console.log('✅ 上传证照 [营业执照 V2]:', cert1V2.certificateNo, '(版本:', cert1V2.version + ', isLatest:', cert1V2.isLatest + ')');
  
  const cert2Supplier6 = uploadCertificate({
    supplierId: supplier6.id,
    type: 'QUALIFICATION_CERT',
    certificateNo: 'QC-2024-0006',
    name: '资质证书',
    issueDate: formatDate(addDays(today, -200)),
    expiryDate: formatDate(addDays(today, 165)),
    uploader: 'OPER-006'
  });
  console.log('✅ 上传证照 [资质证书]:', cert2Supplier6.certificateNo, '(有效期至:', cert2Supplier6.expiryDate + ')');
  
  const project6 = createProject({
    name: '软件开发项目',
    code: 'PROJECT-006',
    requiredCertificateTypes: ['BUSINESS_LICENSE', 'QUALIFICATION_CERT'],
    status: 'ACTIVE'
  });
  console.log('✅ 创建项目:', project6.name, '(ID:', project6.id + ')');
  
  const access6 = createProjectAccess({
    supplierId: supplier6.id,
    projectId: project6.id,
    operator: 'PROCUREMENT-006'
  });
  console.log('✅ 创建项目准入:', access6.id);
  
  const approvedAccess6 = updateProjectAccessStatus(
    access6.id,
    PROJECT_ACCESS_STATUS.APPROVED,
    'MANAGER-006',
    '资质审核通过'
  );
  console.log('✅ 审批准入: 状态 =', approvedAccess6.status);
  
  printTitle('执行全面巡检');
  
  const inspection = createInspection({
    name: '月度资质巡检 ' + formatDate(today),
    type: 'FULL',
    operator: 'AUDIT-001'
  });
  console.log('✅ 创建巡检:', inspection.name, '(ID:', inspection.id + ')');
  
  const result = executeInspection(inspection.id, 'AUDIT-001');
  console.log('✅ 执行巡检完成');
  console.log('📊 巡检摘要:');
  console.log('   - 总检查数:', result.inspection.resultSummary.total);
  console.log('   - 通过数:', result.inspection.resultSummary.passed);
  console.log('   - 失败数:', result.inspection.resultSummary.failed);
  console.log('   - 警告数:', result.inspection.resultSummary.warnings);
  console.log('   - 高风险:', result.inspection.resultSummary.highRiskCount);
  console.log('   - 中风险:', result.inspection.resultSummary.mediumRiskCount);
  console.log('   - 巡检状态:', result.inspection.status);
  
  printTitle('巡检风险详情');
  
  const risks = result.risks;
  console.log(`🔍 共发现 ${risks.length} 个风险项:`);
  console.log('');
  
  risks.forEach((risk, index) => {
    console.log(`  [${index + 1}] ${risk.severity === 'HIGH' ? '🔴 高风险' : '🟡 中风险'}`);
    console.log(`      项目: ${risk.projectName}`);
    console.log(`      供应商: ${risk.supplierName}`);
    if (risk.certificateType) {
      console.log(`      证照类型: ${risk.certificateType}`);
      if (risk.certificateNo) console.log(`      证照编号: ${risk.certificateNo}`);
    }
    console.log(`      风险类型: ${risk.riskType}`);
    console.log(`      描述: ${risk.message}`);
    console.log(`      原准入状态: ${risk.projectAccessStatus}`);
    console.log(`      是否已拦截: ${risk.intercepted ? '✅ 已拦截' : '❌ 未拦截'}`);
    console.log('');
  });
  
  printTitle('验证拦截效果 - 检查项目准入状态变化');
  
  const allAccesses = [access1, access2, access3, access4, access5, access6];
  console.log('📋 项目准入状态检查:');
  console.log('');
  
  allAccesses.forEach((access, index) => {
    const supplier = getSuppliers()[index];
    const project = getProjects()[index];
    const currentAccess = store.projectAccesses.get(access.id);
    
    console.log(`  [${index + 1}] 项目: ${project?.name || '未知'}`);
    console.log(`      供应商: ${supplier?.name || '未知'}`);
    console.log(`      准入状态: ${currentAccess.status}`);
    if (currentAccess.history.length > 1) {
      const lastChange = currentAccess.history[currentAccess.history.length - 1];
      if (lastChange.reason) {
        console.log(`      变更原因: ${lastChange.reason}`);
      }
    }
    console.log('');
  });
  
  printTitle('人工复核 - 处理已拦截的风险');
  
  const interceptedRisks = risks.filter(r => r.intercepted);
  console.log(`🔧 需要处理的拦截风险: ${interceptedRisks.length} 个`);
  console.log('');
  
  if (interceptedRisks.length > 0) {
    const riskToHandle = interceptedRisks[0];
    console.log(`处理风险 ID: ${riskToHandle.id}`);
    console.log(`风险描述: ${riskToHandle.message}`);
    console.log('');
    
    const resolvedRisk = resolveRisk(
      riskToHandle.id,
      {
        action: 'REQUIRE_RENEWAL',
        reason: '要求供应商立即更新过期证照'
      },
      'REVIEWER-001'
    );
    
    console.log('✅ 风险已处理');
    console.log('   - 处理动作:', resolvedRisk.resolution);
    console.log('   - 处理人:', resolvedRisk.resolvedBy);
    console.log('   - 处理时间:', resolvedRisk.resolvedAt);
    console.log('   - 记录前后差异:');
    
    const reviews = Array.from(store.manualReviews.values()).filter(
      r => r.inspectionResultId === riskToHandle.id
    );
    if (reviews.length > 0) {
      const review = reviews[0];
      console.log('     变更前:');
      console.log('       - 已解决:', review.before?.resolved || false);
      console.log('       - 原准入状态:', review.before?.projectAccessStatus);
      console.log('     变更后:');
      console.log('       - 已解决:', review.after?.resolved);
      console.log('       - 处理动作:', review.after?.resolution);
      console.log('       - 处理人:', review.after?.resolvedBy);
    }
  }
  
  printTitle('生成风险报告');
  
  const report = getRiskReport();
  console.log('📊 风险报告摘要:');
  console.log('   - 总风险数:', report.summary.totalRisks);
  console.log('   - 高风险:', report.summary.highRisk);
  console.log('   - 中风险:', report.summary.mediumRisk);
  console.log('   - 已拦截:', report.summary.intercepted);
  console.log('   - 已处理:', report.summary.resolved);
  console.log('');
  
  console.log('📁 按项目分组:');
  report.byProject.forEach((p, idx) => {
    console.log(`  [${idx + 1}] ${p.projectName}`);
    console.log(`      高风险: ${p.highCount}, 中风险: ${p.mediumCount}, 已拦截: ${p.interceptedCount}`);
  });
  console.log('');
  
  console.log('📁 按供应商分组:');
  report.bySupplier.forEach((s, idx) => {
    console.log(`  [${idx + 1}] ${s.supplierName}`);
    console.log(`      高风险: ${s.highCount}, 中风险: ${s.mediumCount}, 已拦截: ${s.interceptedCount}`);
  });
  console.log('');
  
  console.log('📁 按证照类型分组:');
  report.byCertificateType.forEach((c, idx) => {
    console.log(`  [${idx + 1}] ${c.projectName} - ${c.supplierName} - ${c.certificateType}`);
    console.log(`      高风险: ${c.highCount}, 中风险: ${c.mediumCount}, 已拦截: ${c.interceptedCount}`);
  });
  
  printTitle('演示历史记录 - 状态变更和操作留痕');
  
  console.log('📜 供应商历史记录示例 (供应商3 - 广州建材):');
  if (supplier3.history.length > 0) {
    supplier3.history.forEach((h, idx) => {
      console.log(`  [${idx + 1}] ${h.action} - ${h.timestamp}`);
      console.log(`      操作人: ${h.operator}`);
      if (h.reason) console.log(`      原因: ${h.reason}`);
      console.log(`      变更: ${JSON.stringify(h.before)} -> ${JSON.stringify(h.after)}`);
    });
  }
  console.log('');
  
  console.log('📜 证照历史记录示例 (供应商2 - 上海贸易 营业执照):');
  if (cert1Supplier2.history.length > 0) {
    cert1Supplier2.history.forEach((h, idx) => {
      console.log(`  [${idx + 1}] ${h.action} - ${h.timestamp}`);
      console.log(`      操作人: ${h.operator}`);
      if (h.reason) console.log(`      原因: ${h.reason}`);
    });
  }
  console.log('');
  
  console.log('📜 项目准入历史记录示例 (项目3 - 道路改造):');
  const access3History = store.projectAccesses.get(access3.id);
  if (access3History && access3History.history.length > 0) {
    access3History.history.forEach((h, idx) => {
      console.log(`  [${idx + 1}] ${h.action} - ${h.timestamp}`);
      console.log(`      操作人: ${h.operator}`);
      if (h.reason) console.log(`      原因: ${h.reason}`);
      console.log(`      状态变更: ${h.before?.status || 'N/A'} -> ${h.after?.status}`);
    });
  }
  console.log('');
  
  console.log('📜 巡检历史记录:');
  if (inspection.history.length > 0) {
    inspection.history.forEach((h, idx) => {
      console.log(`  [${idx + 1}] ${h.action} - ${h.timestamp}`);
      console.log(`      操作人: ${h.operator}`);
      if (h.reason) console.log(`      原因: ${h.reason}`);
      console.log(`      状态变更: ${h.before?.status || 'N/A'} -> ${h.after?.status}`);
    });
  }
  
  printTitle('演示总结 - 业务闭环验证');
  
  console.log('✅ 正常准入场景 (供应商1):');
  console.log('   - 资质齐全，证照有效');
  console.log('   - 巡检结果: 无风险，准入保持 APPROVED');
  console.log('');
  
  console.log('🟡 临期提醒场景 (供应商2):');
  console.log('   - 营业执照30天内到期');
  console.log('   - 巡检结果: 中风险警告，提醒续期');
  console.log('');
  
  console.log('🔴 过期拦截场景 (供应商3):');
  console.log('   - 营业执照已过期35天');
  console.log('   - 巡检结果: 高风险，准入被拦截 (APPROVED -> SUSPENDED)');
  console.log('   - 拦截原因已记录在项目准入历史中');
  console.log('');
  
  console.log('🟡 续期恢复场景 (供应商4):');
  console.log('   - 营业执照10天内到期，但已提交续期申请');
  console.log('   - 巡检结果: 中风险警告，状态为 PENDING_RENEWAL');
  console.log('   - 不会立即拦截，给予续期窗口');
  console.log('');
  
  console.log('🔴 冻结供应商场景 (供应商5):');
  console.log('   - 供应商资质齐全，但已被冻结');
  console.log('   - 巡检结果: 高风险，准入被拦截 (APPROVED -> SUSPENDED)');
  console.log('   - 冻结原因和操作人已留痕');
  console.log('');
  
  console.log('✅ 证照多版本场景 (供应商6):');
  console.log('   - 营业执照有2个版本，旧版已过期，新版有效');
  console.log('   - 巡检使用最新版本 (isLatest=true)');
  console.log('   - 巡检结果: 无风险，准入保持 APPROVED');
  console.log('');
  
  console.log('✅ 人工复核留痕:');
  console.log('   - 所有变更操作都记录了: 操作人、时间、前后差异、原因');
  console.log('   - 支持追溯和审计');
  console.log('');
  
  console.log('✅ 幂等性支持:');
  console.log('   - 支持 x-idempotency-key 请求头');
  console.log('   - 重复请求返回相同结果');
  console.log('');
  
  printTitle('演示完成！');
  console.log('');
  console.log('📝 启动 HTTP API 服务命令: npm start');
  console.log('📝 运行此演示命令: npm run demo');
  console.log('');
  console.log('🔗 API 服务地址: http://localhost:3000');
  console.log('🔗 健康检查: http://localhost:3000/health');
  console.log('');
}

runDemo();

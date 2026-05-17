import {
  createCertificate,
  getCertificate,
  listCertificates,
  updateCertificate,
  getCertificateHistory,
  importCertificates,
  exportCertificates,
  CertificateError,
} from '../services/certificateService';
import { CertificateStatus, OperationSource } from '../models/types';
import { db } from '../models/database';

function logTest(title: string, data?: any) {
  console.log(`\n=== ${title} ===`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

async function runTests() {
  console.log('开始CDN证书续期校验API验收测试\n');

  db.exec('DELETE FROM certificate_history; DELETE FROM domain_certificates;');

  logTest('1. 完整流转测试 - 一线提交 -> 上传证书 -> 校验节点 -> 已部署');

  const cert1 = createCertificate({
    domain: 'cdn.example.com',
    deployNodes: ['node-bj-01', 'node-sh-01', 'node-gz-01'],
    operator: 'zhang.san@cdn.com',
    operationSource: OperationSource.FRONTEND,
  });
  console.log('创建证书记录 (待上传):');
  console.log('  域名:', cert1.domain);
  console.log('  状态:', cert1.status);
  console.log('  部署节点:', cert1.deployNodes);

  const cert1Updated = updateCertificate(cert1.id, {
    certificateChain: '-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----',
    expiryDate: '2025-12-31T23:59:59Z',
    status: CertificateStatus.VERIFYING,
    operator: 'zhang.san@cdn.com',
    operationSource: OperationSource.FRONTEND,
  });
  console.log('\n上传证书后状态:', cert1Updated.status);

  const cert1Verifying = updateCertificate(cert1.id, {
    verifiedNodes: ['node-bj-01', 'node-sh-01'],
    operator: 'li.si@cdn.com',
    operationSource: OperationSource.BACKEND,
  });
  console.log('验证2个节点后,已验证:', cert1Verifying.verifiedNodes);

  try {
    await updateCertificate(cert1.id, {
      status: CertificateStatus.DEPLOYED,
      operator: 'li.si@cdn.com',
      operationSource: OperationSource.BACKEND,
    });
    console.log('错误: 应该拒绝部分节点未验证的部署');
  } catch (error: any) {
    console.log('\n预期的错误 - 部分节点未验证:');
    console.log('  错误码:', error.code);
    console.log('  建议操作:', error.suggestion);
    console.log('  未验证节点:', error.details?.unverifiedNodes);
  }

  const cert1ForceDeployed = updateCertificate(cert1.id, {
    status: CertificateStatus.DEPLOYED,
    forceProceed: true,
    remarks: '部分节点网络波动,已确认证书已推送,人工强制通过',
    operator: 'wang.wu@cdn.com',
    operationSource: OperationSource.BACKEND,
  });
  console.log('\n人工备注后强制部署成功,状态:', cert1ForceDeployed.status);
  console.log('  备注:', cert1ForceDeployed.remarks);

  const history1 = getCertificateHistory(cert1.id);
  console.log('\n操作历史记录数:', history1.length);
  history1.forEach((h, i) => {
    console.log(`  ${i + 1}. ${h.action} - ${h.operator} - ${h.operationSource}`);
  });

  logTest('2. 冲突记录测试 - 重复域名');

  try {
    createCertificate({
      domain: 'cdn.example.com',
      deployNodes: ['node-sz-01'],
      operator: 'zhao.liu@cdn.com',
      operationSource: OperationSource.API,
    });
    console.log('错误: 应该拒绝重复域名');
  } catch (error: any) {
    console.log('预期的错误 - 域名已存在:');
    console.log('  错误码:', error.code);
    console.log('  建议操作:', error.suggestion);
  }

  logTest('3. 导入坏行测试');

  const importData = [
    { domain: 'img.example.com', deployNodes: ['node-bj-01', 'node-sh-01'] },
    { domain: '', deployNodes: ['node-bj-01'] },
    { domain: 'static.example.com', deployNodes: [] },
    { domain: 'video.example.com', deployNodes: ['node-gz-01'] },
  ];

  const importResult = importCertificates(importData, 'import.bot@cdn.com');
  console.log('导入结果:');
  console.log('  成功:', importResult.success.length, '条');
  console.log('  失败:', importResult.errors.length, '条');
  importResult.errors.forEach(err => {
    console.log(`  第${err.row}行错误: ${err.error}`);
  });

  logTest('4. 列表、详情、历史、导出互相对齐验证');

  const list = listCertificates();
  console.log('列表总数:', list.length);

  const firstCert = list[0];
  const detail = getCertificate(firstCert.id);
  const history = getCertificateHistory(firstCert.id);
  const csv = exportCertificates();

  console.log('列表第一项ID:', firstCert.id);
  console.log('详情ID匹配:', detail?.id === firstCert.id ? 'PASS' : 'FAIL');
  console.log('历史记录证书ID匹配:', history.every(h => h.certificateId === firstCert.id) ? 'PASS' : 'FAIL');
  console.log('CSV包含域名:', csv.includes(firstCert.domain) ? 'PASS' : 'FAIL');

  logTest('所有验收测试完成!');
}

runTests().catch(console.error);

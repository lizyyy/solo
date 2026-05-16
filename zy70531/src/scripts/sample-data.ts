import { initDatabase } from '../database';
import * as ticketScanService from '../services/ticketScan.service';
import { ScanStatus, RiskLevel, ScanEngine } from '../types';

async function createSampleData() {
  try {
    await initDatabase();
    console.log('开始创建示例数据...\n');

    const sample1 = await ticketScanService.createScanRequest({
      ticketId: 'TK-2024-001',
      scanEngine: ScanEngine.CLAMAV,
      attachments: [
        {
          filename: '问题描述.docx',
          fileSize: 102400,
          fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          fileUrl: '/uploads/TK-2024-001/问题描述.docx'
        },
        {
          filename: '截图.png',
          fileSize: 2048000,
          fileType: 'image/png',
          fileUrl: '/uploads/TK-2024-001/截图.png'
        }
      ]
    });
    console.log('✅ 示例工单1创建成功:', sample1.id);

    await ticketScanService.updateScanStatus(sample1.id, {
      status: ScanStatus.SCANNING
    });

    await ticketScanService.updateScanStatus(sample1.id, {
      status: ScanStatus.SUCCESS,
      riskLevel: RiskLevel.SAFE,
      scanReport: 'ClamAV 扫描完成 - 无威胁发现'
    });
    console.log('✅ 工单1扫描完成（安全）\n');

    const sample2 = await ticketScanService.createScanRequest({
      ticketId: 'TK-2024-002',
      scanEngine: ScanEngine.KASPERSKY,
      attachments: [
        {
          filename: '可疑文件.exe',
          fileSize: 5242880,
          fileType: 'application/octet-stream',
          fileUrl: '/uploads/TK-2024-002/可疑文件.exe'
        }
      ]
    });
    console.log('✅ 示例工单2创建成功:', sample2.id);

    await ticketScanService.updateScanStatus(sample2.id, {
      status: ScanStatus.SUCCESS,
      riskLevel: RiskLevel.HIGH,
      virusFound: ['Trojan.Generic.12345', 'Malware.Exp.67890'],
      scanReport: 'Kaspersky 扫描报告：发现2个恶意程序'
    });
    console.log('✅ 工单2扫描完成（发现病毒，自动隔离）\n');

    const sample3 = await ticketScanService.createScanRequest({
      ticketId: 'TK-2024-003',
      scanEngine: ScanEngine.WINDOWS_DEFENDER,
      attachments: [
        {
          filename: '日志文件.zip',
          fileSize: 10485760,
          fileType: 'application/zip',
          fileUrl: '/uploads/TK-2024-003/日志文件.zip'
        }
      ]
    });
    console.log('✅ 示例工单3创建成功:', sample3.id);

    await ticketScanService.handleScanFailure(
      sample3.id,
      '扫描引擎连接超时：ETIMEDOUT',
      { ticketId: 'TK-2024-003', fileSize: 10485760, timeout: 30000 }
    );
    console.log('✅ 工单3模拟扫描失败（转入人工审核）\n');

    const sample4 = await ticketScanService.createScanRequest({
      ticketId: 'TK-2024-004',
      scanEngine: ScanEngine.MCCAFE,
      attachments: [
        {
          filename: '内部文档.pdf',
          fileSize: 2097152,
          fileType: 'application/pdf',
          fileUrl: '/uploads/TK-2024-004/内部文档.pdf'
        }
      ]
    });
    console.log('✅ 示例工单4创建成功:', sample4.id);

    await ticketScanService.updateScanStatus(sample4.id, {
      status: ScanStatus.SUCCESS,
      riskLevel: RiskLevel.MEDIUM,
      virusFound: ['PUP.Optional.Toolbar'],
      scanReport: 'McAfee 扫描报告：发现潜在不受欢迎程序'
    });

    await ticketScanService.manualCorrection(sample4.id, {
      reviewedBy: '安全管理员-张三',
      reviewComment: '经核实，此PUP为业务所需工具栏，不构成安全威胁，予以放行',
      action: 'release',
      riskLevel: RiskLevel.LOW
    });
    console.log('✅ 工单4完成人工审核（放行）\n');

    console.log('============================================');
    console.log('示例数据创建完成！');
    console.log('工单统计：');
    console.log('  - TK-2024-001: 扫描完成（安全）');
    console.log('  - TK-2024-002: 发现病毒（已隔离）');
    console.log('  - TK-2024-003: 扫描失败（人工审核中）');
    console.log('  - TK-2024-004: 人工审核（已放行）');
    console.log('============================================\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ 创建示例数据失败:', err);
    process.exit(1);
  }
}

createSampleData();

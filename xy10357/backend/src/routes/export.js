const express = require('express');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const router = express.Router();
const prisma = new PrismaClient();
const { 
  SHIPMENT_STATUS_LABELS, 
  TEMP_STATUS_LABELS,
  AUDIT_ACTION_LABELS 
} = require('../utils/constants');

const formatDate = (date) => {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

const generateComplianceReport = (shipment) => {
  const { batch, institution, recipient, tempRecords, destruction, histories } = shipment;
  
  const today = new Date();
  const recipientStatus = !recipient.isActive ? '禁用' : 
    new Date(recipient.expiryDate) <= today ? '已过期' : '有效';

  const tempStats = {
    total: tempRecords.length,
    normal: tempRecords.filter(r => r.status === 'NORMAL').length,
    warning: tempRecords.filter(r => r.status === 'WARNING').length,
    exceeded: tempRecords.filter(r => r.status === 'EXCEEDED').length,
    reviewed: tempRecords.filter(r => r.status === 'REVIEWED').length,
    unreviewedExceeded: tempRecords.filter(r => r.status === 'EXCEEDED' && !r.reviewedBy).length
  };

  const complianceChecks = [
    {
      name: '接收人资质校验',
      result: recipientStatus === '有效' ? '通过' : '不通过',
      detail: `资质类型: ${recipient.qualificationType}, 证书编号: ${recipient.qualificationNum}, 有效期至: ${formatDate(recipient.expiryDate)}`
    },
    {
      name: '样本批次校验',
      result: batch.batchNumber ? '通过' : '不通过',
      detail: `批号: ${batch.batchNumber}, 品名: ${batch.sampleName}, 有效期至: ${formatDate(batch.expiryDate)}`
    },
    {
      name: '温控合规性',
      result: tempStats.unreviewedExceeded > 0 ? '不通过' : '通过',
      detail: `总记录 ${tempStats.total} 条, 正常 ${tempStats.normal}, 警告 ${tempStats.warning}, 超限未复核 ${tempStats.unreviewedExceeded}`
    },
    {
      name: '销毁回执',
      result: destruction ? '通过' : '缺失',
      detail: destruction 
        ? `销毁日期: ${formatDate(destruction.destructionDate)}, 方法: ${destruction.destructionMethod}, 见证人: ${destruction.witnessName}`
        : '尚未提交销毁回执'
    }
  ];

  const overallCompliance = complianceChecks.every(c => c.result === '通过');

  return {
    shipmentNumber: shipment.shipmentNumber,
    applicant: shipment.applicant,
    applicationDate: formatDate(shipment.applicationDate),
    status: SHIPMENT_STATUS_LABELS[shipment.status],
    purpose: shipment.purpose,
    
    sampleInfo: {
      batchNumber: batch.batchNumber,
      sampleName: batch.sampleName,
      manufacturer: batch.manufacturer,
      quantity: batch.quantity,
      productionDate: formatDate(batch.productionDate),
      expiryDate: formatDate(batch.expiryDate),
      storageRange: batch.storageTempMin !== null && batch.storageTempMax !== null
        ? `${batch.storageTempMin}°C ~ ${batch.storageTempMax}°C`
        : '未设定'
    },

    receivingInfo: {
      institution: institution.name,
      address: institution.address,
      contact: institution.contact,
      phone: institution.phone,
      recipient: recipient.name,
      idNumber: recipient.idNumber,
      qualificationType: recipient.qualificationType,
      qualificationNum: recipient.qualificationNum,
      issueDate: formatDate(recipient.issueDate),
      expiryDate: formatDate(recipient.expiryDate),
      qualificationStatus: recipientStatus
    },

    temperatureHistory: tempRecords.map((r, index) => ({
      index: index + 1,
      recordTime: formatDate(r.recordTime),
      temperature: `${r.temperature}°C`,
      status: TEMP_STATUS_LABELS[r.status],
      reviewedBy: r.reviewedBy || '-',
      reviewedAt: formatDate(r.reviewedAt),
      reviewRemark: r.reviewRemark || '-'
    })),

    destructionInfo: destruction ? {
      destructionDate: formatDate(destruction.destructionDate),
      destructionMethod: destruction.destructionMethod,
      witnessName: destruction.witnessName,
      receiptNumber: destruction.receiptNumber || '-',
      remark: destruction.remark || '-'
    } : null,

    auditTrail: histories.map((h, index) => ({
      index: index + 1,
      actionTime: formatDate(h.actionTime),
      action: AUDIT_ACTION_LABELS[h.action],
      operator: h.operator,
      description: h.description
    })),

    complianceChecks,
    overallCompliance: overallCompliance ? '完全合规' : '存在合规问题',
    exportTime: formatDate(new Date())
  };
};

const generateMarkdownReport = (report) => {
  let md = `# 药企样本寄送合规报告\n\n`;
  md += `**申请单号**: ${report.shipmentNumber}  \n`;
  md += `**申请人**: ${report.applicant}  \n`;
  md += `**申请日期**: ${report.applicationDate}  \n`;
  md += `**当前状态**: ${report.status}  \n`;
  md += `**寄送目的**: ${report.purpose}  \n\n`;
  md += `**综合合规性**: ${report.overallCompliance}  \n\n`;
  md += `---\n\n`;

  md += `## 1. 样本信息\n\n`;
  md += `| 项目 | 内容 |\n`;
  md += `|------|------|\n`;
  md += `| 样本批号 | ${report.sampleInfo.batchNumber} |\n`;
  md += `| 样品名称 | ${report.sampleInfo.sampleName} |\n`;
  md += `| 生产厂家 | ${report.sampleInfo.manufacturer} |\n`;
  md += `| 数量 | ${report.sampleInfo.quantity} |\n`;
  md += `| 生产日期 | ${report.sampleInfo.productionDate} |\n`;
  md += `| 有效期至 | ${report.sampleInfo.expiryDate} |\n`;
  md += `| 温控范围 | ${report.sampleInfo.storageRange} |\n\n`;

  md += `## 2. 接收机构与接收人资质\n\n`;
  md += `### 接收机构\n`;
  md += `| 项目 | 内容 |\n`;
  md += `|------|------|\n`;
  md += `| 机构名称 | ${report.receivingInfo.institution} |\n`;
  md += `| 地址 | ${report.receivingInfo.address} |\n`;
  md += `| 联系人 | ${report.receivingInfo.contact} |\n`;
  md += `| 电话 | ${report.receivingInfo.phone} |\n\n`;

  md += `### 接收人资质\n`;
  md += `| 项目 | 内容 |\n`;
  md += `|------|------|\n`;
  md += `| 姓名 | ${report.receivingInfo.recipient} |\n`;
  md += `| 身份证号 | ${report.receivingInfo.idNumber} |\n`;
  md += `| 资质类型 | ${report.receivingInfo.qualificationType} |\n`;
  md += `| 证书编号 | ${report.receivingInfo.qualificationNum} |\n`;
  md += `| 发证日期 | ${report.receivingInfo.issueDate} |\n`;
  md += `| 有效期至 | ${report.receivingInfo.expiryDate} |\n`;
  md += `| 资质状态 | ${report.receivingInfo.qualificationStatus} |\n\n`;

  md += `## 3. 温控记录\n\n`;
  if (report.temperatureHistory.length === 0) {
    md += `> 暂无温控记录\n\n`;
  } else {
    md += `| 序号 | 记录时间 | 温度 | 状态 | 复核人 | 复核时间 | 复核说明 |\n`;
    md += `|------|----------|------|------|--------|----------|----------|\n`;
    report.temperatureHistory.forEach(r => {
      md += `| ${r.index} | ${r.recordTime} | ${r.temperature} | ${r.status} | ${r.reviewedBy} | ${r.reviewedAt} | ${r.reviewRemark} |\n`;
    });
    md += `\n`;
  }

  md += `## 4. 销毁回执\n\n`;
  if (!report.destructionInfo) {
    md += `> 销毁回执缺失\n\n`;
  } else {
    md += `| 项目 | 内容 |\n`;
    md += `|------|------|\n`;
    md += `| 销毁日期 | ${report.destructionInfo.destructionDate} |\n`;
    md += `| 销毁方式 | ${report.destructionInfo.destructionMethod} |\n`;
    md += `| 见证人 | ${report.destructionInfo.witnessName} |\n`;
    md += `| 回执编号 | ${report.destructionInfo.receiptNumber} |\n`;
    md += `| 备注 | ${report.destructionInfo.remark} |\n\n`;
  }

  md += `## 5. 合规检查项\n\n`;
  md += `| 检查项 | 结果 | 详情 |\n`;
  md += `|--------|------|------|\n`;
  report.complianceChecks.forEach(c => {
    md += `| ${c.name} | ${c.result} | ${c.detail} |\n`;
  });
  md += `\n`;

  md += `## 6. 操作历史记录\n\n`;
  md += `| 序号 | 操作时间 | 操作类型 | 操作人 | 操作说明 |\n`;
  md += `|------|----------|----------|--------|----------|\n`;
  report.auditTrail.forEach(h => {
    md += `| ${h.index} | ${h.actionTime} | ${h.action} | ${h.operator} | ${h.description} |\n`;
  });
  md += `\n`;

  md += `---\n\n`;
  md += `**报告生成时间**: ${report.exportTime}  \n`;
  md += `**报告生成系统**: 药企样本寄送合规管理系统\n`;

  return md;
};

router.get('/:shipmentId', async (req, res) => {
  try {
    const { shipmentId } = req.params;
    const { format = 'json' } = req.query;

    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        batch: true,
        institution: true,
        recipient: true,
        tempRecords: {
          orderBy: { recordTime: 'asc' }
        },
        destruction: true,
        histories: {
          orderBy: { actionTime: 'asc' }
        }
      }
    });

    if (!shipment) {
      return res.status(404).json({ error: '寄送申请不存在' });
    }

    const report = generateComplianceReport(shipment);

    if (format === 'markdown') {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', 
        `attachment; filename="合规报告_${shipment.shipmentNumber}.md"`);
      return res.send(generateMarkdownReport(report));
    }

    if (format === 'zip') {
      const exportDir = path.join(__dirname, '../exports');
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }

      const zipPath = path.join(exportDir, `合规包_${shipment.shipmentNumber}.zip`);
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => {
        res.download(zipPath, `合规包_${shipment.shipmentNumber}.zip`);
      });

      archive.on('error', (err) => {
        res.status(500).json({ error: err.message });
      });

      archive.pipe(output);

      const mdContent = generateMarkdownReport(report);
      archive.append(mdContent, { name: `合规报告_${shipment.shipmentNumber}.md` });

      const jsonContent = JSON.stringify(report, null, 2);
      archive.append(jsonContent, { name: `合规报告_${shipment.shipmentNumber}.json` });

      const summaryContent = `
合规包说明
==========

申请单号: ${shipment.shipmentNumber}
当前状态: ${report.status}
综合合规性: ${report.overallCompliance}

本合规包包含:
1. 合规报告.md - 详细的Markdown格式报告
2. 合规报告.json - 结构化的JSON格式数据

报告内容涵盖:
- 样本批次信息
- 接收机构信息
- 接收人资质信息
- 全程温控记录
- 销毁回执信息
- 完整操作历史

生成时间: ${report.exportTime}
`;
      archive.append(summaryContent, { name: 'README.txt' });

      await archive.finalize();
      return;
    }

    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:shipmentId/preview', async (req, res) => {
  try {
    const { shipmentId } = req.params;

    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        batch: true,
        institution: true,
        recipient: true,
        tempRecords: {
          orderBy: { recordTime: 'asc' }
        },
        destruction: true,
        histories: {
          orderBy: { actionTime: 'asc' }
        }
      }
    });

    if (!shipment) {
      return res.status(404).json({ error: '寄送申请不存在' });
    }

    const report = generateComplianceReport(shipment);
    const markdown = generateMarkdownReport(report);

    res.json({
      report,
      markdown
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

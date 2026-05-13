import { ParkingCase } from '../types';
import { formatDateTime, formatCurrency, getEvidenceTypeLabel, getStatusLabel } from './helpers';

export interface ExportPackage {
  caseInfo: {
    caseNumber: string;
    plateNumber: string;
    exportTime: string;
    operator: string;
  };
  caseSummary: string;
  evidenceIndex: string;
  timeline: string;
  dataJson: string;
}

export const generateExportPackage = (caseData: ParkingCase, operator: string): ExportPackage => {
  const exportTime = new Date();
  const safePlateNumber = caseData.plateNumber.replace(/[·\s]/g, '');
  const timestamp = exportTime.toISOString().slice(0, 10);

  const caseInfo = {
    caseNumber: caseData.id,
    plateNumber: caseData.plateNumber,
    exportTime: exportTime.toISOString(),
    operator,
  };

  const caseSummary = generateCaseSummary(caseData, operator, exportTime);
  const evidenceIndex = generateEvidenceIndex(caseData);
  const timeline = generateTimelineReport(caseData);
  const dataJson = generateDataJson(caseData, operator, exportTime);

  return {
    caseInfo,
    caseSummary,
    evidenceIndex,
    timeline,
    dataJson,
  };
};

const generateCaseSummary = (caseData: ParkingCase, operator: string, exportTime: Date): string => {
  const pendingAmount = caseData.feeAmount - caseData.paidAmount;
  const evidenceCount = caseData.evidences.filter(e => !e.placeholder).length;
  const totalEvidence = caseData.evidences.length;
  const releaseCount = caseData.manualReleases.length;
  const reviewedReleases = caseData.manualReleases.filter(r => r.reviewed).length;

  return `========================================
  停车场逃费案件归档报告
  ========================================
  
  【案件基本信息】
  案件编号: ${caseData.id}
  车牌号码: ${caseData.plateNumber}
  案件状态: ${getStatusLabel(caseData.status)}
  创建时间: ${formatDateTime(caseData.createdAt)}
  最后更新: ${formatDateTime(caseData.updatedAt)}
  
  【停车信息】
  入场时间: ${formatDateTime(caseData.entryTime)}
  出场时间: ${formatDateTime(caseData.exitTime)}
  停车时长: ${caseData.duration}
  
  【费用信息】
  应付金额: ${formatCurrency(caseData.feeAmount)}
  已付金额: ${formatCurrency(caseData.paidAmount)}
  待付金额: ${formatCurrency(pendingAmount)}
  
  【证据情况】
  证据数量: ${evidenceCount}/${totalEvidence}
  完整程度: ${evidenceCount === totalEvidence ? '完整' : '部分缺失'}
  
  【人工放行记录】
  放行次数: ${releaseCount}
  已复核: ${reviewedReleases}
  待复核: ${releaseCount - reviewedReleases}
  
  【补缴记录】
  补缴次数: ${caseData.payments.length}
  
  【备注】
  ${caseData.remarks || '无'}
  
  ========================================
  归档信息
  ========================================
  归档操作员: ${operator}
  归档时间: ${exportTime.toLocaleString('zh-CN')}
  归档状态: 已完成
  
  【文件清单】
  1. case-summary.txt - 案件摘要
  2. evidence-index.txt - 证据索引
  3. timeline.txt - 案件时间线
  4. case-data.json - 完整数据
  5. evidences/ - 证据文件目录
  
  ========================================
  本报告由停车场逃费证据归档系统自动生成
  ========================================
`;
};

const generateEvidenceIndex = (caseData: ParkingCase): string => {
  let content = `========================================
  证据文件索引
  案件编号: ${caseData.id}
  车牌号码: ${caseData.plateNumber}
  ========================================

【索引说明】
本索引列出案件相关的所有证据文件。
占位符(📝)表示证据缺失，需要补充。
非占位符(📄)表示证据已归档。

========================================
证据文件列表
========================================

`;

  caseData.evidences.forEach((evidence, index) => {
    const status = evidence.placeholder ? '[待补录]' : '[已归档]';
    const icon = evidence.placeholder ? '📝' : '📄';
    
    content += `证据 #${index + 1}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
状态: ${status} ${icon}
类型: ${getEvidenceTypeLabel(evidence.type)}
文件名: ${evidence.name}
大小: ${evidence.size || '未知'}
上传时间: ${evidence.uploadedAt ? formatDateTime(evidence.uploadedAt) : '待上传'}
描述: ${evidence.description || '无'}

路径: evidences/${evidence.type}/${evidence.name}

`;
  });

  content += `========================================
证据统计
========================================
总数: ${caseData.evidences.length}
已归档: ${caseData.evidences.filter(e => !e.placeholder).length}
待补录: ${caseData.evidences.filter(e => e.placeholder).length}

========================================
注意事项
========================================
- 所有证据文件已按类型分类存储在 evidences/ 目录中
- 待补录的证据需要后续补充完整
- 证据完整性是案件归档的重要依据

========================================
索引生成时间: ${new Date().toLocaleString('zh-CN')}
========================================
`;

  return content;
};

const generateTimelineReport = (caseData: ParkingCase): string => {
  let content = `========================================
  案件时间线报告
  案件编号: ${caseData.id}
  车牌号码: ${caseData.plateNumber}
  ========================================

【时间线说明】
本报告按时间顺序记录案件的所有关键事件。

事件类型说明:
  🚗 事件 - 车辆相关操作
  👁️ 复核 - 审核操作
  💰 缴费 - 补缴操作
  📦 导出 - 归档操作

========================================
时间线详情
========================================

`;

  const typeIcons: Record<string, string> = {
    event: '🚗',
    review: '👁️',
    payment: '💰',
    export: '📦',
  };

  const typeLabels: Record<string, string> = {
    event: '事件',
    review: '复核',
    payment: '缴费',
    export: '导出',
  };

  const sortedTimeline = [...caseData.timeline].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  sortedTimeline.forEach((event, index) => {
    content += `[${index + 1}] ${typeIcons[event.type]} ${typeLabels[event.type]}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
时间: ${formatDateTime(event.timestamp)}
操作人: ${event.operator || '系统'}
事件: ${event.description}

`;
  });

  content += `========================================
时间线统计
========================================
总事件数: ${caseData.timeline.length}
事件操作: ${caseData.timeline.filter(e => e.type === 'event').length}
复核操作: ${caseData.timeline.filter(e => e.type === 'review').length}
缴费操作: ${caseData.timeline.filter(e => e.type === 'payment').length}
导出操作: ${caseData.timeline.filter(e => e.type === 'export').length}

========================================
报告生成时间: ${new Date().toLocaleString('zh-CN')}
========================================
`;

  return content;
};

const generateDataJson = (caseData: ParkingCase, operator: string, exportTime: Date): string => {
  const exportData = {
    exportMeta: {
      caseNumber: caseData.id,
      plateNumber: caseData.plateNumber,
      exportTime: exportTime.toISOString(),
      operator,
      system: '停车场逃费证据归档系统',
      version: '1.0.0',
    },
    caseData: {
      ...caseData,
    },
    statistics: {
      evidenceCount: caseData.evidences.length,
      evidenceComplete: caseData.evidences.filter(e => !e.placeholder).length,
      manualReleaseCount: caseData.manualReleases.length,
      paymentCount: caseData.payments.length,
      timelineEventCount: caseData.timeline.length,
      totalFee: caseData.feeAmount,
      paidAmount: caseData.paidAmount,
      pendingAmount: caseData.feeAmount - caseData.paidAmount,
    },
  };

  return JSON.stringify(exportData, null, 2);
};

export const downloadExportPackage = (pkg: ExportPackage): void => {
  const safePlateNumber = pkg.caseInfo.plateNumber.replace(/[·\s]/g, '');
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const baseName = `逃费案件_${safePlateNumber}_${pkg.caseInfo.caseNumber}_${dateStr}`;

  downloadTextFile(pkg.caseSummary, `${baseName}/case-summary.txt`);
  downloadTextFile(pkg.evidenceIndex, `${baseName}/evidence-index.txt`);
  downloadTextFile(pkg.timeline, `${baseName}/timeline.txt`);
  downloadTextFile(pkg.dataJson, `${baseName}/case-data.json`);
  
  const readmeContent = generateReadme(pkg);
  downloadTextFile(readmeContent, `${baseName}/README.txt`);
};

const downloadTextFile = (content: string, filename: string): void => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const generateReadme = (pkg: ExportPackage): string => {
  return `========================================
  逃费案件归档包
  ========================================

  案件编号: ${pkg.caseInfo.caseNumber}
  车牌号码: ${pkg.caseInfo.plateNumber}
  导出时间: ${new Date(pkg.caseInfo.exportTime).toLocaleString('zh-CN')}
  操作员: ${pkg.caseInfo.operator}

  ========================================
  文件结构
  ========================================

  归档包包含以下文件:

  1. case-summary.txt
     └─ 案件摘要报告，包含案件基本信息、费用、证据情况等

  2. evidence-index.txt
     └─ 证据文件索引，列出所有证据及其状态

  3. timeline.txt
     └─ 案件时间线，按时间顺序记录所有关键事件

  4. case-data.json
     └─ 完整的结构化数据，可用于程序导入和分析

  5. evidences/
     └─ 证据文件目录 (在实际部署中包含真实证据文件)

  ========================================
  使用说明
  ========================================

  1. 查看案件信息: 打开 case-summary.txt
  2. 了解证据状态: 打开 evidence-index.txt
  3. 追溯操作历史: 打开 timeline.txt
  4. 导入其他系统: 使用 case-data.json

  ========================================
  系统信息
  ========================================

  系统名称: 停车场逃费证据归档系统
  版本: 1.0.0
  归档状态: 完成

  ========================================
  本归档包由系统自动生成，请勿修改
  ========================================
`;
};

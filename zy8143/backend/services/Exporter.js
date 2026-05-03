const moment = require('moment');

class Exporter {
  constructor() {}

  // 导出审查报告 (Markdown格式)
  exportReviewReport(validationResult) {
    const { cases, summary, timestamp } = validationResult;
    const reportTime = moment(timestamp).format('YYYY年MM月DD日 HH:mm:ss');

    let report = `# 电子卷宗归档验收审查报告

## 审查概况

- **审查时间**: ${reportTime}
- **案件总数**: ${summary.totalCases} 件
- **文书总数**: ${summary.totalDocuments} 份
- **发现风险**: ${summary.totalRisks} 个
  - 高风险: ${summary.highRisks} 个
  - 中风险: ${summary.mediumRisks} 个
  - 低风险: ${summary.lowRisks} 个

---

## 风险统计
`;

    // 风险类型统计
    const riskTypeStats = {};
    cases.forEach(caseItem => {
      caseItem.risks.forEach(risk => {
        const type = risk.type;
        riskTypeStats[type] = (riskTypeStats[type] || 0) + 1;
      });
      caseItem.documents.forEach(doc => {
        doc.risks.forEach(risk => {
          const type = risk.type;
          riskTypeStats[type] = (riskTypeStats[type] || 0) + 1;
        });
      });
    });

    if (Object.keys(riskTypeStats).length > 0) {
      report += `
| 风险类型 | 数量 |
|---------|------|
`;
      for (const [type, count] of Object.entries(riskTypeStats)) {
        report += `| ${this.getRiskTypeName(type)} | ${count} |\n`;
      }
    }

    report += `

---

## 案件详情
`;

    cases.forEach((caseItem, caseIndex) => {
      const caseRiskCount = caseItem.risks.length;
      const docRiskCount = caseItem.documents.reduce((sum, doc) => sum + doc.risks.length, 0);
      const totalCaseRisks = caseRiskCount + docRiskCount;

      report += `

### 案件 ${caseIndex + 1}: ${caseItem.caseNumber}

- **案件类型**: ${caseItem.caseType}
- **年度**: ${caseItem.year || '未知'}
- **法院**: ${caseItem.court || '未知'}
- **页码范围**: 第 ${caseItem.startPage} 页 - 第 ${caseItem.endPage} 页
- **总页数**: ${caseItem.totalPages} 页
- **文书数量**: ${caseItem.documents.length} 份
- **风险数量**: ${totalCaseRisks} 个 (案件级: ${caseRiskCount}, 文书级: ${docRiskCount})

`;

      // 案件级风险
      if (caseItem.risks.length > 0) {
        report += `
#### 案件级风险

`;
        caseItem.risks.forEach((risk, riskIndex) => {
          report += `
##### 风险 ${riskIndex + 1}: ${this.getRiskTypeName(risk.type)}

- **风险等级**: ${this.getRiskLevelName(risk.level)}
- **描述**: ${risk.description}
- **建议**: ${risk.suggestion}
- **确认状态**: ${risk.confirmed ? '已确认' : '待确认'}

`;
        });
      }

      // 文书详情
      report += `
#### 文书列表

| 序号 | 文书名称 | 文书类型 | 页码范围 | 风险数量 |
|-----|---------|---------|---------|---------|
`;
      caseItem.documents.forEach((doc, docIndex) => {
        report += `| ${docIndex + 1} | ${doc.documentName} | ${doc.documentType || '未设置'} | ${doc.startPage}-${doc.endPage} | ${doc.risks.length} |\n`;
      });

      // 有风险的文书详情
      const riskyDocs = caseItem.documents.filter(doc => doc.risks.length > 0);
      if (riskyDocs.length > 0) {
        report += `
#### 文书风险详情
`;
        riskyDocs.forEach(doc => {
          report += `

##### ${doc.documentName}

- **文书类型**: ${doc.documentType || '未设置'}
- **密级**: ${doc.classification || '普通'}
- **电子签名**: ${doc.hasSignature ? '有' : '无'}
`;
          if (doc.signatureInfo) {
            report += `- **签名人**: ${doc.signatureInfo.signer || '未知'}\n`;
            report += `- **签名有效期**: ${doc.signatureInfo.validFrom} - ${doc.signatureInfo.validTo}\n`;
          }

          report += `
###### 风险详情:

`;
          doc.risks.forEach((risk, riskIndex) => {
            report += `
1. **${this.getRiskTypeName(risk.type)}** (${this.getRiskLevelName(risk.level)})
   - 描述: ${risk.description}
   - 建议: ${risk.suggestion}
   - 状态: ${risk.confirmed ? '已确认' : '待确认'}

`;
          });
        });
      }
    });

    // 报告结尾
    report += `

---

## 审查结论

根据本次电子卷宗归档验收审查，共发现 **${summary.totalRisks}** 个风险点，其中：

- 🔴 **高风险**: ${summary.highRisks} 个 - 需立即整改
- 🟡 **中风险**: ${summary.mediumRisks} 个 - 建议整改
- 🔵 **低风险**: ${summary.lowRisks} 个 - 可关注

**建议**:
${summary.highRisks > 0 ? '- 高风险问题必须在归档前整改完成' : ''}
${summary.mediumRisks > 0 ? '- 中风险问题建议尽快整改' : ''}
${summary.totalRisks === 0 ? '- 所有检查项均通过，可以归档' : ''}

---

*本报告由电子卷宗归档验收工作台自动生成*
*生成时间: ${reportTime}*
`;

    return report;
  }

  // 导出问题清单 (CSV格式)
  exportIssuesCSV(validationResult) {
    const { cases } = validationResult;
    
    // CSV 头部
    let csv = `序号,案件号,文书名称,风险类型,风险等级,风险描述,处理建议,确认状态,创建时间\n`;

    let issueCount = 0;

    cases.forEach(caseItem => {
      // 案件级风险
      caseItem.risks.forEach(risk => {
        issueCount++;
        csv += `${issueCount},`;
        csv += `"${caseItem.caseNumber}",`;
        csv += `"案件级",`;
        csv += `"${this.getRiskTypeName(risk.type)}",`;
        csv += `"${this.getRiskLevelName(risk.level)}",`;
        csv += `"${this.escapeCSV(risk.description)}",`;
        csv += `"${this.escapeCSV(risk.suggestion)}",`;
        csv += `"${risk.confirmed ? '已确认' : '待确认'}",`;
        csv += `"${risk.createdAt}"\n`;
      });

      // 文书级风险
      caseItem.documents.forEach(doc => {
        doc.risks.forEach(risk => {
          issueCount++;
          csv += `${issueCount},`;
          csv += `"${caseItem.caseNumber}",`;
          csv += `"${this.escapeCSV(doc.documentName)}",`;
          csv += `"${this.getRiskTypeName(risk.type)}",`;
          csv += `"${this.getRiskLevelName(risk.level)}",`;
          csv += `"${this.escapeCSV(risk.description)}",`;
          csv += `"${this.escapeCSV(risk.suggestion)}",`;
          csv += `"${risk.confirmed ? '已确认' : '待确认'}",`;
          csv += `"${risk.createdAt}"\n`;
        });
      });
    });

    return csv;
  }

  // 辅助方法：获取风险类型中文名
  getRiskTypeName(type) {
    const typeNames = {
      'missing_required_document': '缺少必备材料',
      'page_number_error': '页码错误',
      'page_count_mismatch': '页数不匹配',
      'page_gap': '页码缺失',
      'page_overlap': '页码重叠',
      'incomplete_pages': '页码不完整',
      'invalid_case_number_format': '案号格式不规范',
      'cross_year_case': '跨年度案件',
      'unexpected_document_type': '文书类型不匹配',
      'duplicate_document_number': '重复文号',
      'cross_case_reference': '跨案件引用',
      'signature_expired': '签名已过期',
      'signature_expiring_soon': '签名即将过期',
      'signature_before_valid': '签名时间异常',
      'signature_record_missing': '签名记录缺失',
      'missing_required_signature': '缺少必要签名',
      'invalid_classification': '密级不规范',
      'sensitive_data_not_masked': '敏感信息未脱敏',
      'classification_mark_missing': '密级标注缺失'
    };
    return typeNames[type] || type;
  }

  // 辅助方法：获取风险等级中文名
  getRiskLevelName(level) {
    const levelNames = {
      'high': '高风险',
      'medium': '中风险',
      'low': '低风险'
    };
    return levelNames[level] || level;
  }

  // 辅助方法：CSV转义
  escapeCSV(value) {
    if (value === null || value === undefined) return '';
    const strValue = String(value);
    // 如果包含引号、逗号或换行符，需要转义
    if (strValue.includes('"') || strValue.includes(',') || strValue.includes('\n')) {
      // 将双引号替换为两个双引号
      return strValue.replace(/"/g, '""');
    }
    return strValue;
  }
}

module.exports = Exporter;

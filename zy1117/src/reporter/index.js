const dayjs = require('dayjs');
const path = require('path');

/**
 * 严重程度显示名称
 */
const SEVERITY_DISPLAY = {
  critical: { name: '需要客户确认', emoji: '🔴', color: '#dc2626' },
  high: { name: '需要内部确认', emoji: '🟠', color: '#ea580c' },
  medium: { name: '建议修订', emoji: '🟡', color: '#ca8a04' },
  low: { name: '建议检查', emoji: '🔵', color: '#2563eb' }
};

/**
 * 问题类型显示名称
 */
const ISSUE_TYPE_DISPLAY = {
  quote_only_sku: '报价有但合同遗漏',
  contract_only_sku: '合同有但报价未覆盖',
  sku_inactive: 'SKU已停用',
  quantity_mismatch: '数量不一致',
  price_mismatch: '单价不一致',
  discount_mismatch: '折扣不一致',
  discount_not_synced: '审批折扣未同步',
  tax_rate_mismatch: '税率不一致',
  warranty_mismatch: '维保期限不一致',
  delivery_date_conflict: '交付日期冲突',
  delivery_batch_conflict: '交付批次冲突',
  payment_ratio_sum_error: '付款比例总和错误',
  final_payment_missing: '尾款条件缺失',
  payment_amount_mismatch: '付款金额与总价不一致',
  invalid_number: '无效数字格式',
  invalid_date: '无效日期格式',
  missing_field: '字段缺失',
  duplicate_sku: '重复SKU',
  data_warning: '数据警告'
};

/**
 * 生成报告
 * @param {Object} analysisResult - 分析结果
 * @param {Object} options - 选项
 * @returns {Object} 包含各种格式报告的对象
 */
function generateReports(analysisResult, options = {}) {
  const timestamp = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const reportData = {
    timestamp,
    summary: analysisResult.summary,
    statistics: analysisResult.statistics,
    issues: analysisResult.issues,
    comparisons: analysisResult.comparisons
  };
  
  return {
    json: generateJsonReport(reportData),
    markdown: generateMarkdownReport(reportData),
    html: generateHtmlReport(reportData),
    copyTexts: generateCopyTexts(reportData)
  };
}

/**
 * 生成JSON报告
 */
function generateJsonReport(reportData) {
  return JSON.stringify(reportData, null, 2);
}

/**
 * 生成Markdown报告
 */
function generateMarkdownReport(reportData) {
  const lines = [];
  
  // 标题
  lines.push('# 售前报价与合同交付差异核对报告');
  lines.push('');
  lines.push(`> 生成时间：${reportData.timestamp}`);
  lines.push('');
  
  // 统计概览
  lines.push('## 📊 统计概览');
  lines.push('');
  
  // 问题汇总
  lines.push('### 问题汇总');
  lines.push('');
  lines.push('| 严重程度 | 数量 | 说明 |');
  lines.push('|----------|------|------|');
  Object.entries(SEVERITY_DISPLAY).forEach(([key, display]) => {
    const count = reportData.summary.bySeverity[key] || 0;
    lines.push(`| ${display.emoji} ${display.name} | ${count} | |`);
  });
  lines.push('');
  lines.push(`**总计：${reportData.summary.totalIssues} 个问题**`);
  lines.push('');
  
  // 数据源统计
  lines.push('### 数据源统计');
  lines.push('');
  
  if (reportData.statistics.quote) {
    lines.push('**报价单：**');
    lines.push(`- 文件：${reportData.statistics.quote.file}`);
    lines.push(`- 产品数量：${reportData.statistics.quote.productCount}`);
    lines.push(`- 总金额：￥${formatNumber(reportData.statistics.quote.totalAmount)}`);
    lines.push('');
  }
  
  if (reportData.statistics.contract) {
    lines.push('**合同：**');
    lines.push(`- 文件：${reportData.statistics.contract.file}`);
    lines.push(`- 产品数量：${reportData.statistics.contract.productCount}`);
    lines.push(`- 交付批次：${reportData.statistics.contract.deliveryCount}`);
    lines.push(`- 付款节点：${reportData.statistics.contract.paymentCount}`);
    lines.push(`- 产品总金额：￥${formatNumber(reportData.statistics.contract.totalAmount)}`);
    lines.push('');
  }
  
  if (reportData.statistics.catalog) {
    lines.push('**产品目录：**');
    lines.push(`- 文件：${reportData.statistics.catalog.file}`);
    lines.push(`- 产品总数：${reportData.statistics.catalog.productCount}`);
    lines.push(`- 活跃产品：${reportData.statistics.catalog.activeCount}`);
    lines.push('');
  }
  
  if (reportData.statistics.approval) {
    lines.push('**审批备注：**');
    lines.push(`- 文件：${reportData.statistics.approval.file}`);
    lines.push(`- 审批记录数：${reportData.statistics.approval.approvalCount}`);
    lines.push(`- 包含折扣备注：${reportData.statistics.approval.hasDiscountNotes ? '是' : '否'}`);
    lines.push('');
  }
  
  // 按严重程度分组的问题列表
  lines.push('## 📋 问题清单');
  lines.push('');
  
  const issuesBySeverity = groupBySeverity(reportData.issues);
  
  Object.entries(SEVERITY_DISPLAY).forEach(([severity, display]) => {
    const issues = issuesBySeverity[severity] || [];
    if (issues.length === 0) return;
    
    lines.push(`### ${display.emoji} ${display.name} (${issues.length})`);
    lines.push('');
    
    issues.forEach((issue, index) => {
      const typeDisplay = ISSUE_TYPE_DISPLAY[issue.type] || issue.type;
      
      lines.push(`#### ${index + 1}. ${issue.title}`);
      lines.push('');
      lines.push(`**类型：** ${typeDisplay}`);
      lines.push('');
      lines.push(`**问题描述：** ${issue.message}`);
      lines.push('');
      
      // 来源信息
      if (issue.source) {
        lines.push('**来源：**');
        lines.push('');
        if (Array.isArray(issue.source)) {
          issue.source.forEach((src, i) => {
            lines.push(formatSource(src, i + 1));
          });
        } else {
          lines.push(formatSource(issue.source));
        }
        lines.push('');
      }
      
      // 详细信息
      if (issue.details && Object.keys(issue.details).length > 0) {
        lines.push('**详细信息：**');
        lines.push('');
        lines.push('```json');
        lines.push(JSON.stringify(issue.details, null, 2));
        lines.push('```');
        lines.push('');
      }
      
      // 建议
      if (issue.suggestion) {
        lines.push(`**建议：** ${issue.suggestion}`);
        lines.push('');
      }
      
      lines.push('---');
      lines.push('');
    });
  });
  
  // 产品对比表格
  if (reportData.comparisons && reportData.comparisons.products && reportData.comparisons.products.length > 0) {
    lines.push('## 📊 产品对比（报价 vs 合同）');
    lines.push('');
    lines.push('| SKU | 产品名称 | 报价数量 | 合同数量 | 报价单价 | 合同单价 | 报价折扣 | 合同折扣 |');
    lines.push('|-----|----------|----------|----------|----------|----------|----------|----------|');
    
    reportData.comparisons.products.forEach(p => {
      const qtyMatch = p.quote.quantity === p.contract.quantity ? '' : '⚠️';
      const priceMatch = Math.abs((p.quote.unitPrice || 0) - (p.contract.unitPrice || 0)) < 0.01 ? '' : '⚠️';
      const discountMatch = Math.abs((p.quote.discount || 1) - (p.contract.discount || 1)) < 0.01 ? '' : '⚠️';
      
      lines.push(`| ${p.sku} | ${p.productName || '-'} | ${p.quote.quantity || '-'} ${qtyMatch} | ${p.contract.quantity || '-'} | ${formatNumber(p.quote.unitPrice)} ${priceMatch} | ${formatNumber(p.contract.unitPrice)} | ${formatDiscount(p.quote.discount)} ${discountMatch} | ${formatDiscount(p.contract.discount)} |`);
    });
    lines.push('');
  }
  
  // 确认话术
  lines.push('## 💬 确认话术模板');
  lines.push('');
  lines.push('以下是可以直接复制使用的确认话术：');
  lines.push('');
  
  const copyTexts = generateCopyTexts(reportData);
  
  if (copyTexts.internal) {
    lines.push('### 内部确认话术');
    lines.push('');
    lines.push('```');
    lines.push(copyTexts.internal);
    lines.push('```');
    lines.push('');
  }
  
  if (copyTexts.customer) {
    lines.push('### 客户确认话术');
    lines.push('');
    lines.push('```');
    lines.push(copyTexts.customer);
    lines.push('```');
    lines.push('');
  }
  
  if (copyTexts.summary) {
    lines.push('### 问题摘要');
    lines.push('');
    lines.push('```');
    lines.push(copyTexts.summary);
    lines.push('```');
    lines.push('');
  }
  
  return lines.join('\n');
}

/**
 * 生成HTML报告
 */
function generateHtmlReport(reportData) {
  const issuesBySeverity = groupBySeverity(reportData.issues);
  
  // 生成问题列表HTML
  let issuesHtml = '';
  
  Object.entries(SEVERITY_DISPLAY).forEach(([severity, display]) => {
    const issues = issuesBySeverity[severity] || [];
    if (issues.length === 0) return;
    
    issuesHtml += `
      <div class="severity-section">
        <h3 style="color: ${display.color}">
          ${display.emoji} ${display.name} 
          <span class="badge">${issues.length}</span>
        </h3>
        <div class="issue-list">
    `;
    
    issues.forEach((issue, index) => {
      const typeDisplay = ISSUE_TYPE_DISPLAY[issue.type] || issue.type;
      
      issuesHtml += `
        <div class="issue-card">
          <div class="issue-header">
            <span class="issue-number">#${index + 1}</span>
            <span class="issue-title">${escapeHtml(issue.title)}</span>
          </div>
          <div class="issue-body">
            <div class="issue-meta">
              <span class="issue-type">${escapeHtml(typeDisplay)}</span>
            </div>
            <p class="issue-message">${escapeHtml(issue.message)}</p>
      `;
      
      // 来源信息
      if (issue.source) {
        issuesHtml += '<div class="issue-source"><strong>来源：</strong>';
        if (Array.isArray(issue.source)) {
          issue.source.forEach((src, i) => {
            issuesHtml += `<div class="source-item">${formatSourceHtml(src, i + 1)}</div>`;
          });
        } else {
          issuesHtml += `<div class="source-item">${formatSourceHtml(issue.source)}</div>`;
        }
        issuesHtml += '</div>';
      }
      
      // 详细信息
      if (issue.details && Object.keys(issue.details).length > 0) {
        issuesHtml += `
          <div class="issue-details">
            <strong>详细信息：</strong>
            <pre>${escapeHtml(JSON.stringify(issue.details, null, 2))}</pre>
          </div>
        `;
      }
      
      // 建议
      if (issue.suggestion) {
        issuesHtml += `
          <div class="issue-suggestion">
            <strong>💡 建议：</strong>${escapeHtml(issue.suggestion)}
          </div>
        `;
      }
      
      issuesHtml += `
          </div>
        </div>
      `;
    });
    
    issuesHtml += `
        </div>
      </div>
    `;
  });
  
  // 产品对比表格
  let comparisonHtml = '';
  if (reportData.comparisons && reportData.comparisons.products && reportData.comparisons.products.length > 0) {
    comparisonHtml += `
      <h2>📊 产品对比（报价 vs 合同）</h2>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>产品名称</th>
              <th>报价数量</th>
              <th>合同数量</th>
              <th>报价单价</th>
              <th>合同单价</th>
              <th>报价折扣</th>
              <th>合同折扣</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    reportData.comparisons.products.forEach(p => {
      const qtyMatch = p.quote.quantity === p.contract.quantity;
      const priceMatch = Math.abs((p.quote.unitPrice || 0) - (p.contract.unitPrice || 0)) < 0.01;
      const discountMatch = Math.abs((p.quote.discount || 1) - (p.contract.discount || 1)) < 0.01;
      
      comparisonHtml += `
        <tr>
          <td>${escapeHtml(p.sku)}</td>
          <td>${escapeHtml(p.productName || '-')}</td>
          <td class="${qtyMatch ? '' : 'text-warning'}">${p.quote.quantity || '-'} ${qtyMatch ? '' : '⚠️'}</td>
          <td class="${qtyMatch ? '' : 'text-warning'}">${p.contract.quantity || '-'} ${qtyMatch ? '' : '⚠️'}</td>
          <td class="${priceMatch ? '' : 'text-warning'}">${formatNumber(p.quote.unitPrice)} ${priceMatch ? '' : '⚠️'}</td>
          <td class="${priceMatch ? '' : 'text-warning'}">${formatNumber(p.contract.unitPrice)} ${priceMatch ? '' : '⚠️'}</td>
          <td class="${discountMatch ? '' : 'text-warning'}">${formatDiscount(p.quote.discount)} ${discountMatch ? '' : '⚠️'}</td>
          <td class="${discountMatch ? '' : 'text-warning'}">${formatDiscount(p.contract.discount)} ${discountMatch ? '' : '⚠️'}</td>
        </tr>
      `;
    });
    
    comparisonHtml += `
          </tbody>
        </table>
      </div>
    `;
  }
  
  // 完整HTML
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>售前报价与合同交付差异核对报告</title>
  <style>
    * {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .container {
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    h1 {
      color: #1a1a1a;
      border-bottom: 3px solid #3b82f6;
      padding-bottom: 10px;
      margin-top: 0;
    }
    h2 {
      color: #1a1a1a;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 8px;
      margin-top: 30px;
    }
    h3 {
      color: #374151;
      margin-top: 20px;
    }
    .timestamp {
      color: #6b7280;
      font-size: 14px;
      margin-bottom: 20px;
    }
    .summary-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin: 20px 0;
    }
    .summary-card {
      background: #f8fafc;
      padding: 15px;
      border-radius: 8px;
      border-left: 4px solid #3b82f6;
    }
    .summary-card.critical { border-left-color: #dc2626; }
    .summary-card.high { border-left-color: #ea580c; }
    .summary-card.medium { border-left-color: #ca8a04; }
    .summary-card.low { border-left-color: #2563eb; }
    .summary-card .count {
      font-size: 28px;
      font-weight: bold;
      color: #1a1a1a;
    }
    .summary-card .label {
      font-size: 14px;
      color: #6b7280;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
    }
    th {
      background: #f8fafc;
      font-weight: 600;
    }
    tr:hover {
      background: #f9fafb;
    }
    .text-warning {
      color: #ea580c;
      font-weight: 600;
    }
    .severity-section {
      margin: 25px 0;
    }
    .badge {
      display: inline-block;
      background: #e5e7eb;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 14px;
      margin-left: 10px;
    }
    .issue-card {
      background: #fafafa;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      margin: 15px 0;
      overflow: hidden;
    }
    .issue-header {
      background: #f3f4f6;
      padding: 12px 15px;
      border-bottom: 1px solid #e5e7eb;
    }
    .issue-number {
      display: inline-block;
      background: #3b82f6;
      color: white;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      margin-right: 10px;
    }
    .issue-title {
      font-weight: 600;
      color: #1f2937;
    }
    .issue-body {
      padding: 15px;
    }
    .issue-meta {
      margin-bottom: 10px;
    }
    .issue-type {
      display: inline-block;
      background: #dbeafe;
      color: #1e40af;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
    }
    .issue-message {
      color: #374151;
      margin: 10px 0;
    }
    .issue-source, .issue-details, .issue-suggestion {
      margin: 12px 0;
      padding: 10px;
      background: white;
      border-radius: 4px;
      font-size: 14px;
    }
    .source-item {
      margin: 5px 0;
      color: #4b5563;
    }
    .source-item strong {
      color: #374151;
    }
    pre {
      background: #1f2937;
      color: #e5e7eb;
      padding: 12px;
      border-radius: 4px;
      overflow-x: auto;
      font-size: 13px;
      margin: 8px 0 0 0;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 15px;
      margin: 15px 0;
    }
    .stat-box {
      background: #f0f9ff;
      padding: 15px;
      border-radius: 8px;
    }
    .stat-box h4 {
      margin: 0 0 10px 0;
      color: #0369a1;
    }
    .stat-box p {
      margin: 5px 0;
      color: #374151;
      font-size: 14px;
    }
    .copy-section {
      background: #fefce8;
      border: 1px solid #fde047;
      border-radius: 8px;
      padding: 15px;
      margin: 15px 0;
    }
    .copy-section h4 {
      margin: 0 0 10px 0;
      color: #854d0e;
    }
    .copy-text {
      background: white;
      padding: 12px;
      border-radius: 4px;
      font-size: 14px;
      line-height: 1.8;
      white-space: pre-wrap;
    }
    .table-container {
      overflow-x: auto;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📋 售前报价与合同交付差异核对报告</h1>
    <div class="timestamp">生成时间：${reportData.timestamp}</div>
    
    <h2>📊 统计概览</h2>
    
    <h3>问题汇总</h3>
    <div class="summary-cards">
      ${Object.entries(SEVERITY_DISPLAY).map(([key, display]) => {
        const count = reportData.summary.bySeverity[key] || 0;
        return `
          <div class="summary-card ${key}">
            <div class="count">${count}</div>
            <div class="label">${display.emoji} ${display.name}</div>
          </div>
        `;
      }).join('')}
    </div>
    <p><strong>总计：${reportData.summary.totalIssues} 个问题</strong></p>
    
    <h3>数据源统计</h3>
    <div class="stats-grid">
      ${reportData.statistics.quote ? `
        <div class="stat-box">
          <h4>📄 报价单</h4>
          <p><strong>文件：</strong>${escapeHtml(reportData.statistics.quote.file)}</p>
          <p><strong>产品数量：</strong>${reportData.statistics.quote.productCount}</p>
          <p><strong>总金额：</strong>￥${formatNumber(reportData.statistics.quote.totalAmount)}</p>
        </div>
      ` : ''}
      ${reportData.statistics.contract ? `
        <div class="stat-box">
          <h4>📑 合同</h4>
          <p><strong>文件：</strong>${escapeHtml(reportData.statistics.contract.file)}</p>
          <p><strong>产品数量：</strong>${reportData.statistics.contract.productCount}</p>
          <p><strong>交付批次：</strong>${reportData.statistics.contract.deliveryCount}</p>
          <p><strong>付款节点：</strong>${reportData.statistics.contract.paymentCount}</p>
          <p><strong>产品总金额：</strong>￥${formatNumber(reportData.statistics.contract.totalAmount)}</p>
        </div>
      ` : ''}
      ${reportData.statistics.catalog ? `
        <div class="stat-box">
          <h4>📦 产品目录</h4>
          <p><strong>文件：</strong>${escapeHtml(reportData.statistics.catalog.file)}</p>
          <p><strong>产品总数：</strong>${reportData.statistics.catalog.productCount}</p>
          <p><strong>活跃产品：</strong>${reportData.statistics.catalog.activeCount}</p>
        </div>
      ` : ''}
      ${reportData.statistics.approval ? `
        <div class="stat-box">
          <h4>✅ 审批备注</h4>
          <p><strong>文件：</strong>${escapeHtml(reportData.statistics.approval.file)}</p>
          <p><strong>审批记录数：</strong>${reportData.statistics.approval.approvalCount}</p>
          <p><strong>包含折扣备注：</strong>${reportData.statistics.approval.hasDiscountNotes ? '是' : '否'}</p>
        </div>
      ` : ''}
    </div>
    
    <h2>📋 问题清单</h2>
    ${issuesHtml}
    
    ${comparisonHtml}
    
    <h2>💬 确认话术模板</h2>
    <p>以下是可以直接复制使用的确认话术：</p>
    
    ${generateCopyTextsHtml(reportData)}
  </div>
</body>
</html>
  `;
}

/**
 * 生成确认话术
 */
function generateCopyTexts(reportData) {
  const texts = {
    internal: '',
    customer: '',
    summary: ''
  };
  
  const criticalCount = reportData.summary.bySeverity.critical || 0;
  const highCount = reportData.summary.bySeverity.high || 0;
  const mediumCount = reportData.summary.bySeverity.medium || 0;
  const lowCount = reportData.summary.bySeverity.low || 0;
  
  // 问题摘要
  if (reportData.summary.totalIssues > 0) {
    texts.summary = `【差异核对结果摘要】
本次核对共发现 ${reportData.summary.totalIssues} 个问题：
- 🔴 需要客户确认：${criticalCount} 个
- 🟠 需要内部确认：${highCount} 个
- 🟡 建议修订：${mediumCount} 个
- 🔵 建议检查：${lowCount} 个

请查看详细报告了解具体问题。`;
  } else {
    texts.summary = `【差异核对结果摘要】
✅ 未发现明显差异，报价单与合同内容一致。
建议仍需人工复核关键条款。`;
  }
  
  // 内部确认话术
  const internalIssues = [
    ...(reportData.issues.filter(i => i.severity === 'high') || []),
    ...(reportData.issues.filter(i => i.severity === 'medium') || []),
    ...(reportData.issues.filter(i => i.severity === 'low') || [])
  ];
  
  if (internalIssues.length > 0) {
    let internalText = `【内部确认通知】

各位同事好，本次报价与合同核对发现以下需要内部确认的问题：

`;
    
    internalIssues.slice(0, 10).forEach((issue, idx) => {
      const typeDisplay = ISSUE_TYPE_DISPLAY[issue.type] || issue.type;
      internalText += `${idx + 1}. ${issue.title}
   描述：${issue.message}
   建议：${issue.suggestion || '请查看详细报告'}

`;
    });
    
    if (internalIssues.length > 10) {
      internalText += `... 还有 ${internalIssues.length - 10} 个问题，请查看详细报告。

`;
    }
    
    internalText += `请相关负责人尽快确认以上问题，确保报价与合同一致。
如有疑问，请查看完整报告。`;
    
    texts.internal = internalText;
  }
  
  // 客户确认话术
  const customerIssues = reportData.issues.filter(i => i.severity === 'critical') || [];
  
  if (customerIssues.length > 0) {
    let customerText = `【合同条款确认】

尊敬的客户，您好！

在合同审核过程中，我们发现以下需要与您确认的事项：

`;
    
    customerIssues.forEach((issue, idx) => {
      customerText += `${idx + 1}. ${issue.title}
   说明：${issue.message}

`;
    });
    
    customerText += `为了确保合同内容准确反映双方约定，烦请您协助确认以上事项。
如有任何疑问，请随时与我们联系。

谢谢！`;
    
    texts.customer = customerText;
  }
  
  return texts;
}

/**
 * 生成确认话术的HTML版本
 */
function generateCopyTextsHtml(reportData) {
  const copyTexts = generateCopyTexts(reportData);
  let html = '';
  
  if (copyTexts.internal) {
    html += `
      <div class="copy-section">
        <h4>📋 内部确认话术</h4>
        <div class="copy-text">${escapeHtml(copyTexts.internal)}</div>
      </div>
    `;
  }
  
  if (copyTexts.customer) {
    html += `
      <div class="copy-section">
        <h4>📧 客户确认话术</h4>
        <div class="copy-text">${escapeHtml(copyTexts.customer)}</div>
      </div>
    `;
  }
  
  if (copyTexts.summary) {
    html += `
      <div class="copy-section">
        <h4>📝 问题摘要</h4>
        <div class="copy-text">${escapeHtml(copyTexts.summary)}</div>
      </div>
    `;
  }
  
  return html;
}

/**
 * 按严重程度分组问题
 */
function groupBySeverity(issues) {
  const groups = {};
  Object.keys(SEVERITY_DISPLAY).forEach(key => {
    groups[key] = [];
  });
  
  (issues || []).forEach(issue => {
    if (groups[issue.severity]) {
      groups[issue.severity].push(issue);
    }
  });
  
  return groups;
}

/**
 * 格式化数字
 */
function formatNumber(num) {
  if (num === undefined || num === null) return '-';
  return num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * 格式化折扣
 */
function formatDiscount(discount) {
  if (discount === undefined || discount === null) return '-';
  if (discount === 1) return '无折扣';
  return `${(discount * 10).toFixed(1)}折 (${(discount * 100).toFixed(0)}%)`;
}

/**
 * 格式化来源信息（Markdown）
 */
function formatSource(source, num = null) {
  let parts = [];
  if (num) parts.push(`${num}.`);
  if (source.file) parts.push(`文件：${source.file}`);
  if (source.sheet) parts.push(`工作表：${source.sheet}`);
  if (source.line) parts.push(`行号：${source.line}`);
  if (source.index !== undefined) parts.push(`索引：${source.index}`);
  if (source.field) parts.push(`字段：${source.field}`);
  if (source.value !== undefined) parts.push(`值：${source.value}`);
  return `- ${parts.join(' | ')}`;
}

/**
 * 格式化来源信息（HTML）
 */
function formatSourceHtml(source, num = null) {
  let parts = [];
  if (num) parts.push(`<strong>${num}.</strong>`);
  if (source.file) parts.push(`<strong>文件：</strong>${escapeHtml(source.file)}`);
  if (source.sheet) parts.push(`<strong>工作表：</strong>${escapeHtml(source.sheet)}`);
  if (source.line) parts.push(`<strong>行号：</strong>${source.line}`);
  if (source.index !== undefined) parts.push(`<strong>索引：</strong>${source.index}`);
  if (source.field) parts.push(`<strong>字段：</strong>${escapeHtml(source.field)}`);
  if (source.value !== undefined) parts.push(`<strong>值：</strong>${escapeHtml(String(source.value))}`);
  return parts.join(' | ');
}

/**
 * HTML转义
 */
function escapeHtml(text) {
  if (text === undefined || text === null) return '';
  // 服务器端转义（Node.js环境，不使用document）
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

module.exports = {
  generateReports,
  generateJsonReport,
  generateMarkdownReport,
  generateHtmlReport,
  generateCopyTexts,
  SEVERITY_DISPLAY,
  ISSUE_TYPE_DISPLAY
};

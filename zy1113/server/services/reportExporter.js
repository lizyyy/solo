const db = require('../config/database');
const dayjs = require('dayjs');

function getDashboardData(filters = {}) {
  const { agentName, category, region, startDate, endDate } = filters;
  
  let whereConditions = [];
  let params = [];

  if (agentName) {
    whereConditions.push('cn.agent_name LIKE ?');
    params.push(`%${agentName}%`);
  }
  if (category) {
    whereConditions.push('cn.product_category LIKE ?');
    params.push(`%${category}%`);
  }
  if (region) {
    whereConditions.push('cn.region LIKE ?');
    params.push(`%${region}%`);
  }
  if (startDate) {
    whereConditions.push('cn.call_time >= ?');
    params.push(startDate);
  }
  if (endDate) {
    whereConditions.push('cn.call_time <= ?');
    params.push(endDate);
  }

  const whereClause = whereConditions.length > 0 
    ? 'WHERE ' + whereConditions.join(' AND ') 
    : '';

  const categoryStats = db.prepare(`
    SELECT 
      c.name as category_name,
      c.code as category_code,
      COUNT(a.id) as count,
      ROUND(COUNT(a.id) * 100.0 / (SELECT COUNT(*) FROM attributions a2 JOIN call_notes cn2 ON a2.call_id = cn2.call_id ${whereClause}), 2) as percentage
    FROM attributions a
    JOIN call_notes cn ON a.call_id = cn.call_id
    JOIN categories c ON a.category_code = c.code
    ${whereClause}
    GROUP BY c.code, c.name
    ORDER BY count DESC
  `).all(...params);

  const agentStats = db.prepare(`
    SELECT 
      agent_name,
      COUNT(*) as call_count,
      COUNT(CASE WHEN c.status = 'overdue' THEN 1 END) as overdue_count,
      COUNT(CASE WHEN c.status = 'pending' AND c.deadline < date('now', '+3 days') THEN 1 END) as urgent_count
    FROM call_notes cn
    LEFT JOIN commitments c ON cn.call_id = c.call_id
    ${whereClause}
    GROUP BY agent_name
    ORDER BY call_count DESC
  `).all(...params);

  const regionStats = db.prepare(`
    SELECT 
      region,
      COUNT(*) as call_count,
      COUNT(DISTINCT customer_id) as customer_count
    FROM call_notes
    ${whereClause}
    GROUP BY region
    ORDER BY call_count DESC
  `).all(...params);

  const frequentCustomers = db.prepare(`
    SELECT 
      cn.customer_id,
      c.name as customer_name,
      c.phone,
      COUNT(*) as call_count
    FROM call_notes cn
    LEFT JOIN customers c ON cn.customer_id = c.customer_id
    ${whereClause}
    GROUP BY cn.customer_id, c.name, c.phone
    HAVING call_count > 1
    ORDER BY call_count DESC
    LIMIT 20
  `).all(...params);

  const productCategories = db.prepare(`
    SELECT 
      product_category,
      COUNT(*) as call_count
    FROM call_notes
    ${whereClause}
    GROUP BY product_category
    ORDER BY call_count DESC
  `).all(...params);

  const pendingCommitments = db.prepare(`
    SELECT 
      c.id,
      c.call_id,
      c.content,
      c.deadline,
      c.status,
      c.priority,
      cn.agent_name,
      cn.customer_id,
      cust.name as customer_name
    FROM commitments c
    JOIN call_notes cn ON c.call_id = cn.call_id
    LEFT JOIN customers cust ON cn.customer_id = cust.customer_id
    WHERE c.status IN ('pending', 'overdue')
    ORDER BY 
      CASE c.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      c.deadline ASC
  `).all();

  return {
    categoryStats,
    agentStats,
    regionStats,
    frequentCustomers,
    productCategories,
    pendingCommitments,
    totalCalls: categoryStats.reduce((sum, item) => sum + item.count, 0),
    filters
  };
}

function exportToMarkdown(data) {
  const today = dayjs().format('YYYY-MM-DD');
  let md = `# 售后通话纪要复盘报告\n\n`;
  md += `**生成日期**: ${today}\n\n`;
  md += `---\n\n`;

  md += `## 一、概览\n\n`;
  md += `- **总通话数**: ${data.totalCalls}\n`;
  md += `- **待跟进承诺**: ${data.pendingCommitments.filter(c => c.status === 'pending').length}\n`;
  md += `- **已逾期承诺**: ${data.pendingCommitments.filter(c => c.status === 'overdue').length}\n\n`;

  md += `## 二、问题分类占比\n\n`;
  md += `| 分类 | 数量 | 占比 |\n`;
  md += `|------|------|------|\n`;
  data.categoryStats.forEach(item => {
    md += `| ${item.category_name} | ${item.count} | ${item.percentage}% |\n`;
  });
  md += '\n';

  if (data.frequentCustomers.length > 0) {
    md += `## 三、反复出现的客户\n\n`;
    md += `| 客户ID | 客户名称 | 联系电话 | 通话次数 |\n`;
    md += `|--------|----------|----------|----------|\n`;
    data.frequentCustomers.forEach(item => {
      md += `| ${item.customer_id || '-'} | ${item.customer_name || '-'} | ${item.phone || '-'} | ${item.call_count} |\n`;
    });
    md += '\n';
  }

  md += `## 四、未跟进承诺清单\n\n`;
  if (data.pendingCommitments.length === 0) {
    md += `暂无待跟进承诺。\n\n`;
  } else {
    md += `| 优先级 | 状态 | 截止日期 | 承诺内容 | 客服 | 客户 |\n`;
    md += `|--------|------|----------|----------|------|------|\n`;
    data.pendingCommitments.forEach(item => {
      const statusText = item.status === 'overdue' ? '⚠️ 已逾期' : '待跟进';
      const priorityText = item.priority === 'high' ? '🔴 高' : item.priority === 'medium' ? '🟡 中' : '🟢 低';
      md += `| ${priorityText} | ${statusText} | ${item.deadline || '-'} | ${item.content} | ${item.agent_name || '-'} | ${item.customer_name || item.customer_id || '-'} |\n`;
    });
    md += '\n';
  }

  md += `## 五、客服统计\n\n`;
  md += `| 客服 | 通话数 | 逾期承诺 | 紧急待处理 |\n`;
  md += `|------|--------|----------|------------|\n`;
  data.agentStats.forEach(item => {
    md += `| ${item.agent_name || '-'} | ${item.call_count} | ${item.overdue_count || 0} | ${item.urgent_count || 0} |\n`;
  });
  md += '\n';

  md += `## 六、建议优先处理\n\n`;
  const highPriority = data.pendingCommitments.filter(c => c.priority === 'high' || c.status === 'overdue');
  if (highPriority.length > 0) {
    md += `### 高优先级（需立即处理）\n\n`;
    highPriority.forEach((item, index) => {
      const risk = item.status === 'overdue' ? '已逾期' : `截止日期: ${item.deadline}`;
      md += `${index + 1}. **${item.content}**\n`;
      md += `   - 客户: ${item.customer_name || item.customer_id || '-'}\n`;
      md += `   - 客服: ${item.agent_name || '-'}\n`;
      md += `   - 状态: ${risk}\n\n`;
    });
  }

  const topCategories = data.categoryStats.slice(0, 3);
  if (topCategories.length > 0) {
    md += `### 高频问题分类\n\n`;
    topCategories.forEach((item, index) => {
      md += `${index + 1}. **${item.category_name}**: ${item.count}次 (${item.percentage}%)\n`;
    });
    md += '\n';
  }

  if (data.frequentCustomers.length > 0) {
    md += `### 需重点关注的客户\n\n`;
    data.frequentCustomers.slice(0, 5).forEach((item, index) => {
      md += `${index + 1}. **${item.customer_name || item.customer_id}**: 通话 ${item.call_count} 次\n`;
    });
    md += '\n';
  }

  return md;
}

function exportToHTML(data) {
  const today = dayjs().format('YYYY-MM-DD');
  let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>售后通话纪要复盘报告</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; line-height: 1.6; color: #333; }
    h1 { color: #1a1a1a; border-bottom: 2px solid #007acc; padding-bottom: 10px; }
    h2 { color: #007acc; margin-top: 30px; }
    table { border-collapse: collapse; width: 100%; margin: 15px 0; }
    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    th { background-color: #f5f5f5; font-weight: 600; }
    tr:hover { background-color: #f9f9f9; }
    .risk-high { background-color: #fff0f0; color: #d32f2f; }
    .risk-medium { background-color: #fff8e1; color: #f57c00; }
    .overdue { background-color: #ffebee; }
    .priority-high { color: #d32f2f; font-weight: bold; }
    .priority-medium { color: #f57c00; }
    .priority-low { color: #388e3c; }
    .stats-card { display: inline-block; background: #f5f5f5; padding: 15px 25px; margin: 10px; border-radius: 8px; }
    .stats-number { font-size: 24px; font-weight: bold; color: #007acc; }
    .section { margin: 30px 0; }
    ul { margin: 10px 0 20px 20px; }
    li { margin: 8px 0; }
  </style>
</head>
<body>
  <h1>售后通话纪要复盘报告</h1>
  <p><strong>生成日期:</strong> ${today}</p>
  <hr>

  <div class="section">
    <h2>一、概览</h2>
    <div class="stats-card">
      <div class="stats-number">${data.totalCalls}</div>
      <div>总通话数</div>
    </div>
    <div class="stats-card">
      <div class="stats-number">${data.pendingCommitments.filter(c => c.status === 'pending').length}</div>
      <div>待跟进承诺</div>
    </div>
    <div class="stats-card risk-high">
      <div class="stats-number">${data.pendingCommitments.filter(c => c.status === 'overdue').length}</div>
      <div>已逾期承诺</div>
    </div>
  </div>

  <div class="section">
    <h2>二、问题分类占比</h2>
    <table>
      <tr><th>分类</th><th>数量</th><th>占比</th></tr>`;

  data.categoryStats.forEach(item => {
    html += `<tr><td>${item.category_name}</td><td>${item.count}</td><td>${item.percentage}%</td></tr>`;
  });

  html += `</table></div>`;

  if (data.frequentCustomers.length > 0) {
    html += `<div class="section"><h2>三、反复出现的客户</h2><table>
      <tr><th>客户ID</th><th>客户名称</th><th>联系电话</th><th>通话次数</th></tr>`;
    data.frequentCustomers.forEach(item => {
      html += `<tr><td>${item.customer_id || '-'}</td><td>${item.customer_name || '-'}</td><td>${item.phone || '-'}</td><td>${item.call_count}</td></tr>`;
    });
    html += `</table></div>`;
  }

  html += `<div class="section"><h2>四、未跟进承诺清单</h2>`;
  if (data.pendingCommitments.length === 0) {
    html += `<p>暂无待跟进承诺。</p>`;
  } else {
    html += `<table><tr><th>优先级</th><th>状态</th><th>截止日期</th><th>承诺内容</th><th>客服</th><th>客户</th></tr>`;
    data.pendingCommitments.forEach(item => {
      const statusClass = item.status === 'overdue' ? 'overdue' : '';
      const statusText = item.status === 'overdue' ? '⚠️ 已逾期' : '待跟进';
      const priorityClass = `priority-${item.priority}`;
      const priorityText = item.priority === 'high' ? '🔴 高' : item.priority === 'medium' ? '🟡 中' : '🟢 低';
      html += `<tr class="${statusClass}"><td class="${priorityClass}">${priorityText}</td><td>${statusText}</td><td>${item.deadline || '-'}</td><td>${item.content}</td><td>${item.agent_name || '-'}</td><td>${item.customer_name || item.customer_id || '-'}</td></tr>`;
    });
    html += `</table>`;
  }
  html += `</div>`;

  html += `<div class="section"><h2>五、建议优先处理</h2>`;
  const highPriority = data.pendingCommitments.filter(c => c.priority === 'high' || c.status === 'overdue');
  if (highPriority.length > 0) {
    html += `<h3>高优先级（需立即处理）</h3><ul>`;
    highPriority.forEach((item, index) => {
      const risk = item.status === 'overdue' ? '<span style="color:#d32f2f">已逾期</span>' : `截止日期: ${item.deadline}`;
      html += `<li><strong>${item.content}</strong> - 客户: ${item.customer_name || item.customer_id || '-'}, 客服: ${item.agent_name || '-'}, ${risk}</li>`;
    });
    html += `</ul>`;
  }

  const topCategories = data.categoryStats.slice(0, 3);
  if (topCategories.length > 0) {
    html += `<h3>高频问题分类</h3><ul>`;
    topCategories.forEach((item, index) => {
      html += `<li><strong>${item.category_name}</strong>: ${item.count}次 (${item.percentage}%)</li>`;
    });
    html += `</ul>`;
  }
  html += `</div></body></html>`;

  return html;
}

function exportToCSV(data) {
  let csv = '';
  
  csv += '问题分类统计\n';
  csv += '分类,数量,占比\n';
  data.categoryStats.forEach(item => {
    csv += `"${item.category_name}",${item.count},${item.percentage}%\n`;
  });
  csv += '\n';

  if (data.pendingCommitments.length > 0) {
    csv += '待跟进承诺\n';
    csv += '优先级,状态,截止日期,承诺内容,客服,客户\n';
    data.pendingCommitments.forEach(item => {
      const statusText = item.status === 'overdue' ? '已逾期' : '待跟进';
      csv += `"${item.priority}","${statusText}","${item.deadline || ''}","${item.content}","${item.agent_name || ''}","${item.customer_name || item.customer_id || ''}"\n`;
    });
    csv += '\n';
  }

  if (data.frequentCustomers.length > 0) {
    csv += '反复出现的客户\n';
    csv += '客户ID,客户名称,联系电话,通话次数\n';
    data.frequentCustomers.forEach(item => {
      csv += `"${item.customer_id || ''}","${item.customer_name || ''}","${item.phone || ''}",${item.call_count}\n`;
    });
    csv += '\n';
  }

  csv += '客服统计\n';
  csv += '客服,通话数,逾期承诺,紧急待处理\n';
  data.agentStats.forEach(item => {
    csv += `"${item.agent_name || ''}",${item.call_count},${item.overdue_count || 0},${item.urgent_count || 0}\n`;
  });

  return csv;
}

function exportToJSON(data) {
  return JSON.stringify(data, null, 2);
}

module.exports = {
  getDashboardData,
  exportToMarkdown,
  exportToHTML,
  exportToCSV,
  exportToJSON
};

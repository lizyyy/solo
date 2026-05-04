const { getDB } = require('../db');
const { STATUS_NAMES } = require('./orderService');

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleString('zh-CN', { 
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
}

function getTodayProduction() {
  const db = getDB();
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();
  
  const orders = db.prepare(`
    SELECT o.*, c.name as customer_name, p.name as paper_name
    FROM orders o
    LEFT JOIN customers c ON o.customer_id = c.id
    LEFT JOIN paper_stock p ON o.paper_id = p.id
    WHERE o.status IN ('scheduled', 'locked', 'paid')
    AND o.pickup_time >= ? AND o.pickup_time < ?
    ORDER BY o.pickup_time ASC
  `).all(startOfDay, endOfDay);
  
  return orders.map(o => ({
    ...o,
    status_name: STATUS_NAMES[o.status] || o.status
  }));
}

function getPickupList() {
  const db = getDB();
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3).toISOString();
  
  const orders = db.prepare(`
    SELECT o.*, c.name as customer_name, c.phone as customer_phone
    FROM orders o
    LEFT JOIN customers c ON o.customer_id = c.id
    WHERE o.status IN ('scheduled', 'ready')
    AND o.pickup_time >= ? AND o.pickup_time < ?
    ORDER BY o.pickup_time ASC
  `).all(startOfDay, endOfDay);
  
  return orders.map(o => ({
    ...o,
    status_name: STATUS_NAMES[o.status] || o.status
  }));
}

function getPaperRestockList() {
  const db = getDB();
  const papers = db.prepare(`
    SELECT ps.*,
      (SELECT SUM(sl.quantity) FROM stock_locks sl WHERE sl.paper_id = ps.id AND sl.is_released = 0) as locked_qty
    FROM paper_stock ps
    ORDER BY ps.stock_qty ASC
  `).all();
  
  return papers.map(p => ({
    ...p,
    available: p.stock_qty - (p.locked_qty || 0),
    needs_restock: (p.stock_qty - (p.locked_qty || 0)) <= p.min_stock
  }));
}

function toMarkdown_TodayProduction(orders) {
  let md = `# 今日生产单\n\n`;
  md += `生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
  md += `---\n\n`;
  
  if (orders.length === 0) {
    md += `暂无今日生产单。\n`;
    return md;
  }
  
  orders.forEach((order, idx) => {
    md += `## ${idx + 1}. 订单 ${order.order_no}\n\n`;
    md += `- **客户**: ${order.customer_name || '散客'}\n`;
    md += `- **产品**: ${order.product_type || '印刷品'} ${order.width}x${order.height}mm\n`;
    md += `- **数量**: ${order.quantity} 份\n`;
    md += `- **纸张**: ${order.paper_name || '-'}\n`;
    md += `- **用纸量**: ${order.paper_qty_est || '-'} 张\n`;
    md += `- **取件时间**: ${formatDateTime(order.pickup_time)}\n`;
    md += `- **状态**: ${order.status_name}\n`;
    if (order.notes) {
      md += `- **备注**: ${order.notes}\n`;
    }
    md += `\n---\n\n`;
  });
  
  md += `\n**总计**: ${orders.length} 个订单\n`;
  
  return md;
}

function toMarkdown_PickupList(orders) {
  let md = `# 客户取件清单\n\n`;
  md += `生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
  md += `覆盖范围: 未来 3 天内待取件\n\n`;
  md += `---\n\n`;
  
  if (orders.length === 0) {
    md += `暂无待取件订单。\n`;
    return md;
  }
  
  md += `| 订单号 | 客户 | 电话 | 产品 | 数量 | 取件时间 | 状态 |\n`;
  md += `|--------|------|------|------|------|----------|------|\n`;
  
  orders.forEach(order => {
    md += `| ${order.order_no} | ${order.customer_name || '-'} | ${order.customer_phone || '-'} | ${order.product_type || '印刷品'} | ${order.quantity} | ${formatDate(order.pickup_time)} | ${order.status_name} |\n`;
  });
  
  md += `\n**总计**: ${orders.length} 个待取件订单\n`;
  
  return md;
}

function toMarkdown_RestockList(papers) {
  let md = `# 纸张补纸清单\n\n`;
  md += `生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
  md += `---\n\n`;
  
  const needRestock = papers.filter(p => p.needs_restock);
  
  if (needRestock.length > 0) {
    md += `## ⚠️ 急需补货\n\n`;
    md += `| 纸张名称 | 规格 | 总库存 | 已锁定 | 可用 | 安全库存 | 单价 |\n`;
    md += `|----------|------|--------|--------|------|----------|------|\n`;
    
    needRestock.forEach(p => {
      md += `| ${p.name} | ${p.size || '-'} ${p.weight || '-'}g | ${p.stock_qty} | ${p.locked_qty || 0} | **${p.available}** | ${p.min_stock} | ¥${p.unit_price} |\n`;
    });
    md += `\n`;
  }
  
  md += `## 完整库存清单\n\n`;
  md += `| 纸张名称 | 规格 | 总库存 | 已锁定 | 可用 | 安全库存 | 状态 |\n`;
  md += `|----------|------|--------|--------|------|----------|------|\n`;
  
  papers.forEach(p => {
    const status = p.needs_restock ? '🔴 缺货' : '🟢 充足';
    md += `| ${p.name} | ${p.size || '-'} ${p.weight || '-'}g | ${p.stock_qty} | ${p.locked_qty || 0} | ${p.available} | ${p.min_stock} | ${status} |\n`;
  });
  
  return md;
}

function toHTML_TodayProduction(orders) {
  let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>今日生产单</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 40px; }
    h1 { color: #333; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
    .meta { color: #666; margin-bottom: 20px; }
    .order-card { border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
    .order-header { background: #f5f5f5; padding: 10px 15px; border-radius: 4px; margin: -20px -20px 15px -20px; }
    .order-header h2 { margin: 0; color: #2c3e50; }
    .detail-row { display: flex; margin: 8px 0; }
    .detail-label { font-weight: bold; width: 100px; color: #666; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 14px; }
    .status-ready { background: #e8f5e9; color: #2e7d32; }
    .status-scheduled { background: #e3f2fd; color: #1565c0; }
    .status-locked { background: #fff3e0; color: #ef6c00; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; }
  </style>
</head>
<body>
  <h1>📋 今日生产单</h1>
  <div class="meta">生成时间: ${new Date().toLocaleString('zh-CN')}</div>
  <hr>
`;

  if (orders.length === 0) {
    html += `<p style="color: #666; font-size: 16px;">暂无今日生产单。</p>`;
  } else {
    orders.forEach((order, idx) => {
      const statusClass = order.status === 'ready' ? 'status-ready' : 
                          order.status === 'scheduled' ? 'status-scheduled' : 'status-locked';
      html += `
  <div class="order-card">
    <div class="order-header">
      <h2>${idx + 1}. 订单 ${order.order_no}</h2>
    </div>
    <div class="detail-row"><span class="detail-label">客户:</span> <span>${order.customer_name || '散客'}</span></div>
    <div class="detail-row"><span class="detail-label">产品:</span> <span>${order.product_type || '印刷品'} ${order.width}x${order.height}mm</span></div>
    <div class="detail-row"><span class="detail-label">数量:</span> <span>${order.quantity} 份</span></div>
    <div class="detail-row"><span class="detail-label">纸张:</span> <span>${order.paper_name || '-'}</span></div>
    <div class="detail-row"><span class="detail-label">用纸量:</span> <span>${order.paper_qty_est || '-'} 张</span></div>
    <div class="detail-row"><span class="detail-label">取件时间:</span> <span>${formatDateTime(order.pickup_time)}</span></div>
    <div class="detail-row">
      <span class="detail-label">状态:</span> 
      <span class="status-badge ${statusClass}">${order.status_name}</span>
    </div>
    ${order.notes ? `<div class="detail-row"><span class="detail-label">备注:</span> <span>${order.notes}</span></div>` : ''}
  </div>
`;
    });
  }

  html += `
  <div class="footer">
    <strong>总计:</strong> ${orders.length} 个订单
  </div>
</body>
</html>
`;
  return html;
}

function toCSV_TodayProduction(orders) {
  const headers = ['订单号', '客户', '产品类型', '尺寸(mm)', '数量', '纸张', '用纸量', '取件时间', '状态', '备注'];
  let csv = headers.join(',') + '\n';
  
  orders.forEach(order => {
    const row = [
      order.order_no,
      order.customer_name || '散客',
      order.product_type || '印刷品',
      `${order.width}x${order.height}`,
      order.quantity,
      order.paper_name || '-',
      order.paper_qty_est || '-',
      formatDateTime(order.pickup_time),
      order.status_name,
      order.notes || ''
    ];
    csv += row.map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(',') + '\n';
  });
  
  return csv;
}

function toCSV_PickupList(orders) {
  const headers = ['订单号', '客户', '电话', '产品', '数量', '取件时间', '状态'];
  let csv = headers.join(',') + '\n';
  
  orders.forEach(order => {
    const row = [
      order.order_no,
      order.customer_name || '-',
      order.customer_phone || '-',
      order.product_type || '印刷品',
      order.quantity,
      formatDate(order.pickup_time),
      order.status_name
    ];
    csv += row.map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(',') + '\n';
  });
  
  return csv;
}

function toCSV_RestockList(papers) {
  const headers = ['纸张名称', '规格', '克重', '总库存', '已锁定', '可用', '安全库存', '状态'];
  let csv = headers.join(',') + '\n';
  
  papers.forEach(p => {
    const status = p.needs_restock ? '缺货' : '充足';
    const row = [
      p.name,
      p.size || '-',
      p.weight || '-',
      p.stock_qty,
      p.locked_qty || 0,
      p.available,
      p.min_stock,
      status
    ];
    csv += row.map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(',') + '\n';
  });
  
  return csv;
}

module.exports = {
  getTodayProduction,
  getPickupList,
  getPaperRestockList,
  toMarkdown_TodayProduction,
  toMarkdown_PickupList,
  toMarkdown_RestockList,
  toHTML_TodayProduction,
  toCSV_TodayProduction,
  toCSV_PickupList,
  toCSV_RestockList
};

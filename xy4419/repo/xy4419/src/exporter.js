const fs = require('fs');
const path = require('path');
const { getDatabase } = require('./database');
const { getFullOrderInfo, getAllOrders, getUnresolvedAnomalies } = require('./service');

function formatDate(dateStr) {
  if (!dateStr) return '未知';
  return dateStr;
}

function formatStatus(status) {
  const statusMap = {
    'pending': '待处理',
    'in_progress': '维修中',
    'waiting_parts': '等待配件',
    'completed': '已完成',
    'cancelled': '已取消'
  };
  return statusMap[status] || status;
}

function formatAnomalyType(type) {
  const typeMap = {
    'shutter_abnormal': '快门次数异常',
    'accessory_missing': '配件未到货',
    'photo_missing': '照片缺失',
    'duplicate_repair': '重复送修'
  };
  return typeMap[type] || type;
}

function generateHandoverMarkdown(orderNo) {
  const info = getFullOrderInfo(orderNo);
  if (!info) {
    return null;
  }

  const { order, shutterTests, accessories, photos, anomalies } = info;

  let md = `# 维修交接单\n\n`;
  md += `## 基本信息\n\n`;
  md += `| 项目 | 内容 |\n|------|------|\n`;
  md += `| 订单号 | ${order.order_no} |\n`;
  md += `| 机身编号 | ${order.body_serial} |\n`;
  md += `| 相机型号 | ${order.camera_model || '未知'} |\n`;
  md += `| 客户姓名 | ${order.customer_name || '未知'} |\n`;
  md += `| 联系电话 | ${order.customer_phone || '未知'} |\n`;
  md += `| 接收日期 | ${formatDate(order.receive_date)} |\n`;
  md += `| 当前状态 | ${formatStatus(order.status)} |\n`;
  md += `| 预计费用 | ¥${order.estimated_cost || '待定'} |\n`;
  md += `| 客户已通知 | ${order.notified ? '是' : '否'} |\n\n`;

  md += `## 问题描述\n\n`;
  md += `${order.problem_description || '无详细描述'}\n\n`;

  if (shutterTests.length > 0) {
    md += `## 快门测试记录\n\n`;
    md += `| 测试编号 | 测试日期 | 快门次数 | 测试结果 |\n`;
    md += `|----------|----------|----------|----------|\n`;
    for (const test of shutterTests) {
      md += `| ${test.test_id} | ${formatDate(test.test_date)} | ${test.shutter_count || '未知'} | ${test.accuracy_result || '无'} |\n`;
    }
    md += `\n`;
  }

  if (accessories.length > 0) {
    md += `## 配件记录\n\n`;
    md += `| 配件编号 | 配件名称 | 型号 | 订购日期 | 到货日期 | 状态 |\n`;
    md += `|----------|----------|------|----------|----------|------|\n`;
    for (const acc of accessories) {
      const accStatus = acc.status === 'arrived' ? '已到货' : '未到货';
      md += `| ${acc.part_id} | ${acc.part_name} | ${acc.part_number || '-'} | ${formatDate(acc.ordered_date)} | ${formatDate(acc.arrived_date)} | ${accStatus} |\n`;
    }
    md += `\n`;
  }

  if (photos.length > 0) {
    md += `## 维修照片\n\n`;
    md += `| 照片类型 | 文件名 | 路径 |\n`;
    md += `|----------|--------|------|\n`;
    for (const photo of photos) {
      const photoTypeMap = {
        'before_repair': '维修前',
        'after_repair': '维修后',
        'test': '测试',
        'damage': '损坏',
        'unknown': '未知'
      };
      md += `| ${photoTypeMap[photo.photo_type] || photo.photo_type} | ${photo.file_name} | ${photo.file_path} |\n`;
    }
    md += `\n`;
  }

  if (anomalies.length > 0) {
    md += `## 异常提醒\n\n`;
    md += `| 异常类型 | 描述 |\n`;
    md += `|----------|------|\n`;
    for (const anomaly of anomalies) {
      md += `| ${formatAnomalyType(anomaly.anomaly_type)} | ${anomaly.description} |\n`;
    }
    md += `\n`;
  }

  md += `---\n\n`;
  md += `*交接单生成时间: ${new Date().toLocaleString('zh-CN')}*\n`;

  return md;
}

function generateAuditJSON() {
  const db = getDatabase();
  
  const orders = getAllOrders();
  const shutterTests = db.prepare(`SELECT * FROM shutter_tests ORDER BY test_date DESC`).all();
  const accessories = db.prepare(`SELECT * FROM accessories ORDER BY ordered_date DESC`).all();
  const photos = db.prepare(`SELECT * FROM repair_photos ORDER BY created_at DESC`).all();
  const anomalies = db.prepare(`SELECT * FROM anomalies ORDER BY created_at DESC`).all();
  
  const summary = {
    totalOrders: orders.length,
    byStatus: {
      pending: orders.filter(o => o.status === 'pending').length,
      in_progress: orders.filter(o => o.status === 'in_progress').length,
      waiting_parts: orders.filter(o => o.status === 'waiting_parts').length,
      completed: orders.filter(o => o.status === 'completed').length,
      cancelled: orders.filter(o => o.status === 'cancelled').length
    },
    totalShutterTests: shutterTests.length,
    totalAccessories: accessories.length,
    accessoriesByStatus: {
      ordered: accessories.filter(a => a.status === 'ordered').length,
      arrived: accessories.filter(a => a.status === 'arrived').length
    },
    totalPhotos: photos.length,
    unresolvedAnomalies: anomalies.filter(a => !a.resolved).length,
    customersNotified: orders.filter(o => o.notified).length
  };

  return {
    generatedAt: new Date().toISOString(),
    summary,
    data: {
      orders,
      shutterTests,
      accessories,
      photos,
      anomalies
    }
  };
}

function exportHandoverMarkdown(orderNo, outputPath) {
  const markdown = generateHandoverMarkdown(orderNo);
  if (!markdown) {
    return { success: false, error: `订单 ${orderNo} 不存在` };
  }

  try {
    const filePath = path.resolve(outputPath, `交接单_${orderNo}_${Date.now()}.md`);
    fs.writeFileSync(filePath, markdown, 'utf-8');
    return { success: true, filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function exportAuditJSON(outputPath) {
  const auditData = generateAuditJSON();
  
  try {
    const filePath = path.resolve(outputPath, `审计包_${Date.now()}.json`);
    fs.writeFileSync(filePath, JSON.stringify(auditData, null, 2), 'utf-8');
    return { success: true, filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = {
  generateHandoverMarkdown,
  generateAuditJSON,
  exportHandoverMarkdown,
  exportAuditJSON
};

const db = require('../models/database');
const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { assignMaintenanceTable } = require('./processingService');

const exportReport = async (batchId, format = 'csv') => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        d.id,
        d.building_name,
        d.address,
        d.contact_person,
        d.contact_phone,
        d.extinguisher_date,
        d.sprinkler_date,
        d.alarm_date,
        d.category,
        d.category_reason,
        d.processor,
        d.processed_at,
        d.created_at
      FROM details d
      WHERE d.batch_id = ?
      ORDER BY d.created_at DESC
    `;

    db.all(sql, [batchId], async (err, rows) => {
      if (err) return reject(err);

      for (const row of rows) {
        const tables = await assignMaintenanceTable(row.id);
        row.extinguisher_table = tables.extinguisher || '灭火器维保表A';
        row.sprinkler_table = tables.sprinkler || '喷淋维保表A';
        row.alarm_table = tables.alarm || '报警主机维保表A';
        
        const categoryMap = {
          'normal': '正常',
          'pending_supplement': '待补充',
          'blocked': '已拦截'
        };
        row.category_cn = categoryMap[row.category] || row.category;
        
        const actionMap = {
          'normal': '正常处理-生成提醒通知',
          'pending_supplement': '发送补充信息请求',
          'blocked': '拦截-标记为无效数据'
        };
        row.follow_up_action = actionMap[row.category] || '';
      }

      const filename = `report-${batchId}-${Date.now()}.${format}`;
      const filePath = path.join(__dirname, '../../exports', filename);

      if (format === 'csv') {
        const fields = [
          'building_name', 'address', 'contact_person', 'contact_phone',
          'extinguisher_date', 'extinguisher_table',
          'sprinkler_date', 'sprinkler_table',
          'alarm_date', 'alarm_table',
          'category_cn', 'category_reason',
          'follow_up_action',
          'processor', 'processed_at'
        ];
        const fieldNames = [
          '楼宇名称', '地址', '联系人', '联系电话',
          '灭火器维保日期', '灭火器维保表',
          '喷淋维保日期', '喷淋维保表',
          '报警主机维保日期', '报警主机维保表',
          '分类', '分类原因',
          '后续处理动作',
          '处理人', '处理时间'
        ];
        
        const json2csvParser = new Parser({ fields, fieldNames });
        const csv = json2csvParser.parse(rows);
        fs.writeFileSync(filePath, csv);
      } else {
        fs.writeFileSync(filePath, JSON.stringify(rows, null, 2));
      }

      resolve({
        filename,
        filePath,
        count: rows.length,
        statistics: getStatistics(rows)
      });
    });
  });
};

const getStatistics = (rows) => {
  const stats = {
    total: rows.length,
    normal: 0,
    pending_supplement: 0,
    blocked: 0
  };
  
  rows.forEach(r => {
    if (r.category === 'normal') stats.normal++;
    else if (r.category === 'pending_supplement') stats.pending_supplement++;
    else if (r.category === 'blocked') stats.blocked++;
  });
  
  return stats;
};

module.exports = {
  exportReport
};

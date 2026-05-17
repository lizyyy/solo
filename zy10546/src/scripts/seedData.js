const db = require('../config/database');

function generateBatchNo() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `INS-${year}${month}-${random}`;
}

function generateItemNo(batchId) {
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ITEM-${batchId}-${random}`;
}

function generateReportNo(batchId) {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `RPT-${year}${month}-B${batchId}`;
}

db.serialize(() => {
  const batchNo = generateBatchNo();
  
  db.run(
    `INSERT INTO inspection_batches (batch_no, batch_name, inspection_type, start_date, status, inspector)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [batchNo, '2026年Q2安全例行巡检', 'routine', '2026-05-01', 'in_progress', '张三'],
    function(err) {
      if (err) {
        console.error('创建批次失败:', err);
        return;
      }
      const batchId = this.lastID;
      console.log('创建批次成功，批次ID:', batchId);

      const items = [
        { content: '服务器密码复杂度不符合要求', riskLevel: 2, rectifier: '李四', deadline: '2026-05-20' },
        { content: 'Web应用存在SQL注入漏洞', riskLevel: 4, rectifier: '王五', deadline: '2026-05-15' },
        { content: '防火墙规则配置不当', riskLevel: 3, rectifier: '赵六', deadline: '2026-05-25' },
        { content: '员工安全意识培训记录不完整', riskLevel: 1, rectifier: '钱七', deadline: '2026-05-30' },
        { content: '敏感数据传输未加密', riskLevel: 4, rectifier: '孙八', deadline: '2026-05-18' }
      ];

      const itemStmt = db.prepare(
        `INSERT INTO inspection_items (item_no, batch_id, check_content, risk_level_id, current_status, rectifier, rectify_deadline, source_type, raw_input)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      items.forEach((item, index) => {
        const itemNo = generateItemNo(batchId);
        const status = index === 0 ? 'rectified' : (index === 1 ? 'in_rectification' : 'pending');
        const rawInput = JSON.stringify({ source: 'screenshot', file: `check-${index + 1}.png`, detected: new Date().toISOString() });
        
        itemStmt.run(itemNo, batchId, item.content, item.riskLevel, status, item.rectifier, item.deadline, 'screenshot', rawInput, function(err) {
          if (err) {
            console.error('创建检查项失败:', err);
          } else {
            const itemId = this.lastID;
            console.log(`创建检查项成功，项ID: ${itemId}, 状态: ${status}`);

            if (status === 'rectified') {
              db.run(
                `INSERT INTO rectification_records (item_id, rectify_content, rectifier, rectify_date, evidences)
                 VALUES (?, ?, ?, ?, ?)`,
                [itemId, '已修改密码策略，强制16位以上复杂密码', '李四', '2026-05-10', '[{"type":"screenshot","url":"/evidences/pwd-policy.png"}]']
              );

              db.run(
                `INSERT INTO review_records (item_id, reviewer, review_date, review_conclusion, review_opinion)
                 VALUES (?, ?, ?, ?, ?)`,
                [itemId, '张三', '2026-05-12', 'passed', '整改到位，验证通过']
              );

              db.run(
                `UPDATE inspection_items SET current_status = 'closed' WHERE id = ?`,
                [itemId]
              );

              db.run(
                `INSERT INTO status_history (item_id, from_status, to_status, operator, reason)
                 VALUES (?, ?, ?, ?, ?)`,
                [itemId, 'rectified', 'closed', '张三', '复查通过，问题已关闭']
              );
            }

            if (status === 'in_rectification') {
              db.run(
                `INSERT INTO status_history (item_id, from_status, to_status, operator, reason)
                 VALUES (?, ?, ?, ?, ?)`,
                [itemId, 'pending', 'in_rectification', '王五', '已开始整改工作']
              );
            }
          }
        });
      });

      itemStmt.finalize();

      const reportNo = generateReportNo(batchId);
      const reportData = JSON.stringify({
        totalItems: 5,
        closedItems: 1,
        inProgressItems: 1,
        pendingItems: 3,
        riskDistribution: { critical: 2, high: 1, medium: 1, low: 1 }
      });

      db.run(
        `INSERT INTO inspection_reports (report_no, batch_id, report_type, generated_by, content_summary, report_data)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [reportNo, batchId, 'summary', '系统', '2026年Q2安全巡检中期报告', reportData],
        function(err) {
          if (err) {
            console.error('创建报告失败:', err);
          } else {
            console.log('创建巡检报告成功，报告ID:', this.lastID);
          }
        }
      );
    }
  );

  setTimeout(() => {
    console.log('示例数据初始化完成');
    db.close();
  }, 2000);
});

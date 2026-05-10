const express = require('express');
const router = express.Router();
const db = require('./database');
const { Parser } = require('json2csv');

function generateRecallNo() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const existing = db.queryAll(
    'SELECT COUNT(*) as count FROM recalls WHERE strftime("%Y%m%d", created_at) = ?',
    [dateStr]
  );
  const count = (existing[0]?.count || 0) + 1;
  return `R${dateStr}${String(count).padStart(4, '0')}`;
}

router.get('/members', (req, res) => {
  const members = db.queryAll('SELECT * FROM members ORDER BY created_at DESC');
  res.json({ success: true, data: members });
});

router.get('/inventory', (req, res) => {
  const inventory = db.queryAll('SELECT * FROM inventory ORDER BY created_at DESC');
  res.json({ success: true, data: inventory });
});

router.get('/sales', (req, res) => {
  const sales = db.queryAll(`
    SELECT s.*, m.name as member_name, m.phone, i.product_name, i.brand, i.specification
    FROM sales s
    LEFT JOIN members m ON s.member_id = m.id
    LEFT JOIN inventory i ON s.batch_no = i.batch_no
    ORDER BY s.sale_date DESC
  `);
  res.json({ success: true, data: sales });
});

router.post('/recalls', (req, res) => {
  const { batch_no, reason } = req.body;

  if (!batch_no) {
    return res.status(400).json({ success: false, message: '请输入召回批号' });
  }

  const inventory = db.queryOne('SELECT * FROM inventory WHERE batch_no = ?', [batch_no]);
  if (!inventory) {
    return res.status(404).json({ success: false, message: '该批号不存在' });
  }

  const existingRecall = db.queryOne(
    'SELECT * FROM recalls WHERE batch_no = ? AND status = "active"',
    [batch_no]
  );
  if (existingRecall) {
    return res.status(400).json({ success: false, message: '该批号已有进行中的召回' });
  }

  try {
    db.beginTransaction();
    
    const recall_no = generateRecallNo();
    const now = db.formatDate();
    
    const recallResult = db.runSql(
      'INSERT INTO recalls (recall_no, batch_no, reason, status, created_at) VALUES (?, ?, ?, "active", ?)',
      [recall_no, batch_no, reason || null, now]
    );

    db.runSql(
      'UPDATE inventory SET is_locked = 1, lock_reason = ? WHERE batch_no = ?',
      [`召回锁定: ${reason || '批号召回'}`, batch_no]
    );

    const affectedSales = db.queryAll(`
      SELECT s.*, m.id as member_id, m.name as member_name, m.phone, i.product_name
      FROM sales s
      LEFT JOIN members m ON s.member_id = m.id
      LEFT JOIN inventory i ON s.batch_no = i.batch_no
      WHERE s.batch_no = ?
    `, [batch_no]);

    const recallId = recallResult.lastInsertRowid;
    
    affectedSales.forEach(sale => {
      const isException = !sale.phone;
      const exceptionReason = isException ? '会员联系方式缺失' : null;
      
      db.runSql(`
        INSERT INTO recall_affected 
        (recall_id, sale_id, member_id, member_name, phone, batch_no, product_name, quantity, sale_date, is_exception, exception_reason, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        recallId,
        sale.id,
        sale.member_id,
        sale.member_name,
        sale.phone,
        sale.batch_no,
        sale.product_name,
        sale.quantity,
        sale.sale_date,
        isException ? 1 : 0,
        exceptionReason,
        now
      ]);
    });

    db.commit();

    res.json({ 
      success: true, 
      data: {
        recall_id: recallId,
        recall_no,
        affected_count: affectedSales.length
      }, 
      message: `召回事务已创建，影响${affectedSales.length}条销售记录` 
    });
  } catch (error) {
    db.rollback();
    console.error(error);
    res.status(500).json({ success: false, message: '创建召回失败: ' + error.message });
  }
});

router.get('/recalls', (req, res) => {
  const recalls = db.queryAll(`
    SELECT r.*, i.product_name, i.brand,
      (SELECT COUNT(*) FROM recall_affected WHERE recall_id = r.id) as total_affected,
      (SELECT COUNT(*) FROM recall_affected WHERE recall_id = r.id AND notify_status = 'notified') as notified_count,
      (SELECT COUNT(*) FROM recall_affected WHERE recall_id = r.id AND handle_status = 'completed') as completed_count
    FROM recalls r
    LEFT JOIN inventory i ON r.batch_no = i.batch_no
    ORDER BY r.created_at DESC
  `);
  res.json({ success: true, data: recalls });
});

router.get('/recalls/:id', (req, res) => {
  const { id } = req.params;
  const recall = db.queryOne(`
    SELECT r.*, i.product_name, i.brand, i.quantity as inventory_quantity, i.is_locked
    FROM recalls r
    LEFT JOIN inventory i ON r.batch_no = i.batch_no
    WHERE r.id = ?
  `, [id]);

  if (!recall) {
    return res.status(404).json({ success: false, message: '召回不存在' });
  }

  const affected = db.queryAll(`
    SELECT ra.*
    FROM recall_affected ra
    WHERE ra.recall_id = ?
    ORDER BY ra.created_at DESC
  `, [id]);

  res.json({ success: true, data: { recall, affected } });
});

router.post('/recalls/:id/affected/:affectedId/notify', (req, res) => {
  const { affectedId } = req.params;
  const affected = db.queryOne('SELECT * FROM recall_affected WHERE id = ?', [affectedId]);

  if (!affected) {
    return res.status(404).json({ success: false, message: '记录不存在' });
  }

  if (affected.notify_status === 'notified') {
    return res.status(400).json({ success: false, message: '该会员已通知过了' });
  }

  db.runSql('UPDATE recall_affected SET notify_status = "notified" WHERE id = ?', [affectedId]);
  res.json({ success: true, message: '标记已通知成功' });
});

router.post('/recalls/:id/affected/:affectedId/handle', (req, res) => {
  const { affectedId } = req.params;
  const { handle_type, remark, operator } = req.body;

  const validTypes = ['return', 'exchange', 'unreachable'];
  if (!validTypes.includes(handle_type)) {
    return res.status(400).json({ success: false, message: '无效的处理类型' });
  }

  const affected = db.queryOne('SELECT * FROM recall_affected WHERE id = ?', [affectedId]);
  if (!affected) {
    return res.status(404).json({ success: false, message: '记录不存在' });
  }

  if (affected.handle_status === 'completed') {
    return res.status(400).json({
      success: false,
      message: `该销售记录已处理过（${getHandleTypeText(affected.handle_type)}），不允许重复操作`,
      code: 'DUPLICATE_HANDLE'
    });
  }

  if (affected.is_exception && handle_type !== 'unreachable') {
    return res.status(400).json({
      success: false,
      message: '该会员联系方式缺失，只能标记为无法联系',
      code: 'CONTACT_MISSING'
    });
  }

  try {
    db.beginTransaction();
    const now = db.formatDate();
    
    db.runSql(`
      UPDATE recall_affected 
      SET handle_type = ?, handle_status = 'completed', handle_time = ?, remark = ?, notify_status = 'notified'
      WHERE id = ?
    `, [handle_type, now, remark || null, affectedId]);

    db.runSql(`
      INSERT INTO handle_records (recall_affected_id, handle_type, operator, created_at)
      VALUES (?, ?, ?, ?)
    `, [affectedId, handle_type, operator || '系统管理员', now]);
    
    db.commit();
    res.json({ success: true, message: `处理成功：${getHandleTypeText(handle_type)}` });
  } catch (error) {
    db.rollback();
    console.error(error);
    res.status(500).json({ success: false, message: '处理失败: ' + error.message });
  }
});

function getHandleTypeText(type) {
  const map = {
    'return': '已退货',
    'exchange': '已换货',
    'unreachable': '无法联系'
  };
  return map[type] || type;
}

router.get('/recalls/:id/stats', (req, res) => {
  const { id } = req.params;
  const recall = db.queryOne('SELECT * FROM recalls WHERE id = ?', [id]);
  
  if (!recall) {
    return res.status(404).json({ success: false, message: '召回不存在' });
  }

  const affected = db.queryAll('SELECT * FROM recall_affected WHERE recall_id = ?', [id]);

  const stats = {
    total: affected.length,
    notified: affected.filter(a => a.notify_status === 'notified').length,
    pending_notify: affected.filter(a => a.notify_status === 'pending').length,
    completed: affected.filter(a => a.handle_status === 'completed').length,
    pending_handle: affected.filter(a => a.handle_status === 'pending').length,
    returned: affected.filter(a => a.handle_type === 'return').length,
    exchanged: affected.filter(a => a.handle_type === 'exchange').length,
    unreachable: affected.filter(a => a.handle_type === 'unreachable').length,
    exceptions: affected.filter(a => a.is_exception === 1).length
  };

  res.json({ success: true, data: stats });
});

router.get('/recalls/:id/export', (req, res) => {
  const { id } = req.params;
  const recall = db.queryOne(`
    SELECT r.*, i.product_name, i.brand
    FROM recalls r
    LEFT JOIN inventory i ON r.batch_no = i.batch_no
    WHERE r.id = ?
  `, [id]);

  if (!recall) {
    return res.status(404).json({ success: false, message: '召回不存在' });
  }

  const affectedRaw = db.queryAll(`
    SELECT 
      member_name,
      phone,
      batch_no,
      product_name,
      quantity,
      sale_date,
      notify_status,
      handle_status,
      handle_type,
      handle_time,
      is_exception,
      exception_reason,
      remark
    FROM recall_affected WHERE recall_id = ?
  `, [id]);
  
  const affected = affectedRaw.map(item => ({
    '会员姓名': item.member_name,
    '联系电话': item.phone || '',
    '召回批号': item.batch_no,
    '产品名称': item.product_name,
    '购买数量': item.quantity,
    '购买日期': item.sale_date,
    '通知状态': item.notify_status === 'notified' ? '已通知' : '待通知',
    '处理状态': item.handle_status === 'completed' ? '已处理' : '待处理',
    '处理类型': item.handle_type === 'return' ? '已退货' : 
                item.handle_type === 'exchange' ? '已换货' :
                item.handle_type === 'unreachable' ? '无法联系' : '',
    '处理时间': item.handle_time || '',
    '是否异常': item.is_exception === 1 ? '是' : '否',
    '异常原因': item.exception_reason || '',
    '备注': item.remark || ''
  }));

  const fields = [
    '会员姓名', '联系电话', '召回批号', '产品名称', '购买数量',
    '购买日期', '通知状态', '处理状态', '处理类型', '处理时间',
    '是否异常', '异常原因', '备注'
  ];

  const parser = new Parser({ fields });
  const csv = parser.parse(affected);

  const bom = '\uFEFF';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=召回报告_${recall.recall_no}.csv`);
  res.send(bom + csv);
});

router.get('/dashboard', (req, res) => {
  const members = db.queryOne('SELECT COUNT(*) as count FROM members');
  const inventory = db.queryOne('SELECT COUNT(*) as count FROM inventory');
  const sales = db.queryOne('SELECT COUNT(*) as count FROM sales');
  const activeRecalls = db.queryOne('SELECT COUNT(*) as count FROM recalls WHERE status = "active"');
  const lockedInventory = db.queryOne('SELECT COUNT(*) as count FROM inventory WHERE is_locked = 1');
  
  const data = {
    members: members.count,
    inventory: inventory.count,
    sales: sales.count,
    active_recalls: activeRecalls.count,
    locked_inventory: lockedInventory.count
  };
  res.json({ success: true, data });
});

module.exports = router;

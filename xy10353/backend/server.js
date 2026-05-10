const express = require('express');
const cors = require('cors');
const multer = require('multer');
const ExcelJS = require('exceljs');
const dayjs = require('dayjs');
const fs = require('fs');
const { initDB, run, get, all, createSampleData, db } = require('./db');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());

const KEY_QUALITY_ITEMS = ['appearance', 'accessories', 'packaging', 'function_test'];
const DISPOSITION_TYPES = ['resell', 'repair', 'scrap', 'reject'];

async function ensureInventory(sku, productName) {
  const existing = await get('SELECT * FROM inventory WHERE sku = ?', [sku]);
  if (!existing) {
    await run('INSERT INTO inventory (sku, product_name) VALUES (?, ?)', [sku, productName]);
  }
}

async function updateInventory(order, disposition) {
  await ensureInventory(order.product_sku, order.product_name);
  const inv = await get('SELECT * FROM inventory WHERE sku = ?', [order.product_sku]);
  
  const updates = { good_quantity: 0, repair_quantity: 0, scrap_quantity: 0 };
  switch (disposition) {
    case 'resell': updates.good_quantity = 1; break;
    case 'repair': updates.repair_quantity = 1; break;
    case 'scrap': updates.scrap_quantity = 1; break;
  }
  
  const newGood = inv.good_quantity + updates.good_quantity;
  const newRepair = inv.repair_quantity + updates.repair_quantity;
  const newScrap = inv.scrap_quantity + updates.scrap_quantity;
  const newTotal = newGood + newRepair + newScrap;
  
  await run(`
    UPDATE inventory 
    SET good_quantity = ?, repair_quantity = ?, scrap_quantity = ?, total_quantity = ?, updated_at = CURRENT_TIMESTAMP
    WHERE sku = ?
  `, [newGood, newRepair, newScrap, newTotal, order.product_sku]);
  
  await run(`
    INSERT INTO inventory_logs (return_order_id, sku, change_type, from_status, to_status, quantity, reason)
    VALUES (?, ?, 'INBOUND', 'RETURNED', ?, 1, ?)
  `, [order.id, order.product_sku, disposition.toUpperCase(), `Quality disposition: ${disposition}`]);
}

function validateQualityCheck(data) {
  const missing = [];
  for (const item of KEY_QUALITY_ITEMS) {
    if (!data[item]) {
      missing.push(item);
    }
  }
  return missing;
}

app.get('/api/orders', async (req, res) => {
  try {
    const { status, keyword } = req.query;
    let sql = `SELECT o.*, 
      CASE 
        WHEN o.disposition IS NOT NULL THEN o.disposition
        ELSE NULL 
      END as disposition
      FROM return_orders o WHERE 1=1`;
    const params = [];
    
    if (status) {
      sql += ' AND o.status = ?';
      params.push(status);
    }
    if (keyword) {
      sql += ' AND (o.platform_order_no LIKE ? OR o.product_name LIKE ? OR o.customer_name LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }
    sql += ' ORDER BY o.created_at DESC';
    
    const orders = await all(sql, params);
    res.json({ success: true, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/orders/:id', async (req, res) => {
  try {
    const order = await get('SELECT * FROM return_orders WHERE id = ?', [req.params.id]);
    if (!order) {
      return res.status(404).json({ success: false, error: '退货单不存在' });
    }
    const quality = await get('SELECT * FROM quality_checks WHERE return_order_id = ? ORDER BY id DESC', [req.params.id]);
    const logs = await all('SELECT * FROM inventory_logs WHERE return_order_id = ? ORDER BY created_at DESC', [req.params.id]);
    res.json({ success: true, data: { order, quality, logs } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const { platform_order_no, product_name, product_sku, return_reason, customer_name, customer_phone } = req.body;
    
    if (!platform_order_no || !product_name || !product_sku) {
      return res.status(400).json({ success: false, error: '平台单号、商品名称、SKU 为必填项' });
    }
    
    const existing = await get('SELECT * FROM return_orders WHERE platform_order_no = ?', [platform_order_no]);
    if (existing) {
      return res.status(400).json({ success: false, error: '平台单号已存在，重复退货单被拦截', duplicate: true });
    }
    
    const result = await run(`
      INSERT INTO return_orders (platform_order_no, product_name, product_sku, return_reason, customer_name, customer_phone)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [platform_order_no, product_name, product_sku, return_reason, customer_name, customer_phone]);
    
    res.json({ success: true, data: { id: result.lastID } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/orders/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '请上传 Excel 文件' });
    }
    
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(req.file.path);
    const worksheet = workbook.worksheets[0];
    const rows = [];
    const errors = [];
    
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      rows.push(row.values);
    });
    
    let imported = 0;
    
    for (let i = 0; i < rows.length; i++) {
      const [, platform_order_no, product_name, product_sku, return_reason, customer_name, customer_phone] = rows[i];
      if (!platform_order_no) {
        errors.push(`第 ${i + 2} 行：平台单号为空`);
        continue;
      }
      const existing = await get('SELECT * FROM return_orders WHERE platform_order_no = ?', [platform_order_no]);
      if (existing) {
        errors.push(`第 ${i + 2} 行：平台单号 ${platform_order_no} 已存在`);
        continue;
      }
      if (!product_name || !product_sku) {
        errors.push(`第 ${i + 2} 行：商品信息不完整`);
        continue;
      }
      await run(`
        INSERT INTO return_orders (platform_order_no, product_name, product_sku, return_reason, customer_name, customer_phone)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [platform_order_no, product_name, product_sku, return_reason, customer_name, customer_phone]);
      imported++;
    }
    
    fs.unlinkSync(req.file.path);
    res.json({ success: true, data: { imported, errors } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/orders/:id/quality', async (req, res) => {
  try {
    const order = await get('SELECT * FROM return_orders WHERE id = ?', [req.params.id]);
    if (!order) {
      return res.status(404).json({ success: false, error: '退货单不存在' });
    }
    
    if (order.disposition) {
      return res.status(400).json({ success: false, error: '该退货单已处置，无法修改质检记录' });
    }
    
    const missing = validateQualityCheck(req.body);
    if (missing.length > 0) {
      const labelMap = {
        appearance: '外观检查',
        accessories: '配件检查',
        packaging: '包装检查',
        function_test: '功能测试'
      };
      const missingLabels = missing.map(m => labelMap[m] || m).join('、');
      return res.status(400).json({ 
        success: false, 
        error: `缺少关键质检项：${missingLabels}`,
        missingItems: missing
      });
    }
    
    const { appearance, appearance_notes, accessories, accessories_notes, packaging, packaging_notes, function_test, function_test_notes, overall_result, inspector } = req.body;
    
    const existingQuality = await get('SELECT * FROM quality_checks WHERE return_order_id = ?', [req.params.id]);
    if (existingQuality) {
      await run(`
        UPDATE quality_checks SET
          appearance = ?, appearance_notes = ?,
          accessories = ?, accessories_notes = ?,
          packaging = ?, packaging_notes = ?,
          function_test = ?, function_test_notes = ?,
          overall_result = ?, inspector = ?,
          checked_at = CURRENT_TIMESTAMP
        WHERE return_order_id = ?
      `, [appearance, appearance_notes, accessories, accessories_notes, packaging, packaging_notes, function_test, function_test_notes, overall_result, inspector, req.params.id]);
    } else {
      await run(`
        INSERT INTO quality_checks (
          return_order_id, appearance, appearance_notes, accessories, accessories_notes,
          packaging, packaging_notes, function_test, function_test_notes, overall_result, inspector
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [req.params.id, appearance, appearance_notes, accessories, accessories_notes, packaging, packaging_notes, function_test, function_test_notes, overall_result, inspector]);
    }
    
    await run("UPDATE return_orders SET status = 'quality_done' WHERE id = ?", [req.params.id]);
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/orders/:id/dispose', async (req, res) => {
  try {
    const { disposition, notes } = req.body;
    
    if (!DISPOSITION_TYPES.includes(disposition)) {
      return res.status(400).json({ success: false, error: '无效的处置方式' });
    }
    
    const order = await get('SELECT * FROM return_orders WHERE id = ?', [req.params.id]);
    if (!order) {
      return res.status(404).json({ success: false, error: '退货单不存在' });
    }
    
    if (order.status === 'pending') {
      return res.status(400).json({ success: false, error: '请先完成质检再处置' });
    }
    
    if (order.disposition) {
      if (order.disposition === 'reject' && disposition !== 'reject') {
        return res.status(400).json({ success: false, error: '该退货单已拒收，禁止重新入库' });
      }
      return res.status(400).json({ success: false, error: '同一退货单禁止重复处置/入库', alreadyDisposed: true });
    }
    
    if (disposition !== 'reject') {
      await updateInventory(order, disposition);
    }
    
    await run(`
      UPDATE return_orders SET 
        disposition = ?, 
        status = 'disposed',
        disposed_at = CURRENT_TIMESTAMP,
        notes = ?
      WHERE id = ?
    `, [disposition, notes, req.params.id]);
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/inventory', async (req, res) => {
  try {
    const data = await all('SELECT * FROM inventory ORDER BY updated_at DESC');
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const stats = {};
    
    const r1 = await get("SELECT COUNT(*) as count FROM return_orders");
    stats.totalOrders = r1.count;
    
    const r2 = await get("SELECT COUNT(*) as count FROM return_orders WHERE status = 'pending'");
    stats.pendingOrders = r2.count;
    
    const r3 = await get("SELECT COUNT(*) as count FROM return_orders WHERE status = 'quality_done'");
    stats.qualityDoneOrders = r3.count;
    
    const r4 = await get("SELECT COUNT(*) as count FROM return_orders WHERE status = 'disposed'");
    stats.disposedOrders = r4.count;
    
    const r5 = await get("SELECT COUNT(*) as count FROM return_orders WHERE disposition = 'resell'");
    stats.resellCount = r5.count;
    
    const r6 = await get("SELECT COUNT(*) as count FROM return_orders WHERE disposition = 'repair'");
    stats.repairCount = r6.count;
    
    const r7 = await get("SELECT COUNT(*) as count FROM return_orders WHERE disposition = 'scrap'");
    stats.scrapCount = r7.count;
    
    const r8 = await get("SELECT COUNT(*) as count FROM return_orders WHERE disposition = 'reject'");
    stats.rejectCount = r8.count;
    
    const invSummary = await get(`
      SELECT 
        COALESCE(SUM(good_quantity), 0) as total_good,
        COALESCE(SUM(repair_quantity), 0) as total_repair,
        COALESCE(SUM(scrap_quantity), 0) as total_scrap,
        COALESCE(SUM(total_quantity), 0) as total_inventory
      FROM inventory
    `);
    stats.inventory = invSummary;
    
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/export/orders', async (req, res) => {
  try {
    const orders = await all(`
      SELECT o.*, 
        q.appearance, q.appearance_notes, q.accessories, q.accessories_notes,
        q.packaging, q.packaging_notes, q.function_test, q.function_test_notes,
        q.overall_result, q.inspector
      FROM return_orders o
      LEFT JOIN quality_checks q ON o.id = q.return_order_id
      ORDER BY o.created_at DESC
    `);
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('退货单列表');
    
    worksheet.columns = [
      { header: '平台单号', key: 'platform_order_no', width: 20 },
      { header: '商品名称', key: 'product_name', width: 25 },
      { header: 'SKU', key: 'product_sku', width: 15 },
      { header: '退货原因', key: 'return_reason', width: 20 },
      { header: '客户姓名', key: 'customer_name', width: 12 },
      { header: '联系电话', key: 'customer_phone', width: 15 },
      { header: '外观检查', key: 'appearance', width: 12 },
      { header: '配件检查', key: 'accessories', width: 12 },
      { header: '包装检查', key: 'packaging', width: 12 },
      { header: '功能测试', key: 'function_test', width: 12 },
      { header: '整体结果', key: 'overall_result', width: 12 },
      { header: '质检员', key: 'inspector', width: 12 },
      { header: '处置方式', key: 'disposition', width: 12 },
      { header: '状态', key: 'status', width: 12 },
      { header: '创建时间', key: 'created_at', width: 20 },
    ];
    
    const statusMap = {
      pending: '待检',
      quality_done: '质检完成',
      disposed: '已处置'
    };
    const dispositionMap = {
      resell: '入库二次销售',
      repair: '维修',
      scrap: '报废',
      reject: '拒收'
    };
    
    orders.forEach(o => {
      worksheet.addRow({
        ...o,
        status: statusMap[o.status] || o.status,
        disposition: dispositionMap[o.disposition] || o.disposition
      });
    });
    
    const statsSheet = workbook.addWorksheet('统计汇总');
    
    const total = await get('SELECT COUNT(*) as c FROM return_orders');
    const pending = await get("SELECT COUNT(*) as c FROM return_orders WHERE status = 'pending'");
    const resell = await get("SELECT COUNT(*) as c FROM return_orders WHERE disposition = 'resell'");
    const repair = await get("SELECT COUNT(*) as c FROM return_orders WHERE disposition = 'repair'");
    const scrap = await get("SELECT COUNT(*) as c FROM return_orders WHERE disposition = 'scrap'");
    const reject = await get("SELECT COUNT(*) as c FROM return_orders WHERE disposition = 'reject'");
    
    statsSheet.addRow(['退货单总数', total.c]);
    statsSheet.addRow(['待检数量', pending.c]);
    statsSheet.addRow(['入库二次销售', resell.c]);
    statsSheet.addRow(['待维修', repair.c]);
    statsSheet.addRow(['报废', scrap.c]);
    statsSheet.addRow(['拒收', reject.c]);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=退货单_${dayjs().format('YYYYMMDD')}.xlsx`);
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

async function startServer() {
  try {
    await initDB();
    await createSampleData();
    
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`退货质检台服务运行在 http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('启动失败:', err);
  }
}

startServer();

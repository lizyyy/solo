const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;
const DB_PATH = './inventory.db';

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

let db;

async function initDatabase() {
  const SQL = await initSqlJs();
  
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log('已加载现有数据库');
  } else {
    db = new SQL.Database();
    console.log('创建新数据库');
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS inventory_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT NOT NULL UNIQUE,
      product_name TEXT NOT NULL,
      location TEXT,
      expected_qty INTEGER DEFAULT 0,
      actual_qty INTEGER DEFAULT 0,
      unit TEXT DEFAULT '个',
      operator TEXT,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      version INTEGER DEFAULT 1
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sync_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      sku TEXT,
      local_qty INTEGER,
      server_qty INTEGER,
      result TEXT NOT NULL,
      operator TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  saveDatabase();
}

function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function queryOne(sql, params = []) {
  const result = db.exec(sql, params);
  if (result.length === 0 || result[0].values.length === 0) {
    return null;
  }
  const columns = result[0].columns;
  const values = result[0].values[0];
  const row = {};
  columns.forEach((col, i) => {
    row[col] = values[i];
  });
  return row;
}

function queryAll(sql, params = []) {
  const result = db.exec(sql, params);
  if (result.length === 0) {
    return [];
  }
  const columns = result[0].columns;
  return result[0].values.map(values => {
    const row = {};
    columns.forEach((col, i) => {
      row[col] = values[i];
    });
    return row;
  });
}

function runSql(sql, params = []) {
  db.run(sql, params);
  saveDatabase();
  return {
    changes: db.getRowsModified()
  };
}

function getCurrentTimestamp() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

app.get('/api/inventory', (req, res) => {
  try {
    const records = queryAll('SELECT * FROM inventory_records ORDER BY updated_at DESC');
    res.json({ success: true, data: records });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/inventory/:sku', (req, res) => {
  try {
    const record = queryOne('SELECT * FROM inventory_records WHERE sku = ?', [req.params.sku]);
    if (!record) {
      return res.status(404).json({ success: false, error: '记录不存在' });
    }
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/sync/batch', (req, res) => {
  const { records, operator } = req.body;
  const results = [];
  const conflicts = [];
  const now = getCurrentTimestamp();

  for (const record of records) {
    const { sku, product_name, location, expected_qty, actual_qty, unit, remark, clientVersion } = record;
    
    const existing = queryOne('SELECT * FROM inventory_records WHERE sku = ?', [sku]);

    if (!existing) {
      try {
        runSql(`
          INSERT INTO inventory_records 
          (sku, product_name, location, expected_qty, actual_qty, unit, operator, remark, version, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        `, [sku, product_name, location, expected_qty, actual_qty, unit, operator || 'system', remark, now, now]);
        
        results.push({ sku, status: 'success', action: 'created' });
        
        runSql(`
          INSERT INTO sync_logs (action, sku, local_qty, server_qty, result, operator, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, ['create', sku, actual_qty, null, 'success', operator || 'system', now]);
      } catch (error) {
        results.push({ sku, status: 'error', error: error.message });
        
        runSql(`
          INSERT INTO sync_logs (action, sku, local_qty, server_qty, result, operator, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, ['create', sku, actual_qty, null, 'error: ' + error.message, operator || 'system', now]);
      }
    } else {
      if (clientVersion && existing.version !== clientVersion) {
        conflicts.push({
          sku,
          local: { actual_qty, expected_qty, product_name, location, remark, version: clientVersion },
          server: { actual_qty: existing.actual_qty, expected_qty: existing.expected_qty, product_name: existing.product_name, location: existing.location, remark: existing.remark, version: existing.version },
          diff: {
            actual_qty: { local: actual_qty, server: existing.actual_qty },
            expected_qty: { local: expected_qty, server: existing.expected_qty },
            product_name: { local: product_name, server: existing.product_name },
            location: { local: location, server: existing.location }
          }
        });
        results.push({ sku, status: 'conflict' });
        
        runSql(`
          INSERT INTO sync_logs (action, sku, local_qty, server_qty, result, operator, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, ['update', sku, actual_qty, existing.actual_qty, 'conflict', operator || 'system', now]);
      } else {
        const result = runSql(`
          UPDATE inventory_records 
          SET product_name = ?, location = ?, expected_qty = ?, actual_qty = ?, 
              unit = ?, operator = ?, remark = ?, updated_at = ?, version = version + 1
          WHERE sku = ? AND version = ?
        `, [product_name, location, expected_qty, actual_qty, unit, operator || 'system', remark, now, sku, clientVersion || existing.version]);
        
        if (result.changes > 0) {
          results.push({ sku, status: 'success', action: 'updated' });
          
          runSql(`
            INSERT INTO sync_logs (action, sku, local_qty, server_qty, result, operator, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `, ['update', sku, actual_qty, existing.actual_qty, 'success', operator || 'system', now]);
        } else {
          const latest = queryOne('SELECT * FROM inventory_records WHERE sku = ?', [sku]);
          conflicts.push({
            sku,
            local: { actual_qty, expected_qty, product_name, location, remark, version: clientVersion },
            server: { actual_qty: latest.actual_qty, expected_qty: latest.expected_qty, product_name: latest.product_name, location: latest.location, remark: latest.remark, version: latest.version },
            diff: {
              actual_qty: { local: actual_qty, server: latest.actual_qty },
              expected_qty: { local: expected_qty, server: latest.expected_qty }
            }
          });
          results.push({ sku, status: 'conflict' });
          
          runSql(`
            INSERT INTO sync_logs (action, sku, local_qty, server_qty, result, operator, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `, ['update', sku, actual_qty, latest.actual_qty, 'conflict', operator || 'system', now]);
        }
      }
    }
  }

  res.json({
    success: true,
    results,
    conflicts,
    stats: {
      total: records.length,
      success: results.filter(r => r.status === 'success').length,
      conflict: conflicts.length,
      error: results.filter(r => r.status === 'error').length
    }
  });
});

app.post('/api/sync/resolve', (req, res) => {
  const { sku, resolution, localData, operator } = req.body;
  const now = getCurrentTimestamp();
  
  const existing = queryOne('SELECT * FROM inventory_records WHERE sku = ?', [sku]);

  if (!existing) {
    return res.status(404).json({ success: false, error: '记录不存在' });
  }

  if (resolution === 'overwrite') {
    runSql(`
      UPDATE inventory_records 
      SET product_name = ?, location = ?, expected_qty = ?, actual_qty = ?, 
          unit = ?, operator = ?, remark = ?, updated_at = ?, version = version + 1
      WHERE sku = ?
    `, [
      localData.product_name || existing.product_name,
      localData.location || existing.location,
      localData.expected_qty,
      localData.actual_qty,
      localData.unit || existing.unit,
      operator || 'system',
      localData.remark,
      now,
      sku
    ]);
    
    runSql(`
      INSERT INTO sync_logs (action, sku, local_qty, server_qty, result, operator, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, ['resolve', sku, localData.actual_qty, existing.actual_qty, 'overwrite', operator || 'system', now]);
    
    res.json({ success: true, action: 'overwritten', sku });
  } else if (resolution === 'keep_server') {
    runSql(`
      INSERT INTO sync_logs (action, sku, local_qty, server_qty, result, operator, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, ['resolve', sku, localData.actual_qty, existing.actual_qty, 'keep_server', operator || 'system', now]);
    
    res.json({ success: true, action: 'kept_server', data: existing, sku });
  } else {
    res.status(400).json({ success: false, error: '无效的解决方式' });
  }
});

app.get('/api/sync/logs', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const logs = queryAll('SELECT * FROM sync_logs ORDER BY created_at DESC LIMIT ?', [limit]);
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/report/markdown', (req, res) => {
  try {
    const records = queryAll('SELECT * FROM inventory_records ORDER BY sku');
    const logs = queryAll('SELECT * FROM sync_logs ORDER BY created_at DESC LIMIT 20');
    
    let markdown = `# 仓库盘点对账报告\n\n`;
    markdown += `生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
    
    const totalQty = records.reduce((sum, r) => sum + r.actual_qty, 0);
    const totalExpected = records.reduce((sum, r) => sum + r.expected_qty, 0);
    const diffCount = records.filter(r => r.actual_qty !== r.expected_qty).length;
    
    markdown += `## 汇总统计\n\n`;
    markdown += `| 指标 | 数值 |\n|------|------|\n`;
    markdown += `| SKU 总数 | ${records.length} |\n`;
    markdown += `| 实际库存总量 | ${totalQty} |\n`;
    markdown += `| 账面库存总量 | ${totalExpected} |\n`;
    markdown += `| 账实不符数量 | ${diffCount} |\n\n`;
    
    markdown += `## 库存明细\n\n`;
    markdown += `| SKU | 商品名称 | 库位 | 账面数量 | 实际数量 | 差异 | 操作人 | 备注 |\n`;
    markdown += `|-----|----------|------|----------|----------|------|--------|------|\n`;
    
    for (const r of records) {
      const diff = r.actual_qty - r.expected_qty;
      const diffText = diff === 0 ? '✓ 一致' : (diff > 0 ? `+${diff} 盘盈` : `${diff} 盘亏`);
      markdown += `| ${r.sku} | ${r.product_name} | ${r.location || '-'} | ${r.expected_qty} | ${r.actual_qty} | ${diffText} | ${r.operator || '-'} | ${r.remark || '-'} |\n`;
    }
    
    markdown += `\n## 最近同步日志\n\n`;
    for (const log of logs) {
      markdown += `- **${new Date(log.created_at).toLocaleString('zh-CN')}** [${log.action}] SKU: ${log.sku || '-'} - ${log.result}\n`;
    }
    
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=inventory-report-${Date.now()}.md`);
    res.send(markdown);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`仓库盘点服务已启动: http://localhost:${PORT}`);
    console.log(`请先运行 npm run seed 初始化种子数据`);
  });
}).catch(err => {
  console.error('初始化数据库失败:', err);
  process.exit(1);
});

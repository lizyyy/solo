const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

const app = express();
const PORT = process.env.PORT || 3001;

let db = null;
let dbPath = null;

const dataDir = path.join(__dirname, 'data');
const uploadsDir = path.join(__dirname, 'uploads');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}_${timestamp}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedExts = ['.jpg', '.jpeg', '.png', '.pdf', '.tiff', '.gif', '.bmp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型'));
    }
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'renderer')));
app.use('/uploads', express.static(uploadsDir));

async function initializeDatabase() {
  dbPath = path.join(dataDir, 'invoices.db');
  console.log('数据库路径:', dbPath);

  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_path TEXT NOT NULL,
      project_no TEXT,
      approval_no TEXT,
      amount REAL DEFAULT 0,
      invoice_date TEXT,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      reviewed_at TEXT,
      reviewed_by TEXT,
      file_hash TEXT
    );

    CREATE TABLE IF NOT EXISTS operations_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER,
      operation TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_project_no ON invoices(project_no);
    CREATE INDEX IF NOT EXISTS idx_approval_no ON invoices(approval_no);
    CREATE INDEX IF NOT EXISTS idx_status ON invoices(status);
  `);

  saveDatabase();
}

function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

function getTimestamp() {
  return new Date().toISOString();
}

function addOperationLog(invoiceId, operation, details = null) {
  db.run(
    `INSERT INTO operations_log (invoice_id, operation, details, created_at) VALUES (?, ?, ?, ?)`,
    [invoiceId, operation, details ? JSON.stringify(details) : null, getTimestamp()]
  );
  saveDatabase();
}

app.post('/api/import', upload.array('files'), (req, res) => {
  const imported = [];
  const duplicates = [];
  const errors = [];

  if (!req.files || req.files.length === 0) {
    return res.json({ success: false, message: '未选择文件' });
  }

  for (const file of req.files) {
    try {
      const filename = file.originalname;
      const filePath = file.path;

      const existing = db.exec(`
        SELECT id, filename, project_no, approval_no FROM invoices 
        WHERE original_path = '${filePath.replace(/'/g, "''")}' OR filename = '${filename.replace(/'/g, "''")}'
      `);

      if (existing.length > 0 && existing[0].values.length > 0) {
        const row = existing[0].values[0];
        duplicates.push({
          filename,
          existing_project_no: row[2],
          existing_approval_no: row[3]
        });
        continue;
      }

      const stmt = db.prepare(`
        INSERT INTO invoices (filename, original_path, project_no, approval_no, 
                              amount, invoice_date, status, notes, created_at, updated_at)
        VALUES (?, ?, NULL, NULL, 0, NULL, 'pending', '', ?, ?)
      `);

      stmt.run([filename, filePath, getTimestamp(), getTimestamp()]);
      const lastInsertRowid = db.exec("SELECT last_insert_rowid()")[0].values[0][0];
      
      addOperationLog(lastInsertRowid, 'IMPORT', {
        filename,
        original_path: filePath
      });

      imported.push({
        id: lastInsertRowid,
        filename,
        original_path: filePath
      });
    } catch (err) {
      errors.push({
        filename: file.originalname,
        error: err.message
      });
    }
  }

  saveDatabase();
  res.json({
    success: true,
    imported,
    duplicates,
    errors
  });
});

app.get('/api/invoices', (req, res) => {
  const filters = req.query;
  let sql = `SELECT * FROM invoices WHERE 1=1`;

  if (filters.status) {
    sql += ` AND status = '${filters.status.replace(/'/g, "''")}'`;
  }

  if (filters.keyword) {
    const kw = filters.keyword.replace(/'/g, "''");
    sql += ` AND (filename LIKE '%${kw}%' OR project_no LIKE '%${kw}%' OR approval_no LIKE '%${kw}%' OR notes LIKE '%${kw}%')`;
  }

  sql += ` ORDER BY created_at DESC`;

  const result = db.exec(sql);
  
  if (result.length === 0) {
    return res.json({ success: true, data: [] });
  }

  const columns = result[0].columns;
  const values = result[0].values;
  
  const invoices = values.map(row => {
    const obj = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });

  res.json({ success: true, data: invoices });
});

app.get('/api/invoices/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const result = db.exec(`SELECT * FROM invoices WHERE id = ${id}`);
  
  if (result.length === 0 || result[0].values.length === 0) {
    return res.json({ success: false, error: '票据不存在' });
  }

  const columns = result[0].columns;
  const row = result[0].values[0];
  const invoice = {};
  columns.forEach((col, i) => {
    invoice[col] = row[i];
  });

  res.json({ success: true, data: invoice });
});

app.put('/api/invoices/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const data = req.body;

  const invoiceResult = db.exec(`SELECT * FROM invoices WHERE id = ${id}`);
  
  if (invoiceResult.length === 0 || invoiceResult[0].values.length === 0) {
    return res.json({ success: false, error: '票据不存在' });
  }

  const columns = invoiceResult[0].columns;
  const row = invoiceResult[0].values[0];
  const invoice = {};
  columns.forEach((col, i) => {
    invoice[col] = row[i];
  });

  if (!fs.existsSync(invoice.original_path)) {
    return res.json({ 
      success: false, 
      error: '文件缺失',
      details: `原文件路径不存在: ${invoice.original_path}`
    });
  }

  const conflicts = [];
  
  if (data.project_no) {
    const projectNo = data.project_no.replace(/'/g, "''");
    const conflictResult = db.exec(`
      SELECT id, filename FROM invoices 
      WHERE id != ${id} AND project_no = '${projectNo}' AND status = 'reviewed'
    `);
    
    if (conflictResult.length > 0 && conflictResult[0].values.length > 0) {
      conflicts.push({
        type: 'project_no',
        message: `项目号 ${data.project_no} 已被其他已复核的票据使用`,
        conflict_invoice: {
          id: conflictResult[0].values[0][0],
          filename: conflictResult[0].values[0][1]
        }
      });
    }
  }

  if (data.approval_no) {
    const approvalNo = data.approval_no.replace(/'/g, "''");
    const conflictResult = db.exec(`
      SELECT id, filename FROM invoices 
      WHERE id != ${id} AND approval_no = '${approvalNo}' AND status = 'reviewed'
    `);
    
    if (conflictResult.length > 0 && conflictResult[0].values.length > 0) {
      conflicts.push({
        type: 'approval_no',
        message: `审批单号 ${data.approval_no} 已被其他已复核的票据使用`,
        conflict_invoice: {
          id: conflictResult[0].values[0][0],
          filename: conflictResult[0].values[0][1]
        }
      });
    }
  }

  if (conflicts.length > 0) {
    return res.json({
      success: false,
      error: '字段冲突',
      conflicts
    });
  }

  const projectNo = data.project_no ? `'${data.project_no.replace(/'/g, "''")}'` : 'NULL';
  const approvalNo = data.approval_no ? `'${data.approval_no.replace(/'/g, "''")}'` : 'NULL';
  const invoiceDate = data.invoice_date ? `'${data.invoice_date}'` : 'NULL';
  const notes = data.notes ? `'${data.notes.replace(/'/g, "''")}'` : "''";
  
  db.run(`
    UPDATE invoices 
    SET project_no = ${projectNo}, 
        approval_no = ${approvalNo}, 
        amount = ${data.amount || 0}, 
        invoice_date = ${invoiceDate}, 
        notes = ${notes}, 
        updated_at = '${getTimestamp()}'
    WHERE id = ${id}
  `);

  addOperationLog(id, 'UPDATE', data);
  saveDatabase();

  res.json({ success: true });
});

app.post('/api/invoices/:id/review', (req, res) => {
  const id = parseInt(req.params.id);
  const reviewer = req.body.reviewer || '系统';

  const invoiceResult = db.exec(`SELECT * FROM invoices WHERE id = ${id}`);
  
  if (invoiceResult.length === 0 || invoiceResult[0].values.length === 0) {
    return res.json({ success: false, error: '票据不存在' });
  }

  const columns = invoiceResult[0].columns;
  const row = invoiceResult[0].values[0];
  const invoice = {};
  columns.forEach((col, i) => {
    invoice[col] = row[i];
  });

  if (!fs.existsSync(invoice.original_path)) {
    return res.json({ 
      success: false, 
      error: '文件缺失',
      details: `原文件路径不存在，无法复核: ${invoice.original_path}`
    });
  }

  if (!invoice.project_no && !invoice.approval_no) {
    return res.json({
      success: false,
      error: '信息不完整',
      details: '必须至少填写项目号或审批单号才能复核'
    });
  }

  if (invoice.project_no) {
    const projectNo = invoice.project_no.replace(/'/g, "''");
    const conflictResult = db.exec(`
      SELECT id, filename FROM invoices 
      WHERE id != ${id} AND project_no = '${projectNo}' AND status = 'reviewed'
    `);
    
    if (conflictResult.length > 0 && conflictResult[0].values.length > 0) {
      return res.json({
        success: false,
        error: '字段冲突',
        details: `项目号 ${invoice.project_no} 已被票据 "${conflictResult[0].values[0][1]}" 使用`
      });
    }
  }

  if (invoice.approval_no) {
    const approvalNo = invoice.approval_no.replace(/'/g, "''");
    const conflictResult = db.exec(`
      SELECT id, filename FROM invoices 
      WHERE id != ${id} AND approval_no = '${approvalNo}' AND status = 'reviewed'
    `);
    
    if (conflictResult.length > 0 && conflictResult[0].values.length > 0) {
      return res.json({
        success: false,
        error: '字段冲突',
        details: `审批单号 ${invoice.approval_no} 已被票据 "${conflictResult[0].values[0][1]}" 使用`
      });
    }
  }

  db.run(`
    UPDATE invoices 
    SET status = 'reviewed', reviewed_at = '${getTimestamp()}', reviewed_by = '${reviewer.replace(/'/g, "''")}', updated_at = '${getTimestamp()}'
    WHERE id = ${id}
  `);

  addOperationLog(id, 'REVIEW', { reviewed_by: reviewer });
  saveDatabase();

  res.json({ success: true });
});

app.post('/api/invoices/:id/unreview', (req, res) => {
  const id = parseInt(req.params.id);

  const invoiceResult = db.exec(`SELECT * FROM invoices WHERE id = ${id}`);
  
  if (invoiceResult.length === 0 || invoiceResult[0].values.length === 0) {
    return res.json({ success: false, error: '票据不存在' });
  }

  db.run(`
    UPDATE invoices 
    SET status = 'pending', reviewed_at = NULL, reviewed_by = NULL, updated_at = '${getTimestamp()}'
    WHERE id = ${id}
  `);

  addOperationLog(id, 'UNREVIEW');
  saveDatabase();

  res.json({ success: true });
});

app.delete('/api/invoices/:id', (req, res) => {
  const id = parseInt(req.params.id);

  const invoiceResult = db.exec(`SELECT * FROM invoices WHERE id = ${id}`);
  
  if (invoiceResult.length === 0 || invoiceResult[0].values.length === 0) {
    return res.json({ success: false, error: '票据不存在' });
  }

  db.run(`DELETE FROM operations_log WHERE invoice_id = ${id}`);
  db.run(`DELETE FROM invoices WHERE id = ${id}`);
  saveDatabase();

  res.json({ success: true });
});

app.get('/api/operations', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const result = db.exec(`
    SELECT ol.*, i.filename, i.project_no, i.approval_no, i.status
    FROM operations_log ol
    LEFT JOIN invoices i ON ol.invoice_id = i.id
    ORDER BY ol.created_at DESC
    LIMIT ${limit}
  `);

  if (result.length === 0) {
    return res.json({ success: true, data: [] });
  }

  const columns = result[0].columns;
  const values = result[0].values;
  
  const logs = values.map(row => {
    const obj = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });

  res.json({ success: true, data: logs });
});

app.post('/api/export', (req, res) => {
  const filters = req.body;
  let sql = `SELECT * FROM invoices WHERE 1=1`;

  if (filters.status) {
    sql += ` AND status = '${filters.status.replace(/'/g, "''")}'`;
  }

  if (filters.startDate) {
    sql += ` AND created_at >= '${filters.startDate}T00:00:00.000Z'`;
  }

  if (filters.endDate) {
    sql += ` AND created_at <= '${filters.endDate}T23:59:59.999Z'`;
  }

  sql += ` ORDER BY created_at DESC`;

  const queryResult = db.exec(sql);
  
  let invoices = [];
  if (queryResult.length > 0) {
    const columns = queryResult[0].columns;
    const values = queryResult[0].values;
    
    invoices = values.map(row => {
      const obj = {};
      columns.forEach((col, i) => {
        obj[col] = row[i];
      });
      return obj;
    });
  }

  const data = invoices.map(inv => ({
    '序号': inv.id,
    '文件名': inv.filename,
    '项目号': inv.project_no || '-',
    '审批单号': inv.approval_no || '-',
    '金额': inv.amount || 0,
    '开票日期': inv.invoice_date || '-',
    '状态': inv.status === 'pending' ? '待复核' : '已复核',
    '备注': inv.notes || '-',
    '创建时间': inv.created_at,
    '更新时间': inv.updated_at,
    '复核时间': inv.reviewed_at || '-',
    '复核人': inv.reviewed_by || '-',
    '原文件路径': inv.original_path
  }));

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(data);

  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 30 },
    { wch: 15 },
    { wch: 20 },
    { wch: 12 },
    { wch: 12 },
    { wch: 10 },
    { wch: 20 },
    { wch: 25 },
    { wch: 25 },
    { wch: 25 },
    { wch: 12 },
    { wch: 50 }
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, '票据清单');
  
  const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  const filename = `票据清单_${new Date().toISOString().split('T')[0]}.xlsx`;

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(excelBuffer);
});

app.get('/api/stats', (req, res) => {
  const totalResult = db.exec(`SELECT COUNT(*) as count FROM invoices`);
  const pendingResult = db.exec(`SELECT COUNT(*) as count FROM invoices WHERE status = 'pending'`);
  const reviewedResult = db.exec(`SELECT COUNT(*) as count FROM invoices WHERE status = 'reviewed'`);
  const amountResult = db.exec(`SELECT SUM(amount) as total FROM invoices WHERE status = 'reviewed'`);

  const total = totalResult[0]?.values[0]?.[0] || 0;
  const pending = pendingResult[0]?.values[0]?.[0] || 0;
  const reviewed = reviewedResult[0]?.values[0]?.[0] || 0;
  const totalAmount = amountResult[0]?.values[0]?.[0] || 0;

  res.json({
    success: true,
    data: {
      total,
      pending,
      reviewed,
      totalAmount: parseFloat((totalAmount || 0).toFixed(2))
    }
  });
});

app.get('/api/preview/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const invoiceResult = db.exec(`SELECT original_path FROM invoices WHERE id = ${id}`);
  
  if (invoiceResult.length === 0 || invoiceResult[0].values.length === 0) {
    return res.json({ success: false, error: '票据不存在' });
  }

  const filePath = invoiceResult[0].values[0][0];
  
  if (!fs.existsSync(filePath)) {
    return res.json({ success: false, error: '文件不存在' });
  }

  const ext = path.extname(filePath).toLowerCase();
  const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff'].includes(ext);

  if (isImage) {
    const relativePath = path.relative(__dirname, filePath);
    res.json({
      success: true,
      type: 'image',
      url: `/${relativePath.replace(/\\/g, '/')}`
    });
  } else if (ext === '.pdf') {
    const relativePath = path.relative(__dirname, filePath);
    res.json({
      success: true,
      type: 'pdf',
      url: `/${relativePath.replace(/\\/g, '/')}`,
      message: 'PDF文件请点击查看'
    });
  } else {
    res.json({
      success: true,
      type: 'other',
      message: '该文件类型暂不支持预览'
    });
  }
});

initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`票据扫描归档桌面台已启动`);
    console.log(`访问地址: http://localhost:${PORT}`);
    console.log(`数据库位置: ${dbPath}`);
  });
});

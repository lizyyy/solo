const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

let mainWindow;
let db = null;
let dbPath = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('renderer/index.html');

  mainWindow.on('closed', () => {
    saveDatabase();
    mainWindow = null;
  });
}

async function initializeDatabase() {
  dbPath = path.join(app.getPath('userData'), 'invoices.db');
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

app.whenReady().then(async () => {
  await initializeDatabase();
  createWindow();
  createMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  saveDatabase();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function createMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '导入票据文件',
          click: () => {
            mainWindow.webContents.send('menu-import-files');
          }
        },
        {
          label: '导出清单',
          click: () => {
            mainWindow.webContents.send('menu-export');
          }
        },
        { type: 'separator' },
        { role: 'quit', label: '退出' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '刷新' },
        { role: 'toggledevtools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetzoom', label: '重置缩放' },
        { role: 'zoomin', label: '放大' },
        { role: 'zoomout', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
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

ipcMain.handle('import-files', async (event) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择票据文件',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: '图片和PDF', extensions: ['jpg', 'jpeg', 'png', 'pdf', 'tiff', 'gif', 'bmp'] }
    ]
  });

  if (result.canceled) {
    return { success: false, canceled: true };
  }

  const imported = [];
  const duplicates = [];
  const errors = [];

  for (const filePath of result.filePaths) {
    try {
      const filename = path.basename(filePath);
      
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
      const info = stmt.get();
      const lastInsertRowid = info ? info[0] : db.exec("SELECT last_insert_rowid()")[0].values[0][0];
      
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
        filename: path.basename(filePath),
        error: err.message
      });
    }
  }

  saveDatabase();
  return {
    success: true,
    imported,
    duplicates,
    errors
  };
});

ipcMain.handle('get-invoices', (event, filters = {}) => {
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
    return { success: true, data: [] };
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

  return { success: true, data: invoices };
});

ipcMain.handle('get-invoice', (event, id) => {
  const result = db.exec(`SELECT * FROM invoices WHERE id = ${id}`);
  
  if (result.length === 0 || result[0].values.length === 0) {
    return { success: false, error: '票据不存在' };
  }

  const columns = result[0].columns;
  const row = result[0].values[0];
  const invoice = {};
  columns.forEach((col, i) => {
    invoice[col] = row[i];
  });

  return { success: true, data: invoice };
});

ipcMain.handle('save-invoice', (event, id, data) => {
  const invoiceResult = db.exec(`SELECT * FROM invoices WHERE id = ${id}`);
  
  if (invoiceResult.length === 0 || invoiceResult[0].values.length === 0) {
    return { success: false, error: '票据不存在' };
  }

  const columns = invoiceResult[0].columns;
  const row = invoiceResult[0].values[0];
  const invoice = {};
  columns.forEach((col, i) => {
    invoice[col] = row[i];
  });

  if (!fs.existsSync(invoice.original_path)) {
    return { 
      success: false, 
      error: '文件缺失',
      details: `原文件路径不存在: ${invoice.original_path}`
    };
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
    return {
      success: false,
      error: '字段冲突',
      conflicts
    };
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

  return { success: true };
});

ipcMain.handle('review-invoice', (event, id, reviewer = '系统') => {
  const invoiceResult = db.exec(`SELECT * FROM invoices WHERE id = ${id}`);
  
  if (invoiceResult.length === 0 || invoiceResult[0].values.length === 0) {
    return { success: false, error: '票据不存在' };
  }

  const columns = invoiceResult[0].columns;
  const row = invoiceResult[0].values[0];
  const invoice = {};
  columns.forEach((col, i) => {
    invoice[col] = row[i];
  });

  if (!fs.existsSync(invoice.original_path)) {
    return { 
      success: false, 
      error: '文件缺失',
      details: `原文件路径不存在，无法复核: ${invoice.original_path}`
    };
  }

  if (!invoice.project_no && !invoice.approval_no) {
    return {
      success: false,
      error: '信息不完整',
      details: '必须至少填写项目号或审批单号才能复核'
    };
  }

  if (invoice.project_no) {
    const projectNo = invoice.project_no.replace(/'/g, "''");
    const conflictResult = db.exec(`
      SELECT id, filename FROM invoices 
      WHERE id != ${id} AND project_no = '${projectNo}' AND status = 'reviewed'
    `);
    
    if (conflictResult.length > 0 && conflictResult[0].values.length > 0) {
      return {
        success: false,
        error: '字段冲突',
        details: `项目号 ${invoice.project_no} 已被票据 "${conflictResult[0].values[0][1]}" 使用`
      };
    }
  }

  if (invoice.approval_no) {
    const approvalNo = invoice.approval_no.replace(/'/g, "''");
    const conflictResult = db.exec(`
      SELECT id, filename FROM invoices 
      WHERE id != ${id} AND approval_no = '${approvalNo}' AND status = 'reviewed'
    `);
    
    if (conflictResult.length > 0 && conflictResult[0].values.length > 0) {
      return {
        success: false,
        error: '字段冲突',
        details: `审批单号 ${invoice.approval_no} 已被票据 "${conflictResult[0].values[0][1]}" 使用`
      };
    }
  }

  db.run(`
    UPDATE invoices 
    SET status = 'reviewed', reviewed_at = '${getTimestamp()}', reviewed_by = '${reviewer.replace(/'/g, "''")}', updated_at = '${getTimestamp()}'
    WHERE id = ${id}
  `);

  addOperationLog(id, 'REVIEW', { reviewed_by: reviewer });
  saveDatabase();

  return { success: true };
});

ipcMain.handle('unreview-invoice', (event, id) => {
  const invoiceResult = db.exec(`SELECT * FROM invoices WHERE id = ${id}`);
  
  if (invoiceResult.length === 0 || invoiceResult[0].values.length === 0) {
    return { success: false, error: '票据不存在' };
  }

  db.run(`
    UPDATE invoices 
    SET status = 'pending', reviewed_at = NULL, reviewed_by = NULL, updated_at = '${getTimestamp()}'
    WHERE id = ${id}
  `);

  addOperationLog(id, 'UNREVIEW');
  saveDatabase();

  return { success: true };
});

ipcMain.handle('delete-invoice', (event, id) => {
  const invoiceResult = db.exec(`SELECT * FROM invoices WHERE id = ${id}`);
  
  if (invoiceResult.length === 0 || invoiceResult[0].values.length === 0) {
    return { success: false, error: '票据不存在' };
  }

  db.run(`DELETE FROM operations_log WHERE invoice_id = ${id}`);
  db.run(`DELETE FROM invoices WHERE id = ${id}`);
  saveDatabase();

  return { success: true };
});

ipcMain.handle('get-operations-log', (event, limit = 100) => {
  const result = db.exec(`
    SELECT ol.*, i.filename, i.project_no, i.approval_no, i.status
    FROM operations_log ol
    LEFT JOIN invoices i ON ol.invoice_id = i.id
    ORDER BY ol.created_at DESC
    LIMIT ${limit}
  `);

  if (result.length === 0) {
    return { success: true, data: [] };
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

  return { success: true, data: logs };
});

ipcMain.handle('export-excel', async (event, filters = {}) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '导出票据清单',
    defaultPath: `票据清单_${new Date().toISOString().split('T')[0]}.xlsx`,
    filters: [
      { name: 'Excel 文件', extensions: ['xlsx'] }
    ]
  });

  if (result.canceled) {
    return { success: false, canceled: true };
  }

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
  XLSX.writeFile(workbook, result.filePath);

  return { success: true, filePath: result.filePath, count: invoices.length };
});

ipcMain.handle('get-stats', (event) => {
  const totalResult = db.exec(`SELECT COUNT(*) as count FROM invoices`);
  const pendingResult = db.exec(`SELECT COUNT(*) as count FROM invoices WHERE status = 'pending'`);
  const reviewedResult = db.exec(`SELECT COUNT(*) as count FROM invoices WHERE status = 'reviewed'`);
  const amountResult = db.exec(`SELECT SUM(amount) as total FROM invoices WHERE status = 'reviewed'`);

  const total = totalResult[0]?.values[0]?.[0] || 0;
  const pending = pendingResult[0]?.values[0]?.[0] || 0;
  const reviewed = reviewedResult[0]?.values[0]?.[0] || 0;
  const totalAmount = amountResult[0]?.values[0]?.[0] || 0;

  return {
    success: true,
    data: {
      total,
      pending,
      reviewed,
      totalAmount: parseFloat((totalAmount || 0).toFixed(2))
    }
  };
});

ipcMain.handle('open-file', (event, filePath) => {
  if (!fs.existsSync(filePath)) {
    return { success: false, error: '文件不存在' };
  }

  const { shell } = require('electron');
  shell.openPath(filePath);
  return { success: true };
});

ipcMain.handle('show-file-in-folder', (event, filePath) => {
  if (!fs.existsSync(filePath)) {
    return { success: false, error: '文件不存在' };
  }

  const { shell } = require('electron');
  shell.showItemInFolder(filePath);
  return { success: true };
});

ipcMain.handle('get-file-preview', (event, filePath) => {
  if (!fs.existsSync(filePath)) {
    return { success: false, error: '文件不存在' };
  }

  const ext = path.extname(filePath).toLowerCase();
  const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff'].includes(ext);

  if (isImage) {
    const fileData = fs.readFileSync(filePath);
    const base64 = fileData.toString('base64');
    const mimeType = ext === '.png' ? 'image/png' : 
                     ext === '.gif' ? 'image/gif' :
                     ext === '.bmp' ? 'image/bmp' :
                     ext === '.tiff' ? 'image/tiff' : 'image/jpeg';
    
    return {
      success: true,
      type: 'image',
      dataUrl: `data:${mimeType};base64,${base64}`
    };
  } else if (ext === '.pdf') {
    return {
      success: true,
      type: 'pdf',
      message: 'PDF文件请使用系统默认程序打开'
    };
  } else {
    return {
      success: true,
      type: 'other',
      message: '该文件类型暂不支持预览'
    };
  }
});

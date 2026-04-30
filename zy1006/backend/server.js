const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const csvParser = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;
const dbPath = path.join(__dirname, 'database.db');

const SampleStatus = {
  AVAILABLE: 'AVAILABLE',
  BORROWED: 'BORROWED',
  DAMAGED: 'DAMAGED',
  LOST: 'LOST'
};

const BorrowStatus = {
  BORROWED: 'BORROWED',
  RETURNED: 'RETURNED',
  OVERDUE: 'OVERDUE'
};

let db;

const initDatabase = async () => {
  const SQL = await initSqlJs();
  
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
    console.log('数据库已加载:', dbPath);
  } else {
    db = new SQL.Database();
    console.log('创建新数据库');
    
    db.run(`
      CREATE TABLE IF NOT EXISTS samples (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        code TEXT NOT NULL UNIQUE,
        category TEXT DEFAULT '',
        location TEXT DEFAULT '',
        deposit REAL DEFAULT 0,
        value REAL DEFAULT 0,
        status TEXT DEFAULT 'AVAILABLE',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS borrow_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sampleId INTEGER NOT NULL,
        borrowerName TEXT NOT NULL,
        borrowerContact TEXT DEFAULT '',
        expectedReturnDate DATETIME NOT NULL,
        actualReturnDate DATETIME,
        damageNote TEXT,
        status TEXT DEFAULT 'BORROWED',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    saveDatabase();
    console.log('数据库表创建成功');
  }
};

const saveDatabase = () => {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
};

const runQuery = (sql, params = []) => {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const result = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    result.push(row);
  }
  stmt.free();
  return result;
};

const executeQuery = (sql, params = []) => {
  db.run(sql, params);
  saveDatabase();
  return db.exec('SELECT last_insert_rowid() as id')[0]?.values?.[0]?.[0];
};

const updateOverdueStatus = () => {
  const now = new Date().toISOString();
  const sql = `
    UPDATE borrow_records 
    SET status = ?, updatedAt = ?
    WHERE status = ? 
    AND expectedReturnDate < ?
    AND actualReturnDate IS NULL
  `;
  db.run(sql, [BorrowStatus.OVERDUE, now, BorrowStatus.BORROWED, now]);
  saveDatabase();
};

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const upload = multer({ dest: 'uploads/' });

app.get('/api/stats', async (req, res) => {
  try {
    updateOverdueStatus();

    const availableCount = runQuery(
      'SELECT COUNT(*) as count FROM samples WHERE status = ?',
      [SampleStatus.AVAILABLE]
    )[0]?.count || 0;

    const borrowedCount = runQuery(
      'SELECT COUNT(*) as count FROM borrow_records WHERE status = ?',
      [BorrowStatus.BORROWED]
    )[0]?.count || 0;

    const overdueCount = runQuery(
      'SELECT COUNT(*) as count FROM borrow_records WHERE status = ?',
      [BorrowStatus.OVERDUE]
    )[0]?.count || 0;

    res.json({
      available: availableCount,
      borrowed: borrowedCount,
      overdue: overdueCount
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: '获取统计数据失败' });
  }
});

app.get('/api/samples', async (req, res) => {
  try {
    const { status, search, category } = req.query;
    let sql = 'SELECT * FROM samples WHERE 1=1';
    let params = [];

    if (status) {
      sql += ' AND status = ?';
      params.push(status.toUpperCase());
    }
    if (search) {
      sql += ' AND (name LIKE ? OR code LIKE ? OR category LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }

    sql += ' ORDER BY updatedAt DESC';

    const samples = runQuery(sql, params);

    const samplesWithRecords = samples.map(sample => {
      const borrowRecords = runQuery(
        'SELECT * FROM borrow_records WHERE sampleId = ? ORDER BY createdAt DESC LIMIT 1',
        [sample.id]
      );
      return {
        ...sample,
        borrowRecords
      };
    });

    res.json(samplesWithRecords);
  } catch (error) {
    console.error('Error getting samples:', error);
    res.status(500).json({ error: '获取样品列表失败' });
  }
});

app.get('/api/samples/categories', async (req, res) => {
  try {
    const categories = runQuery(
      'SELECT DISTINCT category FROM samples WHERE category IS NOT NULL AND category != ? ORDER BY category',
      ['']
    );
    res.json(categories.map(c => c.category));
  } catch (error) {
    console.error('Error getting categories:', error);
    res.status(500).json({ error: '获取分类列表失败' });
  }
});

app.get('/api/samples/:id', async (req, res) => {
  try {
    const sampleId = parseInt(req.params.id);
    const samples = runQuery('SELECT * FROM samples WHERE id = ?', [sampleId]);

    if (samples.length === 0) {
      return res.status(404).json({ error: '样品不存在' });
    }

    const borrowRecords = runQuery(
      'SELECT * FROM borrow_records WHERE sampleId = ? ORDER BY createdAt DESC',
      [sampleId]
    );

    res.json({
      ...samples[0],
      borrowRecords
    });
  } catch (error) {
    console.error('Error getting sample:', error);
    res.status(500).json({ error: '获取样品信息失败' });
  }
});

app.post('/api/samples', async (req, res) => {
  try {
    const { name, code, category, location, deposit, value } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: '样品名称和编号不能为空' });
    }

    const existingSamples = runQuery('SELECT * FROM samples WHERE code = ?', [code]);

    if (existingSamples.length > 0) {
      return res.status(400).json({ error: '样品编号已存在，请使用其他编号' });
    }

    const now = new Date().toISOString();
    const id = executeQuery(
      `INSERT INTO samples (name, code, category, location, deposit, value, status, createdAt, updatedAt) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, code, category || '', location || '', parseFloat(deposit) || 0, parseFloat(value) || 0, SampleStatus.AVAILABLE, now, now]
    );

    const newSamples = runQuery('SELECT * FROM samples WHERE id = ?', [id]);
    res.status(201).json(newSamples[0]);
  } catch (error) {
    console.error('Error creating sample:', error);
    res.status(500).json({ error: '创建样品失败' });
  }
});

app.put('/api/samples/:id', async (req, res) => {
  try {
    const { name, code, category, location, deposit, value, status } = req.body;
    const sampleId = parseInt(req.params.id);

    const existingSamples = runQuery('SELECT * FROM samples WHERE id = ?', [sampleId]);

    if (existingSamples.length === 0) {
      return res.status(404).json({ error: '样品不存在' });
    }

    const existingSample = existingSamples[0];

    if (code && code !== existingSample.code) {
      const sampleWithCode = runQuery('SELECT * FROM samples WHERE code = ? AND id != ?', [code, sampleId]);
      if (sampleWithCode.length > 0) {
        return res.status(400).json({ error: '样品编号已存在，请使用其他编号' });
      }
    }

    const now = new Date().toISOString();
    const updates = [];
    const params = [];

    if (name) { updates.push('name = ?'); params.push(name); }
    if (code) { updates.push('code = ?'); params.push(code); }
    if (category !== undefined) { updates.push('category = ?'); params.push(category || ''); }
    if (location !== undefined) { updates.push('location = ?'); params.push(location || ''); }
    if (deposit !== undefined) { updates.push('deposit = ?'); params.push(parseFloat(deposit) || 0); }
    if (value !== undefined) { updates.push('value = ?'); params.push(parseFloat(value) || 0); }
    if (status) { updates.push('status = ?'); params.push(status); }

    updates.push('updatedAt = ?');
    params.push(now, sampleId);

    if (updates.length > 0) {
      executeQuery(`UPDATE samples SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    const updatedSamples = runQuery('SELECT * FROM samples WHERE id = ?', [sampleId]);
    res.json(updatedSamples[0]);
  } catch (error) {
    console.error('Error updating sample:', error);
    res.status(500).json({ error: '更新样品失败' });
  }
});

app.delete('/api/samples/:id', async (req, res) => {
  try {
    const sampleId = parseInt(req.params.id);

    const samples = runQuery('SELECT * FROM samples WHERE id = ?', [sampleId]);

    if (samples.length === 0) {
      return res.status(404).json({ error: '样品不存在' });
    }

    const borrowRecords = runQuery(
      'SELECT * FROM borrow_records WHERE sampleId = ? AND (status = ? OR status = ?)',
      [sampleId, BorrowStatus.BORROWED, BorrowStatus.OVERDUE]
    );

    if (borrowRecords.length > 0) {
      return res.status(400).json({ error: '该样品正在借用中，无法删除' });
    }

    executeQuery('DELETE FROM borrow_records WHERE sampleId = ?', [sampleId]);
    executeQuery('DELETE FROM samples WHERE id = ?', [sampleId]);

    res.json({ message: '样品删除成功' });
  } catch (error) {
    console.error('Error deleting sample:', error);
    res.status(500).json({ error: '删除样品失败' });
  }
});

app.get('/api/borrow-records', async (req, res) => {
  try {
    updateOverdueStatus();

    const { status, sampleId, borrowerName } = req.query;
    let sql = 'SELECT * FROM borrow_records WHERE 1=1';
    let params = [];

    if (status) {
      sql += ' AND status = ?';
      params.push(status.toUpperCase());
    }
    if (sampleId) {
      sql += ' AND sampleId = ?';
      params.push(parseInt(sampleId));
    }
    if (borrowerName) {
      sql += ' AND borrowerName LIKE ?';
      params.push(`%${borrowerName}%`);
    }

    sql += ' ORDER BY createdAt DESC';

    const records = runQuery(sql, params);

    const recordsWithSamples = records.map(record => {
      const samples = runQuery('SELECT * FROM samples WHERE id = ?', [record.sampleId]);
      return {
        ...record,
        sample: samples[0]
      };
    });

    res.json(recordsWithSamples);
  } catch (error) {
    console.error('Error getting borrow records:', error);
    res.status(500).json({ error: '获取借用记录失败' });
  }
});

app.post('/api/borrow-records', async (req, res) => {
  try {
    const { sampleId, borrowerName, borrowerContact, expectedReturnDate } = req.body;

    if (!sampleId || !borrowerName || !expectedReturnDate) {
      return res.status(400).json({ error: '请填写必要信息：样品、借用人、预计归还日期' });
    }

    const samples = runQuery('SELECT * FROM samples WHERE id = ?', [parseInt(sampleId)]);

    if (samples.length === 0) {
      return res.status(404).json({ error: '样品不存在' });
    }

    const sample = samples[0];

    if (sample.status !== SampleStatus.AVAILABLE) {
      return res.status(400).json({ error: '该样品当前不可借用，状态：' + sample.status });
    }

    const now = new Date().toISOString();
    
    const recordId = executeQuery(
      `INSERT INTO borrow_records (sampleId, borrowerName, borrowerContact, expectedReturnDate, status, createdAt, updatedAt) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [parseInt(sampleId), borrowerName, borrowerContact || '', expectedReturnDate, BorrowStatus.BORROWED, now, now]
    );

    executeQuery(
      'UPDATE samples SET status = ?, updatedAt = ? WHERE id = ?',
      [SampleStatus.BORROWED, now, parseInt(sampleId)]
    );

    const newRecords = runQuery('SELECT * FROM borrow_records WHERE id = ?', [recordId]);
    const newRecord = {
      ...newRecords[0],
      sample
    };

    res.status(201).json(newRecord);
  } catch (error) {
    console.error('Error creating borrow record:', error);
    res.status(500).json({ error: '创建借用记录失败' });
  }
});

app.put('/api/borrow-records/:id/return', async (req, res) => {
  try {
    const { actualReturnDate, damageNote } = req.body;
    const recordId = parseInt(req.params.id);

    const records = runQuery('SELECT * FROM borrow_records WHERE id = ?', [recordId]);

    if (records.length === 0) {
      return res.status(404).json({ error: '借用记录不存在' });
    }

    const record = records[0];

    if (record.status === BorrowStatus.RETURNED) {
      return res.status(400).json({ error: '该借用记录已归还' });
    }

    const now = new Date().toISOString();
    const returnDate = actualReturnDate || now;
    const hasDamage = damageNote && damageNote.trim();

    executeQuery(
      `UPDATE borrow_records 
       SET actualReturnDate = ?, damageNote = ?, status = ?, updatedAt = ? 
       WHERE id = ?`,
      [returnDate, damageNote || '', BorrowStatus.RETURNED, now, recordId]
    );

    const newSampleStatus = hasDamage ? SampleStatus.DAMAGED : SampleStatus.AVAILABLE;
    executeQuery(
      'UPDATE samples SET status = ?, updatedAt = ? WHERE id = ?',
      [newSampleStatus, now, record.sampleId]
    );

    const updatedRecords = runQuery('SELECT * FROM borrow_records WHERE id = ?', [recordId]);
    const samples = runQuery('SELECT * FROM samples WHERE id = ?', [record.sampleId]);

    res.json({
      ...updatedRecords[0],
      sample: samples[0]
    });
  } catch (error) {
    console.error('Error returning borrow record:', error);
    res.status(500).json({ error: '归还操作失败' });
  }
});

app.post('/api/samples/import', upload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传CSV文件' });
    }

    const results = [];
    const errors = [];
    const existingCodes = new Set();

    const existingSamples = runQuery('SELECT code FROM samples');
    existingSamples.forEach(s => existingCodes.add(s.code));

    const fileCodes = new Set();

    fs.createReadStream(req.file.path)
      .pipe(csvParser())
      .on('data', (data) => {
        results.push(data);
      })
      .on('end', async () => {
        if (results.length === 0) {
          fs.unlinkSync(req.file.path);
          return res.status(400).json({ error: 'CSV文件为空或格式不正确' });
        }

        const importData = [];
        let rowNum = 1;

        for (const row of results) {
          rowNum++;

          const name = (row.name || row.名称 || row['样品名称'] || '').trim();
          const code = (row.code || row.编号 || row['样品编号'] || '').trim();
          const category = (row.category || row.分类 || row['样品分类'] || '').trim();
          const location = (row.location || row.位置 || row['库存位置'] || '').trim();
          const deposit = parseFloat(row.deposit || row.押金 || row['押金金额'] || '0') || 0;
          const value = parseFloat(row.value || row.价值 || row['样品价值'] || '0') || 0;

          if (!name || !code) {
            errors.push(`第${rowNum}行：样品名称和编号不能为空`);
            continue;
          }

          if (existingCodes.has(code)) {
            errors.push(`第${rowNum}行：样品编号 "${code}" 已存在`);
            continue;
          }

          if (fileCodes.has(code)) {
            errors.push(`第${rowNum}行：样品编号 "${code}" 在导入文件中重复`);
            continue;
          }

          fileCodes.add(code);
          importData.push({
            name,
            code,
            category,
            location,
            deposit,
            value
          });
        }

        if (errors.length > 0 && importData.length === 0) {
          fs.unlinkSync(req.file.path);
          return res.status(400).json({ 
            error: '导入失败，所有记录均有错误', 
            details: errors 
          });
        }

        let createdCount = 0;
        if (importData.length > 0) {
          const now = new Date().toISOString();
          for (const data of importData) {
            executeQuery(
              `INSERT INTO samples (name, code, category, location, deposit, value, status, createdAt, updatedAt) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [data.name, data.code, data.category, data.location, data.deposit, data.value, SampleStatus.AVAILABLE, now, now]
            );
            createdCount++;
          }
        }

        fs.unlinkSync(req.file.path);

        res.json({
          success: true,
          total: results.length,
          imported: createdCount,
          errors: errors.length > 0 ? errors : undefined,
          message: `成功导入 ${createdCount} 条记录${errors.length > 0 ? `，${errors.length} 条记录有错误` : ''}`
        });
      });
  } catch (error) {
    console.error('Error importing samples:', error);
    res.status(500).json({ error: '导入样品失败' });
  }
});

app.get('/api/borrow-records/export', async (req, res) => {
  try {
    updateOverdueStatus();

    const { status, startDate, endDate } = req.query;
    let sql = 'SELECT * FROM borrow_records WHERE 1=1';
    let params = [];

    if (status) {
      sql += ' AND status = ?';
      params.push(status.toUpperCase());
    }
    if (startDate) {
      sql += ' AND createdAt >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND createdAt <= ?';
      params.push(endDate + ' 23:59:59');
    }

    sql += ' ORDER BY createdAt DESC';

    const records = runQuery(sql, params);

    const recordsWithSamples = records.map(record => {
      const samples = runQuery('SELECT * FROM samples WHERE id = ?', [record.sampleId]);
      return {
        ...record,
        sample: samples[0]
      };
    });

    const exportDir = path.join(__dirname, 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const filename = `borrow-records-${new Date().toISOString().split('T')[0]}.csv`;
    const filePath = path.join(exportDir, filename);

    const csvWriter = createCsvWriter({
      path: filePath,
      header: [
        { id: 'id', title: '记录ID' },
        { id: 'sampleName', title: '样品名称' },
        { id: 'sampleCode', title: '样品编号' },
        { id: 'borrowerName', title: '借用人' },
        { id: 'borrowerContact', title: '联系方式' },
        { id: 'borrowDate', title: '借用日期' },
        { id: 'expectedReturnDate', title: '预计归还日期' },
        { id: 'actualReturnDate', title: '实际归还日期' },
        { id: 'status', title: '状态' },
        { id: 'damageNote', title: '损坏/缺件说明' }
      ]
    });

    const statusMap = {
      [BorrowStatus.BORROWED]: '借用中',
      [BorrowStatus.RETURNED]: '已归还',
      [BorrowStatus.OVERDUE]: '已逾期'
    };

    const data = recordsWithSamples.map(record => ({
      id: record.id,
      sampleName: record.sample?.name || '',
      sampleCode: record.sample?.code || '',
      borrowerName: record.borrowerName,
      borrowerContact: record.borrowerContact,
      borrowDate: record.createdAt ? record.createdAt.split('T')[0] : '',
      expectedReturnDate: record.expectedReturnDate ? record.expectedReturnDate.split('T')[0] : '',
      actualReturnDate: record.actualReturnDate ? record.actualReturnDate.split('T')[0] : '',
      status: statusMap[record.status] || record.status,
      damageNote: record.damageNote || ''
    }));

    await csvWriter.writeRecords(data);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
    fileStream.on('end', () => {
      fs.unlinkSync(filePath);
    });
  } catch (error) {
    console.error('Error exporting borrow records:', error);
    res.status(500).json({ error: '导出借用记录失败' });
  }
});

app.get('/api/samples/export-template', async (req, res) => {
  try {
    const exportDir = path.join(__dirname, 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const filename = 'sample-import-template.csv';
    const filePath = path.join(exportDir, filename);

    const csvWriter = createCsvWriter({
      path: filePath,
      header: [
        { id: 'name', title: '名称' },
        { id: 'code', title: '编号' },
        { id: 'category', title: '分类' },
        { id: 'location', title: '库存位置' },
        { id: 'deposit', title: '押金' },
        { id: 'value', title: '价值' }
      ]
    });

    const sampleData = [
      { name: '示例样品1', code: 'SAMPLE001', category: '相机', location: 'A柜-1层', deposit: 1000, value: 5000 },
      { name: '示例样品2', code: 'SAMPLE002', category: '镜头', location: 'A柜-2层', deposit: 500, value: 2000 }
    ];

    await csvWriter.writeRecords(sampleData);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
    fileStream.on('end', () => {
      fs.unlinkSync(filePath);
    });
  } catch (error) {
    console.error('Error exporting template:', error);
    res.status(500).json({ error: '导出模板失败' });
  }
});

const startServer = async () => {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`样品借用台账系统后端服务运行在 http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('启动服务器失败:', error);
    process.exit(1);
  }
};

startServer();

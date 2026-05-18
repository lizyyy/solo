const express = require('express');
const path = require('path');
const { allQuery, getQuery, runQuery } = require('./db');
const { exportRecords, importRecords } = require('./importExport');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

app.get('/', (req, res) => {
  res.json({
    name: '艺术品寄存库艺术品出入库 API',
    version: '1.0.0',
    endpoints: {
      create: 'POST /api/records',
      update: 'PUT /api/records/:id',
      query: 'GET /api/records',
      export: 'GET /api/records/export',
      import: 'POST /api/records/import'
    }
  });
});

app.post('/api/records', async (req, res) => {
  try {
    const {
      record_code,
      record_type,
      artwork_code,
      store_code,
      handler,
      record_date,
      remarks,
      register_code,
      has_dual_auth,
      auth_by,
      auth_date
    } = req.body;

    if (!record_code || !record_type || !artwork_code || !store_code || !handler || !record_date) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段',
        required_fields: ['record_code', 'record_type', 'artwork_code', 'store_code', 'handler', 'record_date']
      });
    }

    if (!['inbound', 'outbound'].includes(record_type)) {
      return res.status(400).json({
        success: false,
        error: 'record_type 必须是 inbound (入库) 或 outbound (出库)'
      });
    }

    const artwork = await getQuery('SELECT * FROM artworks WHERE artwork_code = ?', [artwork_code]);
    if (!artwork) {
      return res.status(404).json({
        success: false,
        error: `艺术品不存在: ${artwork_code}`
      });
    }

    const store = await getQuery('SELECT * FROM stores WHERE store_code = ?', [store_code]);
    if (!store) {
      return res.status(404).json({
        success: false,
        error: `门店不存在: ${store_code}`
      });
    }

    const existingRecord = await getQuery('SELECT * FROM inventory_records WHERE record_code = ?', [record_code]);
    if (existingRecord) {
      return res.status(409).json({
        success: false,
        error: `记录编号已存在: ${record_code}`
      });
    }

    let status = 'pending';
    let warnings = [];

    if (record_type === 'outbound') {
      if (artwork.requires_dual_auth && !has_dual_auth) {
        warnings.push({
          type: 'high_value_without_auth',
          message: `高估值艺术品出库需要二次授权: ${artwork.artwork_name} (估值: ¥${artwork.estimated_value.toLocaleString()})`,
          artwork_code: artwork_code,
          artwork_name: artwork.artwork_name,
          estimated_value: artwork.estimated_value
        });
      }
      if (has_dual_auth && auth_by) {
        status = 'completed';
      } else if (!artwork.requires_dual_auth) {
        status = 'completed';
      }
    } else {
      status = 'completed';
    }

    if (register_code) {
      const sameRegister = await allQuery('SELECT * FROM inventory_records WHERE register_code = ?', [register_code]);
      if (sameRegister.length > 0) {
        const hasDifferentType = sameRegister.some(r => r.record_type !== record_type);
        if (hasDifferentType) {
          warnings.push({
            type: 'register_inconsistency',
            message: `出入库册 ${register_code} 包含不同类型的出入库记录`,
            register_code: register_code
          });
        }
      }
    }

    await runQuery(
      `INSERT INTO inventory_records (
        record_code, record_type, artwork_id, store_id, handler, record_date,
        status, remarks, register_code, has_dual_auth, auth_by, auth_date,
        consistency_checked, consistency_result
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record_code, record_type, artwork.id, store.id, handler, record_date,
        status, remarks, register_code, has_dual_auth ? 1 : 0, auth_by, auth_date,
        warnings.some(w => w.type === 'register_inconsistency') ? 1 : 0,
        warnings.some(w => w.type === 'register_inconsistency') ? 'inconsistent' : 'consistent'
      ]
    );

    if (record_type === 'outbound' && status === 'completed') {
      await runQuery('UPDATE artworks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['out_of_storage', artwork.id]);
    } else if (record_type === 'inbound') {
      await runQuery('UPDATE artworks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['in_storage', artwork.id]);
    }

    const newRecord = await getQuery(`
      SELECT 
        r.id, r.record_code, r.record_type, 
        a.artwork_code, a.artwork_name, a.artist, a.estimated_value,
        s.store_code, s.store_name,
        r.handler, r.record_date, r.status, r.remarks,
        r.register_code, r.has_dual_auth, r.auth_by, r.auth_date,
        r.consistency_checked, r.consistency_result,
        r.created_at
      FROM inventory_records r
      JOIN artworks a ON r.artwork_id = a.id
      JOIN stores s ON r.store_id = s.id
      WHERE r.record_code = ?
    `, [record_code]);

    res.json({
      success: true,
      data: newRecord,
      warnings: warnings.length > 0 ? warnings : undefined
    });

  } catch (err) {
    console.error('创建记录失败:', err);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      error_details: err.message
    });
  }
});

app.put('/api/records/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      handler,
      record_date,
      status,
      remarks,
      has_dual_auth,
      auth_by,
      auth_date
    } = req.body;

    const record = await getQuery('SELECT * FROM inventory_records WHERE id = ?', [id]);
    if (!record) {
      return res.status(404).json({
        success: false,
        error: `记录不存在: ID=${id}`
      });
    }

    const updateFields = [];
    const updateValues = [];

    if (handler !== undefined) {
      updateFields.push('handler = ?');
      updateValues.push(handler);
    }
    if (record_date !== undefined) {
      updateFields.push('record_date = ?');
      updateValues.push(record_date);
    }
    if (status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(status);
    }
    if (remarks !== undefined) {
      updateFields.push('remarks = ?');
      updateValues.push(remarks);
    }
    if (has_dual_auth !== undefined) {
      updateFields.push('has_dual_auth = ?');
      updateValues.push(has_dual_auth ? 1 : 0);
    }
    if (auth_by !== undefined) {
      updateFields.push('auth_by = ?');
      updateValues.push(auth_by);
    }
    if (auth_date !== undefined) {
      updateFields.push('auth_date = ?');
      updateValues.push(auth_date);
    }

    if (updateFields.length > 0) {
      updateValues.push(id);
      await runQuery(`UPDATE inventory_records SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);
    }

    const updatedRecord = await getQuery(`
      SELECT 
        r.id, r.record_code, r.record_type, 
        a.artwork_code, a.artwork_name, a.artist, a.estimated_value,
        s.store_code, s.store_name,
        r.handler, r.record_date, r.status, r.remarks,
        r.register_code, r.has_dual_auth, r.auth_by, r.auth_date,
        r.consistency_checked, r.consistency_result,
        r.created_at
      FROM inventory_records r
      JOIN artworks a ON r.artwork_id = a.id
      JOIN stores s ON r.store_id = s.id
      WHERE r.id = ?
    `, [id]);

    res.json({
      success: true,
      data: updatedRecord
    });

  } catch (err) {
    console.error('更新记录失败:', err);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      error_details: err.message
    });
  }
});

app.get('/api/records', async (req, res) => {
  try {
    const {
      record_type,
      status,
      handler,
      store_code,
      start_date,
      end_date,
      page = 1,
      page_size = 20
    } = req.query;

    let sql = `
      SELECT 
        r.id, r.record_code, r.record_type, 
        a.artwork_code, a.artwork_name, a.artist, a.estimated_value,
        s.store_code, s.store_name,
        r.handler, r.record_date, r.status, r.remarks,
        r.register_code, r.has_dual_auth, r.auth_by, r.auth_date,
        r.consistency_checked, r.consistency_result,
        r.created_at
      FROM inventory_records r
      JOIN artworks a ON r.artwork_id = a.id
      JOIN stores s ON r.store_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (record_type) {
      sql += ' AND r.record_type = ?';
      params.push(record_type);
    }
    if (status) {
      sql += ' AND r.status = ?';
      params.push(status);
    }
    if (handler) {
      sql += ' AND r.handler LIKE ?';
      params.push(`%${handler}%`);
    }
    if (store_code) {
      sql += ' AND s.store_code = ?';
      params.push(store_code);
    }
    if (start_date) {
      sql += ' AND r.record_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      sql += ' AND r.record_date <= ?';
      params.push(end_date);
    }

    sql += ' ORDER BY r.record_date DESC, r.created_at DESC';

    const allRecords = await allQuery(sql, params);

    const pageNum = parseInt(page);
    const pageSize = parseInt(page_size);
    const total = allRecords.length;
    const totalPages = Math.ceil(total / pageSize);
    const startIndex = (pageNum - 1) * pageSize;
    const records = allRecords.slice(startIndex, startIndex + pageSize);

    res.json({
      success: true,
      data: {
        records,
        pagination: {
          page: pageNum,
          page_size: pageSize,
          total,
          total_pages: totalPages
        },
        filters: {
          record_type: record_type || null,
          status: status || null,
          handler: handler || null,
          store_code: store_code || null,
          start_date: start_date || null,
          end_date: end_date || null
        }
      }
    });

  } catch (err) {
    console.error('查询记录失败:', err);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      error_details: err.message
    });
  }
});

app.get('/api/records/export', async (req, res) => {
  try {
    const {
      record_type,
      status,
      handler,
      store_code,
      start_date,
      end_date,
      format = 'csv'
    } = req.query;

    const result = await exportRecords({
      record_type,
      status,
      handler,
      store_code,
      start_date,
      end_date,
      format
    });

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="inventory-records-${Date.now()}.csv"`);
      res.send(result);
    } else {
      res.json({
        success: true,
        data: result
      });
    }

  } catch (err) {
    console.error('导出记录失败:', err);
    res.status(500).json({
      success: false,
      error: '导出失败',
      error_details: err.message
    });
  }
});

app.post('/api/records/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '请上传CSV文件'
      });
    }

    const result = await importRecords(req.file.path);

    res.json({
      success: true,
      data: result
    });

  } catch (err) {
    console.error('导入记录失败:', err);
    res.status(500).json({
      success: false,
      error: '导入失败',
      error_details: err.message
    });
  }
});

app.get('/api/artworks', async (req, res) => {
  try {
    const artworks = await allQuery('SELECT * FROM artworks ORDER BY artwork_code');
    res.json({
      success: true,
      data: artworks
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/stores', async (req, res) => {
  try {
    const stores = await allQuery('SELECT * FROM stores ORDER BY store_code');
    res.json({
      success: true,
      data: stores
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log('========================================');
  console.log('艺术品寄存库艺术品出入库 API');
  console.log(`服务已启动: http://localhost:${PORT}`);
  console.log('========================================');
});
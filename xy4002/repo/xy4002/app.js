const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const db = require('./database');
const multer = require('multer');
const csvParser = require('csv-parser');
const { Parser } = require('json2csv');
const fs = require('fs');

const app = express();
const PORT = 3001;
const upload = multer({ dest: 'uploads/' });

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

function addLog(operationType, materialId, borrowRecordId, description, callback) {
  db.run(
    'INSERT INTO operation_logs (operation_type, material_id, borrow_record_id, description) VALUES (?, ?, ?, ?)',
    [operationType, materialId, borrowRecordId, description],
    callback
  );
}

function checkOverdue() {
  const today = new Date().toISOString().split('T')[0];
  db.run(
    `UPDATE borrow_records 
     SET status = 'overdue', updated_at = CURRENT_TIMESTAMP 
     WHERE status = 'borrowed' AND expected_return_date < ?`,
    [today],
    function(err) {
      if (err) console.error('检查逾期记录失败:', err);
    }
  );
}

setInterval(checkOverdue, 60000);
checkOverdue();

app.get('/', (req, res) => {
  res.redirect('/materials');
});

app.get('/materials', (req, res) => {
  checkOverdue();
  const { keyword, status, category } = req.query;
  let sql = `SELECT m.*, 
              (SELECT COUNT(*) FROM borrow_records WHERE material_id = m.id AND status = 'borrowed') as borrowed_count,
              (SELECT COUNT(*) FROM borrow_records WHERE material_id = m.id AND status = 'overdue') as overdue_count
              FROM materials m WHERE 1=1`;
  const params = [];

  if (keyword) {
    sql += ' AND (m.name LIKE ? OR m.category LIKE ? OR m.description LIKE ?)';
    const likeKeyword = `%${keyword}%`;
    params.push(likeKeyword, likeKeyword, likeKeyword);
  }

  if (status) {
    sql += ' AND m.status = ?';
    params.push(status);
  }

  if (category) {
    sql += ' AND m.category = ?';
    params.push(category);
  }

  sql += ' ORDER BY m.created_at DESC';

  db.all(sql, params, (err, materials) => {
    if (err) {
      res.status(500).send('Error retrieving materials');
      return;
    }

    db.all('SELECT DISTINCT category FROM materials WHERE category IS NOT NULL ORDER BY category', (err, categories) => {
      if (err) categories = [];
      res.render('materials', { 
        materials, 
        keyword, 
        status, 
        category,
        categories: categories.map(c => c.category)
      });
    });
  });
});

app.get('/materials/new', (req, res) => {
  res.render('material_form', { material: null });
});

app.get('/materials/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM materials WHERE id = ?', [id], (err, material) => {
    if (err) {
      res.status(500).send('Error retrieving material');
      return;
    }
    if (!material) {
      res.status(404).send('物资未找到');
      return;
    }

    db.all(
      `SELECT br.*, m.name as material_name 
       FROM borrow_records br 
       JOIN materials m ON br.material_id = m.id 
       WHERE br.material_id = ? 
       ORDER BY br.created_at DESC`,
      [id],
      (err, records) => {
        if (err) records = [];
        res.render('material_detail', { material, records });
      }
    );
  });
});

app.get('/materials/:id/edit', (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM materials WHERE id = ?', [id], (err, material) => {
    if (err) {
      res.status(500).send('Error retrieving material');
      return;
    }
    if (!material) {
      res.status(404).send('物资未找到');
      return;
    }
    res.render('material_form', { material });
  });
});

app.post('/materials', (req, res) => {
  const { name, category, total_quantity, available_quantity, unit, description } = req.body;
  const total = parseInt(total_quantity) || 0;
  const available = parseInt(available_quantity) || total;

  db.run(
    `INSERT INTO materials (name, category, total_quantity, available_quantity, unit, description, status) 
     VALUES (?, ?, ?, ?, ?, ?, 'active')`,
    [name, category, total, available, unit, description],
    function(err) {
      if (err) {
        res.status(500).send('Error creating material');
        return;
      }
      const materialId = this.lastID;
      addLog('register', materialId, null, `登记物资：${name}（${total}${unit}）`, () => {
        res.redirect(`/materials/${materialId}`);
      });
    }
  );
});

app.post('/materials/:id', (req, res) => {
  const { id } = req.params;
  const { name, category, total_quantity, available_quantity, unit, description } = req.body;

  db.get('SELECT * FROM materials WHERE id = ?', [id], (err, oldMaterial) => {
    if (err || !oldMaterial) {
      res.status(404).send('物资未找到');
      return;
    }

    db.run(
      `UPDATE materials 
       SET name = ?, category = ?, total_quantity = ?, available_quantity = ?, unit = ?, description = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [name, category, total_quantity, available_quantity, unit, description, id],
      function(err) {
        if (err) {
          res.status(500).send('Error updating material');
          return;
        }
        addLog('edit', id, null, `编辑物资：${oldMaterial.name} → ${name}`, () => {
          res.redirect(`/materials/${id}`);
        });
      }
    );
  });
});

app.post('/materials/:id/scrap', (req, res) => {
  const { id } = req.params;
  const { scrap_reason } = req.body;

  db.get('SELECT * FROM materials WHERE id = ?', [id], (err, material) => {
    if (err || !material) {
      res.status(404).send('物资未找到');
      return;
    }

    db.get(
      `SELECT COUNT(*) as count FROM borrow_records WHERE material_id = ? AND status IN ('borrowed', 'overdue')`,
      [id],
      (err, result) => {
        if (err || result.count > 0) {
          res.status(400).send('该物资还有未归还的借出记录，无法报废');
          return;
        }

        db.run(
          `UPDATE materials SET status = 'scrapped', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [id],
          function(err) {
            if (err) {
              res.status(500).send('Error scrapping material');
              return;
            }
            addLog('scrap', id, null, `报废物资：${material.name}${scrap_reason ? '，原因：' + scrap_reason : ''}`, () => {
              res.redirect(`/materials/${id}`);
            });
          }
        );
      }
    );
  });
});

app.get('/borrow/new', (req, res) => {
  const { material_id } = req.query;
  db.all(
    `SELECT * FROM materials WHERE status = 'active' AND available_quantity > 0 ORDER BY name`,
    (err, materials) => {
      if (err) materials = [];
      res.render('borrow_form', { materials, selectedMaterialId: material_id });
    }
  );
});

app.post('/borrow', (req, res) => {
  const { material_id, resident_name, resident_phone, borrow_quantity, expected_return_date } = req.body;
  const quantity = parseInt(borrow_quantity) || 1;

  db.get('SELECT * FROM materials WHERE id = ?', [material_id], (err, material) => {
    if (err || !material) {
      res.status(404).send('物资未找到');
      return;
    }

    if (material.status === 'scrapped') {
      res.status(400).send('该物资已报废，无法借出');
      return;
    }

    if (material.available_quantity < quantity) {
      res.status(400).send(`库存不足，当前可用数量：${material.available_quantity}`);
      return;
    }

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      db.run(
        `INSERT INTO borrow_records (material_id, resident_name, resident_phone, borrow_quantity, expected_return_date, status) 
         VALUES (?, ?, ?, ?, ?, 'borrowed')`,
        [material_id, resident_name, resident_phone, quantity, expected_return_date],
        function(err) {
          if (err) {
            db.run('ROLLBACK');
            res.status(500).send('Error creating borrow record');
            return;
          }
          const recordId = this.lastID;

          db.run(
            `UPDATE materials SET available_quantity = available_quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [quantity, material_id],
            function(err) {
              if (err) {
                db.run('ROLLBACK');
                res.status(500).send('Error updating material quantity');
                return;
              }

              addLog('borrow', material_id, recordId, 
                `借出物资：${material.name}（${quantity}${material.unit}）给 ${resident_name}，预计归还日期：${expected_return_date}`, 
                () => {
                  db.run('COMMIT');
                  res.redirect('/borrow-records');
                }
              );
            }
          );
        }
      );
    });
  });
});

app.get('/borrow-records', (req, res) => {
  checkOverdue();
  const { status, keyword } = req.query;
  let sql = `SELECT br.*, m.name as material_name, m.unit as material_unit
             FROM borrow_records br
             JOIN materials m ON br.material_id = m.id
             WHERE 1=1`;
  const params = [];

  if (status) {
    sql += ' AND br.status = ?';
    params.push(status);
  }

  if (keyword) {
    sql += ' AND (m.name LIKE ? OR br.resident_name LIKE ? OR br.resident_phone LIKE ?)';
    const likeKeyword = `%${keyword}%`;
    params.push(likeKeyword, likeKeyword, likeKeyword);
  }

  sql += ' ORDER BY br.created_at DESC';

  db.all(sql, params, (err, records) => {
    if (err) {
      res.status(500).send('Error retrieving borrow records');
      return;
    }
    res.render('borrow_records', { records, status, keyword });
  });
});

app.get('/borrow-records/:id', (req, res) => {
  const { id } = req.params;
  db.get(
    `SELECT br.*, m.name as material_name, m.unit as material_unit
     FROM borrow_records br
     JOIN materials m ON br.material_id = m.id
     WHERE br.id = ?`,
    [id],
    (err, record) => {
      if (err || !record) {
        res.status(404).send('记录未找到');
        return;
      }
      res.render('borrow_record_detail', { record });
    }
  );
});

app.post('/return/:id', (req, res) => {
  const { id } = req.params;
  const { return_remark } = req.body;

  db.get(
    `SELECT br.*, m.name as material_name, m.unit as material_unit
     FROM borrow_records br
     JOIN materials m ON br.material_id = m.id
     WHERE br.id = ?`,
    [id],
    (err, record) => {
      if (err || !record) {
        res.status(404).send('记录未找到');
        return;
      }

      if (record.status === 'returned') {
        res.status(400).send('该记录已归还');
        return;
      }

      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        db.run(
          `UPDATE borrow_records 
           SET status = 'returned', actual_return_date = CURRENT_TIMESTAMP, return_remark = ?, updated_at = CURRENT_TIMESTAMP 
           WHERE id = ?`,
          [return_remark, id],
          function(err) {
            if (err) {
              db.run('ROLLBACK');
              res.status(500).send('Error updating borrow record');
              return;
            }

            db.run(
              `UPDATE materials SET available_quantity = available_quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
              [record.borrow_quantity, record.material_id],
              function(err) {
                if (err) {
                  db.run('ROLLBACK');
                  res.status(500).send('Error updating material quantity');
                  return;
                }

                addLog('return', record.material_id, id, 
                  `归还物资：${record.material_name}（${record.borrow_quantity}${record.material_unit}）${return_remark ? '，备注：' + return_remark : ''}`, 
                  () => {
                    db.run('COMMIT');
                    res.redirect('/borrow-records');
                  }
                );
              }
            );
          }
        );
      });
    }
  );
});

app.get('/logs', (req, res) => {
  const { operation_type, keyword } = req.query;
  let sql = `SELECT ol.*, m.name as material_name
             FROM operation_logs ol
             LEFT JOIN materials m ON ol.material_id = m.id
             WHERE 1=1`;
  const params = [];

  if (operation_type) {
    sql += ' AND ol.operation_type = ?';
    params.push(operation_type);
  }

  if (keyword) {
    sql += ' AND (ol.description LIKE ? OR m.name LIKE ?)';
    const likeKeyword = `%${keyword}%`;
    params.push(likeKeyword, likeKeyword);
  }

  sql += ' ORDER BY ol.created_at DESC LIMIT 500';

  db.all(sql, params, (err, logs) => {
    if (err) {
      res.status(500).send('Error retrieving logs');
      return;
    }
    res.render('logs', { logs, operation_type, keyword });
  });
});

app.get('/import', (req, res) => {
  res.render('import');
});

app.post('/import', upload.single('csvfile'), (req, res) => {
  if (!req.file) {
    res.status(400).send('请选择文件');
    return;
  }

  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csvParser())
    .on('data', (data) => results.push(data))
    .on('end', () => {
      let imported = 0;
      const errors = [];

      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        const processNext = (index) => {
          if (index >= results.length) {
            db.run('COMMIT', (err) => {
              if (err) {
                res.status(500).send('导入失败');
                return;
              }
              fs.unlinkSync(req.file.path);
              res.render('import_result', { imported, total: results.length, errors });
            });
            return;
          }

          const row = results[index];
          const name = row.name || row.物资名称 || row['物资名称'];
          const category = row.category || row.分类 || row['分类'] || '';
          const total = parseInt(row.total_quantity || row.总数量 || row['总数量']) || 0;
          const available = parseInt(row.available_quantity || row.可用数量 || row['可用数量']) || total;
          const unit = row.unit || row.单位 || row['单位'] || '个';
          const description = row.description || row.描述 || row['描述'] || '';

          if (!name) {
            errors.push(`第 ${index + 2} 行：缺少物资名称`);
            processNext(index + 1);
            return;
          }

          db.run(
            `INSERT INTO materials (name, category, total_quantity, available_quantity, unit, description, status) 
             VALUES (?, ?, ?, ?, ?, ?, 'active')`,
            [name, category, total, available, unit, description],
            function(err) {
              if (err) {
                errors.push(`第 ${index + 2} 行：${err.message}`);
              } else {
                imported++;
                addLog('import', this.lastID, null, `导入物资：${name}（${total}${unit}）`, () => {});
              }
              processNext(index + 1);
            }
          );
        };

        processNext(0);
      });
    });
});

app.get('/export/inventory', (req, res) => {
  db.all(
    `SELECT id, name, category, total_quantity, available_quantity, unit, description, 
            CASE status WHEN 'active' THEN '正常' WHEN 'scrapped' THEN '已报废' END as status_text,
            created_at, updated_at
     FROM materials ORDER BY created_at DESC`,
    (err, materials) => {
      if (err) {
        res.status(500).send('导出失败');
        return;
      }

      const fields = [
        { label: 'ID', value: 'id' },
        { label: '物资名称', value: 'name' },
        { label: '分类', value: 'category' },
        { label: '总数量', value: 'total_quantity' },
        { label: '可用数量', value: 'available_quantity' },
        { label: '单位', value: 'unit' },
        { label: '描述', value: 'description' },
        { label: '状态', value: 'status_text' },
        { label: '创建时间', value: 'created_at' },
        { label: '更新时间', value: 'updated_at' }
      ];

      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(materials);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=inventory_${new Date().toISOString().split('T')[0]}.csv`);
      res.send('\uFEFF' + csv);
    }
  );
});

app.get('/export/borrows', (req, res) => {
  db.all(
    `SELECT br.id, m.name as material_name, br.resident_name, br.resident_phone, 
            br.borrow_quantity, m.unit, br.expected_return_date, br.actual_return_date,
            CASE br.status 
              WHEN 'borrowed' THEN '借出中' 
              WHEN 'overdue' THEN '已逾期' 
              WHEN 'returned' THEN '已归还' 
            END as status_text,
            br.return_remark, br.created_at
     FROM borrow_records br
     JOIN materials m ON br.material_id = m.id
     ORDER BY br.created_at DESC`,
    (err, records) => {
      if (err) {
        res.status(500).send('导出失败');
        return;
      }

      const fields = [
        { label: '记录ID', value: 'id' },
        { label: '物资名称', value: 'material_name' },
        { label: '居民姓名', value: 'resident_name' },
        { label: '联系电话', value: 'resident_phone' },
        { label: '借出数量', value: 'borrow_quantity' },
        { label: '单位', value: 'unit' },
        { label: '预计归还日期', value: 'expected_return_date' },
        { label: '实际归还时间', value: 'actual_return_date' },
        { label: '状态', value: 'status_text' },
        { label: '归还备注', value: 'return_remark' },
        { label: '创建时间', value: 'created_at' }
      ];

      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(records);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=borrow_records_${new Date().toISOString().split('T')[0]}.csv`);
      res.send('\uFEFF' + csv);
    }
  );
});

app.get('/export/logs', (req, res) => {
  db.all(
    `SELECT ol.id, 
            CASE ol.operation_type 
              WHEN 'register' THEN '登记'
              WHEN 'edit' THEN '编辑'
              WHEN 'borrow' THEN '借出'
              WHEN 'return' THEN '归还'
              WHEN 'scrap' THEN '报废'
              WHEN 'import' THEN '导入'
            END as operation_type_text,
            m.name as material_name, ol.description, ol.created_at
     FROM operation_logs ol
     LEFT JOIN materials m ON ol.material_id = m.id
     ORDER BY ol.created_at DESC`,
    (err, logs) => {
      if (err) {
        res.status(500).send('导出失败');
        return;
      }

      const fields = [
        { label: '记录ID', value: 'id' },
        { label: '操作类型', value: 'operation_type_text' },
        { label: '相关物资', value: 'material_name' },
        { label: '操作描述', value: 'description' },
        { label: '操作时间', value: 'created_at' }
      ];

      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(logs);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=operation_logs_${new Date().toISOString().split('T')[0]}.csv`);
      res.send('\uFEFF' + csv);
    }
  );
});

app.listen(PORT, () => {
  console.log(`社区活动物资借还登记系统已启动: http://localhost:${PORT}`);
});

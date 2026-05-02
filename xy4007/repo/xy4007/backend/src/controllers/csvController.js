const db = require('../database/db');
const { Parser } = require('json2csv');
const csv = require('csv-parser');
const { Readable } = require('stream');
const { validatePhone, validateEstimatedTime } = require('../utils/validators');

const exportTodayOrders = (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  db.all(`
    SELECT 
      o.id as 工单号,
      c.name as 客户姓名,
      c.phone as 客户电话,
      d.brand as 设备品牌,
      d.model as 设备型号,
      d.imei as IMEI,
      t.name as 维修师傅,
      o.fault_description as 故障描述,
      o.quote as 报价,
      o.estimated_completion_time as 预计完成时间,
      o.status as 状态,
      o.created_at as 创建时间,
      o.updated_at as 更新时间
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    JOIN devices d ON o.device_id = d.id
    LEFT JOIN technicians t ON o.technician_id = t.id
    WHERE DATE(o.created_at) = ?
    ORDER BY o.created_at DESC
  `, [today], (err, rows) => {
    if (err) {
      console.error('导出当日工单失败:', err);
      res.status(500).json({ error: '导出当日工单失败' });
      return;
    }

    if (rows.length === 0) {
      res.status(404).json({ error: '今日暂无工单' });
      return;
    }

    try {
      const fields = [
        '工单号', '客户姓名', '客户电话', '设备品牌', '设备型号',
        'IMEI', '维修师傅', '故障描述', '报价', '预计完成时间',
        '状态', '创建时间', '更新时间'
      ];
      const json2csvParser = new Parser({ fields });
      const csvData = json2csvParser.parse(rows);

      res.header('Content-Type', 'text/csv; charset=utf-8');
      res.attachment(`工单_${today}.csv`);
      res.send('\uFEFF' + csvData);
    } catch (err) {
      console.error('生成CSV失败:', err);
      res.status(500).json({ error: '生成CSV失败' });
    }
  });
};

const importOrders = (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: '请上传CSV文件' });
    return;
  }

  const results = [];
  const errors = [];
  let successCount = 0;

  const stream = Readable.from(req.file.buffer.toString());

  stream
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', () => {
      if (results.length === 0) {
        res.status(400).json({ error: 'CSV文件为空' });
        return;
      }

      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        const processRow = (index) => {
          if (index >= results.length) {
            db.run('COMMIT', (err) => {
              if (err) {
                console.error('提交事务失败:', err);
                res.status(500).json({ error: '导入失败' });
                return;
              }

              res.json({
                message: `导入完成，成功 ${successCount} 条，失败 ${errors.length} 条`,
                successCount,
                errors: errors.length > 0 ? errors : undefined
              });
            });
            return;
          }

          const row = results[index];
          const rowNum = index + 2;

          const requiredFields = ['客户姓名', '客户电话', '设备品牌', '设备型号', '故障描述'];
          const missingFields = requiredFields.filter(f => !row[f]);

          if (missingFields.length > 0) {
            errors.push(`第 ${rowNum} 行：缺少必填字段 ${missingFields.join(', ')}`);
            processRow(index + 1);
            return;
          }

          const phoneValidation = validatePhone(row['客户电话']);
          if (!phoneValidation.valid) {
            errors.push(`第 ${rowNum} 行：${phoneValidation.message}`);
            processRow(index + 1);
            return;
          }

          db.get(`SELECT id FROM technicians WHERE name = ?`, [row['维修师傅'] || ''], (err, tech) => {
            if (err) {
              errors.push(`第 ${rowNum} 行：查询维修师傅失败`);
              processRow(index + 1);
              return;
            }

            db.run(`
              INSERT OR IGNORE INTO customers (name, phone) VALUES (?, ?)
            `, [row['客户姓名'], row['客户电话']], (err) => {
              if (err) {
                errors.push(`第 ${rowNum} 行：创建客户失败`);
                processRow(index + 1);
                return;
              }

              db.get(`SELECT id FROM customers WHERE phone = ?`, [row['客户电话']], (err, customer) => {
                if (err || !customer) {
                  errors.push(`第 ${rowNum} 行：获取客户ID失败`);
                  processRow(index + 1);
                  return;
                }

                db.run(`
                  INSERT INTO devices (customer_id, brand, model, imei)
                  VALUES (?, ?, ?, ?)
                `, [customer.id, row['设备品牌'], row['设备型号'], row['IMEI'] || null], function(err) {
                  if (err) {
                    errors.push(`第 ${rowNum} 行：创建设备失败`);
                    processRow(index + 1);
                    return;
                  }

                  const deviceId = this.lastID;
                  const status = row['状态'] || '待检测';
                  const validStatuses = ['待检测', '待报价', '维修中', '待取机', '已完成', '已取消'];
                  const finalStatus = validStatuses.includes(status) ? status : '待检测';

                  db.run(`
                    INSERT INTO orders (
                      customer_id, device_id, technician_id, fault_description,
                      quote, estimated_completion_time, status, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                  `, [
                    customer.id,
                    deviceId,
                    tech ? tech.id : null,
                    row['故障描述'],
                    row['报价'] ? parseFloat(row['报价']) : null,
                    row['预计完成时间'] || null,
                    finalStatus,
                    row['创建时间'] || new Date().toISOString()
                  ], function(err) {
                    if (err) {
                      errors.push(`第 ${rowNum} 行：创建工单失败`);
                      processRow(index + 1);
                      return;
                    }

                    db.run(`
                      INSERT INTO status_history (order_id, old_status, new_status)
                      VALUES (?, NULL, ?)
                    `, [this.lastID, finalStatus], (err) => {
                      if (!err) {
                        successCount++;
                      }
                      processRow(index + 1);
                    });
                  });
                });
              });
            });
          });
        };

        processRow(0);
      });
    })
    .on('error', (err) => {
      console.error('解析CSV失败:', err);
      res.status(500).json({ error: '解析CSV文件失败' });
    });
};

module.exports = {
  exportTodayOrders,
  importOrders
};

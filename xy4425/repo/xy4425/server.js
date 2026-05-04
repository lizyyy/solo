const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

const upload = multer({ dest: 'uploads/' });

const STANDARD_GROOVE_DISTANCE_MIN = 150;
const STANDARD_GROOVE_DISTANCE_MAX = 200;
const DIMENSION_TOLERANCE = 2;

function detectRisks(orderId) {
  return new Promise((resolve, reject) => {
    const risks = [];

    db.all(`SELECT * FROM dimension_specs WHERE order_id = ?`, [orderId], (err, specs) => {
      if (err) {
        reject(err);
        return;
      }

      db.all(`SELECT * FROM cutting_logs WHERE order_id = ?`, [orderId], (err, cuts) => {
        if (err) {
          reject(err);
          return;
        }

        cuts.forEach(cut => {
          const spec = specs.find(s => s.piece_name === cut.piece_name);
          if (spec) {
            if (spec.direction && cut.direction && spec.direction !== cut.direction) {
              risks.push({
                type: 'direction_error',
                severity: 'high',
                message: `部件 ${cut.piece_name} 切割方向错误: 要求 ${spec.direction}, 实际 ${cut.direction}`,
                piece_name: cut.piece_name
              });
            }

            if (spec.spec_length && cut.length) {
              const diff = Math.abs(spec.spec_length - cut.length);
              if (diff > DIMENSION_TOLERANCE) {
                risks.push({
                  type: 'dimension_error',
                  severity: 'high',
                  message: `部件 ${cut.piece_name} 长度尺寸偏差: 要求 ${spec.spec_length}mm, 实际 ${cut.length}mm, 偏差 ${diff}mm`,
                  piece_name: cut.piece_name
                });
              }
            }

            if (spec.spec_width && cut.width) {
              const diff = Math.abs(spec.spec_width - cut.width);
              if (diff > DIMENSION_TOLERANCE) {
                risks.push({
                  type: 'dimension_error',
                  severity: 'high',
                  message: `部件 ${cut.piece_name} 宽度尺寸偏差: 要求 ${spec.spec_width}mm, 实际 ${cut.width}mm, 偏差 ${diff}mm`,
                  piece_name: cut.piece_name
                });
              }
            }
          }
        });

        db.all(`SELECT * FROM slabs WHERE order_id = ?`, [orderId], (err, slabs) => {
          if (err) {
            reject(err);
            return;
          }

          const batches = {};
          slabs.forEach(slab => {
            if (!batches[slab.batch_number]) {
              batches[slab.batch_number] = [];
            }
            batches[slab.batch_number].push(slab);
          });

          Object.keys(batches).forEach(batch => {
            const batchSlabs = batches[batch];
            const colors = [...new Set(batchSlabs.map(s => s.color).filter(c => c))];
            if (colors.length > 1) {
              risks.push({
                type: 'color_mismatch',
                severity: 'medium',
                message: `批次 ${batch} 存在色差混用问题: 检测到 ${colors.length} 种不同颜色 (${colors.join(', ')})`,
                batch_number: batch
              });
            }
          });

          slabs.forEach(slab => {
            if (slab.has_cracks) {
              risks.push({
                type: 'cracked_slab',
                severity: 'critical',
                message: `石板 ${slab.slab_number} (批次 ${slab.batch_number}) 存在裂纹，禁止装车!`,
                slab_number: slab.slab_number,
                batch_number: slab.batch_number
              });
            }
          });

          db.all(`SELECT * FROM quality_inspections WHERE order_id = ?`, [orderId], (err, inspections) => {
            if (err) {
              reject(err);
              return;
            }

            inspections.forEach(ins => {
              if (ins.has_anti_slip_groove && ins.groove_distance) {
                if (ins.groove_distance < STANDARD_GROOVE_DISTANCE_MIN || 
                    ins.groove_distance > STANDARD_GROOVE_DISTANCE_MAX) {
                  risks.push({
                    type: 'groove_distance_error',
                    severity: 'medium',
                    message: `防滑槽间距不合规: 实际 ${ins.groove_distance}mm, 标准范围 ${STANDARD_GROOVE_DISTANCE_MIN}-${STANDARD_GROOVE_DISTANCE_MAX}mm`,
                    cutting_log_id: ins.cutting_log_id
                  });
                }
              }

              if (ins.has_cracks) {
                risks.push({
                  type: 'crack_after_cutting',
                  severity: 'critical',
                  message: `质检发现切割后部件存在裂纹，禁止装车!`,
                  inspection_id: ins.id
                });
              }

              if (!ins.dimension_ok) {
                risks.push({
                  type: 'dimension_failed',
                  severity: 'high',
                  message: `质检判定尺寸不合格`,
                  inspection_id: ins.id
                });
              }
            });

            resolve(risks);
          });
        });
      });
    });
  });
}

function generateMarkdownRelease(order, slabs, cuts, inspections, comments, risks) {
  const now = new Date().toISOString().split('T')[0];
  
  let md = `# 石材加工厂发货放行单\n\n`;
  md += `## 订单基本信息\n\n`;
  md += `| 项目 | 内容 |\n`;
  md += `|------|------|\n`;
  md += `| 订单号 | ${order.order_number} |\n`;
  md += `| 客户名称 | ${order.customer_name} |\n`;
  md += `| 订单类型 | ${order.order_type} |\n`;
  md += `| 订单日期 | ${order.order_date} |\n`;
  md += `| 预计发货 | ${order.delivery_date || '待定'} |\n`;
  md += `| 当前状态 | ${order.status} |\n\n`;

  md += `## 风险检测报告\n\n`;
  if (risks.length === 0) {
    md += `✅ **无风险项 - 可以发货**\n\n`;
  } else {
    const critical = risks.filter(r => r.severity === 'critical');
    const high = risks.filter(r => r.severity === 'high');
    const medium = risks.filter(r => r.severity === 'medium');

    if (critical.length > 0) {
      md += `🚨 **严重风险 (${critical.length}项) - 禁止发货**\n\n`;
      critical.forEach(r => md += `- ${r.message}\n`);
      md += `\n`;
    }
    if (high.length > 0) {
      md += `⚠️ **高风险 (${high.length}项) - 需立即处理**\n\n`;
      high.forEach(r => md += `- ${r.message}\n`);
      md += `\n`;
    }
    if (medium.length > 0) {
      md += `ℹ️ **中等风险 (${medium.length}项) - 建议关注**\n\n`;
      medium.forEach(r => md += `- ${r.message}\n`);
      md += `\n`;
    }
  }

  md += `## 石板批次信息\n\n`;
  if (slabs.length > 0) {
    md += `| 批次号 | 石板编号 | 颜色 | 厚度(mm) | 宽度(mm) | 高度(mm) | 裂纹 |\n`;
    md += `|--------|----------|------|----------|----------|----------|------|\n`;
    slabs.forEach(s => {
      md += `| ${s.batch_number} | ${s.slab_number} | ${s.color || '-'} | ${s.thickness || '-'} | ${s.width || '-'} | ${s.height || '-'} | ${s.has_cracks ? '❌是' : '✅否'} |\n`;
    });
  } else {
    md += `暂无石板记录\n`;
  }
  md += `\n`;

  md += `## 切割日志\n\n`;
  if (cuts.length > 0) {
    md += `| 部件名称 | 切割类型 | 长度(mm) | 宽度(mm) | 方向 | 设备 | 操作员 | 日期 |\n`;
    md += `|----------|----------|----------|----------|------|------|--------|------|\n`;
    cuts.forEach(c => {
      md += `| ${c.piece_name || '-'} | ${c.cutting_type} | ${c.length || '-'} | ${c.width || '-'} | ${c.direction || '-'} | ${c.machine || '-'} | ${c.operator || '-'} | ${c.cutting_date || '-'} |\n`;
    });
  } else {
    md += `暂无切割记录\n`;
  }
  md += `\n`;

  md += `## 质检记录\n\n`;
  if (inspections.length > 0) {
    md += `| 检查类型 | 倒角 | 防滑槽 | 槽距(mm) | 裂纹 | 尺寸合格 | 检查员 | 结果 |\n`;
    md += `|----------|------|--------|----------|------|----------|--------|------|\n`;
    inspections.forEach(i => {
      md += `| ${i.inspection_type} | ${i.has_chamfer ? '✅' : '❌'} | ${i.has_anti_slip_groove ? '✅' : '❌'} | ${i.groove_distance || '-'} | ${i.has_cracks ? '❌' : '✅'} | ${i.dimension_ok ? '✅' : '❌'} | ${i.inspector || '-'} | ${i.result || '-'} |\n`;
    });
  } else {
    md += `暂无质检记录\n`;
  }
  md += `\n`;

  md += `## 复核意见\n\n`;
  if (comments.length > 0) {
    comments.forEach(c => {
      const levelEmoji = c.risk_level === 'critical' ? '🚨' : c.risk_level === 'high' ? '⚠️' : 'ℹ️';
      md += `### ${levelEmoji} ${c.risk_level.toUpperCase()}\n\n`;
      md += `**复核人:** ${c.reviewer || '未填写'}\n\n`;
      md += `**日期:** ${c.review_date}\n\n`;
      md += `**意见:** ${c.comment}\n\n`;
      md += `---\n\n`;
    });
  } else {
    md += `暂无复核意见\n`;
  }

  md += `---\n\n`;
  md += `*放行单生成时间: ${new Date().toLocaleString()}*\n`;
  md += `*订单ID: ${order.id}*\n`;

  return md;
}

app.get('/api/orders', (req, res) => {
  db.all(`SELECT * FROM orders ORDER BY created_at DESC`, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.get('/api/orders/:id', (req, res) => {
  const orderId = req.params.id;
  
  db.get(`SELECT * FROM orders WHERE id = ?`, [orderId], (err, order) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!order) {
      res.status(404).json({ error: '订单不存在' });
      return;
    }

    db.all(`SELECT * FROM slabs WHERE order_id = ?`, [orderId], (err, slabs) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      db.all(`SELECT * FROM cutting_logs WHERE order_id = ?`, [orderId], (err, cuts) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }

        db.all(`SELECT * FROM quality_inspections WHERE order_id = ?`, [orderId], (err, inspections) => {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }

          db.all(`SELECT * FROM review_comments WHERE order_id = ? ORDER BY created_at DESC`, [orderId], (err, comments) => {
            if (err) {
              res.status(500).json({ error: err.message });
              return;
            }

            db.all(`SELECT * FROM dimension_specs WHERE order_id = ?`, [orderId], (err, specs) => {
              if (err) {
                res.status(500).json({ error: err.message });
                return;
              }

              detectRisks(orderId).then(risks => {
                res.json({
                  order,
                  slabs,
                  cutting_logs: cuts,
                  inspections,
                  comments,
                  dimension_specs: specs,
                  risks
                });
              }).catch(err => {
                res.status(500).json({ error: err.message });
              });
            });
          });
        });
      });
    });
  });
});

app.post('/api/orders', (req, res) => {
  const { order_number, customer_name, order_type, order_date, delivery_date, notes } = req.body;
  
  db.run(
    `INSERT INTO orders (order_number, customer_name, order_type, order_date, delivery_date, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [order_number, customer_name, order_type, order_date, delivery_date, notes],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint')) {
          res.status(400).json({ error: '订单号已存在' });
        } else {
          res.status(500).json({ error: err.message });
        }
        return;
      }
      res.json({ id: this.lastID, message: '订单创建成功' });
    }
  );
});

app.put('/api/orders/:id', (req, res) => {
  const orderId = req.params.id;
  const { status, notes } = req.body;
  const now = new Date().toISOString();

  db.run(
    `UPDATE orders SET status = ?, notes = ?, updated_at = ? WHERE id = ?`,
    [status, notes, now, orderId],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: '订单不存在' });
        return;
      }
      res.json({ message: '订单更新成功' });
    }
  );
});

app.post('/api/orders/:id/slabs', (req, res) => {
  const orderId = req.params.id;
  const { batch_number, slab_number, color, thickness, width, height, area, has_cracks, notes } = req.body;

  db.run(
    `INSERT INTO slabs (order_id, batch_number, slab_number, color, thickness, width, height, area, has_cracks, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [orderId, batch_number, slab_number, color, thickness, width, height, area, has_cracks ? 1 : 0, notes],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, message: '石板记录添加成功' });
    }
  );
});

app.post('/api/orders/:id/cuts', (req, res) => {
  const orderId = req.params.id;
  const { slab_id, cutting_type, piece_name, length, width, direction, machine, operator, cutting_date, notes } = req.body;

  db.run(
    `INSERT INTO cutting_logs (order_id, slab_id, cutting_type, piece_name, length, width, direction, machine, operator, cutting_date, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [orderId, slab_id, cutting_type, piece_name, length, width, direction, machine, operator, cutting_date, notes],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, message: '切割日志添加成功' });
    }
  );
});

app.post('/api/orders/:id/inspections', (req, res) => {
  const orderId = req.params.id;
  const { cutting_log_id, inspection_type, has_chamfer, has_anti_slip_groove, groove_distance, groove_count, has_cracks, dimension_ok, inspector, inspection_date, result, notes } = req.body;

  db.run(
    `INSERT INTO quality_inspections (order_id, cutting_log_id, inspection_type, has_chamfer, has_anti_slip_groove, groove_distance, groove_count, has_cracks, dimension_ok, inspector, inspection_date, result, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [orderId, cutting_log_id, inspection_type, has_chamfer ? 1 : 0, has_anti_slip_groove ? 1 : 0, groove_distance, groove_count, has_cracks ? 1 : 0, dimension_ok ? 1 : 0, inspector, inspection_date, result, notes],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, message: '质检记录添加成功' });
    }
  );
});

app.post('/api/orders/:id/comments', (req, res) => {
  const orderId = req.params.id;
  const { reviewer, comment, risk_level } = req.body;
  const now = new Date().toISOString();

  db.run(
    `INSERT INTO review_comments (order_id, reviewer, comment, risk_level, review_date)
     VALUES (?, ?, ?, ?, ?)`,
    [orderId, reviewer, comment, risk_level || 'normal', now],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, message: '复核意见添加成功' });
    }
  );
});

app.post('/api/orders/:id/specs', (req, res) => {
  const orderId = req.params.id;
  const { piece_name, spec_length, spec_width, spec_thickness, direction, notes } = req.body;

  db.run(
    `INSERT INTO dimension_specs (order_id, piece_name, spec_length, spec_width, spec_thickness, direction, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [orderId, piece_name, spec_length, spec_width, spec_thickness, direction, notes],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, message: '尺寸规格添加成功' });
    }
  );
});

app.post('/api/import/:type', upload.single('file'), (req, res) => {
  const type = req.params.type;
  const orderId = req.body.order_id;
  const filePath = req.file.path;

  const results = [];
  const isCSV = req.file.originalname.endsWith('.csv');

  if (isCSV) {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        processImportData(type, orderId, results, filePath, res);
      })
      .on('error', (err) => {
        fs.unlinkSync(filePath);
        res.status(500).json({ error: 'CSV解析失败: ' + err.message });
      });
  } else {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        fs.unlinkSync(filePath);
        res.status(500).json({ error: '文件读取失败' });
        return;
      }
      try {
        const jsonData = JSON.parse(data);
        const dataArray = Array.isArray(jsonData) ? jsonData : [jsonData];
        processImportData(type, orderId, dataArray, filePath, res);
      } catch (e) {
        fs.unlinkSync(filePath);
        res.status(400).json({ error: 'JSON格式错误' });
      }
    });
  }
});

function processImportData(type, orderId, data, filePath, res) {
  let count = 0;
  const errors = [];

  data.forEach((item, index) => {
    try {
      switch (type) {
        case 'specs':
          db.run(
            `INSERT INTO dimension_specs (order_id, piece_name, spec_length, spec_width, spec_thickness, direction, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [orderId, item.piece_name || item.部件名称, item.spec_length || item.规格长度, item.spec_width || item.规格宽度, 
             item.spec_thickness || item.规格厚度, item.direction || item.方向, item.notes || item.备注]
          );
          count++;
          break;

        case 'slabs':
          db.run(
            `INSERT INTO slabs (order_id, batch_number, slab_number, color, thickness, width, height, area, has_cracks, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [orderId, item.batch_number || item.批次号, item.slab_number || item.石板编号, item.color || item.颜色,
             item.thickness || item.厚度, item.width || item.宽度, item.height || item.高度, item.area || item.面积,
             item.has_cracks || item.有裂纹 ? 1 : 0, item.notes || item.备注]
          );
          count++;
          break;

        case 'cuts':
          db.run(
            `INSERT INTO cutting_logs (order_id, slab_id, cutting_type, piece_name, length, width, direction, machine, operator, cutting_date, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [orderId, item.slab_id || item.石板ID, item.cutting_type || item.切割类型, item.piece_name || item.部件名称,
             item.length || item.长度, item.width || item.宽度, item.direction || item.方向, item.machine || item.设备,
             item.operator || item.操作员, item.cutting_date || item.切割日期, item.notes || item.备注]
          );
          count++;
          break;

        case 'inspections':
          db.run(
            `INSERT INTO quality_inspections (order_id, cutting_log_id, inspection_type, has_chamfer, has_anti_slip_groove, groove_distance, groove_count, has_cracks, dimension_ok, inspector, inspection_date, result, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [orderId, item.cutting_log_id || item.切割日志ID, item.inspection_type || item.检查类型,
             item.has_chamfer || item.有倒角 ? 1 : 0, item.has_anti_slip_groove || item.有防滑槽 ? 1 : 0,
             item.groove_distance || item.槽距, item.groove_count || item.槽数量, item.has_cracks || item.有裂纹 ? 1 : 0,
             item.dimension_ok || item.尺寸合格 ? 1 : 0, item.inspector || item.检查员,
             item.inspection_date || item.检查日期, item.result || item.结果, item.notes || item.备注]
          );
          count++;
          break;

        default:
          errors.push(`第${index + 1}行: 未知类型 ${type}`);
      }
    } catch (e) {
      errors.push(`第${index + 1}行: ${e.message}`);
    }
  });

  fs.unlinkSync(filePath);

  res.json({
    message: `导入完成`,
    imported: count,
    total: data.length,
    errors: errors.length > 0 ? errors : undefined
  });
}

app.get('/api/orders/:id/export/markdown', (req, res) => {
  const orderId = req.params.id;

  db.get(`SELECT * FROM orders WHERE id = ?`, [orderId], (err, order) => {
    if (err || !order) {
      res.status(404).json({ error: '订单不存在' });
      return;
    }

    db.all(`SELECT * FROM slabs WHERE order_id = ?`, [orderId], (err, slabs) => {
      db.all(`SELECT * FROM cutting_logs WHERE order_id = ?`, [orderId], (err, cuts) => {
        db.all(`SELECT * FROM quality_inspections WHERE order_id = ?`, [orderId], (err, inspections) => {
          db.all(`SELECT * FROM review_comments WHERE order_id = ?`, [orderId], (err, comments) => {
            detectRisks(orderId).then(risks => {
              const markdown = generateMarkdownRelease(order, slabs, cuts, inspections, comments, risks);
              
              res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
              res.setHeader('Content-Disposition', `attachment; filename=release-${order.order_number}.md`);
              res.send(markdown);
            });
          });
        });
      });
    });
  });
});

app.get('/api/orders/:id/export/json', (req, res) => {
  const orderId = req.params.id;

  db.get(`SELECT * FROM orders WHERE id = ?`, [orderId], (err, order) => {
    if (err || !order) {
      res.status(404).json({ error: '订单不存在' });
      return;
    }

    db.all(`SELECT * FROM slabs WHERE order_id = ?`, [orderId], (err, slabs) => {
      db.all(`SELECT * FROM cutting_logs WHERE order_id = ?`, [orderId], (err, cuts) => {
        db.all(`SELECT * FROM quality_inspections WHERE order_id = ?`, [orderId], (err, inspections) => {
          db.all(`SELECT * FROM review_comments WHERE order_id = ?`, [orderId], (err, comments) => {
            db.all(`SELECT * FROM dimension_specs WHERE order_id = ?`, [orderId], (err, specs) => {
              detectRisks(orderId).then(risks => {
                const auditPackage = {
                  export_time: new Date().toISOString(),
                  version: '1.0.0',
                  order: order,
                  slabs: slabs,
                  cutting_logs: cuts,
                  inspections: inspections,
                  review_comments: comments,
                  dimension_specs: specs,
                  risk_analysis: {
                    summary: {
                      total: risks.length,
                      critical: risks.filter(r => r.severity === 'critical').length,
                      high: risks.filter(r => r.severity === 'high').length,
                      medium: risks.filter(r => r.severity === 'medium').length
                    },
                    details: risks
                  },
                  standards: {
                    groove_distance_range: `${STANDARD_GROOVE_DISTANCE_MIN}-${STANDARD_GROOVE_DISTANCE_MAX}mm`,
                    dimension_tolerance: `${DIMENSION_TOLERANCE}mm`
                  }
                };

                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.setHeader('Content-Disposition', `attachment; filename=audit-${order.order_number}.json`);
                res.send(JSON.stringify(auditPackage, null, 2));
              });
            });
          });
        });
      });
    });
  });
});

app.get('/api/risks/standards', (req, res) => {
  res.json({
    groove_distance_min: STANDARD_GROOVE_DISTANCE_MIN,
    groove_distance_max: STANDARD_GROOVE_DISTANCE_MAX,
    dimension_tolerance: DIMENSION_TOLERANCE,
    unit: 'mm'
  });
});

app.listen(PORT, () => {
  console.log(`石材加工厂管理工具已启动: http://localhost:${PORT}`);
});

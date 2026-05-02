const express = require('express');
const router = express.Router();
const multer = require('multer');
const csvParser = require('csv-parser');
const { Parser } = require('json2csv');
const db = require('../db/database');
const { ValidationError } = require('../middleware/errorHandler');

const upload = multer({ dest: 'uploads/' });

router.get('/export/quotations', (req, res, next) => {
  const { supplier_id, material_id, start_date, end_date } = req.query;
  
  let sql = `
    SELECT 
      q.quotation_no as 报价单号,
      s.code as 供应商编码,
      s.name as 供应商名称,
      q.quotation_date as 报价日期,
      q.currency as 币种,
      q.exchange_rate as 汇率,
      q.tax_rate as 税率,
      m.code as 物料编码,
      m.name as 物料名称,
      m.spec as 规格型号,
      m.unit as 单位,
      qi.quantity as 数量,
      qi.price_tax_included as 含税单价,
      qi.price_tax_excluded as 未税单价,
      qi.tax_amount as 税额,
      qi.total_amount as 价税合计,
      q.status as 状态,
      q.remarks as 备注
    FROM quotations q
    LEFT JOIN suppliers s ON q.supplier_id = s.id
    LEFT JOIN quotation_items qi ON q.id = qi.quotation_id
    LEFT JOIN materials m ON qi.material_id = m.id
    WHERE 1=1
  `;
  
  const params = [];
  const conditions = [];

  if (supplier_id) {
    conditions.push('q.supplier_id = ?');
    params.push(supplier_id);
  }
  if (material_id) {
    conditions.push('qi.material_id = ?');
    params.push(material_id);
  }
  if (start_date) {
    conditions.push('q.quotation_date >= ?');
    params.push(start_date);
  }
  if (end_date) {
    conditions.push('q.quotation_date <= ?');
    params.push(end_date);
  }

  if (conditions.length > 0) {
    sql += ' AND ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY q.quotation_date DESC, q.created_at DESC';

  db.all(sql, params, (err, rows) => {
    if (err) return next(err);

    if (rows.length === 0) {
      return res.json({ success: false, error: '没有可导出的数据' });
    }

    try {
      const json2csvParser = new Parser({ header: true });
      const csv = json2csvParser.parse(rows);
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=quotations_${new Date().toISOString().slice(0, 10)}.csv`);
      
      res.send('\uFEFF' + csv);
    } catch (error) {
      next(error);
    }
  });
});

router.get('/export/materials', (req, res, next) => {
  db.all('SELECT code as 物料编码, name as 物料名称, spec as 规格型号, unit as 单位 FROM materials ORDER BY code', (err, rows) => {
    if (err) return next(err);

    try {
      const json2csvParser = new Parser({ header: true });
      const csv = json2csvParser.parse(rows);
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=materials_${new Date().toISOString().slice(0, 10)}.csv`);
      
      res.send('\uFEFF' + csv);
    } catch (error) {
      next(error);
    }
  });
});

router.get('/export/suppliers', (req, res, next) => {
  db.all(`
    SELECT code as 供应商编码, name as 供应商名称, contact_person as 联系人, phone as 电话, email as 邮箱, address as 地址
    FROM suppliers ORDER BY code
  `, (err, rows) => {
    if (err) return next(err);

    try {
      const json2csvParser = new Parser({ header: true });
      const csv = json2csvParser.parse(rows);
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=suppliers_${new Date().toISOString().slice(0, 10)}.csv`);
      
      res.send('\uFEFF' + csv);
    } catch (error) {
      next(error);
    }
  });
});

router.post('/import/materials', upload.single('file'), (req, res, next) => {
  if (!req.file) {
    return next(new ValidationError('请上传文件'));
  }

  const fs = require('fs');
  const results = [];
  const errors = [];
  let rowNum = 0;

  fs.createReadStream(req.file.path, { encoding: 'utf8' })
    .pipe(csvParser({ headers: true }))
    .on('data', (data) => {
      rowNum++;
      const code = data['物料编码'] || data['code'] || '';
      const name = data['物料名称'] || data['name'] || '';
      const spec = data['规格型号'] || data['spec'] || '';
      const unit = data['单位'] || data['unit'] || '';

      if (!code || !name) {
        errors.push(`第 ${rowNum} 行：物料编码和名称不能为空`);
        return;
      }

      results.push({ code: code.trim(), name: name.trim(), spec: spec.trim(), unit: unit.trim() });
    })
    .on('end', () => {
      if (errors.length > 0) {
        fs.unlinkSync(req.file.path);
        return res.json({ success: false, error: errors.join('\n') });
      }

      if (results.length === 0) {
        fs.unlinkSync(req.file.path);
        return next(new ValidationError('文件中没有有效数据'));
      }

      let imported = 0;
      let skipped = 0;
      const importErrors = [];

      results.forEach((material, index) => {
        db.run(
          'INSERT OR IGNORE INTO materials (code, name, spec, unit) VALUES (?, ?, ?, ?)',
          [material.code, material.name, material.spec, material.unit],
          function (err) {
            if (err) {
              importErrors.push(`第 ${index + 1} 行（${material.code}）：${err.message}`);
            } else if (this.changes > 0) {
              imported++;
            } else {
              skipped++;
            }

            if (index === results.length - 1) {
              fs.unlinkSync(req.file.path);
              res.json({
                success: true,
                data: {
                  total: results.length,
                  imported,
                  skipped,
                  errors: importErrors
                }
              });
            }
          }
        );
      });
    })
    .on('error', (error) => {
      fs.unlinkSync(req.file.path);
      next(error);
    });
});

router.post('/import/suppliers', upload.single('file'), (req, res, next) => {
  if (!req.file) {
    return next(new ValidationError('请上传文件'));
  }

  const fs = require('fs');
  const results = [];
  const errors = [];
  let rowNum = 0;

  fs.createReadStream(req.file.path, { encoding: 'utf8' })
    .pipe(csvParser({ headers: true }))
    .on('data', (data) => {
      rowNum++;
      const code = data['供应商编码'] || data['code'] || '';
      const name = data['供应商名称'] || data['name'] || '';
      const contact_person = data['联系人'] || data['contact_person'] || '';
      const phone = data['电话'] || data['phone'] || '';
      const email = data['邮箱'] || data['email'] || '';
      const address = data['地址'] || data['address'] || '';

      if (!code || !name) {
        errors.push(`第 ${rowNum} 行：供应商编码和名称不能为空`);
        return;
      }

      results.push({
        code: code.trim(),
        name: name.trim(),
        contact_person: contact_person.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim()
      });
    })
    .on('end', () => {
      if (errors.length > 0) {
        fs.unlinkSync(req.file.path);
        return res.json({ success: false, error: errors.join('\n') });
      }

      if (results.length === 0) {
        fs.unlinkSync(req.file.path);
        return next(new ValidationError('文件中没有有效数据'));
      }

      let imported = 0;
      let skipped = 0;
      const importErrors = [];

      results.forEach((supplier, index) => {
        db.run(
          'INSERT OR IGNORE INTO suppliers (code, name, contact_person, phone, email, address) VALUES (?, ?, ?, ?, ?, ?)',
          [supplier.code, supplier.name, supplier.contact_person, supplier.phone, supplier.email, supplier.address],
          function (err) {
            if (err) {
              importErrors.push(`第 ${index + 1} 行（${supplier.code}）：${err.message}`);
            } else if (this.changes > 0) {
              imported++;
            } else {
              skipped++;
            }

            if (index === results.length - 1) {
              fs.unlinkSync(req.file.path);
              res.json({
                success: true,
                data: {
                  total: results.length,
                  imported,
                  skipped,
                  errors: importErrors
                }
              });
            }
          }
        );
      });
    })
    .on('error', (error) => {
      fs.unlinkSync(req.file.path);
      next(error);
    });
});

router.get('/template/materials', (req, res, next) => {
  const template = [
    { '物料编码': 'MAT001', '物料名称': '示例物料', '规格型号': '规格A', '单位': '个' }
  ];

  try {
    const json2csvParser = new Parser({ header: true });
    const csv = json2csvParser.parse(template);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=materials_template.csv');
    
    res.send('\uFEFF' + csv);
  } catch (error) {
    next(error);
  }
});

router.get('/template/suppliers', (req, res, next) => {
  const template = [
    { '供应商编码': 'SUP001', '供应商名称': '示例供应商', '联系人': '张三', '电话': '13800138000', '邮箱': 'test@example.com', '地址': '北京市朝阳区' }
  ];

  try {
    const json2csvParser = new Parser({ header: true });
    const csv = json2csvParser.parse(template);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=suppliers_template.csv');
    
    res.send('\uFEFF' + csv);
  } catch (error) {
    next(error);
  }
});

module.exports = router;

const fs = require('fs');
const csv = require('csv-parser');
const { runQuery, getOne, recordImportError, recordHistory, getAll } = require('../database/db');

function importElderlyCSV(req, res) {
  if (!req.file) {
    return res.status(400).json({ success: false, error: '请上传CSV文件' });
  }

  const results = [];
  const errors = [];
  let rowNumber = 0;

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (row) => {
      rowNumber++;
      try {
        const validation = validateElderlyRow(row, rowNumber);
        if (validation.error) {
          errors.push({
            row: rowNumber,
            data: row,
            error: validation.error,
            suggestions: validation.suggestions
          });
          recordImportError('elderly', req.file.originalname, rowNumber, row, validation.error, validation.suggestions);
        } else {
          results.push(row);
        }
      } catch (error) {
        errors.push({
          row: rowNumber,
          data: row,
          error: error.message,
          suggestions: '检查数据格式'
        });
      }
    })
    .on('end', async () => {
      let imported = 0;
      const importErrors = [];

      for (const row of results) {
        try {
          if (row.id_card) {
            const exists = await getOne('SELECT id FROM elderly WHERE id_card = ?', [row.id_card]);
            if (exists) {
              importErrors.push({
                row: rowNumber,
                data: row,
                error: '身份证号已存在',
                suggestions: '检查是否重复导入'
              });
              continue;
            }
          }

          const sql = `
            INSERT INTO elderly (name, id_card, phone, address, dietary_restrictions, chronic_diseases, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `;
          await runQuery(sql, [
            row.name || '',
            row.id_card || row.idcard || row.idCard || '',
            row.phone || row.telephone || '',
            row.address || '',
            row.dietary_restrictions || row.dietary || '',
            row.chronic_diseases || row.diseases || '',
            row.notes || row.remark || ''
          ]);
          imported++;
        } catch (error) {
          importErrors.push({
            data: row,
            error: error.message,
            suggestions: '数据库写入失败'
          });
        }
      }

      fs.unlinkSync(req.file.path);

      await recordHistory('import', 'elderly', null, req.body.operator || 'system', {
        imported,
        total: results.length,
        errors: errors.length + importErrors.length
      });

      res.json({
        success: true,
        data: {
          imported,
          total: rowNumber,
          errors: [...errors, ...importErrors],
          error_count: errors.length + importErrors.length
        }
      });
    })
    .on('error', (error) => {
      fs.unlinkSync(req.file.path);
      res.status(500).json({ success: false, error: '文件解析失败: ' + error.message });
    });
}

function validateElderlyRow(row, rowNumber) {
  if (!row.name && !row.Name) {
    return { error: '姓名不能为空', suggestions: '请填写姓名字段' };
  }
  if (!row.name) row.name = row.Name;

  if (row.id_card && row.id_card.length !== 0 && row.id_card.length !== 18) {
    return { error: '身份证号格式不正确', suggestions: '请检查身份证号是否为18位' };
  }

  return { success: true };
}

async function importMenuJSON(req, res) {
  if (!req.file) {
    return res.status(400).json({ success: false, error: '请上传JSON文件' });
  }

  try {
    const content = fs.readFileSync(req.file.path, 'utf8');
    const data = JSON.parse(content);
    const menuItems = Array.isArray(data) ? data : data.items || [];
    
    let imported = 0;
    const errors = [];

    for (let index = 0; index < menuItems.length; index++) {
      const item = menuItems[index];
      try {
        if (!item.name) {
          errors.push({
            item: index,
            data: item,
            error: '菜品名称不能为空',
            suggestions: '请为每个菜品添加name字段'
          });
          await recordImportError('menu', req.file.originalname, index + 1, item, '菜品名称不能为空', '请为每个菜品添加name字段');
          continue;
        }

        const sql = `
          INSERT INTO menu_items (name, type, ingredients, allergens, nutrition_info, price)
          VALUES (?, ?, ?, ?, ?, ?)
        `;
        await runQuery(sql, [
          item.name,
          item.type || '',
          item.ingredients || JSON.stringify(item.ingredientList || []),
          item.allergens || '',
          item.nutrition_info || '',
          item.price || null
        ]);
        imported++;
      } catch (error) {
        errors.push({
          item: index,
          data: item,
          error: error.message,
          suggestions: '检查数据格式'
        });
      }
    }

    fs.unlinkSync(req.file.path);

    await recordHistory('import', 'menu', null, req.body.operator || 'system', {
      imported,
      total: menuItems.length,
      errors: errors.length
    });

    res.json({
      success: true,
      data: {
        imported,
        total: menuItems.length,
        errors,
        error_count: errors.length
      }
    });
  } catch (error) {
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ success: false, error: 'JSON解析失败: ' + error.message });
  }
}

function importDeliveryCSV(req, res) {
  if (!req.file) {
    return res.status(400).json({ success: false, error: '请上传CSV文件' });
  }

  const results = [];
  let rowNumber = 0;

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (row) => {
      rowNumber++;
      results.push(row);
    })
    .on('end', async () => {
      let imported = 0;
      const errors = [];

      for (let index = 0; index < results.length; index++) {
        const row = results[index];
        try {
          if (!row.delivery_date && !row.date) {
            errors.push({
              row: index + 1,
              data: row,
              error: '配送日期不能为空',
              suggestions: '请添加delivery_date或date字段'
            });
            await recordImportError('delivery', req.file.originalname, index + 1, row, '配送日期不能为空', '请添加delivery_date或date字段');
            continue;
          }

          const sql = `
            INSERT INTO deliveries (elderly_id, delivery_date, meal_type, menu_items, route_id, status, delivered_by, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `;
          await runQuery(sql, [
            row.elderly_id || null,
            row.delivery_date || row.date,
            row.meal_type || row.type || 'lunch',
            row.menu_items || '',
            row.route_id || null,
            row.status || 'pending',
            row.delivered_by || '',
            row.notes || ''
          ]);
          imported++;
        } catch (error) {
          errors.push({
            row: index + 1,
            data: row,
            error: error.message,
            suggestions: '检查数据格式'
          });
        }
      }

      fs.unlinkSync(req.file.path);

      await recordHistory('import', 'delivery', null, req.body.operator || 'system', {
        imported,
        total: results.length,
        errors: errors.length
      });

      res.json({
        success: true,
        data: {
          imported,
          total: rowNumber,
          errors,
          error_count: errors.length
        }
      });
    })
    .on('error', (error) => {
      fs.unlinkSync(req.file.path);
      res.status(500).json({ success: false, error: '文件解析失败: ' + error.message });
    });
}

async function getImportErrors(req, res) {
  try {
    const { import_type, resolved } = req.query;
    let sql = 'SELECT * FROM import_errors WHERE 1=1';
    const params = [];

    if (import_type) {
      sql += ' AND import_type = ?';
      params.push(import_type);
    }
    if (resolved !== undefined) {
      sql += ' AND resolved = ?';
      params.push(resolved === 'true' ? 1 : 0);
    }

    sql += ' ORDER BY created_at DESC';
    const errors = await getAll(sql, params);
    
    res.json({ success: true, data: errors, total: errors.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  importElderlyCSV,
  importMenuJSON,
  importDeliveryCSV,
  getImportErrors
};

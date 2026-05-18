const db = require('../config/database');
const { ApiError } = require('../middleware/errorHandler');
const moment = require('moment');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');

const calculateAvailableStock = (currentStock, inTransit) => {
  return currentStock + inTransit;
};

const calculateDaysUntilStockout = (availableStock, dailyConsumption) => {
  if (dailyConsumption <= 0) return null;
  return Math.floor(availableStock / dailyConsumption);
};

const calculateSuggestedQuantity = (safeStock, availableStock, minOrder, dailyConsumption, leadTime) => {
  const leadTimeDemand = dailyConsumption * leadTime;
  const targetStock = Math.max(safeStock, leadTimeDemand);
  let suggested = targetStock - availableStock;
  
  if (suggested <= 0) return 0;
  
  suggested = Math.max(suggested, minOrder);
  return Math.ceil(suggested);
};

const getAllSpareParts = (req, res, next) => {
  const { category, low_stock, page = 1, limit = 50 } = req.query;
  
  let sql = 'SELECT * FROM spare_parts_inventory WHERE 1=1';
  let countSql = 'SELECT COUNT(*) as total FROM spare_parts_inventory WHERE 1=1';
  const params = [];
  
  if (category) {
    sql += ' AND part_category = ?';
    countSql += ' AND part_category = ?';
    params.push(category);
  }
  
  if (low_stock === 'true') {
    sql += ' AND current_stock < safe_stock_quantity';
    countSql += ' AND current_stock < safe_stock_quantity';
  }
  
  sql += ' ORDER BY part_category, part_code';
  
  if (limit && page) {
    const offset = (page - 1) * limit;
    sql += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
  }
  
  db.all(sql, params, (err, rows) => {
    if (err) return next(err);
    
    db.get(countSql, params.slice(0, category ? 1 : 0), (err, countResult) => {
      if (err) return next(err);
      
      const enrichedRows = rows.map(row => ({
        ...row,
        available_stock: calculateAvailableStock(row.current_stock, row.in_transit_quantity),
        is_under_safe_stock: row.current_stock < row.safe_stock_quantity,
        has_duplicate_risk: row.in_transit_quantity > 0 && row.current_stock > row.safe_stock_quantity * 1.5
      }));
      
      res.json({
        success: true,
        data: enrichedRows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult.total,
          total_pages: Math.ceil(countResult.total / (limit || countResult.total))
        }
      });
    });
  });
};

const getSparePartById = (req, res, next) => {
  const { id } = req.params;
  
  db.get('SELECT * FROM spare_parts_inventory WHERE id = ?', [id], (err, row) => {
    if (err) return next(err);
    if (!row) {
      return next(new ApiError(404, '未找到指定的备件记录'));
    }
    
    const enrichedRow = {
      ...row,
      available_stock: calculateAvailableStock(row.current_stock, row.in_transit_quantity),
      is_under_safe_stock: row.current_stock < row.safe_stock_quantity
    };
    
    res.json({ success: true, data: enrichedRow });
  });
};

const getSparePartByCode = (req, res, next) => {
  const { part_code } = req.params;
  
  db.get('SELECT * FROM spare_parts_inventory WHERE part_code = ?', [part_code], (err, row) => {
    if (err) return next(err);
    if (!row) {
      return next(new ApiError(404, '未找到指定编码的备件记录'));
    }
    
    const enrichedRow = {
      ...row,
      available_stock: calculateAvailableStock(row.current_stock, row.in_transit_quantity),
      is_under_safe_stock: row.current_stock < row.safe_stock_quantity
    };
    
    res.json({ success: true, data: enrichedRow });
  });
};

const createSparePart = (req, res, next) => {
  const data = req.body;
  const now = moment().format('YYYY-MM-DD HH:mm:ss');
  
  const sql = `
    INSERT INTO spare_parts_inventory (
      part_code, part_name, part_spec, part_category, unit,
      safe_stock_quantity, current_stock, in_transit_quantity,
      min_order_quantity, supplier_name, supplier_contact,
      average_daily_consumption, lead_time_days, last_purchase_date,
      last_consumption_date, location, remarks, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  const params = [
    data.part_code, data.part_name, data.part_spec, data.part_category,
    data.unit, data.safe_stock_quantity, data.current_stock,
    data.in_transit_quantity, data.min_order_quantity,
    data.supplier_name, data.supplier_contact, data.average_daily_consumption,
    data.lead_time_days, data.last_purchase_date, data.last_consumption_date,
    data.location, data.remarks, now, now
  ];
  
  db.run(sql, params, function(err) {
    if (err) return next(err);
    
    db.get('SELECT * FROM spare_parts_inventory WHERE id = ?', [this.lastID], (err, row) => {
      if (err) return next(err);
      res.status(201).json({
        success: true,
        message: '备件记录创建成功',
        data: row
      });
    });
  });
};

const updateSparePart = (req, res, next) => {
  const { id } = req.params;
  const data = req.body;
  const now = moment().format('YYYY-MM-DD HH:mm:ss');
  
  const sql = `
    UPDATE spare_parts_inventory SET
      part_code = ?, part_name = ?, part_spec = ?, part_category = ?,
      unit = ?, safe_stock_quantity = ?, current_stock = ?,
      in_transit_quantity = ?, min_order_quantity = ?, supplier_name = ?,
      supplier_contact = ?, average_daily_consumption = ?, lead_time_days = ?,
      last_purchase_date = ?, last_consumption_date = ?, location = ?,
      remarks = ?, updated_at = ?
    WHERE id = ?
  `;
  
  const params = [
    data.part_code, data.part_name, data.part_spec, data.part_category,
    data.unit, data.safe_stock_quantity, data.current_stock,
    data.in_transit_quantity, data.min_order_quantity,
    data.supplier_name, data.supplier_contact, data.average_daily_consumption,
    data.lead_time_days, data.last_purchase_date, data.last_consumption_date,
    data.location, data.remarks, now, id
  ];
  
  db.run(sql, params, function(err) {
    if (err) return next(err);
    if (this.changes === 0) {
      return next(new ApiError(404, '未找到指定的备件记录'));
    }
    
    db.get('SELECT * FROM spare_parts_inventory WHERE id = ?', [id], (err, row) => {
      if (err) return next(err);
      res.json({
        success: true,
        message: '备件记录更新成功',
        data: row
      });
    });
  });
};

const deleteSparePart = (req, res, next) => {
  const { id } = req.params;
  
  db.run('DELETE FROM spare_parts_inventory WHERE id = ?', [id], function(err) {
    if (err) return next(err);
    if (this.changes === 0) {
      return next(new ApiError(404, '未找到指定的备件记录'));
    }
    
    res.json({
      success: true,
      message: '备件记录删除成功'
    });
  });
};

const batchImportSpareParts = (req, res, next) => {
  const { items, update_mode } = req.body;
  const now = moment().format('YYYY-MM-DD HH:mm:ss');
  
  const results = {
    success: [],
    skipped: [],
    failed: [],
    updated: []
  };
  
  let processed = 0;
  
  items.forEach((item, index) => {
    db.get('SELECT id FROM spare_parts_inventory WHERE part_code = ?', [item.part_code], (err, existing) => {
      if (err) {
        results.failed.push({ index, part_code: item.part_code, error: err.message });
      } else if (existing) {
        if (update_mode === 'skip') {
          results.skipped.push({ index, part_code: item.part_code, reason: '备件编码已存在，跳过' });
        } else if (update_mode === 'overwrite') {
          const updateSql = `
            UPDATE spare_parts_inventory SET
              part_name = ?, part_spec = ?, part_category = ?, unit = ?,
              safe_stock_quantity = ?, current_stock = ?, in_transit_quantity = ?,
              min_order_quantity = ?, supplier_name = ?, supplier_contact = ?,
              average_daily_consumption = ?, lead_time_days = ?, last_purchase_date = ?,
              last_consumption_date = ?, location = ?, remarks = ?, updated_at = ?
            WHERE part_code = ?
          `;
          
          const params = [
            item.part_name, item.part_spec, item.part_category, item.unit,
            item.safe_stock_quantity, item.current_stock, item.in_transit_quantity,
            item.min_order_quantity, item.supplier_name, item.supplier_contact,
            item.average_daily_consumption, item.lead_time_days, item.last_purchase_date,
            item.last_consumption_date, item.location, item.remarks, now, item.part_code
          ];
          
          db.run(updateSql, params, function(err) {
            if (err) {
              results.failed.push({ index, part_code: item.part_code, error: err.message });
            } else {
              results.updated.push({ index, part_code: item.part_code, id: existing.id });
            }
          });
        }
      } else {
        const insertSql = `
          INSERT INTO spare_parts_inventory (
            part_code, part_name, part_spec, part_category, unit,
            safe_stock_quantity, current_stock, in_transit_quantity,
            min_order_quantity, supplier_name, supplier_contact,
            average_daily_consumption, lead_time_days, last_purchase_date,
            last_consumption_date, location, remarks, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const params = [
          item.part_code, item.part_name, item.part_spec, item.part_category,
          item.unit, item.safe_stock_quantity, item.current_stock,
          item.in_transit_quantity, item.min_order_quantity,
          item.supplier_name, item.supplier_contact, item.average_daily_consumption,
          item.lead_time_days, item.last_purchase_date, item.last_consumption_date,
          item.location, item.remarks, now, now
        ];
        
        db.run(insertSql, params, function(err) {
          if (err) {
            results.failed.push({ index, part_code: item.part_code, error: err.message });
          } else {
            results.success.push({ index, part_code: item.part_code, id: this.lastID });
          }
        });
      }
      
      processed++;
      if (processed === items.length) {
        setTimeout(() => {
          res.json({
            success: true,
            message: `批量导入完成：成功${results.success.length}条，更新${results.updated.length}条，跳过${results.skipped.length}条，失败${results.failed.length}条`,
            results: results
          });
        }, 100);
      }
    });
  });
};

const getPurchaseSuggestions = (req, res, next) => {
  const { include_risk_check = 'true' } = req.query;
  
  db.all('SELECT * FROM spare_parts_inventory', [], (err, rows) => {
    if (err) return next(err);
    
    const suggestions = [];
    const warnings = [];
    
    rows.forEach(part => {
      const availableStock = calculateAvailableStock(part.current_stock, part.in_transit_quantity);
      const daysUntilStockout = calculateDaysUntilStockout(availableStock, part.average_daily_consumption);
      const suggestedQty = calculateSuggestedQuantity(
        part.safe_stock_quantity, availableStock,
        part.min_order_quantity, part.average_daily_consumption,
        part.lead_time_days
      );
      
      if (include_risk_check === 'true' && part.in_transit_quantity > 0 && part.current_stock > part.safe_stock_quantity * 1.2) {
        warnings.push({
          part_code: part.part_code,
          part_name: part.part_name,
          warning_type: 'duplicate_calculation_risk',
          message: `该备件存在采购在途(${part.in_transit_quantity}${part.unit})与真实库存重复计算风险，请核实在途状态`,
          current_stock: part.current_stock,
          in_transit: part.in_transit_quantity,
          safe_stock: part.safe_stock_quantity
        });
      }
      
      if (suggestedQty > 0) {
        let reason = '';
        if (part.current_stock < part.safe_stock_quantity) {
          reason = `当前库存(${part.current_stock}${part.unit})低于安全库存(${part.safe_stock_quantity}${part.unit})`;
        } else if (daysUntilStockout !== null && daysUntilStockout <= part.lead_time_days) {
          reason = `按当前消耗速度，预计${daysUntilStockout}天后缺货，小于采购周期(${part.lead_time_days}天)`;
        } else {
          reason = `为保证安全库存水平，建议补充库存`;
        }
        
        suggestions.push({
          part_code: part.part_code,
          part_name: part.part_name,
          part_spec: part.part_spec,
          part_category: part.part_category,
          unit: part.unit,
          suggested_quantity: suggestedQty,
          min_order_quantity: part.min_order_quantity,
          reason: reason,
          current_stock: part.current_stock,
          in_transit_quantity: part.in_transit_quantity,
          available_stock: availableStock,
          safe_stock_quantity: part.safe_stock_quantity,
          lead_time_days: part.lead_time_days,
          days_until_stockout: daysUntilStockout,
          average_daily_consumption: part.average_daily_consumption,
          supplier_name: part.supplier_name,
          supplier_contact: part.supplier_contact,
          next_action: `建议采购 ${suggestedQty} ${part.unit}`
        });
      }
    });
    
    suggestions.sort((a, b) => b.suggested_quantity - a.suggested_quantity);
    
    res.json({
      success: true,
      summary: {
        total_parts: rows.length,
        need_purchase: suggestions.length,
        has_warnings: warnings.length
      },
      warnings: warnings,
      suggestions: suggestions,
      next_steps: suggestions.length > 0 
        ? `请优先采购 ${suggestions.slice(0, 3).map(s => s.part_name).join('、')} 等材料`
        : '当前所有备件库存充足，无需采购'
    });
  });
};

const exportSpareParts = (req, res, next) => {
  const { format = 'json' } = req.query;
  
  db.all('SELECT * FROM spare_parts_inventory ORDER BY part_category, part_code', [], (err, rows) => {
    if (err) return next(err);
    
    const exportData = rows.map(row => ({
      '备件编码': row.part_code,
      '备件名称': row.part_name,
      '规格型号': row.part_spec || '',
      '备件类别': row.part_category || '',
      '计量单位': row.unit,
      '安全库存': row.safe_stock_quantity,
      '当前库存': row.current_stock,
      '在途数量': row.in_transit_quantity,
      '可用库存': calculateAvailableStock(row.current_stock, row.in_transit_quantity),
      '是否低于安全库存': row.current_stock < row.safe_stock_quantity ? '是' : '否',
      '最小订购量': row.min_order_quantity,
      '供应商名称': row.supplier_name || '',
      '供应商联系方式': row.supplier_contact || '',
      '日均消耗量': row.average_daily_consumption,
      '采购周期(天)': row.lead_time_days,
      '存放位置': row.location || '',
      '备注': row.remarks || '',
      '最后更新时间': row.updated_at
    }));
    
    if (format === 'csv') {
      const exportDir = path.join(__dirname, '../../exports');
      const filename = `备件库存_${moment().format('YYYYMMDD_HHmmss')}.csv`;
      const filepath = path.join(exportDir, filename);
      
      const fs = require('fs');
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }
      
      const csvWriter = createCsvWriter({
        path: filepath,
        header: Object.keys(exportData[0] || {}).map(key => ({ id: key, title: key }))
      });
      
      csvWriter.writeRecords(exportData)
        .then(() => {
          res.download(filepath, filename, (err) => {
            if (err) next(err);
          });
        })
        .catch(next);
    } else {
      res.json({
        success: true,
        message: '导出成功，包含关键业务列，可用于台账核对',
        total: exportData.length,
        export_columns: Object.keys(exportData[0] || {}),
        data: exportData
      });
    }
  });
};

module.exports = {
  getAllSpareParts,
  getSparePartById,
  getSparePartByCode,
  createSparePart,
  updateSparePart,
  deleteSparePart,
  batchImportSpareParts,
  getPurchaseSuggestions,
  exportSpareParts
};

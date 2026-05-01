const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { ValidationError, NotFoundError, ConflictError } = require('../middleware/errorHandler');

function calculatePrices(item, taxRate) {
  const { price_tax_included, price_tax_excluded, quantity } = item;
  let pti = price_tax_included ? parseFloat(price_tax_included) : null;
  let pte = price_tax_excluded ? parseFloat(price_tax_excluded) : null;
  const qty = quantity ? parseFloat(quantity) : 1;
  const rate = taxRate ? parseFloat(taxRate) : 0.13;

  if (pti !== null && pte === null) {
    pte = pti / (1 + rate);
  } else if (pte !== null && pti === null) {
    pti = pte * (1 + rate);
  }

  if (pti === null && pte === null) {
    return { valid: false, error: '必须提供含税价或未税价' };
  }

  const taxAmount = (pti - pte) * qty;
  const totalAmount = pti * qty;

  return {
    valid: true,
    price_tax_included: pti,
    price_tax_excluded: pte,
    tax_amount: taxAmount,
    total_amount: totalAmount,
    quantity: qty
  };
}

function generateQuotationNo() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `Q${year}${month}${day}${random}`;
}

router.get('/', (req, res, next) => {
  const { supplier_id, material_id, start_date, end_date, status, page = 1, pageSize = 100 } = req.query;
  
  let sql = `
    SELECT DISTINCT q.*, s.name as supplier_name, s.code as supplier_code
    FROM quotations q
    LEFT JOIN suppliers s ON q.supplier_id = s.id
  `;
  
  const params = [];
  const conditions = [];

  if (supplier_id) {
    conditions.push('q.supplier_id = ?');
    params.push(supplier_id);
  }
  if (start_date) {
    conditions.push('q.quotation_date >= ?');
    params.push(start_date);
  }
  if (end_date) {
    conditions.push('q.quotation_date <= ?');
    params.push(end_date);
  }
  if (status) {
    conditions.push('q.status = ?');
    params.push(status);
  }
  if (material_id) {
    sql += ' LEFT JOIN quotation_items qi ON q.id = qi.quotation_id';
    conditions.push('qi.material_id = ?');
    params.push(material_id);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY q.quotation_date DESC, q.created_at DESC';

  const offset = (parseInt(page) - 1) * parseInt(pageSize);
  sql += ` LIMIT ${parseInt(pageSize)} OFFSET ${offset}`;

  db.all(sql, params, (err, rows) => {
    if (err) return next(err);
    
    const quotationIds = rows.map(r => r.id);
    if (quotationIds.length === 0) {
      return res.json({ success: true, data: rows });
    }

    const placeholders = quotationIds.map(() => '?').join(',');
    db.all(`
      SELECT qi.*, m.code as material_code, m.name as material_name, m.spec as material_spec, m.unit as material_unit
      FROM quotation_items qi
      LEFT JOIN materials m ON qi.material_id = m.id
      WHERE qi.quotation_id IN (${placeholders})
    `, quotationIds, (err, items) => {
      if (err) return next(err);
      
      const itemsByQuotation = {};
      items.forEach(item => {
        if (!itemsByQuotation[item.quotation_id]) {
          itemsByQuotation[item.quotation_id] = [];
        }
        itemsByQuotation[item.quotation_id].push(item);
      });

      rows.forEach(row => {
        row.items = itemsByQuotation[row.id] || [];
      });

      res.json({ success: true, data: rows });
    });
  });
});

router.get('/latest-prices', (req, res, next) => {
  const { material_id } = req.query;
  
  let sql = `
    SELECT 
      m.id as material_id,
      m.code as material_code,
      m.name as material_name,
      m.spec as material_spec,
      m.unit as material_unit,
      s.id as supplier_id,
      s.code as supplier_code,
      s.name as supplier_name,
      q.id as quotation_id,
      q.quotation_date,
      q.currency,
      q.exchange_rate,
      q.tax_rate,
      qi.price_tax_included,
      qi.price_tax_excluded,
      qi.price_tax_included * q.exchange_rate as price_tax_included_cny,
      qi.price_tax_excluded * q.exchange_rate as price_tax_excluded_cny
    FROM materials m
    LEFT JOIN quotation_items qi ON m.id = qi.material_id
    LEFT JOIN quotations q ON qi.quotation_id = q.id
    LEFT JOIN suppliers s ON q.supplier_id = s.id
    WHERE q.status = 'active'
  `;
  
  const params = [];
  
  if (material_id) {
    sql += ' AND m.id = ?';
    params.push(material_id);
  }

  db.all(sql, params, (err, rows) => {
    if (err) return next(err);
    
    const materialGroups = {};
    rows.forEach(row => {
      if (!materialGroups[row.material_id]) {
        materialGroups[row.material_id] = [];
      }
      materialGroups[row.material_id].push(row);
    });

    const result = [];
    Object.keys(materialGroups).forEach(materialId => {
      const prices = materialGroups[materialId];
      
      const supplierLatest = {};
      prices.forEach(price => {
        const key = `${price.supplier_id}-${price.material_id}`;
        if (!supplierLatest[key] || 
            new Date(price.quotation_date) > new Date(supplierLatest[key].quotation_date)) {
          supplierLatest[key] = price;
        }
      });

      const latestPrices = Object.values(supplierLatest);
      
      if (latestPrices.length > 0) {
        const minPrice = Math.min(...latestPrices.map(p => p.price_tax_excluded_cny || Infinity));
        
        latestPrices.forEach(price => {
          if (minPrice > 0) {
            price.is_lowest = price.price_tax_excluded_cny === minPrice;
            price.is_high = price.price_tax_excluded_cny > minPrice * 1.2;
            price.price_ratio = ((price.price_tax_excluded_cny / minPrice) * 100).toFixed(2);
          } else {
            price.is_lowest = false;
            price.is_high = false;
            price.price_ratio = '0.00';
          }
        });

        result.push(...latestPrices);
      }
    });

    res.json({ success: true, data: result });
  });
});

router.get('/:id', (req, res, next) => {
  db.get(`
    SELECT q.*, s.name as supplier_name, s.code as supplier_code
    FROM quotations q
    LEFT JOIN suppliers s ON q.supplier_id = s.id
    WHERE q.id = ?
  `, [req.params.id], (err, quotation) => {
    if (err) return next(err);
    if (!quotation) {
      return next(new NotFoundError('报价单不存在'));
    }

    db.all(`
      SELECT qi.*, m.code as material_code, m.name as material_name, m.spec as material_spec, m.unit as material_unit
      FROM quotation_items qi
      LEFT JOIN materials m ON qi.material_id = m.id
      WHERE qi.quotation_id = ?
    `, [req.params.id], (err, items) => {
      if (err) return next(err);
      quotation.items = items;
      res.json({ success: true, data: quotation });
    });
  });
});

router.post('/', (req, res, next) => {
  const { supplier_id, quotation_date, currency, exchange_rate, tax_rate, status, remarks, items } = req.body;

  if (!supplier_id || !quotation_date || !currency) {
    return next(new ValidationError('供应商、报价日期和币种不能为空'));
  }

  if (!items || items.length === 0) {
    return next(new ValidationError('报价单至少需要包含一行物料'));
  }

  db.get('SELECT * FROM suppliers WHERE id = ?', [supplier_id], (err, supplier) => {
    if (err) return next(err);
    if (!supplier) {
      return next(new NotFoundError('供应商不存在'));
    }

    db.get('SELECT * FROM exchange_rates WHERE currency = ?', [currency.toUpperCase()], (err, rateInfo) => {
      if (err) return next(err);
      
      let finalRate = exchange_rate;
      if (!finalRate || finalRate <= 0) {
        if (rateInfo) {
          finalRate = rateInfo.rate;
        } else {
          return next(new ValidationError(`币种 ${currency} 的汇率未配置，请先添加汇率`));
        }
      }

      const materialIds = items.map(item => item.material_id);
      const uniqueMaterialIds = [...new Set(materialIds)];
      
      if (materialIds.length !== uniqueMaterialIds.length) {
        return next(new ValidationError('同一报价单中不能包含重复的物料'));
      }

      const placeholders = uniqueMaterialIds.map(() => '?').join(',');
      db.all(`SELECT * FROM materials WHERE id IN (${placeholders})`, uniqueMaterialIds, (err, materials) => {
        if (err) return next(err);
        if (materials.length !== uniqueMaterialIds.length) {
          return next(new NotFoundError('部分物料不存在'));
        }

        db.all(`
          SELECT DISTINCT qi.material_id 
          FROM quotations q
          JOIN quotation_items qi ON q.id = qi.quotation_id
          WHERE q.supplier_id = ? AND q.quotation_date = ? AND q.status = 'active'
        `, [supplier_id, quotation_date], (err, existingMaterials) => {
          if (err) return next(err);
          
          const existingMaterialIds = existingMaterials.map(m => m.material_id);
          const conflictingMaterials = materialIds.filter(id => existingMaterialIds.includes(parseInt(id)));
          
          if (conflictingMaterials.length > 0) {
            const conflictNames = materials.filter(m => conflictingMaterials.includes(m.id)).map(m => m.name).join('、');
            return next(new ConflictError(`该供应商在 ${quotation_date} 已存在以下物料的报价：${conflictNames}。同一供应商同一天不能对同一物料重复报价`));
          }

          const calculatedItems = [];
          const taxRate = tax_rate || 0.13;
          
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const result = calculatePrices(item, taxRate);
            if (!result.valid) {
              return next(new ValidationError(`第 ${i + 1} 行物料：${result.error}`));
            }
            calculatedItems.push({ ...item, ...result });
          }

          const quotationNo = generateQuotationNo();
          const finalStatus = status || 'active';

          db.run(`
            INSERT INTO quotations (quotation_no, supplier_id, quotation_date, currency, exchange_rate, tax_rate, status, remarks)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [quotationNo, supplier_id, quotation_date, currency.toUpperCase(), finalRate, taxRate, finalStatus, remarks], function (err) {
            if (err) return next(err);
            
            const quotationId = this.lastID;
            let itemsCompleted = 0;
            let hasError = false;

            calculatedItems.forEach((item) => {
              db.run(`
                INSERT INTO quotation_items (quotation_id, material_id, quantity, price_tax_included, price_tax_excluded, tax_amount, total_amount)
                VALUES (?, ?, ?, ?, ?, ?, ?)
              `, [quotationId, item.material_id, item.quantity, item.price_tax_included, item.price_tax_excluded, item.tax_amount, item.total_amount], (err) => {
                if (err && !hasError) {
                  hasError = true;
                  return next(err);
                }
                
                itemsCompleted++;
                if (itemsCompleted === calculatedItems.length && !hasError) {
                  res.status(201).json({
                    success: true,
                    data: {
                      id: quotationId,
                      quotation_no: quotationNo,
                      supplier_id,
                      quotation_date,
                      currency: currency.toUpperCase(),
                      exchange_rate: finalRate,
                      tax_rate: taxRate,
                      status: finalStatus,
                      items: calculatedItems
                    }
                  });
                }
              });
            });
          });
        });
      });
    });
  });
});

router.put('/:id', (req, res, next) => {
  const { supplier_id, quotation_date, currency, exchange_rate, tax_rate, status, remarks, items } = req.body;
  const quotationId = req.params.id;

  if (!supplier_id || !quotation_date || !currency) {
    return next(new ValidationError('供应商、报价日期和币种不能为空'));
  }

  db.get('SELECT * FROM quotations WHERE id = ?', [quotationId], (err, existingQuotation) => {
    if (err) return next(err);
    if (!existingQuotation) {
      return next(new NotFoundError('报价单不存在'));
    }

    db.get('SELECT * FROM exchange_rates WHERE currency = ?', [currency.toUpperCase()], (err, rateInfo) => {
      if (err) return next(err);
      
      let finalRate = exchange_rate;
      if (!finalRate || finalRate <= 0) {
        if (rateInfo) {
          finalRate = rateInfo.rate;
        } else {
          return next(new ValidationError(`币种 ${currency} 的汇率未配置，请先添加汇率`));
        }
      }

      if (items && items.length > 0) {
        const materialIds = items.map(item => item.material_id);
        const uniqueMaterialIds = [...new Set(materialIds)];
        
        if (materialIds.length !== uniqueMaterialIds.length) {
          return next(new ValidationError('同一报价单中不能包含重复的物料'));
        }

        db.all(`SELECT * FROM materials WHERE id IN (${uniqueMaterialIds.map(() => '?').join(',')})`, uniqueMaterialIds, (err, materials) => {
          if (err) return next(err);
          if (materials.length !== uniqueMaterialIds.length) {
            return next(new NotFoundError('部分物料不存在'));
          }

          const taxRate = tax_rate || existingQuotation.tax_rate || 0.13;
          const calculatedItems = [];
          
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const result = calculatePrices(item, taxRate);
            if (!result.valid) {
              return next(new ValidationError(`第 ${i + 1} 行物料：${result.error}`));
            }
            calculatedItems.push({ ...item, ...result });
          }

          db.run(`
            UPDATE quotations SET supplier_id = ?, quotation_date = ?, currency = ?, exchange_rate = ?, tax_rate = ?, status = ?, remarks = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [supplier_id, quotation_date, currency.toUpperCase(), finalRate, taxRate, status || existingQuotation.status, remarks, quotationId], (err) => {
            if (err) return next(err);

            db.run('DELETE FROM quotation_items WHERE quotation_id = ?', [quotationId], (err) => {
              if (err) return next(err);

              let itemsCompleted = 0;
              let hasError = false;

              calculatedItems.forEach((item) => {
                db.run(`
                  INSERT INTO quotation_items (quotation_id, material_id, quantity, price_tax_included, price_tax_excluded, tax_amount, total_amount)
                  VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [quotationId, item.material_id, item.quantity, item.price_tax_included, item.price_tax_excluded, item.tax_amount, item.total_amount], (err) => {
                  if (err && !hasError) {
                    hasError = true;
                    return next(err);
                  }
                  
                  itemsCompleted++;
                  if (itemsCompleted === calculatedItems.length && !hasError) {
                    res.json({ success: true, message: '更新成功' });
                  }
                });
              });
            });
          });
        });
      } else {
        db.run(`
          UPDATE quotations SET supplier_id = ?, quotation_date = ?, currency = ?, exchange_rate = ?, tax_rate = ?, status = ?, remarks = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [supplier_id, quotation_date, currency.toUpperCase(), finalRate, tax_rate || existingQuotation.tax_rate, status || existingQuotation.status, remarks, quotationId], (err) => {
          if (err) return next(err);
          res.json({ success: true, message: '更新成功' });
        });
      }
    });
  });
});

router.delete('/:id', (req, res, next) => {
  db.run('DELETE FROM quotation_items WHERE quotation_id = ?', [req.params.id], (err) => {
    if (err) return next(err);
    
    db.run('DELETE FROM quotations WHERE id = ?', [req.params.id], function (err) {
      if (err) return next(err);
      if (this.changes === 0) {
        return next(new NotFoundError('报价单不存在'));
      }
      res.json({ success: true, message: '删除成功' });
    });
  });
});

module.exports = router;

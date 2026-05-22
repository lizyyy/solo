const { run, get, all } = require('../db');

function addInspectionOrder(batchId, data) {
  const orderNo = data.order_no || data.order_number;
  const items = data.items || data.exterior_items || data.interior_items || data.mechanical_items 
    ? {
        exterior: data.exterior_items || [],
        interior: data.interior_items || [],
        mechanical: data.mechanical_items || [],
        notes: data.notes
      }
    : data.items;
  
  const result = run(
    `INSERT INTO inspection_orders 
     (batch_id, order_no, inspection_date, inspector, mileage, fuel_level, items_json, raw_content)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [batchId, orderNo, data.inspection_date, data.inspector, 
     data.mileage, data.fuel_level, 
     items ? JSON.stringify(items) : null,
     data.raw_content || JSON.stringify(data)]
  );
  
  return get('SELECT * FROM inspection_orders WHERE id = ?', [result.lastID]);
}

function updateInspectionOrder(id, data) {
  run(
    `UPDATE inspection_orders 
     SET order_no = ?, inspection_date = ?, inspector = ?, mileage = ?, 
         fuel_level = ?, items_json = ?, raw_content = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [data.order_no, data.inspection_date, data.inspector, data.mileage,
     data.fuel_level, data.items ? JSON.stringify(data.items) : null,
     data.raw_content || JSON.stringify(data), id]
  );
  
  return get('SELECT * FROM inspection_orders WHERE id = ?', [id]);
}

function deleteInspectionOrder(id) {
  return run('DELETE FROM inspection_orders WHERE id = ?', [id]);
}

function addRepairQuote(batchId, data) {
  const quoteNo = data.quote_no || data.quote_number;
  const totalAmount = data.total_amount || data.items 
    ? data.items.reduce((sum, item) => sum + (item.amount || 0), 0) 
    : 0;
  
  const result = run(
    `INSERT INTO repair_quotes 
     (batch_id, quote_no, quote_date, repair_shop, total_amount, items_json, raw_content)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [batchId, quoteNo, data.quote_date, data.repair_shop,
     totalAmount,
     data.items ? JSON.stringify(data.items) : null,
     data.raw_content || JSON.stringify(data)]
  );
  
  updateBatchTotalAmount(batchId);
  
  return get('SELECT * FROM repair_quotes WHERE id = ?', [result.lastID]);
}

function updateRepairQuote(id, data) {
  const quote = get('SELECT * FROM repair_quotes WHERE id = ?', [id]);
  
  run(
    `UPDATE repair_quotes 
     SET quote_no = ?, quote_date = ?, repair_shop = ?, total_amount = ?, 
         items_json = ?, raw_content = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [data.quote_no, data.quote_date, data.repair_shop, data.total_amount || 0,
     data.items ? JSON.stringify(data.items) : null,
     data.raw_content || JSON.stringify(data), id]
  );
  
  if (quote) {
    updateBatchTotalAmount(quote.batch_id);
  }
  
  return get('SELECT * FROM repair_quotes WHERE id = ?', [id]);
}

function deleteRepairQuote(id) {
  const quote = get('SELECT * FROM repair_quotes WHERE id = ?', [id]);
  run('DELETE FROM repair_quotes WHERE id = ?', [id]);
  
  if (quote) {
    updateBatchTotalAmount(quote.batch_id);
  }
}

function addPhoto(batchId, data) {
  if (data.photos && Array.isArray(data.photos)) {
    const photoNoPrefix = `P${Date.now()}`;
    let lastId = null;
    data.photos.forEach((photo, index) => {
      const desc = `${photo.description} | 拍摄日期: ${data.photo_date || '未知'} | 拍摄人: ${data.photographer || '未知'}`;
      const result = run(
        `INSERT INTO photo_lists 
         (batch_id, photo_no, category, file_path, file_name, file_size, description)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [batchId, `${photoNoPrefix}-${index}`, photo.category, photo.file_url, 
         photo.file_url || `photo_${index}.jpg`, 0, desc]
      );
      lastId = result.lastID;
    });
    return { count: data.photos.length, lastId };
  }
  
  const result = run(
    `INSERT INTO photo_lists 
     (batch_id, photo_no, category, file_path, file_name, file_size, description)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [batchId, data.photo_no, data.category, data.file_path, 
     data.file_name, data.file_size, data.description]
  );
  
  return get('SELECT * FROM photo_lists WHERE id = ?', [result.lastID]);
}

function deletePhoto(id) {
  return run('DELETE FROM photo_lists WHERE id = ?', [id]);
}

function addScanDetail(batchId, data) {
  const result = run(
    `INSERT INTO scan_details 
     (batch_id, scan_no, scan_time, scan_location, operator, items_json, raw_content)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [batchId, data.scan_no, data.scan_time, data.scan_location, data.operator,
     data.items ? JSON.stringify(data.items) : null,
     data.raw_content || JSON.stringify(data)]
  );
  
  return get('SELECT * FROM scan_details WHERE id = ?', [result.lastID]);
}

function updateBatchTotalAmount(batchId) {
  const quotes = all(
    'SELECT COALESCE(SUM(total_amount), 0) as total FROM repair_quotes WHERE batch_id = ?',
    [batchId]
  );
  
  const total = quotes[0]?.total || 0;
  
  run(
    'UPDATE batches SET total_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [total, batchId]
  );
}

module.exports = {
  addInspectionOrder,
  updateInspectionOrder,
  deleteInspectionOrder,
  addRepairQuote,
  updateRepairQuote,
  deleteRepairQuote,
  addPhoto,
  deletePhoto,
  addScanDetail
};

const { v4: uuidv4 } = require('uuid');
const db = require('../utils/db');
const { addTimelineEntry } = require('../utils/timeline');
const { markIdempotencyComplete } = require('../middleware/idempotency');

const createSale = async (req, res) => {
  try {
    const { book_id, sold_price, sold_by, platform, buyer_info, commission_rate = 0.3 } = req.body;
    
    const book = await db.get('SELECT * FROM books WHERE id = ?', [book_id]);
    if (!book) {
      return res.status(404).json({ error: '书籍不存在' });
    }
    
    if (book.status !== 'for_sale') {
      return res.status(400).json({ error: '书籍不在待售状态' });
    }
    
    const commission = sold_price * commission_rate;
    const seller_share = sold_price - commission;
    
    const saleId = uuidv4();
    await db.run(
      `INSERT INTO sales (id, book_id, sold_price, sold_by, platform, buyer_info, commission_rate, seller_share, platform_fee)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [saleId, book_id, sold_price, sold_by, platform, buyer_info, commission_rate, seller_share, commission]
    );
    
    await db.run(
      `UPDATE books SET status = 'sold', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [book_id]
    );
    
    await addTimelineEntry(
      book_id,
      'sold',
      book.status,
      sold_by,
      `书籍已售出，售价${sold_price}元，平台佣金${commission.toFixed(2)}元，寄售人分成${seller_share.toFixed(2)}元`,
      { status: book.status },
      { status: 'sold', sold_price }
    );
    
    await markIdempotencyComplete(req.idempotencyKey, saleId);
    
    const sale = await db.get('SELECT * FROM sales WHERE id = ?', [saleId]);
    res.status(201).json(sale);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const handleSaleException = async (req, res) => {
  try {
    const { sale_id, exception_type, exception_note, handled_by } = req.body;
    
    const sale = await db.get('SELECT * FROM sales WHERE id = ?', [sale_id]);
    if (!sale) {
      return res.status(404).json({ error: '销售记录不存在' });
    }
    
    await db.run(
      `UPDATE sales 
       SET status = 'exception', exception_type = ?, exception_note = ?, handled_by = ?, handled_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [exception_type, exception_note, handled_by, sale_id]
    );
    
    await addTimelineEntry(
      sale.book_id,
      'sale_exception',
      'sold',
      handled_by,
      `销售异常处理：${exception_type}，备注：${exception_note}`
    );
    
    const updatedSale = await db.get('SELECT * FROM sales WHERE id = ?', [sale_id]);
    res.json(updatedSale);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createReturn = async (req, res) => {
  try {
    const { book_id, return_reason, returned_at, received_by } = req.body;
    
    const book = await db.get('SELECT * FROM books WHERE id = ?', [book_id]);
    if (!book) {
      return res.status(404).json({ error: '书籍不存在' });
    }
    
    const returnId = uuidv4();
    await db.run(
      `INSERT INTO returns (id, book_id, return_reason, returned_at, received_by)
       VALUES (?, ?, ?, ?, ?)`,
      [returnId, book_id, return_reason, returned_at, received_by]
    );
    
    await db.run(
      `UPDATE books SET status = 'returned', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [book_id]
    );
    
    await addTimelineEntry(
      book_id,
      'returned',
      book.status,
      received_by,
      `书籍退回，原因：${return_reason}，等待验收`
    );
    
    const returnRecord = await db.get('SELECT * FROM returns WHERE id = ?', [returnId]);
    res.status(201).json(returnRecord);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const inspectReturn = async (req, res) => {
  try {
    const { return_id, inspection_result, inspection_notes, inspected_by, manual_process_required } = req.body;
    
    const returnRecord = await db.get('SELECT * FROM returns WHERE id = ?', [return_id]);
    if (!returnRecord) {
      return res.status(404).json({ error: '退货记录不存在' });
    }
    
    if (returnRecord.status !== 'pending_inspection') {
      return res.status(400).json({ error: '退货已验收' });
    }
    
    const newStatus = inspection_result === 'pass' ? 'inspection_passed' : 'inspection_failed';
    
    await db.run(
      `UPDATE returns 
       SET inspection_result = ?, inspection_notes = ?, inspected_by = ?, inspected_at = CURRENT_TIMESTAMP, 
           status = ?, manual_process_required = ?
       WHERE id = ?`,
      [inspection_result, inspection_notes, inspected_by, newStatus, manual_process_required ? 1 : 0, return_id]
    );
    
    const bookStatus = inspection_result === 'pass' ? 'return_accepted' : 'return_rejected';
    
    await db.run(
      `UPDATE books SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [bookStatus, returnRecord.book_id]
    );
    
    await addTimelineEntry(
      returnRecord.book_id,
      bookStatus,
      'returned',
      inspected_by,
      `退货验收${inspection_result === 'pass' ? '通过' : '不通过'}：${inspection_notes}${manual_process_required ? '（需人工处理）' : ''}`
    );
    
    const updatedReturn = await db.get('SELECT * FROM returns WHERE id = ?', [return_id]);
    res.json(updatedReturn);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getSales = async (req, res) => {
  try {
    const { page = 1, pageSize = 20, book_id, status, start_date, end_date } = req.query;
    const offset = (page - 1) * pageSize;
    
    let whereClause = 'WHERE 1=1';
    let params = [];
    
    if (book_id) {
      whereClause += ' AND s.book_id = ?';
      params.push(book_id);
    }
    
    if (status) {
      whereClause += ' AND s.status = ?';
      params.push(status);
    }
    
    if (start_date) {
      whereClause += ' AND s.sold_at >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      whereClause += ' AND s.sold_at <= ?';
      params.push(end_date);
    }
    
    const sales = await db.all(
      `SELECT s.*, b.title, b.author, c.name as consignor_name
       FROM sales s
       LEFT JOIN books b ON s.book_id = b.id
       LEFT JOIN consignors c ON b.consignor_id = c.id
       ${whereClause}
       ORDER BY s.sold_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset]
    );
    
    const countResult = await db.get(
      `SELECT COUNT(*) as total FROM sales s ${whereClause}`,
      params
    );
    
    res.json({
      data: sales,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: countResult.total
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createSale,
  handleSaleException,
  createReturn,
  inspectReturn,
  getSales
};

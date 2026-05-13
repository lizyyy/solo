const { v4: uuidv4 } = require('uuid');
const db = require('../utils/db');
const { addTimelineEntry, getTimelineByBookId } = require('../utils/timeline');
const { markIdempotencyComplete } = require('../middleware/idempotency');

const getBooks = async (req, res) => {
  try {
    const { page = 1, pageSize = 20, status, consignorId, keyword } = req.query;
    const offset = (page - 1) * pageSize;
    
    let whereClause = 'WHERE 1=1';
    let params = [];
    
    if (status) {
      whereClause += ' AND b.status = ?';
      params.push(status);
    }
    
    if (consignorId) {
      whereClause += ' AND b.consignor_id = ?';
      params.push(consignorId);
    }
    
    if (keyword) {
      whereClause += ' AND (b.title LIKE ? OR b.author LIKE ? OR c.name LIKE ?)';
      const searchTerm = `%${keyword}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    const books = await db.all(
      `SELECT b.*, c.name as consignor_name 
       FROM books b 
       LEFT JOIN consignors c ON b.consignor_id = c.id
       ${whereClause} 
       ORDER BY b.created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset]
    );
    
    const countResult = await db.get(
      `SELECT COUNT(*) as total FROM books b ${whereClause}`,
      params
    );
    
    res.json({
      data: books,
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

const getBookById = async (req, res) => {
  try {
    const book = await db.get(
      `SELECT b.*, c.name as consignor_name, c.phone as consignor_phone
       FROM books b 
       LEFT JOIN consignors c ON b.consignor_id = c.id
       WHERE b.id = ?`,
      [req.params.id]
    );
    
    if (!book) {
      return res.status(404).json({ error: '书籍不存在' });
    }
    
    const timeline = await getTimelineByBookId(req.params.id);
    const evaluations = await db.all(
      'SELECT * FROM evaluations WHERE book_id = ? ORDER BY created_at DESC',
      [req.params.id]
    );
    const priceReductions = await db.all(
      'SELECT * FROM price_reductions WHERE book_id = ? ORDER BY created_at DESC',
      [req.params.id]
    );
    const sales = await db.all(
      'SELECT * FROM sales WHERE book_id = ? ORDER BY created_at DESC',
      [req.params.id]
    );
    const returns = await db.all(
      'SELECT * FROM returns WHERE book_id = ? ORDER BY created_at DESC',
      [req.params.id]
    );
    
    res.json({
      ...book,
      timeline,
      evaluations,
      priceReductions,
      sales,
      returns
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createBook = async (req, res) => {
  try {
    const { consignor_id, isbn, title, author, publisher, original_price } = req.body;
    const id = uuidv4();
    
    await db.run(
      `INSERT INTO books (id, consignor_id, isbn, title, author, publisher, original_price)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, consignor_id, isbn, title, author, publisher, original_price]
    );
    
    await addTimelineEntry(id, 'pending_evaluation', null, 'system', '书籍创建，等待品相估价');
    await markIdempotencyComplete(req.idempotencyKey, id);
    
    const book = await db.get('SELECT * FROM books WHERE id = ?', [id]);
    res.status(201).json(book);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const evaluateBook = async (req, res) => {
  try {
    const { book_id, evaluator, condition, condition_description, estimated_price, notes } = req.body;
    
    const book = await db.get('SELECT * FROM books WHERE id = ?', [book_id]);
    if (!book) {
      return res.status(404).json({ error: '书籍不存在' });
    }
    
    if (book.status !== 'pending_evaluation') {
      return res.status(400).json({ error: '书籍状态不允许估价' });
    }
    
    const evaluationId = uuidv4();
    await db.run(
      `INSERT INTO evaluations (id, book_id, evaluator, condition, condition_description, estimated_price, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [evaluationId, book_id, evaluator, condition, condition_description, estimated_price, notes]
    );
    
    const oldValues = { status: book.status, estimated_price: book.estimated_price, current_price: book.current_price };
    const newValues = { status: 'evaluated', estimated_price, current_price: estimated_price };
    
    await db.run(
      `UPDATE books SET estimated_price = ?, current_price = ?, status = 'evaluated', updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [estimated_price, estimated_price, book_id]
    );
    
    await addTimelineEntry(
      book_id, 
      'evaluated', 
      book.status, 
      evaluator, 
      `品相估价完成：${condition}，估价${estimated_price}元`,
      oldValues,
      newValues
    );
    
    const updatedBook = await db.get('SELECT * FROM books WHERE id = ?', [book_id]);
    res.json(updatedBook);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const requestPriceReduction = async (req, res) => {
  try {
    const { book_id, proposed_price, reason, proposer } = req.body;
    
    const book = await db.get('SELECT * FROM books WHERE id = ?', [book_id]);
    if (!book) {
      return res.status(404).json({ error: '书籍不存在' });
    }
    
    if (!['evaluated', 'for_sale'].includes(book.status)) {
      return res.status(400).json({ error: '书籍状态不允许申请降价' });
    }
    
    const reductionId = uuidv4();
    await db.run(
      `INSERT INTO price_reductions (id, book_id, original_price, proposed_price, reason, proposer)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [reductionId, book_id, book.current_price, proposed_price, reason, proposer]
    );
    
    await addTimelineEntry(
      book_id,
      book.status,
      book.status,
      proposer,
      `申请降价：从${book.current_price}元降到${proposed_price}元，原因：${reason}`,
      { current_price: book.current_price },
      { proposed_price }
    );
    
    const reduction = await db.get('SELECT * FROM price_reductions WHERE id = ?', [reductionId]);
    res.json(reduction);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const approvePriceReduction = async (req, res) => {
  try {
    const { reduction_id, approver, approved } = req.body;
    
    const reduction = await db.get('SELECT * FROM price_reductions WHERE id = ?', [reduction_id]);
    if (!reduction) {
      return res.status(404).json({ error: '降价申请不存在' });
    }
    
    if (reduction.status !== 'pending') {
      return res.status(400).json({ error: '降价申请已处理' });
    }
    
    const book = await db.get('SELECT * FROM books WHERE id = ?', [reduction.book_id]);
    const oldValues = { current_price: book.current_price };
    
    if (approved) {
      await db.run(
        `UPDATE price_reductions SET status = 'approved', approver = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [approver, reduction_id]
      );
      
      await db.run(
        `UPDATE books SET current_price = ?, status = 'for_sale', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [reduction.proposed_price, reduction.book_id]
      );
      
      await addTimelineEntry(
        reduction.book_id,
        'for_sale',
        book.status,
        approver,
        `降价申请已批准：从${reduction.original_price}元降到${reduction.proposed_price}元`,
        oldValues,
        { current_price: reduction.proposed_price }
      );
    } else {
      await db.run(
        `UPDATE price_reductions SET status = 'rejected', approver = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [approver, reduction_id]
      );
      
      await addTimelineEntry(
        reduction.book_id,
        book.status,
        book.status,
        approver,
        `降价申请已驳回，维持原价${reduction.original_price}元`,
        oldValues,
        oldValues
      );
    }
    
    const updatedReduction = await db.get('SELECT * FROM price_reductions WHERE id = ?', [reduction_id]);
    res.json(updatedReduction);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const markAsForSale = async (req, res) => {
  try {
    const { book_id, operator } = req.body;
    
    const book = await db.get('SELECT * FROM books WHERE id = ?', [book_id]);
    if (!book) {
      return res.status(404).json({ error: '书籍不存在' });
    }
    
    if (book.status !== 'evaluated') {
      return res.status(400).json({ error: '书籍状态不允许上架' });
    }
    
    await db.run(
      `UPDATE books SET status = 'for_sale', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [book_id]
    );
    
    await addTimelineEntry(
      book_id,
      'for_sale',
      book.status,
      operator,
      '书籍已上架待售'
    );
    
    const updatedBook = await db.get('SELECT * FROM books WHERE id = ?', [book_id]);
    res.json(updatedBook);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getBooks,
  getBookById,
  createBook,
  evaluateBook,
  requestPriceReduction,
  approvePriceReduction,
  markAsForSale
};

const express = require('express');
const cors = require('cors');
const { addDays, differenceInDays, format } = require('date-fns');
const XLSX = require('xlsx');
const { db, runAsync, getAsync, allAsync } = require('./database');

const app = express();
const PORT = 3001;
const BORROW_DAYS = 30;

app.use(cors());
app.use(express.json());

app.get('/api/locations', async (req, res) => {
  try {
    const locations = await allAsync('SELECT * FROM locations ORDER BY name');
    res.json(locations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/locations', async (req, res) => {
  try {
    const { name, description } = req.body;
    const result = await runAsync(
      'INSERT INTO locations (name, description) VALUES (?, ?)',
      [name, description]
    );
    res.json({ id: result.lastID, name, description });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tags', async (req, res) => {
  try {
    const tags = await allAsync('SELECT * FROM tags ORDER BY name');
    res.json(tags);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tags', async (req, res) => {
  try {
    const { name } = req.body;
    const result = await runAsync('INSERT INTO tags (name) VALUES (?)', [name]);
    res.json({ id: result.lastID, name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/residents', async (req, res) => {
  try {
    const residents = await allAsync('SELECT * FROM residents ORDER BY name');
    res.json(residents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/residents', async (req, res) => {
  try {
    const { name, phone, address } = req.body;
    const result = await runAsync(
      'INSERT INTO residents (name, phone, address) VALUES (?, ?, ?)',
      [name, phone, address]
    );
    res.json({ id: result.lastID, name, phone, address });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/books', async (req, res) => {
  try {
    const { location_id, status, tag_id } = req.query;
    
    let sql = `
      SELECT DISTINCT b.*, l.name as current_location_name
      FROM books b
      LEFT JOIN locations l ON b.current_location_id = l.id
      LEFT JOIN book_tags bt ON b.id = bt.book_id
      WHERE 1=1
    `;
    const params = [];

    if (location_id) {
      sql += ' AND b.current_location_id = ?';
      params.push(location_id);
    }
    if (status) {
      sql += ' AND b.status = ?';
      params.push(status);
    }
    if (tag_id) {
      sql += ' AND bt.tag_id = ?';
      params.push(tag_id);
    }

    const books = await allAsync(sql, params);
    
    for (const book of books) {
      book.tags = await allAsync(
        `SELECT t.* FROM tags t JOIN book_tags bt ON t.id = bt.tag_id WHERE bt.book_id = ?`,
        [book.id]
      );
      
      if (book.status === 'borrowed') {
        const activeBorrow = await getAsync(
          `SELECT br.*, r.name as resident_name 
           FROM borrow_records br 
           JOIN residents r ON br.resident_id = r.id 
           WHERE br.book_id = ? AND br.status = 'active'`,
          [book.id]
        );
        book.active_borrow = activeBorrow;
        
        if (activeBorrow && activeBorrow.expected_return_date) {
          const today = new Date();
          const expected = new Date(activeBorrow.expected_return_date);
          book.overdue_days = Math.max(0, differenceInDays(today, expected));
        }
      }
    }

    res.json(books);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/books/:id', async (req, res) => {
  try {
    const book = await getAsync(
      `SELECT b.*, l.name as current_location_name 
       FROM books b LEFT JOIN locations l ON b.current_location_id = l.id 
       WHERE b.id = ?`,
      [req.params.id]
    );
    
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    book.tags = await allAsync(
      `SELECT t.* FROM tags t JOIN book_tags bt ON t.id = bt.tag_id WHERE bt.book_id = ?`,
      [book.id]
    );

    book.history = await allAsync(
      `SELECT fh.*, 
              fl.name as from_location_name,
              tl.name as to_location_name,
              r.name as resident_name
       FROM flow_history fh
       LEFT JOIN locations fl ON fh.from_location_id = fl.id
       LEFT JOIN locations tl ON fh.to_location_id = tl.id
       LEFT JOIN residents r ON fh.resident_id = r.id
       WHERE fh.book_id = ?
       ORDER BY fh.timestamp DESC`,
      [book.id]
    );

    book.borrow_records = await allAsync(
      `SELECT br.*, 
              r.name as resident_name,
              bl.name as borrow_location_name,
              rl.name as return_location_name
       FROM borrow_records br
       JOIN residents r ON br.resident_id = r.id
       JOIN locations bl ON br.borrow_location_id = bl.id
       LEFT JOIN locations rl ON br.return_location_id = rl.id
       WHERE br.book_id = ?
       ORDER BY br.borrow_date DESC`,
      [book.id]
    );

    res.json(book);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/books', async (req, res) => {
  try {
    const { isbn, title, author, description, current_location_id, tag_ids = [] } = req.body;
    
    const result = await runAsync(
      `INSERT INTO books (isbn, title, author, description, current_location_id) 
       VALUES (?, ?, ?, ?, ?)`,
      [isbn, title, author, description, current_location_id]
    );

    const bookId = result.lastID;

    for (const tagId of tag_ids) {
      await runAsync('INSERT OR IGNORE INTO book_tags (book_id, tag_id) VALUES (?, ?)', [bookId, tagId]);
    }

    if (current_location_id) {
      await runAsync(
        `INSERT INTO flow_history (book_id, action, to_location_id, notes) 
         VALUES (?, 'added', ?, '新图书入库')`,
        [bookId, current_location_id]
      );
    }

    res.json({ id: bookId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/borrow', async (req, res) => {
  const { book_id, resident_id, borrow_location_id, borrow_days = BORROW_DAYS } = req.body;

  try {
    const book = await getAsync('SELECT * FROM books WHERE id = ?', [book_id]);
    if (!book) {
      return res.status(404).json({ error: '图书不存在' });
    }

    if (book.status === 'borrowed') {
      const activeBorrow = await getAsync(
        `SELECT * FROM borrow_records WHERE book_id = ? AND status = 'active'`,
        [book_id]
      );
      if (activeBorrow) {
        return res.status(400).json({ error: '该图书已被借出，无法重复借阅' });
      }
    }

    if (book.status === 'lost') {
      return res.status(400).json({ error: '该图书已标记为丢失，请先处理赔偿' });
    }

    if (book.status !== 'available') {
      return res.status(400).json({ error: '该图书当前不可借阅' });
    }

    const expectedReturnDate = format(addDays(new Date(), borrow_days), 'yyyy-MM-dd HH:mm:ss');

    await db.serialize(async () => {
      try {
        const borrowResult = await runAsync(
          `INSERT INTO borrow_records 
           (book_id, resident_id, borrow_location_id, expected_return_date, status)
           VALUES (?, ?, ?, ?, 'active')`,
          [book_id, resident_id, borrow_location_id, expectedReturnDate]
        );

        await runAsync(
          `UPDATE books SET status = 'borrowed', current_location_id = NULL WHERE id = ?`,
          [book_id]
        );

        await runAsync(
          `INSERT INTO flow_history 
           (book_id, action, from_location_id, resident_id, borrow_record_id, notes)
           VALUES (?, 'borrow', ?, ?, ?, '借阅借出')`,
          [book_id, borrow_location_id, resident_id, borrowResult.lastID]
        );

        res.json({ success: true, borrow_id: borrowResult.lastID });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/return', async (req, res) => {
  const { book_id, return_location_id } = req.body;

  try {
    const book = await getAsync('SELECT * FROM books WHERE id = ?', [book_id]);
    if (!book) {
      return res.status(404).json({ error: '图书不存在' });
    }

    if (book.status === 'lost') {
      return res.status(400).json({ error: '该图书已标记为丢失，不能直接归还。请先取消丢失状态或联系管理员' });
    }

    const activeBorrow = await getAsync(
      `SELECT * FROM borrow_records WHERE book_id = ? AND status = 'active'`,
      [book_id]
    );

    if (!activeBorrow) {
      return res.status(400).json({ error: '该图书没有正在进行的借阅记录' });
    }

    const now = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    const isCrossLocation = activeBorrow.borrow_location_id !== return_location_id;

    await runAsync(
      `UPDATE borrow_records 
       SET actual_return_date = ?, return_location_id = ?, status = 'returned'
       WHERE id = ?`,
      [now, return_location_id, activeBorrow.id]
    );

    await runAsync(
      `UPDATE books SET status = 'available', current_location_id = ? WHERE id = ?`,
      [return_location_id, book_id]
    );

    let notes = '图书归还';
    if (isCrossLocation) {
      notes = '换点归还';
    }

    await runAsync(
      `INSERT INTO flow_history 
       (book_id, action, to_location_id, resident_id, borrow_record_id, notes)
       VALUES (?, 'return', ?, ?, ?, ?)`,
      [book_id, return_location_id, activeBorrow.resident_id, activeBorrow.id, notes]
    );

    res.json({ success: true, is_cross_location: isCrossLocation });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/books/:id/mark-lost', async (req, res) => {
  const { resident_id } = req.body;
  const bookId = req.params.id;

  try {
    const book = await getAsync('SELECT * FROM books WHERE id = ?', [bookId]);
    if (!book) {
      return res.status(404).json({ error: '图书不存在' });
    }

    if (book.status === 'lost') {
      return res.status(400).json({ error: '该图书已经标记为丢失' });
    }

    const activeBorrow = await getAsync(
      `SELECT * FROM borrow_records WHERE book_id = ? AND status = 'active'`,
      [bookId]
    );

    await runAsync(`UPDATE books SET status = 'lost' WHERE id = ?`, [bookId]);

    if (activeBorrow) {
      await runAsync(
        `UPDATE borrow_records SET status = 'lost' WHERE id = ?`,
        [activeBorrow.id]
      );
    }

    await runAsync(
      `INSERT INTO flow_history 
       (book_id, action, resident_id, borrow_record_id, notes)
       VALUES (?, 'lost', ?, ?, '标记图书丢失')`,
      [bookId, resident_id || activeBorrow?.resident_id, activeBorrow?.id]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/compensate', async (req, res) => {
  const { book_id, resident_id, amount, notes } = req.body;

  try {
    const book = await getAsync('SELECT * FROM books WHERE id = ?', [book_id]);
    if (!book) {
      return res.status(404).json({ error: '图书不存在' });
    }

    await runAsync(
      `INSERT INTO compensations (book_id, resident_id, amount, notes) 
       VALUES (?, ?, ?, ?)`,
      [book_id, resident_id, amount, notes]
    );

    await runAsync(`UPDATE books SET status = 'compensated' WHERE id = ?`, [book_id]);

    await runAsync(
      `INSERT INTO flow_history 
       (book_id, action, resident_id, notes)
       VALUES (?, 'compensated', ?, ?)`,
      [book_id, resident_id, notes || '赔偿完成']
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/overdue', async (req, res) => {
  try {
    const now = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    const overdueRecords = await allAsync(
      `SELECT br.*, 
              b.title as book_title,
              r.name as resident_name,
              r.phone as resident_phone,
              bl.name as borrow_location_name
       FROM borrow_records br
       JOIN books b ON br.book_id = b.id
       JOIN residents r ON br.resident_id = r.id
       JOIN locations bl ON br.borrow_location_id = bl.id
       WHERE br.status = 'active' AND br.expected_return_date < ?
       ORDER BY br.expected_return_date ASC`,
      [now]
    );

    const withDays = overdueRecords.map(record => ({
      ...record,
      overdue_days: differenceInDays(new Date(), new Date(record.expected_return_date))
    }));

    res.json(withDays);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/export/inventory', async (req, res) => {
  try {
    const books = await allAsync(`
      SELECT b.*, 
             l.name as current_location_name,
             GROUP_CONCAT(t.name, ', ') as tags
      FROM books b
      LEFT JOIN locations l ON b.current_location_id = l.id
      LEFT JOIN book_tags bt ON b.id = bt.book_id
      LEFT JOIN tags t ON bt.tag_id = t.id
      GROUP BY b.id
      ORDER BY b.id
    `);

    const statusMap = {
      'available': '可借阅',
      'borrowed': '借阅中',
      'lost': '已丢失',
      'compensated': '已赔偿'
    };

    const inventoryData = books.map(book => ({
      '图书ID': book.id,
      'ISBN': book.isbn || '',
      '书名': book.title,
      '作者': book.author || '',
      '标签': book.tags || '',
      '状态': statusMap[book.status] || book.status,
      '当前位置': book.current_location_name || '借阅中',
      '入库时间': book.created_at
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(inventoryData);
    XLSX.utils.book_append_sheet(wb, ws, '库存盘点');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=book_inventory_${format(new Date(), 'yyyyMMdd')}.xlsx`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/export/flow', async (req, res) => {
  try {
    const flows = await allAsync(`
      SELECT fh.*,
             b.title as book_title,
             b.isbn as book_isbn,
             fl.name as from_location,
             tl.name as to_location,
             r.name as resident_name
      FROM flow_history fh
      JOIN books b ON fh.book_id = b.id
      LEFT JOIN locations fl ON fh.from_location_id = fl.id
      LEFT JOIN locations tl ON fh.to_location_id = tl.id
      LEFT JOIN residents r ON fh.resident_id = r.id
      ORDER BY fh.timestamp DESC
    `);

    const actionMap = {
      'added': '入库',
      'borrow': '借阅',
      'return': '归还',
      'lost': '丢失',
      'compensated': '赔偿'
    };

    const flowData = flows.map(f => ({
      '时间': f.timestamp,
      '图书ID': f.book_id,
      '书名': f.book_title,
      'ISBN': f.book_isbn || '',
      '动作': actionMap[f.action] || f.action,
      '来源位置': f.from_location || '',
      '目标位置': f.to_location || '',
      '操作人': f.resident_name || '',
      '备注': f.notes || ''
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(flowData);
    XLSX.utils.book_append_sheet(wb, ws, '流转记录');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=book_flow_${format(new Date(), 'yyyyMMdd')}.xlsx`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

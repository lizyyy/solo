const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const db = require('./database');
const screening = require('./screening');
const { v4: uuidv4 } = require('uuid');

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/batches', async (req, res) => {
  try {
    const batches = await db.getBatches();
    res.json({ success: true, data: batches });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/batches', async (req, res) => {
  try {
    const { batch_number, description } = req.body;
    
    if (!batch_number) {
      return res.status(400).json({ success: false, error: '批次号不能为空' });
    }

    const existingBatch = await db.getBatchByNumber(batch_number);
    if (existingBatch) {
      return res.status(400).json({ success: false, error: '批次号已存在' });
    }

    const batchId = await db.createBatch(batch_number, description || '');
    res.json({ success: true, data: { id: batchId, batch_number, description } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/import/isbn-csv', upload.single('file'), async (req, res) => {
  try {
    const { batch_id } = req.body;
    const file = req.file;

    if (!batch_id) {
      return res.status(400).json({ success: false, error: '请先选择或创建批次' });
    }

    if (!file) {
      return res.status(400).json({ success: false, error: '请选择要导入的CSV文件' });
    }

    const results = [];
    const stream = fs.createReadStream(file.path)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        try {
          let imported = 0;
          let errors = 0;

          for (const row of results) {
            try {
              const isbn = row.ISBN || row.isbn || row['ISBN'] || row['isbn'] || '';
              const title = row.书名 || row.Title || row.title || row['书名'] || '';
              const author = row.作者 || row.Author || row.author || row['作者'] || '';
              const publisher = row.出版社 || row.Publisher || row.publisher || row['出版社'] || '';
              const publishYear = row.出版年份 || row.Year || row.year || row['出版年份'] || '';

              await db.createBook({
                batch_id: batch_id,
                isbn: isbn.toString().trim(),
                title: title.toString().trim(),
                author: author.toString().trim(),
                publisher: publisher.toString().trim(),
                publish_year: publishYear.toString().trim()
              });
              imported++;
            } catch (err) {
              errors++;
              console.error('导入行失败:', err);
            }
          }

          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }

          res.json({ 
            success: true, 
            data: { 
              imported, 
              errors, 
              total: results.length 
            } 
          });
        } catch (err) {
          res.status(500).json({ success: false, error: err.message });
        }
      });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/import/appointments', upload.single('file'), async (req, res) => {
  try {
    const { batch_id } = req.body;
    const file = req.file;

    if (!batch_id) {
      return res.status(400).json({ success: false, error: '请先选择或创建批次' });
    }

    if (!file) {
      return res.status(400).json({ success: false, error: '请选择要导入的预约文件' });
    }

    const results = [];
    const stream = fs.createReadStream(file.path)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        try {
          let imported = 0;
          let errors = 0;

          for (const row of results) {
            try {
              const isbn = row.ISBN || row.isbn || row['ISBN'] || '';
              const title = row.书名 || row.Title || row.title || '';
              const requesterName = row.领书人 || row.Requester || row.requester || '';
              const contactInfo = row.联系方式 || row.Contact || row.contact || '';
              const appointmentDate = row.预约日期 || row.Date || row.date || '';
              const notes = row.备注 || row.Notes || row.notes || '';

              await db.createAppointment({
                batch_id: batch_id,
                isbn: isbn.toString().trim(),
                title: title.toString().trim(),
                requester_name: requesterName.toString().trim(),
                contact_info: contactInfo.toString().trim(),
                appointment_date: appointmentDate.toString().trim(),
                notes: notes.toString().trim()
              });
              imported++;
            } catch (err) {
              errors++;
              console.error('导入预约行失败:', err);
            }
          }

          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }

          res.json({ 
            success: true, 
            data: { 
              imported, 
              errors, 
              total: results.length 
            } 
          });
        } catch (err) {
          res.status(500).json({ success: false, error: err.message });
        }
      });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/import/damage-notes', upload.single('file'), async (req, res) => {
  try {
    const { batch_id } = req.body;
    const file = req.file;

    if (!batch_id) {
      return res.status(400).json({ success: false, error: '请先选择或创建批次' });
    }

    if (!file) {
      return res.status(400).json({ success: false, error: '请选择要导入的破损备注文件' });
    }

    const results = [];
    const stream = fs.createReadStream(file.path)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        try {
          let updated = 0;
          let errors = 0;

          const books = await db.getBooksByBatch(batch_id);
          const isbnMap = {};
          books.forEach(book => {
            if (book.isbn) {
              isbnMap[book.isbn] = book.id;
            }
            if (book.title) {
              isbnMap[book.title] = book.id;
            }
          });

          for (const row of results) {
            try {
              const key = row.ISBN || row.isbn || row.书名 || row.Title || '';
              const damageNote = row.破损备注 || row.备注 || row.DamageNote || row.notes || '';

              const bookId = isbnMap[key.toString().trim()];
              if (bookId && damageNote) {
                await db.updateBook(bookId, {
                  damage_note: damageNote.toString().trim()
                });
                updated++;
              }
            } catch (err) {
              errors++;
              console.error('更新破损备注失败:', err);
            }
          }

          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }

          res.json({ 
            success: true, 
            data: { 
              updated, 
              errors, 
              total: results.length 
            } 
          });
        } catch (err) {
          res.status(500).json({ success: false, error: err.message });
        }
      });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/import/images', upload.array('images', 100), async (req, res) => {
  try {
    const { batch_id } = req.body;
    const files = req.files;

    if (!batch_id) {
      return res.status(400).json({ success: false, error: '请先选择或创建批次' });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, error: '请选择要上传的图片' });
    }

    let imported = 0;
    
    for (const file of files) {
      try {
        const filename = path.parse(file.originalname).name;
        
        const isbnMatch = filename.match(/97[89][0-9]{10}|[0-9]{10}/);
        const isbn = isbnMatch ? isbnMatch[0] : '';
        
        const title = filename
          .replace(/[_\-\.\s]+/g, ' ')
          .replace(/97[89][0-9]{10}|[0-9]{10}/g, '')
          .trim();

        const imagePath = `/uploads/${file.filename}`;

        await db.createBook({
          batch_id: batch_id,
          isbn: isbn,
          title: title || file.originalname,
          image_path: imagePath
        });
        imported++;
      } catch (err) {
        console.error('导入图片失败:', err);
      }
    }

    res.json({ 
      success: true, 
      data: { 
        imported, 
        total: files.length 
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/batches/:batch_id/books', async (req, res) => {
  try {
    const { batch_id } = req.params;
    const { category, reviewed } = req.query;

    const filters = {};
    if (category) filters.category = category;
    if (reviewed !== undefined) filters.reviewed = reviewed === 'true';

    const books = await db.getBooksByBatch(batch_id, filters);
    
    const booksWithCategoryNames = books.map(book => ({
      ...book,
      ai_category_name: screening.getCategoryName(book.ai_category),
      final_category_name: book.final_category ? screening.getCategoryName(book.final_category) : null,
      display_category: book.final_category || book.ai_category,
      display_category_name: screening.getCategoryName(book.final_category || book.ai_category)
    }));

    res.json({ success: true, data: booksWithCategoryNames });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/books/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const book = await db.getBookById(id);
    
    if (!book) {
      return res.status(404).json({ success: false, error: '书籍不存在' });
    }

    const riskReasons = await db.getRiskReasonsByBook(id);
    const auditLogs = await db.getAuditLogsByBook(id);

    const bookWithDetails = {
      ...book,
      ai_category_name: screening.getCategoryName(book.ai_category),
      final_category_name: book.final_category ? screening.getCategoryName(book.final_category) : null,
      display_category: book.final_category || book.ai_category,
      display_category_name: screening.getCategoryName(book.final_category || book.ai_category),
      risk_reasons: riskReasons,
      audit_logs: auditLogs
    };

    res.json({ success: true, data: bookWithDetails });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/books/:id/category', async (req, res) => {
  try {
    const { id } = req.params;
    const { category, reason, operator } = req.body;

    if (!category) {
      return res.status(400).json({ success: false, error: '分类不能为空' });
    }

    const book = await db.getBookById(id);
    if (!book) {
      return res.status(404).json({ success: false, error: '书籍不存在' });
    }

    const oldCategory = book.final_category || book.ai_category;
    const oldReason = book.manual_reason || book.ai_reason;

    await db.updateBook(id, {
      final_category: category,
      manual_reason: reason || '',
      is_reviewed: 1
    });

    await db.addAuditLog({
      book_id: id,
      action: 'manual_review',
      old_category: oldCategory,
      new_category: category,
      old_reason: oldReason,
      new_reason: reason || '',
      operator: operator || 'volunteer'
    });

    const updatedBook = await db.getBookById(id);
    res.json({ 
      success: true, 
      data: {
        ...updatedBook,
        final_category_name: screening.getCategoryName(updatedBook.final_category)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/books/:id/notes', async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const book = await db.getBookById(id);
    if (!book) {
      return res.status(404).json({ success: false, error: '书籍不存在' });
    }

    await db.updateBook(id, { notes: notes || '' });

    const updatedBook = await db.getBookById(id);
    res.json({ success: true, data: updatedBook });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/screening/batch/:batch_id', async (req, res) => {
  try {
    const { batch_id } = req.params;
    const results = await screening.runBatchScreening(batch_id);
    
    const stats = {
      available: results.filter(r => r.category === 'available').length,
      need_disinfect: results.filter(r => r.category === 'need_disinfect').length,
      damaged: results.filter(r => r.category === 'damaged').length,
      suspicious: results.filter(r => r.category === 'suspicious').length,
      error: results.filter(r => r.category === 'error').length
    };

    res.json({ 
      success: true, 
      data: { 
        total: results.length,
        stats,
        results 
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/export/markdown/:batch_id', async (req, res) => {
  try {
    const { batch_id } = req.params;
    
    const books = await db.getBooksByBatch(batch_id);
    const batch = await db.getBatchByNumber(batch_id);
    
    const availableBooks = books.filter(book => 
      (book.final_category || book.ai_category) === 'available'
    );

    let markdown = `# 旧书上架清单\n\n`;
    markdown += `**批次号:** ${batch ? batch.batch_number : batch_id}\n`;
    markdown += `**生成时间:** ${new Date().toLocaleString('zh-CN')}\n`;
    markdown += `**可上架书籍数量:** ${availableBooks.length}\n\n`;
    markdown += `---\n\n`;

    if (availableBooks.length > 0) {
      markdown += `## 可上架书籍列表\n\n`;
      availableBooks.forEach((book, index) => {
        markdown += `### ${index + 1}. ${book.title || '未知书名'}\n\n`;
        if (book.isbn) markdown += `- **ISBN:** ${book.isbn}\n`;
        if (book.author) markdown += `- **作者:** ${book.author}\n`;
        if (book.publisher) markdown += `- **出版社:** ${book.publisher}\n`;
        if (book.publish_year) markdown += `- **出版年份:** ${book.publish_year}\n`;
        if (book.requester_name) {
          markdown += `- **预约状态:** 已被预约\n`;
          markdown += `- **领书人:** ${book.requester_name}\n`;
        }
        if (book.notes) markdown += `- **备注:** ${book.notes}\n`;
        markdown += `\n`;
      });
    } else {
      markdown += `本批次暂无符合上架条件的书籍。\n\n`;
    }

    const stats = {
      total: books.length,
      available: availableBooks.length,
      need_disinfect: books.filter(b => (b.final_category || b.ai_category) === 'need_disinfect').length,
      damaged: books.filter(b => (b.final_category || b.ai_category) === 'damaged').length,
      suspicious: books.filter(b => (b.final_category || b.ai_category) === 'suspicious').length
    };

    markdown += `---\n\n`;
    markdown += `## 统计信息\n\n`;
    markdown += `| 分类 | 数量 |\n`;
    markdown += `|------|------|\n`;
    markdown += `| 可上架 | ${stats.available} |\n`;
    markdown += `| 需消毒 | ${stats.need_disinfect} |\n`;
    markdown += `| 破损待处理 | ${stats.damaged} |\n`;
    markdown += `| 疑似盗版/缺页 | ${stats.suspicious} |\n`;
    markdown += `| **总计** | **${stats.total}** |\n\n`;

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=shelf-list-${batch_id}.md`);
    res.send(markdown);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/export/json/:batch_id', async (req, res) => {
  try {
    const { batch_id } = req.params;
    
    const books = await db.getBooksByBatch(batch_id);
    const auditLogs = await db.getAuditLogsByBatch(batch_id);
    const appointments = await db.getAppointmentsByBatch(batch_id);

    const auditData = {
      batch_id: batch_id,
      export_time: new Date().toISOString(),
      books: books.map(book => ({
        id: book.id,
        isbn: book.isbn,
        title: book.title,
        author: book.author,
        publisher: book.publisher,
        publish_year: book.publish_year,
        image_path: book.image_path,
        damage_note: book.damage_note,
        ai_category: book.ai_category,
        ai_category_name: screening.getCategoryName(book.ai_category),
        ai_reason: book.ai_reason,
        ai_confidence: book.ai_confidence,
        final_category: book.final_category,
        final_category_name: book.final_category ? screening.getCategoryName(book.final_category) : null,
        manual_reason: book.manual_reason,
        is_reviewed: book.is_reviewed,
        notes: book.notes,
        appointment: book.requester_name ? {
          requester_name: book.requester_name,
          contact_info: book.contact_info,
          appointment_info: book.appointment_info
        } : null,
        created_at: book.created_at,
        updated_at: book.updated_at
      })),
      appointments: appointments,
      audit_logs: auditLogs,
      statistics: {
        total_books: books.length,
        total_appointments: appointments.length,
        by_category: {
          available: books.filter(b => (b.final_category || b.ai_category) === 'available').length,
          need_disinfect: books.filter(b => (b.final_category || b.ai_category) === 'need_disinfect').length,
          damaged: books.filter(b => (b.final_category || b.ai_category) === 'damaged').length,
          suspicious: books.filter(b => (b.final_category || b.ai_category) === 'suspicious').length
        },
        reviewed: books.filter(b => b.is_reviewed).length,
        pending_review: books.filter(b => !b.is_reviewed).length
      }
    };

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=audit-${batch_id}.json`);
    res.send(JSON.stringify(auditData, null, 2));
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/categories', (req, res) => {
  res.json({ 
    success: true, 
    data: screening.CATEGORY_NAMES 
  });
});

module.exports = router;

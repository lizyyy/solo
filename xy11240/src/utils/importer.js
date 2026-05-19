const fs = require('fs');
const csv = require('csv-parser');
const { validateBookRecord } = require('./validator');
const { createSession, insertBookRecord, insertErrorRecord, updateSessionStats } = require('../models/bookModel');

async function importCSV(filePath, operator, role) {
  const sessionId = await createSession(filePath, 'csv', operator, role);
  const records = [];
  let successCount = 0;
  let errorCount = 0;
  let rowNum = 1;

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => {
        rowNum++;
        records.push({ data, rowNum });
      })
      .on('end', async () => {
        try {
          for (const { data, rowNum: rn } of records) {
            const record = {
              isbn: data.isbn || data.ISBN || '',
              title: data.title || data.书名 || '',
              author: data.author || data.作者 || '',
              publisher: data.publisher || data.出版社 || '',
              grade: data.grade || data.年级 || '',
              condition: data.condition || data.品相 || '',
              donor: data.donor || data.捐赠人 || '',
              remark: data.remark || data.备注 || ''
            };

            const validation = validateBookRecord(record, rn);

            if (validation.valid) {
              await insertBookRecord(sessionId, validation.normalized, operator, role);
              successCount++;
            } else {
              await insertErrorRecord(sessionId, rn, record, validation.errors, operator, role);
              errorCount++;
            }
          }

          await updateSessionStats(sessionId, records.length, successCount, errorCount);
          resolve({ sessionId, total: records.length, successCount, errorCount });
        } catch (error) {
          reject(error);
        }
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

async function importMarkdown(filePath, operator, role) {
  const sessionId = await createSession(filePath, 'markdown', operator, role);
  const content = fs.readFileSync(filePath, 'utf-8');

  const books = parseMarkdownBooks(content);
  let successCount = 0;
  let errorCount = 0;
  let rowNum = 1;

  for (const book of books) {
    rowNum++;
    const validation = validateBookRecord(book, rowNum);

    if (validation.valid) {
      await insertBookRecord(sessionId, validation.normalized, operator, role);
      successCount++;
    } else {
      await insertErrorRecord(sessionId, rowNum, book, validation.errors, operator, role);
      errorCount++;
    }
  }

  await updateSessionStats(sessionId, books.length, successCount, errorCount);
  return { sessionId, total: books.length, successCount, errorCount };
}

function parseMarkdownBooks(content) {
  const books = [];
  const lines = content.split('\n');
  let currentBook = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('## ') || line.startsWith('### ')) {
      if (currentBook) {
        books.push(currentBook);
      }
      currentBook = {
        title: line.replace(/^#+ /, '').trim(),
        isbn: '',
        author: '',
        publisher: '',
        grade: '',
        condition: '',
        donor: '',
        remark: ''
      };
    } else if (currentBook && line.includes(':')) {
      const [key, ...valueParts] = line.split(':');
      const value = valueParts.join(':').trim();
      const keyLower = key.toLowerCase().trim();

      if (keyLower.includes('isbn')) currentBook.isbn = value;
      else if (keyLower.includes('作者')) currentBook.author = value;
      else if (keyLower.includes('出版社')) currentBook.publisher = value;
      else if (keyLower.includes('年级')) currentBook.grade = value;
      else if (keyLower.includes('品相')) currentBook.condition = value;
      else if (keyLower.includes('捐赠人')) currentBook.donor = value;
      else if (keyLower.includes('备注')) currentBook.remark = value;
    }
  }

  if (currentBook) {
    books.push(currentBook);
  }

  return books;
}

module.exports = {
  importCSV,
  importMarkdown
};

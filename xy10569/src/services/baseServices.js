const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const { createAuditLog, getOperator } = require('../utils/common');
const config = require('../config');

const studentService = {
  async create(data, operatorId) {
    const operator = getOperator(operatorId);
    const now = dayjs().toISOString();
    const id = uuidv4();
    
    await db.run(`
      INSERT INTO students (id, student_no, name, class_id, gender, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, data.student_no, data.name, data.class_id, data.gender || null, now, now]);
    
    const student = await db.get('SELECT * FROM students WHERE id = ?', [id]);
    await createAuditLog('CREATE', 'student', id, null, student, operatorId);
    
    return student;
  },

  async getById(id) {
    return await db.get('SELECT * FROM students WHERE id = ?', [id]);
  },

  async getByNo(studentNo) {
    return await db.get('SELECT * FROM students WHERE student_no = ?', [studentNo]);
  },

  async list(filters = {}) {
    let sql = 'SELECT * FROM students WHERE 1=1';
    const params = [];
    
    if (filters.class_id) {
      sql += ' AND class_id = ?';
      params.push(filters.class_id);
    }
    if (filters.name) {
      sql += ' AND name LIKE ?';
      params.push(`%${filters.name}%`);
    }
    
    return await db.all(sql, params);
  },

  async update(id, data, operatorId) {
    const operator = getOperator(operatorId);
    const oldStudent = await db.get('SELECT * FROM students WHERE id = ?', [id]);
    
    if (!oldStudent) {
      throw new Error('学生不存在');
    }
    
    const now = dayjs().toISOString();
    const fields = [];
    const params = [];
    
    if (data.name !== undefined) { fields.push('name = ?'); params.push(data.name); }
    if (data.class_id !== undefined) { fields.push('class_id = ?'); params.push(data.class_id); }
    if (data.gender !== undefined) { fields.push('gender = ?'); params.push(data.gender); }
    
    fields.push('updated_at = ?');
    params.push(now);
    params.push(id);
    
    await db.run(`UPDATE students SET ${fields.join(', ')} WHERE id = ?`, params);
    
    const newStudent = await db.get('SELECT * FROM students WHERE id = ?', [id]);
    await createAuditLog('UPDATE', 'student', id, oldStudent, newStudent, operatorId);
    
    return newStudent;
  }
};

const classService = {
  async create(data, operatorId) {
    const now = dayjs().toISOString();
    const id = uuidv4();
    
    await db.run(`
      INSERT INTO classes (id, name, grade, head_teacher_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [id, data.name, data.grade, data.head_teacher_id || null, now, now]);
    
    const clazz = await db.get('SELECT * FROM classes WHERE id = ?', [id]);
    await createAuditLog('CREATE', 'class', id, null, clazz, operatorId);
    
    return clazz;
  },

  async getById(id) {
    return await db.get('SELECT * FROM classes WHERE id = ?', [id]);
  },

  async list(filters = {}) {
    let sql = 'SELECT * FROM classes WHERE 1=1';
    const params = [];
    
    if (filters.grade) {
      sql += ' AND grade = ?';
      params.push(filters.grade);
    }
    if (filters.name) {
      sql += ' AND name LIKE ?';
      params.push(`%${filters.name}%`);
    }
    
    return await db.all(sql, params);
  },

  async getStudents(classId) {
    return await db.all('SELECT * FROM students WHERE class_id = ?', [classId]);
  },

  async getUnreturnedBooks(classId) {
    return await db.all(`
      SELECT br.*, s.name as student_name, s.student_no, b.title as book_title
      FROM borrow_records br
      JOIN students s ON br.student_id = s.id
      JOIN books b ON br.book_id = b.id
      WHERE br.class_id = ? AND br.status = 'borrowed'
      ORDER BY br.due_date ASC
    `, [classId]);
  }
};

const teacherService = {
  async create(data, operatorId) {
    const now = dayjs().toISOString();
    const id = uuidv4();
    
    await db.run(`
      INSERT INTO teachers (id, teacher_no, name, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [id, data.teacher_no, data.name, data.role || 'teacher', now, now]);
    
    const teacher = await db.get('SELECT * FROM teachers WHERE id = ?', [id]);
    await createAuditLog('CREATE', 'teacher', id, null, teacher, operatorId);
    
    return teacher;
  },

  async getById(id) {
    return await db.get('SELECT * FROM teachers WHERE id = ?', [id]);
  },

  async list() {
    return await db.all('SELECT * FROM teachers');
  }
};

const bookService = {
  async create(data, operatorId) {
    const now = dayjs().toISOString();
    const id = uuidv4();
    
    await db.run(`
      INSERT INTO books (id, isbn, title, author, publisher, price, status, location, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'available', ?, ?, ?)
    `, [id, data.isbn || null, data.title, data.author || null, data.publisher || null, 
         data.price || 0, data.location || null, now, now]);
    
    const book = await db.get('SELECT * FROM books WHERE id = ?', [id]);
    await createAuditLog('CREATE', 'book', id, null, book, operatorId);
    
    return book;
  },

  async getById(id) {
    return await db.get('SELECT * FROM books WHERE id = ?', [id]);
  },

  async list(filters = {}) {
    let sql = 'SELECT * FROM books WHERE 1=1';
    const params = [];
    
    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.title) {
      sql += ' AND title LIKE ?';
      params.push(`%${filters.title}%`);
    }
    if (filters.isbn) {
      sql += ' AND isbn = ?';
      params.push(filters.isbn);
    }
    
    return await db.all(sql, params);
  },

  async updateStatus(id, status, operatorId) {
    const oldBook = await db.get('SELECT * FROM books WHERE id = ?', [id]);
    if (!oldBook) throw new Error('图书不存在');
    
    const now = dayjs().toISOString();
    await db.run('UPDATE books SET status = ?, updated_at = ? WHERE id = ?', [status, now, id]);
    
    const newBook = await db.get('SELECT * FROM books WHERE id = ?', [id]);
    await createAuditLog('UPDATE_STATUS', 'book', id, oldBook, newBook, operatorId);
    
    return newBook;
  }
};

module.exports = {
  studentService,
  classService,
  teacherService,
  bookService
};

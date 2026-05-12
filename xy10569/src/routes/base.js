const express = require('express');
const router = express.Router();
const { studentService, classService, teacherService, bookService } = require('../services/baseServices');

router.post('/students', async (req, res) => {
  try {
    const operatorId = req.headers['x-operator-id'] || 'admin';
    const student = await studentService.create(req.body, operatorId);
    res.status(201).json({ success: true, data: student });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/students', async (req, res) => {
  const students = await studentService.list(req.query);
  res.json({ success: true, data: students });
});

router.get('/students/:id', async (req, res) => {
  const student = await studentService.getById(req.params.id);
  if (!student) {
    return res.status(404).json({ success: false, error: '学生不存在' });
  }
  res.json({ success: true, data: student });
});

router.put('/students/:id', async (req, res) => {
  try {
    const operatorId = req.headers['x-operator-id'] || 'admin';
    const student = await studentService.update(req.params.id, req.body, operatorId);
    res.json({ success: true, data: student });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/classes', async (req, res) => {
  try {
    const operatorId = req.headers['x-operator-id'] || 'admin';
    const clazz = await classService.create(req.body, operatorId);
    res.status(201).json({ success: true, data: clazz });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/classes', async (req, res) => {
  const classes = await classService.list(req.query);
  res.json({ success: true, data: classes });
});

router.get('/classes/:id', async (req, res) => {
  const clazz = await classService.getById(req.params.id);
  if (!clazz) {
    return res.status(404).json({ success: false, error: '班级不存在' });
  }
  res.json({ success: true, data: clazz });
});

router.get('/classes/:id/students', async (req, res) => {
  const students = await classService.getStudents(req.params.id);
  res.json({ success: true, data: students });
});

router.post('/teachers', async (req, res) => {
  try {
    const operatorId = req.headers['x-operator-id'] || 'admin';
    const teacher = await teacherService.create(req.body, operatorId);
    res.status(201).json({ success: true, data: teacher });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/teachers', async (req, res) => {
  const teachers = await teacherService.list();
  res.json({ success: true, data: teachers });
});

router.post('/books', async (req, res) => {
  try {
    const operatorId = req.headers['x-operator-id'] || 'admin';
    const book = await bookService.create(req.body, operatorId);
    res.status(201).json({ success: true, data: book });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/books', async (req, res) => {
  const books = await bookService.list(req.query);
  res.json({ success: true, data: books });
});

router.get('/books/:id', async (req, res) => {
  const book = await bookService.getById(req.params.id);
  if (!book) {
    return res.status(404).json({ success: false, error: '图书不存在' });
  }
  res.json({ success: true, data: book });
});

module.exports = router;

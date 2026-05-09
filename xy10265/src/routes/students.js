const express = require('express');
const router = express.Router();
const StudentModel = require('../models/student');
const GameModel = require('../models/game');
const AttendanceModel = require('../models/attendance');
const EvaluationService = require('../services/evaluation');

router.post('/', (req, res) => {
  try {
    const { name, current_level, join_date } = req.body;
    if (!name || !current_level || !join_date) {
      return res.status(400).json({ error: '缺少必要字段: name, current_level, join_date' });
    }
    const student = StudentModel.create({ name, current_level, join_date });
    res.status(201).json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', (req, res) => {
  const students = StudentModel.findAll();
  res.json(students);
});

router.get('/:id', (req, res) => {
  const student = StudentModel.findById(req.params.id);
  if (!student) return res.status(404).json({ error: '学生不存在' });
  res.json(student);
});

router.put('/:id', (req, res) => {
  try {
    const { name, current_level, join_date, status } = req.body;
    const student = StudentModel.update(req.params.id, { name, current_level, join_date, status });
    if (!student) return res.status(404).json({ error: '学生不存在' });
    res.json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  const result = StudentModel.delete(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: '学生不存在' });
  res.json({ deleted: true, id: req.params.id });
});

router.post('/:id/games', (req, res) => {
  try {
    const student = StudentModel.findById(req.params.id);
    if (!student) return res.status(404).json({ error: '学生不存在' });
    
    const { games } = req.body;
    if (!Array.isArray(games)) {
      return res.status(400).json({ error: 'games 必须是数组' });
    }
    
    const created = GameModel.batchCreate(req.params.id, games);
    res.status(201).json({ count: created.length, games: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/games', (req, res) => {
  const games = GameModel.findByStudentId(req.params.id);
  res.json(games);
});

router.get('/:id/winrate', (req, res) => {
  const data = EvaluationService.getWinRateTrend(req.params.id);
  res.json(data);
});

router.post('/:id/attendances', (req, res) => {
  try {
    const student = StudentModel.findById(req.params.id);
    if (!student) return res.status(404).json({ error: '学生不存在' });
    
    const { attendances } = req.body;
    if (!Array.isArray(attendances)) {
      return res.status(400).json({ error: 'attendances 必须是数组' });
    }
    
    const created = AttendanceModel.batchCreate(req.params.id, attendances);
    res.status(201).json({ count: created.length, attendances: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/attendances', (req, res) => {
  const attendances = AttendanceModel.findByStudentId(req.params.id);
  res.json(attendances);
});

router.get('/:id/attendance-score', (req, res) => {
  const data = EvaluationService.getAttendanceWithWeight(req.params.id);
  res.json(data);
});

router.post('/:id/evaluate', (req, res) => {
  try {
    const { teacher_tags = [] } = req.body;
    const result = EvaluationService.evaluate(req.params.id, teacher_tags);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/confirm', (req, res) => {
  try {
    const { evaluation_id, comment } = req.body;
    if (!evaluation_id) {
      return res.status(400).json({ error: '缺少 evaluation_id' });
    }
    const result = EvaluationService.confirmPromotion(req.params.id, evaluation_id, comment);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/reject', (req, res) => {
  try {
    const { evaluation_id, comment } = req.body;
    if (!evaluation_id) {
      return res.status(400).json({ error: '缺少 evaluation_id' });
    }
    const result = EvaluationService.rejectPromotion(req.params.id, evaluation_id, comment);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id/report', (req, res) => {
  try {
    const report = EvaluationService.generateParentReport(req.params.id);
    res.json(report);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

module.exports = router;

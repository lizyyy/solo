const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { detectConflicts, validateData, calculateConflictSeverity } = require('./conflictDetector');
const { loadParams, saveParams, getDefaultParams } = require('./paramsManager');
const { loadNotes, saveNote, deleteNote } = require('./notesManager');
const { exportToExcel, exportToCSV } = require('./exporter');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const DATA_DIR = path.join(__dirname, '../data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/params', (req, res) => {
  const params = loadParams();
  res.json({ params, defaultParams: getDefaultParams() });
});

app.post('/api/params', (req, res) => {
  const { params } = req.body;
  const saved = saveParams(params);
  res.json({ success: true, params: saved });
});

app.post('/api/analyze', (req, res) => {
  const { courses, selections, filterOptions = {} } = req.body;
  const params = loadParams();
  
  const validation = validateData(courses, selections);
  
  const result = detectConflicts(courses, selections, params, filterOptions);
  
  res.json({
    success: true,
    conflicts: result.conflicts,
    statistics: result.statistics,
    validation: validation,
    trace: result.trace,
    filterOptions
  });
});

app.get('/api/notes/:recordId', (req, res) => {
  const { recordId } = req.params;
  const notes = loadNotes(recordId);
  res.json({ notes });
});

app.post('/api/notes', (req, res) => {
  const { recordId, content, author } = req.body;
  const note = saveNote(recordId, content, author);
  res.json({ success: true, note });
});

app.delete('/api/notes/:noteId', (req, res) => {
  const { noteId } = req.params;
  const success = deleteNote(noteId);
  res.json({ success });
});

app.post('/api/export/excel', (req, res) => {
  const { conflicts, courses, selections, filterOptions, notesMap } = req.body;
  try {
    const buffer = exportToExcel(conflicts, courses, selections, filterOptions, notesMap);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=conflict-analysis.xlsx');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/export/csv', (req, res) => {
  const { conflicts, courses, selections, filterOptions, notesMap } = req.body;
  try {
    const csv = exportToCSV(conflicts, courses, selections, filterOptions, notesMap);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=conflict-analysis.csv');
    res.send('\uFEFF' + csv);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/sample-data', (req, res) => {
  const sampleCourses = [
    { id: 'C001', name: '高等数学', teacher: '张教授', credits: 4, capacity: 100, enrolled: 95, time: '周一 08:00-09:40', location: '教学楼A101', department: '数学系' },
    { id: 'C002', name: '线性代数', teacher: '李教授', credits: 3, capacity: 80, enrolled: 80, time: '周二 10:00-11:40', location: '教学楼A202', department: '数学系' },
    { id: 'C003', name: '大学物理', teacher: '王教授', credits: 4, capacity: 120, enrolled: 110, time: '周三 08:00-09:40', location: '物理楼B101', department: '物理系' },
    { id: 'C004', name: '程序设计', teacher: '赵教授', credits: 3, capacity: 60, enrolled: 58, time: '周四 14:00-15:40', location: '计算机楼C301', department: '计算机系' },
    { id: 'C005', name: '数据结构', teacher: '刘教授', credits: 3, capacity: 50, enrolled: 50, time: '周一 08:00-09:40', location: '计算机楼C202', department: '计算机系' },
    { id: 'C006', name: '英语写作', teacher: '陈老师', credits: 2, capacity: 40, enrolled: 35, time: '周五 10:00-11:40', location: '外语楼D101', department: '外语系' },
    { id: 'C007', name: '', teacher: '', credits: null, capacity: 0, enrolled: null, time: '', location: '', department: '' },
    { id: 'C001', name: '高等数学-重复', teacher: '张教授', credits: 4, capacity: 100, enrolled: 95, time: '周一 08:00-09:40', location: '教学楼A101', department: '数学系' },
    { id: 'C008', name: '边界课程', teacher: '周教授', credits: 1, capacity: 1, enrolled: 1, time: '周一 09:40-11:20', location: '教学楼A101', department: '测试系' }
  ];

  const sampleSelections = [
    { id: 'S001', studentId: '2024001', courseId: 'C001', courseName: '高等数学', timestamp: '2024-09-01 08:00:00' },
    { id: 'S002', studentId: '2024001', courseId: 'C005', courseName: '数据结构', timestamp: '2024-09-01 08:05:00' },
    { id: 'S003', studentId: '2024001', courseId: 'C003', courseName: '大学物理', timestamp: '2024-09-01 08:10:00' },
    { id: 'S004', studentId: '2024002', courseId: 'C002', courseName: '线性代数', timestamp: '2024-09-01 08:15:00' },
    { id: 'S005', studentId: '2024002', courseId: 'C004', courseName: '程序设计', timestamp: '2024-09-01 08:20:00' },
    { id: 'S006', studentId: '2024003', courseId: 'C001', courseName: '高等数学', timestamp: '2024-09-01 08:25:00' },
    { id: 'S007', studentId: '2024003', courseId: 'C006', courseName: '英语写作', timestamp: '2024-09-01 08:30:00' },
    { id: 'S008', studentId: null, courseId: 'C007', courseName: '', timestamp: '' },
    { id: 'S009', studentId: '2024001', courseId: 'C001', courseName: '高等数学', timestamp: '2024-09-01 08:00:00' }
  ];

  res.json({ courses: sampleCourses, selections: sampleSelections });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

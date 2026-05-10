const express = require('express');
const path = require('path');
const multer = require('multer');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({
  dest: path.join(__dirname, 'temp'),
  limits: { fileSize: 10 * 1024 * 1024 }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/students', (req, res) => {
  const { class_name, activity_id } = req.query;
  const students = db.getStudents(class_name, activity_id);
  res.json(students);
});

app.post('/api/students', (req, res) => {
  const id = db.addStudent(req.body);
  res.json({ id });
});

app.put('/api/students/:id', (req, res) => {
  const success = db.updateStudent(req.params.id, req.body);
  res.json({ success });
});

app.delete('/api/students/:id', (req, res) => {
  const success = db.deleteStudent(req.params.id);
  res.json({ success });
});

app.get('/api/consents', (req, res) => {
  const consents = db.getConsents();
  res.json(consents);
});

app.post('/api/consents', (req, res) => {
  const id = db.addConsent(req.body);
  res.json({ id });
});

app.get('/api/health-tags', (req, res) => {
  const tags = db.getHealthTags();
  res.json(tags);
});

app.post('/api/health-tags', (req, res) => {
  const id = db.addHealthTag(req.body);
  res.json({ id });
});

app.get('/api/teachers', (req, res) => {
  const teachers = db.getTeachers();
  res.json(teachers);
});

app.post('/api/teachers', (req, res) => {
  const id = db.addTeacher(req.body);
  res.json({ id });
});

app.get('/api/vehicles', (req, res) => {
  const vehicles = db.getVehicles();
  res.json(vehicles);
});

app.post('/api/vehicles', (req, res) => {
  const id = db.addVehicle(req.body);
  res.json({ id });
});

app.get('/api/activities', (req, res) => {
  const activities = db.getActivities();
  res.json(activities);
});

app.post('/api/activities', (req, res) => {
  const id = db.addActivity(req.body);
  res.json({ id });
});

app.get('/api/activities/:id', (req, res) => {
  const activity = db.getActivity(req.params.id);
  res.json(activity);
});

app.put('/api/activities/:id', (req, res) => {
  const success = db.updateActivity(req.params.id, req.body);
  res.json({ success });
});

app.get('/api/classes', (req, res) => {
  const classes = db.getClasses();
  res.json(classes);
});

app.post('/api/import/csv', upload.single('file'), (req, res) => {
  try {
    const result = db.importCSV(req.file.path, req.body.type);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/import/json', upload.single('file'), (req, res) => {
  try {
    const result = db.importJSON(req.file.path);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/risk/:activity_id', (req, res) => {
  const risks = db.getRisks(req.params.activity_id);
  res.json(risks);
});

app.post('/api/risk/override', (req, res) => {
  const { student_id, activity_id, risk_type, override, note } = req.body;
  db.setRiskOverride(student_id, activity_id, risk_type, override, note);
  res.json({ success: true });
});

app.get('/api/export/departure/:activity_id', (req, res) => {
  const data = db.getDepartureList(req.params.activity_id);
  res.json(data);
});

app.get('/api/export/risk/:activity_id', (req, res) => {
  const data = db.getRiskExport(req.params.activity_id);
  res.json(data);
});

app.get('/api/export/parent-confirm/:activity_id', (req, res) => {
  const data = db.getParentConfirmList(req.params.activity_id);
  res.json(data);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`春秋游安全放行台 运行在 http://localhost:${PORT}`);
});

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const {
  createOrGetMaterialBatch,
  createSession,
  completeStep,
  recordError,
  addNote,
  endSession,
  getSessionHistory,
  getSteps,
  saveSteps,
  getMaterialBatches,
  getTeachingSessions
} = require('./data/teachingSession');

const {
  uploadVideoVersion,
  getVideoVersionHistory,
  compareTwoVersions,
  getAllVideos
} = require('./data/videoVersion');

const {
  exportSessionToText,
  exportBatchHistoryToText,
  exportSimpleChecklist
} = require('./data/exportRecords');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '工业机械臂示教系统运行正常' });
});

app.get('/api/steps', (req, res) => {
  res.json({ success: true, steps: getSteps() });
});

app.post('/api/steps', (req, res) => {
  const { steps } = req.body;
  saveSteps(steps);
  res.json({ success: true, message: '步骤已保存' });
});

app.post('/api/materials', (req, res) => {
  const { batchNumber, materialName } = req.body;
  const result = createOrGetMaterialBatch(batchNumber, materialName);
  res.json(result);
});

app.get('/api/materials', (req, res) => {
  res.json({ success: true, materials: getMaterialBatches() });
});

app.post('/api/sessions', (req, res) => {
  const { batchNumber, teacherName, className } = req.body;
  const result = createSession(batchNumber, teacherName, className);
  res.json(result);
});

app.get('/api/sessions', (req, res) => {
  res.json({ success: true, sessions: getTeachingSessions() });
});

app.post('/api/sessions/:sessionId/complete-step', (req, res) => {
  const { sessionId } = req.params;
  const { stepId, notes } = req.body;
  const result = completeStep(sessionId, stepId, notes);
  res.json(result);
});

app.post('/api/sessions/:sessionId/error', (req, res) => {
  const { sessionId } = req.params;
  const { errorCode, params } = req.body;
  const result = recordError(sessionId, errorCode, params);
  res.json(result);
});

app.post('/api/sessions/:sessionId/notes', (req, res) => {
  const { sessionId } = req.params;
  const { content } = req.body;
  const result = addNote(sessionId, content);
  res.json(result);
});

app.post('/api/sessions/:sessionId/end', (req, res) => {
  const { sessionId } = req.params;
  const result = endSession(sessionId);
  res.json(result);
});

app.get('/api/materials/:batchNumber/history', (req, res) => {
  const { batchNumber } = req.params;
  const history = getSessionHistory(batchNumber);
  res.json({ success: true, history });
});

app.post('/api/videos', (req, res) => {
  const { videoInfo, uploadedBy } = req.body;
  const result = uploadVideoVersion(videoInfo, uploadedBy);
  res.json(result);
});

app.get('/api/videos', (req, res) => {
  res.json({ success: true, videos: getAllVideos() });
});

app.get('/api/videos/:videoId/history', (req, res) => {
  const { videoId } = req.params;
  const result = getVideoVersionHistory(videoId);
  res.json(result);
});

app.get('/api/videos/:videoId/compare', (req, res) => {
  const { videoId } = req.params;
  const { v1, v2 } = req.query;
  const result = compareTwoVersions(videoId, parseInt(v1), parseInt(v2));
  res.json(result);
});

app.get('/api/export/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const result = exportSessionToText(sessionId);
  
  if (!result.success) {
    return res.status(404).json(result);
  }
  
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(result.filename)}"`);
  res.send(result.content);
});

app.get('/api/export/batch/:batchNumber', (req, res) => {
  const { batchNumber } = req.params;
  const result = exportBatchHistoryToText(batchNumber);
  
  if (!result.success) {
    return res.status(404).json(result);
  }
  
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(result.filename)}"`);
  res.send(result.content);
});

app.get('/api/export/checklist/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const result = exportSimpleChecklist(sessionId);
  
  if (!result.success) {
    return res.status(404).json(result);
  }
  
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(result.filename)}"`);
  res.send(result.content);
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  工业机械臂示教系统已启动`);
  console.log(`  访问地址: http://localhost:${PORT}`);
  console.log(`========================================\n`);
});

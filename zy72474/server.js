const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const store = require('./src/data/store');
const { createPhotoRecord, BOUNDARY_STATUS, WORKFLOW_STAGE } = require('./src/data/models');
const workflowService = require('./src/services/workflowService');
const { getAllRules } = require('./src/rules/boundaryRules');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads/photos');
    require('fs').mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({ storage });

function generateFileHash(filepath) {
  const fileBuffer = require('fs').readFileSync(filepath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/points', (req, res) => {
  const { boundaryStatus, street, workflowStage } = req.query;
  const filters = {};
  if (boundaryStatus) filters.boundaryStatus = boundaryStatus;
  if (street) filters.street = street;
  if (workflowStage) filters.workflowStage = workflowStage;
  
  const points = store.listPoints(filters);
  res.json({ points, count: points.length });
});

app.get('/api/points/:pointId', (req, res) => {
  const point = store.getPoint(req.params.pointId);
  if (!point) return res.status(404).json({ error: '点位不存在' });
  res.json({ point });
});

app.post('/api/points', (req, res) => {
  const result = store.addPoint(req.body);
  res.status(201).json(result);
});

app.put('/api/points/:pointId', (req, res) => {
  const { updates, context } = req.body;
  const result = store.updatePoint(req.params.pointId, updates || {}, context || {});
  if (!result) return res.status(404).json({ error: '点位不存在' });
  res.json(result);
});

app.post('/api/points/:pointId/photos', upload.array('photos', 50), (req, res) => {
  const pointId = req.params.pointId;
  const point = store.getPoint(pointId);
  if (!point) return res.status(404).json({ error: '点位不存在' });
  
  const results = [];
  const importedBy = req.body.importedBy || 'system';
  
  for (const file of req.files) {
    const fileHash = generateFileHash(file.path);
    const fileInfo = {
      originalname: file.originalname,
      filename: file.filename,
      path: file.path,
      size: file.size,
      mimetype: file.mimetype,
      hash: fileHash
    };
    
    const photoRecord = createPhotoRecord(fileInfo, pointId, importedBy);
    const result = store.addPhotoToPoint(pointId, photoRecord);
    results.push(result);
  }
  
  res.json({
    pointId,
    results,
    importedCount: results.filter(r => !r.duplicated).length,
    duplicatedCount: results.filter(r => r.duplicated).length
  });
});

app.post('/api/points/:pointId/bus-cards', (req, res) => {
  const { busCardData, supplementedBy, reason } = req.body;
  const result = workflowService.supplementBusCard(
    req.params.pointId, 
    busCardData, 
    supplementedBy || '阿宁',
    reason || null
  );
  if (!result) return res.status(404).json({ error: '点位不存在' });
  res.json(result);
});

app.get('/api/points/:pointId/versions', (req, res) => {
  const versions = store.getPointVersions(req.params.pointId);
  if (!versions) return res.status(404).json({ error: '点位不存在' });
  res.json({ pointId: req.params.pointId, versions });
});

app.get('/api/points/:pointId/versions/compare', (req, res) => {
  const { v1, v2 } = req.query;
  const result = store.compareVersions(req.params.pointId, v1, v2);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

app.post('/api/points/:pointId/rollback', (req, res) => {
  const { versionId, rolledBackBy } = req.body;
  const result = store.rollbackToVersion(req.params.pointId, versionId, {
    modifiedBy: rolledBackBy || '阿宁'
  });
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

app.post('/api/points/:pointId/review-boundary', (req, res) => {
  const { reviewAction, assignedStreet, reviewedBy } = req.body;
  const result = workflowService.reviewBoundaryPoint(
    req.params.pointId,
    reviewAction,
    assignedStreet,
    reviewedBy || '阿宁'
  );
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

app.post('/api/map/export', (req, res) => {
  const { pointIds, exportedBy } = req.body;
  const result = workflowService.exportMap(pointIds || [], exportedBy || '阿宁');
  res.json(result);
});

app.get('/api/rules/boundary', (req, res) => {
  const rules = getAllRules();
  res.json({ rules, count: rules.length });
});

app.get('/api/enums', (req, res) => {
  res.json({
    BOUNDARY_STATUS,
    WORKFLOW_STAGE
  });
});

app.get('/api/stats', (req, res) => {
  const allPoints = store.listPoints();
  const stats = {
    total: allPoints.length,
    boundaryPending: allPoints.filter(p => p.boundaryStatus === BOUNDARY_STATUS.BOUNDARY_PENDING).length,
    boundaryConfirmed: allPoints.filter(p => p.boundaryStatus === BOUNDARY_STATUS.BOUNDARY_CONFIRMED).length,
    normal: allPoints.filter(p => p.boundaryStatus === BOUNDARY_STATUS.NORMAL).length,
    stagePhotoImported: allPoints.filter(p => p.workflowStage === WORKFLOW_STAGE.PHOTO_IMPORTED).length,
    stageBusCardSupplemented: allPoints.filter(p => p.workflowStage === WORKFLOW_STAGE.BUS_CARD_SUPPLEMENTED).length,
    stageMapExported: allPoints.filter(p => p.workflowStage === WORKFLOW_STAGE.MAP_EXPORTED).length,
    totalMatchCount: allPoints.reduce((sum, p) => sum + (p.matchCount || 0), 0)
  };
  res.json(stats);
});

app.listen(PORT, () => {
  console.log(`停车错峰共享匹配系统已启动: http://localhost:${PORT}`);
  console.log(`边界规则已加载: ${getAllRules().length} 条`);
});

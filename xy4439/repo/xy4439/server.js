const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const csvParser = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { DatabaseManager } = require('./database');
const { RiskDetector } = require('./riskDetector');
const { Exporter } = require('./exporter');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const upload = multer({ dest: 'uploads/' });
const db = new DatabaseManager();
const riskDetector = new RiskDetector(db);
const exporter = new Exporter(db);

app.get('/api/shifts', async (req, res) => {
  try {
    const shifts = await db.getAllShifts();
    res.json(shifts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/shifts/:date/:shiftType', async (req, res) => {
  try {
    const { date, shiftType } = req.params;
    const shiftData = await db.getShiftWithDetails(date, shiftType);
    res.json(shiftData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/shifts/:date/:shiftType/risks', async (req, res) => {
  try {
    const { date, shiftType } = req.params;
    const risks = await riskDetector.detectRisksForShift(date, shiftType);
    res.json(risks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/upload/welding-records', upload.single('file'), async (req, res) => {
  try {
    const results = [];
    const { date, shiftType } = req.body;
    
    fs.createReadStream(req.file.path)
      .pipe(csvParser())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        const count = await db.importWeldingRecords(results, date, shiftType);
        fs.unlinkSync(req.file.path);
        res.json({ success: true, count, message: `成功导入 ${count} 条焊机记录` });
      });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/upload/exhaust-sensor', upload.single('file'), async (req, res) => {
  try {
    const results = [];
    const { date, shiftType } = req.body;
    
    fs.createReadStream(req.file.path)
      .pipe(csvParser())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        const count = await db.importExhaustSensorData(results, date, shiftType);
        fs.unlinkSync(req.file.path);
        res.json({ success: true, count, message: `成功导入 ${count} 条排风传感器数据` });
      });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/upload/employee-schedule', upload.single('file'), async (req, res) => {
  try {
    const results = [];
    const { date, shiftType } = req.body;
    
    fs.createReadStream(req.file.path)
      .pipe(csvParser())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        const count = await db.importEmployeeSchedule(results, date, shiftType);
        fs.unlinkSync(req.file.path);
        res.json({ success: true, count, message: `成功导入 ${count} 条员工排班数据` });
      });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/upload/helmet-inspection', upload.single('file'), async (req, res) => {
  try {
    const results = [];
    const { date, shiftType } = req.body;
    
    fs.createReadStream(req.file.path)
      .pipe(csvParser())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        const count = await db.importHelmetInspection(results, date, shiftType);
        fs.unlinkSync(req.file.path);
        res.json({ success: true, count, message: `成功导入 ${count} 条防护面罩点检数据` });
      });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/risks/:riskId/review', async (req, res) => {
  try {
    const { riskId } = req.params;
    const { reviewer, comment, status } = req.body;
    const reviewId = await db.addRiskReview(riskId, reviewer, comment, status);
    res.json({ success: true, reviewId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/shifts/:date/:shiftType/export/markdown', async (req, res) => {
  try {
    const { date, shiftType } = req.params;
    const markdown = await exporter.exportMarkdown(date, shiftType);
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename=交接单-${date}-${shiftType}.md`);
    res.send(markdown);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/shifts/:date/:shiftType/export/json', async (req, res) => {
  try {
    const { date, shiftType } = req.params;
    const jsonData = await exporter.exportJSON(date, shiftType);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=审计包-${date}-${shiftType}.json`);
    res.json(jsonData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});

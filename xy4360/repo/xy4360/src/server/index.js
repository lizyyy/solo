const express = require('express');
const path = require('path');
const fs = require('fs');

const config = require('../config');
const RFCheckerModel = require('../db/jsonModel');
const FrequencyChecker = require('../services/frequencyChecker');
const DataImporter = require('../services/dataImporter');
const Exporter = require('../services/exporter');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const app = express();
const port = process.env.PORT || config.app.port;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const model = new RFCheckerModel();
const freqChecker = new FrequencyChecker();
const importer = new DataImporter();
const exporter = new Exporter();

app.get('/api/sessions', (req, res) => {
  try {
    const sessions = model.getAllSessions();
    res.json({ success: true, data: sessions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/sessions/:id', (req, res) => {
  try {
    const session = model.getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, error: '会话不存在' });
    }
    
    const frequencies = model.getFrequencies(req.params.id);
    const conflicts = model.getConflicts(req.params.id);
    const forbiddenBands = model.getForbiddenBands(req.params.id);
    
    res.json({
      success: true,
      data: {
        session,
        frequencies,
        conflicts,
        forbiddenBands
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/sessions', async (req, res) => {
  try {
    const { name, description } = req.body;
    const sessionId = model.createSession(name || '新会话', description);
    res.json({ success: true, data: { id: sessionId } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/sessions/:id', (req, res) => {
  try {
    model.deleteSession(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/sessions/:id/check', (req, res) => {
  try {
    const sessionId = req.params.id;
    const frequencies = model.getFrequencies(sessionId);
    const forbiddenBands = model.getForbiddenBands(sessionId);
    
    const conflicts = freqChecker.checkAll(frequencies, forbiddenBands);
    
    conflicts.forEach(conflict => {
      model.createConflict(sessionId, conflict);
    });
    
    const allConflicts = model.getConflicts(sessionId);
    
    res.json({
      success: true,
      data: {
        total: conflicts.length,
        conflicts: allConflicts,
        summary: {
          critical: conflicts.filter(c => c.severity === 'critical').length,
          high: conflicts.filter(c => c.severity === 'high').length,
          medium: conflicts.filter(c => c.severity === 'medium').length,
          low: conflicts.filter(c => c.severity === 'low').length
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/sessions/:id/frequencies', (req, res) => {
  try {
    const frequencies = model.getFrequencies(req.params.id);
    res.json({ success: true, data: frequencies });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/sessions/:id/frequencies', (req, res) => {
  try {
    const { device_id, frequency, channel, is_backup, notes } = req.body;
    const freqId = model.createFrequency(req.params.id, device_id, {
      frequency,
      channel,
      is_backup,
      notes
    });
    res.json({ success: true, data: { id: freqId } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/sessions/:id/conflicts', (req, res) => {
  try {
    const conflicts = model.getConflicts(req.params.id);
    res.json({ success: true, data: conflicts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/conflicts/:id/resolve', (req, res) => {
  try {
    const { action, suggested_frequency, notes, frequency_id } = req.body;
    const resolutionId = model.createResolutionNote({
      conflict_id: req.params.id,
      frequency_id,
      action,
      suggested_frequency,
      notes
    });
    res.json({ success: true, data: { id: resolutionId } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/conflicts/:id/notes', (req, res) => {
  try {
    const notes = model.getResolutionNotes(req.params.id);
    res.json({ success: true, data: notes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/sessions/:id/export/markdown', (req, res) => {
  try {
    const session = model.getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, error: '会话不存在' });
    }
    
    const frequencies = model.getFrequencies(req.params.id);
    const conflicts = model.getConflicts(req.params.id);
    const forbiddenBands = model.getForbiddenBands(req.params.id);
    
    const markdown = exporter.exportToMarkdown(session, frequencies, conflicts, forbiddenBands);
    
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="${session.name.replace(/\s+/g, '_')}_频点表.md"`);
    res.send(markdown);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/sessions/:id/export/csv', async (req, res) => {
  try {
    const session = model.getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, error: '会话不存在' });
    }
    
    const frequencies = model.getFrequencies(req.params.id);
    const conflicts = model.getConflicts(req.params.id);
    
    const outputPath = path.join(dataDir, `export_${Date.now()}.csv`);
    await exporter.exportToCsv(session, frequencies, conflicts, outputPath);
    
    res.download(outputPath, `${session.name.replace(/\s+/g, '_')}_频点表.csv`, (err) => {
      if (err) console.error('下载错误:', err);
      fs.unlinkSync(outputPath);
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/sessions/:id/export/conflicts', async (req, res) => {
  try {
    const session = model.getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, error: '会话不存在' });
    }
    
    const conflicts = model.getConflicts(req.params.id);
    
    const outputPath = path.join(dataDir, `conflicts_${Date.now()}.csv`);
    await exporter.exportConflictsToCsv(session, conflicts, outputPath);
    
    res.download(outputPath, `${session.name.replace(/\s+/g, '_')}_冲突清单.csv`, (err) => {
      if (err) console.error('下载错误:', err);
      fs.unlinkSync(outputPath);
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/conflict-types', (req, res) => {
  res.json({
    success: true,
    data: {
      types: [
        { code: 'same_frequency', label: '同频冲突' },
        { code: 'proximity_critical', label: '距离过近' },
        { code: 'proximity_warning', label: '距离较近' },
        { code: 'forbidden_band', label: '禁用频段' },
        { code: 'intermodulation', label: '互调干扰' },
        { code: 'no_backup', label: '无备用' },
        { code: 'backup_proximity', label: '备用距离' }
      ],
      severities: [
        { code: 'critical', label: '严重' },
        { code: 'high', label: '高危' },
        { code: 'medium', label: '中等' },
        { code: 'low', label: '轻微' }
      ]
    }
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(port, () => {
  console.log(`RF频点预检工具运行在 http://localhost:${port}`);
  console.log(`按 Ctrl+C 停止服务器`);
});

process.on('SIGINT', () => {
  console.log('\n正在关闭服务器...');
  model.close();
  process.exit(0);
});

module.exports = app;

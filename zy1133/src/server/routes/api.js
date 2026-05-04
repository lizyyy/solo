const express = require('express');
const router = express.Router();
const multer = require('multer');
const Papa = require('papaparse');

const localStorage = require('../services/localStorage');
const { DataValidator } = require('../services/dataValidator');
const DataAnalyzer = require('../services/dataAnalyzer');
const ReportExporter = require('../services/reportExporter');
const { REQUIRED_COLUMNS, COLUMNS_DESCRIPTION, ERROR_TYPES, MARK_TYPES } = require('../models');

const upload = multer({ storage: multer.memoryStorage() });

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/config', (req, res) => {
  res.json({
    requiredColumns: REQUIRED_COLUMNS,
    columnsDescription: COLUMNS_DESCRIPTION,
    errorTypes: ERROR_TYPES,
    markTypes: MARK_TYPES
  });
});

router.get('/projects', (req, res) => {
  try {
    const projects = localStorage.listProjects();
    res.json({ success: true, data: projects });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/projects', (req, res) => {
  try {
    const { name, data } = req.body;
    const project = localStorage.saveProject({ name, data });
    res.json({ success: true, data: project });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/projects/:id', (req, res) => {
  try {
    const project = localStorage.loadProject(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, error: '项目不存在' });
    }
    res.json({ success: true, data: project });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/projects/:id', (req, res) => {
  try {
    const deleted = localStorage.deleteProject(req.params.id);
    if (!deleted) {
      return res.status(400).json({ success: false, error: '无法删除示例数据' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/validate', upload.fields([
  { name: 'sessions', maxCount: 1 },
  { name: 'setlist', maxCount: 1 },
  { name: 'takes', maxCount: 1 },
  { name: 'pitchBeat', maxCount: 1 }
]), async (req, res) => {
  try {
    const validator = new DataValidator();
    const parsePromises = [];
    const fileContents = {};

    const fileMap = {
      sessions: 'sessions',
      setlist: 'setlist',
      takes: 'takes',
      pitchBeat: 'pitchBeat'
    };

    Object.entries(fileMap).forEach(([param, key]) => {
      if (req.files && req.files[param] && req.files[param][0]) {
        const file = req.files[param][0];
        const content = file.buffer.toString('utf-8');
        
        if (file.originalname.endsWith('.json')) {
          try {
            fileContents[key] = JSON.parse(content);
          } catch (e) {
            return res.status(400).json({ 
              success: false, 
              error: `${param} JSON 解析失败: ${e.message}` 
            });
          }
        } else {
          parsePromises.push(
            new Promise((resolve) => {
              Papa.parse(content, {
                header: true,
                skipEmptyLines: true,
                dynamicTyping: true,
                complete: (results) => {
                  fileContents[key] = results.data;
                  resolve();
                }
              });
            })
          );
        }
      }
    });

    await Promise.all(parsePromises);

    const validationResult = validator.validateAll(
      fileContents.sessions,
      fileContents.setlist,
      fileContents.takes,
      fileContents.pitchBeat
    );

    res.json({
      success: true,
      data: {
        validation: validationResult,
        parsedData: fileContents
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/projects/:id/analysis', (req, res) => {
  try {
    const project = localStorage.loadProject(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, error: '项目不存在' });
    }

    const filters = {};
    if (req.query.sessionIds) {
      filters.sessionIds = req.query.sessionIds.split(',');
    }
    if (req.query.songIds) {
      filters.songIds = req.query.songIds.split(',');
    }
    if (req.query.sections) {
      filters.sections = req.query.sections.split(',');
    }
    if (req.query.musicians) {
      filters.musicians = req.query.musicians.split(',');
    }
    if (req.query.instruments) {
      filters.instruments = req.query.instruments.split(',');
    }
    if (req.query.errorTypes) {
      filters.errorTypes = req.query.errorTypes.split(',');
    }

    const analyzer = new DataAnalyzer(project.data);
    const annotations = localStorage.getFullAnnotations(req.params.id);

    const analysis = {
      summary: analyzer.getSummary(filters),
      sectionHeatmap: analyzer.getSectionHeatmap(filters),
      musicianRanking: analyzer.getMusicianRanking(filters),
      trendData: analyzer.getTrendData(filters),
      songAnalysis: analyzer.getSongAnalysis(filters),
      practiceList: analyzer.generatePracticeList(filters),
      availableFilters: analyzer.getAvailableFilters(),
      annotations
    };

    res.json({ success: true, data: analysis });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/projects/:id/compare', (req, res) => {
  try {
    const { session1, session2 } = req.query;
    
    if (!session1 || !session2) {
      return res.status(400).json({ 
        success: false, 
        error: '需要提供两个 session ID: session1 和 session2' 
      });
    }

    const project = localStorage.loadProject(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, error: '项目不存在' });
    }

    const analyzer = new DataAnalyzer(project.data);
    const comparison = analyzer.compareSessions(session1, session2);

    res.json({ success: true, data: comparison });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/projects/:id/filters', (req, res) => {
  try {
    const project = localStorage.loadProject(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, error: '项目不存在' });
    }

    const analyzer = new DataAnalyzer(project.data);
    const filters = analyzer.getAvailableFilters();

    res.json({ success: true, data: filters });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/projects/:id/annotations/marker', (req, res) => {
  try {
    const { itemId, markerType } = req.body;
    
    if (!itemId) {
      return res.status(400).json({ success: false, error: '缺少 itemId' });
    }

    if (markerType && markerType !== MARK_TYPES.NONE) {
      localStorage.setMarker(req.params.id, itemId, markerType);
    } else {
      localStorage.removeMarker(req.params.id, itemId);
    }

    const annotations = localStorage.getFullAnnotations(req.params.id);
    res.json({ success: true, data: annotations });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/projects/:id/annotations/note', (req, res) => {
  try {
    const { itemId, text } = req.body;
    
    if (!itemId) {
      return res.status(400).json({ success: false, error: '缺少 itemId' });
    }

    if (text && text.trim()) {
      localStorage.setNote(req.params.id, itemId, text.trim());
    } else {
      localStorage.removeNote(req.params.id, itemId);
    }

    const annotations = localStorage.getFullAnnotations(req.params.id);
    res.json({ success: true, data: annotations });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/projects/:id/annotations', (req, res) => {
  try {
    const annotations = localStorage.getFullAnnotations(req.params.id);
    res.json({ success: true, data: annotations });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/projects/:id/export/:format', (req, res) => {
  try {
    const { id, format } = req.params;
    const validFormats = ['json', 'csv', 'md', 'html'];
    
    if (!validFormats.includes(format)) {
      return res.status(400).json({ 
        success: false, 
        error: `不支持的格式: ${format}，支持: ${validFormats.join(', ')}` 
      });
    }

    const project = localStorage.loadProject(id);
    if (!project) {
      return res.status(404).json({ success: false, error: '项目不存在' });
    }

    const filters = {};
    if (req.query.sessionIds) {
      filters.sessionIds = req.query.sessionIds.split(',');
    }
    if (req.query.songIds) {
      filters.songIds = req.query.songIds.split(',');
    }
    if (req.query.sections) {
      filters.sections = req.query.sections.split(',');
    }
    if (req.query.musicians) {
      filters.musicians = req.query.musicians.split(',');
    }
    if (req.query.instruments) {
      filters.instruments = req.query.instruments.split(',');
    }
    if (req.query.errorTypes) {
      filters.errorTypes = req.query.errorTypes.split(',');
    }

    const annotations = localStorage.getFullAnnotations(id);
    const exporter = new ReportExporter(project, annotations);

    let content, contentType, filename;

    switch (format) {
      case 'json':
        content = exporter.exportJSON(filters);
        contentType = 'application/json';
        filename = `${project.name}_report.json`;
        break;
      case 'csv':
        content = exporter.exportCSV(filters);
        contentType = 'text/csv; charset=utf-8';
        filename = `${project.name}_report.csv`;
        break;
      case 'md':
        content = exporter.exportMarkdown(filters);
        contentType = 'text/markdown; charset=utf-8';
        filename = `${project.name}_report.md`;
        break;
      case 'html':
        content = exporter.exportHTML(filters);
        contentType = 'text/html; charset=utf-8';
        filename = `${project.name}_report.html`;
        break;
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send(content);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

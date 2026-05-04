const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');

const complianceService = require('./services/complianceService');
const storageService = require('./services/storageService');
const exportService = require('./services/exportService');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({ dest: 'uploads/' });

const DATA_DIR = path.join(__dirname, 'data');
fs.ensureDirSync(DATA_DIR);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/projects', async (req, res) => {
  try {
    const project = {
      id: uuidv4(),
      name: req.body.name || `项目_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      transcript: req.body.transcript || '',
      sponsorRequirements: req.body.sponsorRequirements || [],
      forbiddenTerms: req.body.forbiddenTerms || [],
      checks: [],
      reviews: []
    };
    
    await storageService.saveProject(project);
    res.json({ success: true, project });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/projects', async (req, res) => {
  try {
    const projects = await storageService.listProjects();
    res.json({ success: true, projects });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/projects/:id', async (req, res) => {
  try {
    const project = await storageService.getProject(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, error: '项目不存在' });
    }
    res.json({ success: true, project });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/projects/:id', async (req, res) => {
  try {
    const existingProject = await storageService.getProject(req.params.id);
    if (!existingProject) {
      return res.status(404).json({ success: false, error: '项目不存在' });
    }
    
    const updatedProject = {
      ...existingProject,
      ...req.body,
      updatedAt: new Date().toISOString()
    };
    
    await storageService.saveProject(updatedProject);
    res.json({ success: true, project: updatedProject });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/projects/:id/run-checks', async (req, res) => {
  try {
    const project = await storageService.getProject(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, error: '项目不存在' });
    }
    
    const checks = complianceService.runAllChecks(
      project.transcript,
      project.sponsorRequirements,
      project.forbiddenTerms
    );
    
    project.checks = checks;
    project.reviews = checks.map(check => ({
      checkId: check.id,
      status: 'pending',
      notes: '',
      updatedAt: new Date().toISOString()
    }));
    project.updatedAt = new Date().toISOString();
    
    await storageService.saveProject(project);
    res.json({ success: true, project });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/projects/:id/reviews', async (req, res) => {
  try {
    const project = await storageService.getProject(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, error: '项目不存在' });
    }
    
    const { checkId, status, notes } = req.body;
    
    const reviewIndex = project.reviews.findIndex(r => r.checkId === checkId);
    if (reviewIndex >= 0) {
      project.reviews[reviewIndex] = {
        ...project.reviews[reviewIndex],
        status,
        notes: notes || '',
        updatedAt: new Date().toISOString()
      };
    } else {
      project.reviews.push({
        checkId,
        status,
        notes: notes || '',
        updatedAt: new Date().toISOString()
      });
    }
    
    project.updatedAt = new Date().toISOString();
    await storageService.saveProject(project);
    
    const review = project.reviews.find(r => r.checkId === checkId);
    res.json({ success: true, review });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/projects/:id/export/markdown', async (req, res) => {
  try {
    const project = await storageService.getProject(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, error: '项目不存在' });
    }
    
    const markdown = exportService.exportToMarkdown(project);
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="${project.name}_report.md"`);
    res.send(markdown);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/projects/:id/export/csv', async (req, res) => {
  try {
    const project = await storageService.getProject(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, error: '项目不存在' });
    }
    
    const csv = exportService.exportToCSV(project);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${project.name}_issues.csv"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/projects/:id/export/json', async (req, res) => {
  try {
    const project = await storageService.getProject(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, error: '项目不存在' });
    }
    
    const json = exportService.exportToJSON(project);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${project.name}_audit.json"`);
    res.send(json);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/projects/:id', async (req, res) => {
  try {
    await storageService.deleteProject(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`口播合规检查助手已启动: http://localhost:${PORT}`);
});

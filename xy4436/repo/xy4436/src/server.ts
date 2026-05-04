import express from 'express';
import cors from 'cors';
import path from 'path';
import chalk from 'chalk';

import {
  projectModel,
  fixtureModel,
  cueModel,
  circuitModel,
  mediaFileModel,
  bannedDeviceModel,
  issueModel,
} from './db/models';

import { runAllValidations } from './validators';
import { exportMarkdown, exportJsonAudit } from './exporters';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/projects', (req, res) => {
  try {
    const projects = projectModel.getAll();
    const summaries = projects.map(p => {
      const summary = projectModel.getSummary(p.id);
      return {
        ...p,
        summary,
      };
    });
    res.json({ success: true, data: summaries });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/projects/:id', (req, res) => {
  try {
    const { id } = req.params;
    const project = projectModel.getById(id);
    
    if (!project) {
      return res.status(404).json({ success: false, error: '项目不存在' });
    }
    
    const fixtures = fixtureModel.getByProjectId(id);
    const cues = cueModel.getByProjectId(id);
    const circuits = circuitModel.getByProjectId(id);
    const mediaFiles = mediaFileModel.getByProjectId(id);
    const bannedDevices = bannedDeviceModel.getByProjectId(id);
    const issues = issueModel.getByProjectId(id);
    
    res.json({
      success: true,
      data: {
        project,
        fixtures,
        cues,
        circuits,
        mediaFiles,
        bannedDevices,
        issues,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/projects', (req, res) => {
  try {
    const { name, venue } = req.body;
    const project = projectModel.create(name || '新项目', venue || '');
    res.json({ success: true, data: project });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/projects/:id', (req, res) => {
  try {
    const { id } = req.params;
    const deleted = projectModel.delete(id);
    
    if (!deleted) {
      return res.status(404).json({ success: false, error: '项目不存在' });
    }
    
    res.json({ success: true, message: '项目已删除' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/projects/:id/summary', (req, res) => {
  try {
    const { id } = req.params;
    const summary = projectModel.getSummary(id);
    
    if (!summary) {
      return res.status(404).json({ success: false, error: '项目不存在' });
    }
    
    res.json({ success: true, data: summary });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/projects/:id/validate', (req, res) => {
  try {
    const { id } = req.params;
    const project = projectModel.getById(id);
    
    if (!project) {
      return res.status(404).json({ success: false, error: '项目不存在' });
    }
    
    const fixtures = fixtureModel.getByProjectId(id);
    const cues = cueModel.getByProjectId(id);
    const circuits = circuitModel.getByProjectId(id);
    const mediaFiles = mediaFileModel.getByProjectId(id);
    const bannedDevices = bannedDeviceModel.getByProjectId(id);
    
    const result = runAllValidations(
      id,
      fixtures,
      cues,
      circuits,
      mediaFiles,
      bannedDevices
    );
    
    issueModel.deleteByProjectId(id);
    for (const issueData of result.issues) {
      issueModel.create(issueData);
    }
    
    res.json({
      success: true,
      data: {
        summary: result.summary,
        issues: issueModel.getByProjectId(id),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/projects/:id/issues', (req, res) => {
  try {
    const { id } = req.params;
    const includeResolved = req.query.resolved === 'true';
    
    const issues = issueModel.getByProjectId(id, includeResolved);
    res.json({ success: true, data: issues });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.patch('/api/issues/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { resolved, resolutionNote } = req.body;
    
    const updates: { resolved?: boolean; resolutionNote?: string } = {};
    if (resolved !== undefined) updates.resolved = resolved;
    if (resolutionNote !== undefined) updates.resolutionNote = resolutionNote;
    
    const updated = issueModel.update(id, updates);
    
    if (!updated) {
      return res.status(404).json({ success: false, error: '问题不存在' });
    }
    
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/projects/:id/export/markdown', async (req, res) => {
  try {
    const { id } = req.params;
    const project = projectModel.getById(id);
    
    if (!project) {
      return res.status(404).json({ success: false, error: '项目不存在' });
    }
    
    const fixtures = fixtureModel.getByProjectId(id);
    const cues = cueModel.getByProjectId(id);
    const circuits = circuitModel.getByProjectId(id);
    const mediaFiles = mediaFileModel.getByProjectId(id);
    const bannedDevices = bannedDeviceModel.getByProjectId(id);
    const issues = issueModel.getByProjectId(id);
    
    const { generateMarkdownHandover } = await import('./exporters');
    const content = generateMarkdownHandover(
      project,
      fixtures,
      cues,
      circuits,
      mediaFiles,
      issues,
      bannedDevices
    );
    
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(project.name)}-交接单.md"`);
    res.send(content);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/projects/:id/export/json', async (req, res) => {
  try {
    const { id } = req.params;
    const project = projectModel.getById(id);
    
    if (!project) {
      return res.status(404).json({ success: false, error: '项目不存在' });
    }
    
    const fixtures = fixtureModel.getByProjectId(id);
    const cues = cueModel.getByProjectId(id);
    const circuits = circuitModel.getByProjectId(id);
    const mediaFiles = mediaFileModel.getByProjectId(id);
    const bannedDevices = bannedDeviceModel.getByProjectId(id);
    const issues = issueModel.getByProjectId(id);
    
    const { generateJsonAuditPackage } = await import('./exporters');
    const pkg = generateJsonAuditPackage(
      project,
      fixtures,
      cues,
      circuits,
      mediaFiles,
      bannedDevices,
      issues
    );
    
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(project.name)}-审计包.json"`);
    res.json(pkg);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(chalk.green.bold(`\n✅ 服务器已启动!`));
  console.log(chalk.cyan(`  本地访问: http://localhost:${PORT}`));
  console.log('');
});

process.on('SIGTERM', () => {
  console.log(chalk.yellow('\n服务器正在关闭...'));
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log(chalk.yellow('\n服务器正在关闭...'));
  process.exit(0);
});

export default app;

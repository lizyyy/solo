const express = require('express');
const router = express.Router();
const projectService = require('../services/project.service');
const lutService = require('../services/lut.service');
const exportService = require('../services/export.service');

router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: '项目名称不能为空' });
    }
    const project = await projectService.createProject(name, description);
    res.status(201).json(project);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const projects = await projectService.listProjects();
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const project = await projectService.getProject(req.params.id);
    if (!project) {
      return res.status(404).json({ error: '项目不存在' });
    }
    const stats = await projectService.getProjectStats(req.params.id);
    res.json({ ...project, stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/scenes', async (req, res) => {
  try {
    const { name, sceneCode, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: '场景名称不能为空' });
    }
    const scene = await projectService.createScene(req.params.id, name, sceneCode, description);
    res.status(201).json(scene);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:id/scenes', async (req, res) => {
  try {
    const scenes = await projectService.listScenes(req.params.id);
    res.json(scenes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/export', async (req, res) => {
  try {
    const { filePath, fileName } = await exportService.exportToCsv(req.params.id);
    res.download(filePath, fileName);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

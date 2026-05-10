const express = require('express');
const router = express.Router();
const projectService = require('../services/project-service');
const milestoneService = require('../services/milestone-service');
const reportService = require('../services/report-service');
const alertService = require('../services/alert-service');

router.get('/', async (req, res) => {
  try {
    const projects = await projectService.getAllProjects();
    res.json({ success: true, data: projects });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const project = await projectService.createProject(req.body);
    res.json({ success: true, data: project });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const project = await projectService.getProjectById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, error: '项目不存在' });
    }
    res.json({ success: true, data: project });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const project = await projectService.updateProject(req.params.id, req.body);
    res.json({ success: true, data: project });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await projectService.deleteProject(req.params.id);
    res.json({ success: true, message: '项目已删除' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/milestones', async (req, res) => {
  try {
    const milestones = await milestoneService.getMilestonesByProject(req.params.id);
    res.json({ success: true, data: milestones });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/milestones', async (req, res) => {
  try {
    const data = { ...req.body, project_id: parseInt(req.params.id) };
    const milestone = await milestoneService.createMilestone(data);
    res.json({ success: true, data: milestone });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id/progress', async (req, res) => {
  try {
    const report = await reportService.getProjectProgressReport(req.params.id);
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id/alerts', async (req, res) => {
  try {
    const alerts = await alertService.getProjectAlerts(req.params.id);
    res.json({ success: true, data: alerts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

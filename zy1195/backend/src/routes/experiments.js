const express = require('express');
const router = express.Router();
const { ExperimentManager } = require('../modules/experiment/manager');
const { ReportGenerator } = require('../modules/report/generator');

const experimentManager = new ExperimentManager();
const reportGenerator = new ReportGenerator();

router.post('/', async (req, res) => {
  try {
    const { name, protocol, ...config } = req.body;
    
    if (!protocol || !['TCP', 'UDP'].includes(protocol)) {
      return res.status(400).json({
        error: '协议类型必须是 TCP 或 UDP'
      });
    }

    const experiment = await experimentManager.createExperiment({
      name,
      protocol,
      ...config
    });

    res.status(201).json({
      success: true,
      data: experiment
    });
  } catch (err) {
    console.error('创建实验失败:', err);
    res.status(500).json({
      error: '创建实验失败',
      message: err.message
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const experiments = await experimentManager.getAllExperiments();
    res.json({
      success: true,
      data: experiments
    });
  } catch (err) {
    console.error('获取实验列表失败:', err);
    res.status(500).json({
      error: '获取实验列表失败',
      message: err.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const experiment = await experimentManager.getExperiment(req.params.id);
    if (!experiment) {
      return res.status(404).json({
        error: '实验不存在'
      });
    }
    res.json({
      success: true,
      data: experiment
    });
  } catch (err) {
    console.error('获取实验详情失败:', err);
    res.status(500).json({
      error: '获取实验详情失败',
      message: err.message
    });
  }
});

router.post('/:id/start', async (req, res) => {
  try {
    const experiment = await experimentManager.startExperiment(req.params.id);
    res.json({
      success: true,
      data: experiment,
      message: '实验已开始运行'
    });
  } catch (err) {
    console.error('启动实验失败:', err);
    res.status(500).json({
      error: '启动实验失败',
      message: err.message
    });
  }
});

router.get('/:id/events', async (req, res) => {
  try {
    const events = await experimentManager.getExperimentEvents(req.params.id);
    res.json({
      success: true,
      data: events
    });
  } catch (err) {
    console.error('获取事件列表失败:', err);
    res.status(500).json({
      error: '获取事件列表失败',
      message: err.message
    });
  }
});

router.get('/:id/packets', async (req, res) => {
  try {
    const packets = await experimentManager.getExperimentPackets(req.params.id);
    res.json({
      success: true,
      data: packets
    });
  } catch (err) {
    console.error('获取报文列表失败:', err);
    res.status(500).json({
      error: '获取报文列表失败',
      message: err.message
    });
  }
});

router.get('/:id/report', async (req, res) => {
  try {
    const format = req.query.format || 'markdown';
    const report = await reportGenerator.generateReport(req.params.id, format);
    
    if (format === 'json') {
      res.json({
        success: true,
        data: report
      });
    } else {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="report-${req.params.id}.md"`);
      res.send(report);
    }
  } catch (err) {
    console.error('生成报告失败:', err);
    res.status(500).json({
      error: '生成报告失败',
      message: err.message
    });
  }
});

router.get('/:id/report/download', async (req, res) => {
  try {
    const format = req.query.format || 'markdown';
    const report = await reportGenerator.generateReport(req.params.id, format);
    
    const experiment = await experimentManager.getExperiment(req.params.id);
    const filename = experiment 
      ? `${experiment.name.replace(/\s+/g, '-')}-${experiment.id.slice(0, 8)}`
      : `report-${req.params.id}`;

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
      res.send(JSON.stringify(report, null, 2));
    } else {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.md"`);
      res.send(report);
    }
  } catch (err) {
    console.error('下载报告失败:', err);
    res.status(500).json({
      error: '下载报告失败',
      message: err.message
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await experimentManager.deleteExperiment(req.params.id);
    res.json({
      success: true,
      message: '实验已删除'
    });
  } catch (err) {
    console.error('删除实验失败:', err);
    res.status(500).json({
      error: '删除实验失败',
      message: err.message
    });
  }
});

module.exports = router;

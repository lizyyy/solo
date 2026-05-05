const express = require('express');
const router = express.Router();
const ExperimentManager = require('../core/experimentManager');
const Database = require('../data/database');
const { validateExperimentConfig } = require('../utils/validator');
const { getSeedExperiments, getQuickStartConfigs, getLearningExamples } = require('../utils/seedData');

const experimentManager = new ExperimentManager();
let database = null;

async function getDatabase() {
  if (!database) {
    database = new Database();
    await database.init();
  }
  return database;
}

router.get('/', async (req, res) => {
  try {
    const db = await getDatabase();
    const experiments = db.getAllExperiments();
    
    res.json({
      success: true,
      data: experiments.map(exp => ({
        id: exp.id,
        name: exp.config.name,
        description: exp.config.description,
        status: exp.status,
        createdAt: exp.createdAt,
        completedAt: exp.completedAt,
        config: {
          connections: exp.config.connections,
          readEvents: exp.config.readEvents,
          writeEvents: exp.config.writeEvents,
          failureRate: exp.config.failureRate
        }
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '获取实验列表失败',
      details: error.message
    });
  }
});

router.get('/seeds', (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        seedExperiments: getSeedExperiments(),
        quickStartConfigs: getQuickStartConfigs(),
        learningExamples: getLearningExamples()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '获取种子数据失败',
      details: error.message
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const validation = validateExperimentConfig(req.body);
    
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: '参数验证失败',
        errors: validation.errors,
        hints: validation.hints
      });
    }

    const experiment = experimentManager.createExperiment(validation.value);
    
    const db = await getDatabase();
    db.saveExperiment(experiment);

    res.status(201).json({
      success: true,
      data: {
        id: experiment.id,
        status: experiment.status,
        message: '实验创建成功，可以开始运行'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '创建实验失败',
      details: error.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDatabase();
    const experiment = db.getExperiment(id);
    
    if (!experiment) {
      return res.status(404).json({
        success: false,
        error: '实验不存在'
      });
    }

    const timeline = db.getTimeline(id);

    res.json({
      success: true,
      data: {
        ...experiment,
        timeline: timeline.slice(0, 500)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '获取实验详情失败',
      details: error.message
    });
  }
});

router.post('/:id/run', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDatabase();
    
    let experiment = db.getExperiment(id);
    if (!experiment) {
      return res.status(404).json({
        success: false,
        error: '实验不存在'
      });
    }

    experimentManager.experiments.set(experiment.id, experiment);

    res.json({
      success: true,
      message: '实验开始运行，这可能需要一些时间...',
      status: 'running'
    });

    setImmediate(async () => {
      try {
        const result = await experimentManager.runExperiment(id);
        db.saveExperiment(result);
        console.log(`实验 ${id} 运行完成`);
      } catch (error) {
        console.error(`实验 ${id} 运行失败:`, error);
        const exp = db.getExperiment(id);
        if (exp) {
          exp.status = 'failed';
          exp.error = error.message;
          db.saveExperiment(exp);
        }
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: '启动实验失败',
      details: error.message
    });
  }
});

router.get('/:id/timeline', async (req, res) => {
  try {
    const { id } = req.params;
    const { model, limit = 500 } = req.query;
    const db = await getDatabase();

    const experiment = db.getExperiment(id);
    if (!experiment) {
      return res.status(404).json({
        success: false,
        error: '实验不存在'
      });
    }

    const timeline = db.getTimeline(id, model);

    res.json({
      success: true,
      data: {
        experimentId: id,
        model: model || 'all',
        total: timeline.length,
        events: timeline.slice(0, parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '获取时间线失败',
      details: error.message
    });
  }
});

router.get('/:id/export/json', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDatabase();
    
    const experiment = db.getExperiment(id);
    if (!experiment) {
      return res.status(404).json({
        success: false,
        error: '实验不存在'
      });
    }

    const timeline = db.getTimeline(id);
    const fullData = {
      ...experiment,
      timeline
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=experiment-${id}.json`);
    res.send(JSON.stringify(fullData, null, 2));
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '导出 JSON 失败',
      details: error.message
    });
  }
});

router.get('/:id/export/markdown', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDatabase();
    
    const experiment = db.getExperiment(id);
    if (!experiment) {
      return res.status(404).json({
        success: false,
        error: '实验不存在'
      });
    }

    experimentManager.experiments.set(experiment.id, experiment);
    const markdown = experimentManager.exportToMarkdown(id);

    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename=experiment-${id}.md`);
    res.send(markdown);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '导出 Markdown 失败',
      details: error.message
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDatabase();
    
    const experiment = db.getExperiment(id);
    if (!experiment) {
      return res.status(404).json({
        success: false,
        error: '实验不存在'
      });
    }

    const deleted = db.deleteExperiment(id);
    experimentManager.experiments.delete(id);

    res.json({
      success: deleted,
      message: deleted ? '实验已删除' : '删除失败'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '删除实验失败',
      details: error.message
    });
  }
});

router.post('/validate', (req, res) => {
  try {
    const validation = validateExperimentConfig(req.body);
    
    res.json({
      success: validation.valid,
      valid: validation.valid,
      errors: validation.errors,
      hints: validation.hints,
      sanitizedValue: validation.valid ? validation.value : null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '验证失败',
      details: error.message
    });
  }
});

module.exports = router;

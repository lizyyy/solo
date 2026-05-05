const express = require('express');
const router = express.Router();

const { IOModelSimulator, IO_TYPES } = require('./models/io-models');
const experimentManager = require('./models/experiment-manager');

router.get('/models', (req, res) => {
  const models = [
    { type: IO_TYPES.BLOCKING, name: '阻塞 I/O', description: '每个连接一个线程，阻塞等待数据' },
    { type: IO_TYPES.NON_BLOCKING, name: '非阻塞 I/O', description: '单线程轮询，非阻塞检查' },
    { type: IO_TYPES.MULTIPLEXING, name: 'I/O 多路复用', description: 'epoll/select，批量等待' },
    { type: IO_TYPES.ASYNC, name: '异步 I/O', description: '内核异步处理，完成后通知' }
  ];
  res.json(models);
});

router.post('/run-single', async (req, res) => {
  try {
    const { modelType, config } = req.body;
    
    if (!modelType || !Object.values(IO_TYPES).includes(modelType)) {
      return res.status(400).json({ error: '无效的 I/O 模型类型' });
    }

    const simulator = new IOModelSimulator(modelType, {
      connectionCount: config.connectionCount || 10,
      bufferSize: config.bufferSize || 1024,
      dataArrivalTime: config.dataArrivalTime || 100,
      dataArrivalJitter: config.dataArrivalJitter || 20,
      processingTime: config.processingTime || 50,
      processingJitter: config.processingJitter || 10,
      timeout: config.timeout || 5000
    });

    const result = await simulator.run();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/experiments', (req, res) => {
  try {
    const config = req.body;
    const experiment = experimentManager.createExperiment(config);
    res.json(experiment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/experiments', (req, res) => {
  try {
    const experiments = experimentManager.getAllExperiments();
    res.json(experiments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/experiments/:id', (req, res) => {
  try {
    const experiment = experimentManager.getExperiment(req.params.id);
    if (!experiment) {
      return res.status(404).json({ error: '实验不存在' });
    }
    res.json(experiment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/experiments/:id', (req, res) => {
  try {
    const success = experimentManager.deleteExperiment(req.params.id);
    if (!success) {
      return res.status(404).json({ error: '实验不存在' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/experiments/:id/run', async (req, res) => {
  try {
    const experiment = experimentManager.getExperiment(req.params.id);
    if (!experiment) {
      return res.status(404).json({ error: '实验不存在' });
    }

    experimentManager.updateExperimentStatus(experiment.id, 'running', {
      startedAt: Date.now()
    });

    const modelsToRun = experiment.config.models;
    
    for (const modelType of modelsToRun) {
      const simulator = new IOModelSimulator(modelType, experiment.config);
      const result = await simulator.run();
      experimentManager.addModelResult(experiment.id, modelType, result);
    }

    experimentManager.updateExperimentStatus(experiment.id, 'completed', {
      completedAt: Date.now()
    });

    const updatedExperiment = experimentManager.getExperiment(experiment.id);
    experimentManager.saveExperiment(updatedExperiment);

    res.json(updatedExperiment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/experiments/:id/comparison', (req, res) => {
  try {
    const experiment = experimentManager.getExperiment(req.params.id);
    if (!experiment) {
      return res.status(404).json({ error: '实验不存在' });
    }

    const comparison = experimentManager.generateComparison(experiment);
    res.json(comparison);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/experiments/:id/export/markdown', (req, res) => {
  try {
    const experiment = experimentManager.getExperiment(req.params.id);
    if (!experiment) {
      return res.status(404).json({ error: '实验不存在' });
    }

    const markdown = experimentManager.exportToMarkdown(experiment);
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="${experiment.name}.md"`);
    res.send(markdown);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/experiments/:id/export/json', (req, res) => {
  try {
    const experiment = experimentManager.getExperiment(req.params.id);
    if (!experiment) {
      return res.status(404).json({ error: '实验不存在' });
    }

    const json = experimentManager.exportToJSON(experiment);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${experiment.name}.json"`);
    res.send(json);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/seed/default', (req, res) => {
  const defaultSeed = {
    name: '默认对比实验',
    description: '展示四种 I/O 模型在相同配置下的性能对比',
    config: {
      connectionCount: 20,
      bufferSize: 4096,
      dataArrivalTime: 200,
      dataArrivalJitter: 50,
      processingTime: 100,
      processingJitter: 20,
      timeout: 10000,
      models: ['blocking', 'non_blocking', 'multiplexing', 'async']
    }
  };
  res.json(defaultSeed);
});

router.get('/seed/bad-examples', (req, res) => {
  const badExamples = [
    {
      name: '坏样例 1: 非阻塞 I/O + 大量连接',
      description: '展示非阻塞 I/O 在大量连接时的 CPU 空转问题',
      config: {
        connectionCount: 100,
        bufferSize: 1024,
        dataArrivalTime: 500,
        dataArrivalJitter: 100,
        processingTime: 20,
        processingJitter: 5,
        timeout: 10000,
        models: ['non_blocking', 'multiplexing']
      },
      expectedProblem: '非阻塞 I/O 会产生大量空轮询，CPU 空转次数会远高于多路复用'
    },
    {
      name: '坏样例 2: 阻塞 I/O + 大量连接',
      description: '展示阻塞 I/O 在大量连接时的线程开销',
      config: {
        connectionCount: 50,
        bufferSize: 2048,
        dataArrivalTime: 300,
        dataArrivalJitter: 50,
        processingTime: 50,
        processingJitter: 10,
        timeout: 10000,
        models: ['blocking', 'multiplexing', 'async']
      },
      expectedProblem: '阻塞 I/O 需要为每个连接创建一个线程，线程数量会远高于其他模型'
    }
  ];
  res.json(badExamples);
});

module.exports = router;

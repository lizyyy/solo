const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const { stringifyJSON } = require('./utils');
const { loadDatabase } = require('./database');

let taskService = null;
let businessData = null;
let seed = null;

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const startServer = async () => {
  await loadDatabase();
  
  taskService = require('./services/taskService');
  businessData = require('./businessData');
  seed = require('./seed');

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.post('/api/seed', (req, res) => {
    try {
      seed();
      res.json({ success: true, message: 'Seed data initialized' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/statistics', (req, res) => {
    try {
      const stats = taskService.getStatistics();
      res.json(stats);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/tasks', (req, res) => {
    try {
      const task = taskService.createTask(req.body);
      res.json(task);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/tasks', (req, res) => {
    try {
      const { status, taskType, businessNo, limit } = req.query;
      const tasks = taskService.getTasks({ status, taskType, businessNo, limit: limit ? parseInt(limit) : undefined });
      res.json(tasks);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/tasks/:id', (req, res) => {
    try {
      const task = taskService.getTask(req.params.id);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      res.json(task);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/tasks/:id/fail', (req, res) => {
    try {
      const { errorMessage } = req.body;
      const error = new Error(errorMessage || 'Simulated task failure');
      if (req.body.stack) {
        error.stack = req.body.stack;
      }
      const deadLetter = taskService.moveToDeadLetter(req.params.id, error);
      res.json(deadLetter);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/tasks/:id/payload', (req, res) => {
    try {
      const { payload, operator, reason } = req.body;
      const result = taskService.modifyPayload(
        req.params.id,
        payload,
        operator || 'admin',
        reason || ''
      );
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/tasks/:id/modifications', (req, res) => {
    try {
      const modifications = taskService.getModificationHistory(req.params.id);
      res.json(modifications);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/tasks/:id/snapshots', (req, res) => {
    try {
      const snapshots = taskService.getBusinessSnapshots(req.params.id);
      res.json(snapshots);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/dead-letters', (req, res) => {
    try {
      const { status, taskType, needManual } = req.query;
      const deadLetters = taskService.getDeadLetters({
        status,
        taskType,
        needManual: needManual === 'true'
      });
      res.json(deadLetters);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/dead-letters/:id', (req, res) => {
    try {
      const deadLetter = taskService.getDeadLetter(req.params.id);
      if (!deadLetter) {
        return res.status(404).json({ error: 'Dead letter not found' });
      }
      res.json(deadLetter);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/dead-letters/:id/replay-history', (req, res) => {
    try {
      const history = taskService.getReplayHistory(req.params.id);
      res.json(history);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/dead-letters/:id/replay', (req, res) => {
    try {
      const { operator } = req.body;
      const result = taskService.replayDeadLetter(
        req.params.id,
        operator || 'admin'
      );
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/dead-letters/:id/close', (req, res) => {
    try {
      const { reason, operator } = req.body;
      const result = taskService.closeDeadLetter(
        req.params.id,
        reason || '',
        operator || 'admin'
      );
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/export/:type', (req, res) => {
    try {
      const { status, taskType } = req.query;
      const data = taskService.exportData(req.params.type, { status, taskType });
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${req.params.type}_export_${Date.now()}.json"`);
      res.send(stringifyJSON(data));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/business/invoices', (req, res) => {
    try {
      res.json(businessData.getAllInvoices());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/business/sms', (req, res) => {
    try {
      res.json(businessData.getAllSms());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/business/inventory', (req, res) => {
    try {
      res.json(businessData.getAllInventory());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/business/inventory/:productId/logs', (req, res) => {
    try {
      res.json(businessData.getInventoryLogs(req.params.productId));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  const existingTasks = taskService.getTasks();
  if (existingTasks.length === 0) {
    console.log('Initializing seed data...');
    seed();
  }

  app.listen(PORT, () => {
    console.log(`Dead Letter Compensation Backend running on port ${PORT}`);
    console.log(`API available at http://localhost:${PORT}/api`);
  });
};

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

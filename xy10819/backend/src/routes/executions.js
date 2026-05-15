const express = require('express');
const router = express.Router();
const { executeCollection, retryStep, getExecutionStatus } = require('../services/execution-engine');
const db = require('../config/database');

router.post('/collection/:collectionId', async (req, res) => {
  try {
    const { collectionId } = req.params;
    
    const { v4: uuidv4 } = require('uuid');
    const batchId = uuidv4();
    
    const steps = await db.all('SELECT COUNT(*) as count FROM steps WHERE collection_id = ?', [collectionId]);
    
    await db.run(
      `INSERT INTO batches (id, collection_id, status, total_steps, started_at) 
       VALUES (?, ?, 'running', ?, CURRENT_TIMESTAMP)`,
      [batchId, collectionId, steps[0].count]
    );

    res.status(202).json({ batchId, message: 'Execution started' });

    setImmediate(async () => {
      try {
        await executeCollection(collectionId, batchId);
      } catch (err) {
        console.error('Execution failed:', err);
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/status/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;
    const status = getExecutionStatus(batchId);
    
    const batch = await db.get('SELECT * FROM batches WHERE id = ?', [batchId]);
    
    res.json({
      batch,
      inProgress: status !== null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/retry/:resultId', async (req, res) => {
  try {
    const { resultId } = req.params;
    const result = await retryStep(resultId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

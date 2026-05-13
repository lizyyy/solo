const express = require('express');
const router = express.Router();
const SampleSet = require('../models/SampleSet');
const SandboxRun = require('../models/SandboxRun');

router.post('/', async (req, res) => {
  try {
    const { setId, name, description, samples, createdBy } = req.body;

    if (!setId || !name || !samples || !createdBy) {
      return res.status(400).json({
        error: 'Missing required fields: setId, name, samples, createdBy'
      });
    }

    if (!Array.isArray(samples) || samples.length === 0) {
      return res.status(400).json({
        error: 'Samples must be a non-empty array'
      });
    }

    const existingSet = await SampleSet.findOne({ setId });
    if (existingSet) {
      return res.status(409).json({
        error: `Sample set ${setId} already exists`
      });
    }

    const sampleIds = new Set();
    for (const sample of samples) {
      if (!sample.sampleId || !sample.userId || !sample.orderDate) {
        return res.status(400).json({
          error: 'Each sample must have sampleId, userId, and orderDate'
        });
      }
      
      if (sampleIds.has(sample.sampleId)) {
        return res.status(400).json({
          error: `Duplicate sampleId: ${sample.sampleId}`
        });
      }
      sampleIds.add(sample.sampleId);
    }

    const sampleSet = new SampleSet({
      setId,
      name,
      description,
      samples,
      sampleCount: samples.length,
      createdBy
    });

    await sampleSet.save();
    res.status(201).json(sampleSet);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const sampleSets = await SampleSet.find().sort({ createdAt: -1 });
    res.json(sampleSets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:setId', async (req, res) => {
  try {
    const sampleSet = await SampleSet.findOne({ setId: req.params.setId });
    if (!sampleSet) {
      return res.status(404).json({ error: `Sample set ${req.params.setId} not found` });
    }
    res.json(sampleSet);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:setId', async (req, res) => {
  try {
    const { setId } = req.params;
    const updates = req.body;

    const sampleSet = await SampleSet.findOne({ setId });
    if (!sampleSet) {
      return res.status(404).json({ error: `Sample set ${setId} not found` });
    }

    const sandboxExists = await SandboxRun.findOne({ sampleSetId: setId });
    if (sandboxExists) {
      return res.status(409).json({
        error: `Cannot modify sample set ${setId} because it is referenced by sandbox runs`,
        sandboxRunId: sandboxExists.runId
      });
    }

    if (updates.samples) {
      if (!Array.isArray(updates.samples) || updates.samples.length === 0) {
        return res.status(400).json({
          error: 'Samples must be a non-empty array'
        });
      }

      const sampleIds = new Set();
      for (const sample of updates.samples) {
        if (!sample.sampleId || !sample.userId || !sample.orderDate) {
          return res.status(400).json({
            error: 'Each sample must have sampleId, userId, and orderDate'
          });
        }
        
        if (sampleIds.has(sample.sampleId)) {
          return res.status(400).json({
            error: `Duplicate sampleId: ${sample.sampleId}`
          });
        }
        sampleIds.add(sample.sampleId);
      }

      updates.sampleCount = updates.samples.length;
    }

    Object.assign(sampleSet, updates);
    await sampleSet.save();
    res.json(sampleSet);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:setId', async (req, res) => {
  try {
    const { setId } = req.params;

    const sampleSet = await SampleSet.findOne({ setId });
    if (!sampleSet) {
      return res.status(404).json({ error: `Sample set ${setId} not found` });
    }

    const sandboxExists = await SandboxRun.findOne({ sampleSetId: setId });
    if (sandboxExists) {
      return res.status(409).json({
        error: `Cannot delete sample set ${setId} because it is referenced by sandbox runs`,
        sandboxRunId: sandboxExists.runId
      });
    }

    await SampleSet.deleteOne({ setId });
    res.json({ message: `Sample set ${setId} deleted successfully` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:setId/append', async (req, res) => {
  try {
    const { setId } = req.params;
    const { samples } = req.body;

    const sampleSet = await SampleSet.findOne({ setId });
    if (!sampleSet) {
      return res.status(404).json({ error: `Sample set ${setId} not found` });
    }

    const sandboxExists = await SandboxRun.findOne({ sampleSetId: setId });
    if (sandboxExists) {
      return res.status(409).json({
        error: `Cannot append to sample set ${setId} because it is referenced by sandbox runs`,
        sandboxRunId: sandboxExists.runId
      });
    }

    if (!Array.isArray(samples) || samples.length === 0) {
      return res.status(400).json({
        error: 'Samples must be a non-empty array'
      });
    }

    const existingSampleIds = new Set(sampleSet.samples.map(s => s.sampleId));
    for (const sample of samples) {
      if (!sample.sampleId || !sample.userId || !sample.orderDate) {
        return res.status(400).json({
          error: 'Each sample must have sampleId, userId, and orderDate'
        });
      }
      
      if (existingSampleIds.has(sample.sampleId)) {
        return res.status(409).json({
          error: `Sample with sampleId ${sample.sampleId} already exists in the set`
        });
      }
    }

    sampleSet.samples.push(...samples);
    sampleSet.sampleCount = sampleSet.samples.length;
    await sampleSet.save();
    res.json(sampleSet);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

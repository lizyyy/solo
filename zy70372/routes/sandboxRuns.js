const express = require('express');
const router = express.Router();
const SandboxRun = require('../models/SandboxRun');
const RuleVersion = require('../models/RuleVersion');
const SampleSet = require('../models/SampleSet');
const sandboxService = require('../services/sandboxService');

const crypto = require('crypto');

function generateId() {
  return 'run_' + crypto.randomBytes(8).toString('hex');
}

router.post('/', async (req, res) => {
  try {
    const { 
      name, 
      description, 
      oldRuleVersion, 
      newRuleVersion, 
      sampleSetId, 
      createdBy 
    } = req.body;

    if (!name || !oldRuleVersion || !newRuleVersion || !sampleSetId || !createdBy) {
      return res.status(400).json({
        error: 'Missing required fields: name, oldRuleVersion, newRuleVersion, sampleSetId, createdBy'
      });
    }

    if (oldRuleVersion === newRuleVersion) {
      return res.status(400).json({
        error: 'Old rule version and new rule version must be different'
      });
    }

    const [oldVersion, newVersion, sampleSet] = await Promise.all([
      RuleVersion.findOne({ version: oldRuleVersion }),
      RuleVersion.findOne({ version: newRuleVersion }),
      SampleSet.findOne({ setId: sampleSetId })
    ]);

    if (!oldVersion) {
      return res.status(404).json({ error: `Old rule version ${oldRuleVersion} not found` });
    }
    if (!newVersion) {
      return res.status(404).json({ error: `New rule version ${newRuleVersion} not found` });
    }
    if (!sampleSet) {
      return res.status(404).json({ error: `Sample set ${sampleSetId} not found` });
    }
    if (sampleSet.samples.length === 0) {
      return res.status(400).json({ error: `Sample set ${sampleSetId} is empty` });
    }

    const runId = generateId();
    const sandboxRun = new SandboxRun({
      runId,
      name,
      description,
      oldRuleVersion,
      newRuleVersion,
      sampleSetId,
      createdBy,
      status: 'pending'
    });

    await sandboxRun.save();

    res.status(201).json({
      runId,
      status: 'pending',
      message: 'Sandbox run created. Use POST /api/sandbox-runs/:runId/start to begin execution.'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:runId/start', async (req, res) => {
  try {
    const { runId } = req.params;
    const sandboxRun = await SandboxRun.findOne({ runId });

    if (!sandboxRun) {
      return res.status(404).json({ error: `Sandbox run ${runId} not found` });
    }

    if (sandboxRun.status === 'running') {
      return res.status(409).json({
        error: `Sandbox run ${runId} is already running`,
        startedAt: sandboxRun.startTime
      });
    }

    if (sandboxRun.status === 'completed') {
      return res.status(409).json({
        error: `Sandbox run ${runId} has already completed`,
        completedAt: sandboxRun.endTime
      });
    }

    if (sandboxRun.status === 'failed') {
      return res.status(409).json({
        error: `Sandbox run ${runId} has failed`,
        errorMessage: sandboxRun.errorMessage
      });
    }

    const [oldVersion, newVersion] = await Promise.all([
      RuleVersion.findOne({ version: sandboxRun.oldRuleVersion }),
      RuleVersion.findOne({ version: sandboxRun.newRuleVersion })
    ]);

    if (oldVersion) {
      oldVersion.isLocked = true;
      await oldVersion.save();
    }
    if (newVersion) {
      newVersion.isLocked = true;
      await newVersion.save();
    }

    sandboxService.runSandbox(runId, sandboxRun.oldRuleVersion, sandboxRun.newRuleVersion, sandboxRun.sampleSetId)
      .then(async () => {
        if (oldVersion) {
          oldVersion.isLocked = false;
          await oldVersion.save();
        }
        if (newVersion) {
          newVersion.isLocked = false;
          await newVersion.save();
        }
      })
      .catch(async (error) => {
        if (oldVersion) {
          oldVersion.isLocked = false;
          await oldVersion.save();
        }
        if (newVersion) {
          newVersion.isLocked = false;
          await newVersion.save();
        }
        console.error(`Sandbox run ${runId} failed:`, error);
      });

    res.json({
      runId,
      status: 'running',
      message: 'Sandbox execution started. Check status with GET /api/sandbox-runs/:runId'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const sandboxRuns = await SandboxRun.find().sort({ createdAt: -1 });
    res.json(sandboxRuns);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:runId', async (req, res) => {
  try {
    const { runId } = req.params;
    const sandboxRun = await SandboxRun.findOne({ runId });

    if (!sandboxRun) {
      return res.status(404).json({ error: `Sandbox run ${runId} not found` });
    }

    res.json(sandboxRun);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:runId/results', async (req, res) => {
  try {
    const { runId } = req.params;
    const sandboxRun = await SandboxRun.findOne({ runId });

    if (!sandboxRun) {
      return res.status(404).json({ error: `Sandbox run ${runId} not found` });
    }

    if (sandboxRun.status !== 'completed') {
      return res.status(400).json({
        error: `Sandbox run ${runId} is not completed yet`,
        status: sandboxRun.status
      });
    }

    res.json({
      runId: sandboxRun.runId,
      name: sandboxRun.name,
      oldRuleVersion: sandboxRun.oldRuleVersion,
      newRuleVersion: sandboxRun.newRuleVersion,
      sampleSetId: sandboxRun.sampleSetId,
      results: sandboxRun.results,
      businessImpact: sandboxRun.businessImpact,
      recommendation: sandboxRun.recommendation,
      affectedSamples: sandboxRun.sampleResults
        .filter(sr => (
          sr.oldResult.blocked !== sr.newResult.blocked ||
          sr.oldResult.discountApplied !== sr.newResult.discountApplied ||
          JSON.stringify(sr.oldResult.membershipBenefits) !== JSON.stringify(sr.newResult.membershipBenefits) ||
          sr.isConflicting
        ))
        .map(sr => ({
          sampleId: sr.sampleId,
          userId: sr.userId,
          userSegment: sr.userSegment,
          isConflicting: sr.isConflicting,
          conflictReason: sr.conflictReason,
          oldBlocked: sr.oldResult.blocked,
          newBlocked: sr.newResult.blocked,
          oldDiscount: sr.oldResult.discountApplied,
          newDiscount: sr.newResult.discountApplied,
          oldHitRules: sr.oldResult.hitRules,
          newHitRules: sr.newResult.hitRules
        }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:runId/export', async (req, res) => {
  try {
    const { runId } = req.params;
    const { format = 'json' } = req.query;

    const report = await sandboxService.exportReport(runId, format);

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=report-${runId}.json`);
      res.send(report);
    } else if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=report-${runId}.csv`);
      res.send(report);
    } else {
      res.status(400).json({ error: `Unsupported format: ${format}` });
    }
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes('not completed')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:runId', async (req, res) => {
  try {
    const { runId } = req.params;
    const sandboxRun = await SandboxRun.findOne({ runId });

    if (!sandboxRun) {
      return res.status(404).json({ error: `Sandbox run ${runId} not found` });
    }

    if (sandboxRun.status === 'running') {
      return res.status(409).json({
        error: `Cannot delete sandbox run ${runId} while it is running`
      });
    }

    await SandboxRun.deleteOne({ runId });
    res.json({ message: `Sandbox run ${runId} deleted successfully` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

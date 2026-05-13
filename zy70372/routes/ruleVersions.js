const express = require('express');
const router = express.Router();
const RuleVersion = require('../models/RuleVersion');
const SandboxRun = require('../models/SandboxRun');

router.post('/', async (req, res) => {
  try {
    const { version, description, rules, createdBy } = req.body;

    if (!version || !rules || !createdBy) {
      return res.status(400).json({
        error: 'Missing required fields: version, rules, createdBy'
      });
    }

    const existingVersion = await RuleVersion.findOne({ version });
    if (existingVersion) {
      return res.status(409).json({
        error: `Rule version ${version} already exists`,
        existingVersion: existingVersion
      });
    }

    for (const rule of rules) {
      if (!rule.ruleId || !rule.ruleType || !rule.ruleName) {
        return res.status(400).json({
          error: 'Each rule must have ruleId, ruleType, and ruleName'
        });
      }

      const validTypes = ['discount_threshold', 'purchase_limit', 'risk_control', 'membership_benefit'];
      if (!validTypes.includes(rule.ruleType)) {
        return res.status(400).json({
          error: `Invalid rule type: ${rule.ruleType}. Must be one of: ${validTypes.join(', ')}`
        });
      }
    }

    const ruleVersion = new RuleVersion({
      version,
      description,
      rules,
      createdBy
    });

    await ruleVersion.save();
    res.status(201).json(ruleVersion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const versions = await RuleVersion.find().sort({ createdAt: -1 });
    res.json(versions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:version', async (req, res) => {
  try {
    const ruleVersion = await RuleVersion.findOne({ version: req.params.version });
    if (!ruleVersion) {
      return res.status(404).json({ error: `Rule version ${req.params.version} not found` });
    }
    res.json(ruleVersion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:version', async (req, res) => {
  try {
    const { version } = req.params;
    const updates = req.body;

    const ruleVersion = await RuleVersion.findOne({ version });
    if (!ruleVersion) {
      return res.status(404).json({ error: `Rule version ${version} not found` });
    }

    if (ruleVersion.isLocked) {
      return res.status(403).json({
        error: `Rule version ${version} is locked and cannot be modified. It may be in use by a running sandbox.`
      });
    }

    const runningSandbox = await SandboxRun.findOne({
      $or: [{ oldRuleVersion: version }, { newRuleVersion: version }],
      status: { $in: ['pending', 'running'] }
    });

    if (runningSandbox) {
      return res.status(403).json({
        error: `Cannot modify rule version ${version} while sandbox ${runningSandbox.runId} is running`,
        sandboxRunId: runningSandbox.runId
      });
    }

    if (updates.rules) {
      for (const rule of updates.rules) {
        if (!rule.ruleId || !rule.ruleType || !rule.ruleName) {
          return res.status(400).json({
            error: 'Each rule must have ruleId, ruleType, and ruleName'
          });
        }
      }
    }

    Object.assign(ruleVersion, updates);
    await ruleVersion.save();
    res.json(ruleVersion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:version', async (req, res) => {
  try {
    const { version } = req.params;

    const ruleVersion = await RuleVersion.findOne({ version });
    if (!ruleVersion) {
      return res.status(404).json({ error: `Rule version ${version} not found` });
    }

    if (ruleVersion.isLocked) {
      return res.status(403).json({
        error: `Rule version ${version} is locked and cannot be deleted`
      });
    }

    const sandboxExists = await SandboxRun.findOne({
      $or: [{ oldRuleVersion: version }, { newRuleVersion: version }]
    });

    if (sandboxExists) {
      return res.status(409).json({
        error: `Cannot delete rule version ${version} because it is referenced by sandbox runs`,
        sandboxRunId: sandboxExists.runId
      });
    }

    await RuleVersion.deleteOne({ version });
    res.json({ message: `Rule version ${version} deleted successfully` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:version/lock', async (req, res) => {
  try {
    const { version } = req.params;
    const ruleVersion = await RuleVersion.findOne({ version });

    if (!ruleVersion) {
      return res.status(404).json({ error: `Rule version ${version} not found` });
    }

    ruleVersion.isLocked = true;
    await ruleVersion.save();
    res.json(ruleVersion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:version/unlock', async (req, res) => {
  try {
    const { version } = req.params;
    const ruleVersion = await RuleVersion.findOne({ version });

    if (!ruleVersion) {
      return res.status(404).json({ error: `Rule version ${version} not found` });
    }

    ruleVersion.isLocked = false;
    await ruleVersion.save();
    res.json(ruleVersion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

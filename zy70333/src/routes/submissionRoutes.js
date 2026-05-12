const express = require('express');
const router = express.Router();
const submissionService = require('../services/submissionService');

router.post('/:formId/submit', async (req, res) => {
  try {
    const result = await submissionService.submitData(
      req.params.formId,
      req.body
    );
    
    if (!result.isValid) {
      return res.status(400).json({
        message: 'Validation failed',
        ...result
      });
    }

    if (result.isNew) {
      res.status(201).json(result);
    } else {
      res.json({
        message: 'Submission updated (idempotent)',
        ...result
      });
    }
  } catch (error) {
    if (error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(400).json({ error: error.message });
    }
  }
});

router.get('/:submissionId', async (req, res) => {
  try {
    const submission = await submissionService.getSubmission(req.params.submissionId);
    res.json(submission);
  } catch (error) {
    if (error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

router.get('/:submissionId/context', async (req, res) => {
  try {
    const context = await submissionService.getSubmissionWithVersionContext(
      req.params.submissionId
    );
    res.json(context);
  } catch (error) {
    if (error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

router.get('/form/:formId', async (req, res) => {
  try {
    const submissions = await submissionService.getFormSubmissions(
      req.params.formId,
      {
        version: req.query.version,
        sortBy: req.query.sortBy,
        sortDir: req.query.sortDir
      }
    );
    res.json(submissions);
  } catch (error) {
    if (error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

module.exports = router;
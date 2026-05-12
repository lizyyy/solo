const express = require('express');
const router = express.Router();
const formService = require('../services/formService');

router.post('/', async (req, res) => {
  try {
    const form = await formService.createForm(req.body);
    res.status(201).json(form);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const forms = await formService.getAllForms();
    res.json(forms);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:formId', async (req, res) => {
  try {
    const form = await formService.getForm(req.params.formId);
    res.json(form);
  } catch (error) {
    if (error.message.includes('Form not found')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

router.get('/:formId/versions/:version', async (req, res) => {
  try {
    const version = await formService.getFormVersion(
      req.params.formId, 
      parseInt(req.params.version)
    );
    res.json(version);
  } catch (error) {
    if (error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

router.post('/:formId/versions/:version/publish', async (req, res) => {
  try {
    const version = await formService.publishVersion(
      req.params.formId,
      parseInt(req.params.version)
    );
    res.json({
      message: `Version ${version.version} published successfully`,
      version
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:formId/versions/:version/freeze', async (req, res) => {
  try {
    const version = await formService.freezeVersion(
      req.params.formId,
      parseInt(req.params.version)
    );
    res.json({
      message: `Version ${version.version} frozen successfully`,
      version
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:formId/versions', async (req, res) => {
  try {
    const version = await formService.createNewVersion(
      req.params.formId,
      req.body.changeLog || ''
    );
    res.status(201).json({
      message: `New version ${version.version} created successfully`,
      version
    });
  } catch (error) {
    if (error.message.includes('Form not found')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(400).json({ error: error.message });
    }
  }
});

router.post('/:formId/fields', async (req, res) => {
  try {
    const version = await formService.addField(
      req.params.formId,
      req.body
    );
    res.status(201).json({
      message: `Field added successfully`,
      version
    });
  } catch (error) {
    if (error.message.includes('Form not found')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(400).json({ error: error.message });
    }
  }
});

router.delete('/:formId/fields/:fieldName', async (req, res) => {
  try {
    const version = await formService.removeField(
      req.params.formId,
      req.params.fieldName,
      req.body.migrationNote || ''
    );
    res.json({
      message: `Field '${req.params.fieldName}' marked as deleted`,
      version
    });
  } catch (error) {
    if (error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(400).json({ error: error.message });
    }
  }
});

router.put('/:formId/fields/:fieldName', async (req, res) => {
  try {
    const version = await formService.updateField(
      req.params.formId,
      req.params.fieldName,
      req.body
    );
    res.json({
      message: `Field '${req.params.fieldName}' updated successfully`,
      version
    });
  } catch (error) {
    if (error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(400).json({ error: error.message });
    }
  }
});

module.exports = router;
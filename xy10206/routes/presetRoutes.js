const express = require('express');
const router = express.Router();
const presetService = require('../services/presetService');

router.get('/', (req, res, next) => {
  try {
    const presets = presetService.getAllPresets(req.query.sceneId);
    res.json({
      success: true,
      data: presets,
      total: presets.length
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:presetId', (req, res, next) => {
  try {
    const preset = presetService.getPresetById(req.params.presetId);
    res.json({
      success: true,
      data: preset
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', (req, res, next) => {
  try {
    const result = presetService.createPreset(req.body);
    res.status(201).json({
      success: true,
      data: result.preset,
      message: result.message
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:presetId', (req, res, next) => {
  try {
    const result = presetService.updatePreset(req.params.presetId, req.body);
    res.json({
      success: true,
      data: result.preset,
      message: result.message
    });
  } catch (err) {
    next(err);
  }
});

router.post('/freeze', (req, res, next) => {
  try {
    const result = presetService.freezePreset(req.body.presetId, req.body.operator);
    res.json({
      success: true,
      data: result.preset,
      message: result.message
    });
  } catch (err) {
    next(err);
  }
});

router.post('/activate', (req, res, next) => {
  try {
    const result = presetService.activatePreset(req.body.presetId, req.body.operator);
    res.json({
      success: true,
      data: {
        preset: result.preset,
        scene: result.scene
      },
      message: result.message
    });
  } catch (err) {
    next(err);
  }
});

router.post('/rollback', (req, res, next) => {
  try {
    const result = presetService.rollbackPreset(req.body);
    res.json({
      success: true,
      data: {
        rollback: result.rollback,
        preset: result.preset,
        scene: result.scene
      },
      message: result.message
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/:presetId', (req, res, next) => {
  try {
    const result = presetService.deletePreset(req.params.presetId, req.body?.operator || '系统');
    res.json({
      success: true,
      message: result.message
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

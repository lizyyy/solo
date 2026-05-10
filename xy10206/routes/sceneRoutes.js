const express = require('express');
const router = express.Router();
const sceneService = require('../services/sceneService');

router.get('/', (req, res, next) => {
  try {
    const scenes = sceneService.getAllScenes();
    res.json({
      success: true,
      data: scenes,
      total: scenes.length
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:sceneId', (req, res, next) => {
  try {
    const scene = sceneService.getSceneById(req.params.sceneId);
    res.json({
      success: true,
      data: scene
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', (req, res, next) => {
  try {
    const result = sceneService.createScene(req.body);
    res.status(201).json({
      success: true,
      data: result,
      message: '场景创建成功'
    });
  } catch (err) {
    next(err);
  }
});

router.post('/lock', (req, res, next) => {
  try {
    const result = sceneService.lockScene(req.body);
    res.json({
      success: true,
      data: result.scene,
      message: result.message
    });
  } catch (err) {
    next(err);
  }
});

router.post('/unlock', (req, res, next) => {
  try {
    const result = sceneService.unlockScene(req.body);
    res.json({
      success: true,
      data: result.scene,
      message: result.message
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

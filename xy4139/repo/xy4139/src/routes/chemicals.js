const express = require('express');
const router = express.Router();
const ChemicalService = require('../services/ChemicalService');

const chemicalService = new ChemicalService();

router.get('/', async (req, res, next) => {
  try {
    const options = {
      name: req.query.name,
      danger_level: req.query.danger_level,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder,
      limit: req.query.limit ? parseInt(req.query.limit) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset) : undefined
    };
    
    const result = await chemicalService.getChemicals(options, req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/danger-levels', async (req, res, next) => {
  try {
    const levels = await chemicalService.getDangerLevels();
    res.json({ data: levels });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const chemical = await chemicalService.getChemicalById(req.params.id, req.user);
    res.json({ data: chemical.toJSON() });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const chemical = await chemicalService.createChemical(req.body, req.user);
    res.status(201).json({
      data: chemical.toJSON(),
      message: '试剂创建成功'
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const chemical = await chemicalService.updateChemical(req.params.id, req.body, req.user);
    res.json({
      data: chemical.toJSON(),
      message: '试剂更新成功'
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await chemicalService.deleteChemical(req.params.id, req.user);
    res.json({
      message: '试剂删除成功'
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const Pet = require('../models/Pet');

router.post('/', async (req, res) => {
  try {
    const pet = await Pet.create(req.body);
    res.json({
      success: true,
      message: '宠物信息创建成功',
      data: pet,
      reason: '创建成功'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: '宠物信息创建失败',
      error: error.message,
      reason: error.message
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const pets = await Pet.findAll();
    res.json({
      success: true,
      message: '获取宠物列表成功',
      data: pets
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: '获取宠物列表失败',
      error: error.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const pet = await Pet.findById(req.params.id);
    if (!pet) {
      return res.status(404).json({
        success: false,
        message: '宠物不存在',
        reason: '未找到该宠物'
      });
    }
    res.json({
      success: true,
      message: '获取宠物信息成功',
      data: pet
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: '获取宠物信息失败',
      error: error.message
    });
  }
});

module.exports = router;

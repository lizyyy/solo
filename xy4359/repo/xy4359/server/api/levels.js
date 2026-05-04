const express = require('express');
const Level = require('../models/Level');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const levels = Level.getAll();
    res.json({
      success: true,
      data: levels
    });
  } catch (error) {
    console.error('获取关卡列表失败:', error);
    res.status(500).json({ 
      error: '获取关卡列表失败', 
      message: error.message 
    });
  }
});

router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const level = Level.getById(id);
    
    if (!level) {
      return res.status(404).json({ 
        error: '关卡不存在', 
        message: '未找到指定的关卡' 
      });
    }
    
    res.json({
      success: true,
      data: level
    });
  } catch (error) {
    console.error('获取关卡详情失败:', error);
    res.status(500).json({ 
      error: '获取关卡详情失败', 
      message: error.message 
    });
  }
});

router.post('/', (req, res) => {
  try {
    const levelData = req.body;
    
    if (!levelData.sceneData) {
      return res.status(400).json({ 
        error: '缺少必需数据', 
        message: '关卡必须包含场景数据' 
      });
    }
    
    const newLevel = Level.create(levelData);
    
    res.status(201).json({
      success: true,
      message: '关卡创建成功',
      data: newLevel
    });
  } catch (error) {
    console.error('创建关卡失败:', error);
    res.status(500).json({ 
      error: '创建关卡失败', 
      message: error.message 
    });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const levelData = req.body;
    
    const updatedLevel = Level.update(id, levelData);
    
    if (!updatedLevel) {
      return res.status(404).json({ 
        error: '关卡不存在', 
        message: '未找到指定的关卡' 
      });
    }
    
    res.json({
      success: true,
      message: '关卡更新成功',
      data: updatedLevel
    });
  } catch (error) {
    console.error('更新关卡失败:', error);
    res.status(500).json({ 
      error: '更新关卡失败', 
      message: error.message 
    });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const deleted = Level.delete(id);
    
    if (!deleted) {
      return res.status(404).json({ 
        error: '关卡不存在', 
        message: '未找到指定的关卡' 
      });
    }
    
    res.json({
      success: true,
      message: '关卡删除成功'
    });
  } catch (error) {
    console.error('删除关卡失败:', error);
    res.status(500).json({ 
      error: '删除关卡失败', 
      message: error.message 
    });
  }
});

module.exports = router;

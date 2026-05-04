const express = require('express');
const Rehearsal = require('../models/Rehearsal');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const { levelId } = req.query;
    let rehearsals;
    
    if (levelId) {
      rehearsals = Rehearsal.getByLevelId(levelId);
    } else {
      rehearsals = Rehearsal.getAll();
    }
    
    res.json({
      success: true,
      data: rehearsals
    });
  } catch (error) {
    console.error('获取排练记录失败:', error);
    res.status(500).json({ 
      error: '获取排练记录失败', 
      message: error.message 
    });
  }
});

router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const rehearsal = Rehearsal.getById(id);
    
    if (!rehearsal) {
      return res.status(404).json({ 
        error: '排练记录不存在', 
        message: '未找到指定的排练记录' 
      });
    }
    
    res.json({
      success: true,
      data: rehearsal
    });
  } catch (error) {
    console.error('获取排练记录详情失败:', error);
    res.status(500).json({ 
      error: '获取排练记录详情失败', 
      message: error.message 
    });
  }
});

router.post('/', (req, res) => {
  try {
    const rehearsalData = req.body;
    
    if (!rehearsalData.levelId) {
      return res.status(400).json({ 
        error: '缺少必需数据', 
        message: '排练记录必须关联关卡' 
      });
    }
    
    const newRehearsal = Rehearsal.create(rehearsalData);
    
    res.status(201).json({
      success: true,
      message: '排练记录保存成功',
      data: newRehearsal
    });
  } catch (error) {
    console.error('保存排练记录失败:', error);
    res.status(500).json({ 
      error: '保存排练记录失败', 
      message: error.message 
    });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const rehearsalData = req.body;
    
    const updatedRehearsal = Rehearsal.update(id, rehearsalData);
    
    if (!updatedRehearsal) {
      return res.status(404).json({ 
        error: '排练记录不存在', 
        message: '未找到指定的排练记录' 
      });
    }
    
    res.json({
      success: true,
      message: '排练记录更新成功',
      data: updatedRehearsal
    });
  } catch (error) {
    console.error('更新排练记录失败:', error);
    res.status(500).json({ 
      error: '更新排练记录失败', 
      message: error.message 
    });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const deleted = Rehearsal.delete(id);
    
    if (!deleted) {
      return res.status(404).json({ 
        error: '排练记录不存在', 
        message: '未找到指定的排练记录' 
      });
    }
    
    res.json({
      success: true,
      message: '排练记录删除成功'
    });
  } catch (error) {
    console.error('删除排练记录失败:', error);
    res.status(500).json({ 
      error: '删除排练记录失败', 
      message: error.message 
    });
  }
});

module.exports = router;

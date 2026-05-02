const express = require('express');
const { v4: uuidv4 } = require('uuid');
const store = require('../store');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const supplies = store.readSupplies();
    res.json({
      success: true,
      data: supplies
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '获取物资列表失败',
      message: error.message
    });
  }
});

router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const supplies = store.readSupplies();
    const supply = supplies.find(s => s.id === id);
    
    if (!supply) {
      return res.status(404).json({
        success: false,
        error: '物资不存在'
      });
    }
    
    res.json({
      success: true,
      data: supply
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '获取物资详情失败',
      message: error.message
    });
  }
});

router.post('/', (req, res) => {
  try {
    const { name, category, totalQuantity, availableQuantity, remark } = req.body;
    
    if (!name || !category || totalQuantity === undefined) {
      return res.status(400).json({
        success: false,
        error: '名称、分类和总数量为必填项'
      });
    }
    
    if (totalQuantity < 0) {
      return res.status(400).json({
        success: false,
        error: '总数量不能为负数'
      });
    }
    
    const supplies = store.readSupplies();
    
    const existSupply = supplies.find(s => s.name === name && s.category === category);
    if (existSupply) {
      return res.status(400).json({
        success: false,
        error: '该分类下已存在同名物资'
      });
    }
    
    const newSupply = {
      id: uuidv4(),
      name: name.trim(),
      category: category.trim(),
      totalQuantity: Number(totalQuantity),
      availableQuantity: availableQuantity !== undefined ? Number(availableQuantity) : Number(totalQuantity),
      remark: remark || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    if (newSupply.availableQuantity > newSupply.totalQuantity) {
      return res.status(400).json({
        success: false,
        error: '可借数量不能大于总数量'
      });
    }
    
    supplies.push(newSupply);
    store.writeSupplies(supplies);
    
    res.status(201).json({
      success: true,
      data: newSupply
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '创建物资失败',
      message: error.message
    });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, totalQuantity, availableQuantity, remark } = req.body;
    
    const supplies = store.readSupplies();
    const index = supplies.findIndex(s => s.id === id);
    
    if (index === -1) {
      return res.status(404).json({
        success: false,
        error: '物资不存在'
      });
    }
    
    const supply = supplies[index];
    
    if (name !== undefined) supply.name = name.trim();
    if (category !== undefined) supply.category = category.trim();
    if (totalQuantity !== undefined) {
      const newTotal = Number(totalQuantity);
      if (newTotal < 0) {
        return res.status(400).json({
          success: false,
          error: '总数量不能为负数'
        });
      }
      if (supply.availableQuantity > newTotal) {
        return res.status(400).json({
          success: false,
          error: '总数量不能小于当前可借数量'
        });
      }
      supply.totalQuantity = newTotal;
    }
    if (availableQuantity !== undefined) {
      const newAvailable = Number(availableQuantity);
      if (newAvailable < 0) {
        return res.status(400).json({
          success: false,
          error: '可借数量不能为负数'
        });
      }
      if (newAvailable > supply.totalQuantity) {
        return res.status(400).json({
          success: false,
          error: '可借数量不能大于总数量'
        });
      }
      supply.availableQuantity = newAvailable;
    }
    if (remark !== undefined) supply.remark = remark;
    
    supply.updatedAt = new Date().toISOString();
    store.writeSupplies(supplies);
    
    res.json({
      success: true,
      data: supply
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '更新物资失败',
      message: error.message
    });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const supplies = store.readSupplies();
    const borrowRecords = store.readBorrowRecords();
    
    const hasBorrowed = borrowRecords.some(
      r => r.supplyId === id && r.status !== 'returned'
    );
    
    if (hasBorrowed) {
      return res.status(400).json({
        success: false,
        error: '该物资存在未归还的借用记录，无法删除'
      });
    }
    
    const index = supplies.findIndex(s => s.id === id);
    if (index === -1) {
      return res.status(404).json({
        success: false,
        error: '物资不存在'
      });
    }
    
    supplies.splice(index, 1);
    store.writeSupplies(supplies);
    
    res.json({
      success: true,
      message: '删除成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '删除物资失败',
      message: error.message
    });
  }
});

module.exports = router;

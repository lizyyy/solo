const express = require('express');
const router = express.Router();
const { readData, writeData, generateId } = require('../utils/dataHandler');

const EQUIPMENT_FILE = 'equipment.json';

router.get('/', (req, res) => {
  try {
    const equipment = readData(EQUIPMENT_FILE);
    res.json({
      success: true,
      data: equipment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取装备列表失败',
      error: error.message
    });
  }
});

router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const equipment = readData(EQUIPMENT_FILE);
    const item = equipment.find(e => e.id === id);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: '装备套装不存在'
      });
    }
    
    res.json({
      success: true,
      data: item
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取装备详情失败',
      error: error.message
    });
  }
});

router.post('/', (req, res) => {
  try {
    const { name, description, items, stock } = req.body;
    
    if (!name || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请填写装备套装名称和装备明细'
      });
    }
    
    const equipment = readData(EQUIPMENT_FILE);
    
    const totalDeposit = items.reduce((sum, item) => sum + (item.deposit || 0) * (item.quantity || 1), 0);
    const totalRentalFee = items.reduce((sum, item) => sum + (item.rentalFee || 0) * (item.quantity || 1), 0);
    
    const newEquipment = {
      id: generateId(),
      name,
      description: description || '',
      items: items.map(item => ({
        id: generateId(),
        name: item.name,
        quantity: item.quantity || 1,
        deposit: item.deposit || 0,
        rentalFee: item.rentalFee || 0
      })),
      totalDeposit,
      totalRentalFee,
      stock: stock || 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    equipment.push(newEquipment);
    writeData(EQUIPMENT_FILE, equipment);
    
    res.json({
      success: true,
      message: '装备套装创建成功',
      data: newEquipment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '创建装备套装失败',
      error: error.message
    });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, items, stock } = req.body;
    
    const equipment = readData(EQUIPMENT_FILE);
    const index = equipment.findIndex(e => e.id === id);
    
    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: '装备套装不存在'
      });
    }
    
    const totalDeposit = items ? items.reduce((sum, item) => sum + (item.deposit || 0) * (item.quantity || 1), 0) : equipment[index].totalDeposit;
    const totalRentalFee = items ? items.reduce((sum, item) => sum + (item.rentalFee || 0) * (item.quantity || 1), 0) : equipment[index].totalRentalFee;
    
    equipment[index] = {
      ...equipment[index],
      name: name || equipment[index].name,
      description: description !== undefined ? description : equipment[index].description,
      items: items ? items.map(item => ({
        id: item.id || generateId(),
        name: item.name,
        quantity: item.quantity || 1,
        deposit: item.deposit || 0,
        rentalFee: item.rentalFee || 0
      })) : equipment[index].items,
      totalDeposit,
      totalRentalFee,
      stock: stock !== undefined ? stock : equipment[index].stock,
      updatedAt: new Date().toISOString()
    };
    
    writeData(EQUIPMENT_FILE, equipment);
    
    res.json({
      success: true,
      message: '装备套装更新成功',
      data: equipment[index]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '更新装备套装失败',
      error: error.message
    });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const equipment = readData(EQUIPMENT_FILE);
    const index = equipment.findIndex(e => e.id === id);
    
    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: '装备套装不存在'
      });
    }
    
    equipment.splice(index, 1);
    writeData(EQUIPMENT_FILE, equipment);
    
    res.json({
      success: true,
      message: '装备套装删除成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '删除装备套装失败',
      error: error.message
    });
  }
});

module.exports = router;

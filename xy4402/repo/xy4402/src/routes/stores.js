const express = require('express');
const router = express.Router();
const { Store } = require('../models');
const { Op } = require('sequelize');

router.post('/', async (req, res) => {
  try {
    const { 
      name, 
      code, 
      address, 
      latitude, 
      longitude, 
      contact, 
      phone,
      contractStartDate,
      contractEndDate,
      status
    } = req.body;
    
    if (!name || !code || !address || latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        success: false,
        error: '门店名称、编号、地址、经纬度是必填项'
      });
    }
    
    const existingStore = await Store.findOne({
      where: {
        [Op.or]: [
          { code },
          { name }
        ]
      }
    });
    
    if (existingStore) {
      return res.status(400).json({
        success: false,
        error: '门店名称或编号已存在'
      });
    }
    
    const store = await Store.create({
      name,
      code,
      address,
      latitude,
      longitude,
      contact,
      phone,
      contractStartDate,
      contractEndDate,
      status: status || 'active'
    });
    
    res.status(201).json({
      success: true,
      data: store
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const { status, search, limit = 100, offset = 0 } = req.query;
    
    const where = {};
    if (status) where.status = status;
    
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { code: { [Op.like]: `%${search}%` } },
        { address: { [Op.like]: `%${search}%` } }
      ];
    }
    
    const { count, rows } = await Store.findAndCountAll({
      where,
      order: [['name', 'ASC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    res.json({
      success: true,
      data: {
        total: count,
        limit: parseInt(limit),
        offset: parseInt(offset),
        items: rows
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const store = await Store.findByPk(id);
    
    if (!store) {
      return res.status(404).json({
        success: false,
        error: '门店不存在'
      });
    }
    
    res.json({
      success: true,
      data: store
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const store = await Store.findByPk(id);
    
    if (!store) {
      return res.status(404).json({
        success: false,
        error: '门店不存在'
      });
    }
    
    if (updateData.code || updateData.name) {
      const existingStore = await Store.findOne({
        where: {
          id: { [Op.ne]: id },
          [Op.or]: [
            updateData.code ? { code: updateData.code } : null,
            updateData.name ? { name: updateData.name } : null
          ].filter(Boolean)
        }
      });
      
      if (existingStore) {
        return res.status(400).json({
          success: false,
          error: '门店名称或编号已存在'
        });
      }
    }
    
    await store.update(updateData);
    
    res.json({
      success: true,
      data: store
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const store = await Store.findByPk(id);
    
    if (!store) {
      return res.status(404).json({
        success: false,
        error: '门店不存在'
      });
    }
    
    await store.destroy();
    
    res.json({
      success: true,
      message: '门店已删除'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

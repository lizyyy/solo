const express = require('express');
const router = express.Router();
const { TestDrive } = require('../models');
const { generateTestDriveNo } = require('../services/validationService');

router.post('/', async (req, res) => {
  try {
    const testDrive = await TestDrive.create({
      ...req.body,
      testDriveNo: req.body.testDriveNo || generateTestDriveNo(),
      status: req.body.status || 'scheduled'
    });

    res.status(201).json({
      success: true,
      message: '试驾记录创建成功',
      data: testDrive.toJSON()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: error.message || '服务器内部错误'
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const testDrive = await TestDrive.findByPk(req.params.id);
    if (!testDrive) {
      return res.status(404).json({
        success: false,
        code: 'TEST_DRIVE_NOT_FOUND',
        message: '试驾记录不存在'
      });
    }

    res.json({
      success: true,
      data: testDrive.toJSON()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: error.message || '服务器内部错误'
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const testDrives = await TestDrive.findAll({
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: testDrives.map(t => t.toJSON()),
      total: testDrives.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: error.message || '服务器内部错误'
    });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const testDrive = await TestDrive.findByPk(req.params.id);
    if (!testDrive) {
      return res.status(404).json({
        success: false,
        code: 'TEST_DRIVE_NOT_FOUND',
        message: '试驾记录不存在'
      });
    }

    await testDrive.update(req.body);

    res.json({
      success: true,
      message: '试驾记录更新成功',
      data: testDrive.toJSON()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: error.message || '服务器内部错误'
    });
  }
});

module.exports = router;

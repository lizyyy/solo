const express = require('express');
const router = express.Router();
const storage = require('../utils/storage');
const Volunteer = require('../models/Volunteer');
const { ValidationError, NotFoundError } = require('../middleware/errorHandler');

function generateId() {
  return 'V' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

router.get('/', (req, res, next) => {
  try {
    const volunteers = storage.getVolunteers();
    res.json({
      success: true,
      data: volunteers,
      total: volunteers.length
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', (req, res, next) => {
  try {
    const volunteer = storage.getVolunteerById(req.params.id);
    if (!volunteer) {
      throw new NotFoundError('志愿者', req.params.id);
    }
    res.json({
      success: true,
      data: volunteer
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', (req, res, next) => {
  try {
    const data = {
      id: generateId(),
      ...req.body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const volunteer = new Volunteer(data);
    const errors = volunteer.validate();

    if (errors.length > 0) {
      throw new ValidationError('志愿者数据验证失败', errors);
    }

    const saved = storage.addVolunteer(volunteer);
    res.status(201).json({
      success: true,
      message: '志愿者创建成功',
      data: saved
    });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', (req, res, next) => {
  try {
    const existing = storage.getVolunteerById(req.params.id);
    if (!existing) {
      throw new NotFoundError('志愿者', req.params.id);
    }

    const updated = storage.updateVolunteer(req.params.id, req.body);
    res.json({
      success: true,
      message: '志愿者信息更新成功',
      data: updated
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/records', (req, res, next) => {
  try {
    const volunteer = storage.getVolunteerById(req.params.id);
    if (!volunteer) {
      throw new NotFoundError('志愿者', req.params.id);
    }

    const records = storage.getRecordsByVolunteerId(req.params.id);
    res.json({
      success: true,
      data: records,
      total: records.length
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
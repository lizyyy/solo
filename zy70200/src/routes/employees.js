const express = require('express');
const { Employee } = require('../models');

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const {
      employeeNo,
      name,
      email,
      department,
      position,
      hireDate,
      baseSalary
    } = req.body;

    const employee = await Employee.create({
      employeeNo,
      name,
      email,
      department,
      position,
      hireDate,
      baseSalary,
      currentSalary: baseSalary,
      isActive: true
    });

    res.status(201).json({
      success: true,
      data: employee
    });
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const employees = await Employee.findAll({
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: employees
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const employee = await Employee.findByPk(req.params.id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: '未找到员工'
      });
    }

    res.json({
      success: true,
      data: employee
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

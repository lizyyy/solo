const express = require('express');
const router = express.Router();
const RepairTeam = require('../models/RepairTeam');
const { AppError } = require('../middleware/errorHandler');

router.get('/', (req, res, next) => {
  try {
    const teams = RepairTeam.getAll();
    res.json({
      status: 'success',
      count: teams.length,
      data: teams
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', (req, res, next) => {
  try {
    const { name, leader, members, buildingArea } = req.body;

    if (!name || !leader) {
      throw new AppError(
        '缺少必填字段：队伍名称和队长',
        400,
        'MISSING_REQUIRED_FIELDS',
        { missingFields: !name ? ['name'] : [], missingLeader: !leader }
      );
    }

    const existing = RepairTeam.findByName(name);
    if (existing) {
      throw new AppError(
        `维修队伍 ${name} 已存在`,
        409,
        'TEAM_ALREADY_EXISTS',
        { teamName: name }
      );
    }

    const newTeam = RepairTeam.create({
      name,
      leader,
      members: members || [],
      buildingArea: buildingArea || [],
      status: 'active'
    });

    res.status(201).json({
      status: 'success',
      message: '维修队伍创建成功',
      data: newTeam
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/handover', (req, res, next) => {
  try {
    const { fromTeam, toTeam, handoverRecords, operator, remarks } = req.body;

    if (!toTeam || !handoverRecords || !Array.isArray(handoverRecords)) {
      throw new AppError(
        '交接信息不完整',
        400,
        'INVALID_HANDOVER_DATA',
        { required: ['toTeam', 'handoverRecords'] }
      );
    }

    const team = RepairTeam.addHandoverRecord(req.params.id, {
      fromTeam: fromTeam || req.params.id,
      toTeam,
      recordIds: handoverRecords,
      operator,
      remarks,
      status: 'completed'
    });

    if (!team) {
      throw new AppError(
        `维修队伍 ${req.params.id} 不存在`,
        404,
        'TEAM_NOT_FOUND',
        { teamId: req.params.id }
      );
    }

    res.json({
      status: 'success',
      message: '班组交接记录已创建',
      data: team
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Risk, ReviewRecord, DisposalRecord, WaterSample } = require('../models');
const RiskDetectionService = require('../services/riskDetectionService');

const RISK_TYPE_MAP = {
  'CONTINUOUS_ANOMALY': '连续异常',
  'REPEATED_OVERLIMIT': '反复超标',
  'NO_RECOVERY_AFTER_TREATMENT': '补药后未恢复'
};

const SEVERITY_MAP = {
  'LOW': '低',
  'MEDIUM': '中',
  'HIGH': '高',
  'CRITICAL': '严重'
};

const STATUS_MAP = {
  'PENDING': '待处理',
  'REVIEWING': '复核中',
  'RESOLVED': '已解决',
  'DISMISSED': '已忽略',
  'REVISED': '已改判'
};

const PARAMETER_NAME_MAP = {
  'chlorine': '余氯',
  'ph': 'pH值',
  'turbidity': '浊度',
  'temperature': '水温'
};

router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status, 
      riskType, 
      severity, 
      samplePoint,
      includeResolved = false
    } = req.query;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const whereClause = {};
    
    if (status) {
      whereClause.status = status;
    } else if (!includeResolved && includeResolved !== 'true') {
      whereClause.status = {
        [Op.in]: ['PENDING', 'REVIEWING']
      };
    }
    
    if (riskType) {
      whereClause.riskType = riskType;
    }
    
    if (severity) {
      whereClause.severity = severity;
    }
    
    if (samplePoint) {
      whereClause.samplePoint = samplePoint;
    }
    
    const { count, rows } = await Risk.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: ReviewRecord,
          as: 'reviews',
          separate: true,
          order: [['reviewedAt', 'DESC']]
        },
        {
          model: DisposalRecord,
          as: 'disposals',
          separate: true,
          order: [['disposedAt', 'DESC']]
        }
      ],
      order: [
        ['severity', 'DESC'],
        ['detectionTime', 'DESC']
      ],
      limit: parseInt(limit),
      offset
    });
    
    const risksWithNames = rows.map(risk => {
      const riskData = risk.toJSON();
      return {
        ...riskData,
        riskTypeName: RISK_TYPE_MAP[risk.riskType],
        severityName: SEVERITY_MAP[risk.severity],
        statusName: STATUS_MAP[risk.status],
        affectedParameterName: PARAMETER_NAME_MAP[risk.affectedParameter]
      };
    });
    
    res.json({
      success: true,
      data: {
        risks: risksWithNames,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Error fetching risks:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const risk = await Risk.findOne({
      where: { id },
      include: [
        {
          model: ReviewRecord,
          as: 'reviews',
          separate: true,
          order: [['reviewedAt', 'ASC']]
        },
        {
          model: DisposalRecord,
          as: 'disposals',
          separate: true,
          order: [['disposedAt', 'ASC']]
        }
      ]
    });
    
    if (!risk) {
      return res.status(404).json({
        success: false,
        error: '风险不存在'
      });
    }
    
    const affectedSamples = await WaterSample.findAll({
      where: {
        id: {
          [Op.in]: risk.affectedSampleIds
        }
      },
      order: [['sampleTime', 'ASC']]
    });
    
    const riskData = risk.toJSON();
    const riskWithNames = {
      ...riskData,
      riskTypeName: RISK_TYPE_MAP[risk.riskType],
      severityName: SEVERITY_MAP[risk.severity],
      statusName: STATUS_MAP[risk.status],
      affectedParameterName: PARAMETER_NAME_MAP[risk.affectedParameter],
      affectedSamples
    };
    
    res.json({
      success: true,
      data: riskWithNames
    });
  } catch (error) {
    console.error('Error fetching risk:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/detect', async (req, res) => {
  try {
    const risks = await RiskDetectionService.detectAllRisks();
    
    res.json({
      success: true,
      data: {
        count: risks.length,
        risks
      }
    });
  } catch (error) {
    console.error('Error detecting risks:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:id/revise', async (req, res) => {
  try {
    const { id } = req.params;
    const { revisedStatus, revisedReason, revisedBy } = req.body;
    
    if (!revisedStatus || !revisedReason) {
      return res.status(400).json({
        success: false,
        error: '请提供改判状态和原因'
      });
    }
    
    const risk = await Risk.findOne({ where: { id } });
    
    if (!risk) {
      return res.status(404).json({
        success: false,
        error: '风险不存在'
      });
    }
    
    await risk.update({
      status: 'REVISED',
      revisedStatus,
      revisedReason,
      revisedBy: revisedBy || '系统',
      revisedAt: new Date()
    });
    
    await ReviewRecord.create({
      riskId: id,
      reviewer: revisedBy || '系统',
      reviewType: 'FINAL',
      reviewResult: 'REVISE',
      comment: `改判原因：${revisedReason}，改判状态：${revisedStatus}`,
      reviewedAt: new Date()
    });
    
    res.json({
      success: true,
      data: {
        message: '风险已改判',
        risk: {
          ...risk.toJSON(),
          riskTypeName: RISK_TYPE_MAP[risk.riskType],
          severityName: SEVERITY_MAP[risk.severity],
          statusName: STATUS_MAP[risk.status]
        }
      }
    });
  } catch (error) {
    console.error('Error revising risk:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:id/dispose', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      disposer,
      disposalType,
      disposalAmount,
      disposalUnit,
      beforeValue,
      targetValue,
      description,
      followUpNeeded,
      followUpTime,
      remark
    } = req.body;
    
    if (!disposer || !disposalType) {
      return res.status(400).json({
        success: false,
        error: '请提供处置人员和处置类型'
      });
    }
    
    const risk = await Risk.findOne({ where: { id } });
    
    if (!risk) {
      return res.status(404).json({
        success: false,
        error: '风险不存在'
      });
    }
    
    const disposal = await DisposalRecord.create({
      riskId: id,
      disposer,
      disposalType,
      disposalAmount,
      disposalUnit,
      beforeValue,
      targetValue,
      description,
      followUpNeeded: followUpNeeded === true || followUpNeeded === 'true',
      followUpTime: followUpTime ? new Date(followUpTime) : null,
      remark,
      effectAssessment: 'UNKNOWN',
      disposedAt: new Date()
    });
    
    await risk.update({
      status: 'REVIEWING'
    });
    
    res.json({
      success: true,
      data: {
        message: '处置记录已保存',
        disposal,
        risk: {
          ...risk.toJSON(),
          riskTypeName: RISK_TYPE_MAP[risk.riskType],
          severityName: SEVERITY_MAP[risk.severity],
          statusName: STATUS_MAP[risk.status]
        }
      }
    });
  } catch (error) {
    console.error('Error creating disposal:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    const { treatmentResult, treatedBy, afterValue } = req.body;
    
    if (!treatmentResult) {
      return res.status(400).json({
        success: false,
        error: '请提供处理结果'
      });
    }
    
    const risk = await Risk.findOne({ where: { id } });
    
    if (!risk) {
      return res.status(404).json({
        success: false,
        error: '风险不存在'
      });
    }
    
    await risk.update({
      status: 'RESOLVED',
      treatmentResult,
      treatedBy: treatedBy || '系统',
      treatedAt: new Date()
    });
    
    if (afterValue) {
      const latestDisposal = await DisposalRecord.findOne({
        where: { riskId: id },
        order: [['disposedAt', 'DESC']]
      });
      
      if (latestDisposal) {
        await latestDisposal.update({
          afterValue,
          effectAssessment: 'GOOD'
        });
      }
    }
    
    await ReviewRecord.create({
      riskId: id,
      reviewer: treatedBy || '系统',
      reviewType: 'FINAL',
      reviewResult: 'CONFIRM',
      comment: `处理结果：${treatmentResult}`,
      reviewedAt: new Date()
    });
    
    res.json({
      success: true,
      data: {
        message: '风险已解决',
        risk: {
          ...risk.toJSON(),
          riskTypeName: RISK_TYPE_MAP[risk.riskType],
          severityName: SEVERITY_MAP[risk.severity],
          statusName: STATUS_MAP[risk.status]
        }
      }
    });
  } catch (error) {
    console.error('Error resolving risk:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/:id/dismiss', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, dismissedBy } = req.body;
    
    const risk = await Risk.findOne({ where: { id } });
    
    if (!risk) {
      return res.status(404).json({
        success: false,
        error: '风险不存在'
      });
    }
    
    await risk.update({
      status: 'DISMISSED'
    });
    
    await ReviewRecord.create({
      riskId: id,
      reviewer: dismissedBy || '系统',
      reviewType: 'FINAL',
      reviewResult: 'DISMISS',
      comment: reason || '忽略此风险',
      reviewedAt: new Date()
    });
    
    res.json({
      success: true,
      data: {
        message: '风险已忽略',
        risk: {
          ...risk.toJSON(),
          riskTypeName: RISK_TYPE_MAP[risk.riskType],
          severityName: SEVERITY_MAP[risk.severity],
          statusName: STATUS_MAP[risk.status]
        }
      }
    });
  } catch (error) {
    console.error('Error dismissing risk:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/statistics/summary', async (req, res) => {
  try {
    const pendingCount = await Risk.count({
      where: { status: 'PENDING' }
    });
    
    const reviewingCount = await Risk.count({
      where: { status: 'REVIEWING' }
    });
    
    const resolvedCount = await Risk.count({
      where: { status: 'RESOLVED' }
    });
    
    const bySeverity = await Risk.findAll({
      attributes: ['severity', [Risk.sequelize.fn('COUNT', Risk.sequelize.col('id')), 'count']],
      where: {
        status: {
          [Op.in]: ['PENDING', 'REVIEWING']
        }
      },
      group: ['severity'],
      raw: true
    });
    
    const byType = await Risk.findAll({
      attributes: ['riskType', [Risk.sequelize.fn('COUNT', Risk.sequelize.col('id')), 'count']],
      where: {
        status: {
          [Op.in]: ['PENDING', 'REVIEWING']
        }
      },
      group: ['riskType'],
      raw: true
    });
    
    res.json({
      success: true,
      data: {
        byStatus: {
          pending: pendingCount,
          reviewing: reviewingCount,
          resolved: resolvedCount
        },
        bySeverity: bySeverity.map(s => ({
          severity: s.severity,
          severityName: SEVERITY_MAP[s.severity],
          count: parseInt(s.count)
        })),
        byType: byType.map(t => ({
          riskType: t.riskType,
          riskTypeName: RISK_TYPE_MAP[t.riskType],
          count: parseInt(t.count)
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching risk statistics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

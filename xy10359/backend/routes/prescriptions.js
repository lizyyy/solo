const express = require('express');
const router = express.Router();
const Prescription = require('../models/Prescription');
const Patient = require('../models/Patient');
const { validatePrescription, canDispensePrescription } = require('../utils/prescriptionValidator');

const generatePrescriptionNo = () => {
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `RX${dateStr}${random}`;
};

router.get('/', async (req, res) => {
  try {
    const { status, patientName, startDate, endDate, page = 1, limit = 10 } = req.query;
    const query = {};

    if (status) {
      query.status = status;
    }
    if (patientName) {
      query.patientName = { $regex: patientName, $options: 'i' };
    }
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const prescriptions = await Prescription.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('patientId');

    const total = await Prescription.countDocuments(query);

    res.json({
      prescriptions,
      pagination: {
        current: parseInt(page),
        pageSize: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ error: '获取处方列表失败', message: error.message });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const stats = await Prescription.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const result = {
      待复核: 0,
      已通过: 0,
      已退回: 0,
      需补充: 0,
      已发药: 0
    };

    stats.forEach(s => {
      result[s._id] = s.count;
    });

    const highRiskCount = await Prescription.countDocuments({
      'risks.severity': '高',
      status: { $in: ['待复核', '需补充'] }
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await Prescription.countDocuments({
      createdAt: { $gte: today }
    });

    res.json({
      byStatus: result,
      highRisk: highRiskCount,
      todayNew: todayCount,
      total: result.待复核 + result.已通过 + result.已退回 + result.需补充 + result.已发药
    });
  } catch (error) {
    res.status(500).json({ error: '获取统计数据失败', message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const prescription = await Prescription.findById(req.params.id)
      .populate('patientId');

    if (!prescription) {
      return res.status(404).json({ error: '处方不存在' });
    }

    res.json(prescription);
  } catch (error) {
    res.status(500).json({ error: '获取处方详情失败', message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const prescriptionNo = generatePrescriptionNo();
    
    const validationResult = await validatePrescription(req.body);

    const prescription = new Prescription({
      ...req.body,
      prescriptionNo,
      risks: validationResult.risks,
      canDispense: validationResult.canDispense,
      reviewHistory: [{
        reviewer: req.body.doctorName || '系统',
        action: '创建',
        reason: '处方创建'
      }]
    });

    await prescription.save();
    res.status(201).json(prescription);
  } catch (error) {
    res.status(400).json({ error: '创建处方失败', message: error.message });
  }
});

router.post('/:id/review', async (req, res) => {
  try {
    const { id } = req.params;
    const { action, reason, reviewer, notes } = req.body;

    const validActions = ['通过', '退回', '需补充', '重新提交', '发药'];
    if (!validActions.includes(action)) {
      return res.status(400).json({ error: '无效的复核操作' });
    }

    const prescription = await Prescription.findById(id);
    if (!prescription) {
      return res.status(404).json({ error: '处方不存在' });
    }

    if (action === '发药') {
      if (!canDispensePrescription(prescription)) {
        return res.status(400).json({ 
          error: '该处方无法发药',
          reason: prescription.status !== '已通过' 
            ? '处方未通过复核'
            : '处方存在高风险问题，请先解决'
        });
      }
    }

    let newStatus = prescription.status;
    switch (action) {
      case '通过':
        newStatus = '已通过';
        break;
      case '退回':
        newStatus = '已退回';
        break;
      case '需补充':
        newStatus = '需补充';
        break;
      case '重新提交':
        newStatus = '待复核';
        break;
      case '发药':
        newStatus = '已发药';
        break;
    }

    if (action === '重新提交') {
      const validationResult = await validatePrescription(prescription);
      prescription.risks = validationResult.risks;
      prescription.canDispense = validationResult.canDispense;
    }

    prescription.reviewHistory.push({
      reviewer: reviewer || '药师',
      action,
      reason,
      notes,
      riskDetails: prescription.risks.map(r => ({
        type: r.type,
        category: r.category
      }))
    });

    prescription.status = newStatus;
    if (action === '通过') {
      prescription.reviewedAt = new Date();
    }

    await prescription.save();
    res.json(prescription);
  } catch (error) {
    res.status(400).json({ error: '复核操作失败', message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const prescription = await Prescription.findById(id);

    if (!prescription) {
      return res.status(404).json({ error: '处方不存在' });
    }

    if (prescription.status === '已发药') {
      return res.status(400).json({ error: '已发药的处方不能修改' });
    }

    if (req.body.items) {
      const validationResult = await validatePrescription({
        patientId: req.body.patientId || prescription.patientId,
        items: req.body.items
      });
      req.body.risks = validationResult.risks;
      req.body.canDispense = validationResult.canDispense;
    }

    Object.assign(prescription, req.body);
    await prescription.save();
    res.json(prescription);
  } catch (error) {
    res.status(400).json({ error: '更新处方失败', message: error.message });
  }
});

module.exports = router;

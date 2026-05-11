const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Claim, ClaimApproval, Shipment, CargoType, SignOff } = require('../models');
const temperatureAnalysisService = require('../services/TemperatureAnalysisService');
const claimValidationService = require('../services/ClaimValidationService');

const generateClaimNo = () => {
  const date = new Date();
  const dateStr = date.getFullYear().toString() + 
    (date.getMonth() + 1).toString().padStart(2, '0') + 
    date.getDate().toString().padStart(2, '0');
  return `CLM-${dateStr}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
};

router.get('/', async (req, res) => {
  try {
    const { page = 1, pageSize = 10, status, claimNo } = req.query;
    const where = {};
    
    if (status) where.status = status;
    if (claimNo) where.claimNo = { [Op.like]: `%${claimNo}%` };

    const offset = (page - 1) * pageSize;
    const limit = parseInt(pageSize);

    const { count, rows } = await Claim.findAndCountAll({
      where,
      include: [{
        model: Shipment,
        as: 'shipment',
        include: ['cargoType']
      }],
      order: [['createdAt', 'DESC']],
      offset,
      limit
    });

    res.json({
      success: true,
      data: rows,
      total: count,
      page: parseInt(page),
      pageSize: limit
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const claim = await Claim.findByPk(req.params.id, {
      include: [
        {
          model: Shipment,
          as: 'shipment',
          include: ['cargoType']
        },
        {
          model: ClaimApproval,
          as: 'approvals',
          order: [['createdAt', 'ASC']]
        }
      ]
    });
    
    if (!claim) {
      return res.status(404).json({ success: false, message: '索赔不存在' });
    }

    res.json({ success: true, data: claim });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/validate', async (req, res) => {
  try {
    const validation = await claimValidationService.validateClaim(req.body);
    
    const shipment = await Shipment.findByPk(req.body.shipmentId, {
      include: ['cargoType']
    });

    let recommendation = null;
    if (shipment) {
      const analysis = await temperatureAnalysisService.analyzeOvertemp(
        shipment.id,
        shipment.cargoType
      );
      recommendation = claimValidationService.calculateRecommendedAmount(
        analysis,
        shipment
      );
    }

    res.json({
      success: true,
      data: {
        validation,
        recommendation
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const claimData = {
      ...req.body,
      claimNo: generateClaimNo(),
      status: 'draft'
    };

    const validation = await claimValidationService.validateClaim(claimData);
    claimData.isDuplicate = validation.flags.isDuplicate;
    claimData.isExemptClaim = validation.flags.isExemptClaim;
    claimData.exceedsLimit = validation.flags.exceedsLimit;

    const claim = await Claim.create(claimData);

    res.json({
      success: true,
      data: claim,
      validation
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:id/submit', async (req, res) => {
  try {
    const claim = await Claim.findByPk(req.params.id);
    if (!claim) {
      return res.status(404).json({ success: false, message: '索赔不存在' });
    }

    await claim.update({ status: 'pending_review' });

    await ClaimApproval.create({
      claimId: claim.id,
      approvalStep: 1,
      approverRole: '客服',
      approverName: req.body.approverName || '系统',
      action: 'submit',
      remarks: '提交索赔申请'
    });

    res.json({ success: true, data: claim });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:id/approve', async (req, res) => {
  try {
    const { approverName, approvedAmount, remarks } = req.body;
    const claim = await Claim.findByPk(req.params.id);
    
    if (!claim) {
      return res.status(404).json({ success: false, message: '索赔不存在' });
    }

    await claim.update({
      status: 'approved',
      approvedAmount: approvedAmount || claim.claimAmount
    });

    await ClaimApproval.create({
      claimId: claim.id,
      approvalStep: 2,
      approverRole: '审批人',
      approverName: approverName || '系统',
      action: 'approve',
      decision: approvedAmount ? `批准赔付${approvedAmount}元` : '批准赔付',
      remarks
    });

    res.json({ success: true, data: claim });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:id/reject', async (req, res) => {
  try {
    const { approverName, remarks } = req.body;
    const claim = await Claim.findByPk(req.params.id);
    
    if (!claim) {
      return res.status(404).json({ success: false, message: '索赔不存在' });
    }

    await claim.update({ status: 'rejected' });

    await ClaimApproval.create({
      claimId: claim.id,
      approvalStep: 2,
      approverRole: '审批人',
      approverName: approverName || '系统',
      action: 'reject',
      decision: '驳回索赔',
      remarks
    });

    res.json({ success: true, data: claim });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id/evidence', async (req, res) => {
  try {
    const claim = await Claim.findByPk(req.params.id);
    if (!claim) {
      return res.status(404).json({ success: false, message: '索赔不存在' });
    }

    await claim.update({ csEvidence: req.body.csEvidence });
    res.json({ success: true, data: claim });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/stats/summary', async (req, res) => {
  try {
    const [totalClaims, pendingClaims, approvedClaims, rejectedClaims] = await Promise.all([
      Claim.count(),
      Claim.count({ where: { status: { [Op.in]: ['draft', 'pending_review'] } } }),
      Claim.count({ where: { status: { [Op.in]: ['approved', 'paid'] } } }),
      Claim.count({ where: { status: 'rejected' } })
    ]);

    const totalApprovedAmount = await Claim.sum('approvedAmount', {
      where: { status: { [Op.in]: ['approved', 'paid'] } }
    });

    const totalClaimAmount = await Claim.sum('claimAmount');

    res.json({
      success: true,
      data: {
        totalClaims,
        pendingClaims,
        approvedClaims,
        rejectedClaims,
        totalApprovedAmount: totalApprovedAmount || 0,
        totalClaimAmount: totalClaimAmount || 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

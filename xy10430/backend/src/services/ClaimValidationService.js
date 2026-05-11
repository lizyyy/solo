const { Op } = require('sequelize');
const { Claim, SignOff, Shipment } = require('../models');

class ClaimValidationService {
  async validateClaim(claimData) {
    const issues = [];
    const warnings = [];

    const duplicateCheck = await this.checkDuplicateClaim(claimData.shipmentId);
    if (duplicateCheck.isDuplicate) {
      issues.push({
        type: 'duplicate',
        message: duplicateCheck.message,
        existingClaim: duplicateCheck.existingClaim
      });
    }

    const exemptCheck = await this.checkExemptClaim(claimData.shipmentId);
    if (exemptCheck.isExempt) {
      issues.push({
        type: 'exempt',
        message: exemptCheck.message
      });
    }

    const limitCheck = await this.checkClaimLimit(claimData);
    if (limitCheck.exceedsLimit) {
      warnings.push({
        type: 'limit_exceeded',
        message: limitCheck.message,
        maxAllowed: limitCheck.maxAllowed
      });
    }

    return {
      isValid: issues.length === 0,
      issues,
      warnings,
      flags: {
        isDuplicate: duplicateCheck.isDuplicate,
        isExemptClaim: exemptCheck.isExempt,
        exceedsLimit: limitCheck.exceedsLimit
      }
    };
  }

  async checkDuplicateClaim(shipmentId) {
    const existingClaims = await Claim.findAll({
      where: {
        shipmentId,
        status: {
          [Op.in]: ['draft', 'pending_review', 'approved', 'paid']
        }
      },
      order: [['createdAt', 'DESC']]
    });

    if (existingClaims.length > 0) {
      return {
        isDuplicate: true,
        message: `该运单已存在${existingClaims.length}条索赔记录，最新索赔单号：${existingClaims[0].claimNo}`,
        existingClaim: {
          claimNo: existingClaims[0].claimNo,
          status: existingClaims[0].status,
          claimAmount: existingClaims[0].claimAmount,
          createdAt: existingClaims[0].createdAt
        }
      };
    }

    return { isDuplicate: false };
  }

  async checkExemptClaim(shipmentId) {
    const signOff = await SignOff.findOne({
      where: { shipmentId }
    });

    if (signOff && signOff.isExempt) {
      return {
        isExempt: true,
        message: `该运单签收时已标记免责，免责原因：${signOff.exemptReason || '未填写'}`
      };
    }

    return { isExempt: false };
  }

  async checkClaimLimit(claimData) {
    const shipment = await Shipment.findByPk(claimData.shipmentId, {
      include: ['cargoType']
    });

    if (!shipment) {
      return { exceedsLimit: false };
    }

    const cargoValue = parseFloat(shipment.cargoValue || 0);
    const multiplier = parseFloat(shipment.cargoType?.claimMultiplier || 1);
    const maxAllowed = cargoValue * multiplier;
    const claimAmount = parseFloat(claimData.claimAmount || 0);

    if (claimAmount > maxAllowed && maxAllowed > 0) {
      return {
        exceedsLimit: true,
        message: `索赔金额${claimAmount.toFixed(2)}元超过货值${cargoValue.toFixed(2)}元的${multiplier}倍赔偿限额`,
        maxAllowed,
        cargoValue,
        multiplier
      };
    }

    return { exceedsLimit: false };
  }

  calculateRecommendedAmount(analysis, shipment) {
    const cargoValue = parseFloat(shipment.cargoValue || 0);
    const multiplier = parseFloat(shipment.cargoType?.claimMultiplier || 1);
    const maxAllowed = cargoValue * multiplier;

    if (!analysis || analysis.overtempIntervals.length === 0) {
      return { recommendedAmount: 0, reason: '无超温记录' };
    }

    const maxOvertime = parseInt(shipment.cargoType?.maxOvertimeMinutes || 30);
    const overMinutes = analysis.totalOvertempMinutes;
    
    let ratio = 0;
    if (overMinutes <= maxOvertime) {
      ratio = 0.1;
    } else if (overMinutes <= maxOvertime * 2) {
      ratio = 0.3;
    } else if (overMinutes <= maxOvertime * 5) {
      ratio = 0.5;
    } else {
      ratio = 0.8;
    }

    if (analysis.maxTempDeviation > 10) {
      ratio = Math.min(ratio + 0.2, 1);
    }

    const recommendedAmount = Math.min(maxAllowed * ratio, maxAllowed);

    return {
      recommendedAmount: Math.round(recommendedAmount * 100) / 100,
      maxAllowed,
      ratio,
      overMinutes,
      maxTempDeviation: analysis.maxTempDeviation
    };
  }
}

module.exports = new ClaimValidationService();

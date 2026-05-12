const dayjs = require('dayjs');
const db = require('../models');
const { Op } = require('sequelize');

const MAJOR_ACCIDENT_TYPES = ['重大事故', '水淹车', '火烧车', '结构性损伤'];
const REQUIRED_INSPECTION_CATEGORIES = ['外观', '发动机', '变速箱', '底盘', '安全系统'];
const ANNUAL_AVERAGE_MILEAGE = 20000;
const MILEAGE_DEVIATION_THRESHOLD = 0.15;
const REPAIR_COST_THRESHOLD_RATIO = 0.08;

class ValuationRulesService {
  static calculateBasePrice(vehicleProfile) {
    const age = dayjs().year() - vehicleProfile.year;
    const basePrice = vehicleProfile.market_reference_price || vehicleProfile.base_valuation_price || 100000;
    const ageDeduction = Math.min(age * 0.08, 0.6);
    const mileageFactor = this.calculateMileageFactor(vehicleProfile.mileage, age);
    let price = basePrice * (1 - ageDeduction) * mileageFactor;
    
    if (vehicleProfile.ownership_count > 1) {
      price *= 0.98;
    }
    
    if (vehicleProfile.use_nature !== '非营运') {
      price *= 0.9;
    }
    
    return Math.round(price);
  }

  static calculateMileageFactor(mileage, age) {
    if (age <= 0) return 1;
    const expectedMileage = age * ANNUAL_AVERAGE_MILEAGE;
    const ratio = mileage / expectedMileage;
    if (ratio < 0.5) return 1.05;
    if (ratio < 0.8) return 1;
    if (ratio < 1.2) return 0.95;
    if (ratio < 1.5) return 0.85;
    if (ratio < 2) return 0.75;
    return 0.65;
  }

  static analyzeAccidents(accidents, basePrice) {
    const result = {
      hasMajorAccident: false,
      majorAccidentCount: 0,
      totalDeduction: 0,
      deductionReasons: [],
      scoreDeduction: 0,
      details: []
    };

    for (const accident of accidents) {
      let deduction = 0;
      let scoreDeduct = 0;
      let reason = '';

      if (MAJOR_ACCIDENT_TYPES.includes(accident.accident_type)) {
        result.hasMajorAccident = true;
        result.majorAccidentCount++;
        
        if (accident.accident_type === '水淹车' || accident.accident_type === '火烧车') {
          deduction = basePrice * 0.3;
          scoreDeduct = 30;
          reason = `${accident.accident_type}，扣30分，降价30%`;
        } else if (accident.accident_type === '结构性损伤') {
          deduction = basePrice * 0.25;
          scoreDeduct = 25;
          reason = '结构性损伤事故，扣25分，降价25%';
        } else {
          deduction = basePrice * 0.2;
          scoreDeduct = 20;
          reason = '重大事故，扣20分，降价20%';
        }
      } else if (accident.accident_type === '一般事故') {
        deduction = basePrice * 0.1;
        scoreDeduct = 10;
        reason = '一般事故，扣10分，降价10%';
      } else {
        deduction = basePrice * 0.05;
        scoreDeduct = 5;
        reason = '轻微事故，扣5分，降价5%';
      }

      if (accident.is_structural_damage) {
        deduction += basePrice * 0.1;
        scoreDeduct += 10;
        reason += '；包含结构性损伤，追加扣10分，降价10%';
      }

      if (accident.is_airbag_deployed) {
        deduction += basePrice * 0.08;
        scoreDeduct += 8;
        reason += '；安全气囊弹出，追加扣8分，降价8%';
      }

      result.totalDeduction += deduction;
      result.scoreDeduction += scoreDeduct;
      result.deductionReasons.push(reason);
      result.details.push({
        accident_type: accident.accident_type,
        accident_severity: accident.accident_severity,
        description: accident.description,
        deduction: deduction,
        score_deduction: scoreDeduct,
        reason: reason
      });
    }

    return result;
  }

  static analyzeMileage(mileageVerifications, vehicleProfile) {
    const result = {
      hasAnomaly: false,
      anomalyType: null,
      totalDeduction: 0,
      deductionReasons: [],
      scoreDeduction: 0,
      requiresReview: false,
      details: []
    };

    if (!mileageVerifications || mileageVerifications.length === 0) {
      return result;
    }

    const latestVerification = mileageVerifications[mileageVerifications.length - 1];
    const age = dayjs().year() - vehicleProfile.year;
    const expectedMileage = age * ANNUAL_AVERAGE_MILEAGE;
    const reportedMileage = latestVerification.reported_mileage;
    const deviation = expectedMileage > 0 ? Math.abs(expectedMileage - reportedMileage) : 0;
    const deviationPercentage = expectedMileage > 0 ? deviation / expectedMileage : 0;

    if (reportedMileage < expectedMileage * (1 - MILEAGE_DEVIATION_THRESHOLD)) {
      result.hasAnomaly = true;
      result.anomalyType = '疑似回调';
      result.requiresReview = true;
      result.totalDeduction = vehicleProfile.market_reference_price ? vehicleProfile.market_reference_price * 0.15 : 15000;
      result.scoreDeduction = 15;
      result.deductionReasons.push(`里程疑似回调，报告里程${reportedMileage}公里，预期里程约${expectedMileage}公里，偏差${(deviationPercentage * 100).toFixed(1)}%，扣15分，降价15%`);
    } else if (reportedMileage > expectedMileage * (1 + MILEAGE_DEVIATION_THRESHOLD)) {
      result.hasAnomaly = true;
      result.anomalyType = '异常待审';
      result.requiresReview = true;
      result.totalDeduction = 0;
      result.scoreDeduction = 5;
      result.deductionReasons.push(`里程异常偏高，报告里程${reportedMileage}公里，预期里程约${expectedMileage}公里，建议人工审核，扣5分`);
    }

    result.details.push({
      reported_mileage: reportedMileage,
      expected_mileage: expectedMileage,
      deviation: deviation,
      deviation_percentage: deviationPercentage,
      verification_result: latestVerification.verification_result,
      is_rollback_suspected: latestVerification.is_rollback_suspected
    });

    return result;
  }

  static analyzeInspections(inspectionItems, basePrice) {
    const result = {
      hasMissingItems: false,
      missingItemCount: 0,
      totalDeduction: 0,
      deductionReasons: [],
      scoreDeduction: 0,
      details: []
    };

    const categoryResults = {};
    for (const item of inspectionItems) {
      if (item.is_required && item.inspection_result === '未检测') {
        result.hasMissingItems = true;
        result.missingItemCount++;
        result.deductionReasons.push(`必填检测项缺失: ${item.item_name}`);
        result.scoreDeduction += 2;
      }

      if (item.inspection_result === '严重异常') {
        const deduction = basePrice * 0.05;
        result.totalDeduction += deduction;
        result.scoreDeduction += 5;
        result.deductionReasons.push(`${item.category}-${item.item_name}: 严重异常，扣5分，降价5%`);
      } else if (item.inspection_result === '中度异常') {
        const deduction = basePrice * 0.02;
        result.totalDeduction += deduction;
        result.scoreDeduction += 2;
        result.deductionReasons.push(`${item.category}-${item.item_name}: 中度异常，扣2分，降价2%`);
      } else if (item.inspection_result === '轻微异常') {
        result.scoreDeduction += 1;
        result.deductionReasons.push(`${item.category}-${item.item_name}: 轻微异常，扣1分`);
      }

      if (!categoryResults[item.category]) {
        categoryResults[item.category] = {
          category: item.category,
          total: 0,
          abnormal: 0,
          items: []
        };
      }
      categoryResults[item.category].total++;
      if (item.inspection_result !== '正常' && item.inspection_result !== '未检测') {
        categoryResults[item.category].abnormal++;
      }
      categoryResults[item.category].items.push({
        item_name: item.item_name,
        result: item.inspection_result,
        score_deduction: item.score_deduction
      });
    }

    result.details = Object.values(categoryResults);

    if (result.hasMissingItems) {
      result.requiresReview = true;
    }

    return result;
  }

  static analyzeRepairCosts(repairCosts, basePrice) {
    const threshold = basePrice * REPAIR_COST_THRESHOLD_RATIO;
    const result = {
      totalCost: 0,
      mustCost: 0,
      suggestCost: 0,
      optionalCost: 0,
      isOverThreshold: false,
      threshold: threshold,
      details: []
    };

    for (const cost of repairCosts) {
      const amount = parseFloat(cost.estimated_cost || 0);
      result.totalCost += amount;

      if (cost.priority === '必须') {
        result.mustCost += amount;
      } else if (cost.priority === '建议') {
        result.suggestCost += amount;
      } else {
        result.optionalCost += amount;
      }

      result.details.push({
        category: cost.category,
        item_name: cost.item_name,
        priority: cost.priority,
        estimated_cost: amount,
        description: cost.description
      });
    }

    if (result.totalCost > threshold) {
      result.isOverThreshold = true;
    }

    return result;
  }

  static calculateRiskLevel(accidentAnalysis, mileageAnalysis, inspectionAnalysis) {
    let riskScore = 0;

    if (accidentAnalysis.hasMajorAccident) {
      riskScore += accidentAnalysis.majorAccidentCount * 30;
    }

    if (mileageAnalysis.hasAnomaly) {
      riskScore += mileageAnalysis.anomalyType === '疑似回调' ? 25 : 10;
    }

    if (inspectionAnalysis.hasMissingItems) {
      riskScore += inspectionAnalysis.missingItemCount * 5;
    }

    riskScore += inspectionAnalysis.scoreDeduction;

    if (riskScore >= 50) {
      return '极高风险';
    } else if (riskScore >= 30) {
      return '高风险';
    } else if (riskScore >= 15) {
      return '中风险';
    }

    return '低风险';
  }

  static calculateFinalPrice(basePrice, accidentDeduction, mileageDeduction, inspectionDeduction, repairCostTotal) {
    let finalPrice = basePrice - accidentDeduction - mileageDeduction - inspectionDeduction;
    
    finalPrice = Math.max(finalPrice, basePrice * 0.2);
    
    const suggestedSalePrice = Math.round(finalPrice * 1.1);
    
    return {
      finalPrice: Math.round(finalPrice),
      suggestedSalePrice: suggestedSalePrice
    };
  }

  static buildValuationFactors(vehicleProfile, accidentAnalysis, mileageAnalysis, inspectionAnalysis, repairAnalysis) {
    return {
      vehicle: {
        brand: vehicleProfile.brand,
        model: vehicleProfile.model,
        year: vehicleProfile.year,
        mileage: vehicleProfile.mileage,
        ownership_count: vehicleProfile.ownership_count,
        use_nature: vehicleProfile.use_nature
      },
      accidents: accidentAnalysis.details,
      mileage: mileageAnalysis.details,
      inspections: inspectionAnalysis.details,
      repairs: repairAnalysis.details
    };
  }

  static checkDuplicateQuote(vehicleProfileId, customerPhone) {
    return new Promise((resolve, reject) => {
      db.QuoteVersion.findOne({
        where: {
          '$valuation.vehicle_profile_id$': vehicleProfileId,
          customer_phone: customerPhone,
          quote_status: {
            [Op.in]: ['已报价', '客户接受']
          }
        },
        include: [{
          model: db.Valuation,
          as: 'valuation'
        }]
      }).then(existing => {
        resolve(existing ? existing : null);
      }).catch(reject);
    });
  }
}

module.exports = ValuationRulesService;

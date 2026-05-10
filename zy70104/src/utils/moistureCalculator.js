class MoistureCalculator {
  
  calculateMoistureRemoved(inWeight, inMoisture, outMoisture) {
    const initialWater = inWeight * (inMoisture / 100);
    const initialDryMatter = inWeight - initialWater;
    const finalDryMatterRatio = (100 - outMoisture) / 100;
    const finalTotalWeight = initialDryMatter / finalDryMatterRatio;
    const finalWater = finalTotalWeight * (outMoisture / 100);
    
    return initialWater - finalWater;
  }

  calculateExpectedOutWeight(inWeight, inMoisture, outMoisture) {
    const initialDryMatter = inWeight * ((100 - inMoisture) / 100);
    return initialDryMatter / ((100 - outMoisture) / 100);
  }

  calculateMoistureLossRatio(inMoisture, outMoisture) {
    return ((inMoisture - outMoisture) / inMoisture) * 100;
  }

  calculateWeightLossRatio(inWeight, outWeight) {
    return ((inWeight - outWeight) / inWeight) * 100;
  }

  validateMoistureReduction(inMoisture, outMoisture, maxLoss = 20) {
    if (outMoisture >= inMoisture) {
      return { valid: false, reason: '出仓水分不能高于入仓水分' };
    }
    if (inMoisture - outMoisture > maxLoss) {
      return { valid: false, reason: `水分降幅超过上限 ${maxLoss}%` };
    }
    return { valid: true };
  }

  checkWeightAnomaly(inWeight, outWeight, inMoisture, outMoisture, tolerance = 0.2) {
    const expectedWeight = this.calculateExpectedOutWeight(inWeight, inMoisture, outMoisture);
    const diffPercent = Math.abs(outWeight - expectedWeight) / expectedWeight;
    
    if (diffPercent > tolerance) {
      return {
        isAnomaly: true,
        expectedWeight,
        actualWeight: outWeight,
        diffPercent: diffPercent * 100,
        message: `重量异常：理论出仓重量应为 ${expectedWeight.toFixed(2)}kg，实际 ${outWeight.toFixed(2)}kg，偏差 ${(diffPercent * 100).toFixed(2)}%`
      };
    }
    
    return { isAnomaly: false };
  }

  getDryingEffectiveness(inMoisture, outMoisture, dryingTime) {
    if (dryingTime <= 0) return 0;
    const moistureLoss = inMoisture - outMoisture;
    return moistureLoss / (dryingTime / 60);
  }

  getMoistureClass(moisture) {
    if (moisture >= 30) return '超高水分';
    if (moisture >= 25) return '高水分';
    if (moisture >= 20) return '偏高水分';
    if (moisture >= 14) return '标准水分';
    if (moisture >= 12) return '低水分';
    return '超低水分';
  }
}

module.exports = new MoistureCalculator();

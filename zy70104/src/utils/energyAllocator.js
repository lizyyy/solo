class EnergyAllocator {
  
  calculateDirectEnergyCost(fuelUsed, powerUsed, config) {
    const fuelCost = (fuelUsed || 0) * (config.fuelCostPerUnit || 1.2);
    const powerCost = (powerUsed || 0) * (config.powerCostPerKWh || 0.8);
    return {
      fuelCost,
      powerCost,
      totalDirectCost: fuelCost + powerCost
    };
  }

  calculateSharedEnergyCost(dryingTime, batchWeight, allBatches, config) {
    const energyShareRatio = config.energyShareRatio || 0.6;
    
    const totalActiveBatches = allBatches.filter(b => 
      b.dryingTime > 0 && b.outWeight > 0
    ).length;
    
    if (totalActiveBatches === 0) {
      return { indirectCost: 0, shareRatio: 0 };
    }
    
    const timeShare = dryingTime / (allBatches.reduce((sum, b) => sum + (b.dryingTime || 0), 0) || 1);
    const weightShare = batchWeight / (allBatches.reduce((sum, b) => sum + (b.outWeight || 0), 0) || 1);
    
    const combinedShare = (timeShare + weightShare) / 2;
    const indirectCost = combinedShare * energyShareRatio;
    
    return {
      indirectCost,
      timeShare,
      weightShare,
      combinedShare
    };
  }

  calculateEnergyEfficiency(dryingTime, moistureRemoved, powerUsed) {
    const efficiency = {
      timePerPercent: dryingTime > 0 ? dryingTime / moistureRemoved : 0,
      energyPerKgWater: powerUsed > 0 ? powerUsed / moistureRemoved : 0
    };
    
    let rating = '未知';
    if (efficiency.timePerPercent > 0) {
      if (efficiency.timePerPercent <= 30) rating = '优秀';
      else if (efficiency.timePerPercent <= 45) rating = '良好';
      else if (efficiency.timePerPercent <= 60) rating = '一般';
      else rating = '较低';
    }
    
    return { ...efficiency, rating };
  }

  checkEnergyAnomaly(fuelUsed, powerUsed, dryingTime, outWeight) {
    const anomalies = [];
    
    if (dryingTime <= 0 && (fuelUsed > 0 || powerUsed > 0)) {
      anomalies.push({
        type: 'time_mismatch',
        message: '有能耗数据但无烘干时间记录'
      });
    }
    
    if (dryingTime > 0 && fuelUsed === 0 && powerUsed === 0) {
      anomalies.push({
        type: 'energy_missing',
        message: '有烘干时间但无能耗记录'
      });
    }
    
    const powerPerHour = dryingTime > 0 ? (powerUsed / (dryingTime / 60)) : 0;
    if (powerPerHour > 100) {
      anomalies.push({
        type: 'high_power',
        message: `单位时间用电量过高: ${powerPerHour.toFixed(2)} 度/小时`
      });
    }
    
    return anomalies;
  }

  allocateEnergyToBatch(batch, allBatches, config) {
    const direct = this.calculateDirectEnergyCost(
      batch.fuelUsed, 
      batch.powerUsed, 
      config.settlement
    );
    
    const shared = this.calculateSharedEnergyCost(
      batch.dryingTime || 0,
      batch.outWeight || 0,
      allBatches,
      config.settlement
    );
    
    const anomalies = this.checkEnergyAnomaly(
      batch.fuelUsed || 0,
      batch.powerUsed || 0,
      batch.dryingTime || 0,
      batch.outWeight || 0
    );
    
    return {
      directCost: direct,
      sharedCost: shared,
      totalEnergyCost: direct.totalDirectCost + (shared.indirectCost || 0),
      anomalies,
      hasAnomaly: anomalies.length > 0
    };
  }
}

module.exports = new EnergyAllocator();

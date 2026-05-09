const { storage, DepreciationMethod } = require('../data/store');
const { createError, ErrorCodes: EC } = require('./errors');

function getDepreciationConfig(assetType) {
  return storage.depreciationConfigs.find(c => c.assetType === assetType);
}

function calculateMonthlyDepreciation(asset) {
  const config = getDepreciationConfig(asset.assetType);
  if (!config) {
    throw createError(EC.DEPRECIATION_CONFIG_NOT_FOUND, { assetType: asset.assetType });
  }
  
  if (config.method === DepreciationMethod.STRAIGHT_LINE) {
    const residualValue = asset.originalValue * config.residualRate;
    const depreciableValue = asset.originalValue - residualValue;
    const monthlyDepreciation = depreciableValue / config.usefulLifeMonths;
    return {
      method: '直线法',
      usefulLifeMonths: config.usefulLifeMonths,
      residualRate: config.residualRate,
      residualValue: Math.round(residualValue * 100) / 100,
      depreciableValue: Math.round(depreciableValue * 100) / 100,
      monthlyDepreciation: Math.round(monthlyDepreciation * 100) / 100
    };
  }
  
  return null;
}

function calculateAccumulatedDepreciation(asset, toDate = new Date()) {
  const config = getDepreciationConfig(asset.assetType);
  if (!config) {
    throw createError(EC.DEPRECIATION_CONFIG_NOT_FOUND, { assetType: asset.assetType });
  }
  
  const purchaseDate = new Date(asset.purchaseDate);
  const endDate = new Date(toDate);
  
  const monthsDiff = Math.max(0, 
    (endDate.getFullYear() - purchaseDate.getFullYear()) * 12 + 
    (endDate.getMonth() - purchaseDate.getMonth())
  );
  
  const actualMonths = Math.min(monthsDiff, config.usefulLifeMonths);
  const monthlyCalc = calculateMonthlyDepreciation(asset);
  const accumulated = monthlyCalc.monthlyDepreciation * actualMonths;
  const netBookValue = asset.originalValue - accumulated;
  
  return {
    ...monthlyCalc,
    monthsDepreciated: actualMonths,
    totalMonths: config.usefulLifeMonths,
    accumulatedDepreciation: Math.round(accumulated * 100) / 100,
    netBookValue: Math.max(0, Math.round(netBookValue * 100) / 100),
    isFullyDepreciated: actualMonths >= config.usefulLifeMonths
  };
}

function getDepreciationByDepartment(date = new Date()) {
  const byDepartment = {};
  
  storage.assets.forEach(asset => {
    const dep = calculateAccumulatedDepreciation(asset, date);
    const dept = asset.depreciationDepartment;
    
    if (!byDepartment[dept]) {
      byDepartment[dept] = {
        department: dept,
        assetCount: 0,
        originalValue: 0,
        accumulatedDepreciation: 0,
        netBookValue: 0,
        monthlyDepreciation: 0,
        assets: []
      };
    }
    
    byDepartment[dept].assetCount++;
    byDepartment[dept].originalValue += asset.originalValue;
    byDepartment[dept].accumulatedDepreciation += dep.accumulatedDepreciation;
    byDepartment[dept].netBookValue += dep.netBookValue;
    byDepartment[dept].monthlyDepreciation += dep.monthlyDepreciation;
    byDepartment[dept].assets.push({
      id: asset.id,
      assetNo: asset.assetNo,
      assetType: asset.assetType,
      responsiblePerson: asset.responsiblePerson,
      department: asset.department,
      originalValue: asset.originalValue,
      accumulatedDepreciation: dep.accumulatedDepreciation,
      netBookValue: dep.netBookValue,
      monthlyDepreciation: dep.monthlyDepreciation
    });
  });
  
  return Object.values(byDepartment).map(d => ({
    ...d,
    originalValue: Math.round(d.originalValue * 100) / 100,
    accumulatedDepreciation: Math.round(d.accumulatedDepreciation * 100) / 100,
    netBookValue: Math.round(d.netBookValue * 100) / 100,
    monthlyDepreciation: Math.round(d.monthlyDepreciation * 100) / 100
  }));
}

module.exports = {
  getDepreciationConfig,
  calculateMonthlyDepreciation,
  calculateAccumulatedDepreciation,
  getDepreciationByDepartment
};

export const roundAmount = (amount, decimals = 2) => {
  return Math.round(amount * Math.pow(10, decimals)) / Math.pow(10, decimals);
};

export const calculateInterest = (principal, annualRate, days, ruleType = 'actual/365') => {
  let daysInYear;
  switch (ruleType) {
    case 'actual/360':
      daysInYear = 360;
      break;
    case '30/360':
      daysInYear = 360;
      break;
    case 'actual/365':
    default:
      daysInYear = 365;
  }
  
  const interest = principal * (annualRate / 100) * (days / daysInYear);
  return roundAmount(interest);
};

export const calculateManagementFee = (principal, managementFeeRate, days, calculationMethod = 'daily_accrual') => {
  let fee;
  
  switch (calculationMethod) {
    case 'daily_accrual':
      fee = principal * (managementFeeRate / 100) * (days / 365);
      break;
    case 'maturity_deduction':
      fee = principal * (managementFeeRate / 100);
      break;
    case 'upfront':
      fee = principal * (managementFeeRate / 100);
      break;
    default:
      fee = principal * (managementFeeRate / 100) * (days / 365);
  }
  
  return roundAmount(fee);
};

export const calculateRedemptionFee = (principal, redemptionFeeRate, holdingDays, calculationMethod = 'fixed') => {
  let fee;
  
  if (calculationMethod === 'tiered') {
    if (holdingDays <= 7) {
      fee = principal * 0.015;
    } else if (holdingDays <= 30) {
      fee = principal * 0.0075;
    } else if (holdingDays <= 90) {
      fee = principal * 0.005;
    } else {
      fee = principal * (redemptionFeeRate / 100);
    }
  } else {
    fee = principal * (redemptionFeeRate / 100);
  }
  
  return roundAmount(fee);
};

export const calculateNetPayout = (principal, interest, managementFee, redemptionFee) => {
  return roundAmount(principal + interest - managementFee - redemptionFee);
};

export const calculateDifference = (expected, actual) => {
  return roundAmount(actual - expected);
};

export const getDifferenceType = (expected, actual, tolerance = 0.01) => {
  if (actual === null || actual === undefined) {
    return 'unmatched';
  }
  
  const diff = actual - expected;
  
  if (Math.abs(diff) <= tolerance) {
    return 'matched';
  } else if (diff < 0) {
    return 'underpaid';
  } else {
    return 'overpaid';
  }
};

export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

export const formatPercentage = (rate) => {
  return `${rate.toFixed(2)}%`;
};

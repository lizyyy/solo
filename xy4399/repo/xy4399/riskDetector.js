const { calculateRatios, normalizeToUnity } = require('./oxideCalculator');

const RISK_CONFIG = {
  boron: {
    min: 0.05,
    max: 0.5,
    weight: 1
  },
  alkali: {
    min: 0.2,
    max: 0.8,
    weight: 1
  },
  aluminaSilica: {
    min: 3,
    max: 15,
    weight: 1
  },
  positionTemp: {
    maxDiff: 50,
    weight: 1
  }
};

function detectOxideRisks(oxideMolars) {
  const risks = [];
  const ratios = calculateRatios(oxideMolars);
  
  if (ratios.boronRatio < RISK_CONFIG.boron.min) {
    risks.push({
      type: 'boron_low',
      severity: 'medium',
      message: `硼氧化物比例偏低: ${(ratios.boronRatio * 100).toFixed(1)}%`,
      details: {
        ratio: ratios.boronRatio,
        min: RISK_CONFIG.boron.min,
        max: RISK_CONFIG.boron.max
      }
    });
  } else if (ratios.boronRatio > RISK_CONFIG.boron.max) {
    risks.push({
      type: 'boron_high',
      severity: 'high',
      message: `硼氧化物比例偏高: ${(ratios.boronRatio * 100).toFixed(1)}%`,
      details: {
        ratio: ratios.boronRatio,
        min: RISK_CONFIG.boron.min,
        max: RISK_CONFIG.boron.max
      }
    });
  }
  
  if (ratios.alkaliRatio < RISK_CONFIG.alkali.min) {
    risks.push({
      type: 'alkali_low',
      severity: 'medium',
      message: `碱金属比例偏低: ${(ratios.alkaliRatio * 100).toFixed(1)}%`,
      details: {
        ratio: ratios.alkaliRatio,
        min: RISK_CONFIG.alkali.min,
        max: RISK_CONFIG.alkali.max
      }
    });
  } else if (ratios.alkaliRatio > RISK_CONFIG.alkali.max) {
    risks.push({
      type: 'alkali_high',
      severity: 'medium',
      message: `碱金属比例偏高: ${(ratios.alkaliRatio * 100).toFixed(1)}%`,
      details: {
        ratio: ratios.alkaliRatio,
        min: RISK_CONFIG.alkali.min,
        max: RISK_CONFIG.alkali.max
      }
    });
  }
  
  if (ratios.aluminaSilicaRatio < RISK_CONFIG.aluminaSilica.min && ratios.aluminaSilicaRatio !== Infinity) {
    risks.push({
      type: 'alumina_silica_low',
      severity: 'high',
      message: `铝硅比偏低: ${ratios.aluminaSilicaRatio.toFixed(2)}`,
      details: {
        ratio: ratios.aluminaSilicaRatio,
        min: RISK_CONFIG.aluminaSilica.min,
        max: RISK_CONFIG.aluminaSilica.max
      }
    });
  } else if (ratios.aluminaSilicaRatio > RISK_CONFIG.aluminaSilica.max) {
    risks.push({
      type: 'alumina_silica_high',
      severity: 'medium',
      message: `铝硅比偏高: ${ratios.aluminaSilicaRatio.toFixed(2)}`,
      details: {
        ratio: ratios.aluminaSilicaRatio,
        min: RISK_CONFIG.aluminaSilica.min,
        max: RISK_CONFIG.aluminaSilica.max
      }
    });
  }
  
  return risks;
}

function detectPositionRisks(samples) {
  const risks = {};
  
  const positionsWithTemp = samples.filter(s => s.position_temp !== null && s.position_temp !== undefined);
  
  if (positionsWithTemp.length < 2) {
    return {};
  }
  
  const temps = positionsWithTemp.map(s => s.position_temp);
  const maxTemp = Math.max(...temps);
  const minTemp = Math.min(...temps);
  const tempDiff = maxTemp - minTemp;
  
  if (tempDiff > RISK_CONFIG.positionTemp.maxDiff) {
    for (const sample of positionsWithTemp) {
      if (!risks[sample.id]) {
        risks[sample.id] = [];
      }
      
      const deviation = sample.position_temp - minTemp;
      risks[sample.id].push({
        type: 'position_temp_variation',
        severity: 'medium',
        message: `窑位温差较大: ${tempDiff.toFixed(0)}°C`,
        details: {
          maxTemp,
          minTemp,
          tempDiff,
          sampleTemp: sample.position_temp,
          deviation: deviation
        }
      });
    }
  }
  
  return risks;
}

function getRiskPriority(risk) {
  const severityOrder = { high: 3, medium: 2, low: 1 };
  return severityOrder[risk.severity] || 0;
}

function sortRisksBySeverity(risks) {
  return [...risks].sort((a, b) => getRiskPriority(b) - getRiskPriority(a));
}

function applyRiskOverride(risks, overrides) {
  const overrideMap = {};
  for (const override of overrides) {
    overrideMap[override.type] = override;
  }
  
  return risks.filter(risk => {
    const override = overrideMap[risk.type];
    if (override && override.action === 'dismiss') {
      return false;
    }
    if (override && override.newSeverity) {
      risk.severity = override.newSeverity;
      risk.overridden = true;
    }
    return true;
  });
}

module.exports = {
  detectOxideRisks,
  detectPositionRisks,
  sortRisksBySeverity,
  applyRiskOverride,
  RISK_CONFIG
};

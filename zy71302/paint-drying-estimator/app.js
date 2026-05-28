const PAINT_TYPES = {
  watercolor: {
    name: '水彩',
    D_base: 5.0e-13,
    E_a: 35000,
    humidity_alpha: 0.8,
    category: 'water',
    typicalThicknessUm: [5, 200],
  },
  acrylic: {
    name: '丙烯',
    D_base: 7.0e-13,
    E_a: 42000,
    humidity_alpha: 0.7,
    category: 'water',
    typicalThicknessUm: [50, 3000],
  },
  oil: {
    name: '油画',
    D_base: 6.5e-14,
    E_a: 50000,
    humidity_alpha: 0.3,
    category: 'oil',
    typicalThicknessUm: [100, 5000],
  },
  gouache: {
    name: '水粉',
    D_base: 6.0e-13,
    E_a: 37000,
    humidity_alpha: 0.8,
    category: 'water',
    typicalThicknessUm: [50, 500],
  },
  tempera: {
    name: '蛋彩',
    D_base: 5.5e-13,
    E_a: 39000,
    humidity_alpha: 0.75,
    category: 'water',
    typicalThicknessUm: [30, 400],
  },
  ink: {
    name: '墨汁',
    D_base: 8.0e-13,
    E_a: 35000,
    humidity_alpha: 0.85,
    category: 'water',
    typicalThicknessUm: [2, 50],
  },
};

const THICKNESS_UNITS = {
  um: { name: 'μm (微米)', toUm: 1 },
  mm: { name: 'mm (毫米)', toUm: 1000 },
  mil: { name: 'mil (密耳)', toUm: 25.4 },
};

const VENTILATION_LEVELS = [
  { value: 0, label: '无通风(静止空气)', factor: 1.0 },
  { value: 1, label: '轻微通风', factor: 1.15 },
  { value: 2, label: '中等通风', factor: 1.30 },
  { value: 3, label: '强通风(风扇/户外)', factor: 1.50 },
];

const R_GAS = 8.314;
const T_REF = 293.15;

const TEMP_BOUNDARIES = {
  critical_low: -10,
  freeze: 0,
  slow_low: 5,
  normal_low: 15,
  normal_high: 35,
  warn_high: 40,
  critical_high: 60,
};

const HUMIDITY_BOUNDARIES = {
  very_dry: 10,
  normal_low: 30,
  normal_high: 70,
  slow_high: 85,
  critical_high: 95,
};

function validateThickness(value, unit) {
  const errors = [];
  const warnings = [];
  let umValue = null;

  if (value === null || value === undefined || value === '') {
    errors.push({ field: 'thickness', level: 'critical', message: '涂层厚度不能为空' });
    return { umValue, errors, warnings };
  }

  const numVal = Number(value);
  if (isNaN(numVal)) {
    errors.push({ field: 'thickness', level: 'critical', message: '涂层厚度必须为数值' });
    return { umValue, errors, warnings };
  }

  if (numVal <= 0) {
    errors.push({ field: 'thickness', level: 'critical', message: '涂层厚度必须大于零' });
    return { umValue, errors, warnings };
  }

  const unitDef = THICKNESS_UNITS[unit];
  if (!unitDef) {
    errors.push({ field: 'thickness', level: 'critical', message: `未知厚度单位: ${unit}` });
    return { umValue, errors, warnings };
  }

  umValue = numVal * unitDef.toUm;

  if (umValue > 10000) {
    warnings.push({
      field: 'thickness',
      level: 'warning',
      message: `厚度 ${umValue.toFixed(1)} μm 极大，扩散模型可能不适用（适用范围通常 < 5000 μm）`,
    });
  } else if (umValue > 3000) {
    warnings.push({
      field: 'thickness',
      level: 'warning',
      message: `厚度 ${umValue.toFixed(1)} μm 较大，干燥时间可能因表皮结膜效应而偏短`,
    });
  }

  if (umValue < 1) {
    warnings.push({
      field: 'thickness',
      level: 'warning',
      message: `厚度 ${umValue.toFixed(2)} μm 极薄，实际干燥可能快于模型预测`,
    });
  }

  return { umValue, errors, warnings };
}

function validateTemperature(valueCelsius) {
  const errors = [];
  const warnings = [];

  if (valueCelsius === null || valueCelsius === undefined || valueCelsius === '') {
    errors.push({ field: 'temperature', level: 'critical', message: '温度不能为空' });
    return { valueCelsius: null, errors, warnings };
  }

  const numVal = Number(valueCelsius);
  if (isNaN(numVal)) {
    errors.push({ field: 'temperature', level: 'critical', message: '温度必须为数值' });
    return { valueCelsius: null, errors, warnings };
  }

  const b = TEMP_BOUNDARIES;

  if (numVal < b.critical_low) {
    errors.push({
      field: 'temperature',
      level: 'critical',
      message: `温度 ${numVal}°C 低于模型下限 (${b.critical_low}°C)，扩散近似不再适用`,
    });
  } else if (numVal < b.freeze) {
    errors.push({
      field: 'temperature',
      level: 'critical',
      message: `温度 ${numVal}°C 低于冰点，水分基颜料可能冻结，模型结果不可靠`,
    });
  } else if (numVal < b.slow_low) {
    warnings.push({
      field: 'temperature',
      level: 'warning',
      message: `温度 ${numVal}°C 偏低，干燥显著变慢，成膜质量可能受影响`,
    });
  } else if (numVal > b.critical_high) {
    errors.push({
      field: 'temperature',
      level: 'critical',
      message: `温度 ${numVal}°C 超过模型上限 (${b.critical_high}°C)，颜料可能变质或起泡`,
    });
  } else if (numVal > b.warn_high) {
    warnings.push({
      field: 'temperature',
      level: 'warning',
      message: `温度 ${numVal}°C 偏高，颜料可能表皮结膜或挥发过快导致龟裂`,
    });
  }

  return { valueCelsius: numVal, errors, warnings };
}

function validateHumidity(value) {
  const errors = [];
  const warnings = [];

  if (value === null || value === undefined || value === '') {
    errors.push({
      field: 'humidity',
      level: 'critical',
      message: '湿度缺失！不输入湿度将无法得到可靠结论，请勿跳过此项',
    });
    return { valuePercent: null, valueFraction: null, errors, warnings };
  }

  const numVal = Number(value);
  if (isNaN(numVal)) {
    errors.push({ field: 'humidity', level: 'critical', message: '湿度必须为数值' });
    return { valuePercent: null, valueFraction: null, errors, warnings };
  }

  if (numVal < 0 || numVal > 100) {
    errors.push({
      field: 'humidity',
      level: 'critical',
      message: `湿度 ${numVal}% 超出物理范围 (0-100%)`,
    });
    return { valuePercent: numVal, valueFraction: null, errors, warnings };
  }

  const b = HUMIDITY_BOUNDARIES;

  if (numVal > b.critical_high) {
    errors.push({
      field: 'humidity',
      level: 'critical',
      message: `湿度 ${numVal}% 极高，水分基颜料几乎无法干燥，模型无意义`,
    });
  } else if (numVal > b.slow_high) {
    warnings.push({
      field: 'humidity',
      level: 'warning',
      message: `湿度 ${numVal}% 偏高，干燥将非常缓慢，水基颜料有霉变风险`,
    });
  } else if (numVal < b.very_dry) {
    warnings.push({
      field: 'humidity',
      level: 'warning',
      message: `湿度 ${numVal}% 极低，颜料表皮可能过快干燥导致龟裂或起皮`,
    });
  }

  return { valuePercent: numVal, valueFraction: numVal / 100, errors, warnings };
}

function computeDryingTime(paintType, thicknessUm, tempCelsius, humidityFraction, ventilationLevel) {
  const paint = PAINT_TYPES[paintType];
  if (!paint) {
    return { timeSeconds: null, error: '未知颜料类型' };
  }

  const thicknessM = thicknessUm * 1e-6;
  const tempK = tempCelsius + 273.15;

  const fT = Math.exp((paint.E_a / R_GAS) * (1 / T_REF - 1 / tempK));

  let fRH;
  if (humidityFraction === null || humidityFraction === undefined) {
    fRH = null;
  } else if (humidityFraction >= 1.0) {
    fRH = 1e-4;
  } else {
    fRH = Math.pow(1 - humidityFraction, paint.humidity_alpha);
  }

  const ventDef = VENTILATION_LEVELS.find((v) => v.value === ventilationLevel);
  const fV = ventDef ? ventDef.factor : 1.0;

  if (fRH === null) {
    return {
      timeSeconds: null,
      fT,
      fRH: null,
      fV,
      error: '湿度缺失，无法计算',
      formula: {
        D_base: paint.D_base,
        D_temp: paint.D_base * fT,
        thicknessUm,
        thicknessM,
        tempK,
        humidityFraction,
        ventilationFactor: fV,
        temperatureFactor: fT,
      },
    };
  }

  const D_eff = paint.D_base * fT * fRH * fV;
  const timeSeconds = (thicknessM * thicknessM) / (Math.PI * Math.PI * D_eff);

  return {
    timeSeconds,
    D_eff,
    fT,
    fRH,
    fV,
    formula: {
      D_base: paint.D_base,
      D_temp: paint.D_base * fT,
      D_eff,
      thicknessUm,
      thicknessM,
      tempK,
      humidityFraction,
      ventilationFactor: fV,
      temperatureFactor: fT,
      humidityFactor: fRH,
    },
  };
}

function formatTime(seconds) {
  if (seconds === null || seconds === undefined || isNaN(seconds)) return '—';
  if (seconds < 0) return '—';
  if (seconds < 60) return `${seconds.toFixed(1)} 秒`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)} 分钟`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)} 小时`;
  if (seconds < 86400 * 30) return `${(seconds / 86400).toFixed(1)} 天`;
  return `${(seconds / 86400).toFixed(0)} 天`;
}

function formatTimeDetailed(seconds) {
  if (seconds === null || seconds === undefined || isNaN(seconds)) return '—';
  if (seconds < 0) return '—';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const parts = [];
  if (days > 0) parts.push(`${days}天`);
  if (hours > 0) parts.push(`${hours}小时`);
  if (mins > 0) parts.push(`${mins}分`);
  if (secs > 0 && days === 0) parts.push(`${secs}秒`);
  return parts.join(' ') || '0秒';
}

function getRiskLevel(errors, warnings) {
  if (errors && errors.length > 0) {
    const hasCritical = errors.some((e) => e.level === 'critical');
    if (hasCritical) return 'critical';
    return 'warning';
  }
  if (warnings && warnings.length > 0) return 'warning';
  return 'normal';
}

function getRiskLabel(level) {
  switch (level) {
    case 'critical':
      return '🔴 不可靠';
    case 'warning':
      return '🟡 需谨慎';
    case 'normal':
      return '🟢 正常';
    default:
      return '—';
  }
}

function runEstimation(params) {
  const allErrors = [];
  const allWarnings = [];

  const thickResult = validateThickness(params.thickness, params.thicknessUnit);
  allErrors.push(...thickResult.errors);
  allWarnings.push(...thickResult.warnings);

  const tempResult = validateTemperature(params.temperature);
  allErrors.push(...tempResult.errors);
  allWarnings.push(...tempResult.warnings);

  const humResult = validateHumidity(params.humidity);
  allErrors.push(...humResult.errors);
  allWarnings.push(...humResult.warnings);

  const canCompute =
    thickResult.umValue !== null &&
    tempResult.valueCelsius !== null &&
    humResult.valueFraction !== null;

  let computation = null;
  if (canCompute) {
    computation = computeDryingTime(
      params.paintType,
      thickResult.umValue,
      tempResult.valueCelsius,
      humResult.valueFraction,
      params.ventilation || 0,
    );
  }

  const riskLevel = getRiskLevel(allErrors, allWarnings);

  return {
    params,
    thickResult,
    tempResult,
    humResult,
    computation,
    allErrors,
    allWarnings,
    riskLevel,
    riskLabel: getRiskLabel(riskLevel),
    timestamp: new Date().toISOString(),
  };
}

function generateReport(results) {
  const lines = [];
  lines.push('═══════════════════════════════════════════');
  lines.push('        颜料干燥时间估算报告');
  lines.push('═══════════════════════════════════════════');
  lines.push(`生成时间: ${new Date().toLocaleString('zh-CN')}`);
  lines.push(`报告版本: v1.0`);
  lines.push('');

  results.forEach((r, i) => {
    lines.push(`───────────────────────────────────────────`);
    lines.push(`情景 ${i + 1}${r.params.scenarioName ? ': ' + r.params.scenarioName : ''}`);
    lines.push(`───────────────────────────────────────────`);
    const paint = PAINT_TYPES[r.params.paintType];
    lines.push(`颜料类型: ${paint ? paint.name : r.params.paintType}`);
    lines.push(
      `涂层厚度: ${r.params.thickness} ${THICKNESS_UNITS[r.params.thicknessUnit]?.name || r.params.thicknessUnit}${r.thickResult.umValue !== null ? ' = ' + r.thickResult.umValue.toFixed(1) + ' μm' : ''}`,
    );
    lines.push(`温度: ${r.params.temperature}°C`);
    lines.push(
      `湿度: ${r.params.humidity !== null && r.params.humidity !== undefined && r.params.humidity !== '' ? r.params.humidity + '%' : '缺失'}`,
    );
    const vent = VENTILATION_LEVELS.find((v) => v.value === (r.params.ventilation || 0));
    lines.push(`通风: ${vent ? vent.label : '未知'}`);
    lines.push(`风险等级: ${r.riskLabel}`);
    lines.push('');

    if (r.computation && r.computation.timeSeconds !== null) {
      lines.push(`【估算结果】`);
      lines.push(`  干燥时间(近似): ${formatTime(r.computation.timeSeconds)}`);
      lines.push(`  干燥时间(详细): ${formatTimeDetailed(r.computation.timeSeconds)}`);
      lines.push(`  干燥时间(秒):   ${r.computation.timeSeconds.toFixed(2)} s`);
      lines.push('');
      lines.push(`【计算细节】`);
      lines.push(`  基础扩散系数 D₀ = ${r.computation.formula.D_base.toExponential(3)} m²/s`);
      lines.push(`  温度修正因子 f(T) = ${r.computation.formula.temperatureFactor.toFixed(4)}`);
      if (r.computation.formula.humidityFactor !== undefined) {
        lines.push(`  湿度修正因子 f(RH) = ${r.computation.formula.humidityFactor.toFixed(4)}`);
      }
      lines.push(`  通风修正因子 f(V) = ${r.computation.formula.ventilationFactor.toFixed(4)}`);
      lines.push(`  有效扩散系数 D_eff = ${r.computation.formula.D_eff.toExponential(3)} m²/s`);
      lines.push(`  膜厚(米): ${r.computation.formula.thicknessM.toExponential(3)} m`);
      lines.push('');
      lines.push(`  公式: t = h² / (π² × D_eff)`);
    } else {
      lines.push(`【估算结果】无法计算 — 参数不完整或越界`);
    }

    lines.push('');
    if (r.allErrors.length > 0) {
      lines.push(`【错误】`);
      r.allErrors.forEach((e) => lines.push(`  🔴 ${e.message}`));
    }
    if (r.allWarnings.length > 0) {
      lines.push(`【警告】`);
      r.allWarnings.forEach((w) => lines.push(`  🟡 ${w.message}`));
    }
    if (r.allErrors.length === 0 && r.allWarnings.length === 0) {
      lines.push(`【提示】所有参数在正常范围内`);
    }
    lines.push('');
  });

  lines.push('═══════════════════════════════════════════');
  lines.push('免责声明: 本估算基于一维扩散近似模型，');
  lines.push('实际干燥受基材吸水、颜料成分、涂布方式');
  lines.push('等多因素影响，结果仅供参考。');
  lines.push('═══════════════════════════════════════════');

  return lines.join('\n');
}

function generateCSV(results) {
  const headers = [
    '情景名称',
    '颜料类型',
    '厚度(原始)',
    '厚度单位',
    '厚度(μm)',
    '温度(°C)',
    '湿度(%)',
    '通风等级',
    '风险等级',
    '干燥时间(秒)',
    '干燥时间(可读)',
    'D_eff(m²/s)',
    'f(T)',
    'f(RH)',
    'f(V)',
    '错误',
    '警告',
  ];
  const rows = results.map((r) => {
    const paint = PAINT_TYPES[r.params.paintType];
    const vent = VENTILATION_LEVELS.find((v) => v.value === (r.params.ventilation || 0));
    return [
      r.params.scenarioName || '',
      paint ? paint.name : r.params.paintType,
      r.params.thickness,
      r.params.thicknessUnit,
      r.thickResult.umValue !== null ? r.thickResult.umValue.toFixed(1) : '',
      r.params.temperature,
      r.params.humidity !== null && r.params.humidity !== undefined && r.params.humidity !== ''
        ? r.params.humidity
        : '',
      vent ? vent.label : '',
      r.riskLabel,
      r.computation && r.computation.timeSeconds !== null
        ? r.computation.timeSeconds.toFixed(2)
        : '',
      r.computation && r.computation.timeSeconds !== null
        ? formatTime(r.computation.timeSeconds)
        : '',
      r.computation && r.computation.formula.D_eff
        ? r.computation.formula.D_eff.toExponential(3)
        : '',
      r.computation && r.computation.formula.temperatureFactor
        ? r.computation.formula.temperatureFactor.toFixed(4)
        : '',
      r.computation && r.computation.formula.humidityFactor !== undefined
        ? r.computation.formula.humidityFactor.toFixed(4)
        : '',
      r.computation && r.computation.formula.ventilationFactor
        ? r.computation.formula.ventilationFactor.toFixed(4)
        : '',
      r.allErrors.map((e) => e.message).join('; '),
      r.allWarnings.map((w) => w.message).join('; '),
    ];
  });
  return [headers, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
}

const STORAGE_KEY = 'paint_drying_estimator_schemes';
const CONFIG_KEY = 'paint_drying_estimator_config';

function saveSchemes(schemes) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(schemes));
    return true;
  } catch (e) {
    console.error('保存方案失败:', e);
    return false;
  }
}

function loadSchemes() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('加载方案失败:', e);
    return [];
  }
}

function saveConfig(config) {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    return true;
  } catch (e) {
    console.error('保存配置失败:', e);
    return false;
  }
}

function loadConfig() {
  try {
    const data = localStorage.getItem(CONFIG_KEY);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error('加载配置失败:', e);
    return null;
  }
}

function exportSchemesJSON(schemes) {
  const data = {
    version: '1.0',
    exportTime: new Date().toISOString(),
    schemes,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `颜料干燥方案_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importSchemesJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.schemes && Array.isArray(data.schemes)) {
          resolve(data.schemes);
        } else if (Array.isArray(data)) {
          resolve(data);
        } else {
          reject(new Error('无效的方案文件格式'));
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsText(file);
  });
}

let scenarios = [];
let schemes = loadSchemes();

function createDefaultScenario() {
  return {
    id: Date.now() + Math.random(),
    scenarioName: '',
    paintType: 'acrylic',
    thickness: '',
    thicknessUnit: 'um',
    temperature: '',
    humidity: '',
    ventilation: 0,
  };
}

function renderScenarioForm(scenario, index) {
  const paintOptions = Object.entries(PAINT_TYPES)
    .map(([key, val]) => `<option value="${key}" ${scenario.paintType === key ? 'selected' : ''}>${val.name}</option>`)
    .join('');

  const unitOptions = Object.entries(THICKNESS_UNITS)
    .map(([key, val]) => `<option value="${key}" ${scenario.thicknessUnit === key ? 'selected' : ''}>${val.name}</option>`)
    .join('');

  const ventOptions = VENTILATION_LEVELS.map(
    (v) => `<option value="${v.value}" ${scenario.ventilation === v.value ? 'selected' : ''}>${v.label}</option>`,
  ).join('');

  return `
    <div class="scenario-card" data-index="${index}">
      <div class="scenario-header">
        <span class="scenario-number">情景 ${index + 1}</span>
        <input type="text" class="scenario-name" placeholder="情景名称(可选)" value="${scenario.scenarioName || ''}" data-field="scenarioName" />
        ${scenarios.length > 1 ? `<button class="btn-remove" onclick="removeScenario(${index})" title="删除此情景">×</button>` : ''}
      </div>
      <div class="scenario-body">
        <div class="form-row">
          <div class="form-group">
            <label>颜料类型</label>
            <select data-field="paintType" onchange="onScenarioChange(${index})">${paintOptions}</select>
          </div>
          <div class="form-group">
            <label>通风条件</label>
            <select data-field="ventilation" onchange="onScenarioChange(${index})">${ventOptions}</select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>涂层厚度 <span class="unit-hint">值</span></label>
            <input type="number" step="any" min="0" placeholder="例如 100" value="${scenario.thickness}" data-field="thickness" oninput="onScenarioChange(${index})" />
          </div>
          <div class="form-group thin">
            <label>单位</label>
            <select data-field="thicknessUnit" onchange="onScenarioChange(${index})">${unitOptions}</select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>温度 (°C)</label>
            <input type="number" step="any" placeholder="例如 25" value="${scenario.temperature}" data-field="temperature" oninput="onScenarioChange(${index})" />
          </div>
          <div class="form-group">
            <label>湿度 (%) <span class="required-mark">*</span></label>
            <input type="number" step="any" min="0" max="100" placeholder="必填，0-100" value="${scenario.humidity}" data-field="humidity" oninput="onScenarioChange(${index})" />
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderAllScenarios() {
  const container = document.getElementById('scenarios-container');
  container.innerHTML = scenarios.map((s, i) => renderScenarioForm(s, i)).join('');
}

function addScenario() {
  scenarios.push(createDefaultScenario());
  renderAllScenarios();
  recalculate();
}

function removeScenario(index) {
  scenarios.splice(index, 1);
  renderAllScenarios();
  recalculate();
}

function onScenarioChange(index) {
  const card = document.querySelector(`.scenario-card[data-index="${index}"]`);
  if (!card) return;

  const getVal = (field) => {
    const el = card.querySelector(`[data-field="${field}"]`);
    if (!el) return scenarios[index][field];
    if (el.tagName === 'SELECT') return el.value;
    if (el.type === 'number') return el.value;
    return el.value;
  };

  scenarios[index].scenarioName = getVal('scenarioName');
  scenarios[index].paintType = getVal('paintType');
  scenarios[index].thickness = getVal('thickness');
  scenarios[index].thicknessUnit = getVal('thicknessUnit');
  scenarios[index].temperature = getVal('temperature');
  scenarios[index].humidity = getVal('humidity');
  scenarios[index].ventilation = parseInt(getVal('ventilation'), 10);

  recalculate();
}

function recalculate() {
  const results = scenarios.map((s) => runEstimation(s));
  renderResults(results);
}

function renderResults(results) {
  const container = document.getElementById('results-container');

  const hasComparableResults =
    results.filter((r) => r.computation && r.computation.timeSeconds !== null && r.riskLevel !== 'critical').length >=
      2;

  let html = '<div class="results-grid">';

  results.forEach((r, i) => {
    const riskClass = `risk-${r.riskLevel}`;
    html += `<div class="result-card ${riskClass}">`;
    html += `<div class="result-header">`;
    html += `<span class="result-number">情景 ${i + 1}${r.params.scenarioName ? ': ' + r.params.scenarioName : ''}</span>`;
    html += `<span class="result-risk ${riskClass}">${r.riskLabel}</span>`;
    html += `</div>`;

    if (r.computation && r.computation.timeSeconds !== null) {
      html += `<div class="result-time">${formatTime(r.computation.timeSeconds)}</div>`;
      html += `<div class="result-time-detail">${formatTimeDetailed(r.computation.timeSeconds)}</div>`;
    } else {
      html += `<div class="result-time no-result">无法计算</div>`;
    }

    html += `<div class="result-details">`;
    const paint = PAINT_TYPES[r.params.paintType];
    html += `<div class="detail-row"><span>颜料</span><span>${paint ? paint.name : r.params.paintType}</span></div>`;
    html += `<div class="detail-row"><span>厚度</span><span>${r.thickResult.umValue !== null ? r.thickResult.umValue.toFixed(1) + ' μm' : '—'}</span></div>`;
    html += `<div class="detail-row"><span>温度</span><span>${r.tempResult.valueCelsius !== null ? r.tempResult.valueCelsius + '°C' : '—'}</span></div>`;
    html += `<div class="detail-row"><span>湿度</span><span>${r.humResult.valuePercent !== null ? r.humResult.valuePercent + '%' : '缺失'}</span></div>`;
    if (r.computation && r.computation.formula) {
      html += `<div class="detail-row"><span>D_eff</span><span>${r.computation.formula.D_eff ? r.computation.formula.D_eff.toExponential(2) + ' m²/s' : '—'}</span></div>`;
    }
    html += `</div>`;

    if (r.allErrors.length > 0) {
      html += `<div class="result-errors">`;
      r.allErrors.forEach((e) => {
        html += `<div class="msg error">🔴 ${e.message}</div>`;
      });
      html += `</div>`;
    }
    if (r.allWarnings.length > 0) {
      html += `<div class="result-warnings">`;
      r.allWarnings.forEach((w) => {
        html += `<div class="msg warning">🟡 ${w.message}</div>`;
      });
      html += `</div>`;
    }

    html += `</div>`;
  });

  html += '</div>';

  if (hasComparableResults) {
    html += renderComparison(results);
  }

  container.innerHTML = html;
}

function renderComparison(results) {
  const valid = results.filter(
    (r) => r.computation && r.computation.timeSeconds !== null && r.riskLevel !== 'critical',
  );
  if (valid.length < 2) return '';

  const times = valid.map((r) => ({
    name: r.params.scenarioName || `情景${results.indexOf(r) + 1}`,
    seconds: r.computation.timeSeconds,
  }));

  const maxTime = Math.max(...times.map((t) => t.seconds));
  const minTime = Math.min(...times.map((t) => t.seconds));
  const ratio = maxTime / minTime;

  let html = '<div class="comparison-section">';
  html += '<h3>情景对比</h3>';
  html += '<div class="comparison-bars">';

  times.forEach((t) => {
    const pct = maxTime > 0 ? (t.seconds / maxTime) * 100 : 0;
    html += `<div class="comp-row">`;
    html += `<span class="comp-label">${t.name}</span>`;
    html += `<div class="comp-bar-bg"><div class="comp-bar" style="width:${pct}%"></div></div>`;
    html += `<span class="comp-value">${formatTime(t.seconds)}</span>`;
    html += `</div>`;
  });

  html += '</div>';
  html += `<div class="comparison-summary">`;
  html += `<p>最快: <strong>${times.find((t) => t.seconds === minTime).name}</strong> (${formatTime(minTime)})</p>`;
  html += `<p>最慢: <strong>${times.find((t) => t.seconds === maxTime).name}</strong> (${formatTime(maxTime)})</p>`;
  html += `<p>时间比: <strong>${ratio.toFixed(1)}x</strong></p>`;
  html += `</div>`;
  html += '</div>';

  return html;
}

function saveCurrentScheme() {
  const nameInput = document.getElementById('scheme-name');
  const name = nameInput.value.trim() || `方案 ${schemes.length + 1}`;

  const scheme = {
    id: Date.now(),
    name,
    timestamp: new Date().toISOString(),
    scenarios: JSON.parse(JSON.stringify(scenarios)),
  };

  schemes.push(scheme);
  saveSchemes(schemes);
  renderSchemesList();
  nameInput.value = '';
}

function loadScheme(id) {
  const scheme = schemes.find((s) => s.id === id);
  if (!scheme) return;
  scenarios = JSON.parse(JSON.stringify(scheme.scenarios));
  renderAllScenarios();
  recalculate();
}

function deleteScheme(id) {
  schemes = schemes.filter((s) => s.id !== id);
  saveSchemes(schemes);
  renderSchemesList();
}

function renderSchemesList() {
  const container = document.getElementById('schemes-list');
  if (schemes.length === 0) {
    container.innerHTML = '<p class="empty-hint">暂无保存的方案</p>';
    return;
  }
  container.innerHTML = schemes
    .map(
      (s) => `
    <div class="scheme-item">
      <div class="scheme-info">
        <span class="scheme-name">${s.name}</span>
        <span class="scheme-meta">${s.scenarios.length} 个情景 · ${new Date(s.timestamp).toLocaleDateString('zh-CN')}</span>
      </div>
      <div class="scheme-actions">
        <button onclick="loadScheme(${s.id})" title="加载此方案">加载</button>
        <button onclick="deleteScheme(${s.id})" class="btn-danger" title="删除此方案">删除</button>
      </div>
    </div>
  `,
    )
    .join('');
}

function exportReport() {
  const results = scenarios.map((s) => runEstimation(s));
  const text = generateReport(results);
  downloadText(text, `颜料干燥估算报告_${new Date().toISOString().slice(0, 10)}.txt`);
}

function exportCSV() {
  const results = scenarios.map((s) => runEstimation(s));
  const csv = '\uFEFF' + generateCSV(results);
  downloadText(csv, `颜料干燥估算数据_${new Date().toISOString().slice(0, 10)}.csv`);
}

function exportAllSchemes() {
  exportSchemesJSON(schemes);
}

function importSchemes() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const imported = await importSchemesJSON(file);
      imported.forEach((s) => {
        s.id = Date.now() + Math.random();
        schemes.push(s);
      });
      saveSchemes(schemes);
      renderSchemesList();
    } catch (err) {
      alert('导入失败: ' + err.message);
    }
  };
  input.click();
}

function downloadText(text, filename) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toggleFormula() {
  const el = document.getElementById('formula-panel');
  el.classList.toggle('collapsed');
}

function toggleSchemes() {
  const el = document.getElementById('schemes-panel');
  el.classList.toggle('collapsed');
}

function init() {
  scenarios = [createDefaultScenario()];

  const savedConfig = loadConfig();
  if (savedConfig && savedConfig.lastSchemeId) {
    const scheme = schemes.find((s) => s.id === savedConfig.lastSchemeId);
    if (scheme) {
      scenarios = JSON.parse(JSON.stringify(scheme.scenarios));
    }
  }

  renderAllScenarios();
  renderSchemesList();
  recalculate();
}

document.addEventListener('DOMContentLoaded', init);

import type {
  InputData,
  CalculationResult,
  CalculationStep,
  CalculationBreakdown,
  FeasibilityResult,
  FeasibilityIssue,
  BatchRecommendation,
  KeyAssumption,
  LayoutOption,
  ValidationError,
  DirtyDataRecord,
} from '../types';
import { LOSS_CALCULATION_RULES, COLOR_MATCH_THRESHOLDS } from '../config/defaults';

// 计算步骤ID生成器
let stepIdCounter = 0;
const generateStepId = () => `step-${++stepIdCounter}`;

// 计算面积（平方米）
const calculateArea = (widthCm: number, lengthCm: number): number => {
  return (widthCm * lengthCm) / 10000;
};



// 计算沿长度方向需要的瓷砖数量（考虑缝宽）
const calculateTilesAlongLength = (
  roomLength: number,
  tileLength: number,
  groutWidth: number
): number => {
  const effectiveTileLength = tileLength + groutWidth;
  const tiles = Math.ceil(roomLength / effectiveTileLength);
  return Math.max(tiles, 1);
};

// 创建计算步骤记录
const createCalculationStep = (
  title: string,
  description: string,
  inputs: Record<string, unknown>,
  success: boolean,
  outputs?: Record<string, unknown>,
  failureReason?: string
): CalculationStep => {
  return {
    id: generateStepId(),
    title,
    description,
    inputs,
    outputs,
    failureReason,
    success,
    timestamp: Date.now(),
  };
};

// 创建计算分解记录
const createBreakdown = (
  step: string,
  input: string,
  output: string,
  formula?: string
): CalculationBreakdown => {
  return {
    step,
    input,
    output,
    formula,
  };
};

// 主计算函数
export const calculateTileRequirements = (inputData: InputData): {
  result: CalculationResult;
  steps: CalculationStep[];
  breakdown: CalculationBreakdown[];
  assumptions: KeyAssumption[];
} => {
  const steps: CalculationStep[] = [];
  const breakdown: CalculationBreakdown[] = [];

  // 步骤1：验证输入数据
  steps.push(createCalculationStep(
    '验证输入数据',
    '检查所有输入参数的有效性和范围',
    {
      room: inputData.room,
      tile: inputData.tile,
      layoutDirection: inputData.layoutDirection,
    },
    true
  ));

  // 步骤2：计算房间面积
  steps.push(createCalculationStep(
    '计算房间面积',
    '根据房间尺寸计算总面积',
    {
      roomWidth: inputData.room.width,
      roomLength: inputData.room.length,
    },
    true
  ));

  const totalArea = calculateArea(inputData.room.width, inputData.room.length);
  breakdown.push(createBreakdown(
    '计算房间总面积',
    `房间宽度: ${inputData.room.width}cm, 房间长度: ${inputData.room.length}cm`,
    `总面积: ${totalArea.toFixed(2)}㎡`,
    `(宽度 × 长度) / 10000 = (${inputData.room.width} × ${inputData.room.length}) / 10000`
  ));

  // 步骤3：计算门洞/窗洞等扣除面积
  steps.push(createCalculationStep(
    '计算扣除面积',
    '计算需要扣除的门洞、窗洞等区域面积',
    { openings: inputData.openings },
    true
  ));

  let deductionArea = 0;
  inputData.openings.forEach((opening) => {
    const openingArea = calculateArea(opening.width, opening.height);
    deductionArea += openingArea;
    breakdown.push(createBreakdown(
      `计算门洞/窗洞面积 (${opening.type})`,
      `宽度: ${opening.width}cm, 高度: ${opening.height}cm`,
      `面积: ${openingArea.toFixed(2)}㎡`,
      `(宽度 × 高度) / 10000`
    ));
  });

  const netArea = totalArea - deductionArea;
  breakdown.push(createBreakdown(
    '计算净铺贴面积',
    `总面积: ${totalArea.toFixed(2)}㎡, 扣除面积: ${deductionArea.toFixed(2)}㎡`,
    `净面积: ${netArea.toFixed(2)}㎡`,
    '总面积 - 扣除面积'
  ));

  // 步骤4：计算基础瓷砖数量（不考虑损耗）
  steps.push(createCalculationStep(
    '计算基础瓷砖数量',
    '根据铺贴方向和图案计算理论需要的瓷砖数量',
    {
      tile: inputData.tile,
      layoutDirection: inputData.layoutDirection,
      layoutPattern: inputData.layoutPattern,
      groutWidth: inputData.groutWidth,
    },
    true
  ));

  let baseTiles = 0;

  if (inputData.layoutDirection === 'diagonal') {
    // 斜铺计算
    const diagonalTileLength = inputData.tile.width * LOSS_CALCULATION_RULES.diagonalMultiplier;
    const tilesX = calculateTilesAlongLength(inputData.room.width, diagonalTileLength, inputData.groutWidth);
    const tilesY = calculateTilesAlongLength(inputData.room.length, diagonalTileLength, inputData.groutWidth);
    baseTiles = tilesX * tilesY * 2; // 斜铺需要更多瓷砖

    breakdown.push(createBreakdown(
      '斜铺瓷砖数量计算',
      `瓷砖尺寸: ${inputData.tile.width}×${inputData.tile.height}cm, 对角线长度: ${diagonalTileLength.toFixed(1)}cm`,
      `基础数量: ${baseTiles}块`,
      `(房间长度/瓷砖对角线长度) × (房间宽度/瓷砖对角线长度) × 2`
    ));
  } else {
    // 正铺/竖铺计算
    const tileWidth = inputData.layoutDirection === 'vertical' ? inputData.tile.height : inputData.tile.width;
    const tileHeight = inputData.layoutDirection === 'vertical' ? inputData.tile.width : inputData.tile.height;

    const tilesX = calculateTilesAlongLength(inputData.room.width, tileWidth, inputData.groutWidth);
    const tilesY = calculateTilesAlongLength(inputData.room.length, tileHeight, inputData.groutWidth);
    baseTiles = tilesX * tilesY;

    breakdown.push(createBreakdown(
      '基础瓷砖数量计算',
      `瓷砖尺寸: ${tileWidth}×${tileHeight}cm, 缝宽: ${inputData.groutWidth}cm`,
      `基础数量: ${baseTiles}块`,
      `(房间宽度/(瓷砖宽度+缝宽)) × (房间长度/(瓷砖高度+缝宽)) = ${tilesX} × ${tilesY}`
    ));
  }

  // 考虑铺贴图案的额外损耗
  let patternMultiplier = 1;
  if (inputData.layoutPattern === 'brick') {
    patternMultiplier = LOSS_CALCULATION_RULES.brickPatternExtra;
    breakdown.push(createBreakdown(
      '工字铺图案调整',
      '采用工字铺铺贴图案',
      `增加 2% 损耗`,
      'patternMultiplier = 1.02'
    ));
  } else if (inputData.layoutPattern === 'herringbone') {
    patternMultiplier = LOSS_CALCULATION_RULES.herringboneExtra;
    breakdown.push(createBreakdown(
      '人字铺图案调整',
      '采用人字铺铺贴图案',
      `增加 15% 损耗`,
      'patternMultiplier = 1.15'
    ));
  }

  baseTiles = Math.ceil(baseTiles * patternMultiplier);

  // 步骤5：计算切割损耗
  steps.push(createCalculationStep(
    '计算切割损耗',
    '根据铺贴方式和房间形状计算切割损耗',
    {
      layoutDirection: inputData.layoutDirection,
      layoutPattern: inputData.layoutPattern,
      lossModel: inputData.lossModel,
      openings: inputData.openings,
    },
    true
  ));

  let lossPercentage = inputData.lossModel.standard;

  if (inputData.layoutDirection === 'diagonal') {
    lossPercentage += inputData.lossModel.diagonal;
    breakdown.push(createBreakdown(
      '斜铺额外损耗',
      '采用斜铺方式',
      `增加 ${inputData.lossModel.diagonal}% 损耗`,
      `standardLoss(${inputData.lossModel.standard}%) + diagonalExtra(${inputData.lossModel.diagonal}%)`
    ));
  }

  // 计算门洞等复杂形状的额外损耗
  if (inputData.openings.length > 0) {
    const complexShapesLoss = inputData.openings.length * 2;
    lossPercentage += complexShapesLoss;
    breakdown.push(createBreakdown(
      '复杂形状额外损耗',
      `存在 ${inputData.openings.length} 个门洞/窗洞`,
      `增加 ${complexShapesLoss}% 损耗`,
      `每个门洞增加 2% 损耗`
    ));
  }

  // 批次差异预留
  if (inputData.batchOptions.allowMultipleBatches) {
    lossPercentage += inputData.lossModel.batchDifference;
    breakdown.push(createBreakdown(
      '批次差异预留',
      '允许使用多个批次',
      `增加 ${inputData.lossModel.batchDifference}% 预留`,
      `预留批次色差和补货需求`
    ));
  }

  const lossTiles = Math.max(
    Math.ceil(baseTiles * (lossPercentage / 100)),
    LOSS_CALCULATION_RULES.minimumWasteTiles
  );

  breakdown.push(createBreakdown(
    '计算损耗瓷砖数量',
    `基础数量: ${baseTiles}块, 损耗率: ${lossPercentage}%`,
    `损耗瓷砖: ${lossTiles}块`,
    `baseTiles × (lossPercentage / 100) = ${baseTiles} × ${lossPercentage / 100}`
  ));

  // 步骤6：计算总需求
  steps.push(createCalculationStep(
    '计算总需求',
    '汇总基础数量和损耗，计算总需求和采购量',
    {
      baseTiles,
      lossTiles,
      tilesPerBox: inputData.tile.tilesPerBox,
      pricePerBox: inputData.tile.pricePerBox,
    },
    true
  ));

  const totalTilesNeeded = baseTiles + lossTiles;
  const boxesNeeded = Math.ceil(totalTilesNeeded / inputData.tile.tilesPerBox);
  const totalCost = boxesNeeded * inputData.tile.pricePerBox;
  const actualLossPercentage = (lossTiles / baseTiles) * 100;

  breakdown.push(createBreakdown(
    '计算总瓷砖需求',
    `基础数量: ${baseTiles}块, 损耗数量: ${lossTiles}块`,
    `总需求: ${totalTilesNeeded}块`,
    'baseTiles + lossTiles'
  ));

  breakdown.push(createBreakdown(
    '计算采购盒数',
    `总需求: ${totalTilesNeeded}块, 每盒: ${inputData.tile.tilesPerBox}块`,
    `需要: ${boxesNeeded}盒`,
    `ceil(${totalTilesNeeded} / ${inputData.tile.tilesPerBox})`
  ));

  breakdown.push(createBreakdown(
    '计算总费用',
    `盒数: ${boxesNeeded}, 每盒价格: ¥${inputData.tile.pricePerBox}`,
    `总费用: ¥${totalCost}`,
    `boxesNeeded × pricePerBox`
  ));

  // 步骤7：批次推荐
  steps.push(createCalculationStep(
    '批次推荐分析',
    '根据批次可用性和颜色匹配度推荐采购方案',
    {
      tileBatch: inputData.tile.batch,
      colorTolerance: inputData.batchOptions.colorTolerance,
      allowMultipleBatches: inputData.batchOptions.allowMultipleBatches,
    },
    true
  ));

  const batchRecommendations = generateBatchRecommendations(
    inputData.tile.batch || 'DEFAULT',
    totalTilesNeeded,
    inputData.tile.tilesPerBox,
    inputData.batchOptions.colorTolerance
  );

  // 步骤8：可行性分析
  steps.push(createCalculationStep(
    '可行性分析',
    '评估当前方案的可行性并识别潜在问题',
    {
      layoutDirection: inputData.layoutDirection,
      layoutPattern: inputData.layoutPattern,
      openings: inputData.openings,
      lossPercentage,
    },
    true
  ));

  const feasibility = calculateFeasibility(
    inputData,
    lossPercentage
  );

  // 关键假设
  const assumptions = generateKeyAssumptions(inputData);

  const result: CalculationResult = {
    totalArea,
    netArea,
    tilesNeeded: totalTilesNeeded,
    boxesNeeded,
    wasteTiles: lossTiles,
    wastePercentage: actualLossPercentage,
    totalCost,
    breakdown,
    batchRecommendations,
    feasibility,
    assumptions,
  };

  return {
    result,
    steps,
    breakdown,
    assumptions,
  };
};

// 生成批次推荐
export const generateBatchRecommendations = (
  primaryBatch: string,
  tilesNeeded: number,
  tilesPerBox: number,
  colorTolerance: number
): BatchRecommendation[] => {
  const recommendations: BatchRecommendation[] = [];
  const boxesNeeded = Math.ceil(tilesNeeded / tilesPerBox);

  // 主批次推荐
  recommendations.push({
    batchNumber: primaryBatch,
    tilesNeeded,
    boxesNeeded,
    colorMatchScore: 1,
    reasons: [
      '优先使用同一批次确保颜色一致性',
      '完全匹配所选样品颜色',
      '避免批次间色差问题',
    ],
  });

  // 备选批次（如果颜色容差允许）
  if (colorTolerance >= COLOR_MATCH_THRESHOLDS.acceptable) {
    const altBatch1 = primaryBatch.replace(/(\d+)$/, (match) => {
      const num = parseInt(match);
      return String(num + 1).padStart(match.length, '0');
    });

    recommendations.push({
      batchNumber: altBatch1,
      tilesNeeded,
      boxesNeeded,
      colorMatchScore: Math.max(0.7, 1 - colorTolerance * 2),
      reasons: [
        '相邻批次，颜色差异最小',
        `颜色容差: ${(colorTolerance * 100).toFixed(0)}%`,
        '建议混合使用时注意排版',
      ],
    });
  }

  if (colorTolerance >= COLOR_MATCH_THRESHOLDS.poor) {
    const altBatch2 = primaryBatch.replace(/(\d+)$/, (match) => {
      const num = parseInt(match);
      return String(num - 1).padStart(match.length, '0');
    });

    recommendations.push({
      batchNumber: altBatch2,
      tilesNeeded,
      boxesNeeded,
      colorMatchScore: Math.max(0.5, 1 - colorTolerance * 3),
      reasons: [
        '较早批次，可能存在颜色差异',
        '建议只在无法获取主批次时使用',
        '使用前需与样品对比确认',
      ],
    });
  }

  return recommendations;
};

// 计算可行性
export const calculateFeasibility = (
  inputData: InputData,
  lossPercentage: number
): FeasibilityResult => {
  const issues: FeasibilityIssue[] = [];
  let score = 100;

  // 检查损耗率是否过高
  if (lossPercentage > 20) {
    issues.push({
      type: 'warning',
      category: 'waste',
      message: `损耗率较高 (${lossPercentage.toFixed(1)}%)，建议优化铺贴方案`,
      suggestion: '考虑调整铺贴方向或使用更大尺寸的瓷砖',
      affectedFields: ['layoutDirection', 'tile'],
    });
    score -= 15;
  }

  // 检查斜铺的可行性
  if (inputData.layoutDirection === 'diagonal') {
    const roomRatio = Math.max(
      inputData.room.width / inputData.room.length,
      inputData.room.length / inputData.room.width
    );

    if (roomRatio > 2) {
      issues.push({
        type: 'warning',
        category: 'layout',
        message: '房间长宽比过大，斜铺可能导致边缘切割过多',
        suggestion: '建议考虑正铺或竖铺方式',
        affectedFields: ['layoutDirection'],
      });
      score -= 10;
    }
  }

  // 检查复杂形状
  if (inputData.openings.length > 2) {
    issues.push({
      type: 'info',
      category: 'dimension',
      message: `存在 ${inputData.openings.length} 个门洞/窗洞，切割损耗会增加`,
      suggestion: '建议现场放样后再精确计算',
      affectedFields: ['openings'],
    });
    score -= 5;
  }

  // 检查批次问题
  if (!inputData.batchOptions.allowMultipleBatches) {
    issues.push({
      type: 'warning',
      category: 'batch',
      message: '限制使用单一批次，可能存在补货困难风险',
      suggestion: '建议预留更多损耗或允许使用相邻批次',
      affectedFields: ['batchOptions'],
    });
    score -= 8;
  }

  // 检查人字铺的适用性
  if (inputData.layoutPattern === 'herringbone') {
    if (inputData.tile.width !== inputData.tile.height) {
      issues.push({
        type: 'critical',
        category: 'layout',
        message: '人字铺要求瓷砖长宽相等',
        suggestion: '请选择正方形瓷砖或更换铺贴图案',
        affectedFields: ['layoutPattern', 'tile'],
      });
      score = 0;
    }
  }

  // 检查瓷砖尺寸与房间比例
  const tileArea = (inputData.tile.width * inputData.tile.height) / 10000;
  const roomArea = (inputData.room.width * inputData.room.length) / 10000;
  const tileCoverage = tileArea / roomArea;

  if (tileCoverage < 0.001) {
    issues.push({
      type: 'info',
      category: 'dimension',
      message: '使用小尺寸瓷砖，铺贴工作量较大',
      suggestion: '考虑使用更大尺寸的瓷砖提高效率',
      affectedFields: ['tile'],
    });
  } else if (tileCoverage > 0.1) {
    issues.push({
      type: 'warning',
      category: 'dimension',
      message: '大尺寸瓷砖切割风险较高',
      suggestion: '确保施工人员具备大砖铺贴经验',
      affectedFields: ['tile'],
    });
    score -= 5;
  }

  return {
    isFeasible: score > 30,
    score,
    issues,
  };
};

// 生成关键假设
export const generateKeyAssumptions = (inputData: InputData): KeyAssumption[] => {
  return [
    {
      title: '标准损耗率假设',
      description: `采用 ${inputData.lossModel.standard}% 作为标准损耗率，这是行业经验值，适用于规则矩形空间的正铺铺贴`,
      impact: 'high',
      source: '行业标准',
      canBeModified: true,
    },
    {
      title: '斜铺额外损耗',
      description: `斜铺方式增加 ${inputData.lossModel.diagonal}% 的额外损耗，由于对角线切割导致边角料利用率降低`,
      impact: 'high',
      source: '数学计算 + 施工经验',
      canBeModified: true,
    },
    {
      title: '批次采购预留',
      description: `预留 ${inputData.lossModel.batchDifference}% 用于批次差异和补货需求，确保颜色一致性`,
      impact: 'medium',
      source: '供应链管理经验',
      canBeModified: true,
    },
    {
      title: '缝宽计算',
      description: `当前缝宽设置为 ${inputData.groutWidth}cm，计算时已考虑缝宽对瓷砖排布的影响`,
      impact: 'medium',
      source: '用户输入',
      canBeModified: true,
    },
    {
      title: '边角料利用',
      description: inputData.lossModel.wasteUsage
        ? '允许使用切割产生的边角料填充小块区域，可降低实际损耗'
        : '不使用切割边角料，所有切割部分视为损耗',
      impact: 'medium',
      source: '用户设置',
      canBeModified: true,
    },
    {
      title: '门洞扣除',
      description: '所有门洞、窗洞面积均已从总面积中扣除，但边缘切割损耗已纳入损耗计算',
      impact: 'low',
      source: '计算规则',
      canBeModified: false,
    },
  ];
};

// 验证输入数据
export const validateInputData = (inputData: InputData): ValidationError[] => {
  const errors: ValidationError[] = [];

  // 验证房间尺寸
  if (inputData.room.width <= 0) {
    errors.push({
      field: 'room.width',
      message: '房间宽度必须大于0',
      severity: 'error',
      value: inputData.room.width,
    });
  } else if (inputData.room.width < 100) {
    errors.push({
      field: 'room.width',
      message: '房间宽度似乎过小，请确认单位是否为厘米',
      severity: 'warning',
      value: inputData.room.width,
    });
  }

  if (inputData.room.length <= 0) {
    errors.push({
      field: 'room.length',
      message: '房间长度必须大于0',
      severity: 'error',
      value: inputData.room.length,
    });
  } else if (inputData.room.length < 100) {
    errors.push({
      field: 'room.length',
      message: '房间长度似乎过小，请确认单位是否为厘米',
      severity: 'warning',
      value: inputData.room.length,
    });
  }

  // 验证瓷砖尺寸
  if (inputData.tile.width <= 0 || inputData.tile.height <= 0) {
    errors.push({
      field: 'tile.dimensions',
      message: '瓷砖尺寸必须大于0',
      severity: 'error',
      value: `${inputData.tile.width}x${inputData.tile.height}`,
    });
  }

  if (inputData.tile.tilesPerBox <= 0) {
    errors.push({
      field: 'tile.tilesPerBox',
      message: '每盒瓷砖数量必须大于0',
      severity: 'error',
      value: inputData.tile.tilesPerBox,
    });
  }

  if (inputData.tile.pricePerBox < 0) {
    errors.push({
      field: 'tile.pricePerBox',
      message: '每盒价格不能为负数',
      severity: 'error',
      value: inputData.tile.pricePerBox,
    });
  }

  // 验证损耗模型
  if (inputData.lossModel.standard < 0 || inputData.lossModel.standard > 50) {
    errors.push({
      field: 'lossModel.standard',
      message: '标准损耗率应在0-50%之间',
      severity: 'warning',
      value: inputData.lossModel.standard,
    });
  }

  // 验证门洞尺寸
  inputData.openings.forEach((opening, index) => {
    if (opening.width <= 0 || opening.height <= 0) {
      errors.push({
        field: `openings[${index}].dimensions`,
        message: `第 ${index + 1} 个${opening.type === 'door' ? '门洞' : opening.type === 'window' ? '窗洞' : '洞口'}尺寸无效`,
        severity: 'error',
        value: `${opening.width}x${opening.height}`,
      });
    }

    if (opening.offsetX < 0 || opening.offsetX >= inputData.room.width) {
      errors.push({
        field: `openings[${index}].offsetX`,
        message: `第 ${index + 1} 个洞口X位置超出房间范围`,
        severity: 'warning',
        value: opening.offsetX,
      });
    }
  });

  // 验证缝宽
  if (inputData.groutWidth < 0 || inputData.groutWidth > 5) {
    errors.push({
      field: 'groutWidth',
      message: '缝宽应在0-5cm之间',
      severity: 'warning',
      value: inputData.groutWidth,
    });
  }

  return errors;
};

// 脏数据处理
export const processDirtyData = (
  field: string,
  value: string | number | boolean,
  source: string
): {
  cleaned: string | number | boolean;
  record?: DirtyDataRecord;
} => {
  // 对于boolean类型，直接返回，不需要处理
  if (typeof value === 'boolean') {
    return { cleaned: value };
  }

  const record: DirtyDataRecord = {
    id: `dirty-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    field,
    originalValue: value,
    source,
    timestamp: Date.now(),
    reason: '',
  };

  // 处理数值类型的脏数据
  if (typeof value === 'string') {
    // 移除非数字字符（保留小数点和负号）
    const cleaned = value.replace(/[^\d.-]/g, '');

    if (cleaned !== value) {
      const numValue = parseFloat(cleaned);
      if (!isNaN(numValue)) {
        record.correctedValue = numValue;
        record.reason = '移除了非数字字符';
        return { cleaned: numValue, record };
      }
    }

    // 尝试转换为数字
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      return { cleaned: numValue };
    }
  }

  // 检查负数
  if (typeof value === 'number' && value < 0) {
    record.correctedValue = Math.abs(value);
    record.reason = '负数转换为正数';
    return { cleaned: Math.abs(value), record };
  }

  return { cleaned: value };
};

// 生成铺贴方案选项
export const generateLayoutOptions = (
  inputData: InputData
): LayoutOption[] => {
  const options: LayoutOption[] = [];

  // 正铺方案
  options.push({
    id: 'horizontal-straight',
    name: '正铺（标准）',
    direction: 'horizontal',
    pattern: 'straight',
    estimatedWaste: inputData.lossModel.standard,
    advantages: ['施工简单', '损耗最小', '视觉效果开阔'],
    disadvantages: ['较为普通', '对房间比例敏感'],
    isRecommended: true,
  });

  // 竖铺方案
  options.push({
    id: 'vertical-straight',
    name: '竖铺',
    direction: 'vertical',
    pattern: 'straight',
    estimatedWaste: inputData.lossModel.standard,
    advantages: ['适合狭长空间', '视觉上拉伸空间'],
    disadvantages: ['可能增加边角切割'],
    isRecommended: false,
  });

  // 斜铺方案
  options.push({
    id: 'diagonal-straight',
    name: '斜铺（45度）',
    direction: 'diagonal',
    pattern: 'straight',
    estimatedWaste: inputData.lossModel.standard + inputData.lossModel.diagonal,
    advantages: ['空间感更强', '可以掩盖房间不方正'],
    disadvantages: ['损耗较大', '施工难度高'],
    isRecommended: false,
  });

  // 工字铺方案
  options.push({
    id: 'horizontal-brick',
    name: '工字铺',
    direction: 'horizontal',
    pattern: 'brick',
    estimatedWaste: inputData.lossModel.standard + 2,
    advantages: ['更有层次感', '适合长条砖'],
    disadvantages: ['排版要求高'],
    isRecommended: false,
  });

  // 人字铺（仅正方形瓷砖）
  if (inputData.tile.width === inputData.tile.height) {
    options.push({
      id: 'horizontal-herringbone',
      name: '人字铺',
      direction: 'horizontal',
      pattern: 'herringbone',
      estimatedWaste: inputData.lossModel.standard + 15,
      advantages: ['视觉效果独特', '高端大气'],
      disadvantages: ['损耗最大', '施工难度最高'],
      isRecommended: false,
    });
  }

  return options;
};

import type { PrintBatch, ValidationError, Unit, Material } from '../types';
import { detectUnitMixed, getUnitConversionTable } from './unitConverter';
import { getMaterialById } from '../data/materials';

interface TempDiffSignDetails {
  nozzleTemp: number;
  bedTemp: number;
  ambientTemp: number;
  correctGradient: string;
  currentGradient: string;
  signError: 'nozzle_bed' | 'bed_ambient' | 'both';
}

interface MaterialMissingDetails {
  missingFields: string[];
  fieldLabels: Record<string, string>;
  standardValues: Record<string, number | undefined>;
  materialId: string;
  materialName: string;
}

interface UnitMixedDetails {
  units: {
    width: { value: number; unit: Unit };
    height: { value: number; unit: Unit };
    depth: { value: number; unit: Unit };
  };
  conversionTable: ReturnType<typeof getUnitConversionTable>;
  targetUnit: Unit;
}

export const validateTempDiffSign = (
  nozzleTemp: number,
  bedTemp: number,
  ambientTemp: number,
): ValidationError | null => {
  const nozzleBedError = nozzleTemp < bedTemp;
  const bedAmbientError = bedTemp < ambientTemp;

  if (!nozzleBedError && !bedAmbientError) {
    return null;
  }

  let signError: 'nozzle_bed' | 'bed_ambient' | 'both' = 'nozzle_bed';
  if (nozzleBedError && bedAmbientError) {
    signError = 'both';
  } else if (bedAmbientError) {
    signError = 'bed_ambient';
  }

  const currentParts = [];
  if (nozzleBedError) {
    currentParts.push(`喷嘴(${nozzleTemp}°C) < 床温(${bedTemp}°C)`);
  }
  if (bedAmbientError) {
    currentParts.push(`床温(${bedTemp}°C) < 环境(${ambientTemp}°C)`);
  }

  const details: TempDiffSignDetails = {
    nozzleTemp,
    bedTemp,
    ambientTemp,
    correctGradient: `喷嘴 > 床温 > 环境 (应满足 ${nozzleTemp}°C > ${Math.max(bedTemp, ambientTemp + 1)}°C > ${ambientTemp}°C)`,
    currentGradient: currentParts.join('，'),
    signError,
  };

  return {
    type: 'temp_diff_sign',
    message: `温差符号错误：${currentParts.join('，')}。正确的温度梯度应为 喷嘴温度 > 床温 > 环境温度`,
    details: details as unknown as Record<string, unknown>,
    autoFixable: true,
  };
};

export const validateMaterialParams = (
  materialId: string,
): ValidationError | null => {
  const material = getMaterialById(materialId);

  if (!material) {
    return {
      type: 'material_missing',
      message: `未找到ID为"${materialId}"的材料参数`,
      details: {
        materialId,
        missingFields: ['全部参数'],
      } as unknown as Record<string, unknown>,
      autoFixable: false,
    };
  }

  const requiredFields: Array<keyof Material> = [
    'thermalExpansionCoeff',
    'glassTransitionTemp',
    'meltingTemp',
    'recommendedBedTemp',
    'recommendedNozzleTemp',
  ];

  const fieldLabels: Record<string, string> = {
    thermalExpansionCoeff: '热膨胀系数',
    glassTransitionTemp: '玻璃化转变温度',
    meltingTemp: '熔化温度',
    recommendedBedTemp: '推荐床温',
    recommendedNozzleTemp: '推荐喷嘴温度',
    adhesionStrength: '粘附力评级',
  };

  const missingFields: string[] = [];
  requiredFields.forEach((field) => {
    const value = material[field];
    if (value === undefined || value === null || value === 0) {
      missingFields.push(field);
    }
  });

  if (missingFields.length === 0) {
    return null;
  }

  const standardValues: Record<string, number | undefined> = {};
  missingFields.forEach((field) => {
    standardValues[field] = material[field as keyof Material] as number;
  });

  const details: MaterialMissingDetails = {
    missingFields,
    fieldLabels,
    standardValues,
    materialId,
    materialName: material.name,
  };

  const missingLabels = missingFields.map((f) => fieldLabels[f] || f).join('、');

  return {
    type: 'material_missing',
    message: `材料参数缺失：${material.name} 的 ${missingLabels} 参数无效或为0`,
    details: details as unknown as Record<string, unknown>,
    autoFixable: true,
  };
};

export const validateUnitMixed = (
  width: number,
  widthUnit: Unit,
  height: number,
  heightUnit: Unit,
  depth: number,
  depthUnit: Unit,
): ValidationError | null => {
  if (!detectUnitMixed(widthUnit, heightUnit, depthUnit)) {
    return null;
  }

  const conversionTable = getUnitConversionTable(
    width,
    widthUnit,
    height,
    heightUnit,
    depth,
    depthUnit,
  );

  const details: UnitMixedDetails = {
    units: {
      width: { value: width, unit: widthUnit },
      height: { value: height, unit: heightUnit },
      depth: { value: depth, unit: depthUnit },
    },
    conversionTable,
    targetUnit: 'mm',
  };

  return {
    type: 'unit_mixed',
    message: `尺寸单位混用：宽(${widthUnit})、高(${heightUnit})、深(${depthUnit}) 单位不一致`,
    details: details as unknown as Record<string, unknown>,
    autoFixable: true,
  };
};

export const validateAll = (batch: PrintBatch): ValidationError[] => {
  const errors: ValidationError[] = [];

  const tempDiffError = validateTempDiffSign(
    batch.nozzleTemp,
    batch.bedTemp,
    batch.ambientTemp,
  );
  if (tempDiffError) {
    errors.push(tempDiffError);
  }

  const materialError = validateMaterialParams(batch.materialId);
  if (materialError) {
    errors.push(materialError);
  }

  const unitError = validateUnitMixed(
    batch.modelWidth,
    batch.widthUnit,
    batch.modelHeight,
    batch.heightUnit,
    batch.modelDepth,
    batch.depthUnit,
  );
  if (unitError) {
    errors.push(unitError);
  }

  return errors;
};

export const fixTempDiffSign = (
  batch: PrintBatch,
  material: Material,
): Partial<PrintBatch> => {
  const result: Partial<PrintBatch> = {};

  if (batch.nozzleTemp < batch.bedTemp) {
    result.nozzleTemp = material.recommendedNozzleTemp;
  }
  if (batch.bedTemp < batch.ambientTemp) {
    result.bedTemp = material.recommendedBedTemp;
  }

  return result;
};

export const fixUnitMixed = (batch: PrintBatch): Partial<PrintBatch> => {
  const units: Unit[] = [batch.widthUnit, batch.heightUnit, batch.depthUnit];
  const unitCount: Record<string, number> = {};
  units.forEach((u) => {
    unitCount[u] = (unitCount[u] || 0) + 1;
  });

  const targetUnit = Object.entries(unitCount).sort((a, b) => b[1] - a[1])[0][0] as Unit;

  return {
    modelWidth: batch.widthUnit !== targetUnit ? undefined : batch.modelWidth,
    modelHeight: batch.heightUnit !== targetUnit ? undefined : batch.modelHeight,
    modelDepth: batch.depthUnit !== targetUnit ? undefined : batch.modelDepth,
    widthUnit: targetUnit,
    heightUnit: targetUnit,
    depthUnit: targetUnit,
  };
};

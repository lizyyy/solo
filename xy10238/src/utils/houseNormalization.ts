import type { HouseType, EnergyConsumption, ValidationError, ValidationResult, ValidationWarning } from '../types';

const STANDARD_AREA = 100;
const STANDARD_INSULATION_FACTOR: Record<string, number> = {
  poor: 1.3,
  medium: 1.0,
  good: 0.8,
};

const STANDARD_BUILDING_AGE_FACTOR = (age: number): number => {
  if (age < 10) return 0.85;
  if (age < 20) return 1.0;
  if (age < 40) return 1.15;
  return 1.3;
};

export const calculateHouseTypeNormalizedFactor = (house: Omit<HouseType, 'id' | 'normalizedFactor'>): number => {
  const areaFactor = house.area / STANDARD_AREA;
  const insulationFactor = STANDARD_INSULATION_FACTOR[house.insulationLevel];
  const ageFactor = STANDARD_BUILDING_AGE_FACTOR(house.buildingAge);
  const floorFactor = 1 + (house.floorCount - 1) * 0.1;

  return parseFloat((areaFactor * insulationFactor * ageFactor * floorFactor).toFixed(4));
};

export const createNormalizedHouseType = (
  house: Omit<HouseType, 'id' | 'normalizedFactor'>
): HouseType => {
  return {
    ...house,
    id: generateId(),
    normalizedFactor: calculateHouseTypeNormalizedFactor(house),
  };
};

export const normalizeConsumption = (
  consumption: EnergyConsumption,
  house: HouseType
): number => {
  if (!house.normalizedFactor || house.normalizedFactor === 0) {
    return consumption.kWhConsumed;
  }
  return parseFloat((consumption.kWhConsumed / house.normalizedFactor).toFixed(2));
};

export const validateHouseType = (
  house: Partial<HouseType>,
  existingHouses: HouseType[]
): ValidationResult => {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  const requiredFields = ['name', 'area', 'insulationLevel', 'floorCount', 'buildingAge', 'location'] as const;
  
  for (const field of requiredFields) {
    if (house[field] === undefined || house[field] === null || house[field] === '') {
      errors.push({
        type: 'missing',
        field,
        message: `${field} 是必填字段`,
      });
    }
  }

  if (house.area !== undefined) {
    if (typeof house.area !== 'number' || house.area <= 0) {
      errors.push({
        type: 'invalid',
        field: 'area',
        message: '面积必须是大于0的数字',
        value: house.area,
      });
    } else if (house.area < 30 || house.area > 500) {
      warnings.push({
        type: 'outlier',
        field: 'area',
        message: `面积 ${house.area}㎡ 超出常见农村住宅范围(30-500㎡)`,
        value: house.area,
      });
    }
  }

  if (house.name !== undefined) {
    const duplicate = existingHouses.find(
      (h) => h.name.toLowerCase() === (house.name as string).toLowerCase()
    );
    if (duplicate) {
      errors.push({
        type: 'duplicate',
        field: 'name',
        message: `户型名称 "${house.name}" 已存在`,
        value: house.name,
      });
    }
  }

  if (house.buildingAge !== undefined) {
    if (typeof house.buildingAge !== 'number' || house.buildingAge < 0 || house.buildingAge > 100) {
      errors.push({
        type: 'manual_error',
        field: 'buildingAge',
        message: '建筑年限必须在0-100年之间',
        value: house.buildingAge,
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export const generateHouseComparisonKey = (house: Partial<HouseType>): string => {
  return `${house.name || ''}-${house.area || ''}-${house.insulationLevel || ''}`;
};

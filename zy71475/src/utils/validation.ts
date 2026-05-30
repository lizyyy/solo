import type { BoxDimensions, SoundHole, WoodMaterial, ValidationError, LengthUnit, DensityUnit } from '@/types';
import { toMM, toKgM3 } from './unitConversion';

const BOUNDS = {
  boxLength: { min: 300, max: 600, label: '箱体长度' },
  boxWidth: { min: 200, max: 400, label: '箱体宽度' },
  boxDepth: { min: 80, max: 150, label: '箱体深度' },
  soundholeDiameter: { min: 50, max: 120, label: '音孔直径' },
  woodDensity: { min: 200, max: 1200, label: '木材密度' },
  elasticModulus: { min: 5, max: 20, label: '弹性模量' },
};

export function validateBoxDims(dims: BoxDimensions, unit: LengthUnit): ValidationError[] {
  const errors: ValidationError[] = [];
  const lengthMM = toMM(dims.length, unit);
  const widthMM = toMM(dims.width, unit);
  const depthMM = toMM(dims.depth, unit);

  if (lengthMM < BOUNDS.boxLength.min || lengthMM > BOUNDS.boxLength.max) {
    errors.push({
      field: 'boxDims.length',
      message: `${BOUNDS.boxLength.label}超出范围 (${BOUNDS.boxLength.min}–${BOUNDS.boxLength.max}mm)`,
      value: dims.length,
      unit,
      min: BOUNDS.boxLength.min,
      max: BOUNDS.boxLength.max,
    });
  }
  if (widthMM < BOUNDS.boxWidth.min || widthMM > BOUNDS.boxWidth.max) {
    errors.push({
      field: 'boxDims.width',
      message: `${BOUNDS.boxWidth.label}超出范围 (${BOUNDS.boxWidth.min}–${BOUNDS.boxWidth.max}mm)`,
      value: dims.width,
      unit,
      min: BOUNDS.boxWidth.min,
      max: BOUNDS.boxWidth.max,
    });
  }
  if (depthMM < BOUNDS.boxDepth.min || depthMM > BOUNDS.boxDepth.max) {
    errors.push({
      field: 'boxDims.depth',
      message: `${BOUNDS.boxDepth.label}超出范围 (${BOUNDS.boxDepth.min}–${BOUNDS.boxDepth.max}mm)`,
      value: dims.depth,
      unit,
      min: BOUNDS.boxDepth.min,
      max: BOUNDS.boxDepth.max,
    });
  }
  return errors;
}

export function validateSoundHole(sh: SoundHole, unit: LengthUnit): ValidationError[] {
  const errors: ValidationError[] = [];
  const diaMM = toMM(sh.diameter, unit);
  if (diaMM < BOUNDS.soundholeDiameter.min || diaMM > BOUNDS.soundholeDiameter.max) {
    errors.push({
      field: 'soundHole.diameter',
      message: `${BOUNDS.soundholeDiameter.label}超出范围 (${BOUNDS.soundholeDiameter.min}–${BOUNDS.soundholeDiameter.max}mm)`,
      value: sh.diameter,
      unit,
      min: BOUNDS.soundholeDiameter.min,
      max: BOUNDS.soundholeDiameter.max,
    });
  }
  return errors;
}

export function validateWood(wood: WoodMaterial, unit: DensityUnit): ValidationError[] {
  const errors: ValidationError[] = [];
  const densityKgM3 = toKgM3(wood.density, unit);
  if (densityKgM3 < BOUNDS.woodDensity.min || densityKgM3 > BOUNDS.woodDensity.max) {
    errors.push({
      field: 'wood.density',
      message: `${BOUNDS.woodDensity.label}超出范围 (${BOUNDS.woodDensity.min}–${BOUNDS.woodDensity.max} kg/m³)`,
      value: wood.density,
      unit,
      min: BOUNDS.woodDensity.min,
      max: BOUNDS.woodDensity.max,
    });
  }
  if (wood.elasticModulus < BOUNDS.elasticModulus.min || wood.elasticModulus > BOUNDS.elasticModulus.max) {
    errors.push({
      field: 'wood.elasticModulus',
      message: `${BOUNDS.elasticModulus.label}超出范围 (${BOUNDS.elasticModulus.min}–${BOUNDS.elasticModulus.max} GPa)`,
      value: wood.elasticModulus,
      unit: 'GPa',
      min: BOUNDS.elasticModulus.min,
      max: BOUNDS.elasticModulus.max,
    });
  }
  return errors;
}

export function validateAll(
  dims: BoxDimensions,
  sh: SoundHole,
  wood: WoodMaterial,
  lengthUnit: LengthUnit,
  densityUnit: DensityUnit
): ValidationError[] {
  return [
    ...validateBoxDims(dims, lengthUnit),
    ...validateSoundHole(sh, lengthUnit),
    ...validateWood(wood, densityUnit),
  ];
}

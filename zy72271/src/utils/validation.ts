import type { CadLayer, RangefinderRecord, ValidationError } from '../types';
import { formatHumanReadableError } from './errorMessages';

export const validateCadLayerName = (layer: CadLayer): ValidationError | null => {
  if (!layer.name || layer.name.trim() === '') {
    return formatHumanReadableError('cad_layer_empty', {
      field: 'name',
      layerName: layer.name,
    });
  }

  const validPattern = /^[A-Z_][A-Z0-9_]*$/;
  if (!validPattern.test(layer.name)) {
    return formatHumanReadableError('cad_layer_invalid', {
      field: 'name',
      layerName: layer.name,
    });
  }

  return null;
};

export const validateAllCadLayers = (layers: CadLayer[]): ValidationError[] => {
  const errors: ValidationError[] = [];
  for (const layer of layers) {
    const error = validateCadLayerName(layer);
    if (error) {
      errors.push(error);
    }
  }
  return errors;
};

export const validateRangefinderRecord = (
  record: RangefinderRecord
): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (record.distance <= 0 || record.distance > 3000) {
    errors.push(
      formatHumanReadableError('distance_out_of_range', {
        field: 'distance',
        value: record.distance,
        unit: record.unit,
      })
    );
  }

  if (record.caliber === 'imperial-v1') {
    errors.push(
      formatHumanReadableError('caliber_mismatch_imperial', {
        field: 'caliber',
        expected: 'metric-v2',
        actual: record.caliber,
      })
    );
  }

  if (record.hasBlockedWarning || !record.warningLabelVisible) {
    errors.push(
      formatHumanReadableError('warning_label_blocked', {
        field: 'photo',
      })
    );
  }

  if (record.unit !== 'm' && record.unit !== 'ft') {
    errors.push(
      formatHumanReadableError('unit_mismatch', {
        field: 'unit',
        expected: 'm',
        actual: record.unit,
      })
    );
  }

  return errors;
};

export const feetToMeters = (feet: number): number => {
  return Number((feet * 0.3048).toFixed(2));
};

export const metersToFeet = (meters: number): number => {
  return Number((meters / 0.3048).toFixed(2));
};

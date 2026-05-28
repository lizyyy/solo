import { Warning, SynthParams } from '../../types/synth';
import { validateParam, clamp } from '../../utils/validator';

export interface ValidationMiddlewareResult {
  value: unknown;
  correctedValue?: number;
  warning: Warning | null;
}

export function validationMiddleware(
  module: string,
  param: string,
  value: unknown,
  currentParams: SynthParams
): ValidationMiddlewareResult {
  const result = validateParam(module, param, value);

  if (!result.valid && result.correctedValue !== undefined) {
    return {
      value: result.correctedValue,
      correctedValue: result.correctedValue,
      warning: result.warning || null,
    };
  }

  if (typeof value === 'number') {
    return {
      value: clamp(value, -Infinity, Infinity),
      warning: result.warning || null,
    };
  }

  return {
    value,
    warning: result.warning || null,
  };
}

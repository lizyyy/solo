import { useMemo } from 'react';
import type { ValidationError } from '@/types';

export const useValidation = (errors: ValidationError[]) => {
  const groupedErrors = useMemo(() => {
    const errorsByField: Record<string, ValidationError[]> = {};
    const errorsByTarget: Record<string, ValidationError[]> = {};
    const warnings: ValidationError[] = [];
    const criticalErrors: ValidationError[] = [];

    errors.forEach((err) => {
      if (!errorsByField[err.field]) {
        errorsByField[err.field] = [];
      }
      errorsByField[err.field].push(err);

      if (!errorsByTarget[err.target]) {
        errorsByTarget[err.target] = [];
      }
      errorsByTarget[err.target].push(err);

      if (err.severity === 'error') {
        criticalErrors.push(err);
      } else {
        warnings.push(err);
      }
    });

    return {
      errorsByField,
      errorsByTarget,
      warnings,
      criticalErrors,
      hasErrors: criticalErrors.length > 0,
      hasWarnings: warnings.length > 0,
      totalCount: errors.length,
    };
  }, [errors]);

  const getErrorsForField = (field: string): ValidationError[] => {
    return groupedErrors.errorsByField[field] || [];
  };

  const getErrorsForTarget = (target: string): ValidationError[] => {
    return groupedErrors.errorsByTarget[target] || [];
  };

  const getTargetStatus = (target: string): 'error' | 'warning' | 'success' => {
    const targetErrors = groupedErrors.errorsByTarget[target] || [];
    if (targetErrors.some((e) => e.severity === 'error')) {
      return 'error';
    }
    if (targetErrors.some((e) => e.severity === 'warning')) {
      return 'warning';
    }
    return 'success';
  };

  return {
    ...groupedErrors,
    getErrorsForField,
    getErrorsForTarget,
    getTargetStatus,
  };
};

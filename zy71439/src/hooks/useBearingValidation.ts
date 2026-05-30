import { useCallback, useState } from 'react';
import { DMS, validateDMS, validateDecimal, dmsToDecimal } from '../utils/bearingConversion';

export function useBearingValidation(initialUnit: 'dms' | 'decimal' = 'decimal') {
  const [unit, setUnit] = useState<'dms' | 'decimal'>(initialUnit);
  const [dms, setDms] = useState<DMS>({ degrees: 0, minutes: 0, seconds: 0 });
  const [decimal, setDecimal] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [hasUnitError, setHasUnitError] = useState(false);

  const validateAndSetDms = useCallback((newDms: Partial<DMS>) => {
    const updated = { ...dms, ...newDms };
    const validation = validateDMS(updated);

    if (!validation.valid) {
      setError(validation.error || '无效的角度值');
    } else {
      setError(null);
    }

    setDms(updated);
    setDecimal(dmsToDecimal(updated));

    const isUnitError = checkForUnitError(dmsToDecimal(updated), 'dms');
    setHasUnitError(isUnitError);

    return validation.valid;
  }, [dms]);

  const validateAndSetDecimal = useCallback((value: number) => {
    const validation = validateDecimal(value);

    if (!validation.valid) {
      setError(validation.error || '无效的角度值');
    } else {
      setError(null);
    }

    setDecimal(value);

    const isUnitError = checkForUnitError(value, 'decimal');
    setHasUnitError(isUnitError);

    return validation.valid;
  }, []);

  const checkForUnitError = useCallback((value: number, inputUnit: 'dms' | 'decimal'): boolean => {
    if (inputUnit === 'dms' && value > 360) {
      return true;
    }
    if (inputUnit === 'decimal' && (value < 0 || value >= 360)) {
      return true;
    }
    return false;
  }, []);

  const getDecimalValue = useCallback((): number => {
    if (unit === 'dms') {
      return dmsToDecimal(dms);
    }
    return decimal;
  }, [unit, dms, decimal]);

  const reset = useCallback(() => {
    setDms({ degrees: 0, minutes: 0, seconds: 0 });
    setDecimal(0);
    setError(null);
    setHasUnitError(false);
  }, []);

  return {
    unit,
    setUnit,
    dms,
    decimal,
    error,
    hasUnitError,
    validateAndSetDms,
    validateAndSetDecimal,
    getDecimalValue,
    reset,
    isValid: error === null
  };
}

export type BearingValidationState = ReturnType<typeof useBearingValidation>;

import type {
  ComputationStep,
  ComputationResult,
  InputValue,
  UnitConversion,
} from '../types';
import { generateId } from '../utils/hash';
import { convertUnit, createUnitConversion } from '../utils/unitConversion';

interface VariableWithError {
  name: string;
  value: number;
  unit: string;
  error: number;
  targetUnit?: string;
}

interface ComputationConfig {
  formula: string;
  variables: VariableWithError[];
  resultUnit: string;
  description: string;
}

function parseFormula(formula: string): string[] {
  const variableRegex = /[a-zA-Z_][a-zA-Z0-9_]*/g;
  const matches = formula.match(variableRegex);
  return matches ? [...new Set(matches)] : [];
}

function evaluateFormula(formula: string, values: Record<string, number>): number {
  const safeFormula = formula.replace(/\^/g, '**');
  const vars = Object.keys(values);
  const varValues = Object.values(values);

  try {
    const fn = new Function(...vars, `return ${safeFormula};`);
    return fn(...varValues);
  } catch (error) {
    throw new Error(`公式计算错误: ${(error as Error).message}`);
  }
}

function calculatePartialDerivative(
  formula: string,
  variable: string,
  values: Record<string, number>,
  epsilon: number = 1e-8
): number {
  const baseValue = values[variable];
  const h = Math.abs(baseValue) * epsilon + epsilon;

  const valuesPlus = { ...values, [variable]: baseValue + h };
  const valuesMinus = { ...values, [variable]: baseValue - h };

  const fPlus = evaluateFormula(formula, valuesPlus);
  const fMinus = evaluateFormula(formula, valuesMinus);

  return (fPlus - fMinus) / (2 * h);
}

export const errorPropagationEngine = {
  compute(config: ComputationConfig): ComputationResult {
    const { formula, variables, resultUnit, description } = config;
    const steps: ComputationStep[] = [];
    let stepOrder = 1;

    const variableNames = parseFormula(formula);
    const missingVars = variableNames.filter((v) => !variables.find((varDef) => varDef.name === v));
    if (missingVars.length > 0) {
      throw new Error(`公式中缺少变量定义: ${missingVars.join(', ')}`);
    }

    const inputValues: Record<string, InputValue> = {};
    const convertedValues: Record<string, number> = {};
    const errors: Record<string, number> = {};
    const partialDerivatives: Record<string, number> = {};
    const errorContributions: Record<string, number> = {};
    const unitConversions: Record<string, UnitConversion> = {};

    for (const variable of variables) {
      let convertedValue = variable.value;
      let unitConversion: UnitConversion | null = null;

      if (variable.targetUnit && variable.unit !== variable.targetUnit) {
        const conversion = convertUnit(variable.value, variable.unit, variable.targetUnit);
        if (!conversion) {
          throw new Error(`无法转换单位: ${variable.unit} → ${variable.targetUnit}`);
        }
        convertedValue = conversion.value;
        unitConversion = createUnitConversion(variable.value, variable.unit, variable.targetUnit);

        const now = Date.now();
        const conversionStep: ComputationStep = {
          id: generateId(),
          sessionId: '',
          stepOrder: stepOrder++,
          formula: conversion.formula || '',
          inputValues: {
            [variable.name]: { value: variable.value, unit: variable.unit, error: variable.error },
          },
          unitConversion,
          result: conversion.value,
          resultUnit: variable.targetUnit,
          description: `单位换算: ${variable.name} 从 ${variable.unit} 转换为 ${variable.targetUnit}`,
          manuallyModified: false,
          createdAt: now,
          updatedAt: now,
        };
        steps.push(conversionStep);
      }

      inputValues[variable.name] = {
        value: variable.value,
        unit: variable.unit,
        error: variable.error,
      };

      convertedValues[variable.name] = convertedValue;
      errors[variable.name] = variable.error || 0;

      if (unitConversion) {
        unitConversions[variable.name] = unitConversion;
      }
    }

    for (const variable of variables) {
      const pd = calculatePartialDerivative(formula, variable.name, convertedValues);
      partialDerivatives[variable.name] = pd;

      const convertedError = variable.error
        ? variable.error * (variable.targetUnit && variable.unit !== variable.targetUnit
            ? convertUnit(1, variable.unit, variable.targetUnit)?.factor || 1
            : 1)
        : 0;

      errorContributions[variable.name] = Math.abs(pd * convertedError);
    }

    const finalResult = evaluateFormula(formula, convertedValues);

    const totalErrorSquared = Object.values(errorContributions).reduce(
      (sum, ec) => sum + ec * ec,
      0
    );
    const totalError = Math.sqrt(totalErrorSquared);

    const now = Date.now();
    const mainStep: ComputationStep = {
      id: generateId(),
      sessionId: '',
      stepOrder: stepOrder++,
      formula,
      inputValues,
      unitConversion: null,
      result: finalResult,
      resultUnit,
      description,
      manuallyModified: false,
      partialDerivatives,
      errorContribution: errorContributions,
      createdAt: now,
      updatedAt: now,
    };
    steps.push(mainStep);

    const errorFormula = Object.entries(errorContributions)
      .map(([name, ec]) => `(∂f/∂${name} × σ_${name})² = ${(ec * ec).toFixed(6)}`)
      .join('\n');

    const errorStep: ComputationStep = {
      id: generateId(),
      sessionId: '',
      stepOrder: stepOrder++,
      formula: `σ_f = √[${Object.keys(errorContributions)
        .map((k) => `(∂f/∂${k}·σ_${k})²`)
        .join(' + ')}]`,
      inputValues: Object.fromEntries(
        Object.entries(errors).map(([k, v]) => [
          `σ_${k}`,
          { value: v, unit: inputValues[k]?.unit || '', error: 0 },
        ])
      ),
      unitConversion: null,
      result: totalError,
      resultUnit,
      description: `误差传播计算\n${errorFormula}\n\n总误差: σ_f = ${totalError.toFixed(6)} ${resultUnit}`,
      manuallyModified: false,
      partialDerivatives,
      errorContribution: errorContributions,
      createdAt: now,
      updatedAt: now,
    };
    steps.push(errorStep);

    const finalStep: ComputationStep = {
      id: generateId(),
      sessionId: '',
      stepOrder: stepOrder++,
      formula: `f = ${finalResult.toFixed(6)} ± ${totalError.toFixed(6)} ${resultUnit}`,
      inputValues,
      unitConversion: null,
      result: finalResult,
      resultUnit,
      description: `最终结果: ${finalResult.toFixed(6)} ± ${totalError.toFixed(6)} ${resultUnit}
(相对误差: ${((totalError / Math.abs(finalResult)) * 100).toFixed(4)}%)`,
      manuallyModified: false,
      partialDerivatives,
      errorContribution: errorContributions,
      createdAt: now,
      updatedAt: now,
    };
    steps.push(finalStep);

    return {
      steps,
      finalResult,
      finalResultUnit: resultUnit,
      totalError,
    };
  },

  convertUnit(
    value: number,
    fromUnit: string,
    toUnit: string
  ): { value: number; factor: number; formula: string } | null {
    return convertUnit(value, fromUnit, toUnit);
  },

  computeSimple(
    formula: string,
    inputs: Record<string, { value: number; unit: string; error: number }>,
    resultUnit: string,
    description: string
  ): ComputationResult {
    const variables = Object.entries(inputs).map(([name, data]) => ({
      name,
      value: data.value,
      unit: data.unit,
      error: data.error,
    }));

    return this.compute({
      formula,
      variables,
      resultUnit,
      description,
    });
  },

  validateFormula(formula: string, variableNames: string[]): { valid: boolean; error?: string } {
    try {
      const parsedVars = parseFormula(formula);
      const missingVars = parsedVars.filter((v) => !variableNames.includes(v));

      if (missingVars.length > 0) {
        return {
          valid: false,
          error: `公式包含未定义变量: ${missingVars.join(', ')}`,
        };
      }

      const testValues: Record<string, number> = {};
      variableNames.forEach((v) => (testValues[v] = 1));
      evaluateFormula(formula, testValues);

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: (error as Error).message,
      };
    }
  },
};

export function generateErrorPropagationSteps(
  sessionId: string,
  formula: string,
  variables: VariableWithError[],
  resultUnit: string,
  description: string
): ComputationStep[] {
  const result = errorPropagationEngine.compute({
    formula,
    variables,
    resultUnit,
    description,
  });

  return result.steps.map((step) => ({
    ...step,
    sessionId,
  }));
}

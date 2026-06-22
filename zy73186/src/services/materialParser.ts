import type { Material, BoundaryCondition } from '../types';
import { boundaryChecker } from './boundaryChecker';

interface ParsedFormula {
  formula: string;
  description: string;
  variables: Array<{
    name: string;
    value: number;
    unit: string;
    error: number;
    targetUnit?: string;
  }>;
  resultUnit: string;
}

interface ParsedMaterial {
  formula?: ParsedFormula;
  boundaryConditions: BoundaryCondition[];
  citations: Array<{
    text: string;
    position: number;
  }>;
}

export const materialParser = {
  parseMaterial(material: Material): ParsedMaterial {
    const result: ParsedMaterial = {
      boundaryConditions: [],
      citations: [],
    };

    if (material.type === 'boundary_sample') {
      result.boundaryConditions = boundaryChecker.parseBoundaryConditions(
        material.content,
        material.id
      );
    }

    if (material.type === 'historical_answer') {
      result.formula = this.extractFormula(material.content);
      result.boundaryConditions = boundaryChecker.parseBoundaryConditions(
        material.content,
        material.id
      );
    }

    result.citations = this.extractCitations(material.content);

    return result;
  },

  extractFormula(content: string): ParsedFormula | null {
    const lines = content.split('\n');
    let formula = '';
    let description = '';
    const variables: ParsedFormula['variables'] = [];
    let resultUnit = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      const formulaMatch = line.match(/(?:公式|计算|f\s*[=:：])\s*([^\n]+)/);
      if (formulaMatch && !formula) {
        formula = formulaMatch[1].trim();
        description = line;
      }

      const simpleFormulaMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_\u2080-\u2089\u00B9\u00B2\u00B3\u2070\u2074-\u207F]*)\s*=\s*([^=]+)$/);
      if (simpleFormulaMatch && !formula) {
        formula = simpleFormulaMatch[2].trim();
        description = line;
      }

      const unitMatch = line.match(/(?:结果|单位|result|unit)\s*[:：=]?\s*([^\s,，]+)/i);
      if (unitMatch && !resultUnit) {
        resultUnit = unitMatch[1].trim();
      }

      const varMatch = line.match(
        /([a-zA-Z_][a-zA-Z0-9_\u2080-\u2089\u00B9\u00B2\u00B3\u2070\u2074-\u207F]*)\s*[=:：]\s*([-+]?\d*\.?\d+)\s*(?:\(|（)?\s*([^)）]*)?\s*(?:\)|）)?\s*(?:±\s*([-+]?\d*\.?\d+))?/
      );

      if (varMatch) {
        const [, name, valueStr, unitStr, errorStr] = varMatch;
        const value = parseFloat(valueStr);
        const error = errorStr ? parseFloat(errorStr) : 0;
        const unit = unitStr?.trim() || '';

        if (!isNaN(value) && !variables.find((v) => v.name === name)) {
          variables.push({
            name,
            value,
            unit,
            error,
            targetUnit: unit,
          });
        }
      }
    }

    if (!formula) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (
          line.includes('=') &&
          !line.includes('±') &&
          !line.includes('∈') &&
          !line.includes('≤') &&
          !line.includes('≥')
        ) {
          const parts = line.split('=');
          if (parts.length === 2) {
            const rightSide = parts[1].trim();
            if (rightSide.match(/[a-zA-Z+\-*/^]/)) {
              formula = rightSide;
              description = line;
              break;
            }
          }
        }
      }
    }

    if (!formula && variables.length >= 2) {
      const varNames = variables.map((v) => v.name);
      formula = varNames.join(' * ');
      description = `自动推断: ${varNames.join(' × ')}`;
    }

    if (!formula) return null;

    return {
      formula,
      description,
      variables,
      resultUnit: resultUnit || '',
    };
  },

  extractCitations(content: string): ParsedMaterial['citations'] {
    const citations: ParsedMaterial['citations'] = [];
    const keyPhrases = [
      '根据',
      '依据',
      '参考',
      '参见',
      '引自',
      '来源于',
      '历史答案',
      '上次结果',
      'previous',
      'according to',
    ];

    const lines = content.split('\n');
    let position = 0;

    for (const line of lines) {
      for (const phrase of keyPhrases) {
        const index = line.indexOf(phrase);
        if (index !== -1) {
          citations.push({
            text: line.substring(index, index + 100),
            position: position + index,
          });
        }
      }
      position += line.length + 1;
    }

    return citations;
  },

  parseAllMaterials(materials: Material[]): {
    formulas: ParsedFormula[];
    boundaryConditions: BoundaryCondition[];
    allCitations: ParsedMaterial['citations'];
  } {
    const formulas: ParsedFormula[] = [];
    const boundaryConditions: BoundaryCondition[] = [];
    const allCitations: ParsedMaterial['citations'] = [];

    for (const material of materials) {
      const parsed = this.parseMaterial(material);
      if (parsed.formula) {
        formulas.push(parsed.formula);
      }
      boundaryConditions.push(...parsed.boundaryConditions);
      allCitations.push(...parsed.citations);
    }

    return { formulas, boundaryConditions, allCitations };
  },

  suggestComputationFromMaterials(materials: Material[]) {
    const { formulas, boundaryConditions } = this.parseAllMaterials(materials);

    if (formulas.length > 0) {
      const primaryFormula = formulas[0];
      return {
        formula: primaryFormula.formula,
        variables: primaryFormula.variables,
        resultUnit: primaryFormula.resultUnit,
        description: primaryFormula.description,
        boundaryConditions,
      };
    }

    if (materials.length > 0) {
      return {
        formula: 'a * b',
        variables: [
          { name: 'a', value: 10, unit: 'm', error: 0.1, targetUnit: 'm' },
          { name: 'b', value: 5, unit: 'cm', error: 0.05, targetUnit: 'm' },
        ],
        resultUnit: 'm²',
        description: '默认计算：面积计算示例',
        boundaryConditions,
      };
    }

    return null;
  },
};

import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { ProcessRules } from '../types';

const DEFAULT_RULES: ProcessRules = {
  bleed: {
    margin: 3,
    unit: 'mm',
  },
  spotColors: {
    allowedPrefixes: ['PANTONE', 'Spot', '专色'],
    caseSensitive: false,
  },
  registrationMarks: {
    required: true,
    size: {
      min: 5,
      max: 15,
    },
    positionTolerance: 2,
  },
  barcode: {
    minWidth: 20,
    maxWidth: 100,
    minHeight: 10,
    maxHeight: 50,
    quietZone: 5,
  },
  dieline: {
    strokeColor: '#FF0000',
    strokeWidth: 0.5,
    mustBeClosed: true,
  },
};

export function parseRulesYaml(filePath: string): ProcessRules {
  const content = fs.readFileSync(filePath, 'utf-8');
  const parsed = yaml.load(content) as Record<string, unknown>;
  
  return mergeWithDefaults(parsed);
}

export function parseYamlContent(content: string): ProcessRules {
  const parsed = yaml.load(content) as Record<string, unknown>;
  return mergeWithDefaults(parsed);
}

function mergeWithDefaults(parsed: Record<string, unknown>): ProcessRules {
  const result: ProcessRules = { ...DEFAULT_RULES };
  
  if (parsed.bleed && typeof parsed.bleed === 'object') {
    const bleed = parsed.bleed as Record<string, unknown>;
    result.bleed = {
      margin: typeof bleed.margin === 'number' ? bleed.margin : DEFAULT_RULES.bleed.margin,
      unit: typeof bleed.unit === 'string' ? bleed.unit : DEFAULT_RULES.bleed.unit,
    };
  }
  
  if (parsed.spotColors && typeof parsed.spotColors === 'object') {
    const spotColors = parsed.spotColors as Record<string, unknown>;
    result.spotColors = {
      allowedPrefixes: Array.isArray(spotColors.allowedPrefixes) 
        ? spotColors.allowedPrefixes 
        : DEFAULT_RULES.spotColors.allowedPrefixes,
      caseSensitive: typeof spotColors.caseSensitive === 'boolean' 
        ? spotColors.caseSensitive 
        : DEFAULT_RULES.spotColors.caseSensitive,
    };
  }
  
  if (parsed.registrationMarks && typeof parsed.registrationMarks === 'object') {
    const regMarks = parsed.registrationMarks as Record<string, unknown>;
    result.registrationMarks = {
      required: typeof regMarks.required === 'boolean' 
        ? regMarks.required 
        : DEFAULT_RULES.registrationMarks.required,
      size: {
        min: typeof (regMarks.size as Record<string, unknown>)?.min === 'number'
          ? (regMarks.size as Record<string, unknown>).min as number
          : DEFAULT_RULES.registrationMarks.size.min,
        max: typeof (regMarks.size as Record<string, unknown>)?.max === 'number'
          ? (regMarks.size as Record<string, unknown>).max as number
          : DEFAULT_RULES.registrationMarks.size.max,
      },
      positionTolerance: typeof regMarks.positionTolerance === 'number'
        ? regMarks.positionTolerance
        : DEFAULT_RULES.registrationMarks.positionTolerance,
    };
  }
  
  if (parsed.barcode && typeof parsed.barcode === 'object') {
    const barcode = parsed.barcode as Record<string, unknown>;
    result.barcode = {
      minWidth: typeof barcode.minWidth === 'number' ? barcode.minWidth : DEFAULT_RULES.barcode.minWidth,
      maxWidth: typeof barcode.maxWidth === 'number' ? barcode.maxWidth : DEFAULT_RULES.barcode.maxWidth,
      minHeight: typeof barcode.minHeight === 'number' ? barcode.minHeight : DEFAULT_RULES.barcode.minHeight,
      maxHeight: typeof barcode.maxHeight === 'number' ? barcode.maxHeight : DEFAULT_RULES.barcode.maxHeight,
      quietZone: typeof barcode.quietZone === 'number' ? barcode.quietZone : DEFAULT_RULES.barcode.quietZone,
    };
  }
  
  if (parsed.dieline && typeof parsed.dieline === 'object') {
    const dieline = parsed.dieline as Record<string, unknown>;
    result.dieline = {
      strokeColor: typeof dieline.strokeColor === 'string' ? dieline.strokeColor : DEFAULT_RULES.dieline.strokeColor,
      strokeWidth: typeof dieline.strokeWidth === 'number' ? dieline.strokeWidth : DEFAULT_RULES.dieline.strokeWidth,
      mustBeClosed: typeof dieline.mustBeClosed === 'boolean' ? dieline.mustBeClosed : DEFAULT_RULES.dieline.mustBeClosed,
    };
  }
  
  if (parsed.customRules && Array.isArray(parsed.customRules)) {
    result.customRules = parsed.customRules;
  }
  
  return result;
}

export function getDefaultRules(): ProcessRules {
  return { ...DEFAULT_RULES };
}

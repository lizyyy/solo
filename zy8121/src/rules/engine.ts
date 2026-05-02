import { Rule, RuleContext, RuleCategory } from './types';
import { viewBoxRule, dimensionRule } from './viewboxRule';
import { dielineRule } from './dielineRule';
import { bleedRule } from './bleedRule';
import { spotColorRule } from './spotColorRule';
import { registrationRule } from './registrationRule';
import { barcodeRule } from './barcodeRule';
import { Issue, ValidationResult, ParsedSVG, ProcessRules, BarcodeItem, OrderRecord } from '../types';

const ALL_RULES: Rule[] = [
  viewBoxRule,
  dimensionRule,
  dielineRule,
  bleedRule,
  spotColorRule,
  registrationRule,
  barcodeRule,
];

export interface ValidationOptions {
  enabledRules?: RuleCategory[];
  disabledRules?: RuleCategory[];
}

export interface ValidationInput {
  svg: ParsedSVG;
  rules: ProcessRules;
  barcodes?: BarcodeItem[];
  order?: OrderRecord;
  svgFileName?: string;
  orderFileName?: string;
  rulesFileName?: string;
  barcodesFileName?: string;
}

export function validate(
  input: ValidationInput,
  options: ValidationOptions = {}
): ValidationResult {
  const { svg, rules, barcodes, order } = input;

  const context: RuleContext = {
    svg,
    rules,
    barcodes,
    orderInfo: order ? {
      orderId: order.orderId,
      productName: order.productName,
    } : undefined,
  };

  const rulesToRun = filterRules(options);

  const allIssues: Issue[] = [];

  for (const rule of rulesToRun) {
    const issues = rule.check(context);
    allIssues.push(...issues);
  }

  allIssues.sort((a, b) => {
    const severityOrder: Record<string, number> = {
      critical: 0,
      warning: 1,
      info: 2,
    };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  const summary = {
    total: allIssues.length,
    critical: allIssues.filter(i => i.severity === 'critical').length,
    warning: allIssues.filter(i => i.severity === 'warning').length,
    info: allIssues.filter(i => i.severity === 'info').length,
  };

  return {
    orderId: order?.orderId || 'unknown',
    timestamp: new Date().toISOString(),
    summary,
    issues: allIssues,
    metadata: {
      svgFileName: input.svgFileName,
      orderFileName: input.orderFileName,
      rulesFileName: input.rulesFileName,
      barcodesFileName: input.barcodesFileName,
    },
  };
}

function filterRules(options: ValidationOptions): Rule[] {
  if (options.enabledRules && options.enabledRules.length > 0) {
    return ALL_RULES.filter(rule => 
      options.enabledRules!.includes(rule.category as RuleCategory)
    );
  }

  if (options.disabledRules && options.disabledRules.length > 0) {
    return ALL_RULES.filter(rule => 
      !options.disabledRules!.includes(rule.category as RuleCategory)
    );
  }

  return ALL_RULES;
}

export function getRules(): Rule[] {
  return [...ALL_RULES];
}

export function getRuleByCategory(category: RuleCategory): Rule | undefined {
  return ALL_RULES.find(rule => rule.category === category);
}

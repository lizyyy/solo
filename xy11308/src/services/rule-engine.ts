import { Elder, ChronicDisease } from '../entities/Elder';
import { Meal } from '../entities/Meal';

export interface RuleCheckResult {
  passed: boolean;
  ruleName: string;
  severity: 'block' | 'warning' | 'info';
  message: string;
  details?: any;
}

export interface RuleCheckSummary {
  overallPassed: boolean;
  hasBlocks: boolean;
  hasWarnings: boolean;
  results: RuleCheckResult[];
  blockReasons: string[];
  warningReasons: string[];
}

export class RuleEngine {
  static async checkMealAssignment(elder: Elder, meal: Meal): Promise<RuleCheckSummary> {
    const results: RuleCheckResult[] = [];

    results.push(this.checkAllergies(elder, meal));
    results.push(this.checkDiabetesRestriction(elder, meal));
    results.push(this.checkHypertensionRestriction(elder, meal));
    results.push(this.checkGoutRestriction(elder, meal));
    results.push(this.checkDietaryRestrictions(elder, meal));

    const blocks = results.filter(r => r.severity === 'block' && !r.passed);
    const warnings = results.filter(r => r.severity === 'warning' && !r.passed);

    return {
      overallPassed: blocks.length === 0,
      hasBlocks: blocks.length > 0,
      hasWarnings: warnings.length > 0,
      results,
      blockReasons: blocks.map(b => b.message),
      warningReasons: warnings.map(w => w.message)
    };
  }

  private static checkAllergies(elder: Elder, meal: Meal): RuleCheckResult {
    const elderAllergies = elder.allergies || [];
    const mealAllergens = meal.allergens || [];
    
    const matches = elderAllergies.filter(a => 
      mealAllergens.some(m => m.toLowerCase().includes(a.toLowerCase()) || 
                              a.toLowerCase().includes(m.toLowerCase()))
    );

    if (matches.length > 0) {
      return {
        passed: false,
        ruleName: 'allergy_check',
        severity: 'block',
        message: `过敏拦截：餐食含有${matches.join('、')}，与老人过敏源冲突`,
        details: { elderAllergies, mealAllergens, matches }
      };
    }

    return {
      passed: true,
      ruleName: 'allergy_check',
      severity: 'info',
      message: '无过敏源冲突'
    };
  }

  private static checkDiabetesRestriction(elder: Elder, meal: Meal): RuleCheckResult {
    const hasDiabetes = (elder.chronicDiseases || []).includes(ChronicDisease.DIABETES);

    if (hasDiabetes && !meal.isDiabetesFriendly && !meal.isLowSugar) {
      return {
        passed: false,
        ruleName: 'diabetes_restriction',
        severity: 'block',
        message: '糖尿病禁忌：该餐食非低糖/糖尿病友好型',
        details: { isDiabetesFriendly: meal.isDiabetesFriendly, isLowSugar: meal.isLowSugar }
      };
    }

    return {
      passed: true,
      ruleName: 'diabetes_restriction',
      severity: 'info',
      message: hasDiabetes ? '符合糖尿病饮食要求' : '无糖尿病限制'
    };
  }

  private static checkHypertensionRestriction(elder: Elder, meal: Meal): RuleCheckResult {
    const hasHypertension = (elder.chronicDiseases || []).includes(ChronicDisease.HYPERTENSION);

    if (hasHypertension && !meal.isLowSalt) {
      return {
        passed: false,
        ruleName: 'hypertension_restriction',
        severity: 'warning',
        message: '高血压注意：建议选用低盐餐食',
        details: { isLowSalt: meal.isLowSalt }
      };
    }

    return {
      passed: true,
      ruleName: 'hypertension_restriction',
      severity: 'info',
      message: hasHypertension ? '符合高血压饮食要求' : '无高血压限制'
    };
  }

  private static checkGoutRestriction(elder: Elder, meal: Meal): RuleCheckResult {
    const hasGout = (elder.chronicDiseases || []).includes(ChronicDisease.GOUT);

    if (hasGout && !meal.isLowPurine) {
      return {
        passed: false,
        ruleName: 'gout_restriction',
        severity: 'warning',
        message: '痛风注意：建议选用低嘌呤餐食',
        details: { isLowPurine: meal.isLowPurine }
      };
    }

    return {
      passed: true,
      ruleName: 'gout_restriction',
      severity: 'info',
      message: hasGout ? '符合痛风饮食要求' : '无痛风限制'
    };
  }

  private static checkDietaryRestrictions(elder: Elder, meal: Meal): RuleCheckResult {
    const restrictions = elder.dietaryRestrictions || [];
    const ingredients = meal.ingredients || [];

    const conflicts = restrictions.filter(r =>
      ingredients.some(i => i.toLowerCase().includes(r.toLowerCase()))
    );

    if (conflicts.length > 0) {
      return {
        passed: false,
        ruleName: 'dietary_restriction',
        severity: 'warning',
        message: `饮食禁忌注意：餐食含有${conflicts.join('、')}`,
        details: { restrictions, ingredients, conflicts }
      };
    }

    return {
      passed: true,
      ruleName: 'dietary_restriction',
      severity: 'info',
      message: restrictions.length > 0 ? '符合饮食禁忌要求' : '无饮食禁忌'
    };
  }

  static formatResultsForStorage(summary: RuleCheckSummary): string[] {
    return summary.results.map(r => 
      `${r.ruleName}:${r.passed ? 'PASS' : r.severity === 'block' ? 'BLOCK' : 'WARN'}`
    );
  }

  static formatDetailsForStorage(summary: RuleCheckSummary): string {
    return JSON.stringify(summary);
  }
}
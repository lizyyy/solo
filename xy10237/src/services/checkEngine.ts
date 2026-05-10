import { v4 as uuidv4 } from 'uuid';
import { 
  Sample, 
  MaterialType, 
  CheckResult, 
  CheckStatus, 
  CheckItem, 
  CountryRule 
} from '../types';
import { getMaterialTypeName, defaultCountryRules } from '../data/countryRules';

export class CheckEngine {
  private rules: Map<string, CountryRule>;

  constructor(customRules?: CountryRule[]) {
    this.rules = new Map();
    const allRules = customRules || defaultCountryRules;
    allRules.forEach(rule => {
      this.rules.set(rule.countryCode.toUpperCase(), rule);
    });
  }

  getRule(countryCode: string): CountryRule | undefined {
    return this.rules.get(countryCode.toUpperCase());
  }

  getAllRules(): CountryRule[] {
    return Array.from(this.rules.values());
  }

  addOrUpdateRule(rule: CountryRule): void {
    this.rules.set(rule.countryCode.toUpperCase(), rule);
  }

  checkSample(sample: Sample, runNumber: number = 1): CheckResult {
    const checkItems: CheckItem[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    
    const rule = this.rules.get(sample.destinationCountry.toUpperCase());
    if (!rule) {
      checkItems.push({
        name: '国家规则验证',
        passed: false,
        message: `未找到目的国 ${sample.destinationCountry} 的清关规则`,
        details: '请确保目的国代码正确，或添加该国家的清关规则'
      });
      errors.push(`未知目的国: ${sample.destinationCountry}`);
      
      return this.buildResult(sample, 'failed', checkItems, errors, warnings, [], runNumber);
    }

    checkItems.push({
      name: '国家规则验证',
      passed: true,
      message: `已加载 ${rule.countryName} (${rule.countryCode}) 的清关规则`,
      details: rule.notes
    });

    const availableMaterialTypes = sample.materials
      .filter(m => m.valid)
      .map(m => m.type);
    
    const missingMaterials: MaterialType[] = [];
    const requiredMaterials = rule.requiredMaterials || ['invoice', 'composition', 'declaration'];

    requiredMaterials.forEach(requiredType => {
      const hasMaterial = availableMaterialTypes.includes(requiredType);
      
      if (hasMaterial) {
        checkItems.push({
          name: `${getMaterialTypeName(requiredType)}检查`,
          passed: true,
          message: `${getMaterialTypeName(requiredType)}已提供且有效`,
          details: sample.materials.find(m => m.type === requiredType && m.valid)?.notes
        });
      } else {
        checkItems.push({
          name: `${getMaterialTypeName(requiredType)}检查`,
          passed: false,
          message: `缺少必要的${getMaterialTypeName(requiredType)}`,
          details: `目的国 ${rule.countryName} 要求必须提供${getMaterialTypeName(requiredType)}`
        });
        errors.push(`缺少必要材料: ${getMaterialTypeName(requiredType)}`);
        missingMaterials.push(requiredType);
      }
    });

    sample.materials.forEach(material => {
      if (!material.valid) {
        checkItems.push({
          name: `${getMaterialTypeName(material.type)}有效性`,
          passed: false,
          message: `${getMaterialTypeName(material.type)}无效`,
          details: material.notes || '文件内容或格式不符合要求'
        });
        if (!missingMaterials.includes(material.type)) {
          errors.push(`${getMaterialTypeName(material.type)}无效，请重新上传`);
        }
      }
    });

    if (rule.valueThreshold && sample.value > rule.valueThreshold) {
      checkItems.push({
        name: '价值阈值检查',
        passed: false,
        message: `样品价值(${sample.value} ${sample.currency})超过阈值(${rule.valueThreshold})`,
        details: '超过阈值的样品可能需要额外的报关文件和缴纳关税'
      });
      warnings.push(`样品价值超过 ${rule.countryName} 免税阈值，可能需要额外清关文件`);
    } else if (rule.valueThreshold) {
      checkItems.push({
        name: '价值阈值检查',
        passed: true,
        message: `样品价值(${sample.value} ${sample.currency})在阈值(${rule.valueThreshold})范围内`,
        details: '符合简化清关条件'
      });
    }

    if (rule.additionalRequirements) {
      rule.additionalRequirements.forEach(req => {
        if (req.mandatory) {
          checkItems.push({
            name: `附加要求: ${req.name}`,
            passed: false,
            message: `需确认是否提供${req.name}`,
            details: req.description
          });
          warnings.push(`需确认是否提供 ${req.name}: ${req.description}`);
        }
      });
    }

    const hasInvalidMaterials = sample.materials.some(m => !m.valid);
    const allRequiredPresent = requiredMaterials.every(
      type => availableMaterialTypes.includes(type)
    );

    let status: CheckStatus;
    if (errors.length > 0 || !allRequiredPresent || hasInvalidMaterials) {
      status = 'failed';
    } else if (warnings.length > 0) {
      status = 'manual_review';
    } else {
      status = 'passed';
    }

    return this.buildResult(sample, status, checkItems, errors, warnings, missingMaterials, runNumber);
  }

  private buildResult(
    sample: Sample,
    status: CheckStatus,
    checkItems: CheckItem[],
    errors: string[],
    warnings: string[],
    missingMaterials: MaterialType[],
    runNumber: number
  ): CheckResult {
    return {
      id: uuidv4(),
      sampleId: sample.id,
      sampleName: sample.name,
      destinationCountry: sample.destinationCountry,
      status,
      checkItems,
      errors,
      warnings,
      missingMaterials,
      checkedAt: new Date().toISOString(),
      runNumber
    };
  }

  validateMaterialList(materials: { type: string; valid: boolean }[]): { 
    isValid: boolean; 
    issues: string[] 
  } {
    const issues: string[] = [];
    const validTypes: MaterialType[] = ['invoice', 'composition', 'declaration'];
    
    materials.forEach((m, index) => {
      if (!validTypes.includes(m.type as MaterialType)) {
        issues.push(`第 ${index + 1} 项材料类型无效: ${m.type}`);
      }
    });

    const requiredTypes: MaterialType[] = ['invoice', 'composition', 'declaration'];
    requiredTypes.forEach(reqType => {
      const hasType = materials.some(m => m.type === reqType);
      if (!hasType) {
        issues.push(`材料清单未包含必要类型: ${getMaterialTypeName(reqType)}`);
      }
    });

    return {
      isValid: issues.length === 0,
      issues
    };
  }

  validateCountryRules(): { 
    isValid: boolean; 
    details: { countryCode: string; countryName: string; requiredMaterials: number }[] 
  } {
    const details = this.getAllRules().map(rule => ({
      countryCode: rule.countryCode,
      countryName: rule.countryName,
      requiredMaterials: (rule.requiredMaterials || []).length
    }));

    const isValid = details.every(d => d.requiredMaterials >= 3);
    
    return { isValid, details };
  }
}

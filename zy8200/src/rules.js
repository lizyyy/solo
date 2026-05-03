const Parser = require('./parser');

class Rules {
  constructor(formula, inciDict, packLabel, allergenRules) {
    this.formula = formula;
    this.inciDict = inciDict;
    this.packLabel = packLabel;
    this.allergenRules = allergenRules;
    this.issues = [];
    this.suggestions = [];
  }

  checkAll() {
    this.checkInciNames();
    this.checkPercentageOrder();
    this.checkRestrictedIngredients();
    this.checkAllergenLabeling();
    this.checkLabelIngredientsMatch();
    
    return {
      issues: this.issues,
      suggestions: this.suggestions
    };
  }

  checkInciNames() {
    const { inciMap, aliases } = this.inciDict;
    
    for (const ingredient of this.formula) {
      const name = ingredient.name;
      const normalizedName = Parser.normalizeName(name);
      
      let found = false;
      let standardName = null;
      let usedAlias = false;
      
      if (inciMap.has(normalizedName)) {
        found = true;
        standardName = inciMap.get(normalizedName).standardName;
      } else if (aliases.has(normalizedName)) {
        found = true;
        standardName = aliases.get(normalizedName);
        usedAlias = true;
      }
      
      if (!found) {
        this.issues.push({
          type: 'INCI_NAME_ERROR',
          severity: 'high',
          ingredient: name,
          message: `成分名称 "${name}" 未在 INCI 字典中找到`,
          suggestion: `请确认 "${name}" 的正确 INCI 名称，或更新 INCI 字典`
        });
      } else if (usedAlias) {
        this.issues.push({
          type: 'INCI_ALIAS_WARNING',
          severity: 'medium',
          ingredient: name,
          message: `成分名称 "${name}" 使用了别名，标准 INCI 名称应为 "${standardName}"`,
          suggestion: `建议将 "${name}" 替换为标准 INCI 名称 "${standardName}"`
        });
        this.suggestions.push({
          original: name,
          standard: standardName,
          type: 'alias_normalization'
        });
      }
    }
  }

  checkPercentageOrder() {
    if (this.formula.length < 2) return;
    
    let previousPercentage = Infinity;
    let samePercentageGroup = [];
    
    for (let i = 0; i < this.formula.length; i++) {
      const current = this.formula[i];
      const currentPercentage = current.percentage;
      
      if (currentPercentage > previousPercentage) {
        if (samePercentageGroup.length > 0 && samePercentageGroup[samePercentageGroup.length - 1].percentage !== currentPercentage) {
          this.issues.push({
            type: 'PERCENTAGE_ORDER_ERROR',
            severity: 'high',
            position: i,
            currentIngredient: current.name,
            currentPercentage: currentPercentage,
            previousIngredient: this.formula[i - 1].name,
            previousPercentage: this.formula[i - 1].percentage,
            message: `成分顺序错误："${current.name}" (${currentPercentage}%) 应在 "${this.formula[i - 1].name}" (${this.formula[i - 1].percentage}%) 之前`,
            suggestion: `请按照含量从高到低重新排列成分顺序`
          });
          samePercentageGroup = [current];
        } else {
          this.issues.push({
            type: 'PERCENTAGE_ORDER_ERROR',
            severity: 'high',
            position: i,
            currentIngredient: current.name,
            currentPercentage: currentPercentage,
            previousIngredient: this.formula[i - 1].name,
            previousPercentage: this.formula[i - 1].percentage,
            message: `成分顺序错误："${current.name}" (${currentPercentage}%) 应在 "${this.formula[i - 1].name}" (${this.formula[i - 1].percentage}%) 之前`,
            suggestion: `请按照含量从高到低重新排列成分顺序`
          });
        }
      } else if (currentPercentage === previousPercentage) {
        if (samePercentageGroup.length === 0) {
          samePercentageGroup = [this.formula[i - 1], current];
        } else {
          samePercentageGroup.push(current);
        }
      } else {
        if (samePercentageGroup.length > 1) {
          this.suggestions.push({
            group: samePercentageGroup.map(ing => ing.name),
            percentage: samePercentageGroup[0].percentage,
            type: 'same_percentage_group',
            note: '这些成分含量相同，顺序可以互换，但建议保持一致性'
          });
        }
        samePercentageGroup = [];
      }
      
      previousPercentage = currentPercentage;
    }
    
    if (samePercentageGroup.length > 1) {
      this.suggestions.push({
        group: samePercentageGroup.map(ing => ing.name),
        percentage: samePercentageGroup[0].percentage,
        type: 'same_percentage_group',
        note: '这些成分含量相同，顺序可以互换，但建议保持一致性'
      });
    }
  }

  checkRestrictedIngredients() {
    const restricted = this.allergenRules.restrictedIngredients || [];
    
    for (const ingredient of this.formula) {
      const normalizedName = Parser.normalizeName(ingredient.name);
      
      for (const restrictedItem of restricted) {
        const restrictedName = Parser.normalizeName(restrictedItem.name);
        
        if (normalizedName === restrictedName) {
          if (restrictedItem.banned) {
            this.issues.push({
              type: 'BANNED_INGREDIENT',
              severity: 'critical',
              ingredient: ingredient.name,
              percentage: ingredient.percentage,
              message: `禁用成分："${ingredient.name}" 是禁用成分，不允许使用`,
              suggestion: `请立即移除禁用成分 "${ingredient.name}"`
            });
          } else if (restrictedItem.maxPercentage !== undefined) {
            if (ingredient.percentage > restrictedItem.maxPercentage) {
              this.issues.push({
                type: 'RESTRICTED_INGREDIENT_EXCEEDED',
                severity: 'high',
                ingredient: ingredient.name,
                currentPercentage: ingredient.percentage,
                maxPercentage: restrictedItem.maxPercentage,
                message: `限用成分超标："${ingredient.name}" 含量 ${ingredient.percentage}% 超过最大允许值 ${restrictedItem.maxPercentage}%`,
                suggestion: `请将 "${ingredient.name}" 的含量降低至 ${restrictedItem.maxPercentage}% 以下`
              });
            } else {
              this.suggestions.push({
                ingredient: ingredient.name,
                currentPercentage: ingredient.percentage,
                maxPercentage: restrictedItem.maxPercentage,
                type: 'restricted_within_limit',
                note: `限用成分 "${ingredient.name}" 含量 ${ingredient.percentage}% 在允许范围内 (最大 ${restrictedItem.maxPercentage}%)`
              });
            }
          }
        }
      }
    }
  }

  checkAllergenLabeling() {
    const allergens = this.allergenRules.allergens || [];
    const threshold = this.allergenRules.threshold || 0.001;
    
    const fragranceIngredients = this.formula.filter(ing => ing.isFragrance);
    const foundAllergens = [];
    
    for (const ingredient of fragranceIngredients) {
      const normalizedName = Parser.normalizeName(ingredient.name);
      
      for (const allergen of allergens) {
        const allergenName = Parser.normalizeName(allergen.name);
        const allergenChineseName = allergen.chineseName ? Parser.normalizeName(allergen.chineseName) : '';
        
        if (normalizedName === allergenName || normalizedName === allergenChineseName) {
          if (ingredient.percentage >= threshold) {
            foundAllergens.push({
              name: ingredient.name,
              percentage: ingredient.percentage,
              threshold: threshold
            });
          }
        }
      }
    }
    
    const labelText = this.packLabel.fullText.toLowerCase();
    const labeledAllergens = [];
    
    for (const allergen of foundAllergens) {
      const allergenName = Parser.normalizeName(allergen.name);
      
      if (labelText.includes(allergenName)) {
        labeledAllergens.push(allergen.name);
      } else {
        this.issues.push({
          type: 'ALLERGEN_NOT_LABELED',
          severity: 'high',
          allergen: allergen.name,
          percentage: allergen.percentage,
          threshold: threshold,
          message: `香精过敏原未标注："${allergen.name}" 含量 ${allergen.percentage}% 超过阈值 ${threshold}%，但未在标签中注明`,
          suggestion: `请在标签中添加香精过敏原标注，例如："香精(${allergen.name})"`
        });
      }
    }
    
    if (foundAllergens.length > 0) {
      this.suggestions.push({
        allergens: foundAllergens,
        labeled: labeledAllergens,
        type: 'fragrance_allergens_summary'
      });
    }
  }

  checkLabelIngredientsMatch() {
    const { inciMap, aliases } = this.inciDict;
    const labelIngredients = this.packLabel.ingredients;
    const formulaNames = this.formula.map(ing => {
      const normalized = Parser.normalizeName(ing.name);
      if (inciMap.has(normalized)) {
        return inciMap.get(normalized).standardName.toLowerCase();
      } else if (aliases.has(normalized)) {
        return aliases.get(normalized).toLowerCase();
      }
      return normalized;
    });
    
    for (const labelIngredient of labelIngredients) {
      const normalizedLabel = Parser.normalizeName(labelIngredient);
      
      let found = false;
      for (const formulaName of formulaNames) {
        if (normalizedLabel === formulaName) {
          found = true;
          break;
        }
        
        if (inciMap.has(normalizedLabel)) {
          const standardLabel = inciMap.get(normalizedLabel).standardName.toLowerCase();
          if (standardLabel === formulaName) {
            found = true;
            break;
          }
        }
        
        if (aliases.has(normalizedLabel)) {
          const standardLabel = aliases.get(normalizedLabel).toLowerCase();
          if (standardLabel === formulaName) {
            found = true;
            break;
          }
        }
      }
      
      if (!found) {
        this.issues.push({
          type: 'LABEL_INGREDIENT_NOT_IN_FORMULA',
          severity: 'medium',
          labelIngredient: labelIngredient,
          message: `标签中的成分 "${labelIngredient}" 未在配方中找到`,
          suggestion: `请确认标签中的成分 "${labelIngredient}" 是否应该包含在配方中，或者是否存在拼写错误`
        });
      }
    }
  }
}

module.exports = Rules;

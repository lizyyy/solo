const { REAGENT_CATEGORIES, HAZARD_LEVELS, STORAGE_CONDITIONS } = require('../config/constants');

class Reagent {
  constructor(data) {
    this.id = data.id;
    this.casNumber = data.casNumber;
    this.chineseName = data.chineseName;
    this.englishName = data.englishName;
    this.category = data.category;
    this.hazardLevel = data.hazardLevel;
    this.purity = data.purity;
    this.specification = data.specification;
    this.unit = data.unit;
    this.manufacturer = data.manufacturer;
    this.supplier = data.supplier;
    this.storageCondition = data.storageCondition;
    this.expiryMonths = data.expiryMonths;
    this.safetyDataSheet = data.safetyDataSheet;
    this.hazardPhrases = data.hazardPhrases || [];
    this.precautionaryPhrases = data.precautionaryPhrases || [];
    this.msdsUrl = data.msdsUrl;
    this.currentStock = data.currentStock || 0;
    this.minStock = data.minStock || 0;
    this.maxStock = data.maxStock || 0;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  static validate(data) {
    const errors = [];
    
    if (!data.casNumber || !/^\d{2,7}-\d{2}-\d$/.test(data.casNumber)) {
      errors.push('CAS号格式不正确，应为XXXXX-XX-X格式');
    }
    if (!data.chineseName || data.chineseName.length < 2) {
      errors.push('试剂中文名称不能为空且至少2个字符');
    }
    if (!Object.values(REAGENT_CATEGORIES).includes(data.category)) {
      errors.push('试剂类别不正确');
    }
    if (data.category === REAGENT_CATEGORIES.HAZARDOUS && !Object.values(HAZARD_LEVELS).includes(data.hazardLevel)) {
      errors.push('危化试剂必须指定危险等级');
    }
    if (!data.unit) {
      errors.push('计量单位不能为空');
    }
    if (!Object.values(STORAGE_CONDITIONS).includes(data.storageCondition)) {
      errors.push('存储条件不正确');
    }
    
    return { valid: errors.length === 0, errors };
  }
}

module.exports = Reagent;

const { v4: uuidv4 } = require('uuid');

class TaxRule {
  constructor(params) {
    this.id = params.id || uuidv4();
    this.name = params.name;
    this.code = params.code;
    this.taxRate = params.taxRate;
    this.taxType = params.taxType;
    this.applicableIndustry = params.applicableIndustry || null;
    this.effectiveDate = params.effectiveDate;
    this.expiryDate = params.expiryDate || null;
    this.isActive = params.isActive !== undefined ? params.isActive : true;
    this.priority = params.priority || 0;
    this.createdAt = params.createdAt || new Date().toISOString();
    this.updatedAt = params.updatedAt || new Date().toISOString();
  }

  isApplicableOn(date) {
    const checkDate = date ? new Date(date) : new Date();
    const effectiveDate = new Date(this.effectiveDate);
    const isAfterEffective = checkDate >= effectiveDate;
    
    if (!this.expiryDate) {
      return isAfterEffective;
    }
    
    const expiryDate = new Date(this.expiryDate);
    return isAfterEffective && checkDate <= expiryDate;
  }

  getTaxRatePercentage() {
    return (this.taxRate * 100).toFixed(2) + '%';
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      code: this.code,
      taxRate: this.taxRate,
      taxRatePercentage: this.getTaxRatePercentage(),
      taxType: this.taxType,
      applicableIndustry: this.applicableIndustry,
      effectiveDate: this.effectiveDate,
      expiryDate: this.expiryDate,
      isActive: this.isActive,
      priority: this.priority
    };
  }
}

module.exports = TaxRule;

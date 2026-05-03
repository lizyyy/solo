import moment from 'moment';

export const dateUtils = {
  isExpired: (expiryDate) => {
    if (!expiryDate) return false;
    return moment(expiryDate).isBefore(moment(), 'day');
  },
  
  isExpiringSoon: (expiryDate, days = 90) => {
    if (!expiryDate) return false;
    const expiry = moment(expiryDate);
    const now = moment();
    const daysUntilExpiry = expiry.diff(now, 'days');
    return daysUntilExpiry >= 0 && daysUntilExpiry <= days;
  },
  
  getDaysUntilExpiry: (expiryDate) => {
    if (!expiryDate) return null;
    return moment(expiryDate).diff(moment(), 'days');
  },
  
  formatDate: (date) => {
    if (!date) return null;
    return moment(date).format('YYYY-MM-DD');
  },
  
  formatDateTime: (date) => {
    if (!date) return null;
    return moment(date).format('YYYY-MM-DD HH:mm:ss');
  }
};

export const unitUtils = {
  unitConversion: {
    weight: {
      base: 'g',
      g: 1,
      kg: 1000,
      mg: 0.001,
      '斤': 500,
      '磅': 453.592
    },
    volume: {
      base: 'ml',
      ml: 1,
      l: 1000,
      tsp: 5,
      tbsp: 15,
      '杯': 240
    },
    count: {
      base: '个',
      '个': 1,
      '件': 1,
      '套': 1,
      '盒': 1,
      '箱': 1
    }
  },
  
  getUnitType(unit) {
    const u = unit.toLowerCase();
    if (this.unitConversion.weight[u]) return 'weight';
    if (this.unitConversion.volume[u]) return 'volume';
    if (this.unitConversion.count[unit]) return 'count';
    return null;
  },
  
  canConvert(unit1, unit2) {
    const type1 = this.getUnitType(unit1);
    const type2 = this.getUnitType(unit2);
    return type1 && type2 && type1 === type2;
  },
  
  convert(value, fromUnit, toUnit) {
    const fromType = this.getUnitType(fromUnit);
    const toType = this.getUnitType(toUnit);
    
    if (!fromType || !toType || fromType !== toType) {
      return null;
    }
    
    const conversion = this.unitConversion[fromType];
    const fromFactor = conversion[fromUnit.toLowerCase()] || conversion[fromUnit];
    const toFactor = conversion[toUnit.toLowerCase()] || conversion[toUnit];
    
    if (!fromFactor || !toFactor) return null;
    
    return (value * fromFactor) / toFactor;
  },
  
  validateUnits(recipeUnit, batchUnit) {
    if (recipeUnit === batchUnit) {
      return { valid: true, canConvert: true };
    }
    
    const canConvert = this.canConvert(recipeUnit, batchUnit);
    return {
      valid: canConvert,
      canConvert,
      message: canConvert ? `单位可转换: ${recipeUnit} -> ${batchUnit}` : `单位不兼容: ${recipeUnit} 和 ${batchUnit} 无法转换`
    };
  }
};

export const calculateUtils = {
  calculateCostWithLoss: (quantity, unitPrice, lossRate = 0) => {
    const effectiveQuantity = quantity * (1 + lossRate / 100);
    return effectiveQuantity * unitPrice;
  },
  
  calculateRequiredQuantity: (baseQuantity, lossRate = 0) => {
    return baseQuantity * (1 + lossRate / 100);
  },
  
  calculateProfit: (totalPrice, totalCost) => {
    return totalPrice - totalCost;
  },
  
  calculateProfitMargin: (totalPrice, totalCost) => {
    if (totalPrice === 0) return 0;
    return ((totalPrice - totalCost) / totalPrice) * 100;
  },
  
  isNegativeMargin: (totalPrice, totalCost) => {
    return totalPrice < totalCost;
  }
};

export const allergenUtils = {
  parseAllergens: (allergenString) => {
    if (!allergenString || allergenString.trim() === '') {
      return [];
    }
    return allergenString.split(',').map(a => a.trim()).filter(a => a);
  },
  
  hasAllergenConflict(materialAllergens, recipeRestrictions) {
    const materialList = this.parseAllergens(materialAllergens);
    const restrictionList = this.parseAllergens(recipeRestrictions);
    
    for (const allergen of materialList) {
      if (restrictionList.includes(allergen)) {
        return {
          conflict: true,
          allergen,
          message: `检测到过敏原冲突: ${allergen}`
        };
      }
    }
    return { conflict: false };
  },
  
  getAllAllergensFromBatches(batches) {
    const allergens = new Set();
    for (const batch of batches) {
      if (batch.allergens) {
        this.parseAllergens(batch.allergens).forEach(a => allergens.add(a));
      }
      if (batch.material?.allergens) {
        this.parseAllergens(batch.material.allergens).forEach(a => allergens.add(a));
      }
    }
    return Array.from(allergens);
  }
};

export const warningUtils = {
  checkMaterialBatch: (batch) => {
    const warnings = [];
    
    if (batch.remainingQuantity <= 0) {
      warnings.push({
        type: 'empty',
        severity: 'warning',
        message: '该批次库存已用完',
        batchNumber: batch.batchNumber
      });
    } else if (batch.remainingQuantity < batch.quantity * 0.1) {
      warnings.push({
        type: 'low_stock',
        severity: 'warning',
        message: '库存不足10%',
        remaining: batch.remainingQuantity,
        unit: batch.unit
      });
    }
    
    if (dateUtils.isExpired(batch.expiryDate)) {
      warnings.push({
        type: 'expired',
        severity: 'danger',
        message: '材料已过期',
        expiryDate: batch.expiryDate
      });
    } else if (dateUtils.isExpiringSoon(batch.expiryDate, 30)) {
      const days = dateUtils.getDaysUntilExpiry(batch.expiryDate);
      warnings.push({
        type: 'expiring_soon',
        severity: 'warning',
        message: `材料将在 ${days} 天后过期`,
        expiryDate: batch.expiryDate,
        daysUntilExpiry: days
      });
    }
    
    return warnings;
  },
  
  checkOrder: (order) => {
    const warnings = [];
    
    if (order.profit !== null && order.profit < 0) {
      warnings.push({
        type: 'negative_margin',
        severity: 'danger',
        message: `订单亏损 ${Math.abs(order.profit)} 元`,
        profit: order.profit,
        profitMargin: order.profitMargin
      });
    } else if (order.profitMargin !== null && order.profitMargin < 10) {
      warnings.push({
        type: 'low_margin',
        severity: 'warning',
        message: `利润率过低 (${order.profitMargin.toFixed(2)}%)`,
        profitMargin: order.profitMargin
      });
    }
    
    return warnings;
  },
  
  checkProductionFeasibility(recipe, materialBatches, productionQuantity) {
    const issues = [];
    const requirements = [];
    
    for (const ingredient of recipe.ingredients) {
      const requiredBase = ingredient.quantity * productionQuantity;
      const requiredWithLoss = calculateUtils.calculateRequiredQuantity(requiredBase, ingredient.lossRate);
      
      const availableBatches = materialBatches.filter(
        b => b.materialId === ingredient.materialId && b.status === 'active' && b.remainingQuantity > 0
      );
      
      let totalAvailable = 0;
      let unitMismatch = false;
      
      for (const batch of availableBatches) {
        const validation = unitUtils.validateUnits(ingredient.unit, batch.unit);
        if (validation.canConvert) {
          const converted = unitUtils.convert(batch.remainingQuantity, batch.unit, ingredient.unit);
          if (converted !== null) {
            totalAvailable += converted;
          }
        } else {
          unitMismatch = true;
        }
      }
      
      requirements.push({
        materialId: ingredient.materialId,
        materialName: ingredient.material?.name || '未知材料',
        required: requiredWithLoss,
        unit: ingredient.unit,
        available: totalAvailable,
        availableBatches: availableBatches.length,
        hasUnitMismatch: unitMismatch
      });
      
      if (totalAvailable < requiredWithLoss) {
        issues.push({
          type: 'insufficient_stock',
          severity: 'danger',
          message: `${ingredient.material?.name || '材料'} 库存不足`,
          required: requiredWithLoss,
          available: totalAvailable,
          unit: ingredient.unit,
          shortage: requiredWithLoss - totalAvailable
        });
      }
      
      const allergenWarnings = this.checkRecipeAllergens(ingredient, availableBatches);
      issues.push(...allergenWarnings);
      
      const expiryWarnings = this.checkBatchExpiry(availableBatches);
      issues.push(...expiryWarnings);
    }
    
    return {
      feasible: issues.filter(i => i.severity === 'danger').length === 0,
      issues,
      requirements
    };
  },
  
  checkRecipeAllergens(ingredient, batches) {
    const warnings = [];
    const materialAllergens = new Set();
    
    for (const batch of batches) {
      if (batch.allergens) {
        allergenUtils.parseAllergens(batch.allergens).forEach(a => materialAllergens.add(a));
      }
    }
    
    if (materialAllergens.size > 0) {
      warnings.push({
        type: 'allergen_warning',
        severity: 'info',
        message: `材料含过敏原: ${Array.from(materialAllergens).join(', ')}`,
        allergens: Array.from(materialAllergens)
      });
    }
    
    return warnings;
  },
  
  checkBatchExpiry(batches) {
    const warnings = [];
    
    for (const batch of batches) {
      if (dateUtils.isExpired(batch.expiryDate)) {
        warnings.push({
          type: 'expired_batch',
          severity: 'danger',
          message: `批次 ${batch.batchNumber} 已过期`,
          batchNumber: batch.batchNumber,
          expiryDate: batch.expiryDate
        });
      } else if (dateUtils.isExpiringSoon(batch.expiryDate, 30)) {
        const days = dateUtils.getDaysUntilExpiry(batch.expiryDate);
        warnings.push({
          type: 'expiring_batch',
          severity: 'warning',
          message: `批次 ${batch.batchNumber} 将在 ${days} 天后过期`,
          batchNumber: batch.batchNumber,
          daysUntilExpiry: days
        });
      }
    }
    
    return warnings;
  }
};

export const mapperUtils = {
  mapMaterialBatch(batch) {
    if (!batch) return null;
    return {
      ...batch,
      batchNo: batch.batchNumber,
      originalQuantity: batch.quantity,
      currentQuantity: batch.remainingQuantity,
      unitCost: batch.unitPrice,
      materialName: batch.material?.name,
      supplierName: batch.supplier?.name,
      isExpired: dateUtils.isExpired(batch.expiryDate),
      isExpiring: dateUtils.isExpiringSoon(batch.expiryDate, 30),
      allergens: allergenUtils.parseAllergens(batch.allergens || batch.material?.allergens),
      remarks: batch.note
    };
  },

  mapMaterialBatchList(batches) {
    if (!batches || !Array.isArray(batches)) return [];
    return batches.map(b => this.mapMaterialBatch(b));
  },

  mapRecipeIngredient(ingredient) {
    if (!ingredient) return null;
    return {
      ...ingredient,
      wasteRate: ingredient.lossRate,
      materialName: ingredient.material?.name,
      remarks: ingredient.note
    };
  },

  mapRecipe(recipe) {
    if (!recipe) return null;
    const ingredients = recipe.ingredients?.map(i => this.mapRecipeIngredient(i)) || [];
    return {
      ...recipe,
      productName: recipe.product?.name,
      ingredients,
      isActive: recipe.isDefault
    };
  },

  mapRecipeList(recipes) {
    if (!recipes || !Array.isArray(recipes)) return [];
    return recipes.map(r => this.mapRecipe(r));
  },

  mapOrder(order) {
    if (!order) return null;
    return {
      ...order,
      orderNo: order.orderNumber,
      totalAmount: order.totalPrice,
      customerName: order.customer?.name,
      orderDate: order.createdAt ? dateUtils.formatDate(order.createdAt) : null,
      remarks: order.note,
      items: order.items?.map(item => ({
        ...item,
        estimatedCost: item.unitCost
      })) || []
    };
  },

  mapOrderList(orders) {
    if (!orders || !Array.isArray(orders)) return [];
    return orders.map(o => this.mapOrder(o));
  },

  mapProductionBatch(production) {
    if (!production) return null;
    return {
      ...production,
      productionNo: production.batchNumber,
      productName: production.product?.name,
      materials: production.materials?.map(m => ({
        ...m,
        materialBatchId: m.materialBatchId,
        materialName: m.materialBatch?.material?.name,
        batchNo: m.materialBatch?.batchNumber
      })) || []
    };
  },

  mapProductionBatchList(productions) {
    if (!productions || !Array.isArray(productions)) return [];
    return productions.map(p => this.mapProductionBatch(p));
  },

  mapTraceResult(trace) {
    if (!trace) return null;
    return {
      batch: {
        ...trace.batch,
        batchNo: trace.batch.batchNumber,
        originalQuantity: trace.batch.quantity,
        currentQuantity: trace.batch.remainingQuantity,
        unitCost: trace.batch.unitPrice,
        supplierName: trace.batch.supplier
      },
      affectedProductions: trace.affectedProduction?.map(p => ({
        ...p,
        productionNo: p.batchNumber
      })) || [],
      affectedOrders: trace.affectedOrders?.map(o => ({
        ...o,
        orderNo: o.orderNumber,
        totalAmount: o.totalPrice
      })) || [],
      summary: trace.summary
    };
  }
};

export default {
  dateUtils,
  unitUtils,
  calculateUtils,
  allergenUtils,
  warningUtils,
  mapperUtils
};

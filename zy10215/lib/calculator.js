const store = require('./store');

const ROUNDING_STRATEGY = 'ceil';
const MIN_MULTIPLIER = 1;

function roundMultiplier(x) {
  switch (ROUNDING_STRATEGY) {
    case 'ceil':
      return Math.max(MIN_MULTIPLIER, Math.ceil(x));
    case 'floor':
      return Math.max(MIN_MULTIPLIER, Math.floor(x));
    case 'round':
      return Math.max(MIN_MULTIPLIER, Math.round(x));
    default:
      return Math.max(MIN_MULTIPLIER, Math.ceil(x));
  }
}

function getInventory(inventoryList, itemId) {
  return inventoryList.find(i => i.itemId === itemId) || null;
}

function getRecipe(recipes, recipeId) {
  return recipes.find(r => r.recipeId === recipeId) || null;
}

function getSubstitutes(substitutes, itemId) {
  return substitutes.filter(s => s.originalId === itemId);
}

function getLossRate(losses, recipeId) {
  const relevantLosses = losses.filter(l => l.recipeId === recipeId);
  if (relevantLosses.length === 0) return 0.02;
  const sum = relevantLosses.reduce((acc, l) => acc + l.lossRate, 0);
  return sum / relevantLosses.length;
}

function calculateAllergenFlags(ingredient, inventories, substitutes) {
  const inv = getInventory(inventories, ingredient.itemId);
  const baseAllergens = inv ? (inv.allergens || []) : [];
  
  const allAllergens = new Set(baseAllergens);
  
  if (ingredient.substitutedWith) {
    const subInv = getInventory(inventories, ingredient.substitutedWith);
    if (subInv && subInv.allergens) {
      subInv.allergens.forEach(a => allAllergens.add(a));
    }
  }
  
  return Array.from(allAllergens);
}

function validateAllergenForSubstitute(originalItemId, substituteItemId, inventories) {
  const originalInv = getInventory(inventories, originalItemId);
  const subInv = getInventory(inventories, substituteItemId);
  
  if (!subInv) return { valid: false, reason: '替代原料不存在' };
  if (!originalInv) return { valid: true, reason: '原原料无过敏信息' };
  
  if (!subInv.allergens || subInv.allergens.length === 0) {
    if (originalInv.allergens && originalInv.allergens.length > 0) {
      return { 
        valid: false, 
        reason: '替代原料过敏标识缺失（原原料有过敏原，但替代原料未标注）',
        originalAllergens: originalInv.allergens,
        substituteAllergens: []
      };
    }
  }
  
  return { valid: true };
}

function calculateRequirements(recipes, orders, inventories, substitutes, losses) {
  const orderMap = {};
  orders.forEach(order => {
    order.items.forEach(item => {
      if (!orderMap[item.productId]) {
        orderMap[item.productId] = {
          productId: item.productId,
          productName: item.productName,
          totalQuantity: 0,
          orders: []
        };
      }
      orderMap[item.productId].totalQuantity += item.quantity;
      orderMap[item.productId].orders.push({
        storeId: order.storeId,
        storeName: order.storeName,
        quantity: item.quantity
      });
    });
  });

  const productPlan = [];
  const ingredientRequirements = {};
  const roundingVariances = [];
  const allergenWarnings = [];

  Object.values(orderMap).forEach(product => {
    const recipe = getRecipe(recipes, product.productId);
    if (!recipe) {
      throw new Error(`找不到产品 ${product.productName} (${product.productId}) 的配方`);
    }

    const batchSize = recipe.batchSize || 1;
    const exactMultiplier = product.totalQuantity / batchSize;
    const roundedMultiplier = roundMultiplier(exactMultiplier);
    const actualOutput = roundedMultiplier * batchSize;
    const surplus = actualOutput - product.totalQuantity;
    const surplusPercent = product.totalQuantity > 0 ? (surplus / product.totalQuantity) * 100 : 0;

    const recipeCost = recipe.ingredients.reduce((sum, ing) => {
      const inv = getInventory(inventories, ing.itemId);
      return sum + (inv ? inv.unitCost * ing.quantityPerBatch : 0);
    }, 0);
    
    const exactCost = recipeCost * exactMultiplier;
    const roundedCost = recipeCost * roundedMultiplier;
    const costVariance = roundedCost - exactCost;
    const costVariancePercent = exactCost > 0 ? (costVariance / exactCost) * 100 : 0;

    if (roundedMultiplier !== exactMultiplier) {
      roundingVariances.push({
        productId: product.productId,
        productName: product.productName,
        exactMultiplier: Number(exactMultiplier.toFixed(3)),
        roundedMultiplier,
        exactCost: Number(exactCost.toFixed(2)),
        roundedCost: Number(roundedCost.toFixed(2)),
        costVariance: Number(costVariance.toFixed(2)),
        costVariancePercent: Number(costVariancePercent.toFixed(2)),
        surplus,
        surplusPercent: Number(surplusPercent.toFixed(2))
      });
    }

    const lossRate = getLossRate(losses, product.productId);
    const adjustedMultiplier = roundedMultiplier * (1 + lossRate);

    recipe.ingredients.forEach(ing => {
      if (!ingredientRequirements[ing.itemId]) {
        ingredientRequirements[ing.itemId] = {
          itemId: ing.itemId,
          itemName: ing.itemName,
          unit: ing.unit,
          required: 0,
          available: 0,
          substitutions: [],
          originalInv: null
        };
      }
      
      const inv = getInventory(inventories, ing.itemId);
      ingredientRequirements[ing.itemId].required += ing.quantityPerBatch * adjustedMultiplier;
      ingredientRequirements[ing.itemId].available = inv ? inv.quantity : 0;
      ingredientRequirements[ing.itemId].originalInv = inv;
    });

    productPlan.push({
      productId: product.productId,
      productName: product.productName,
      batchSize,
      exactMultiplier: Number(exactMultiplier.toFixed(3)),
      roundedMultiplier,
      actualOutput,
      demand: product.totalQuantity,
      surplus,
      surplusPercent: Number(surplusPercent.toFixed(2)),
      costPerBatch: Number(recipeCost.toFixed(2)),
      exactCost: Number(exactCost.toFixed(2)),
      roundedCost: Number(roundedCost.toFixed(2)),
      costVariance: Number(costVariance.toFixed(2)),
      costVariancePercent: Number(costVariancePercent.toFixed(2)),
      lossRate: Number((lossRate * 100).toFixed(2)),
      storeOrders: product.orders
    });
  });

  const shortages = [];
  const substitutionDetails = [];

  Object.keys(ingredientRequirements).forEach(itemId => {
    const req = ingredientRequirements[itemId];
    const netRequired = Math.ceil(req.required * 1000) / 1000;
    
    if (req.available < netRequired) {
      const deficit = netRequired - req.available;
      const subList = getSubstitutes(substitutes, itemId);
      let covered = false;

      for (const sub of subList) {
        const subInv = getInventory(inventories, sub.substituteId);
        if (!subInv) continue;

        const allergenCheck = validateAllergenForSubstitute(itemId, sub.substituteId, inventories);
        if (!allergenCheck.valid) {
          allergenWarnings.push({
            originalId: itemId,
            originalName: req.itemName,
            substituteId: sub.substituteId,
            substituteName: subInv.itemName,
            reason: allergenCheck.reason,
            originalAllergens: allergenCheck.originalAllergens,
            substituteAllergens: allergenCheck.substituteAllergens
          });
        }

        const conversionRatio = sub.conversionRatio || 1;
        const subNeeded = deficit * conversionRatio;
        const subAvailable = subInv.quantity;
        const subDeficit = subNeeded - subAvailable;

        req.substitutions.push({
          substituteId: sub.substituteId,
          substituteName: subInv.itemName,
          conversionRatio,
          priority: sub.priority || 1,
          notes: sub.notes || '',
          needed: Number(subNeeded.toFixed(3)),
          available: subAvailable
        });

        if (subAvailable >= subNeeded) {
          covered = true;
          substitutionDetails.push({
            originalId: itemId,
            originalName: req.itemName,
            substituteId: sub.substituteId,
            substituteName: subInv.itemName,
            originalDeficit: Number(deficit.toFixed(3)),
            substituteUsed: Number(subNeeded.toFixed(3)),
            conversionRatio
          });
          break;
        }
      }

      if (!covered) {
        shortages.push({
          itemId,
          itemName: req.itemName,
          unit: req.unit,
          required: Number(netRequired.toFixed(3)),
          available: req.available,
          deficit: Number(deficit.toFixed(3)),
          deficitPercent: Number((deficit / netRequired * 100).toFixed(2))
        });
      }
    }
  });

  return {
    productPlan,
    ingredientRequirements,
    shortages,
    substitutions: substitutionDetails,
    allergenWarnings,
    roundingVariances
  };
}

function calculateBatchCost(productPlan, inventories, shortages) {
  const hasShortages = shortages.length > 0;
  let totalCost = 0;
  let totalCostVariance = 0;
  let totalExactCost = 0;
  let totalRoundedCost = 0;

  productPlan.forEach(plan => {
    totalExactCost += plan.exactCost;
    totalRoundedCost += plan.roundedCost;
    totalCostVariance += plan.costVariance;
    totalCost += plan.roundedCost;
  });

  return {
    canProduce: !hasShortages,
    totalExactCost: Number(totalExactCost.toFixed(2)),
    totalRoundedCost: Number(totalRoundedCost.toFixed(2)),
    totalCostVariance: Number(totalCostVariance.toFixed(2)),
    variancePercent: totalExactCost > 0 ? Number((totalCostVariance / totalExactCost * 100).toFixed(2)) : 0,
    shortageCount: shortages.length,
    productCount: productPlan.length
  };
}

module.exports = {
  calculateRequirements,
  calculateBatchCost,
  getInventory,
  getRecipe,
  getSubstitutes,
  validateAllergenForSubstitute,
  calculateAllergenFlags,
  roundMultiplier,
  getLossRate
};

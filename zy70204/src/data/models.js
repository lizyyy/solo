export const FIRING_TEMPERATURE_RANGES = {
  LOW: { min: 900, max: 1050, name: '低温釉 (900-1050℃)' },
  MID: { min: 1050, max: 1200, name: '中温釉 (1050-1200℃)' },
  HIGH: { min: 1200, max: 1400, name: '高温釉 (1200-1400℃)' },
};

export const FIRING_ATMOSPHERE = {
  OXIDATION: '氧化焰',
  REDUCTION: '还原焰',
};

export const ERROR_TYPES = {
  RATIO_SUM_INVALID: 'RATIO_SUM_INVALID',
  RATIO_NEGATIVE: 'RATIO_NEGATIVE',
  RATIO_OUT_OF_BOUNDS: 'RATIO_OUT_OF_BOUNDS',
  INVENTORY_INSUFFICIENT: 'INVENTORY_INSUFFICIENT',
  TEMPERATURE_OUT_OF_RANGE: 'TEMPERATURE_OUT_OF_RANGE',
  GLAZE_INCOMPATIBLE: 'GLAZE_INCOMPATIBLE',
  MISSING_REQUIRED: 'MISSING_REQUIRED',
};

export class GlazeMaterial {
  constructor({
    id,
    name,
    costPerGram,
    currentStock,
    minRatio,
    maxRatio,
    temperatureRange,
    incompatibleWith = [],
    colorInfluence,
    notes = '',
  }) {
    this.id = id;
    this.name = name;
    this.costPerGram = costPerGram;
    this.currentStock = currentStock;
    this.minRatio = minRatio;
    this.maxRatio = maxRatio;
    this.temperatureRange = temperatureRange;
    this.incompatibleWith = incompatibleWith;
    this.colorInfluence = colorInfluence;
    this.notes = notes;
  }
}

export class GlazeRecipe {
  constructor({
    id,
    name,
    ingredients = [],
    targetTemperature,
    firingAtmosphere,
    targetColor,
    createdAt = new Date().toISOString(),
    updatedAt = new Date().toISOString(),
  }) {
    this.id = id;
    this.name = name;
    this.ingredients = ingredients;
    this.targetTemperature = targetTemperature;
    this.firingAtmosphere = firingAtmosphere;
    this.targetColor = targetColor;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

export class TestPiece {
  constructor({
    id,
    recipeId,
    recipeSnapshot,
    actualTemperature,
    actualAtmosphere,
    observedColor,
    colorDifference,
    costResult,
    notes,
    createdAt = new Date().toISOString(),
  }) {
    this.id = id;
    this.recipeId = recipeId;
    this.recipeSnapshot = recipeSnapshot;
    this.actualTemperature = actualTemperature;
    this.actualAtmosphere = actualAtmosphere;
    this.observedColor = observedColor;
    this.colorDifference = colorDifference;
    this.costResult = costResult;
    this.notes = notes;
    this.createdAt = createdAt;
  }
}

export class HistoryRecord {
  constructor({
    id,
    entityType,
    entityId,
    action,
    beforeState,
    afterState,
    description,
    timestamp = new Date().toISOString(),
  }) {
    this.id = id;
    this.entityType = entityType;
    this.entityId = entityId;
    this.action = action;
    this.beforeState = beforeState;
    this.afterState = afterState;
    this.description = description;
    this.timestamp = timestamp;
  }
}

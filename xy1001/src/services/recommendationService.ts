import { Measurement, RecommendationResult, HistoryRecord, PetType, BodyShape, SizeChart } from '../types';
import { findBestSize, generateSizeReasoning, getSizeChartsByCriteria } from '../data/sizeCharts';
import { recommendMaterials, generateMaterialTips } from '../data/materialRules';

const STORAGE_KEYS = {
  HISTORY_RECORDS: 'pet_clothing_history_records',
  CURRENT_MEASUREMENT: 'pet_clothing_current_measurement',
  CURRENT_RECOMMENDATION: 'pet_clothing_current_recommendation',
};

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function saveToLocalStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
}

export function loadFromLocalStorage<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored) as T;
    }
  } catch (error) {
    console.error('Error loading from localStorage:', error);
  }
  return defaultValue;
}

export function removeFromLocalStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Error removing from localStorage:', error);
  }
}

export interface RecommendationService {
  createMeasurement: (data: Omit<Measurement, 'id'>) => Measurement;
  generateRecommendation: (measurement: Measurement) => RecommendationResult;
  createHistoryRecord: (
    petName: string,
    measurement: Measurement,
    recommendation: RecommendationResult
  ) => HistoryRecord;
  getAllHistoryRecords: () => HistoryRecord[];
  getHistoryRecord: (id: string) => HistoryRecord | undefined;
  updateHistoryRecord: (id: string, updates: Partial<HistoryRecord>) => HistoryRecord | undefined;
  deleteHistoryRecord: (id: string) => boolean;
}

export const recommendationService: RecommendationService = {
  createMeasurement(data) {
    const measurement: Measurement = {
      id: generateId(),
      ...data,
    };
    saveToLocalStorage(STORAGE_KEYS.CURRENT_MEASUREMENT, measurement);
    return measurement;
  },

  generateRecommendation(measurement) {
    const { petType, bodyShape, chest, length, neck, weight, season, scenario, coatType } = measurement;

    const { bestSize, confidence, alternatives } = findBestSize(
      petType,
      bodyShape,
      chest,
      length,
      neck,
      weight
    );

    const materialRecs = recommendMaterials(season, coatType, scenario);

    const recommendedMaterials: RecommendationResult['recommendedMaterials'] = materialRecs
      .filter(m => m.priority === 'high' || (m.priority === 'medium' && materialRecs.length < 3))
      .slice(0, 5)
      .map(m => ({
        materialType: m.material.materialType,
        name: m.material.name,
        reason: m.reasons.join('；'),
        priority: m.priority,
      }));

    const overallTips = generateMaterialTips(season, coatType, scenario);

    if (bestSize) {
      overallTips.unshift(generateSizeReasoning(chest, length, bestSize, confidence, alternatives));
    }

    const recommendation: RecommendationResult = {
      id: generateId(),
      measurementId: measurement.id,
      timestamp: Date.now(),
      recommendedSize: bestSize?.sizeCode || 'M',
      sizeConfidence: confidence,
      alternativeSizes: alternatives.map(a => a.sizeCode),
      sizeReasoning: bestSize 
        ? generateSizeReasoning(chest, length, bestSize, confidence, alternatives)
        : '无法根据提供的数据推荐准确尺码，请重新测量。',
      recommendedMaterials,
      overallTips,
    };

    saveToLocalStorage(STORAGE_KEYS.CURRENT_RECOMMENDATION, recommendation);
    return recommendation;
  },

  createHistoryRecord(petName, measurement, recommendation) {
    const record: HistoryRecord = {
      id: generateId(),
      petName,
      measurement,
      recommendation,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const existingRecords = this.getAllHistoryRecords();
    existingRecords.unshift(record);
    saveToLocalStorage(STORAGE_KEYS.HISTORY_RECORDS, existingRecords);

    return record;
  },

  getAllHistoryRecords() {
    return loadFromLocalStorage<HistoryRecord[]>(STORAGE_KEYS.HISTORY_RECORDS, []);
  },

  getHistoryRecord(id) {
    const records = this.getAllHistoryRecords();
    return records.find(r => r.id === id);
  },

  updateHistoryRecord(id, updates) {
    const records = this.getAllHistoryRecords();
    const index = records.findIndex(r => r.id === id);
    
    if (index === -1) return undefined;
    
    records[index] = {
      ...records[index],
      ...updates,
      updatedAt: Date.now(),
    };
    
    saveToLocalStorage(STORAGE_KEYS.HISTORY_RECORDS, records);
    return records[index];
  },

  deleteHistoryRecord(id) {
    const records = this.getAllHistoryRecords();
    const filtered = records.filter(r => r.id !== id);
    saveToLocalStorage(STORAGE_KEYS.HISTORY_RECORDS, filtered);
    return filtered.length < records.length;
  },
};

export function getCurrentMeasurement(): Measurement | null {
  return loadFromLocalStorage<Measurement | null>(STORAGE_KEYS.CURRENT_MEASUREMENT, null);
}

export function getCurrentRecommendation(): RecommendationResult | null {
  return loadFromLocalStorage<RecommendationResult | null>(STORAGE_KEYS.CURRENT_RECOMMENDATION, null);
}

export function clearCurrentSession(): void {
  removeFromLocalStorage(STORAGE_KEYS.CURRENT_MEASUREMENT);
  removeFromLocalStorage(STORAGE_KEYS.CURRENT_RECOMMENDATION);
}

export function getAllSizeChartsForType(petType: PetType, bodyShape?: BodyShape): SizeChart[] {
  return getSizeChartsByCriteria(petType, bodyShape);
}

export function validateMeasurement(measurement: Partial<Measurement>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!measurement.petType) {
    errors.push('请选择宠物类型');
  }

  if (!measurement.bodyShape) {
    errors.push('请选择体型分类');
  }

  if (!measurement.chest || measurement.chest <= 0) {
    errors.push('请输入有效的胸围');
  } else if (measurement.chest < 10 || measurement.chest > 150) {
    errors.push('胸围数值超出合理范围（10-150cm）');
  }

  if (!measurement.length || measurement.length <= 0) {
    errors.push('请输入有效的背长');
  } else if (measurement.length < 10 || measurement.length > 120) {
    errors.push('背长数值超出合理范围（10-120cm）');
  }

  if (!measurement.season) {
    errors.push('请选择季节');
  }

  if (!measurement.scenario) {
    errors.push('请选择穿着场景');
  }

  if (!measurement.coatType) {
    errors.push('请选择毛发类型');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

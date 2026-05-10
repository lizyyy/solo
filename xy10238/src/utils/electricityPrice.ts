import type { ElectricityPrice, EnergyConsumption, ValidationWarning } from '../types';

export interface PriceSimulationInput {
  consumption: EnergyConsumption;
  price: ElectricityPrice;
  timeOfUseProfile?: TimeOfUseProfile;
}

export interface TimeOfUseProfile {
  peakHours: number[];
  offPeakHours: number[];
  peakRatio: number;
}

export interface CostCalculationResult {
  baseCost: number;
  peakCost: number;
  offPeakCost: number;
  totalCost: number;
  breakdown: {
    tier: string;
    kWh: number;
    rate: number;
    cost: number;
  }[];
}

export const DEFAULT_TIME_OF_USE_PROFILE: TimeOfUseProfile = {
  peakHours: [8, 9, 10, 11, 12, 17, 18, 19, 20, 21],
  offPeakHours: [0, 1, 2, 3, 4, 5, 6, 7, 13, 14, 15, 16, 22, 23],
  peakRatio: 0.6,
};

export const calculateCost = (
  consumption: EnergyConsumption,
  price: ElectricityPrice,
  timeProfile: TimeOfUseProfile = DEFAULT_TIME_OF_USE_PROFILE
): CostCalculationResult => {
  const kWh = consumption.weatherCorrectedConsumption ?? consumption.kWhConsumed;
  
  if (!price.hasTimeOfUse) {
    return {
      baseCost: parseFloat((kWh * price.pricePerKWh).toFixed(2)),
      peakCost: 0,
      offPeakCost: 0,
      totalCost: parseFloat((kWh * price.pricePerKWh).toFixed(2)),
      breakdown: [{
        tier: '统一电价',
        kWh,
        rate: price.pricePerKWh,
        cost: parseFloat((kWh * price.pricePerKWh).toFixed(2)),
      }],
    };
  }

  const peakKWh = kWh * timeProfile.peakRatio;
  const offPeakKWh = kWh * (1 - timeProfile.peakRatio);

  const peakCost = peakKWh * price.peakPrice;
  const offPeakCost = offPeakKWh * price.offPeakPrice;
  const totalCost = peakCost + offPeakCost;

  return {
    baseCost: parseFloat(totalCost.toFixed(2)),
    peakCost: parseFloat(peakCost.toFixed(2)),
    offPeakCost: parseFloat(offPeakCost.toFixed(2)),
    totalCost: parseFloat(totalCost.toFixed(2)),
    breakdown: [
      {
        tier: '峰时电价',
        kWh: parseFloat(peakKWh.toFixed(2)),
        rate: price.peakPrice,
        cost: parseFloat(peakCost.toFixed(2)),
      },
      {
        tier: '谷时电价',
        kWh: parseFloat(offPeakKWh.toFixed(2)),
        rate: price.offPeakPrice,
        cost: parseFloat(offPeakCost.toFixed(2)),
      },
    ],
  };
};

export const validateElectricityPrice = (
  price: Partial<ElectricityPrice>,
  existingPrices: ElectricityPrice[]
): { isValid: boolean; errors: ValidationWarning[]; warnings: ValidationWarning[] } => {
  const errors: ValidationWarning[] = [];
  const warnings: ValidationWarning[] = [];

  if (!price.name || price.name === '') {
    errors.push({
      type: 'price_mismatch',
      field: 'name',
      message: '电价方案名称是必填字段',
    });
  }

  if (price.pricePerKWh !== undefined) {
    if (price.pricePerKWh <= 0) {
      errors.push({
        type: 'price_mismatch',
        field: 'pricePerKWh',
        message: '电价必须大于0',
        value: price.pricePerKWh,
      });
    } else if (price.pricePerKWh < 0.2 || price.pricePerKWh > 3) {
      warnings.push({
        type: 'price_mismatch',
        field: 'pricePerKWh',
        message: `电价 ${price.pricePerKWh} 元/kWh 超出常见范围(0.2-3.0)`,
        value: price.pricePerKWh,
      });
    }
  }

  if (price.hasTimeOfUse) {
    if (!price.peakPrice || price.peakPrice <= 0) {
      errors.push({
        type: 'price_mismatch',
        field: 'peakPrice',
        message: '峰时电价是必填字段',
        value: price.peakPrice,
      });
    }
    if (!price.offPeakPrice || price.offPeakPrice <= 0) {
      errors.push({
        type: 'price_mismatch',
        field: 'offPeakPrice',
        message: '谷时电价是必填字段',
        value: price.offPeakPrice,
      });
    }
    if (price.peakPrice && price.offPeakPrice && price.peakPrice <= price.offPeakPrice) {
      warnings.push({
        type: 'price_mismatch',
        field: 'peakPrice',
        message: '峰时电价应高于谷时电价',
        value: price.peakPrice,
      });
    }
  }

  if (price.name) {
    const duplicate = existingPrices.find(
      (p) => p.name.toLowerCase() === price.name!.toLowerCase()
    );
    if (duplicate) {
      errors.push({
        type: 'price_mismatch',
        field: 'name',
        message: `电价方案名称 "${price.name}" 已存在`,
        value: price.name,
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

export const createPriceScenario = (
  params: Partial<ElectricityPrice>
): ElectricityPrice => {
  return {
    id: generateId(),
    name: params.name || '新电价方案',
    pricePerKWh: params.pricePerKWh || 0.56,
    tier: params.tier || '居民用电',
    hasTimeOfUse: params.hasTimeOfUse ?? false,
    peakPrice: params.peakPrice || 0.85,
    offPeakPrice: params.offPeakPrice || 0.35,
    timeZone: params.timeZone || 'Asia/Shanghai',
  };
};

const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export const comparePriceScenarios = (
  consumption: EnergyConsumption,
  prices: ElectricityPrice[]
): {
  priceId: string;
  priceName: string;
  totalCost: number;
  savings: number;
  percentage: number;
}[] => {
  const results = prices.map((price) => {
    const calc = calculateCost(consumption, price);
    return {
      priceId: price.id,
      priceName: price.name,
      totalCost: calc.totalCost,
    };
  });

  const maxCost = Math.max(...results.map((r) => r.totalCost));

  return results.map((r) => ({
    ...r,
    savings: maxCost - r.totalCost,
    percentage: ((maxCost - r.totalCost) / maxCost) * 100,
  }));
};

import type { WeatherData, EnergyConsumption, ValidationWarning } from '../types';

const BASE_TEMP = 18;
const HEAT_LOSS_COEFFICIENT = 120;

export interface WeatherCorrectionEvidence {
  actualTemp: number;
  referenceTemp: number;
  tempDiff: number;
  heatingDegreeDaysDiff: number;
  solarImpact: number;
  windImpact: number;
  totalCorrectionFactor: number;
  originalConsumption: number;
  correctedConsumption: number;
  adjustmentDetails: {
    type: string;
    factor: number;
    impact: string;
  }[];
}

export const calculateWeatherCorrectionFactor = (
  actualWeather: WeatherData,
  referenceWeather: WeatherData
): number => {
  const tempDiff = referenceWeather.avgOutdoorTemp - actualWeather.avgOutdoorTemp;
  const tempFactor = 1 + (tempDiff / 10) * 0.15;

  const hddRatio = actualWeather.heatingDegreeDays > 0 
    ? referenceWeather.heatingDegreeDays / actualWeather.heatingDegreeDays 
    : 1;

  const solarDiff = actualWeather.solarRadiation - referenceWeather.solarRadiation;
  const solarFactor = 1 + (solarDiff / 100) * -0.02;

  const windDiff = actualWeather.windSpeed - referenceWeather.windSpeed;
  const windFactor = 1 + (windDiff / 5) * 0.05;

  const combinedFactor = (tempFactor * 0.6 + hddRatio * 0.3) * solarFactor * windFactor;
  
  return parseFloat(combinedFactor.toFixed(4));
};

export const applyWeatherCorrection = (
  consumption: EnergyConsumption,
  actualWeather: WeatherData,
  referenceWeather: WeatherData
): { correctedConsumption: number; correctionFactor: number; evidence: WeatherCorrectionEvidence } => {
  const correctionFactor = calculateWeatherCorrectionFactor(actualWeather, referenceWeather);
  const correctedConsumption = parseFloat(
    (consumption.kWhConsumed * correctionFactor).toFixed(2)
  );

  const tempDiff = referenceWeather.avgOutdoorTemp - actualWeather.avgOutdoorTemp;
  const hddDiff = referenceWeather.heatingDegreeDays - actualWeather.heatingDegreeDays;

  const adjustmentDetails: WeatherCorrectionEvidence['adjustmentDetails'] = [];
  
  if (Math.abs(tempDiff) > 0.5) {
    adjustmentDetails.push({
      type: '温度差异',
      factor: 1 + (tempDiff / 10) * 0.15,
      impact: tempDiff > 0 ? '参考温度更高，增加能耗校正' : '参考温度更低，减少能耗校正'
    });
  }

  if (Math.abs(hddDiff) > 10) {
    adjustmentDetails.push({
      type: '采暖度日数',
      factor: actualWeather.heatingDegreeDays > 0 
        ? referenceWeather.heatingDegreeDays / actualWeather.heatingDegreeDays 
        : 1,
      impact: hddDiff > 0 ? '参考年采暖需求更高' : '参考年采暖需求更低'
    });
  }

  const solarDiff = actualWeather.solarRadiation - referenceWeather.solarRadiation;
  if (Math.abs(solarDiff) > 20) {
    adjustmentDetails.push({
      type: '太阳辐射',
      factor: 1 + (solarDiff / 100) * -0.02,
      impact: solarDiff > 0 ? '太阳能增益更高，减少采暖需求' : '太阳能增益更低，增加采暖需求'
    });
  }

  const windDiff = actualWeather.windSpeed - referenceWeather.windSpeed;
  if (Math.abs(windDiff) > 1) {
    adjustmentDetails.push({
      type: '风速影响',
      factor: 1 + (windDiff / 5) * 0.05,
      impact: windDiff > 0 ? '风速更大，增加热损失' : '风速更小，减少热损失'
    });
  }

  return {
    correctedConsumption,
    correctionFactor,
    evidence: {
      actualTemp: actualWeather.avgOutdoorTemp,
      referenceTemp: referenceWeather.avgOutdoorTemp,
      tempDiff: parseFloat(tempDiff.toFixed(2)),
      heatingDegreeDaysDiff: hddDiff,
      solarImpact: actualWeather.solarRadiation - referenceWeather.solarRadiation,
      windImpact: windDiff,
      totalCorrectionFactor: correctionFactor,
      originalConsumption: consumption.kWhConsumed,
      correctedConsumption,
      adjustmentDetails,
    },
  };
};

export const validateWeatherData = (
  weather: Partial<WeatherData>,
  _houseId: string
): { isValid: boolean; warnings: ValidationWarning[] } => {
  const warnings: ValidationWarning[] = [];

  if (weather.avgOutdoorTemp !== undefined) {
    if (weather.avgOutdoorTemp < -40 || weather.avgOutdoorTemp > 40) {
      warnings.push({
        type: 'weather_anomaly',
        field: 'avgOutdoorTemp',
        message: `温度 ${weather.avgOutdoorTemp}℃ 超出正常范围(-40到40℃)`,
        value: weather.avgOutdoorTemp,
      });
    }
  }

  if (weather.heatingDegreeDays !== undefined) {
    if (weather.heatingDegreeDays < 0) {
      warnings.push({
        type: 'weather_anomaly',
        field: 'heatingDegreeDays',
        message: '采暖度日数不能为负数',
        value: weather.heatingDegreeDays,
      });
    }
  }

  if (weather.windSpeed !== undefined) {
    if (weather.windSpeed < 0 || weather.windSpeed > 100) {
      warnings.push({
        type: 'weather_anomaly',
        field: 'windSpeed',
        message: `风速 ${weather.windSpeed}m/s 超出正常范围`,
        value: weather.windSpeed,
      });
    }
  }

  if (weather.solarRadiation !== undefined) {
    if (weather.solarRadiation < 0 || weather.solarRadiation > 1000) {
      warnings.push({
        type: 'weather_anomaly',
        field: 'solarRadiation',
        message: `太阳辐射 ${weather.solarRadiation}W/m² 超出正常范围`,
        value: weather.solarRadiation,
      });
    }
  }

  return {
    isValid: warnings.length === 0,
    warnings,
  };
};

export const calculateHeatingDegreeDays = (
  avgTemp: number,
  daysInMonth: number = 30
): number => {
  if (avgTemp >= BASE_TEMP) return 0;
  return parseFloat(((BASE_TEMP - avgTemp) * daysInMonth).toFixed(1));
};

export const estimateConsumptionFromWeather = (
  weather: WeatherData,
  houseNormalizedFactor: number,
  targetTemp: number = 20
): number => {
  const tempDiff = Math.max(0, targetTemp - weather.avgOutdoorTemp);
  const estimatedBase = tempDiff * HEAT_LOSS_COEFFICIENT * houseNormalizedFactor;
  
  const solarReduction = (weather.solarRadiation / 500) * 0.15;
  const windIncrease = (weather.windSpeed / 5) * 0.1;
  
  const adjusted = estimatedBase * (1 - solarReduction + windIncrease);
  
  return parseFloat(adjusted.toFixed(2));
};

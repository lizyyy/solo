import {
  Plant,
  Pot,
  Weather,
  WateringPlan,
  WateringEvent,
  ValidationError,
  ValidationResult,
} from '../types';
import { DateUtils, UnitConverter } from '../utils';

export class DataValidator {
  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];

  validatePlants(plants: Plant[]): ValidationError[] {
    const plantErrors: ValidationError[] = [];
    const plantIds = new Set<string>();

    plants.forEach((plant, index) => {
      const row = index + 2;

      if (plantIds.has(plant.id)) {
        plantErrors.push({
          field: 'id',
          row,
          value: plant.id,
          expectedType: 'string (unique)',
          errorType: 'duplicate',
          message: `plants.csv 第 ${row} 行: 植物ID "${plant.id}" 重复`,
        });
      }
      plantIds.add(plant.id);

      if (typeof plant.name !== 'string' || plant.name.trim() === '') {
        plantErrors.push({
          field: 'name',
          row,
          value: plant.name,
          expectedType: 'string',
          errorType: 'missing',
          message: `plants.csv 第 ${row} 行: 植物名称不能为空`,
        });
      }

      if (typeof plant.variety !== 'string' || plant.variety.trim() === '') {
        plantErrors.push({
          field: 'variety',
          row,
          value: plant.variety,
          expectedType: 'string',
          errorType: 'missing',
          message: `plants.csv 第 ${row} 行: 品种名称不能为空`,
        });
      }

      const validGrowthStages = ['seedling', 'vegetative', 'flowering', 'fruiting', 'mature'];
      if (!validGrowthStages.includes(plant.growthStage)) {
        plantErrors.push({
          field: 'growthStage',
          row,
          value: plant.growthStage,
          expectedType: `string (one of: ${validGrowthStages.join(', ')})`,
          errorType: 'invalid_type',
          message: `plants.csv 第 ${row} 行: 生长期 "${plant.growthStage}" 无效，有效值为: ${validGrowthStages.join(', ')}`,
        });
      }

      if (typeof plant.minMoisture !== 'number' || isNaN(plant.minMoisture)) {
        plantErrors.push({
          field: 'minMoisture',
          row,
          value: plant.minMoisture,
          expectedType: 'number',
          errorType: 'invalid_type',
          message: `plants.csv 第 ${row} 行: 最小含水量必须是数字`,
        });
      } else if (plant.minMoisture < 0 || plant.minMoisture > 100) {
        plantErrors.push({
          field: 'minMoisture',
          row,
          value: plant.minMoisture,
          expectedType: 'number (0-100)',
          errorType: 'out_of_range',
          message: `plants.csv 第 ${row} 行: 最小含水量 ${plant.minMoisture}% 超出范围 (0-100)`,
        });
      }

      if (typeof plant.maxMoisture !== 'number' || isNaN(plant.maxMoisture)) {
        plantErrors.push({
          field: 'maxMoisture',
          row,
          value: plant.maxMoisture,
          expectedType: 'number',
          errorType: 'invalid_type',
          message: `plants.csv 第 ${row} 行: 最大含水量必须是数字`,
        });
      } else if (plant.maxMoisture < 0 || plant.maxMoisture > 100) {
        plantErrors.push({
          field: 'maxMoisture',
          row,
          value: plant.maxMoisture,
          expectedType: 'number (0-100)',
          errorType: 'out_of_range',
          message: `plants.csv 第 ${row} 行: 最大含水量 ${plant.maxMoisture}% 超出范围 (0-100)`,
        });
      }

      if (plant.minMoisture !== undefined && plant.maxMoisture !== undefined) {
        if (plant.minMoisture > plant.maxMoisture) {
          plantErrors.push({
            field: 'minMoisture, maxMoisture',
            row,
            value: `min=${plant.minMoisture}, max=${plant.maxMoisture}`,
            expectedType: 'min <= max',
            errorType: 'out_of_range',
            message: `plants.csv 第 ${row} 行: 最小含水量 (${plant.minMoisture}%) 大于最大含水量 (${plant.maxMoisture}%)`,
          });
        }
      }

      if (typeof plant.optimalMoisture !== 'number' || isNaN(plant.optimalMoisture)) {
        plantErrors.push({
          field: 'optimalMoisture',
          row,
          value: plant.optimalMoisture,
          expectedType: 'number',
          errorType: 'invalid_type',
          message: `plants.csv 第 ${row} 行: 最佳含水量必须是数字`,
        });
      } else if (plant.optimalMoisture < 0 || plant.optimalMoisture > 100) {
        plantErrors.push({
          field: 'optimalMoisture',
          row,
          value: plant.optimalMoisture,
          expectedType: 'number (0-100)',
          errorType: 'out_of_range',
          message: `plants.csv 第 ${row} 行: 最佳含水量 ${plant.optimalMoisture}% 超出范围 (0-100)`,
        });
      } else if (plant.minMoisture !== undefined && plant.maxMoisture !== undefined) {
        if (plant.optimalMoisture < plant.minMoisture || plant.optimalMoisture > plant.maxMoisture) {
          plantErrors.push({
            field: 'optimalMoisture',
            row,
            value: plant.optimalMoisture,
            expectedType: `number (${plant.minMoisture}-${plant.maxMoisture})`,
            errorType: 'out_of_range',
            message: `plants.csv 第 ${row} 行: 最佳含水量 ${plant.optimalMoisture}% 超出建议范围 (${plant.minMoisture}%-${plant.maxMoisture}%)`,
          });
        }
      }

      if (typeof plant.waterNeedCoefficient !== 'number' || isNaN(plant.waterNeedCoefficient)) {
        plantErrors.push({
          field: 'waterNeedCoefficient',
          row,
          value: plant.waterNeedCoefficient,
          expectedType: 'number',
          errorType: 'invalid_type',
          message: `plants.csv 第 ${row} 行: 需水系数必须是数字`,
        });
      } else if (plant.waterNeedCoefficient < 0.1 || plant.waterNeedCoefficient > 2.0) {
        plantErrors.push({
          field: 'waterNeedCoefficient',
          row,
          value: plant.waterNeedCoefficient,
          expectedType: 'number (0.1-2.0)',
          errorType: 'out_of_range',
          message: `plants.csv 第 ${row} 行: 需水系数 ${plant.waterNeedCoefficient} 超出正常范围 (0.1-2.0)`,
        });
      }

      if (typeof plant.lightNeed !== 'number' || isNaN(plant.lightNeed)) {
        plantErrors.push({
          field: 'lightNeed',
          row,
          value: plant.lightNeed,
          expectedType: 'number',
          errorType: 'invalid_type',
          message: `plants.csv 第 ${row} 行: 光照需求必须是数字`,
        });
      } else if (plant.lightNeed < 0 || plant.lightNeed > 10) {
        plantErrors.push({
          field: 'lightNeed',
          row,
          value: plant.lightNeed,
          expectedType: 'number (0-10)',
          errorType: 'out_of_range',
          message: `plants.csv 第 ${row} 行: 光照需求 ${plant.lightNeed} 超出范围 (0-10)`,
        });
      }
    });

    return plantErrors;
  }

  validatePots(pots: Pot[], plantIds: Set<string>): ValidationError[] {
    const potErrors: ValidationError[] = [];
    const potIds = new Set<string>();

    pots.forEach((pot, index) => {
      const row = index + 1;

      if (potIds.has(pot.id)) {
        potErrors.push({
          field: 'id',
          row,
          value: pot.id,
          expectedType: 'string (unique)',
          errorType: 'duplicate',
          message: `pots.json 花盆 "${pot.name}": 花盆ID "${pot.id}" 重复`,
        });
      }
      potIds.add(pot.id);

      if (typeof pot.name !== 'string' || pot.name.trim() === '') {
        potErrors.push({
          field: 'name',
          row,
          value: pot.name,
          expectedType: 'string',
          errorType: 'missing',
          message: `pots.json 第 ${index + 1} 个花盆: 花盆名称不能为空`,
        });
      }

      if (!plantIds.has(pot.plantId)) {
        potErrors.push({
          field: 'plantId',
          row,
          value: pot.plantId,
          expectedType: 'string (valid plant ID)',
          errorType: 'invalid_reference',
          message: `pots.json 花盆 "${pot.name}": 引用的植物ID "${pot.plantId}" 在 plants.csv 中不存在`,
        });
      }

      if (typeof pot.volume !== 'number' || isNaN(pot.volume)) {
        potErrors.push({
          field: 'volume',
          row,
          value: pot.volume,
          expectedType: 'number (liters)',
          errorType: 'invalid_type',
          message: `pots.json 花盆 "${pot.name}": 花盆体积必须是数字 (升)`,
        });
      } else if (pot.volume <= 0) {
        potErrors.push({
          field: 'volume',
          row,
          value: pot.volume,
          expectedType: 'number (> 0 liters)',
          errorType: 'out_of_range',
          message: `pots.json 花盆 "${pot.name}": 花盆体积 ${pot.volume} 升 必须大于 0`,
        });
      }

      if (typeof pot.drainHoles !== 'number' || isNaN(pot.drainHoles)) {
        potErrors.push({
          field: 'drainHoles',
          row,
          value: pot.drainHoles,
          expectedType: 'number',
          errorType: 'invalid_type',
          message: `pots.json 花盆 "${pot.name}": 排水孔数量必须是数字`,
        });
      } else if (pot.drainHoles < 0) {
        potErrors.push({
          field: 'drainHoles',
          row,
          value: pot.drainHoles,
          expectedType: 'number (>= 0)',
          errorType: 'out_of_range',
          message: `pots.json 花盆 "${pot.name}": 排水孔数量 ${pot.drainHoles} 不能为负数`,
        });
      }

      if (typeof pot.drainageRate !== 'number' || isNaN(pot.drainageRate)) {
        potErrors.push({
          field: 'drainageRate',
          row,
          value: pot.drainageRate,
          expectedType: 'number (mm/hour)',
          errorType: 'invalid_type',
          message: `pots.json 花盆 "${pot.name}": 排水速率必须是数字 (mm/小时)`,
        });
      } else if (pot.drainageRate < 0 || pot.drainageRate > 100) {
        potErrors.push({
          field: 'drainageRate',
          row,
          value: pot.drainageRate,
          expectedType: 'number (0-100 mm/hour)',
          errorType: 'out_of_range',
          message: `pots.json 花盆 "${pot.name}": 排水速率 ${pot.drainageRate} mm/小时 超出正常范围 (0-100)`,
        });
      }

      if (typeof pot.surfaceArea !== 'number' || isNaN(pot.surfaceArea)) {
        potErrors.push({
          field: 'surfaceArea',
          row,
          value: pot.surfaceArea,
          expectedType: 'number (cm²)',
          errorType: 'invalid_type',
          message: `pots.json 花盆 "${pot.name}": 表面积必须是数字 (平方厘米)`,
        });
      } else if (pot.surfaceArea <= 0) {
        potErrors.push({
          field: 'surfaceArea',
          row,
          value: pot.surfaceArea,
          expectedType: 'number (> 0 cm²)',
          errorType: 'out_of_range',
          message: `pots.json 花盆 "${pot.name}": 表面积 ${pot.surfaceArea} cm² 必须大于 0`,
        });
      }

      if (typeof pot.soilType !== 'string' || pot.soilType.trim() === '') {
        potErrors.push({
          field: 'soilType',
          row,
          value: pot.soilType,
          expectedType: 'string',
          errorType: 'missing',
          message: `pots.json 花盆 "${pot.name}": 土壤类型不能为空`,
        });
      }

      if (typeof pot.soilWaterRetention !== 'number' || isNaN(pot.soilWaterRetention)) {
        potErrors.push({
          field: 'soilWaterRetention',
          row,
          value: pot.soilWaterRetention,
          expectedType: 'number (0-1)',
          errorType: 'invalid_type',
          message: `pots.json 花盆 "${pot.name}": 土壤保水率必须是数字 (0-1)`,
        });
      } else if (pot.soilWaterRetention < 0 || pot.soilWaterRetention > 1) {
        potErrors.push({
          field: 'soilWaterRetention',
          row,
          value: pot.soilWaterRetention,
          expectedType: 'number (0-1)',
          errorType: 'out_of_range',
          message: `pots.json 花盆 "${pot.name}": 土壤保水率 ${pot.soilWaterRetention} 超出范围 (0-1)`,
        });
      }

      if (typeof pot.soilFieldCapacity !== 'number' || isNaN(pot.soilFieldCapacity)) {
        potErrors.push({
          field: 'soilFieldCapacity',
          row,
          value: pot.soilFieldCapacity,
          expectedType: 'number (0-100)',
          errorType: 'invalid_type',
          message: `pots.json 花盆 "${pot.name}": 田间持水量必须是数字百分比 (0-100)`,
        });
      } else if (pot.soilFieldCapacity < 0 || pot.soilFieldCapacity > 100) {
        potErrors.push({
          field: 'soilFieldCapacity',
          row,
          value: pot.soilFieldCapacity,
          expectedType: 'number (0-100)',
          errorType: 'out_of_range',
          message: `pots.json 花盆 "${pot.name}": 田间持水量 ${pot.soilFieldCapacity}% 超出范围 (0-100)`,
        });
      }

      if (typeof pot.soilPermanentWiltingPoint !== 'number' || isNaN(pot.soilPermanentWiltingPoint)) {
        potErrors.push({
          field: 'soilPermanentWiltingPoint',
          row,
          value: pot.soilPermanentWiltingPoint,
          expectedType: 'number (0-100)',
          errorType: 'invalid_type',
          message: `pots.json 花盆 "${pot.name}": 永久萎蔫点必须是数字百分比 (0-100)`,
        });
      } else if (pot.soilPermanentWiltingPoint < 0 || pot.soilPermanentWiltingPoint > 100) {
        potErrors.push({
          field: 'soilPermanentWiltingPoint',
          row,
          value: pot.soilPermanentWiltingPoint,
          expectedType: 'number (0-100)',
          errorType: 'out_of_range',
          message: `pots.json 花盆 "${pot.name}": 永久萎蔫点 ${pot.soilPermanentWiltingPoint}% 超出范围 (0-100)`,
        });
      }

      if (pot.soilFieldCapacity !== undefined && pot.soilPermanentWiltingPoint !== undefined) {
        if (pot.soilFieldCapacity <= pot.soilPermanentWiltingPoint) {
          potErrors.push({
            field: 'soilFieldCapacity, soilPermanentWiltingPoint',
            row,
            value: `fieldCapacity=${pot.soilFieldCapacity}, wiltingPoint=${pot.soilPermanentWiltingPoint}`,
            expectedType: 'fieldCapacity > wiltingPoint',
            errorType: 'out_of_range',
            message: `pots.json 花盆 "${pot.name}": 田间持水量 (${pot.soilFieldCapacity}%) 必须大于永久萎蔫点 (${pot.soilPermanentWiltingPoint}%)`,
          });
        }
      }
    });

    return potErrors;
  }

  validateWeather(weather: Weather[]): { errors: ValidationError[]; warnings: ValidationError[] } {
    const weatherErrors: ValidationError[] = [];
    const weatherWarnings: ValidationError[] = [];
    const dates = new Set<string>();
    const dateList: string[] = [];

    weather.forEach((w, index) => {
      const row = index + 2;

      if (!DateUtils.isValidDate(w.date)) {
        weatherErrors.push({
          field: 'date',
          row,
          value: w.date,
          expectedType: 'string (YYYY-MM-DD)',
          errorType: 'invalid_type',
          message: `weather.csv 第 ${row} 行: 日期格式无效 "${w.date}"，应为 YYYY-MM-DD`,
        });
      } else {
        if (dates.has(w.date)) {
          weatherErrors.push({
            field: 'date',
            row,
            value: w.date,
            expectedType: 'string (unique)',
            errorType: 'duplicate',
            message: `weather.csv 第 ${row} 行: 日期 "${w.date}" 重复`,
          });
        }
        dates.add(w.date);
        dateList.push(w.date);
      }

      if (typeof w.temperature !== 'number' || isNaN(w.temperature)) {
        weatherErrors.push({
          field: 'temperature',
          row,
          value: w.temperature,
          expectedType: 'number (°C)',
          errorType: 'invalid_type',
          message: `weather.csv 第 ${row} 行: 温度必须是数字 (摄氏度)`,
        });
      } else if (w.temperature < -20 || w.temperature > 50) {
        weatherWarnings.push({
          field: 'temperature',
          row,
          value: w.temperature,
          expectedType: 'number (-20 to 50 °C)',
          errorType: 'out_of_range',
          message: `weather.csv 第 ${row} 行: 温度 ${w.temperature}°C 超出正常范围 (-20 到 50°C)`,
        });
      }

      if (typeof w.humidity !== 'number' || isNaN(w.humidity)) {
        weatherErrors.push({
          field: 'humidity',
          row,
          value: w.humidity,
          expectedType: 'number (0-100)',
          errorType: 'invalid_type',
          message: `weather.csv 第 ${row} 行: 湿度必须是数字百分比 (0-100)`,
        });
      } else if (w.humidity < 0 || w.humidity > 100) {
        weatherErrors.push({
          field: 'humidity',
          row,
          value: w.humidity,
          expectedType: 'number (0-100)',
          errorType: 'out_of_range',
          message: `weather.csv 第 ${row} 行: 湿度 ${w.humidity}% 超出范围 (0-100)`,
        });
      }

      if (typeof w.solarRadiation !== 'number' || isNaN(w.solarRadiation)) {
        weatherErrors.push({
          field: 'solarRadiation',
          row,
          value: w.solarRadiation,
          expectedType: 'number (MJ/m²/day)',
          errorType: 'invalid_type',
          message: `weather.csv 第 ${row} 行: 太阳辐射必须是数字 (MJ/m²/天)`,
        });
      } else if (w.solarRadiation < 0 || w.solarRadiation > 40) {
        weatherWarnings.push({
          field: 'solarRadiation',
          row,
          value: w.solarRadiation,
          expectedType: 'number (0-40 MJ/m²/day)',
          errorType: 'out_of_range',
          message: `weather.csv 第 ${row} 行: 太阳辐射 ${w.solarRadiation} MJ/m²/天 超出正常范围 (0-40)`,
        });
      }

      if (typeof w.windSpeed !== 'number' || isNaN(w.windSpeed)) {
        weatherErrors.push({
          field: 'windSpeed',
          row,
          value: w.windSpeed,
          expectedType: 'number (m/s)',
          errorType: 'invalid_type',
          message: `weather.csv 第 ${row} 行: 风速必须是数字 (m/s)`,
        });
      } else if (w.windSpeed < 0) {
        weatherErrors.push({
          field: 'windSpeed',
          row,
          value: w.windSpeed,
          expectedType: 'number (>= 0 m/s)',
          errorType: 'out_of_range',
          message: `weather.csv 第 ${row} 行: 风速 ${w.windSpeed} m/s 不能为负数`,
        });
      } else if (w.windSpeed > 50) {
        weatherWarnings.push({
          field: 'windSpeed',
          row,
          value: w.windSpeed,
          expectedType: 'number (<= 50 m/s)',
          errorType: 'out_of_range',
          message: `weather.csv 第 ${row} 行: 风速 ${w.windSpeed} m/s 非常高 (可能是台风)`,
        });
      }

      if (typeof w.precipitation !== 'number' || isNaN(w.precipitation)) {
        weatherErrors.push({
          field: 'precipitation',
          row,
          value: w.precipitation,
          expectedType: 'number (mm)',
          errorType: 'invalid_type',
          message: `weather.csv 第 ${row} 行: 降水量必须是数字 (mm)`,
        });
      } else if (w.precipitation < 0) {
        weatherErrors.push({
          field: 'precipitation',
          row,
          value: w.precipitation,
          expectedType: 'number (>= 0 mm)',
          errorType: 'out_of_range',
          message: `weather.csv 第 ${row} 行: 降水量 ${w.precipitation} mm 不能为负数`,
        });
      } else if (w.precipitation > 500) {
        weatherWarnings.push({
          field: 'precipitation',
          row,
          value: w.precipitation,
          expectedType: 'number (<= 500 mm)',
          errorType: 'out_of_range',
          message: `weather.csv 第 ${row} 行: 降水量 ${w.precipitation} mm 非常高 (可能是暴雨)`,
        });
      }
    });

    if (dateList.length >= 2) {
      const { isContinuous, gaps } = DateUtils.isDateRangeContinuous(dateList);
      if (!isContinuous) {
        weatherErrors.push({
          field: 'date',
          value: `missing dates: ${gaps.join(', ')}`,
          expectedType: 'continuous date range',
          errorType: 'date_gap',
          message: `weather.csv 日期不连续，缺失: ${gaps.join(', ')}`,
        });
      }
    }

    return { errors: weatherErrors, warnings: weatherWarnings };
  }

  validateWateringPlan(
    plan: WateringPlan,
    weatherDates: Set<string>,
    potIds: Set<string>
  ): { errors: ValidationError[]; warnings: ValidationError[] } {
    const planErrors: ValidationError[] = [];
    const planWarnings: ValidationError[] = [];

    if (typeof plan.planId !== 'string' || plan.planId.trim() === '') {
      planErrors.push({
        field: 'planId',
        value: plan.planId,
        expectedType: 'string',
        errorType: 'missing',
        message: `浇水计划 planId 不能为空`,
      });
    }

    if (typeof plan.planName !== 'string' || plan.planName.trim() === '') {
      planErrors.push({
        field: 'planName',
        value: plan.planName,
        expectedType: 'string',
        errorType: 'missing',
        message: `浇水计划 planName 不能为空`,
      });
    }

    if (!Array.isArray(plan.wateringEvents)) {
      planErrors.push({
        field: 'wateringEvents',
        value: typeof plan.wateringEvents,
        expectedType: 'array',
        errorType: 'invalid_type',
        message: `浇水计划 wateringEvents 必须是数组`,
      });
      return { errors: planErrors, warnings: planWarnings };
    }

    plan.wateringEvents.forEach((event, index) => {
      const row = index + 1;

      if (!DateUtils.isValidDate(event.date)) {
        planErrors.push({
          field: 'date',
          row,
          value: event.date,
          expectedType: 'string (YYYY-MM-DD)',
          errorType: 'invalid_type',
          message: `浇水计划 "${plan.planName}" 第 ${row} 个事件: 日期格式无效 "${event.date}"`,
        });
      } else if (!weatherDates.has(event.date)) {
        planWarnings.push({
          field: 'date',
          row,
          value: event.date,
          expectedType: 'string (in weather date range)',
          errorType: 'invalid_reference',
          message: `浇水计划 "${plan.planName}" 第 ${row} 个事件: 日期 "${event.date}" 在天气数据中不存在`,
        });
      }

      const validTimes = ['morning', 'afternoon', 'evening'];
      if (event.time && !validTimes.includes(event.time)) {
        planWarnings.push({
          field: 'time',
          row,
          value: event.time,
          expectedType: `string (one of: ${validTimes.join(', ')})`,
          errorType: 'invalid_type',
          message: `浇水计划 "${plan.planName}" 第 ${row} 个事件: 时间 "${event.time}" 不是标准值，将使用默认值`,
        });
      }

      if (typeof event.amount !== 'number' || isNaN(event.amount)) {
        planErrors.push({
          field: 'amount',
          row,
          value: event.amount,
          expectedType: 'number (mm)',
          errorType: 'invalid_type',
          message: `浇水计划 "${plan.planName}" 第 ${row} 个事件: 浇水量必须是数字 (mm)`,
        });
      } else if (event.amount < 0) {
        planErrors.push({
          field: 'amount',
          row,
          value: event.amount,
          expectedType: 'number (>= 0 mm)',
          errorType: 'out_of_range',
          message: `浇水计划 "${plan.planName}" 第 ${row} 个事件: 浇水量 ${event.amount} mm 不能为负数`,
        });
      } else if (event.amount > 200) {
        planWarnings.push({
          field: 'amount',
          row,
          value: event.amount,
          expectedType: 'number (<= 200 mm)',
          errorType: 'out_of_range',
          message: `浇水计划 "${plan.planName}" 第 ${row} 个事件: 浇水量 ${event.amount} mm 非常大`,
        });
      }

      if (event.fertilizerAmount !== undefined) {
        if (typeof event.fertilizerAmount !== 'number' || isNaN(event.fertilizerAmount)) {
          planErrors.push({
            field: 'fertilizerAmount',
            row,
            value: event.fertilizerAmount,
            expectedType: 'number',
            errorType: 'invalid_type',
            message: `浇水计划 "${plan.planName}" 第 ${row} 个事件: 施肥量必须是数字`,
          });
        } else if (event.fertilizerAmount < 0) {
          planErrors.push({
            field: 'fertilizerAmount',
            row,
            value: event.fertilizerAmount,
            expectedType: 'number (>= 0)',
            errorType: 'out_of_range',
            message: `浇水计划 "${plan.planName}" 第 ${row} 个事件: 施肥量 ${event.fertilizerAmount} 不能为负数`,
          });
        }
      }
    });

    return { errors: planErrors, warnings: planWarnings };
  }

  validateAll(
    plants: Plant[],
    pots: Pot[],
    weather: Weather[],
    wateringPlans: WateringPlan[]
  ): ValidationResult {
    this.errors = [];
    this.warnings = [];

    const plantErrors = this.validatePlants(plants);
    this.errors.push(...plantErrors);

    const plantIds = new Set(plants.map(p => p.id));
    const potErrors = this.validatePots(pots, plantIds);
    this.errors.push(...potErrors);

    const potIds = new Set(pots.map(p => p.id));
    const weatherResult = this.validateWeather(weather);
    this.errors.push(...weatherResult.errors);
    this.warnings.push(...weatherResult.warnings);

    const weatherDates = new Set(weather.map(w => w.date));
    for (const plan of wateringPlans) {
      const planResult = this.validateWateringPlan(plan, weatherDates, potIds);
      this.errors.push(...planResult.errors);
      this.warnings.push(...planResult.warnings);
    }

    return {
      isValid: this.errors.length === 0,
      errors: [...this.errors],
      warnings: [...this.warnings],
    };
  }

  formatErrors(errors: ValidationError[]): string[] {
    return errors.map(e => {
      if (e.row !== undefined) {
        return `[错误] ${e.message}`;
      }
      return `[错误] ${e.message}`;
    });
  }

  formatWarnings(warnings: ValidationError[]): string[] {
    return warnings.map(w => {
      if (w.row !== undefined) {
        return `[警告] ${w.message}`;
      }
      return `[警告] ${w.message}`;
    });
  }
}

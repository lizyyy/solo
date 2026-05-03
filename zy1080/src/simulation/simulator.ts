import {
  Plant,
  Pot,
  Weather,
  WateringPlan,
  WateringEvent,
  SimulatedPotState,
  SimulationResult,
} from '../types';
import { UnitConverter, DateUtils, MathUtils } from '../utils';

interface PotSimulationState {
  pot: Pot;
  plant: Plant;
  currentMoisture: number;
  moistureHistory: number[];
  waterloggingDays: number;
  fertilizerAccumulation: number;
}

export class Simulator {
  private plants: Plant[];
  private pots: Pot[];
  private weather: Weather[];
  private plantMap: Map<string, Plant>;
  private weatherMap: Map<string, Weather>;

  constructor(plants: Plant[], pots: Pot[], weather: Weather[]) {
    this.plants = plants;
    this.pots = pots;
    this.weather = weather;
    this.plantMap = new Map(plants.map(p => [p.id, p]));
    this.weatherMap = new Map(weather.map(w => [w.date, w]));
  }

  calculatePotentialEvapotranspiration(
    weather: Weather,
    period: 'morning' | 'afternoon' | 'evening'
  ): number {
    const Tmean = weather.temperature;
    const Tmax = Tmean + 5;
    const Tmin = Tmean - 5;
    const Rs = weather.solarRadiation;

    const G = 0;

    const delta = (4098 * (0.6108 * Math.exp((17.27 * Tmean) / (Tmean + 237.3)))) / Math.pow(Tmean + 237.3, 2);

    const gamma = 0.0665;

    const es = 0.6108 * (Math.exp((17.27 * Tmax) / (Tmax + 237.3)) + Math.exp((17.27 * Tmin) / (Tmin + 237.3))) / 2;
    const ea = es * (weather.humidity / 100);

    const u2 = weather.windSpeed;

    const numerator = 0.408 * delta * (Rs - G) + gamma * (900 / (Tmean + 273)) * u2 * (es - ea);
    const denominator = delta + gamma * (1 + 0.34 * u2);

    let et0 = numerator / denominator;
    et0 = Math.max(0, et0);

    const periodFactors: Record<string, number> = {
      morning: 0.35,
      afternoon: 0.45,
      evening: 0.20,
    };

    return et0 * (periodFactors[period] || 1/3);
  }

  calculateActualEvapotranspiration(
    potentialET: number,
    currentMoisture: number,
    fieldCapacity: number,
    wiltingPoint: number,
    waterNeedCoefficient: number
  ): number {
    const availableWater = fieldCapacity - wiltingPoint;
    const relativeMoisture = (currentMoisture - wiltingPoint) / availableWater;

    if (currentMoisture <= wiltingPoint) {
      return 0;
    }

    if (currentMoisture >= fieldCapacity * 0.7) {
      return potentialET * waterNeedCoefficient;
    }

    const reductionFactor = (relativeMoisture - 0.3) / 0.4;
    const adjustedFactor = MathUtils.clamp(reductionFactor, 0, 1);

    return potentialET * waterNeedCoefficient * adjustedFactor;
  }

  calculateDrainage(
    currentMoisture: number,
    fieldCapacity: number,
    drainageRate: number,
    period: 'morning' | 'afternoon' | 'evening'
  ): number {
    if (currentMoisture <= fieldCapacity) {
      return 0;
    }

    const excessMoisture = currentMoisture - fieldCapacity;
    const periodHours: Record<string, number> = {
      morning: 6,
      afternoon: 6,
      evening: 12,
    };

    const hours = periodHours[period] || 8;
    const maximumDrainage = drainageRate * hours;
    const drainage = Math.min(excessMoisture, maximumDrainage);

    return Math.max(0, drainage);
  }

  convertMoistureToPercent(
    moistureMm: number,
    fieldCapacity: number,
    wiltingPoint: number
  ): number {
    const availableRange = fieldCapacity - wiltingPoint;
    if (availableRange <= 0) return 0;

    const relativeMoisture = (moistureMm - wiltingPoint) / availableRange;
    return MathUtils.clamp(relativeMoisture * 100, 0, 100);
  }

  initializePotState(pot: Pot, plant: Plant): PotSimulationState {
    const initialMoisture = (pot.soilFieldCapacity + pot.soilPermanentWiltingPoint) / 2;

    return {
      pot,
      plant,
      currentMoisture: initialMoisture,
      moistureHistory: [initialMoisture],
      waterloggingDays: 0,
      fertilizerAccumulation: 0,
    };
  }

  getWateringForDateAndPeriod(
    events: WateringEvent[],
    date: string,
    period: 'morning' | 'afternoon' | 'evening'
  ): { waterAmount: number; fertilizerAmount: number } {
    const periodEvents = events.filter(e => {
      if (!DateUtils.isSameDay(e.date, date)) return false;
      return e.time === period || !e.time;
    });

    let totalWater = 0;
    let totalFertilizer = 0;

    for (const event of periodEvents) {
      totalWater += event.amount;
      totalFertilizer += event.fertilizerAmount || 0;
    }

    return { waterAmount: totalWater, fertilizerAmount: totalFertilizer };
  }

  simulate(
    wateringPlan: WateringPlan,
    startDate?: string,
    endDate?: string
  ): SimulationResult {
    const dates = this.weather.map(w => w.date).sort(DateUtils.compareDates);
    const actualStart = startDate || dates[0];
    const actualEnd = endDate || dates[dates.length - 1];

    const simulationDates = DateUtils.generateDateRange(actualStart, actualEnd)
      .filter(d => this.weatherMap.has(d));

    const potStates: Map<string, PotSimulationState> = new Map();
    const simulatedStates: SimulatedPotState[] = [];

    for (const pot of this.pots) {
      const plant = this.plantMap.get(pot.plantId);
      if (!plant) continue;

      const state = this.initializePotState(pot, plant);
      potStates.set(pot.id, state);
    }

    const periods: ('morning' | 'afternoon' | 'evening')[] = ['morning', 'afternoon', 'evening'];

    for (const date of simulationDates) {
      const weatherData = this.weatherMap.get(date);
      if (!weatherData) continue;

      const precipitation = weatherData.precipitation / 3;

      for (const period of periods) {
        const periodPrecipitation = precipitation;

        const { waterAmount: planWatering, fertilizerAmount: planFertilizer } = 
          this.getWateringForDateAndPeriod(wateringPlan.wateringEvents, date, period);

        for (const potState of potStates.values()) {
          const { pot, plant } = potState;

          const totalWaterInput = periodPrecipitation + planWatering;

          const waterVolume = UnitConverter.waterAmountToVolume(
            totalWaterInput,
            pot.surfaceArea
          );

          const maxStorage = pot.soilFieldCapacity;
          const availableCapacity = maxStorage - potState.currentMoisture;
          const actualWaterAbsorbed = Math.min(totalWaterInput, availableCapacity);
          const surfaceRunoff = Math.max(0, totalWaterInput - availableCapacity);

          let newMoisture = potState.currentMoisture + actualWaterAbsorbed;

          const potentialET = this.calculatePotentialEvapotranspiration(weatherData, period);
          const actualET = this.calculateActualEvapotranspiration(
            potentialET,
            newMoisture,
            pot.soilFieldCapacity,
            pot.soilPermanentWiltingPoint,
            plant.waterNeedCoefficient
          );

          newMoisture -= actualET;
          newMoisture = Math.max(pot.soilPermanentWiltingPoint, newMoisture);

          const drainage = this.calculateDrainage(
            newMoisture,
            pot.soilFieldCapacity,
            pot.drainageRate,
            period
          );
          newMoisture -= drainage;

          newMoisture = Math.max(pot.soilPermanentWiltingPoint, newMoisture);

          if (newMoisture >= pot.soilFieldCapacity * 0.95) {
            potState.waterloggingDays += 1/3;
          }

          potState.fertilizerAccumulation += planFertilizer;

          const moisturePercent = this.convertMoistureToPercent(
            newMoisture,
            pot.soilFieldCapacity,
            pot.soilPermanentWiltingPoint
          );

          const simulatedState: SimulatedPotState = {
            potId: pot.id,
            potName: pot.name,
            plantId: plant.id,
            plantName: plant.name,
            date,
            period,
            soilMoisture: MathUtils.round(newMoisture, 2),
            soilMoisturePercent: MathUtils.round(moisturePercent, 2),
            actualEvapotranspiration: MathUtils.round(actualET, 2),
            potentialEvapotranspiration: MathUtils.round(potentialET, 2),
            drainage: MathUtils.round(drainage, 2),
            wateringAmount: MathUtils.round(planWatering, 2),
            fertilizerAmount: planFertilizer,
            precipitationAmount: MathUtils.round(periodPrecipitation, 2),
          };

          simulatedStates.push(simulatedState);
          potState.currentMoisture = newMoisture;
          potState.moistureHistory.push(newMoisture);
        }
      }
    }

    const riskBreakdown: Record<string, number> = {
      drought: 0,
      waterlogging: 0,
      rootRot: 0,
      etiolation: 0,
      fertilizerBurn: 0,
    };

    const averageMoisturePerPot: Record<string, number> = {};
    for (const [potId, state] of potStates) {
      const avgMoisture = MathUtils.average(state.moistureHistory);
      const pot = this.pots.find(p => p.id === potId);
      if (pot) {
        const avgPercent = this.convertMoistureToPercent(
          avgMoisture,
          pot.soilFieldCapacity,
          pot.soilPermanentWiltingPoint
        );
        averageMoisturePerPot[potId] = MathUtils.round(avgPercent, 2);
      }
    }

    return {
      planId: wateringPlan.planId,
      planName: wateringPlan.planName,
      potStates: simulatedStates,
      risks: [],
      summary: {
        totalDays: simulationDates.length,
        totalPots: this.pots.length,
        riskBreakdown: riskBreakdown as any,
        averageMoisturePerPot,
      },
    };
  }
}

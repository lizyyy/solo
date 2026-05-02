import {
  LightingScenario,
  LightFixture,
  LightModel,
  TimeSlot,
  DailyConsumption,
  LightUsage,
} from '../models/types.js';

export class CostCalculator {
  calculateDailyConsumption(scenario: LightingScenario): DailyConsumption {
    const perLight: LightUsage[] = [];

    for (const fixture of scenario.fixtures) {
      const model = scenario.lightModels.find(m => m.id === fixture.modelId);
      if (!model) continue;

      const usage = this.calculateLightUsage(fixture, model, scenario.electricity.pricePerKwh);
      perLight.push(usage);
    }

    const totalKwh = perLight.reduce((sum, u) => sum + u.dailyKwh, 0);
    const totalCost = perLight.reduce((sum, u) => sum + u.dailyCost, 0);
    const budgetExceeded = totalCost > scenario.electricity.dailyBudget;
    const budgetExcess = budgetExceeded ? totalCost - scenario.electricity.dailyBudget : 0;

    return {
      totalKwh,
      totalCost,
      budgetExceeded,
      budgetExcess,
      perLight,
    };
  }

  calculateLightUsage(
    fixture: LightFixture,
    model: LightModel,
    pricePerKwh: number
  ): LightUsage {
    const dailyHours = this.calculateTotalDailyHours(fixture.timeSlots);
    const dailyKwh = (model.power / 1000) * dailyHours;
    const dailyCost = dailyKwh * pricePerKwh;

    return {
      lightId: fixture.id,
      lightName: fixture.name,
      modelId: fixture.modelId,
      power: model.power,
      dailyHours,
      dailyKwh,
      dailyCost,
      timeSlots: fixture.timeSlots,
    };
  }

  private calculateTotalDailyHours(timeSlots: TimeSlot[]): number {
    if (timeSlots.length === 0) return 0;

    const mergedSlots = this.mergeTimeSlots(timeSlots);
    
    return mergedSlots.reduce((total, slot) => {
      return total + (slot.endHour - slot.startHour);
    }, 0);
  }

  mergeTimeSlots(timeSlots: TimeSlot[]): TimeSlot[] {
    if (timeSlots.length === 0) return [];

    const sorted = [...timeSlots].sort((a, b) => a.startHour - b.startHour);
    const merged: TimeSlot[] = [];

    let current = { ...sorted[0] };

    for (let i = 1; i < sorted.length; i++) {
      const next = sorted[i];

      if (next.startHour <= current.endHour) {
        current.endHour = Math.max(current.endHour, next.endHour);
      } else {
        merged.push(current);
        current = { ...next };
      }
    }

    merged.push(current);
    return merged;
  }

  checkTimeSlotsOverlap(timeSlots: TimeSlot[]): boolean {
    if (timeSlots.length < 2) return false;

    for (let i = 0; i < timeSlots.length; i++) {
      for (let j = i + 1; j < timeSlots.length; j++) {
        if (this.doSlotsOverlap(timeSlots[i], timeSlots[j])) {
          return true;
        }
      }
    }

    return false;
  }

  doSlotsOverlap(slot1: TimeSlot, slot2: TimeSlot): boolean {
    return !(slot1.endHour <= slot2.startHour || slot2.endHour <= slot1.startHour);
  }

  findOverlappingSlots(timeSlots: TimeSlot[]): Array<{ index1: number; index2: number }> {
    const overlaps: Array<{ index1: number; index2: number }> = [];

    for (let i = 0; i < timeSlots.length; i++) {
      for (let j = i + 1; j < timeSlots.length; j++) {
        if (this.doSlotsOverlap(timeSlots[i], timeSlots[j])) {
          overlaps.push({ index1: i, index2: j });
        }
      }
    }

    return overlaps;
  }

  calculateMonthlyEstimate(dailyCost: number, daysPerMonth: number = 30): number {
    return dailyCost * daysPerMonth;
  }

  calculateAnnualEstimate(dailyCost: number, daysPerYear: number = 365): number {
    return dailyCost * daysPerYear;
  }
}

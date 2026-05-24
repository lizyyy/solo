import { Tug } from '../types';

export class FuelSystem {
  static IDLE_CONSUMPTION = 0.02;
  static MOVING_CONSUMPTION = 0.08;
  static TOWING_CONSUMPTION = 0.12;

  static updateFuel(tug: Tug, deltaTime: number): Tug {
    let consumptionRate = this.IDLE_CONSUMPTION;
    switch (tug.status) {
      case 'moving':
        consumptionRate = this.MOVING_CONSUMPTION;
        break;
      case 'towing':
        consumptionRate = this.TOWING_CONSUMPTION;
        break;
      case 'returning':
        consumptionRate = this.MOVING_CONSUMPTION;
        break;
    }
    const newFuel = Math.max(0, tug.fuel - consumptionRate * deltaTime);
    return {
      ...tug,
      fuel: newFuel,
    };
  }

  static isFuelLow(tug: Tug): boolean {
    return tug.fuel <= tug.maxFuel * 0.2;
  }

  static isFuelDepleted(tug: Tug): boolean {
    return tug.fuel <= 0;
  }

  static calculateEfficiency(
    tugs: Tug[],
    totalOperatingTime: number
  ): number {
    if (totalOperatingTime <= 0) return 100;
    const totalMaxFuel = tugs.reduce((sum, t) => sum + t.maxFuel, 0);
    const totalRemainingFuel = tugs.reduce((sum, t) => sum + t.fuel, 0);
    const usedFuel = totalMaxFuel - totalRemainingFuel;
    const expectedConsumption = this.MOVING_CONSUMPTION * totalOperatingTime * tugs.length * 0.5;
    const efficiency = Math.max(0, Math.min(100, 100 - (usedFuel / expectedConsumption - 1) * 50));
    return efficiency;
  }
}

import type { DiscountCalculation, SupplierLevel } from '../types';

export class DiscountCalculator {
  static calculateDaysEarly(originalDueDate: string, proposedDate: string): number {
    const original = new Date(originalDueDate);
    const proposed = new Date(proposedDate);
    const diffTime = original.getTime() - proposed.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }

  static calculateDiscountAmount(
    principal: number,
    annualRate: number,
    days: number
  ): number {
    if (days <= 0) return 0;
    const dailyRate = annualRate / 360;
    return principal * dailyRate * days;
  }

  static calculateAnnualizedReturn(
    discountAmount: number,
    principal: number,
    days: number
  ): number {
    if (days <= 0 || principal <= 0) return 0;
    return (discountAmount / principal) * (360 / days) * 100;
  }

  static calculate(
    principal: number,
    originalDueDate: string,
    proposedDate: string,
    annualRate: number
  ): DiscountCalculation {
    const daysEarly = this.calculateDaysEarly(originalDueDate, proposedDate);
    const discountAmount = this.calculateDiscountAmount(principal, annualRate, daysEarly);
    const actualPayment = principal - discountAmount;
    const annualizedReturn = this.calculateAnnualizedReturn(discountAmount, principal, daysEarly);

    return {
      daysEarly,
      discountAmount,
      actualPayment,
      annualizedReturn,
    };
  }

  static validateDiscountRule(supplierLevel: SupplierLevel, rate: number): boolean {
    const maxRates: Record<SupplierLevel, number> = {
      A: 0.12,
      B: 0.10,
      C: 0.08,
      D: 0.06,
    };
    return rate <= maxRates[supplierLevel];
  }

  static getMaxDiscountRate(supplierLevel: SupplierLevel): number {
    const maxRates: Record<SupplierLevel, number> = {
      A: 0.12,
      B: 0.10,
      C: 0.08,
      D: 0.06,
    };
    return maxRates[supplierLevel];
  }
}

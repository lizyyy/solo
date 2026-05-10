import { DeliveryOrder, DamageType, DamageSeverity, DamageCompensation, ResponsibleParty } from '../types';
export declare class CompensationCalculator {
    calculateCompensation(order: DeliveryOrder, itemId: string, damageType: DamageType, damageSeverity: DamageSeverity, description: string): DamageCompensation;
    private getBaseCompensation;
    private getDamageTypeMultiplier;
    private determineResponsibleParty;
    private generateCompensationId;
    calculateMissingPartCompensation(order: DeliveryOrder, itemId: string, delayDays: number): number;
    calculateElevatorCompensation(order: DeliveryOrder, extraFlights: number): number;
    calculateLateDeliveryCompensation(order: DeliveryOrder, lateDays: number): number;
    generateCompensationSummary(compensations: DamageCompensation[]): {
        total: number;
        byType: Record<DamageType, number>;
        byParty: Record<ResponsibleParty, number>;
    };
}

import {
  DeliveryOrder,
  DamageType,
  DamageSeverity,
  DamageCompensation,
  ResponsibleParty
} from '../types';

export class CompensationCalculator {
  calculateCompensation(
    order: DeliveryOrder,
    itemId: string,
    damageType: DamageType,
    damageSeverity: DamageSeverity,
    description: string
  ): DamageCompensation {
    const item = order.items.find(i => i.itemId === itemId);
    if (!item) {
      throw new Error(`订单 ${order.orderId} 中未找到商品 ${itemId}`);
    }

    const baseCompensation = this.getBaseCompensation(item.price, damageSeverity);
    const typeMultiplier = this.getDamageTypeMultiplier(damageType);
    const finalCompensation = Math.round(baseCompensation * typeMultiplier * 100) / 100;

    const responsibleParty = this.determineResponsibleParty(damageType);

    return {
      compensationId: this.generateCompensationId(),
      orderId: order.orderId,
      itemId: itemId,
      damageType: damageType,
      damageSeverity: damageSeverity,
      compensationAmount: finalCompensation,
      responsibleParty: responsibleParty,
      description: description,
      reportedDate: new Date().toISOString().split('T')[0],
      status: 'pending'
    };
  }

  private getBaseCompensation(itemPrice: number, severity: DamageSeverity): number {
    switch (severity) {
      case 'minor':
        return itemPrice * 0.1;
      case 'moderate':
        return itemPrice * 0.3;
      case 'severe':
        return itemPrice * 0.6;
      default:
        return itemPrice * 0.1;
    }
  }

  private getDamageTypeMultiplier(damageType: DamageType): number {
    switch (damageType) {
      case 'product_damage':
        return 1.2;
      case 'installation_damage':
        return 1.0;
      case 'delivery_damage':
        return 1.1;
      case 'assembly_issue':
        return 0.8;
      default:
        return 1.0;
    }
  }

  private determineResponsibleParty(damageType: DamageType): ResponsibleParty {
    switch (damageType) {
      case 'product_damage':
        return 'supplier';
      case 'installation_damage':
        return 'installation_team';
      case 'delivery_damage':
        return 'delivery_team';
      case 'assembly_issue':
        return 'installation_team';
      default:
        return 'company';
    }
  }

  private generateCompensationId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `COMP-${timestamp}-${random}`.toUpperCase();
  }

  calculateMissingPartCompensation(
    order: DeliveryOrder,
    itemId: string,
    delayDays: number
  ): number {
    const item = order.items.find(i => i.itemId === itemId);
    if (!item) {
      throw new Error(`订单 ${order.orderId} 中未找到商品 ${itemId}`);
    }

    const dailyRate = item.price * 0.02;
    const maxDays = 30;
    const calculatedDays = Math.min(delayDays, maxDays);
    
    return Math.round(dailyRate * calculatedDays * 100) / 100;
  }

  calculateElevatorCompensation(
    order: DeliveryOrder,
    extraFlights: number
  ): number {
    const ratePerFloor = 50;
    const baseCompensation = extraFlights * ratePerFloor;
    
    const totalItemValue = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const maxCompensation = totalItemValue * 0.1;
    
    return Math.min(baseCompensation, maxCompensation);
  }

  calculateLateDeliveryCompensation(
    order: DeliveryOrder,
    lateDays: number
  ): number {
    const dailyRate = 20;
    const maxDays = 15;
    const calculatedDays = Math.min(lateDays, maxDays);
    
    return calculatedDays * dailyRate;
  }

  generateCompensationSummary(compensations: DamageCompensation[]): {
    total: number;
    byType: Record<DamageType, number>;
    byParty: Record<ResponsibleParty, number>;
  } {
    const summary = {
      total: 0,
      byType: {
        product_damage: 0,
        installation_damage: 0,
        delivery_damage: 0,
        assembly_issue: 0
      },
      byParty: {
        customer: 0,
        supplier: 0,
        delivery_team: 0,
        installation_team: 0,
        manufacturer: 0,
        company: 0
      }
    };

    for (const comp of compensations) {
      if (comp.status !== 'rejected') {
        summary.total += comp.compensationAmount;
        summary.byType[comp.damageType] += comp.compensationAmount;
        summary.byParty[comp.responsibleParty] += comp.compensationAmount;
      }
    }

    return summary;
  }
}

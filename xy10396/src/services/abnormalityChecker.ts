import {
  DeliveryOrder,
  ElevatorInfo,
  InstallationRecord,
  MissingPartRecord,
  RescheduleRecord,
  DamageCompensation,
  Abnormality,
  AbnormalityCheckResult,
  ResponsibleParty
} from '../types';

export class AbnormalityChecker {
  checkAllAbnormalities(
    order: DeliveryOrder,
    elevator?: ElevatorInfo,
    installations: InstallationRecord[] = [],
    missingParts: MissingPartRecord[] = [],
    reschedules: RescheduleRecord[] = [],
    compensations: DamageCompensation[] = []
  ): AbnormalityCheckResult {
    const abnormalities: Abnormality[] = [];

    const elevatorAbnormality = this.checkElevatorConflict(order, elevator);
    if (elevatorAbnormality) abnormalities.push(elevatorAbnormality);

    const missingPartsAbnormality = this.checkMissingParts(missingParts, order);
    if (missingPartsAbnormality) abnormalities.push(missingPartsAbnormality);

    const rescheduleAbnormality = this.checkRescheduleConflict(order, reschedules, installations);
    if (rescheduleAbnormality) abnormalities.push(rescheduleAbnormality);

    const damageAbnormality = this.checkDamage(compensations, order);
    if (damageAbnormality) abnormalities.push(damageAbnormality);

    const installationAbnormality = this.checkInstallationIssues(installations, order);
    if (installationAbnormality) abnormalities.push(installationAbnormality);

    const duplicateCompensationAbnormality = this.checkDuplicateCompensation(compensations, order);
    if (duplicateCompensationAbnormality) abnormalities.push(duplicateCompensationAbnormality);

    return {
      hasAbnormality: abnormalities.length > 0,
      abnormalities
    };
  }

  private checkElevatorConflict(order: DeliveryOrder, elevator?: ElevatorInfo): Abnormality | null {
    if (!elevator) return null;

    if (elevator.stairAccessOnly || !elevator.hasElevator) {
      const hasLargeItem = order.items.some(item => {
        const dims = item.dimensions;
        return dims.length > 1.2 || dims.width > 0.8 || dims.height > 2.0;
      });

      if (hasLargeItem && order.floor > 3) {
        return {
          orderId: order.orderId,
          type: 'elevator_conflict',
          severity: 'high',
          description: `订单包含大件家具，目标楼层(${order.floor}楼)无电梯或仅能走楼梯，大件无法搬运`,
          responsibleParty: 'delivery_team',
          status: 'open',
          createdAt: new Date().toISOString()
        };
      }
    }

    if (elevator.hasElevator && elevator.elevatorSize) {
      const elevatorDims = elevator.elevatorSize;
      const hasConflictingItem = order.items.some(item => {
        const itemDims = item.dimensions;
        return itemDims.length > elevatorDims.length ||
               itemDims.width > elevatorDims.width ||
               itemDims.height > elevatorDims.height;
      });

      if (hasConflictingItem) {
        return {
          orderId: order.orderId,
          type: 'elevator_conflict',
          severity: 'high',
          description: `订单包含大件家具，电梯尺寸(${elevatorDims.length}m x ${elevatorDims.width}m x ${elevatorDims.height}m)无法容纳`,
          responsibleParty: 'delivery_team',
          status: 'open',
          createdAt: new Date().toISOString()
        };
      }
    }

    return null;
  }

  private checkMissingParts(missingParts: MissingPartRecord[], order: DeliveryOrder): Abnormality | null {
    if (missingParts.length === 0) return null;

    const uncompletedMissingParts = missingParts.filter(
      part => part.status !== 'installed'
    );

    if (uncompletedMissingParts.length > 0) {
      const partNames = uncompletedMissingParts.map(p => p.partName).join(', ');
      const statusList = uncompletedMissingParts.map(p => p.status).join(', ');
      
      return {
        orderId: order.orderId,
        type: 'missing_parts',
        severity: 'high',
        description: `存在缺件未补齐：${partNames}，当前状态：${statusList}`,
        responsibleParty: 'supplier',
        status: 'open',
        createdAt: new Date().toISOString()
      };
    }

    return null;
  }

  private checkRescheduleConflict(
    order: DeliveryOrder,
    reschedules: RescheduleRecord[],
    installations: InstallationRecord[]
  ): Abnormality | null {
    if (reschedules.length === 0) return null;

    const approvedReschedule = reschedules.find(
      r => r.status === 'approved' || r.status === 'completed'
    );

    if (!approvedReschedule) return null;

    const installationOnOriginalDate = installations.find(
      inst => inst.installedDate === approvedReschedule.originalDate
    );

    if (installationOnOriginalDate) {
      return {
        orderId: order.orderId,
        type: 'reschedule_conflict',
        severity: 'high',
        description: `订单已改期至${approvedReschedule.newDate}，但仍在原日期(${approvedReschedule.originalDate})进行了安装/派送`,
        responsibleParty: 'installation_team',
        status: 'open',
        createdAt: new Date().toISOString()
      };
    }

    return null;
  }

  private checkDamage(compensations: DamageCompensation[], order: DeliveryOrder): Abnormality | null {
    if (compensations.length === 0) return null;

    const pendingDamages = compensations.filter(
      c => c.status === 'pending' || c.status === 'approved'
    );

    if (pendingDamages.length > 0) {
      const damageDescriptions = pendingDamages.map(d => d.description).join('; ');
      
      return {
        orderId: order.orderId,
        type: 'damage',
        severity: 'medium',
        description: `存在损坏记录待处理：${damageDescriptions}`,
        responsibleParty: pendingDamages[0].responsibleParty,
        status: 'open',
        createdAt: new Date().toISOString()
      };
    }

    return null;
  }

  private checkInstallationIssues(installations: InstallationRecord[], order: DeliveryOrder): Abnormality | null {
    if (installations.length === 0) return null;

    const incompleteInstallations = installations.filter(
      inst => !inst.isCompleted || inst.issues.length > 0
    );

    if (incompleteInstallations.length > 0) {
      const issues = incompleteInstallations.map(inst => {
        const itemInfo = order.items.find(i => i.itemId === inst.itemId);
        const itemName = itemInfo ? itemInfo.name : inst.itemId;
        return `${itemName}: ${inst.issues.join(', ') || '未完成安装'}`;
      }).join('; ');

      return {
        orderId: order.orderId,
        type: 'installation_issue',
        severity: 'medium',
        description: `安装存在问题：${issues}`,
        responsibleParty: 'installation_team',
        status: 'open',
        createdAt: new Date().toISOString()
      };
    }

    return null;
  }

  private checkDuplicateCompensation(compensations: DamageCompensation[], order: DeliveryOrder): Abnormality | null {
    const compensationGroups = new Map<string, DamageCompensation[]>();
    
    for (const comp of compensations) {
      const key = `${comp.itemId}-${comp.damageType}`;
      const existing = compensationGroups.get(key) || [];
      existing.push(comp);
      compensationGroups.set(key, existing);
    }

    for (const [key, comps] of compensationGroups) {
      const validComps = comps.filter(c => c.status !== 'rejected');
      if (validComps.length > 1) {
        return {
          orderId: order.orderId,
          type: 'duplicate_compensation',
          severity: 'high',
          description: `同一商品同一损坏类型存在多个赔付记录：${key}，共${validComps.length}条`,
          responsibleParty: 'company',
          status: 'open',
          createdAt: new Date().toISOString()
        };
      }
    }

    return null;
  }

  determineResponsibility(order: DeliveryOrder, abnormalityType: string): ResponsibleParty {
    switch (abnormalityType) {
      case 'missing_parts':
        return 'supplier';
      case 'elevator_conflict':
        return 'delivery_team';
      case 'reschedule_conflict':
        return 'installation_team';
      case 'damage':
        return 'delivery_team';
      case 'installation_issue':
        return 'installation_team';
      case 'late_delivery':
        return 'delivery_team';
      case 'duplicate_compensation':
        return 'company';
      default:
        return 'company';
    }
  }
}

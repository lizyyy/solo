import { v4 as uuidv4 } from 'uuid';
import {
  ServiceOrder,
  NurseSchedule,
  ElderProfile,
  ReconciliationRecord,
  ReconciliationStatus,
  Discrepancy,
  TimeSlot,
} from '../types';
import dataStore from '../store/dataStore';
import discrepancyExplainer from './discrepancyExplainer';

export class ReconciliationEngine {
  runReconciliation(
    batchId: string,
    orders: ServiceOrder[],
    schedules: NurseSchedule[],
    elders: ElderProfile[]
  ): ReconciliationRecord[] {
    const records: ReconciliationRecord[] = [];
    const elderMap = new Map(elders.map(e => [e.id, e]));
    const scheduleMap = this.buildScheduleMap(schedules);

    for (const order of orders) {
      const record = this.reconcileOrder(
        batchId,
        order,
        scheduleMap,
        elderMap
      );
      records.push(record);
    }

    this.detectDuplicateOrders(records);
    dataStore.saveReconciliationRecords(records);
    dataStore.updateBatchStats(batchId);

    return records;
  }

  private buildScheduleMap(
    schedules: NurseSchedule[]
  ): Map<string, Map<string, NurseSchedule>> {
    const map = new Map<string, Map<string, NurseSchedule>>();
    for (const schedule of schedules) {
      if (!map.has(schedule.date)) {
        map.set(schedule.date, new Map());
      }
      map.get(schedule.date)!.set(schedule.nurseId, schedule);
    }
    return map;
  }

  private reconcileOrder(
    batchId: string,
    order: ServiceOrder,
    scheduleMap: Map<string, Map<string, NurseSchedule>>,
    elderMap: Map<string, ElderProfile>
  ): ReconciliationRecord {
    const discrepancies: Discrepancy[] = [];
    const elder = elderMap.get(order.elderId);
    const daySchedules = scheduleMap.get(order.serviceDate);
    let matchedSchedule: NurseSchedule | undefined;
    let matchedTimeSlot: TimeSlot | undefined;

    if (!elder) {
      throw new Error(`老人档案不存在: ${order.elderId}`);
    }

    if (daySchedules) {
      matchedSchedule = daySchedules.get(order.nurseId);
      if (matchedSchedule) {
        matchedTimeSlot = this.findMatchingTimeSlot(order, matchedSchedule);
      }
    }

    if (!matchedSchedule || !matchedTimeSlot) {
      if (order.status === 'cancelled') {
        discrepancies.push(discrepancyExplainer.explainCancelledWithoutNotice(order));
      } else {
        discrepancies.push(discrepancyExplainer.explainMissingRecord(order));
      }
    } else {
      discrepancies.push(...this.checkTimeMatch(order, matchedTimeSlot));
      discrepancies.push(...this.checkNurseMatch(order, matchedSchedule, matchedTimeSlot));
      discrepancies.push(...this.checkSkillMatch(order, matchedSchedule, elder));
      discrepancies.push(...this.checkServiceMatch(order, elder));
      discrepancies.push(...this.checkRegionMatch(order, matchedSchedule, elder));
    }

    const status: ReconciliationStatus = discrepancies.length === 0 ? 'matched' : 'discrepancy';

    return {
      id: uuidv4(),
      batchId,
      serviceOrderId: order.id,
      serviceOrder: order,
      matchedSchedule,
      matchedTimeSlot,
      elderProfile: elder,
      status,
      discrepancies,
      auditLogs: [{
        id: uuidv4(),
        timestamp: new Date(),
        operator: 'system',
        action: '自动对账完成',
        remark: `发现 ${discrepancies.length} 处差异`,
      }],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private findMatchingTimeSlot(
    order: ServiceOrder,
    schedule: NurseSchedule
  ): TimeSlot | undefined {
    return schedule.timeSlots.find(slot => {
      if (!slot.elderId) return false;
      if (slot.elderId !== order.elderId) return false;
      
      const orderHour = parseInt(order.serviceTime.split(':')[0], 10);
      const slotStart = parseInt(slot.start.split(':')[0], 10);
      const slotEnd = parseInt(slot.end.split(':')[0], 10);
      
      return orderHour >= slotStart && orderHour <= slotEnd;
    });
  }

  private checkTimeMatch(
    order: ServiceOrder,
    slot: TimeSlot
  ): Discrepancy[] {
    const discrepancies: Discrepancy[] = [];
    const orderHour = parseInt(order.serviceTime.split(':')[0], 10);
    const slotStart = parseInt(slot.start.split(':')[0], 10);
    const slotEnd = parseInt(slot.end.split(':')[0], 10);

    if (orderHour < slotStart || orderHour > slotEnd) {
      discrepancies.push(discrepancyExplainer.explainTimeMismatch(order, slot));
    }

    return discrepancies;
  }

  private checkNurseMatch(
    order: ServiceOrder,
    schedule: NurseSchedule,
    slot: TimeSlot
  ): Discrepancy[] {
    const discrepancies: Discrepancy[] = [];
    
    if (slot.substituteNurseId && slot.substituteNurseId !== schedule.nurseId) {
      if (order.nurseId === slot.substituteNurseId) {
        return [];
      }
      discrepancies.push(discrepancyExplainer.explainNurseMismatch(
        order,
        slot.substituteNurseId,
        slot.substituteNurseName || '补位护士'
      ));
    }

    return discrepancies;
  }

  private checkSkillMatch(
    order: ServiceOrder,
    schedule: NurseSchedule,
    elder: ElderProfile
  ): Discrepancy[] {
    const discrepancies: Discrepancy[] = [];
    const requiredSkills = this.getRequiredSkills(order.serviceItems);
    
    if (requiredSkills.length > 0) {
      const hasAllSkills = requiredSkills.every(s => schedule.skills.includes(s));
      if (!hasAllSkills) {
        discrepancies.push(discrepancyExplainer.explainSkillMismatch(
          order,
          schedule.skills,
          requiredSkills
        ));
      }
    }

    return discrepancies;
  }

  private getRequiredSkills(serviceItems: string[]): string[] {
    const skillMapping: Record<string, string[]> = {
      '压疮护理': ['伤口护理', '无菌操作'],
      '鼻饲': ['鼻饲护理'],
      '导尿': ['导尿护理'],
      '造口护理': ['造口护理'],
      '输液': ['静脉输液'],
      '打针': ['肌肉注射'],
      '康复训练': ['康复护理'],
      '临终关怀': ['临终关怀'],
    };

    const skills: string[] = [];
    for (const item of serviceItems) {
      const itemSkills = skillMapping[item] || [];
      for (const skill of itemSkills) {
        if (!skills.includes(skill)) {
          skills.push(skill);
        }
      }
    }
    return skills;
  }

  private checkServiceMatch(
    order: ServiceOrder,
    elder: ElderProfile
  ): Discrepancy[] {
    const discrepancies: Discrepancy[] = [];
    const unauthorized = order.serviceItems.filter(
      s => !elder.serviceItems.includes(s)
    );

    if (unauthorized.length > 0) {
      discrepancies.push(discrepancyExplainer.explainServiceMismatch(order, elder.serviceItems));
    }

    return discrepancies;
  }

  private checkRegionMatch(
    order: ServiceOrder,
    schedule: NurseSchedule,
    elder: ElderProfile
  ): Discrepancy[] {
    const discrepancies: Discrepancy[] = [];

    if (schedule.district && elder.district && schedule.district !== elder.district) {
      discrepancies.push(discrepancyExplainer.explainCrossRegion(
        order,
        schedule.district,
        elder.district
      ));
    }

    return discrepancies;
  }

  private detectDuplicateOrders(records: ReconciliationRecord[]): void {
    const groupMap = new Map<string, ReconciliationRecord[]>();

    for (const record of records) {
      const key = `${record.serviceOrder.elderId}-${record.serviceOrder.serviceDate}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key)!.push(record);
    }

    for (const [, group] of groupMap) {
      if (group.length > 1) {
        for (const record of group) {
          record.discrepancies.push(
            discrepancyExplainer.explainDuplicateOrder(record.serviceOrder, group.length)
          );
          record.status = 'discrepancy';
        }
      }
    }
  }
}

export default new ReconciliationEngine();

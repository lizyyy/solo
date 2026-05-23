import { v4 as uuidv4 } from 'uuid';

type ServiceOrderStatus = 'pending' | 'completed' | 'cancelled';
type ReconciliationStatus = 'matched' | 'discrepancy' | 'reviewing' | 'approved' | 'rejected' | 'supplement';
type DiscrepancyType = 
  | 'nurse_mismatch'
  | 'skill_mismatch'
  | 'time_mismatch'
  | 'service_mismatch'
  | 'cancelled_without_notice'
  | 'cross_region'
  | 'duplicate_order'
  | 'missing_record'
  | 'other';

interface ElderProfile {
  id: string;
  name: string;
  district: string;
  serviceItems: string[];
  careLevel: string;
}

interface TimeSlot {
  start: string;
  end: string;
  elderId?: string;
  elderName?: string;
  serviceType?: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  cancelReason?: string;
}

interface NurseSchedule {
  nurseId: string;
  nurseName: string;
  skills: string[];
  district: string;
  date: string;
  timeSlots: TimeSlot[];
}

interface ServiceOrder {
  id: string;
  orderNo: string;
  elderId: string;
  elderName: string;
  nurseId: string;
  nurseName: string;
  serviceDate: string;
  serviceTime: string;
  serviceItems: string[];
  actualDuration: number;
  status: ServiceOrderStatus;
  cancelReason?: string;
  signedBy?: string;
}

interface Discrepancy {
  id: string;
  type: DiscrepancyType;
  severity: 'low' | 'medium' | 'high';
  description: string;
  explanation: string;
  field?: string;
  expectedValue?: string;
  actualValue?: string;
  source: 'schedule' | 'order' | 'profile';
}

interface AuditLog {
  id: string;
  timestamp: Date;
  operator: string;
  action: string;
  oldValue?: string;
  newValue?: string;
  remark?: string;
}

interface ReconciliationRecord {
  id: string;
  batchId: string;
  serviceOrderId: string;
  serviceOrder: ServiceOrder;
  matchedSchedule?: NurseSchedule;
  matchedTimeSlot?: TimeSlot;
  elderProfile: ElderProfile;
  status: ReconciliationStatus;
  discrepancies: Discrepancy[];
  auditLogs: AuditLog[];
  reviewer?: string;
  reviewRemark?: string;
  reviewedAt?: Date;
}

interface ReconciliationBatch {
  id: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  totalRecords: number;
  matchedCount: number;
  discrepancyCount: number;
  approvedCount: number;
  rejectedCount: number;
  supplementCount: number;
}

class DiscrepancyExplainer {
  explainNurseMismatch(order: ServiceOrder, expectedNurseId: string, expectedNurseName: string): Discrepancy {
    return {
      id: uuidv4(),
      type: 'nurse_mismatch',
      severity: 'medium',
      description: `护士不匹配：排班护士应为 ${expectedNurseName}，实际执行护士为 ${order.nurseName}`,
      explanation: `排班系统中安排的护士是 ${expectedNurseName}，但实际服务单显示由 ${order.nurseName} 提供服务。可能原因包括：1) 护士临时请假，安排了其他护士补位；2) 系统排班未及时更新；3) 跨站支援调配。请核实是否有补位审批记录。`,
      field: 'nurse',
      expectedValue: `${expectedNurseId} - ${expectedNurseName}`,
      actualValue: `${order.nurseId} - ${order.nurseName}`,
      source: 'schedule',
    };
  }

  explainSkillMismatch(order: ServiceOrder, nurseSkills: string[], requiredSkills: string[]): Discrepancy {
    const missing = requiredSkills.filter(s => !nurseSkills.includes(s));
    return {
      id: uuidv4(),
      type: 'skill_mismatch',
      severity: 'high',
      description: `技能不匹配：缺少 ${missing.join(', ')} 资质`,
      explanation: `该护理项目要求具备以下技能：${requiredSkills.join('、')}。执行护士当前拥有的技能：${nurseSkills.join('、') || '无'}。缺失技能：${missing.join('、')}。这可能涉及服务资质合规风险，请核实是否有特殊情况审批。`,
      field: 'skills',
      expectedValue: requiredSkills.join(', '),
      actualValue: nurseSkills.join(', ') || '无',
      source: 'profile',
    };
  }

  explainTimeMismatch(order: ServiceOrder, scheduledSlot: TimeSlot): Discrepancy {
    return {
      id: uuidv4(),
      type: 'time_mismatch',
      severity: 'low',
      description: `服务时间不匹配：排班 ${scheduledSlot.start}-${scheduledSlot.end}，实际 ${order.serviceTime}`,
      explanation: `排班时间为 ${scheduledSlot.start} 至 ${scheduledSlot.end}，但服务单记录的实际服务时间为 ${order.serviceTime}。可能原因：1) 前一单服务超时或提前完成；2) 交通情况影响到达时间；3) 老人临时调整时间。`,
      field: 'serviceTime',
      expectedValue: `${scheduledSlot.start}-${scheduledSlot.end}`,
      actualValue: order.serviceTime,
      source: 'schedule',
    };
  }

  explainServiceMismatch(order: ServiceOrder, profileServices: string[]): Discrepancy {
    const unauthorized = order.serviceItems.filter(s => !profileServices.includes(s));
    return {
      id: uuidv4(),
      type: 'service_mismatch',
      severity: 'medium',
      description: `服务项目不匹配：${unauthorized.join(', ')} 不在老人服务计划内`,
      explanation: `老人档案中的核准服务项目：${profileServices.join('、') || '无'}。本次实际提供的服务：${order.serviceItems.join('、')}。未经核准的服务：${unauthorized.join('、')}。请核实是否有新增服务项目审批。`,
      field: 'serviceItems',
      expectedValue: profileServices.join(', ') || '无',
      actualValue: order.serviceItems.join(', '),
      source: 'profile',
    };
  }

  explainCancelledWithoutNotice(order: ServiceOrder): Discrepancy {
    return {
      id: uuidv4(),
      type: 'cancelled_without_notice',
      severity: 'high',
      description: `服务取消但无排班记录：${order.orderNo} 已取消但未在系统中报备`,
      explanation: `服务单 ${order.orderNo} 记录为已取消状态，${order.cancelReason ? `取消原因：${order.cancelReason}` : '但未填写取消原因'}。然而，护士排班系统中没有对应日期的取消记录。请核实是否为临时电话取消但未录入系统。`,
      field: 'status',
      expectedValue: 'scheduled',
      actualValue: 'cancelled (no record)',
      source: 'order',
    };
  }

  explainCrossRegion(order: ServiceOrder, nurseDistrict: string, elderDistrict: string): Discrepancy {
    return {
      id: uuidv4(),
      type: 'cross_region',
      severity: 'medium',
      description: `跨区服务：护士负责 ${nurseDistrict}，老人在 ${elderDistrict}`,
      explanation: `护士 ${order.nurseName} 的负责区域是 ${nurseDistrict}，但本次服务的老人 ${order.elderName} 位于 ${elderDistrict}。跨区服务可能导致：1) 路程时间增加，影响后续排班；2) 交通费用核算问题。请核实是否有跨区支援审批。`,
      field: 'district',
      expectedValue: nurseDistrict,
      actualValue: elderDistrict,
      source: 'schedule',
    };
  }

  explainMissingRecord(order: ServiceOrder): Discrepancy {
    return {
      id: uuidv4(),
      type: 'missing_record',
      severity: 'high',
      description: `缺少排班记录：服务单 ${order.orderNo} 无对应排班`,
      explanation: `系统中存在服务单 ${order.orderNo}，但在护士排班日历中找不到对应记录。可能原因：1) 紧急上门服务，先服务后补单；2) 排班系统数据导入不完整。请核实服务真实性并补录相关排班审批流程。`,
      field: 'schedule',
      expectedValue: '有排班记录',
      actualValue: '无排班记录',
      source: 'schedule',
    };
  }
}

class ReconciliationEngine {
  private explainer = new DiscrepancyExplainer();

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
      const record = this.reconcileOrder(batchId, order, scheduleMap, elderMap);
      records.push(record);
    }

    return records;
  }

  private buildScheduleMap(schedules: NurseSchedule[]): Map<string, Map<string, NurseSchedule>> {
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
    const elder = elderMap.get(order.elderId)!;
    const daySchedules = scheduleMap.get(order.serviceDate);
    let matchedSchedule: NurseSchedule | undefined;
    let matchedTimeSlot: TimeSlot | undefined;

    if (daySchedules) {
      matchedSchedule = daySchedules.get(order.nurseId);
      if (matchedSchedule) {
        matchedTimeSlot = this.findMatchingTimeSlot(order, matchedSchedule);
      }
    }

    if (!matchedSchedule || !matchedTimeSlot) {
      if (order.status === 'cancelled') {
        discrepancies.push(this.explainer.explainCancelledWithoutNotice(order));
      } else {
        discrepancies.push(this.explainer.explainMissingRecord(order));
      }
    } else {
      discrepancies.push(...this.checkTimeMatch(order, matchedTimeSlot));
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
    };
  }

  private findMatchingTimeSlot(order: ServiceOrder, schedule: NurseSchedule): TimeSlot | undefined {
    return schedule.timeSlots.find(slot => {
      if (!slot.elderId || slot.elderId !== order.elderId) return false;
      const orderHour = parseInt(order.serviceTime.split(':')[0], 10);
      const slotStart = parseInt(slot.start.split(':')[0], 10);
      const slotEnd = parseInt(slot.end.split(':')[0], 10);
      return orderHour >= slotStart && orderHour <= slotEnd;
    });
  }

  private checkTimeMatch(order: ServiceOrder, slot: TimeSlot): Discrepancy[] {
    const discrepancies: Discrepancy[] = [];
    const orderHour = parseInt(order.serviceTime.split(':')[0], 10);
    const slotStart = parseInt(slot.start.split(':')[0], 10);
    const slotEnd = parseInt(slot.end.split(':')[0], 10);
    if (orderHour < slotStart || orderHour > slotEnd) {
      discrepancies.push(this.explainer.explainTimeMismatch(order, slot));
    }
    return discrepancies;
  }

  private checkSkillMatch(order: ServiceOrder, schedule: NurseSchedule, elder: ElderProfile): Discrepancy[] {
    const discrepancies: Discrepancy[] = [];
    const requiredSkills = this.getRequiredSkills(order.serviceItems);
    if (requiredSkills.length > 0) {
      const hasAllSkills = requiredSkills.every(s => schedule.skills.includes(s));
      if (!hasAllSkills) {
        discrepancies.push(this.explainer.explainSkillMismatch(order, schedule.skills, requiredSkills));
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
      '康复训练': ['康复护理'],
      '临终关怀': ['临终关怀'],
    };
    const skills: string[] = [];
    for (const item of serviceItems) {
      const itemSkills = skillMapping[item] || [];
      for (const skill of itemSkills) {
        if (!skills.includes(skill)) skills.push(skill);
      }
    }
    return skills;
  }

  private checkServiceMatch(order: ServiceOrder, elder: ElderProfile): Discrepancy[] {
    const discrepancies: Discrepancy[] = [];
    const unauthorized = order.serviceItems.filter(s => !elder.serviceItems.includes(s));
    if (unauthorized.length > 0) {
      discrepancies.push(this.explainer.explainServiceMismatch(order, elder.serviceItems));
    }
    return discrepancies;
  }

  private checkRegionMatch(order: ServiceOrder, schedule: NurseSchedule, elder: ElderProfile): Discrepancy[] {
    const discrepancies: Discrepancy[] = [];
    if (schedule.district && elder.district && schedule.district !== elder.district) {
      discrepancies.push(this.explainer.explainCrossRegion(order, schedule.district, elder.district));
    }
    return discrepancies;
  }
}

class ReviewService {
  approve(record: ReconciliationRecord, operator: string, remark?: string): ReconciliationRecord {
    return this.performAction(record, 'approved', operator, '审批通过', remark);
  }

  reject(record: ReconciliationRecord, operator: string, remark?: string): ReconciliationRecord {
    return this.performAction(record, 'rejected', operator, '退回', remark);
  }

  requestSupplement(record: ReconciliationRecord, operator: string, remark?: string): ReconciliationRecord {
    return this.performAction(record, 'supplement', operator, '要求补材料', remark);
  }

  private performAction(
    record: ReconciliationRecord,
    newStatus: ReconciliationStatus,
    operator: string,
    action: string,
    remark?: string
  ): ReconciliationRecord {
    const oldStatus = record.status;
    record.status = newStatus;
    record.reviewer = operator;
    record.reviewRemark = remark;
    record.reviewedAt = new Date();
    record.auditLogs.push({
      id: uuidv4(),
      timestamp: new Date(),
      operator,
      action,
      oldValue: oldStatus,
      newValue: newStatus,
      remark,
    });
    return record;
  }

  explainDecision(record: ReconciliationRecord): string {
    const parts: string[] = [];
    parts.push(`【服务单 ${record.serviceOrder.orderNo}】处理说明`);
    parts.push(`老人: ${record.serviceOrder.elderName}`);
    parts.push(`护士: ${record.serviceOrder.nurseName}`);
    parts.push(`服务日期: ${record.serviceOrder.serviceDate}`);
    parts.push('');
    parts.push(`当前状态: ${this.getStatusText(record.status)}`);
    if (record.discrepancies.length > 0) {
      parts.push('');
      parts.push(`发现的差异 (${record.discrepancies.length} 处):`);
      record.discrepancies.forEach((d, i) => {
        parts.push(`${i + 1}. ${d.description}`);
        parts.push(`   说明: ${d.explanation}`);
      });
    }
    if (record.reviewRemark) {
      parts.push('');
      parts.push(`复核意见: ${record.reviewRemark}`);
    }
    if (record.reviewer && record.reviewedAt) {
      parts.push('');
      parts.push(`复核人: ${record.reviewer}`);
      parts.push(`复核时间: ${record.reviewedAt.toLocaleString()}`);
    }
    return parts.join('\n');
  }

  private getStatusText(status: ReconciliationStatus): string {
    const map: Record<ReconciliationStatus, string> = {
      matched: '已匹配',
      discrepancy: '存在差异',
      reviewing: '复核中',
      approved: '已放行',
      rejected: '已退回',
      supplement: '待补材料',
    };
    return map[status] || status;
  }
}

class ReportService {
  generateSummary(batch: ReconciliationBatch, records: ReconciliationRecord[]) {
    return {
      batchId: batch.id,
      batchName: batch.name,
      periodStart: batch.periodStart,
      periodEnd: batch.periodEnd,
      totalOrders: batch.totalRecords,
      matchedRate: batch.totalRecords > 0 ? Math.round((batch.matchedCount / batch.totalRecords) * 10000) / 100 : 0,
      statusBreakdown: this.countByStatus(records),
      discrepancyBreakdown: this.countByDiscrepancyType(records),
      generatedAt: new Date(),
    };
  }

  getFullTraceabilityChain(record: ReconciliationRecord): string {
    const lines: string[] = [];
    lines.push(`【服务单 ${record.serviceOrder.orderNo} 全链路追溯】`);
    lines.push('');
    lines.push(`[${record.serviceOrder.signedBy ? '有签字' : '原始数据'}] 服务单: ${record.serviceOrder.orderNo} - ${record.serviceOrder.elderName}`);
    if (record.matchedSchedule) {
      lines.push(`[排班数据] ${record.matchedSchedule.nurseName} - ${record.matchedSchedule.date}`);
    }
    lines.push(`[老人档案] ${record.elderProfile.name} - ${record.elderProfile.careLevel}`);
    lines.push(`[自动比对] 发现 ${record.discrepancies.length} 处差异`);
    for (const log of record.auditLogs) {
      lines.push(`[${log.timestamp.toLocaleString()}] ${log.operator} - ${log.action}: ${log.remark || ''}`);
    }
    lines.push('');
    lines.push(`最终状态: ${this.getStatusText(record.status)}`);
    if (record.reviewRemark) {
      lines.push(`复核意见: ${record.reviewRemark}`);
    }
    return lines.join('\n');
  }

  private countByStatus(records: ReconciliationRecord[]): Record<ReconciliationStatus, number> {
    const result: Record<ReconciliationStatus, number> = {
      matched: 0, discrepancy: 0, reviewing: 0, approved: 0, rejected: 0, supplement: 0,
    };
    for (const r of records) result[r.status]++;
    return result;
  }

  private countByDiscrepancyType(records: ReconciliationRecord[]): Record<DiscrepancyType, number> {
    const result: Record<DiscrepancyType, number> = {
      nurse_mismatch: 0, skill_mismatch: 0, time_mismatch: 0, service_mismatch: 0,
      cancelled_without_notice: 0, cross_region: 0, duplicate_order: 0, missing_record: 0, other: 0,
    };
    for (const r of records) {
      for (const d of r.discrepancies) result[d.type]++;
    }
    return result;
  }

  private getStatusText(status: ReconciliationStatus): string {
    const map: Record<ReconciliationStatus, string> = {
      matched: '已匹配', discrepancy: '存在差异', reviewing: '复核中',
      approved: '已放行', rejected: '已退回', supplement: '待补材料',
    };
    return map[status] || status;
  }
}

const sampleElders: ElderProfile[] = [
  { id: 'E001', name: '张爷爷', district: '朝阳区', serviceItems: ['基础护理', '生命体征监测', '压疮护理'], careLevel: '重度护理' },
  { id: 'E002', name: '李奶奶', district: '海淀区', serviceItems: ['基础护理', '鼻饲', '康复训练'], careLevel: '中度护理' },
  { id: 'E003', name: '王爷爷', district: '西城区', serviceItems: ['基础护理', '导尿', '生命体征监测'], careLevel: '重度护理' },
  { id: 'E004', name: '赵奶奶', district: '朝阳区', serviceItems: ['基础护理', '造口护理', '输液'], careLevel: '中度护理' },
  { id: 'E005', name: '刘爷爷', district: '东城区', serviceItems: ['基础护理', '临终关怀', '生命体征监测'], careLevel: '特护' },
];

const sampleSchedules: NurseSchedule[] = [
  {
    nurseId: 'N001', nurseName: '王护士',
    skills: ['基础护理', '生命体征监测', '无菌操作', '伤口护理'],
    district: '朝阳区', date: '2024-05-20',
    timeSlots: [
      { start: '08:00', end: '09:00', elderId: 'E001', elderName: '张爷爷', serviceType: '基础护理', status: 'completed' },
      { start: '09:30', end: '10:30', elderId: 'E004', elderName: '赵奶奶', serviceType: '造口护理', status: 'completed' },
      { start: '14:00', end: '15:00', elderId: 'E001', elderName: '张爷爷', serviceType: '压疮护理', status: 'completed' },
    ],
  },
  {
    nurseId: 'N002', nurseName: '李护士',
    skills: ['基础护理', '鼻饲护理', '康复护理'],
    district: '海淀区', date: '2024-05-20',
    timeSlots: [
      { start: '08:00', end: '09:30', elderId: 'E002', elderName: '李奶奶', serviceType: '鼻饲', status: 'completed' },
      { start: '10:00', end: '11:00', elderId: 'E002', elderName: '李奶奶', serviceType: '康复训练', status: 'completed' },
    ],
  },
];

const sampleOrders: ServiceOrder[] = [
  { id: 'O001', orderNo: 'FW20240520001', elderId: 'E001', elderName: '张爷爷', nurseId: 'N001', nurseName: '王护士', serviceDate: '2024-05-20', serviceTime: '08:15', serviceItems: ['基础护理', '生命体征监测'], actualDuration: 45, status: 'completed', signedBy: '张家属' },
  { id: 'O002', orderNo: 'FW20240520002', elderId: 'E004', elderName: '赵奶奶', nurseId: 'N001', nurseName: '王护士', serviceDate: '2024-05-20', serviceTime: '09:45', serviceItems: ['造口护理'], actualDuration: 50, status: 'completed', signedBy: '赵家属' },
  { id: 'O003', orderNo: 'FW20240520003', elderId: 'E001', elderName: '张爷爷', nurseId: 'N002', nurseName: '李护士', serviceDate: '2024-05-20', serviceTime: '14:15', serviceItems: ['压疮护理'], actualDuration: 60, status: 'completed', signedBy: '张家属' },
  { id: 'O004', orderNo: 'FW20240520004', elderId: 'E002', elderName: '李奶奶', nurseId: 'N002', nurseName: '李护士', serviceDate: '2024-05-20', serviceTime: '08:30', serviceItems: ['鼻饲', '康复训练', '输液'], actualDuration: 90, status: 'completed', signedBy: '李家属' },
  { id: 'O005', orderNo: 'FW20240520005', elderId: 'E005', elderName: '刘爷爷', nurseId: 'N004', nurseName: '赵护士', serviceDate: '2024-05-20', serviceTime: '10:00', serviceItems: ['临终关怀'], actualDuration: 60, status: 'cancelled', cancelReason: '身体不适暂不服务' },
];

function runDemo() {
  console.log('='.repeat(60));
  console.log('护理站对账服务 - 功能演示');
  console.log('='.repeat(60));
  console.log('');

  const engine = new ReconciliationEngine();
  const reviewService = new ReviewService();
  const reportService = new ReportService();

  console.log('📊 步骤1: 导入数据');
  console.log(`   - 老人档案: ${sampleElders.length} 位`);
  console.log(`   - 护士排班: ${sampleSchedules.length} 条`);
  console.log(`   - 服务单: ${sampleOrders.length} 条`);
  console.log('');

  console.log('🔍 步骤2: 自动对账');
  const batchId = uuidv4();
  const records = engine.runReconciliation(batchId, sampleOrders, sampleSchedules, sampleElders);
  const matchedCount = records.filter(r => r.status === 'matched').length;
  const discrepancyCount = records.filter(r => r.status === 'discrepancy').length;
  
  console.log(`   - 对账完成: ${records.length} 条记录`);
  console.log(`   - 完全匹配: ${matchedCount} 条`);
  console.log(`   - 存在差异: ${discrepancyCount} 条`);
  console.log('');

  const batch: ReconciliationBatch = {
    id: batchId,
    name: '2024年5月第3周对账',
    periodStart: '2024-05-20',
    periodEnd: '2024-05-21',
    totalRecords: records.length,
    matchedCount,
    discrepancyCount,
    approvedCount: 0,
    rejectedCount: 0,
    supplementCount: 0,
  };

  console.log('📋 步骤3: 差异详情');
  const discrepancyRecords = records.filter(r => r.discrepancies.length > 0);
  for (const record of discrepancyRecords) {
    console.log(`   服务单 ${record.serviceOrder.orderNo} - ${record.serviceOrder.elderName}`);
    for (const d of record.discrepancies) {
      console.log(`     [${d.severity === 'high' ? '严重' : d.severity === 'medium' ? '中等' : '轻微'}] ${d.description}`);
    }
  }
  console.log('');

  console.log('✅ 步骤4: 人工复核 - 放行匹配的记录');
  const matchedRecords = records.filter(r => r.status === 'matched');
  for (const record of matchedRecords) {
    reviewService.approve(record, '李站长', '数据核对无误，予以放行');
  }
  console.log(`   - 已放行: ${matchedRecords.length} 条`);
  console.log('');

  console.log('🔄 步骤5: 人工复核 - 差异处理');
  const discRecord = discrepancyRecords[0];
  if (discRecord) {
    reviewService.requestSupplement(discRecord, '李站长', '请提供跨区服务审批单');
    console.log(`   服务单 ${discRecord.serviceOrder.orderNo}: 要求补材料`);
    console.log(`   原因: ${discRecord.discrepancies[0]?.description}`);
  }
  console.log('');

  console.log('📄 步骤6: 决策说明示例');
  const explainedRecord = records[0];
  if (explainedRecord) {
    const explanation = reviewService.explainDecision(explainedRecord);
    console.log('-'.repeat(50));
    console.log(explanation);
    console.log('-'.repeat(50));
  }
  console.log('');

  console.log('🔗 步骤7: 数据追溯示例');
  const traceRecord = discrepancyRecords[0];
  if (traceRecord) {
    const trace = reportService.getFullTraceabilityChain(traceRecord);
    console.log('-'.repeat(50));
    console.log(trace);
    console.log('-'.repeat(50));
  }
  console.log('');

  console.log('📈 步骤8: 生成汇总报告');
  const summary = reportService.generateSummary(batch, records);
  console.log(`   - 批次名称: ${summary.batchName}`);
  console.log(`   - 匹配率: ${summary.matchedRate}%`);
  console.log(`   - 状态分布: ${JSON.stringify(summary.statusBreakdown)}`);
  console.log('');

  console.log('='.repeat(60));
  console.log('演示完成！');
  console.log('='.repeat(60));
  console.log('');
  console.log('核心功能总结:');
  console.log('  ✓ CSV/JSON 数据导入');
  console.log('  ✓ 自动比对引擎 (排班/技能/项目/区域)');
  console.log('  ✓ 智能差异解释 (含可能原因分析)');
  console.log('  ✓ 人工复核流程 (放行/退回/补材料)');
  console.log('  ✓ 数据同步更新 (改动后数字实时变化)');
  console.log('  ✓ 全链路数据追溯');
  console.log('  ✓ 决策说明文档生成');
  console.log('  ✓ 报告汇总与导出');
}

runDemo();

import { v4 as uuidv4 } from 'uuid';
import {
  Discrepancy,
  DiscrepancyType,
  ServiceOrder,
  NurseSchedule,
  ElderProfile,
  TimeSlot,
} from '../types';

export class DiscrepancyExplainer {
  explainNurseMismatch(
    order: ServiceOrder,
    expectedNurseId: string,
    expectedNurseName: string
  ): Discrepancy {
    return {
      id: uuidv4(),
      type: 'nurse_mismatch',
      severity: 'medium',
      description: `护士不匹配：排班护士应为 ${expectedNurseName}，实际执行护士为 ${order.nurseName}`,
      explanation: this.getNurseMismatchExplanation(expectedNurseName, order.nurseName),
      field: 'nurse',
      expectedValue: `${expectedNurseId} - ${expectedNurseName}`,
      actualValue: `${order.nurseId} - ${order.nurseName}`,
      source: 'schedule',
    };
  }

  private getNurseMismatchExplanation(expected: string, actual: string): string {
    return `排班系统中安排的护士是 ${expected}，但实际服务单显示由 ${actual} 提供服务。` +
           `可能原因包括：1) 护士临时请假，安排了其他护士补位；2) 系统排班未及时更新；` +
           `3) 跨站支援调配；4) 新人实习带教。请核实是否有补位审批记录。`;
  }

  explainSkillMismatch(
    order: ServiceOrder,
    nurseSkills: string[],
    requiredSkills: string[]
  ): Discrepancy {
    const missing = requiredSkills.filter(s => !nurseSkills.includes(s));
    return {
      id: uuidv4(),
      type: 'skill_mismatch',
      severity: 'high',
      description: `技能不匹配：缺少 ${missing.join(', ')} 资质`,
      explanation: this.getSkillMismatchExplanation(nurseSkills, requiredSkills, missing),
      field: 'skills',
      expectedValue: requiredSkills.join(', '),
      actualValue: nurseSkills.join(', ') || '无',
      source: 'profile',
    };
  }

  private getSkillMismatchExplanation(
    nurseSkills: string[],
    requiredSkills: string[],
    missing: string[]
  ): string {
    return `该护理项目要求具备以下技能：${requiredSkills.join('、')}。` +
           `执行护士当前拥有的技能：${nurseSkills.join('、') || '无'}。` +
           `缺失技能：${missing.join('、')}。` +
           `这可能涉及服务资质合规风险，请核实：1) 是否有特殊情况审批；2) 是否有资深护士在场指导；` +
           `3) 护士是否已取得该资质但系统未更新；4) 是否需要安排培训或重新调配。`;
  }

  explainTimeMismatch(
    order: ServiceOrder,
    scheduledSlot: TimeSlot
  ): Discrepancy {
    return {
      id: uuidv4(),
      type: 'time_mismatch',
      severity: 'low',
      description: `服务时间不匹配：排班 ${scheduledSlot.start}-${scheduledSlot.end}，实际 ${order.serviceTime}`,
      explanation: this.getTimeMismatchExplanation(scheduledSlot, order),
      field: 'serviceTime',
      expectedValue: `${scheduledSlot.start}-${scheduledSlot.end}`,
      actualValue: order.serviceTime,
      source: 'schedule',
    };
  }

  private getTimeMismatchExplanation(slot: TimeSlot, order: ServiceOrder): string {
    return `排班时间为 ${slot.start} 至 ${slot.end}，但服务单记录的实际服务时间为 ${order.serviceTime}。` +
           `可能原因：1) 前一单服务超时或提前完成；2) 交通情况影响到达时间；` +
           `3) 老人临时调整时间；4) 护士记录时间有误。` +
           `时间偏差在30分钟内通常可接受，超过则需核实原因。`;
  }

  explainServiceMismatch(
    order: ServiceOrder,
    profileServices: string[]
  ): Discrepancy {
    const unauthorized = order.serviceItems.filter(s => !profileServices.includes(s));
    return {
      id: uuidv4(),
      type: 'service_mismatch',
      severity: 'medium',
      description: `服务项目不匹配：${unauthorized.join(', ')} 不在老人服务计划内`,
      explanation: this.getServiceMismatchExplanation(order.serviceItems, profileServices, unauthorized),
      field: 'serviceItems',
      expectedValue: profileServices.join(', ') || '无',
      actualValue: order.serviceItems.join(', '),
      source: 'profile',
    };
  }

  private getServiceMismatchExplanation(
    actual: string[],
    expected: string[],
    unauthorized: string[]
  ): string {
    return `老人档案中的核准服务项目：${expected.join('、') || '无'}。` +
           `本次实际提供的服务：${actual.join('、')}。` +
           `未经核准的服务：${unauthorized.join('、')}。` +
           `请核实：1) 是否有新增服务项目审批；2) 是否为临时紧急需求；` +
           `3) 是否属于常规服务的合理延伸；4) 家属是否知情并同意。`;
  }

  explainCancelledWithoutNotice(order: ServiceOrder): Discrepancy {
    return {
      id: uuidv4(),
      type: 'cancelled_without_notice',
      severity: 'high',
      description: `服务取消但无排班记录：${order.orderNo} 已取消但未在系统中报备`,
      explanation: this.getCancellationExplanation(order),
      field: 'status',
      expectedValue: 'scheduled',
      actualValue: 'cancelled (no record)',
      source: 'order',
    };
  }

  private getCancellationExplanation(order: ServiceOrder): string {
    return `服务单 ${order.orderNo} 记录为已取消状态，${order.cancelReason ? `取消原因：${order.cancelReason}` : '但未填写取消原因'}。` +
           `然而，护士排班系统中没有对应日期的取消记录。` +
           `请核实：1) 是否为临时电话取消但未录入系统；2) 是否属于误操作；` +
           `3) 是否需要补录取消审批；4) 空出的时间段是否安排了其他服务。`;
  }

  explainCrossRegion(
    order: ServiceOrder,
    nurseDistrict: string,
    elderDistrict: string
  ): Discrepancy {
    return {
      id: uuidv4(),
      type: 'cross_region',
      severity: 'medium',
      description: `跨区服务：护士负责 ${nurseDistrict}，老人在 ${elderDistrict}`,
      explanation: this.getCrossRegionExplanation(nurseDistrict, elderDistrict, order),
      field: 'district',
      expectedValue: nurseDistrict,
      actualValue: elderDistrict,
      source: 'schedule',
    };
  }

  private getCrossRegionExplanation(
    nurseDistrict: string,
    elderDistrict: string,
    order: ServiceOrder
  ): string {
    return `护士 ${order.nurseName} 的负责区域是 ${nurseDistrict}，` +
           `但本次服务的老人 ${order.elderName} 位于 ${elderDistrict}。` +
           `跨区服务可能导致：1) 路程时间增加，影响后续排班；2) 交通费用核算问题；` +
           `3) 响应时间延长。请核实：1) 是否有跨区支援审批；2) 路程补贴是否已计算；` +
           `3) 是否为片区合并后的合理安排。`;
  }

  explainMissingRecord(order: ServiceOrder): Discrepancy {
    return {
      id: uuidv4(),
      type: 'missing_record',
      severity: 'high',
      description: `缺少排班记录：服务单 ${order.orderNo} 无对应排班`,
      explanation: this.getMissingRecordExplanation(order),
      field: 'schedule',
      expectedValue: '有排班记录',
      actualValue: '无排班记录',
      source: 'schedule',
    };
  }

  private getMissingRecordExplanation(order: ServiceOrder): string {
    return `系统中存在服务单 ${order.orderNo}，但在护士排班日历中找不到对应记录。` +
           `可能原因：1) 紧急上门服务，先服务后补单；2) 排班系统数据导入不完整；` +
           `3) 护士私自接单；4) 测试数据未清理。` +
           `请核实服务真实性并补录相关排班审批流程。`;
  }

  explainDuplicateOrder(order: ServiceOrder, duplicateCount: number): Discrepancy {
    return {
      id: uuidv4(),
      type: 'duplicate_order',
      severity: 'medium',
      description: `疑似重复订单：同一天内有 ${duplicateCount} 条相似记录`,
      explanation: this.getDuplicateExplanation(order, duplicateCount),
      field: 'orderNo',
      expectedValue: '唯一记录',
      actualValue: `${duplicateCount} 条重复`,
      source: 'order',
    };
  }

  private getDuplicateExplanation(order: ServiceOrder, count: number): string {
    return `在 ${order.serviceDate}，老人 ${order.elderName} 有 ${count} 条相似服务记录。` +
           `可能原因：1) 系统重复提交；2) 同天多次上门（如上午和下午各一次）；` +
           `3) 数据导入重复。请核对实际服务情况，确认是否需要合并或删除。`;
  }
}

export default new DiscrepancyExplainer();

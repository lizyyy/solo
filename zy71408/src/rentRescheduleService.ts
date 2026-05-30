import { v4 as uuidv4 } from 'uuid';
import {
  LeaseContract,
  RentPlan,
  RentPlanItem,
  PaymentFlow,
  Invoice,
  RescheduleRequest,
  RescheduleResult,
  AdjustmentRecord,
  CalculationDetail,
  InconsistencyRecord,
  EventTimelineItem,
  GracePeriod,
  Prepayment,
} from './types';

export class RentRescheduleService {
  private contracts: Map<string, LeaseContract> = new Map();
  private rentPlans: Map<string, RentPlan[]> = new Map();
  private paymentFlows: Map<string, PaymentFlow[]> = new Map();
  private invoices: Map<string, Invoice[]> = new Map();
  private gracePeriods: Map<string, GracePeriod[]> = new Map();
  private prepayments: Map<string, Prepayment[]> = new Map();
  private rescheduleResults: Map<string, RescheduleResult> = new Map();

  constructor() {
    this.initializeSampleData();
  }

  private initializeSampleData(): void {
    const contractId = 'contract_001';
    const contract: LeaseContract = {
      id: contractId,
      contractNo: 'FL-2024-001',
      customerName: 'ABC制造有限公司',
      startDate: '2024-01-01',
      endDate: '2026-12-31',
      totalAmount: 1000000,
      interestRate: 0.06,
      leaseTerm: 36,
      paymentFrequency: 'monthly',
      status: 'active',
      createdAt: '2024-01-01T00:00:00Z',
    };
    this.contracts.set(contractId, contract);

    const initialPlan = this.generateInitialRentPlan(contractId, contract);
    this.rentPlans.set(contractId, [initialPlan]);

    const samplePayments: PaymentFlow[] = [
      {
        id: 'pay_001',
        contractId,
        paymentDate: '2024-01-15',
        amount: 30421.94,
        paymentType: 'normal',
        matchedPeriods: ['1'],
        createdAt: '2024-01-15T10:00:00Z',
      },
      {
        id: 'pay_002',
        contractId,
        paymentDate: '2024-02-15',
        amount: 30421.94,
        paymentType: 'normal',
        matchedPeriods: ['2'],
        createdAt: '2024-02-15T10:00:00Z',
      },
      {
        id: 'pay_003',
        contractId,
        paymentDate: '2024-03-20',
        amount: 100000,
        paymentType: 'prepayment',
        remark: '客户提前还款',
        createdAt: '2024-03-20T14:30:00Z',
      },
    ];
    this.paymentFlows.set(contractId, samplePayments);

    const sampleInvoices: Invoice[] = [
      {
        id: 'inv_001',
        contractId,
        invoiceNo: 'INV-2024-0001',
        invoiceDate: '2024-01-05',
        amount: 26922.07,
        taxAmount: 3499.87,
        totalAmount: 30421.94,
        status: 'issued',
        periodNos: [1],
        createdAt: '2024-01-05T09:00:00Z',
      },
      {
        id: 'inv_002',
        contractId,
        invoiceNo: 'INV-2024-0002',
        invoiceDate: '2024-02-05',
        amount: 26922.07,
        taxAmount: 3499.87,
        totalAmount: 30421.94,
        status: 'issued',
        periodNos: [2],
        createdAt: '2024-02-05T09:00:00Z',
      },
    ];
    this.invoices.set(contractId, sampleInvoices);
  }

  private generateInitialRentPlan(contractId: string, contract: LeaseContract): RentPlan {
    const items: RentPlanItem[] = [];
    const monthlyRate = contract.interestRate / 12;
    const principal = contract.totalAmount / contract.leaseTerm;
    
    for (let i = 1; i <= contract.leaseTerm; i++) {
      const dueDate = new Date(contract.startDate);
      dueDate.setMonth(dueDate.getMonth() + i - 1);
      
      const remainingPrincipal = contract.totalAmount - principal * (i - 1);
      const interest = remainingPrincipal * monthlyRate;
      const totalAmount = principal + interest;

      items.push({
        id: `plan_item_${i}`,
        periodNo: i,
        dueDate: dueDate.toISOString().split('T')[0],
        principal: this.round(principal, 2),
        interest: this.round(interest, 2),
        totalAmount: this.round(totalAmount, 2),
        status: i <= 2 ? 'paid' : 'pending',
        paidAmount: i <= 2 ? this.round(totalAmount, 2) : undefined,
        paidDate: i <= 2 ? `2024-0${i}-15` : undefined,
      });
    }

    return {
      id: `plan_${contractId}_v1`,
      contractId,
      version: 1,
      items,
      createdAt: new Date().toISOString(),
      createdBy: 'system',
      isActive: true,
    };
  }

  private round(num: number, decimals: number): number {
    return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
  }

  getContract(contractId: string): LeaseContract | undefined {
    return this.contracts.get(contractId);
  }

  getActiveRentPlan(contractId: string): RentPlan | undefined {
    const plans = this.rentPlans.get(contractId);
    return plans?.find(p => p.isActive);
  }

  getPaymentFlows(contractId: string): PaymentFlow[] {
    return this.paymentFlows.get(contractId) || [];
  }

  getInvoices(contractId: string): Invoice[] {
    return this.invoices.get(contractId) || [];
  }

  processReschedule(request: RescheduleRequest): RescheduleResult {
    const contract = this.contracts.get(request.contractId);
    if (!contract) {
      throw new Error('Contract not found');
    }

    const activePlan = this.getActiveRentPlan(request.contractId);
    if (!activePlan) {
      throw new Error('Active rent plan not found');
    }

    const resultId = uuidv4();
    const calculationDetails: CalculationDetail[] = [];
    const adjustments: AdjustmentRecord[] = [];
    const inconsistencies: InconsistencyRecord[] = [];
    const eventTimeline: EventTimelineItem[] = [];
    let sequence = 1;

    let newPlanItems = JSON.parse(JSON.stringify(activePlan.items)) as RentPlanItem[];

    if (request.requestType === 'grace' || request.requestType === 'both') {
      const graceResult = this.applyGracePeriod(
        request.contractId,
        newPlanItems,
        request.gracePeriods || [],
        request.graceDays || 0,
        calculationDetails,
        adjustments,
        eventTimeline,
        sequence
      );
      newPlanItems = graceResult.items;
      sequence = graceResult.nextSequence;
    }

    if (request.requestType === 'prepayment' || request.requestType === 'both') {
      const prepayResult = this.applyPrepayment(
        request.contractId,
        newPlanItems,
        request.prepaymentAmount || 0,
        request.prepaymentDate || new Date().toISOString().split('T')[0],
        calculationDetails,
        adjustments,
        inconsistencies,
        eventTimeline,
        sequence
      );
      newPlanItems = prepayResult.items;
      sequence = prepayResult.nextSequence;
    }

    this.checkContractPlanInconsistency(contract, newPlanItems, inconsistencies);
    this.checkInvoiceDelay(request.contractId, newPlanItems, inconsistencies, eventTimeline, sequence++);

    const newPlan: RentPlan = {
      id: `plan_${request.contractId}_v${activePlan.version + 1}`,
      contractId: request.contractId,
      version: activePlan.version + 1,
      items: newPlanItems,
      createdAt: new Date().toISOString(),
      createdBy: request.requestedBy,
      isActive: false,
    };

    const result: RescheduleResult = {
      id: resultId,
      contractId: request.contractId,
      requestId: request.id || uuidv4(),
      status: 'processed',
      originalPlan: JSON.parse(JSON.stringify(activePlan)),
      newPlan,
      adjustments,
      calculationDetails,
      inconsistencies,
      eventTimeline,
      processedBy: request.requestedBy,
      processedAt: new Date().toISOString(),
    };

    this.rescheduleResults.set(resultId, result);

    return result;
  }

  private applyGracePeriod(
    contractId: string,
    planItems: RentPlanItem[],
    gracePeriods: number[],
    graceDays: number,
    calculationDetails: CalculationDetail[],
    adjustments: AdjustmentRecord[],
    eventTimeline: EventTimelineItem[],
    startSequence: number
  ): { items: RentPlanItem[]; nextSequence: number } {
    let sequence = startSequence;

    for (const periodNo of gracePeriods) {
      const item = planItems.find(p => p.periodNo === periodNo);
      if (!item) continue;

      const oldDueDate = item.dueDate;
      const newDate = new Date(oldDueDate);
      newDate.setDate(newDate.getDate() + graceDays);
      const newDueDate = newDate.toISOString().split('T')[0];

      calculationDetails.push({
        id: uuidv4(),
        step: `宽限期计算-第${periodNo}期`,
        description: `计算第${periodNo}期宽限${graceDays}天后的新到期日`,
        formula: '原到期日 + 宽限天数',
        inputs: { 原到期日: new Date(oldDueDate).getTime(), 宽限天数: graceDays },
        result: newDate.getTime(),
        timestamp: new Date().toISOString(),
      });

      adjustments.push({
        id: uuidv4(),
        type: 'grace',
        periodNo,
        field: 'dueDate',
        oldValue: oldDueDate,
        newValue: newDueDate,
        reason: '客户申请宽限期',
        timestamp: new Date().toISOString(),
      });

      eventTimeline.push({
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        eventType: 'grace_applied',
        description: `第${periodNo}期租金宽限${graceDays}天`,
        details: { periodNo, oldDueDate, newDueDate, graceDays },
        sequence: sequence++,
      });

      item.dueDate = newDueDate;
      item.status = 'adjusted';
    }

    return { items: planItems, nextSequence: sequence };
  }

  private applyPrepayment(
    contractId: string,
    planItems: RentPlanItem[],
    prepaymentAmount: number,
    prepaymentDate: string,
    calculationDetails: CalculationDetail[],
    adjustments: AdjustmentRecord[],
    inconsistencies: InconsistencyRecord[],
    eventTimeline: EventTimelineItem[],
    startSequence: number
  ): { items: RentPlanItem[]; nextSequence: number } {
    let sequence = startSequence;
    let remainingPrepayment = prepaymentAmount;
    const appliedPeriods: number[] = [];
    let principalOffset = 0;
    let interestOffset = 0;

    calculationDetails.push({
      id: uuidv4(),
      step: '提前还款总额确认',
      description: '确认提前还款总金额',
      formula: '客户提交金额',
      inputs: { 提交金额: prepaymentAmount },
      result: prepaymentAmount,
      timestamp: new Date().toISOString(),
    });

    for (const item of planItems) {
      if (remainingPrepayment <= 0) break;
      if (item.status === 'paid') continue;

      const itemDueDate = new Date(item.dueDate);
      const prepayDate = new Date(prepaymentDate);

      if (prepayDate <= itemDueDate) {
        const offsetAmount = Math.min(remainingPrepayment, item.totalAmount);
        const principalPortion = this.round((item.principal / item.totalAmount) * offsetAmount, 2);
        const interestPortion = this.round(offsetAmount - principalPortion, 2);

        calculationDetails.push({
          id: uuidv4(),
          step: `提前还款分配-第${item.periodNo}期`,
          description: `将提前还款分配到第${item.periodNo}期`,
          formula: '剩余提前还款金额 × (本期本金 / 本期总额)',
          inputs: {
            剩余提前还款: remainingPrepayment,
            本期本金: item.principal,
            本期总额: item.totalAmount,
          },
          result: offsetAmount,
          timestamp: new Date().toISOString(),
        });

        adjustments.push({
          id: uuidv4(),
          type: 'prepayment',
          periodNo: item.periodNo,
          field: 'principal',
          oldValue: item.principal,
          newValue: this.round(item.principal - principalPortion, 2),
          reason: '提前还款抵扣本金',
          timestamp: new Date().toISOString(),
        });

        adjustments.push({
          id: uuidv4(),
          type: 'prepayment',
          periodNo: item.periodNo,
          field: 'interest',
          oldValue: item.interest,
          newValue: this.round(item.interest - interestPortion, 2),
          reason: '提前还款抵扣利息',
          timestamp: new Date().toISOString(),
        });

        item.principal = this.round(item.principal - principalPortion, 2);
        item.interest = this.round(item.interest - interestPortion, 2);
        item.totalAmount = this.round(item.principal + item.interest, 2);
        item.status = item.totalAmount <= 0 ? 'paid' : 'adjusted';

        principalOffset += principalPortion;
        interestOffset += interestPortion;
        remainingPrepayment = this.round(remainingPrepayment - offsetAmount, 2);
        appliedPeriods.push(item.periodNo);
      }
    }

    if (remainingPrepayment > 0) {
      inconsistencies.push({
        id: uuidv4(),
        type: 'prepayment_missing_offset',
        severity: 'medium',
        description: `提前还款尚有 ${remainingPrepayment.toFixed(2)} 元未完全抵扣，请检查是否有逾期或其他情况`,
        evidence: [
          {
            source: '提前还款记录',
            data: { prepaymentAmount, appliedPeriods, principalOffset, interestOffset },
          },
          {
            source: '还款流水',
            data: this.getPaymentFlows(contractId).filter(p => p.paymentType === 'prepayment'),
          },
        ],
        resolved: false,
      });
    }

    eventTimeline.push({
      id: uuidv4(),
      timestamp: prepaymentDate + 'T00:00:00Z',
      eventType: 'prepayment_applied',
      description: `提前还款 ${prepaymentAmount.toFixed(2)} 元`,
      details: {
        prepaymentAmount,
        principalOffset,
        interestOffset,
        appliedPeriods,
        remainingAmount: remainingPrepayment,
      },
      sequence: sequence++,
    });

    const prepayment: Prepayment = {
      id: uuidv4(),
      contractId,
      prepaymentDate,
      amount: prepaymentAmount,
      principalOffset,
      interestOffset,
      penaltyOffset: 0,
      appliedPeriods,
      status: remainingPrepayment > 0 ? 'partially_applied' : 'applied',
    };

    if (!this.prepayments.has(contractId)) {
      this.prepayments.set(contractId, []);
    }
    this.prepayments.get(contractId)!.push(prepayment);

    return { items: planItems, nextSequence: sequence };
  }

  private checkContractPlanInconsistency(
    contract: LeaseContract,
    planItems: RentPlanItem[],
    inconsistencies: InconsistencyRecord[]
  ): void {
    const totalPrincipal = planItems.reduce((sum, item) => sum + item.principal, 0);
    const diff = Math.abs(totalPrincipal - contract.totalAmount);

    if (diff > 0.01) {
      inconsistencies.push({
        id: uuidv4(),
        type: 'contract_plan_mismatch',
        severity: 'high',
        description: `合同总金额 ${contract.totalAmount.toFixed(2)} 与租金计划本金合计 ${totalPrincipal.toFixed(2)} 不一致，差额 ${diff.toFixed(2)} 元`,
        evidence: [
          { source: '租赁合同', data: { totalAmount: contract.totalAmount } },
          { source: '租金计划', data: { totalPrincipal, items: planItems.map(i => ({ periodNo: i.periodNo, principal: i.principal })) } },
          { source: '还款流水', data: this.getPaymentFlows(contract.id) },
        ],
        resolved: false,
      });
    }
  }

  private checkInvoiceDelay(
    contractId: string,
    planItems: RentPlanItem[],
    inconsistencies: InconsistencyRecord[],
    eventTimeline: EventTimelineItem[],
    sequence: number
  ): void {
    const invoices = this.getInvoices(contractId);

    for (const invoice of invoices) {
      if (invoice.periodNos) {
        for (const periodNo of invoice.periodNos) {
          const planItem = planItems.find(p => p.periodNo === periodNo);
          if (planItem) {
            const invoiceDate = new Date(invoice.invoiceDate);
            const dueDate = new Date(planItem.dueDate);

            if (invoiceDate > dueDate) {
              const delayDays = Math.ceil((invoiceDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

              inconsistencies.push({
                id: uuidv4(),
                type: 'invoice_delay',
                severity: 'low',
                description: `第${periodNo}期发票开具日期晚于租金到期日 ${delayDays} 天`,
                evidence: [
                  { source: '租金计划', data: { periodNo, dueDate: planItem.dueDate } },
                  { source: '发票信息', data: { invoiceNo: invoice.invoiceNo, invoiceDate: invoice.invoiceDate } },
                ],
                resolved: false,
              });

              eventTimeline.push({
                id: uuidv4(),
                timestamp: invoice.invoiceDate + 'T00:00:00Z',
                eventType: 'invoice_issued',
                description: `发票 ${invoice.invoiceNo} 开具（晚于计划到期日）`,
                details: { invoiceNo: invoice.invoiceNo, periodNo, delayDays },
                sequence: sequence++,
              });
            }
          }
        }
      }
    }
  }

  reviewReschedule(resultId: string, reviewedBy: string, comments: string, approved: boolean): RescheduleResult {
    const result = this.rescheduleResults.get(resultId);
    if (!result) {
      throw new Error('Reschedule result not found');
    }

    result.status = approved ? 'reviewed' : 'rejected';
    result.reviewedBy = reviewedBy;
    result.reviewedAt = new Date().toISOString();
    result.reviewComments = comments;

    if (approved) {
      const plans = this.rentPlans.get(result.contractId) || [];
      plans.forEach(p => p.isActive = false);
      result.newPlan.isActive = true;
      plans.push(result.newPlan);
      this.rentPlans.set(result.contractId, plans);
    }

    return result;
  }

  getRescheduleResult(resultId: string): RescheduleResult | undefined {
    return this.rescheduleResults.get(resultId);
  }

  getAllRescheduleResults(contractId?: string): RescheduleResult[] {
    const results = Array.from(this.rescheduleResults.values());
    if (contractId) {
      return results.filter(r => r.contractId === contractId);
    }
    return results;
  }

  exportRescheduleData(resultId: string, exportedBy: string): {
    success: boolean;
    data: any;
    filename: string;
  } {
    const result = this.rescheduleResults.get(resultId);
    if (!result) {
      throw new Error('Reschedule result not found');
    }

    const contract = this.contracts.get(result.contractId);
    if (!contract) {
      throw new Error('Contract not found');
    }

    const exportData = {
      contract,
      rescheduleResult: result,
      paymentFlows: this.getPaymentFlows(result.contractId),
      invoices: this.getInvoices(result.contractId),
      exportedAt: new Date().toISOString(),
      exportedBy,
    };

    return {
      success: true,
      data: exportData,
      filename: `rent_reschedule_${result.contractId}_${new Date().toISOString().split('T')[0]}.json`,
    };
  }

  getAllContracts(): LeaseContract[] {
    return Array.from(this.contracts.values());
  }
}

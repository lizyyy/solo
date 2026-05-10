import { v4 as uuidv4 } from 'uuid';
import { LeadModel } from '../models/Lead';
import { SalesPersonModel } from '../models/SalesPerson';
import { AssignmentRuleModel } from '../models/AssignmentRule';
import { 
  ILead, 
  ISalesPerson, 
  IAssignmentRule, 
  IAssignmentResult,
  AssignmentReason,
  LeadStatus,
  IAssignmentRecord
} from '../types';

export class AssignmentService {
  static async findEligibleSalesPerson(lead: ILead): Promise<IAssignmentResult> {
    const activeSales = await SalesPersonModel.find({
      isOnVacation: false
    }).lean() as ISalesPerson[];

    if (activeSales.length === 0) {
      return {
        leadId: lead.id,
        salesPerson: null,
        reason: AssignmentReason.VACATION,
        details: '所有销售人员都在休假中',
        success: false
      };
    }

    if (!lead.region) {
      return {
        leadId: lead.id,
        salesPerson: null,
        reason: AssignmentReason.UNKNOWN_REGION,
        details: '线索地区未知，需要人工复核',
        success: false
      };
    }

    const rules = await AssignmentRuleModel.find({ enabled: true })
      .sort({ priority: -1 })
      .lean() as IAssignmentRule[];

    const ruleMatch = this.matchRule(lead, rules, activeSales);
    if (ruleMatch.success && ruleMatch.salesPerson) {
      return ruleMatch;
    }

    const regionMatch = this.findByRegion(lead, activeSales);
    if (regionMatch.success && regionMatch.salesPerson) {
      return regionMatch;
    }

    const productMatch = this.findByProductExpertise(lead, activeSales);
    if (productMatch.success && productMatch.salesPerson) {
      return productMatch;
    }

    const loadBalance = this.findByLoadBalance(activeSales);
    if (loadBalance.success && loadBalance.salesPerson) {
      return loadBalance;
    }

    return {
      leadId: lead.id,
      salesPerson: null,
      reason: AssignmentReason.FALLBACK,
      details: '未找到合适的销售人员，需要人工分配',
      success: false
    };
  }

  private static matchRule(
    lead: ILead, 
    rules: IAssignmentRule[], 
    sales: ISalesPerson[]
  ): IAssignmentResult {
    for (const rule of rules) {
      if (this.isRuleMatch(lead, rule)) {
        if (rule.actions.needsReview) {
          return {
            leadId: lead.id,
            salesPerson: null,
            reason: AssignmentReason.UNKNOWN_REGION,
            details: `匹配规则"${rule.name}"，需要人工复核`,
            success: false
          };
        }

        if (rule.actions.assignTo && rule.actions.assignTo.length > 0) {
          const eligibleSales = sales.filter(s => 
            rule.actions.assignTo!.includes(s.id) &&
            s.currentLoad < s.maxLoad
          );

          if (eligibleSales.length > 0) {
            const selected = this.findByLoadBalance(eligibleSales).salesPerson;
            if (selected) {
              return {
                leadId: lead.id,
                salesPerson: selected,
                reason: AssignmentReason.CUSTOMER_LEVEL,
                details: `匹配规则"${rule.name}"，分配给指定销售人员`,
                success: true
              };
            }
          } else {
            const allAssigned = sales.filter(s => 
              rule.actions.assignTo!.includes(s.id)
            );
            if (allAssigned.length > 0) {
              return {
                leadId: lead.id,
                salesPerson: null,
                reason: AssignmentReason.OVERLOAD,
                details: `规则"${rule.name}"指定的销售人员全部超负载`,
                success: false
              };
            }
          }
        }
      }
    }

    return {
      leadId: lead.id,
      salesPerson: null,
      reason: AssignmentReason.FALLBACK,
      details: '未匹配到任何规则',
      success: false
    };
  }

  private static isRuleMatch(lead: ILead, rule: IAssignmentRule): boolean {
    const conditions = rule.conditions;
    
    if (conditions.regions && conditions.regions.length > 0) {
      if (!lead.region || !conditions.regions.includes(lead.region)) {
        return false;
      }
    }

    if (conditions.products && conditions.products.length > 0) {
      const hasMatchingProduct = lead.productInterest.some(p => 
        conditions.products!.includes(p)
      );
      if (!hasMatchingProduct) {
        return false;
      }
    }

    if (conditions.customerLevels && conditions.customerLevels.length > 0) {
      if (!conditions.customerLevels.includes(lead.customerLevel)) {
        return false;
      }
    }

    return true;
  }

  private static findByRegion(
    lead: ILead, 
    sales: ISalesPerson[]
  ): IAssignmentResult {
    const eligibleSales = sales.filter(s => 
      s.regions.includes(lead.region!) &&
      s.currentLoad < s.maxLoad
    );

    if (eligibleSales.length === 0) {
      const allRegionSales = sales.filter(s => s.regions.includes(lead.region!));
      if (allRegionSales.length > 0) {
        return {
          leadId: lead.id,
          salesPerson: null,
          reason: AssignmentReason.OVERLOAD,
          details: `负责"${lead.region}"地区的销售人员全部超负载`,
          success: false
        };
      }
      return {
        leadId: lead.id,
        salesPerson: null,
        reason: AssignmentReason.FALLBACK,
        details: `没有找到负责"${lead.region}"地区的销售人员`,
        success: false
      };
    }

    const selected = this.findByLoadBalance(eligibleSales).salesPerson!;
    
    let details = `地区匹配：线索来自"${lead.region}"，该销售负责此地区`;
    
    const productMatch = lead.productInterest.some(p => 
      selected.productExpertise.includes(p)
    );
    if (productMatch) {
      details += '，同时产品兴趣匹配';
    }

    return {
      leadId: lead.id,
      salesPerson: selected,
      reason: AssignmentReason.REGION_MATCH,
      details,
      success: true
    };
  }

  private static findByProductExpertise(
    lead: ILead, 
    sales: ISalesPerson[]
  ): IAssignmentResult {
    if (lead.productInterest.length === 0) {
      return {
        leadId: lead.id,
        salesPerson: null,
        reason: AssignmentReason.FALLBACK,
        details: '线索没有产品兴趣信息',
        success: false
      };
    }

    const eligibleSales = sales.filter(s => {
      const hasExpertise = lead.productInterest.some(p => 
        s.productExpertise.includes(p)
      );
      return hasExpertise && s.currentLoad < s.maxLoad;
    });

    if (eligibleSales.length === 0) {
      return {
        leadId: lead.id,
        salesPerson: null,
        reason: AssignmentReason.FALLBACK,
        details: '未找到具有相关产品专长且未超负载的销售人员',
        success: false
      };
    }

    const selected = this.findByLoadBalance(eligibleSales).salesPerson!;
    const matchingProducts = lead.productInterest.filter(p => 
      selected.productExpertise.includes(p)
    );

    return {
      leadId: lead.id,
      salesPerson: selected,
      reason: AssignmentReason.PRODUCT_MATCH,
      details: `产品兴趣匹配：线索对"${matchingProducts.join('、')}"感兴趣，该销售擅长这些产品`,
      success: true
    };
  }

  private static findByLoadBalance(
    sales: ISalesPerson[]
  ): IAssignmentResult {
    if (sales.length === 0) {
      return {
        leadId: '',
        salesPerson: null,
        reason: AssignmentReason.FALLBACK,
        details: '没有可用的销售人员',
        success: false
      };
    }

    const sorted = [...sales].sort((a, b) => a.currentLoad - b.currentLoad);
    const selected = sorted[0];

    return {
      leadId: '',
      salesPerson: selected,
      reason: AssignmentReason.LOAD_BALANCE,
      details: `负载均衡：该销售当前负载(${selected.currentLoad}/${selected.maxLoad})最低`,
      success: true
    };
  }

  static async assignLead(lead: ILead, result: IAssignmentResult): Promise<ILead> {
    if (!result.success || !result.salesPerson) {
      return lead;
    }

    const salesPerson = result.salesPerson;
    const assignmentRecord: IAssignmentRecord = {
      id: uuidv4(),
      salesId: salesPerson.id,
      salesName: salesPerson.name,
      reason: result.reason,
      details: result.details,
      timestamp: new Date(),
      isReassignment: false
    };

    await SalesPersonModel.updateOne(
      { id: salesPerson.id },
      { 
        $inc: { 
          currentLoad: 1,
          'stats.total': 1,
          'stats.pending': 1
        }
      }
    );

    const updatedLead = await LeadModel.findOneAndUpdate(
      { id: lead.id },
      {
        $set: {
          assignedTo: salesPerson.id,
          status: LeadStatus.ASSIGNED,
          assignmentReason: result.reason,
          assignmentDetails: result.details
        },
        $push: { assignmentHistory: assignmentRecord }
      },
      { new: true }
    ).lean() as ILead;

    return updatedLead;
  }

  static async reassignLead(
    lead: ILead, 
    newSalesPerson: ISalesPerson, 
    reason: string
  ): Promise<ILead> {
    const previousSalesId = lead.assignedTo;

    if (previousSalesId) {
      await SalesPersonModel.updateOne(
        { id: previousSalesId },
        { 
          $inc: { 
            currentLoad: -1,
            'stats.pending': -1
          }
        }
      );
    }

    const assignmentRecord: IAssignmentRecord = {
      id: uuidv4(),
      salesId: newSalesPerson.id,
      salesName: newSalesPerson.name,
      reason: AssignmentReason.LOAD_BALANCE,
      details: `重新分配：${reason}`,
      timestamp: new Date(),
      isReassignment: true,
      previousSalesId
    };

    await SalesPersonModel.updateOne(
      { id: newSalesPerson.id },
      { 
        $inc: { 
          currentLoad: 1,
          'stats.total': 1,
          'stats.pending': 1
        }
      }
    );

    const updatedLead = await LeadModel.findOneAndUpdate(
      { id: lead.id },
      {
        $set: {
          assignedTo: newSalesPerson.id,
          status: LeadStatus.ASSIGNED,
          assignmentReason: AssignmentReason.LOAD_BALANCE,
          assignmentDetails: `重新分配：${reason}`
        },
        $push: { assignmentHistory: assignmentRecord }
      },
      { new: true }
    ).lean() as ILead;

    return updatedLead;
  }

  static async updateSalesStats(salesId: string, statusChange: string): Promise<void> {
    const update: any = {};
    
    if (statusChange === 'to_following') {
      update.$inc = { 'stats.pending': -1, 'stats.following': 1 };
    } else if (statusChange === 'to_converted') {
      update.$inc = { 'stats.following': -1, 'stats.converted': 1, currentLoad: -1 };
    } else if (statusChange === 'to_rejected') {
      update.$inc = { 'stats.following': -1, 'stats.rejected': 1, currentLoad: -1 };
    } else if (statusChange === 'pending_to_rejected') {
      update.$inc = { 'stats.pending': -1, 'stats.rejected': 1, currentLoad: -1 };
    }

    if (Object.keys(update).length > 0) {
      await SalesPersonModel.updateOne({ id: salesId }, update);
    }
  }
}

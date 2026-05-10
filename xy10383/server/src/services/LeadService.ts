import { v4 as uuidv4 } from 'uuid';
import { LeadModel } from '../models/Lead';
import { SalesPersonModel } from '../models/SalesPerson';
import { FollowUpRecordModel } from '../models/FollowUpRecord';
import { AssignmentService } from './AssignmentService';
import { DuplicateDetectionService } from './DuplicateDetectionService';
import { 
  ILead, 
  ISalesPerson, 
  IFollowUpRecord,
  LeadStatus,
  AssignmentReason,
  CustomerLevel
} from '../types';

export class LeadService {
  static async createLeads(leadsData: Partial<ILead>[]): Promise<{
    created: ILead[];
    duplicates: { lead: Partial<ILead>; existingLead: ILead; reason: string }[];
    needsReview: ILead[];
  }> {
    const created: ILead[] = [];
    const duplicates: { lead: Partial<ILead>; existingLead: ILead; reason: string }[] = [];
    const needsReview: ILead[] = [];

    for (const leadData of leadsData) {
      const leadId = leadData.id || uuidv4();
      
      const existingLead = await DuplicateDetectionService.findDuplicate({
        ...leadData,
        id: leadId
      });

      if (existingLead) {
        duplicates.push({
          lead: { ...leadData, id: leadId },
          existingLead,
          reason: DuplicateDetectionService.getDuplicateReason(leadData, existingLead)
        });
        continue;
      }

      const newLead: Partial<ILead> = {
        id: leadId,
        name: leadData.name,
        phone: leadData.phone,
        email: leadData.email,
        company: leadData.company,
        position: leadData.position,
        region: leadData.region,
        productInterest: leadData.productInterest || [],
        customerLevel: leadData.customerLevel || CustomerLevel.MEDIUM,
        source: leadData.source || '线上展会',
        status: LeadStatus.PENDING,
        isDuplicate: false,
        assignmentHistory: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const createdLead = await LeadModel.create(newLead);
      const leadDoc = createdLead.toObject() as ILead;

      const assignmentResult = await AssignmentService.findEligibleSalesPerson(leadDoc);
      
      if (assignmentResult.success && assignmentResult.salesPerson) {
        const assignedLead = await AssignmentService.assignLead(leadDoc, assignmentResult);
        created.push(assignedLead);
      } else if (assignmentResult.reason === AssignmentReason.UNKNOWN_REGION ||
                 assignmentResult.reason === AssignmentReason.OVERLOAD) {
        await LeadModel.findOneAndUpdate(
          { id: leadDoc.id },
          {
            $set: {
              status: LeadStatus.NEEDS_REVIEW,
              assignmentReason: assignmentResult.reason,
              assignmentDetails: assignmentResult.details
            }
          }
        );
        const updatedLead = await LeadModel.findOne({ id: leadDoc.id }).lean() as ILead;
        needsReview.push(updatedLead);
      } else {
        created.push(leadDoc);
      }
    }

    return { created, duplicates, needsReview };
  }

  static async getLeads(filters?: any): Promise<ILead[]> {
    const query: any = {};
    
    if (filters?.status) {
      query.status = filters.status;
    }
    if (filters?.region) {
      query.region = filters.region;
    }
    if (filters?.assignedTo) {
      query.assignedTo = filters.assignedTo;
    }
    if (filters?.customerLevel) {
      query.customerLevel = filters.customerLevel;
    }
    if (filters?.isDuplicate !== undefined) {
      query.isDuplicate = filters.isDuplicate;
    }
    if (filters?.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { phone: { $regex: filters.search, $options: 'i' } },
        { email: { $regex: filters.search, $options: 'i' } },
        { company: { $regex: filters.search, $options: 'i' } }
      ];
    }

    const leads = await LeadModel.find(query)
      .sort({ createdAt: -1 })
      .lean();
    
    return leads as ILead[];
  }

  static async getLeadById(id: string): Promise<ILead | null> {
    const lead = await LeadModel.findOne({ id }).lean();
    return lead as ILead | null;
  }

  static async updateLeadStatus(
    leadId: string, 
    newStatus: LeadStatus,
    followUpNotes?: string
  ): Promise<ILead | null> {
    const lead = await LeadModel.findOne({ id: leadId }).lean() as ILead | null;
    if (!lead) return null;

    const oldStatus = lead.status;
    let statusChange = '';

    if (oldStatus === LeadStatus.PENDING && newStatus === LeadStatus.FOLLOWING) {
      statusChange = 'to_following';
    } else if (oldStatus === LeadStatus.ASSIGNED && newStatus === LeadStatus.FOLLOWING) {
      statusChange = 'to_following';
    } else if (oldStatus === LeadStatus.FOLLOWING && newStatus === LeadStatus.CONVERTED) {
      statusChange = 'to_converted';
    } else if (oldStatus === LeadStatus.FOLLOWING && newStatus === LeadStatus.REJECTED) {
      statusChange = 'to_rejected';
    } else if ((oldStatus === LeadStatus.PENDING || oldStatus === LeadStatus.ASSIGNED) && 
               newStatus === LeadStatus.REJECTED) {
      statusChange = 'pending_to_rejected';
    }

    if (lead.assignedTo && statusChange) {
      await AssignmentService.updateSalesStats(lead.assignedTo, statusChange);
    }

    const update: any = {
      status: newStatus,
      updatedAt: new Date()
    };

    if (newStatus === LeadStatus.CONVERTED) {
      update.conversionDate = new Date();
    }

    const updatedLead = await LeadModel.findOneAndUpdate(
      { id: leadId },
      { $set: update },
      { new: true }
    ).lean() as ILead;

    if (followUpNotes && lead.assignedTo) {
      const salesPerson = await SalesPersonModel.findOne({ id: lead.assignedTo }).lean() as ISalesPerson;
      await FollowUpRecordModel.create({
        id: uuidv4(),
        leadId: lead.id,
        salesId: lead.assignedTo,
        salesName: salesPerson?.name || '未知',
        status: newStatus,
        notes: followUpNotes,
        followUpDate: new Date()
      });
    }

    return updatedLead;
  }

  static async addFollowUpRecord(
    leadId: string,
    salesId: string,
    status: string,
    notes: string,
    nextFollowUpDate?: Date
  ): Promise<IFollowUpRecord> {
    const salesPerson = await SalesPersonModel.findOne({ id: salesId }).lean() as ISalesPerson;
    
    const record = await FollowUpRecordModel.create({
      id: uuidv4(),
      leadId,
      salesId,
      salesName: salesPerson?.name || '未知',
      status,
      notes,
      followUpDate: new Date(),
      nextFollowUpDate
    });

    return record.toObject() as IFollowUpRecord;
  }

  static async getFollowUpRecords(leadId: string): Promise<IFollowUpRecord[]> {
    const records = await FollowUpRecordModel.find({ leadId })
      .sort({ followUpDate: -1 })
      .lean();
    return records as IFollowUpRecord[];
  }

  static async mergeDuplicateLeads(
    duplicateLeadId: string,
    targetLeadId: string
  ): Promise<ILead | null> {
    const duplicateLead = await LeadModel.findOne({ id: duplicateLeadId }).lean() as ILead | null;
    const targetLead = await LeadModel.findOne({ id: targetLeadId }).lean() as ILead | null;

    if (!duplicateLead || !targetLead) return null;

    await LeadModel.findOneAndUpdate(
      { id: duplicateLeadId },
      {
        $set: {
          isDuplicate: true,
          duplicateOf: targetLeadId
        }
      }
    );

    return await LeadModel.findOne({ id: targetLeadId }).lean() as ILead;
  }

  static async manuallyAssignLead(
    leadId: string,
    salesId: string
  ): Promise<ILead | null> {
    const lead = await LeadModel.findOne({ id: leadId }).lean() as ILead | null;
    const salesPerson = await SalesPersonModel.findOne({ id: salesId }).lean() as ISalesPerson | null;

    if (!lead || !salesPerson) return null;

    if (lead.assignedTo) {
      return await AssignmentService.reassignLead(
        lead,
        salesPerson,
        '手动重新分配'
      );
    }

    return await AssignmentService.assignLead(lead, {
      leadId: lead.id,
      salesPerson,
      reason: AssignmentReason.FALLBACK,
      details: '手动分配',
      success: true
    });
  }

  static async getDashboardStats(): Promise<any> {
    const totalLeads = await LeadModel.countDocuments();
    const pendingLeads = await LeadModel.countDocuments({ status: LeadStatus.PENDING });
    const assignedLeads = await LeadModel.countDocuments({ status: LeadStatus.ASSIGNED });
    const followingLeads = await LeadModel.countDocuments({ status: LeadStatus.FOLLOWING });
    const convertedLeads = await LeadModel.countDocuments({ status: LeadStatus.CONVERTED });
    const rejectedLeads = await LeadModel.countDocuments({ status: LeadStatus.REJECTED });
    const needsReviewLeads = await LeadModel.countDocuments({ status: LeadStatus.NEEDS_REVIEW });
    const duplicateLeads = await LeadModel.countDocuments({ isDuplicate: true });

    const salesStats = await SalesPersonModel.find().lean();

    return {
      totalLeads,
      pendingLeads,
      assignedLeads,
      followingLeads,
      convertedLeads,
      rejectedLeads,
      needsReviewLeads,
      duplicateLeads,
      conversionRate: totalLeads > 0 ? (convertedLeads / totalLeads * 100).toFixed(2) : 0,
      salesStats: salesStats.map(s => ({
        ...s,
        loadPercentage: s.maxLoad > 0 ? (s.currentLoad / s.maxLoad * 100).toFixed(1) : 0
      }))
    };
  }
}

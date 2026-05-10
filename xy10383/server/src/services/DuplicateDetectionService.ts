import { LeadModel } from '../models/Lead';
import { ILead } from '../types';

export class DuplicateDetectionService {
  static async findDuplicate(lead: Partial<ILead>): Promise<ILead | null> {
    if (!lead.phone && !lead.email) {
      return null;
    }

    const conditions: any[] = [];
    
    if (lead.phone) {
      conditions.push({ 
        phone: lead.phone,
        isDuplicate: false 
      });
    }
    
    if (lead.email) {
      conditions.push({ 
        email: lead.email,
        isDuplicate: false 
      });
    }

    const existingLead = await LeadModel.findOne({
      $or: conditions,
      id: { $ne: lead.id }
    }).lean();

    return existingLead as ILead | null;
  }

  static async checkMultipleDuplicates(leads: Partial<ILead>[]): Promise<Map<string, ILead | null>> {
    const results = new Map<string, ILead | null>();
    
    const phoneToLead = new Map<string, ILead>();
    const emailToLead = new Map<string, ILead>();

    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];
      let duplicate: ILead | null = null;

      if (lead.phone && phoneToLead.has(lead.phone)) {
        duplicate = phoneToLead.get(lead.phone)!;
      } else if (lead.email && emailToLead.has(lead.email)) {
        duplicate = emailToLead.get(lead.email)!;
      } else {
        const existingLead = await this.findDuplicate(lead);
        if (existingLead) {
          duplicate = existingLead;
        }
      }

      if (!duplicate) {
        if (lead.phone) {
          phoneToLead.set(lead.phone, lead as ILead);
        }
        if (lead.email) {
          emailToLead.set(lead.email, lead as ILead);
        }
      }

      results.set(lead.id || `lead_${i}`, duplicate);
    }

    return results;
  }

  static getDuplicateReason(lead: Partial<ILead>, existingLead: ILead): string {
    const reasons: string[] = [];
    
    if (lead.phone && lead.phone === existingLead.phone) {
      reasons.push('手机号重复');
    }
    
    if (lead.email && lead.email === existingLead.email) {
      reasons.push('邮箱重复');
    }

    return reasons.join('、');
  }
}

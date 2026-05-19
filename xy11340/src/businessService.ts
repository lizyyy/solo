import { WarehouseDB } from './database';
import { ClaimRecord } from './types';

export class BusinessService {
  private db: WarehouseDB;

  constructor(db: WarehouseDB) {
    this.db = db;
  }

  generateClaimNo(): string {
    return `CLM_${Date.now()}_${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
  }

  async processClaims(): Promise<{ total: number; created: number; skipped: number }> {
    const repairOrders = await this.db.getAllRepairOrders();
    let createdCount = 0;
    let skippedCount = 0;
    const existingClaims = new Set((await this.db.getAllClaims()).map(c => `${c.repairNo}-${c.partCode}`));

    for (const repair of repairOrders) {
      for (const partUsed of repair.partsUsed) {
        const claimKey = `${repair.repairNo}-${partUsed.partCode}`;
        
        if (existingClaims.has(claimKey)) {
          skippedCount++;
          continue;
        }

        const rule = await this.db.getClaimRule(partUsed.partCode, repair.faultType);
        
        if (!rule) {
          skippedCount++;
          continue;
        }

        if (rule.requiresOldPart) {
          const oldPartReturned = repair.oldPartsReturned.find(
            p => p.partCode === partUsed.partCode && p.condition !== 'damaged'
          );
          if (!oldPartReturned) {
            skippedCount++;
            continue;
          }
        }

        const claimRecord: Omit<ClaimRecord, 'id' | 'createdAt'> = {
          claimNo: this.generateClaimNo(),
          repairNo: repair.repairNo,
          workOrderNo: repair.workOrderNo,
          ruleCode: rule.ruleCode,
          partCode: partUsed.partCode,
          claimAmount: rule.claimAmount,
          status: 'pending'
        };

        await this.db.insertClaimRecord(claimRecord);
        createdCount++;
      }
    }

    return {
      total: repairOrders.length,
      created: createdCount,
      skipped: skippedCount
    };
  }

  async reviewClaim(claimId: number, action: 'approve' | 'reject', reviewer: string, reason?: string): Promise<boolean> {
    const claims = await this.db.getAllClaims();
    const claim = claims.find(c => c.id === claimId);
    
    if (!claim) {
      return false;
    }

    if (claim.status !== 'pending') {
      return false;
    }

    const status = action === 'approve' ? 'approved' : 'rejected';
    await this.db.updateClaimStatus(claimId, status, reviewer, reason);
    await this.db.insertReviewRecord({
      claimId,
      claimNo: claim.claimNo,
      reviewer,
      action,
      reason
    });

    return true;
  }

  async reviewAllPending(action: 'approve' | 'reject', reviewer: string): Promise<{ total: number; processed: number }> {
    const pendingClaims = await this.db.getPendingClaims();
    let processed = 0;

    for (const claim of pendingClaims) {
      if (claim.id && await this.reviewClaim(claim.id, action, reviewer, '批量处理')) {
        processed++;
      }
    }

    return {
      total: pendingClaims.length,
      processed
    };
  }

  async getClaimSummary(): Promise<{
    pending: number;
    approved: number;
    rejected: number;
    totalAmount: number;
    approvedAmount: number;
  }> {
    const claims = await this.db.getAllClaims();
    
    return {
      pending: claims.filter(c => c.status === 'pending').length,
      approved: claims.filter(c => c.status === 'approved').length,
      rejected: claims.filter(c => c.status === 'rejected').length,
      totalAmount: claims.reduce((sum, c) => sum + c.claimAmount, 0),
      approvedAmount: claims.filter(c => c.status === 'approved').reduce((sum, c) => sum + c.claimAmount, 0)
    };
  }

  async getUnmatchedRepairs(): Promise<Array<{
    repairNo: string;
    workOrderNo: string;
    faultType: string;
    parts: Array<{ partCode: string; partName: string; reason: string }>;
  }>> {
    const repairOrders = await this.db.getAllRepairOrders();
    const rules = await this.db.getAllClaimRules();
    const unmatched: any[] = [];

    for (const repair of repairOrders) {
      const unmatchedParts: any[] = [];
      
      for (const partUsed of repair.partsUsed) {
        const rule = rules.find(r => r.partCode === partUsed.partCode && r.faultType === repair.faultType);
        
        if (!rule) {
          unmatchedParts.push({
            partCode: partUsed.partCode,
            partName: partUsed.partName,
            reason: '未找到匹配的索赔规则'
          });
        } else if (rule.requiresOldPart) {
          const oldPartReturned = repair.oldPartsReturned.find(
            p => p.partCode === partUsed.partCode && p.condition !== 'damaged'
          );
          if (!oldPartReturned) {
            unmatchedParts.push({
              partCode: partUsed.partCode,
              partName: partUsed.partName,
              reason: '需要返还旧件但未收到或旧件损坏'
            });
          }
        }
      }

      if (unmatchedParts.length > 0) {
        unmatched.push({
          repairNo: repair.repairNo,
          workOrderNo: repair.workOrderNo,
          faultType: repair.faultType,
          parts: unmatchedParts
        });
      }
    }

    return unmatched;
  }
}

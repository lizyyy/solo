import { get, run, all } from '../database';
import { subDays, differenceInDays } from 'date-fns';

export class DistributionService {
  static async checkDuplicateDistribution(familyId: number, batchId: number): Promise<{ duplicate: boolean; message?: string; needReview?: boolean }> {
    const batch = await get('SELECT * FROM batches WHERE id = ?', [batchId]);
    if (!batch) return { duplicate: false };

    const existingDistributions = await all(`
      SELECT * FROM distributions 
      WHERE familyId = ? AND batchId = ? AND status IN ('distributed', 'pending')
    `, [familyId, batchId]);

    if (existingDistributions.length > 0) {
      return {
        duplicate: true,
        message: `该家庭已在本批次中领取过物资，不能重复领取`
      };
    }

    const recentDistribution = await get(`
      SELECT d.*, b.cycleDays, b.endTime 
      FROM distributions d
      JOIN batches b ON d.batchId = b.id
      WHERE d.familyId = ? 
        AND d.status = 'distributed'
        AND b.materialId = (SELECT materialId FROM batches WHERE id = ?)
      ORDER BY d.distributeTime DESC
      LIMIT 1
    `, [familyId, batchId]) as any;

    if (recentDistribution) {
      const daysSinceLastDistribution = differenceInDays(
        new Date(),
        new Date(recentDistribution.distributeTime)
      );
      
      if (daysSinceLastDistribution < recentDistribution.cycleDays) {
        const daysRemaining = recentDistribution.cycleDays - daysSinceLastDistribution;
        return {
          duplicate: true,
          message: `该家庭距离上一次领取仅${daysSinceLastDistribution}天，未满${recentDistribution.cycleDays}天周期，还需等待${daysRemaining}天`
        };
      }

      if (daysSinceLastDistribution >= recentDistribution.cycleDays - 2 && daysSinceLastDistribution < recentDistribution.cycleDays) {
        return {
          duplicate: false,
          needReview: true,
          message: `该家庭距离上一次领取${daysSinceLastDistribution}天，接近${recentDistribution.cycleDays}天周期，建议人工复核`
        };
      }
    }

    return { duplicate: false };
  }

  static async checkFamilyApproved(familyId: number): Promise<boolean> {
    const family = await get('SELECT status FROM families WHERE id = ?', [familyId]) as any;
    return family && family.status === 'approved';
  }

  static async checkBatchActive(batchId: number): Promise<boolean> {
    const batch = await get('SELECT status FROM batches WHERE id = ?', [batchId]) as any;
    return batch && batch.status === 'active';
  }

  static async checkInventoryAvailable(batchId: number, quantity: number): Promise<{ available: boolean; availableQuantity: number }> {
    const inventory = await get('SELECT availableQuantity FROM inventory WHERE batchId = ?', [batchId]) as any;
    if (!inventory) return { available: false, availableQuantity: 0 };
    return {
      available: inventory.availableQuantity >= quantity,
      availableQuantity: inventory.availableQuantity
    };
  }

  static async createDistribution(data: {
    familyId: number;
    batchId: number;
    quantity: number;
    isProxy: boolean;
    proxyName?: string;
    proxyIdCard?: string;
    proxyProof?: boolean;
    operator: string;
  }): Promise<{ success: boolean; data?: any; error?: string; blocked?: boolean }> {
    const duplicateCheck = await this.checkDuplicateDistribution(data.familyId, data.batchId);
    if (duplicateCheck.duplicate) {
      const distributionNo = `BLK${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      
      await run(`
        INSERT INTO distributions (
          distributionNo, familyId, batchId, quantity, status, 
          isProxy, proxyName, proxyIdCard, proxyProof,
          blockReason, needReview, reviewStatus, createdAt
        ) VALUES (?, ?, ?, ?, 'blocked', ?, ?, ?, ?, ?, 0, 'pending', ?)
      `, [
        distributionNo,
        data.familyId,
        data.batchId,
        data.quantity,
        data.isProxy ? 1 : 0,
        data.proxyName,
        data.proxyIdCard,
        data.proxyProof ? 1 : 0,
        duplicateCheck.message,
        new Date().toISOString()
      ]);

      return {
        success: false,
        blocked: true,
        error: duplicateCheck.message,
        data: { distributionNo, status: 'blocked' }
      };
    }

    const familyApproved = await this.checkFamilyApproved(data.familyId);
    if (!familyApproved) {
      return {
        success: false,
        error: '该家庭尚未通过审核，无法领取物资'
      };
    }

    const batchActive = await this.checkBatchActive(data.batchId);
    if (!batchActive) {
      return {
        success: false,
        error: '该发放批次已关闭'
      };
    }

    const inventoryCheck = await this.checkInventoryAvailable(data.batchId, data.quantity);
    if (!inventoryCheck.available) {
      return {
        success: false,
        error: `库存不足，当前可用库存：${inventoryCheck.availableQuantity}`
      };
    }

    let needReview = (duplicateCheck as any).needReview || false;
    
    if (data.isProxy && !data.proxyProof) {
      needReview = true;
    }

    const distributionNo = `DIS${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    
    const result = await run(`
      INSERT INTO distributions (
        distributionNo, familyId, batchId, quantity, status,
        isProxy, proxyName, proxyIdCard, proxyProof,
        needReview, reviewStatus, createdAt
      ) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, 'pending', ?)
    `, [
      distributionNo,
      data.familyId,
      data.batchId,
      data.quantity,
      data.isProxy ? 1 : 0,
      data.proxyName,
      data.proxyIdCard,
      data.proxyProof ? 1 : 0,
      needReview ? 1 : 0,
      new Date().toISOString()
    ]);

    await this.addHistory(result.lastID, 'create', data.operator, '创建发放记录');

    return {
      success: true,
      data: {
        id: result.lastID,
        distributionNo,
        status: 'pending',
        needReview
      }
    };
  }

  static async approveDistribution(distributionId: number, operator: string, quantity?: number): Promise<{ success: boolean; error?: string }> {
    const distribution = await get('SELECT * FROM distributions WHERE id = ?', [distributionId]) as any;
    if (!distribution) return { success: false, error: '发放记录不存在' };
    if (distribution.status !== 'pending') return { success: false, error: '当前状态不允许审核' };

    const finalQuantity = quantity || distribution.quantity;
    const inventoryCheck = await this.checkInventoryAvailable(distribution.batchId, finalQuantity);
    if (!inventoryCheck.available) {
      return { success: false, error: `库存不足，当前可用库存：${inventoryCheck.availableQuantity}` };
    }

    await run(`
      UPDATE distributions 
      SET status = 'distributed', 
          distributor = ?, 
          distributeTime = ?,
          quantity = ?,
          reviewStatus = 'approved',
          reviewer = ?,
          reviewTime = ?
      WHERE id = ?
    `, [operator, new Date().toISOString(), finalQuantity, operator, new Date().toISOString(), distributionId]);

    await run(`
      UPDATE inventory 
      SET distributedQuantity = distributedQuantity + ?,
          availableQuantity = availableQuantity - ?,
          updatedAt = ?
      WHERE batchId = ?
    `, [finalQuantity, finalQuantity, new Date().toISOString(), distribution.batchId]);

    await this.addHistory(distributionId, 'approve', operator, `审核通过，发放${finalQuantity}单位物资`);

    return { success: true };
  }

  static async rejectDistribution(distributionId: number, operator: string, reason: string): Promise<{ success: boolean; error?: string }> {
    const distribution = await get('SELECT * FROM distributions WHERE id = ?', [distributionId]) as any;
    if (!distribution) return { success: false, error: '发放记录不存在' };

    await run(`
      UPDATE distributions 
      SET status = 'blocked',
          blockReason = ?,
          reviewStatus = 'rejected',
          reviewer = ?,
          reviewTime = ?
      WHERE id = ?
    `, [reason, operator, new Date().toISOString(), distributionId]);

    await this.addHistory(distributionId, 'reject', operator, `审核拒绝：${reason}`);

    return { success: true };
  }

  static async returnDistribution(distributionId: number, quantity: number, reason: string, operator: string): Promise<{ success: boolean; error?: string; needReview?: boolean }> {
    const distribution = await get('SELECT * FROM distributions WHERE id = ?', [distributionId]) as any;
    if (!distribution) return { success: false, error: '发放记录不存在' };
    if (distribution.status !== 'distributed') return { success: false, error: '只有已发放的物资可以退回' };

    let needReview = false;
    if (quantity > distribution.quantity) {
      needReview = true;
    }

    await run(`
      INSERT INTO return_records (
        distributionId, quantity, reason, returnTime, operator, inventoryRestored, createdAt
      ) VALUES (?, ?, ?, ?, ?, 0, ?)
    `, [distributionId, quantity, reason, new Date().toISOString(), operator, new Date().toISOString()]);

    await run(`
      UPDATE distributions SET status = 'returned' WHERE id = ?
    `, [distributionId]);

    await this.addHistory(distributionId, 'return', operator, `退回${quantity}单位物资，原因：${reason}`);

    if (!needReview) {
      await this.restoreInventory(distributionId, quantity, operator);
    }

    return { success: true, needReview };
  }

  static async restoreInventory(distributionId: number, quantity: number, operator: string): Promise<{ success: boolean; error?: string }> {
    const distribution = await get('SELECT * FROM distributions WHERE id = ?', [distributionId]) as any;
    if (!distribution) return { success: false, error: '发放记录不存在' };

    await run(`
      UPDATE inventory 
      SET returnedQuantity = returnedQuantity + ?,
          availableQuantity = availableQuantity + ?,
          updatedAt = ?
      WHERE batchId = ?
    `, [quantity, quantity, new Date().toISOString(), distribution.batchId]);

    const returnRecord = await get('SELECT id FROM return_records WHERE distributionId = ? ORDER BY id DESC LIMIT 1', [distributionId]) as any;
    if (returnRecord) {
      await run(`
        UPDATE return_records 
        SET inventoryRestored = 1, restoreTime = ?
        WHERE id = ?
      `, [new Date().toISOString(), returnRecord.id]);
    }

    await this.addHistory(distributionId, 'restore_inventory', operator, `库存恢复${quantity}单位`);

    return { success: true };
  }

  static async addHistory(distributionId: number, action: string, operator: string, details: string) {
    await run(`
      INSERT INTO distribution_history (distributionId, action, operator, details, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `, [distributionId, action, operator, details, new Date().toISOString()]);
  }

  static async getDistributionHistory(distributionId: number) {
    return await all(`
      SELECT * FROM distribution_history WHERE distributionId = ? ORDER BY createdAt DESC
    `, [distributionId]);
  }

  static async getFamilyDistributionHistory(familyId: number) {
    return await all(`
      SELECT d.*, m.name as materialName, b.name as batchName
      FROM distributions d
      JOIN batches b ON d.batchId = b.id
      JOIN materials m ON b.materialId = m.id
      WHERE d.familyId = ?
      ORDER BY d.createdAt DESC
    `, [familyId]);
  }
}

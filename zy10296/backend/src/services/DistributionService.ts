import db from '../database';
import { addDays, differenceInDays, format } from 'date-fns';

export class DistributionService {
  static checkDuplicateDistribution(familyId: number, batchId: number): { duplicate: boolean; message?: string } {
    const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId) as any;
    if (!batch) return { duplicate: false };

    const existingDistributions = db.prepare(`
      SELECT * FROM distributions 
      WHERE familyId = ? AND batchId = ? AND status IN ('distributed', 'pending')
    `).all(familyId, batchId);

    if (existingDistributions.length > 0) {
      return {
        duplicate: true,
        message: `该家庭已在本批次中领取过物资，不能重复领取`
      };
    }

    const recentDistributions = db.prepare(`
      SELECT d.*, b.cycleDays, b.endTime 
      FROM distributions d
      JOIN batches b ON d.batchId = b.id
      WHERE d.familyId = ? 
        AND d.status = 'distributed'
        AND b.materialId = (SELECT materialId FROM batches WHERE id = ?)
      ORDER BY d.distributeTime DESC
      LIMIT 1
    `).get(familyId, batchId) as any;

    if (recentDistributions) {
      const daysSinceLastDistribution = differenceInDays(
        new Date(),
        new Date(recentDistributions.distributeTime)
      );
      
      if (daysSinceLastDistribution < recentDistributions.cycleDays) {
        const daysRemaining = recentDistributions.cycleDays - daysSinceLastDistribution;
        return {
          duplicate: true,
          message: `该家庭距离上一次领取仅${daysSinceLastDistribution}天，未满${recentDistributions.cycleDays}天周期，还需等待${daysRemaining}天`
        };
      }

      if (daysSinceLastDistribution >= recentDistributions.cycleDays - 2 && daysSinceLastDistribution < recentDistributions.cycleDays) {
        return {
          duplicate: false,
          needReview: true,
          message: `该家庭距离上一次领取${daysSinceLastDistribution}天，接近${recentDistributions.cycleDays}天周期，建议人工复核`
        };
      }
    }

    return { duplicate: false };
  }

  static checkFamilyApproved(familyId: number): boolean {
    const family = db.prepare('SELECT status FROM families WHERE id = ?').get(familyId) as any;
    return family && family.status === 'approved';
  }

  static checkBatchActive(batchId: number): boolean {
    const batch = db.prepare('SELECT status FROM batches WHERE id = ?').get(batchId) as any;
    return batch && batch.status === 'active';
  }

  static checkInventoryAvailable(batchId: number, quantity: number): { available: boolean; availableQuantity: number } {
    const inventory = db.prepare('SELECT availableQuantity FROM inventory WHERE batchId = ?').get(batchId) as any;
    if (!inventory) return { available: false, availableQuantity: 0 };
    return {
      available: inventory.availableQuantity >= quantity,
      availableQuantity: inventory.availableQuantity
    };
  }

  static createDistribution(data: {
    familyId: number;
    batchId: number;
    quantity: number;
    isProxy: boolean;
    proxyName?: string;
    proxyIdCard?: string;
    proxyProof?: boolean;
    operator: string;
  }): { success: boolean; data?: any; error?: string; blocked?: boolean } {
    const duplicateCheck = this.checkDuplicateDistribution(data.familyId, data.batchId);
    if (duplicateCheck.duplicate) {
      const distributionNo = `BLK${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
      
      const stmt = db.prepare(`
        INSERT INTO distributions (
          distributionNo, familyId, batchId, quantity, status, 
          isProxy, proxyName, proxyIdCard, proxyProof,
          blockReason, needReview, reviewStatus, createdAt
        ) VALUES (?, ?, ?, ?, 'blocked', ?, ?, ?, ?, ?, 0, 'pending', ?)
      `);
      
      const result = stmt.run(
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
      );

      return {
        success: false,
        blocked: true,
        error: duplicateCheck.message,
        data: { id: result.lastInsertRowid, distributionNo, status: 'blocked' }
      };
    }

    if (!this.checkFamilyApproved(data.familyId)) {
      return {
        success: false,
        error: '该家庭尚未通过审核，无法领取物资'
      };
    }

    if (!this.checkBatchActive(data.batchId)) {
      return {
        success: false,
        error: '该发放批次已关闭'
      };
    }

    const inventoryCheck = this.checkInventoryAvailable(data.batchId, data.quantity);
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

    const distributionNo = `DIS${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    
    const stmt = db.prepare(`
      INSERT INTO distributions (
        distributionNo, familyId, batchId, quantity, status,
        isProxy, proxyName, proxyIdCard, proxyProof,
        needReview, reviewStatus, createdAt
      ) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, 'pending', ?)
    `);

    const result = stmt.run(
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
    );

    const distributionId = result.lastInsertRowid as number;

    this.addHistory(distributionId, 'create', data.operator, '创建发放记录');

    return {
      success: true,
      data: {
        id: distributionId,
        distributionNo,
        status: 'pending',
        needReview
      }
    };
  }

  static approveDistribution(distributionId: number, operator: string, quantity?: number): { success: boolean; error?: string } {
    const distribution = db.prepare('SELECT * FROM distributions WHERE id = ?').get(distributionId) as any;
    if (!distribution) return { success: false, error: '发放记录不存在' };
    if (distribution.status !== 'pending') return { success: false, error: '当前状态不允许审核' };

    const finalQuantity = quantity || distribution.quantity;
    const inventoryCheck = this.checkInventoryAvailable(distribution.batchId, finalQuantity);
    if (!inventoryCheck.available) {
      return { success: false, error: `库存不足，当前可用库存：${inventoryCheck.availableQuantity}` };
    }

    db.prepare(`
      UPDATE distributions 
      SET status = 'distributed', 
          distributor = ?, 
          distributeTime = ?,
          quantity = ?,
          reviewStatus = 'approved',
          reviewer = ?,
          reviewTime = ?
      WHERE id = ?
    `).run(operator, new Date().toISOString(), finalQuantity, operator, new Date().toISOString(), distributionId);

    db.prepare(`
      UPDATE inventory 
      SET distributedQuantity = distributedQuantity + ?,
          availableQuantity = availableQuantity - ?,
          updatedAt = ?
      WHERE batchId = ?
    `).run(finalQuantity, finalQuantity, new Date().toISOString(), distribution.batchId);

    this.addHistory(distributionId, 'approve', operator, `审核通过，发放${finalQuantity}单位物资`);

    return { success: true };
  }

  static rejectDistribution(distributionId: number, operator: string, reason: string): { success: boolean; error?: string } {
    const distribution = db.prepare('SELECT * FROM distributions WHERE id = ?').get(distributionId) as any;
    if (!distribution) return { success: false, error: '发放记录不存在' };

    db.prepare(`
      UPDATE distributions 
      SET status = 'blocked',
          blockReason = ?,
          reviewStatus = 'rejected',
          reviewer = ?,
          reviewTime = ?
      WHERE id = ?
    `).run(reason, operator, new Date().toISOString(), distributionId);

    this.addHistory(distributionId, 'reject', operator, `审核拒绝：${reason}`);

    return { success: true };
  }

  static returnDistribution(distributionId: number, quantity: number, reason: string, operator: string): { success: boolean; error?: string; needReview?: boolean } {
    const distribution = db.prepare('SELECT * FROM distributions WHERE id = ?').get(distributionId) as any;
    if (!distribution) return { success: false, error: '发放记录不存在' };
    if (distribution.status !== 'distributed') return { success: false, error: '只有已发放的物资可以退回' };

    let needReview = false;
    if (quantity > distribution.quantity) {
      needReview = true;
    }

    const stmt = db.prepare(`
      INSERT INTO return_records (
        distributionId, quantity, reason, returnTime, operator, inventoryRestored, createdAt
      ) VALUES (?, ?, ?, ?, ?, 0, ?)
    `);
    stmt.run(distributionId, quantity, reason, new Date().toISOString(), operator, new Date().toISOString());

    db.prepare(`
      UPDATE distributions SET status = 'returned' WHERE id = ?
    `).run(distributionId);

    this.addHistory(distributionId, 'return', operator, `退回${quantity}单位物资，原因：${reason}`);

    if (!needReview) {
      this.restoreInventory(distributionId, quantity, operator);
    }

    return { success: true, needReview };
  }

  static restoreInventory(distributionId: number, quantity: number, operator: string): { success: boolean; error?: string } {
    const distribution = db.prepare('SELECT * FROM distributions WHERE id = ?').get(distributionId) as any;
    if (!distribution) return { success: false, error: '发放记录不存在' };

    db.prepare(`
      UPDATE inventory 
      SET returnedQuantity = returnedQuantity + ?,
          availableQuantity = availableQuantity + ?,
          updatedAt = ?
      WHERE batchId = ?
    `).run(quantity, quantity, new Date().toISOString(), distribution.batchId);

    const returnRecord = db.prepare('SELECT id FROM return_records WHERE distributionId = ? ORDER BY id DESC LIMIT 1').get(distributionId) as any;
    if (returnRecord) {
      db.prepare(`
        UPDATE return_records 
        SET inventoryRestored = 1, restoreTime = ?
        WHERE id = ?
      `).run(new Date().toISOString(), returnRecord.id);
    }

    this.addHistory(distributionId, 'restore_inventory', operator, `库存恢复${quantity}单位`);

    return { success: true };
  }

  static addHistory(distributionId: number, action: string, operator: string, details: string) {
    db.prepare(`
      INSERT INTO distribution_history (distributionId, action, operator, details, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `).run(distributionId, action, operator, details, new Date().toISOString());
  }

  static getDistributionHistory(distributionId: number) {
    return db.prepare(`
      SELECT * FROM distribution_history WHERE distributionId = ? ORDER BY createdAt DESC
    `).all(distributionId);
  }

  static getFamilyDistributionHistory(familyId: number) {
    return db.prepare(`
      SELECT d.*, m.name as materialName, b.name as batchName
      FROM distributions d
      JOIN batches b ON d.batchId = b.id
      JOIN materials m ON b.materialId = m.id
      WHERE d.familyId = ?
      ORDER BY d.createdAt DESC
    `).all(familyId);
  }
}

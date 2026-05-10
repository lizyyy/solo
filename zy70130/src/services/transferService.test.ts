import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import { setDatabaseForTest, closeDatabase, createEmptyState, DatabaseState } from '../database';
import { userService } from './userService';
import { collectionService } from './collectionService';
import { transferService } from './transferService';
import { auditService } from './auditService';
import { TransferStatus, FreezeType, CollectionStatus } from '../types';

describe('TransferService', () => {
  let db: DatabaseState;

  beforeEach(() => {
    db = createEmptyState();
    setDatabaseForTest(db);
  });

  afterEach(() => {
    closeDatabase();
  });

  describe('完整转赠链路', () => {
    it('应该完成完整的转赠链路', () => {
      const user1 = userService.createUser('用户A', true);
      const user2 = userService.createUser('用户B', true);
      const collection = collectionService.createCollection('测试藏品', user1.id);

      const transfer = transferService.createTransfer({
        collectionId: collection.id,
        fromUserId: user1.id,
        toUserId: user2.id,
      });

      expect(transfer.status).toBe(TransferStatus.PENDING);
      expect(transfer.riskReasons).toHaveLength(0);

      const approved = transferService.approveTransfer(transfer.id, user2.id);
      expect(approved.status).toBe(TransferStatus.COMPLETED);

      const updatedCollection = collectionService.getCollection(collection.id);
      expect(updatedCollection!.ownerId).toBe(user2.id);
    });

    it('应该在转赠后查询历史记录', () => {
      const user1 = userService.createUser('用户A', true);
      const user2 = userService.createUser('用户B', true);
      const collection = collectionService.createCollection('测试藏品', user1.id);

      const transfer = transferService.createTransfer({
        collectionId: collection.id,
        fromUserId: user1.id,
        toUserId: user2.id,
      });
      transferService.approveTransfer(transfer.id, user2.id);

      const detail = transferService.getTransferDetail(transfer.id);
      expect(detail).not.toBeNull();
      expect(detail!.history.length).toBeGreaterThan(0);

      const collectionTransfers = transferService.getTransfersByCollection(collection.id);
      expect(collectionTransfers.length).toBe(1);

      const user1Transfers = transferService.getTransfersByUser(user1.id);
      expect(user1Transfers.length).toBe(1);

      const user2Transfers = transferService.getTransfersByUser(user2.id);
      expect(user2Transfers.length).toBe(1);
    });
  });

  describe('实名校验', () => {
    it('转出方未实名应该被拒绝', () => {
      const user1 = userService.createUser('用户A', false);
      const user2 = userService.createUser('用户B', true);
      const collection = collectionService.createCollection('测试藏品', user1.id);

      expect(() => {
        transferService.createTransfer({
          collectionId: collection.id,
          fromUserId: user1.id,
          toUserId: user2.id,
        });
      }).toThrow('转出方未实名认证');
    });

    it('转入方未实名应该被拒绝', () => {
      const user1 = userService.createUser('用户A', true);
      const user2 = userService.createUser('用户B', false);
      const collection = collectionService.createCollection('测试藏品', user1.id);

      expect(() => {
        transferService.createTransfer({
          collectionId: collection.id,
          fromUserId: user1.id,
          toUserId: user2.id,
        });
      }).toThrow('转入方未实名认证');
    });

    it('双方都未实名应该被拒绝', () => {
      const user1 = userService.createUser('用户A', false);
      const user2 = userService.createUser('用户B', false);
      const collection = collectionService.createCollection('测试藏品', user1.id);

      expect(() => {
        transferService.createTransfer({
          collectionId: collection.id,
          fromUserId: user1.id,
          toUserId: user2.id,
        });
      }).toThrow('未实名认证');
    });
  });

  describe('所有权校验', () => {
    it('非持有者不能转赠', () => {
      const user1 = userService.createUser('用户A', true);
      const user2 = userService.createUser('用户B', true);
      const user3 = userService.createUser('用户C', true);
      const collection = collectionService.createCollection('测试藏品', user1.id);

      expect(() => {
        transferService.createTransfer({
          collectionId: collection.id,
          fromUserId: user2.id,
          toUserId: user3.id,
        });
      }).toThrow('转出方不是藏品当前持有者');
    });
  });

  describe('风控冻结', () => {
    it('冻结的用户不能转赠', () => {
      const user1 = userService.createUser('用户A', true);
      const user2 = userService.createUser('用户B', true);
      const collection = collectionService.createCollection('测试藏品', user1.id);

      userService.freezeUser(user1.id);

      expect(() => {
        transferService.createTransfer({
          collectionId: collection.id,
          fromUserId: user1.id,
          toUserId: user2.id,
        });
      }).toThrow('转出账户已被冻结');
    });

    it('冻结的藏品不能转赠', () => {
      const user1 = userService.createUser('用户A', true);
      const user2 = userService.createUser('用户B', true);
      const collection = collectionService.createCollection('测试藏品', user1.id);

      collectionService.freezeCollection(collection.id);

      expect(() => {
        transferService.createTransfer({
          collectionId: collection.id,
          fromUserId: user1.id,
          toUserId: user2.id,
        });
      }).toThrow('藏品已被冻结');
    });
  });

  describe('取消转赠', () => {
    it('转出方可以取消待处理的转赠', () => {
      const user1 = userService.createUser('用户A', true);
      const user2 = userService.createUser('用户B', true);
      const collection = collectionService.createCollection('测试藏品', user1.id);

      const transfer = transferService.createTransfer({
        collectionId: collection.id,
        fromUserId: user1.id,
        toUserId: user2.id,
      });

      const canceled = transferService.cancelTransfer(transfer.id, user1.id);
      expect(canceled.status).toBe(TransferStatus.CANCELED);
    });

    it('非转出方不能取消转赠', () => {
      const user1 = userService.createUser('用户A', true);
      const user2 = userService.createUser('用户B', true);
      const user3 = userService.createUser('用户C', true);
      const collection = collectionService.createCollection('测试藏品', user1.id);

      const transfer = transferService.createTransfer({
        collectionId: collection.id,
        fromUserId: user1.id,
        toUserId: user2.id,
      });

      expect(() => {
        transferService.cancelTransfer(transfer.id, user3.id);
      }).toThrow('只有转出方可以取消转赠');
    });
  });

  describe('撤销转赠', () => {
    it('管理员可以撤销已完成的转赠', () => {
      const user1 = userService.createUser('用户A', true);
      const user2 = userService.createUser('用户B', true);
      const admin = userService.createUser('管理员', true);
      const collection = collectionService.createCollection('测试藏品', user1.id);

      const transfer = transferService.createTransfer({
        collectionId: collection.id,
        fromUserId: user1.id,
        toUserId: user2.id,
      });
      transferService.approveTransfer(transfer.id, user2.id);

      const revoked = transferService.revokeTransfer(
        transfer.id,
        admin.id,
        '违规操作'
      );

      expect(revoked.status).toBe(TransferStatus.REVOKED);

      const updatedCollection = collectionService.getCollection(collection.id);
      expect(updatedCollection!.ownerId).toBe(user1.id);
    });

    it('不能撤销未完成的转赠', () => {
      const user1 = userService.createUser('用户A', true);
      const user2 = userService.createUser('用户B', true);
      const admin = userService.createUser('管理员', true);
      const collection = collectionService.createCollection('测试藏品', user1.id);

      const transfer = transferService.createTransfer({
        collectionId: collection.id,
        fromUserId: user1.id,
        toUserId: user2.id,
      });

      expect(() => {
        transferService.revokeTransfer(transfer.id, admin.id, '测试');
      }).toThrow('只有已完成的转赠可以撤销');
    });
  });

  describe('人工修正状态', () => {
    it('管理员可以人工修正转赠状态', () => {
      const user1 = userService.createUser('用户A', true);
      const user2 = userService.createUser('用户B', true);
      const admin = userService.createUser('管理员', true);
      const collection = collectionService.createCollection('测试藏品', user1.id);

      const transfer = transferService.createTransfer({
        collectionId: collection.id,
        fromUserId: user1.id,
        toUserId: user2.id,
      });

      const corrected = transferService.manualCorrectTransfer(
        transfer.id,
        TransferStatus.REJECTED,
        admin.id,
        '人工修正'
      );

      expect(corrected.status).toBe(TransferStatus.REJECTED);
    });
  });

  describe('重复请求处理', () => {
    it('同一藏品不能有多个待处理的转赠', () => {
      const user1 = userService.createUser('用户A', true);
      const user2 = userService.createUser('用户B', true);
      const user3 = userService.createUser('用户C', true);
      const collection = collectionService.createCollection('测试藏品', user1.id);

      transferService.createTransfer({
        collectionId: collection.id,
        fromUserId: user1.id,
        toUserId: user2.id,
      });

      expect(() => {
        transferService.createTransfer({
          collectionId: collection.id,
          fromUserId: user1.id,
          toUserId: user3.id,
        });
      }).toThrow('该藏品已有待处理的转赠请求');
    });
  });

  describe('状态一致性', () => {
    it('人工修正后应该有历史记录且不矛盾', () => {
      const user1 = userService.createUser('用户A', true);
      const user2 = userService.createUser('用户B', true);
      const admin = userService.createUser('管理员', true);
      const collection = collectionService.createCollection('测试藏品', user1.id);

      const transfer = transferService.createTransfer({
        collectionId: collection.id,
        fromUserId: user1.id,
        toUserId: user2.id,
      });
      transferService.approveTransfer(transfer.id, user2.id);

      const beforeHistory = transferService.getTransferHistory(transfer.id);
      const lastHistoryBefore = beforeHistory[beforeHistory.length - 1];
      expect(lastHistoryBefore.statusAtTime).toBe(TransferStatus.COMPLETED);

      transferService.manualCorrectTransfer(
        transfer.id,
        TransferStatus.REJECTED,
        admin.id,
        '人工修正'
      );

      const afterHistory = transferService.getTransferHistory(transfer.id);
      expect(afterHistory.length).toBeGreaterThan(beforeHistory.length);

      const currentTransfer = transferService.getTransfer(transfer.id);
      expect(currentTransfer!.status).toBe(TransferStatus.REJECTED);

      const manualCorrectEvent = afterHistory.find(
        (h) => h.eventType === 'manual_correct'
      );
      expect(manualCorrectEvent).not.toBeUndefined();
      expect(manualCorrectEvent!.operatorType).toBe('admin');
    });
  });

  describe('冻结记录', () => {
    it('应该记录冻结历史', () => {
      const user1 = userService.createUser('用户A', true);
      const admin = userService.createUser('管理员', true);

      auditService.freezeTarget(FreezeType.USER, user1.id, '风控检测', admin.id);

      const history = auditService.getFreezeHistory(FreezeType.USER, user1.id);
      expect(history.length).toBe(1);
      expect(history[0].isActive).toBe(true);
      expect(history[0].reason).toBe('风控检测');
    });

    it('解冻后仍能查询历史', () => {
      const user1 = userService.createUser('用户A', true);
      const admin = userService.createUser('管理员', true);

      auditService.freezeTarget(FreezeType.USER, user1.id, '风控检测', admin.id);
      auditService.unfreezeTarget(FreezeType.USER, user1.id, admin.id);

      const history = auditService.getFreezeHistory(FreezeType.USER, user1.id);
      expect(history.length).toBe(1);
      expect(history[0].isActive).toBe(false);
      expect(history[0].releasedAt).not.toBeNull();
    });
  });
});

const pointLedgerRepo = require('../repositories/PointLedgerRepository');
const freezeBucketRepo = require('../repositories/FreezeBucketRepository');
const balanceSnapshotRepo = require('../repositories/BalanceSnapshotRepository');
const dayjs = require('dayjs');

const TRANS_TYPES = {
  RECHARGE: 'recharge',
  CONSUME: 'consume',
  REFUND: 'refund',
  FREEZE: 'freeze',
  UNFREEZE: 'unfreeze',
  CONSUME_FROM_FREEZE: 'consume_from_freeze',
  REFUND_TO_FREEZE: 'refund_to_freeze'
};

const DIRECTION = {
  IN: 'IN',
  OUT: 'OUT'
};

class BalanceService {
  getCurrentBalance(memberId) {
    const ledgers = pointLedgerRepo.findByMemberId(memberId, 1);
    if (ledgers.length === 0) {
      return {
        totalBalance: 0,
        freezeBalance: 0,
        availableBalance: 0
      };
    }
    const latest = ledgers[0];
    return {
      totalBalance: latest.balance_after,
      freezeBalance: latest.freeze_balance_after,
      availableBalance: latest.available_balance_after
    };
  }

  calculateFreezeBalance(memberId) {
    const activeBuckets = freezeBucketRepo.findActiveByMemberId(memberId);
    return activeBuckets.reduce((sum, b) => {
      return sum + (b.frozen_amount - b.used_amount - b.released_amount);
    }, 0);
  }

  recordLedger(data) {
    return pointLedgerRepo.create(data);
  }

  recordFailedLedger(memberId, transType, amount, requestId, errorCode, errorMessage, operator) {
    const current = this.getCurrentBalance(memberId);
    return this.recordLedger({
      memberId,
      transType,
      direction: transType === TRANS_TYPES.RECHARGE || transType === TRANS_TYPES.REFUND || transType === TRANS_TYPES.UNFREEZE || transType === TRANS_TYPES.REFUND_TO_FREEZE
        ? DIRECTION.IN
        : DIRECTION.OUT,
      amount,
      balanceBefore: current.totalBalance,
      balanceAfter: current.totalBalance,
      freezeBalanceBefore: current.freezeBalance,
      freezeBalanceAfter: current.freezeBalance,
      availableBalanceBefore: current.availableBalance,
      availableBalanceAfter: current.availableBalance,
      requestId,
      status: 'FAILED',
      errorCode,
      errorMessage,
      operator: operator?.name,
      operatorId: operator?.id,
      operatorType: operator?.type
    });
  }

  createSnapshot(memberId, snapshotDate) {
    const current = this.getCurrentBalance(memberId);
    const ledgerCount = pointLedgerRepo.countByMemberAndDate(memberId, snapshotDate);
    
    try {
      return balanceSnapshotRepo.create({
        memberId,
        snapshotDate: dayjs(snapshotDate).format('YYYY-MM-DD'),
        totalBalance: current.totalBalance,
        freezeBalance: current.freezeBalance,
        availableBalance: current.availableBalance,
        ledgerCount
      });
    } catch (e) {
      if (e.message.includes('UNIQUE')) {
        return balanceSnapshotRepo.findByMemberAndDate(
          memberId,
          dayjs(snapshotDate).format('YYYY-MM-DD')
        );
      }
      throw e;
    }
  }

  verifyConsistency(memberId) {
    const fromLedgers = this.getCurrentBalance(memberId);
    const fromBuckets = this.calculateFreezeBalance(memberId);
    
    return {
      memberId,
      ledgerFreezeBalance: fromLedgers.freezeBalance,
      bucketFreezeBalance: fromBuckets,
      isConsistent: fromLedgers.freezeBalance === fromBuckets,
      diff: fromLedgers.freezeBalance - fromBuckets
    };
  }
}

module.exports = { BalanceService, TRANS_TYPES, DIRECTION };

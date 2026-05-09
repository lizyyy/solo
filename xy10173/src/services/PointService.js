const db = require('../config/database');
const { BalanceService, TRANS_TYPES, DIRECTION } = require('./BalanceService');
const memberRepo = require('../repositories/MemberRepository');
const freezeBucketRepo = require('../repositories/FreezeBucketRepository');
const freezeRuleRepo = require('../repositories/FreezeRuleRepository');
const idempotencyRepo = require('../repositories/IdempotencyRepository');
const {
  MemberNotFoundError,
  InsufficientBalanceError,
  IdempotentConflictError,
  FreezeRuleNotFoundError,
  InvalidAmountError,
  FreezeBucketNotFoundError
} = require('../errors/ApiError');
const dayjs = require('dayjs');

const balanceService = new BalanceService();

class PointService {
  async withIdempotency(requestId, action, operation, operator) {
    const existing = idempotencyRepo.findByRequestIdAndAction(requestId, action);
    
    if (existing) {
      if (existing.status === 'PROCESSING') {
        throw new IdempotentConflictError(requestId, action, { status: 'PROCESSING' });
      }
      if (existing.status === 'SUCCESS' || existing.status === 'FAILED') {
        let result = null;
        if (existing.result) {
          try {
            result = JSON.parse(existing.result);
          } catch (e) {
            result = existing.result;
          }
        }
        return {
          isIdempotent: true,
          status: existing.status,
          result,
          errorCode: existing.error_code,
          errorMessage: existing.error_message
        };
      }
    }

    const idempotentRecord = idempotencyRepo.create({
      requestId,
      action,
      memberId: operation.memberId || null,
      status: 'PROCESSING'
    });

    try {
      const result = await operation.execute();
      idempotencyRepo.update(idempotentRecord.id, {
        status: 'SUCCESS',
        result
      });
      return { isIdempotent: false, status: 'SUCCESS', result };
    } catch (e) {
      idempotencyRepo.update(idempotentRecord.id, {
        status: 'FAILED',
        errorCode: e.code || 'UNKNOWN_ERROR',
        errorMessage: e.message
      });
      throw e;
    }
  }

  recharge(memberId, amount, requestId, operator, reason = '充值') {
    this._validateMember(memberId);
    
    if (amount <= 0) {
      throw new InvalidAmountError(amount, '必须大于0');
    }

    return this.withIdempotency(requestId, 'recharge', {
      memberId,
      execute: () => this._doRecharge(memberId, amount, requestId, operator, reason)
    }, operator);
  }

  _doRecharge(memberId, amount, requestId, operator, reason) {
    const current = balanceService.getCurrentBalance(memberId);
    const newTotal = current.totalBalance + amount;
    const newAvailable = current.availableBalance + amount;

    const ledger = balanceService.recordLedger({
      memberId,
      transType: TRANS_TYPES.RECHARGE,
      direction: DIRECTION.IN,
      amount,
      balanceBefore: current.totalBalance,
      balanceAfter: newTotal,
      freezeBalanceBefore: current.freezeBalance,
      freezeBalanceAfter: current.freezeBalance,
      availableBalanceBefore: current.availableBalance,
      availableBalanceAfter: newAvailable,
      reason,
      requestId,
      status: 'SUCCESS',
      operator: operator?.name,
      operatorId: operator?.id,
      operatorType: operator?.type
    });

    return {
      memberId,
      transaction: ledger,
      balance: {
        totalBalance: newTotal,
        freezeBalance: current.freezeBalance,
        availableBalance: newAvailable
      }
    };
  }

  freeze(memberId, amount, freezeRuleCode, requestId, operator, reason = '风控冻结') {
    this._validateMember(memberId);
    
    if (amount <= 0) {
      throw new InvalidAmountError(amount, '必须大于0');
    }

    const rule = freezeRuleRepo.findByCode(freezeRuleCode);
    if (!rule) {
      throw new FreezeRuleNotFoundError(freezeRuleCode);
    }

    return this.withIdempotency(requestId, 'freeze', {
      memberId,
      execute: () => this._doFreeze(memberId, amount, rule, requestId, operator, reason)
    }, operator);
  }

  _doFreeze(memberId, amount, rule, requestId, operator, reason) {
    const current = balanceService.getCurrentBalance(memberId);
    
    if (current.availableBalance < amount) {
      throw new InsufficientBalanceError(current.availableBalance, amount);
    }

    const frozenAt = dayjs().valueOf();
    let expectedReleaseAt = null;
    if (rule.release_days) {
      expectedReleaseAt = dayjs().add(rule.release_days, 'day').valueOf();
    }

    const bucket = freezeBucketRepo.create({
      memberId,
      amount,
      frozenAmount: amount,
      reason,
      operator: operator?.name,
      operatorId: operator?.id,
      operatorType: operator?.type,
      freezeRuleId: rule.id,
      status: 'ACTIVE',
      frozenAt,
      expectedReleaseAt
    });

    const newFreezeBalance = current.freezeBalance + amount;
    const newAvailableBalance = current.availableBalance - amount;

    const ledger = balanceService.recordLedger({
      memberId,
      transType: TRANS_TYPES.FREEZE,
      direction: DIRECTION.OUT,
      amount,
      balanceBefore: current.totalBalance,
      balanceAfter: current.totalBalance,
      freezeBalanceBefore: current.freezeBalance,
      freezeBalanceAfter: newFreezeBalance,
      availableBalanceBefore: current.availableBalance,
      availableBalanceAfter: newAvailableBalance,
      reason,
      requestId,
      status: 'SUCCESS',
      operator: operator?.name,
      operatorId: operator?.id,
      operatorType: operator?.type,
      refId: bucket.id,
      refType: 'freeze_bucket'
    });

    return {
      memberId,
      bucket,
      transaction: ledger,
      rule,
      balance: {
        totalBalance: current.totalBalance,
        freezeBalance: newFreezeBalance,
        availableBalance: newAvailableBalance
      }
    };
  }

  consume(memberId, amount, requestId, operator, refId = null, reason = '消费', allowFreeze = false) {
    this._validateMember(memberId);
    
    if (amount <= 0) {
      throw new InvalidAmountError(amount, '必须大于0');
    }

    return this.withIdempotency(requestId, 'consume', {
      memberId,
      execute: () => this._doConsume(memberId, amount, requestId, operator, refId, reason, allowFreeze)
    }, operator);
  }

  _doConsume(memberId, amount, requestId, operator, refId, reason, allowFreeze) {
    const current = balanceService.getCurrentBalance(memberId);
    
    let remaining = amount;
    let transType = TRANS_TYPES.CONSUME;
    let consumedFromFreeze = 0;
    let consumedFromAvailable = 0;
    let usedBuckets = [];

    if (allowFreeze && current.availableBalance < remaining) {
      transType = TRANS_TYPES.CONSUME_FROM_FREEZE;
      
      if (current.availableBalance > 0) {
        consumedFromAvailable = current.availableBalance;
        remaining -= current.availableBalance;
      }
      
      const activeBuckets = freezeBucketRepo.findActiveByMemberId(memberId);
      for (const bucket of activeBuckets) {
        const inBucket = bucket.frozen_amount - bucket.used_amount - bucket.released_amount;
        const take = Math.min(inBucket, remaining);
        if (take > 0) {
          const newUsed = bucket.used_amount + take;
          const status = (bucket.frozen_amount - newUsed - bucket.released_amount) > 0 ? 'PARTIAL' : 'USED';
          
          freezeBucketRepo.update(bucket.id, {
            usedAmount: newUsed,
            status
          });
          
          usedBuckets.push({
            bucketId: bucket.id,
            amount: take
          });
          
          consumedFromFreeze += take;
          remaining -= take;
          
          if (remaining === 0) break;
        }
      }
      
      if (remaining > 0) {
        throw new InsufficientBalanceError(current.totalBalance, amount);
      }
    } else {
      if (current.availableBalance < amount) {
        throw new InsufficientBalanceError(current.availableBalance, amount);
      }
      consumedFromAvailable = amount;
    }

    const newTotal = current.totalBalance - (consumedFromAvailable + consumedFromFreeze);
    const newFreeze = current.freezeBalance - consumedFromFreeze;
    const newAvailable = current.availableBalance - consumedFromAvailable;

    const ledger = balanceService.recordLedger({
      memberId,
      transType,
      direction: DIRECTION.OUT,
      amount,
      balanceBefore: current.totalBalance,
      balanceAfter: newTotal,
      freezeBalanceBefore: current.freezeBalance,
      freezeBalanceAfter: newFreeze,
      availableBalanceBefore: current.availableBalance,
      availableBalanceAfter: newAvailable,
      reason,
      requestId,
      status: 'SUCCESS',
      operator: operator?.name,
      operatorId: operator?.id,
      operatorType: operator?.type,
      refId,
      refType: refId ? 'order' : null
    });

    return {
      memberId,
      transaction: ledger,
      breakdown: {
        consumedFromAvailable,
        consumedFromFreeze,
        usedBuckets
      },
      balance: {
        totalBalance: newTotal,
        freezeBalance: newFreeze,
        availableBalance: newAvailable
      }
    };
  }

  refund(memberId, amount, requestId, operator, refId = null, reason = '退款') {
    this._validateMember(memberId);
    
    if (amount <= 0) {
      throw new InvalidAmountError(amount, '必须大于0');
    }

    return this.withIdempotency(requestId, 'refund', {
      memberId,
      execute: () => this._doRefund(memberId, amount, requestId, operator, refId, reason)
    }, operator);
  }

  _doRefund(memberId, amount, requestId, operator, refId, reason) {
    const current = balanceService.getCurrentBalance(memberId);

    const newTotal = current.totalBalance + amount;
    const newAvailable = current.availableBalance + amount;

    const ledger = balanceService.recordLedger({
      memberId,
      transType: TRANS_TYPES.REFUND,
      direction: DIRECTION.IN,
      amount,
      balanceBefore: current.totalBalance,
      balanceAfter: newTotal,
      freezeBalanceBefore: current.freezeBalance,
      freezeBalanceAfter: current.freezeBalance,
      availableBalanceBefore: current.availableBalance,
      availableBalanceAfter: newAvailable,
      reason,
      requestId,
      status: 'SUCCESS',
      operator: operator?.name,
      operatorId: operator?.id,
      operatorType: operator?.type,
      refId,
      refType: refId ? 'order' : null
    });

    return {
      memberId,
      transaction: ledger,
      balance: {
        totalBalance: newTotal,
        freezeBalance: current.freezeBalance,
        availableBalance: newAvailable
      }
    };
  }

  unfreeze(memberId, bucketId, amount, requestId, operator, reason = '解冻') {
    this._validateMember(memberId);
    
    if (amount <= 0) {
      throw new InvalidAmountError(amount, '必须大于0');
    }

    return this.withIdempotency(requestId, 'unfreeze', {
      memberId,
      execute: () => this._doUnfreeze(memberId, bucketId, amount, requestId, operator, reason)
    }, operator);
  }

  _doUnfreeze(memberId, bucketId, amount, requestId, operator, reason) {
    const bucket = freezeBucketRepo.findById(bucketId);
    if (!bucket) {
      throw new FreezeBucketNotFoundError(bucketId);
    }
    if (bucket.member_id !== memberId) {
      throw new FreezeBucketNotFoundError(bucketId);
    }
    if (bucket.status !== 'ACTIVE' && bucket.status !== 'PARTIAL') {
      throw new InvalidAmountError(amount, `冻结桶状态不可解冻: ${bucket.status}`);
    }

    const inBucket = bucket.frozen_amount - bucket.used_amount - bucket.released_amount;
    if (inBucket < amount) {
      throw new InsufficientBalanceError(inBucket, amount);
    }

    const current = balanceService.getCurrentBalance(memberId);
    const newReleased = bucket.released_amount + amount;
    const remainingInBucket = bucket.frozen_amount - bucket.used_amount - newReleased;
    const newStatus = remainingInBucket > 0 ? 'PARTIAL' : 'RELEASED';

    freezeBucketRepo.update(bucket.id, {
      releasedAmount: newReleased,
      status: newStatus,
      releasedAt: newStatus === 'RELEASED' ? dayjs().valueOf() : undefined
    });

    const newFreeze = current.freezeBalance - amount;
    const newAvailable = current.availableBalance + amount;

    const ledger = balanceService.recordLedger({
      memberId,
      transType: TRANS_TYPES.UNFREEZE,
      direction: DIRECTION.IN,
      amount,
      balanceBefore: current.totalBalance,
      balanceAfter: current.totalBalance,
      freezeBalanceBefore: current.freezeBalance,
      freezeBalanceAfter: newFreeze,
      availableBalanceBefore: current.availableBalance,
      availableBalanceAfter: newAvailable,
      reason,
      requestId,
      status: 'SUCCESS',
      operator: operator?.name,
      operatorId: operator?.id,
      operatorType: operator?.type,
      refId: bucket.id,
      refType: 'freeze_bucket'
    });

    return {
      memberId,
      bucket: freezeBucketRepo.findById(bucket.id),
      transaction: ledger,
      balance: {
        totalBalance: current.totalBalance,
        freezeBalance: newFreeze,
        availableBalance: newAvailable
      }
    };
  }

  autoUnfreezeExpired(memberId, operator) {
    this._validateMember(memberId);
    
    const now = dayjs();
    const expiredBuckets = freezeBucketRepo.findByMemberAndDateBefore(memberId, now);
    
    const results = [];
    for (const bucket of expiredBuckets) {
      const inBucket = bucket.frozen_amount - bucket.used_amount - bucket.released_amount;
      if (inBucket > 0) {
        const requestId = `auto-unfreeze-${bucket.id}-${now.format('YYYYMMDDHHmmss')}`;
        const result = this._doUnfreeze(
          memberId, bucket.id, inBucket, requestId,
          { name: 'system', id: 'system', type: 'system' },
          '自动解冻-到期'
        );
        results.push(result);
      }
    }
    
    return results;
  }

  _validateMember(memberId) {
    const member = memberRepo.findById(memberId);
    if (!member) {
      throw new MemberNotFoundError(memberId);
    }
    return member;
  }
}

module.exports = new PointService();

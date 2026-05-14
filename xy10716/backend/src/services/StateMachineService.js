const StateHistory = require('../models/StateHistory');
const FeatureSwitch = require('../models/FeatureSwitch');
const { v4: uuidv4 } = require('uuid');

class StateMachineService {
  constructor() {
    this.validTransitions = {
      PENDING: ['SUCCESS', 'FAILED'],
      SUCCESS: ['ROLLED_BACK', 'CORRECTED'],
      FAILED: ['ROLLED_BACK', 'CORRECTED'],
      ROLLED_BACK: ['CORRECTED'],
      CORRECTED: []
    };
  }

  async createHistory(switchData, operationType, operator, reason, requestId, idempotencyKey) {
    const history = new StateHistory({
      switchId: switchData._id,
      switchName: switchData.name,
      operationType,
      previousState: {
        isActive: switchData.isActive,
        targetUsers: [...switchData.targetUsers],
        ruleExpression: switchData.ruleExpression,
        version: switchData.version
      },
      newState: {
        isActive: switchData.isActive,
        targetUsers: [...switchData.targetUsers],
        ruleExpression: switchData.ruleExpression,
        version: switchData.version
      },
      status: 'PENDING',
      requestId: requestId || uuidv4(),
      idempotencyKey,
      operator,
      reason,
      targetUsersAtTime: [...switchData.targetUsers],
      affectedUsers: switchData.targetUsers.map(userId => ({
        userId,
        action: operationType,
        timestamp: new Date()
      }))
    });

    await history.save();
    return history;
  }

  async transitionState(historyId, newStatus, metadata = {}) {
    const history = await StateHistory.findById(historyId);
    if (!history) {
      throw new Error('History record not found');
    }

    const currentStatus = history.status;
    if (!this.validTransitions[currentStatus].includes(newStatus)) {
      throw new Error(`Invalid state transition from ${currentStatus} to ${newStatus}`);
    }

    history.status = newStatus;
    
    if (metadata.errorMessage) {
      history.errorMessage = metadata.errorMessage;
    }
    if (metadata.rollbackReason) {
      history.rollbackReason = metadata.rollbackReason;
    }
    if (metadata.correctionReason) {
      history.correctionReason = metadata.correctionReason;
      history.correctedBy = metadata.correctedBy;
      history.correctedAt = new Date();
    }

    await history.save();
    return history;
  }

  async handleRollback(historyId, rollbackReason, operator) {
    const history = await StateHistory.findById(historyId);
    if (!history) {
      throw new Error('History record not found');
    }

    const switchData = await FeatureSwitch.findById(history.switchId);
    if (!switchData) {
      throw new Error('Feature switch not found');
    }

    await this.transitionState(historyId, 'ROLLED_BACK', { rollbackReason });

    switchData.isActive = history.previousState.isActive;
    switchData.targetUsers = history.previousState.targetUsers;
    switchData.ruleExpression = history.previousState.ruleExpression;
    switchData.version = history.previousState.version;
    
    await switchData.save();

    const rollbackHistory = await this.createHistory(
      switchData,
      'ROLLBACK',
      operator,
      rollbackReason,
      uuidv4(),
      null
    );
    
    await this.transitionState(rollbackHistory._id, 'SUCCESS');

    return { switchData, rollbackHistory };
  }

  async handleCorrection(historyId, correctionReason, correctedBy, newState) {
    const history = await StateHistory.findById(historyId);
    if (!history) {
      throw new Error('History record not found');
    }

    const switchData = await FeatureSwitch.findById(history.switchId);
    if (!switchData) {
      throw new Error('Feature switch not found');
    }

    await this.transitionState(historyId, 'CORRECTED', {
      correctionReason,
      correctedBy
    });

    if (newState) {
      if (newState.isActive !== undefined) {
        switchData.isActive = newState.isActive;
      }
      if (newState.targetUsers) {
        switchData.targetUsers = newState.targetUsers;
      }
      if (newState.ruleExpression !== undefined) {
        switchData.ruleExpression = newState.ruleExpression;
      }
      switchData.version += 1;
    }

    await switchData.save();

    const correctionHistory = await this.createHistory(
      switchData,
      'CORRECT',
      correctedBy,
      correctionReason,
      uuidv4(),
      null
    );
    
    correctionHistory.previousState = {
      isActive: history.newState.isActive,
      targetUsers: history.newState.targetUsers,
      ruleExpression: history.newState.ruleExpression,
      version: history.newState.version
    };
    correctionHistory.newState = {
      isActive: switchData.isActive,
      targetUsers: [...switchData.targetUsers],
      ruleExpression: switchData.ruleExpression,
      version: switchData.version
    };
    
    await correctionHistory.save();
    await this.transitionState(correctionHistory._id, 'SUCCESS');

    return { switchData, correctionHistory };
  }

  async recalculateAffectedUsers(switchId) {
    const histories = await StateHistory.find({ switchId }).sort({ createdAt: 1 });
    const switchData = await FeatureSwitch.findById(switchId);

    if (!switchData) {
      throw new Error('Feature switch not found');
    }

    for (const history of histories) {
      history.affectedUsers = switchData.targetUsers.map(userId => ({
        userId,
        action: history.operationType,
        timestamp: history.createdAt
      }));
      history.targetUsersAtTime = [...switchData.targetUsers];
      await history.save();
    }

    return histories;
  }
}

module.exports = new StateMachineService();

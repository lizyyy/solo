const _ = require('lodash');
const { STATUS } = require('../models/content');

class IdempotentManager {
  static checkDuplicateUnpublish(store, contentId) {
    const content = store.getContent(contentId);
    if (!content) return { isDuplicate: false };
    
    const auditLogs = store.getAuditLogs(contentId);
    const unpublishActions = auditLogs.filter(l => l.action === 'unpublish');
    
    if (content.status === STATUS.UNPUBLISHED || unpublishActions.length > 0) {
      return {
        isDuplicate: true,
        lastAction: unpublishActions[unpublishActions.length - 1],
        currentStatus: content.status,
        message: `内容 ${content.title} (${contentId}) 已执行过撤稿操作，状态: ${content.status}`
      };
    }
    
    return { isDuplicate: false };
  }

  static checkDuplicateChannelUnpublish(channel) {
    if (channel.status === STATUS.UNPUBLISHED) {
      return {
        isDuplicate: true,
        currentStatus: channel.status,
        message: `渠道 ${channel.channelName} 已撤稿，当前状态: ${channel.status}`
      };
    }
    return { isDuplicate: false };
  }

  static mergeUnpublish(store, contentId, action, operator, reason) {
    const duplicateCheck = this.checkDuplicateUnpublish(store, contentId);
    
    if (duplicateCheck.isDuplicate) {
      return {
        success: true,
        isDuplicate: true,
        lastAction: duplicateCheck.lastAction,
        message: duplicateCheck.message
      };
    }
    
    return action();
  }

  static mergeChannelUnpublish(channel, action) {
    const duplicateCheck = this.checkDuplicateChannelUnpublish(channel);
    
    if (duplicateCheck.isDuplicate) {
      return {
        success: true,
        isDuplicate: true,
        message: duplicateCheck.message
      };
    }
    
    return action();
  }

  static calculateContentStatus(channels) {
    if (channels.length === 0) return STATUS.PENDING;
    
    const statuses = channels.map(c => c.status);
    
    if (statuses.every(s => s === STATUS.UNPUBLISHED)) {
      return STATUS.UNPUBLISHED;
    }
    
    if (statuses.some(s => s === STATUS.FAILED)) {
      return STATUS.FAILED;
    }
    
    if (statuses.some(s => s === STATUS.UNPUBLISHED) || statuses.some(s => s === STATUS.PENDING)) {
      return STATUS.PARTIAL;
    }
    
    return STATUS.ACTIVE;
  }
}

module.exports = IdempotentManager;

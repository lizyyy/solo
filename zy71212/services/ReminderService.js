const moment = require('moment');
const { ReminderRecord } = require('../models');

class ReminderService {
  constructor(storageService) {
    this.storageService = storageService;
    this.deduplicationKeys = new Set();
    this.loadExistingDeduplicationKeys();
  }

  loadExistingDeduplicationKeys() {
    const records = this.storageService.getReminderRecords();
    records.forEach(r => {
      if (r.deduplicationKey) {
        this.deduplicationKeys.add(r.deduplicationKey);
      }
    });
  }

  generateDeduplicationKey(policyNo, period, reminderType, reminderDate) {
    const dateStr = moment(reminderDate).format('YYYY-MM-DD');
    return `${policyNo}_${period}_${reminderType}_${dateStr}`;
  }

  isDuplicate(policyNo, period, reminderType, reminderDate) {
    const key = this.generateDeduplicationKey(policyNo, period, reminderType, reminderDate);
    return this.deduplicationKeys.has(key);
  }

  canSendReminder(policyNo, period, reminderType, options = {}) {
    const { minIntervalDays = 1, checkStopIntent = true } = options;
    
    if (this.isDuplicate(policyNo, period, reminderType)) {
      return {
        canSend: false,
        reason: '今日已发送过同类型催缴',
        deduplication: true
      };
    }

    const visitRecords = this.storageService.getVisitRecords();
    const lastVisit = visitRecords
      .filter(v => v.policyNo === policyNo)
      .sort((a, b) => moment(b.visitDate) - moment(a.visitDate))[0];

    if (checkStopIntent && lastVisit?.isStopIntent === true && lastVisit?.intentConfirmed === true) {
      return {
        canSend: false,
        reason: '客户已确认停保意愿，无需催缴',
        stopIntent: true
      };
    }

    const advancePayments = this.storageService.getAdvancePayments();
    const hasUnrepaidAdvance = advancePayments.some(
      a => a.policyNo === policyNo && a.period === period && !a.repaid
    );

    if (hasUnrepaidAdvance) {
      return {
        canSend: false,
        reason: '该期保费已自动垫交，无需催缴',
        advancePayment: true
      };
    }

    const reminderRecords = this.storageService.getReminderRecords();
    const lastReminder = reminderRecords
      .filter(r => r.policyNo === policyNo && r.period === period)
      .sort((a, b) => moment(b.reminderDate) - moment(a.reminderDate))[0];

    if (lastReminder) {
      const daysSinceLast = moment().diff(moment(lastReminder.reminderDate), 'days');
      if (daysSinceLast < minIntervalDays) {
        return {
          canSend: false,
          reason: `距上次催缴仅 ${daysSinceLast} 天，未达到最小间隔 ${minIntervalDays} 天`,
          lastReminder
        };
      }
    }

    return {
      canSend: true,
      lastVisit,
      lastReminder
    };
  }

  createReminder(policyNo, period, reminderType, reminderLevel, content, operator, options = {}) {
    const { channel = '', checkDuplicate = true } = options;

    if (checkDuplicate) {
      const canSend = this.canSendReminder(policyNo, period, reminderType, options);
      if (!canSend.canSend) {
        return {
          success: false,
          ...canSend
        };
      }
    }

    const reminderDate = moment().format('YYYY-MM-DD HH:mm:ss');
    const deduplicationKey = this.generateDeduplicationKey(policyNo, period, reminderType, reminderDate);

    const reminder = new ReminderRecord({
      reminderId: `REM_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      policyNo,
      period,
      reminderDate,
      reminderType,
      reminderLevel,
      reminderContent: content,
      channel,
      operator,
      deduplicationKey,
      status: '已发送'
    });

    const records = this.storageService.getReminderRecords();
    records.push(reminder.toJSON());
    this.storageService.saveReminderRecords(records);

    this.deduplicationKeys.add(deduplicationKey);

    return {
      success: true,
      reminder: reminder.toJSON()
    };
  }

  batchCreateReminders(remindersData, options = {}) {
    const { stopOnError = false } = options;
    const results = {
      success: [],
      failed: [],
      duplicates: [],
      skipped: []
    };

    for (const data of remindersData) {
      try {
        const result = this.createReminder(
          data.policyNo,
          data.period,
          data.reminderType,
          data.reminderLevel || '常规',
          data.content || '',
          data.operator || '',
          data.options || {}
        );

        if (result.success) {
          results.success.push(result.reminder);
        } else if (result.deduplication) {
          results.duplicates.push({ ...data, reason: result.reason });
        } else if (result.stopIntent || result.advancePayment) {
          results.skipped.push({ ...data, reason: result.reason });
        } else {
          results.failed.push({ ...data, reason: result.reason });
        }
      } catch (error) {
        results.failed.push({ ...data, error: error.message });
        if (stopOnError) {
          break;
        }
      }
    }

    return {
      ...results,
      total: remindersData.length,
      successCount: results.success.length,
      failedCount: results.failed.length,
      duplicateCount: results.duplicates.length,
      skippedCount: results.skipped.length
    };
  }

  getReminderHistory(policyNo, period = null) {
    const records = this.storageService.getReminderRecords();
    let filtered = records.filter(r => r.policyNo === policyNo);
    
    if (period) {
      filtered = filtered.filter(r => r.period === period);
    }

    return filtered.sort((a, b) => moment(b.reminderDate) - moment(a.reminderDate));
  }

  getRemindersByDateRange(startDate, endDate) {
    const records = this.storageService.getReminderRecords();
    const start = moment(startDate);
    const end = moment(endDate).endOf('day');

    return records.filter(r => {
      const reminderDate = moment(r.reminderDate);
      return reminderDate.isSameOrAfter(start) && reminderDate.isSameOrBefore(end);
    }).sort((a, b) => moment(b.reminderDate) - moment(a.reminderDate));
  }

  getReminderStatistics(options = {}) {
    const { startDate, endDate, groupBy = 'day' } = options;
    const records = this.storageService.getReminderRecords();
    
    let filtered = records;
    if (startDate && endDate) {
      const start = moment(startDate);
      const end = moment(endDate).endOf('day');
      filtered = records.filter(r => {
        const reminderDate = moment(r.reminderDate);
        return reminderDate.isSameOrAfter(start) && reminderDate.isSameOrBefore(end);
      });
    }

    const stats = {
      total: filtered.length,
      byType: {},
      byLevel: {},
      byStatus: {},
      byChannel: {},
      hasResponse: filtered.filter(r => r.customerResponse).length,
      averageResponseTime: 0
    };

    filtered.forEach(r => {
      stats.byType[r.reminderType] = (stats.byType[r.reminderType] || 0) + 1;
      stats.byLevel[r.reminderLevel] = (stats.byLevel[r.reminderLevel] || 0) + 1;
      stats.byStatus[r.status] = (stats.byStatus[r.status] || 0) + 1;
      if (r.channel) {
        stats.byChannel[r.channel] = (stats.byChannel[r.channel] || 0) + 1;
      }
    });

    const withResponse = filtered.filter(r => r.responseDate);
    if (withResponse.length > 0) {
      const totalResponseTime = withResponse.reduce((sum, r) => {
        return sum + moment(r.responseDate).diff(moment(r.reminderDate), 'hours');
      }, 0);
      stats.averageResponseTime = Math.round(totalResponseTime / withResponse.length);
    }

    if (groupBy === 'day' || groupBy === 'week' || groupBy === 'month') {
      stats.trend = this.getReminderTrend(filtered, groupBy);
    }

    return stats;
  }

  getReminderTrend(records, groupBy = 'day') {
    const groups = {};
    
    records.forEach(r => {
      let key;
      const date = moment(r.reminderDate);
      
      switch (groupBy) {
        case 'day':
          key = date.format('YYYY-MM-DD');
          break;
        case 'week':
          key = date.format('YYYY-[W]WW');
          break;
        case 'month':
          key = date.format('YYYY-MM');
          break;
        default:
          key = date.format('YYYY-MM-DD');
      }

      if (!groups[key]) {
        groups[key] = { date: key, count: 0, byType: {} };
      }
      groups[key].count++;
      groups[key].byType[r.reminderType] = (groups[key].byType[r.reminderType] || 0) + 1;
    });

    return Object.values(groups).sort((a, b) => a.date.localeCompare(b.date));
  }

  updateReminderResponse(reminderId, response, responseDate = null) {
    const records = this.storageService.getReminderRecords();
    const index = records.findIndex(r => r.reminderId === reminderId);
    
    if (index < 0) {
      return { success: false, error: '催缴记录不存在' };
    }

    records[index].customerResponse = response;
    records[index].responseDate = responseDate || moment().format('YYYY-MM-DD HH:mm:ss');
    records[index].status = '已响应';
    records[index].updatedAt = moment().format('YYYY-MM-DD HH:mm:ss');
    
    this.storageService.saveReminderRecords(records);
    
    return {
      success: true,
      reminder: records[index]
    };
  }

  getReminderTemplates() {
    return {
      normal: {
        sms: '【保险公司】尊敬的{policyholder}，您的保单{policyNo}本期保费{premium}元应缴日为{dueDate}，请按时缴费。如有疑问请联系{agent}。',
        wechat: '温馨提醒：您的保单{policyNo}本期保费{premium}元应缴日为{dueDate}，请按时缴费以保障您的权益。',
        phone: '您好，这里是保险公司，关于您的保单{policyNo}续缴事宜...'
      },
      grace: {
        sms: '【保险公司】尊敬的{policyholder}，您的保单{policyNo}已进入宽限期，剩余{daysRemaining}天，请尽快缴费{premium}元，避免保单失效。',
        wechat: '重要提醒：您的保单{policyNo}目前处于宽限期内，剩余{daysRemaining}天，请及时缴费{premium}元。',
        phone: '您好，您的保单{policyNo}已进入宽限期，为避免影响您的保障，请尽快缴费。'
      },
      urgent: {
        sms: '【紧急提醒】尊敬的{policyholder}，您的保单{policyNo}宽限期仅剩{daysRemaining}天！请立即缴费{premium}元，否则保单将失效。',
        wechat: '⚠️ 紧急提醒：保单{policyNo}宽限期即将到期，仅剩{daysRemaining}天，请立即缴费{premium}元！',
        phone: '您好，紧急通知：您的保单{policyNo}宽限期即将到期，请立即缴费以避免保单失效。'
      },
      expired: {
        sms: '【保险公司】尊敬的{policyholder}，您的保单{policyNo}宽限期已满，保单已停效。如需复效请联系{agent}办理。',
        wechat: '保单状态提醒：您的保单{policyNo}宽限期已满，目前已停效。如需恢复保障，请联系我们办理复效手续。',
        phone: '您好，关于您的保单{policyNo}，目前宽限期已满，保单已停效，我们来和您沟通后续处理方案。'
      },
      advance: {
        sms: '【保险公司】尊敬的{policyholder}，您的保单{policyNo}本期保费已自动垫交{premium}元，请及时归还以避免利息累积。',
        wechat: '垫交提醒：您的保单{policyNo}本期保费已通过现金价值自动垫交，请及时还款，当前利息{interest}元。',
        phone: '您好，关于您的保单{policyNo}的自动垫交事宜，想和您沟通一下还款安排。'
      }
    };
  }

  generateReminderContent(templateType, reminderType, data) {
    const templates = this.getReminderTemplates();
    const template = templates[templateType]?.[reminderType];
    
    if (!template) {
      return '';
    }

    return template.replace(/\{(\w+)\}/g, (match, key) => {
      return data[key] !== undefined ? data[key] : match;
    });
  }

  clearDeduplicationCache() {
    this.deduplicationKeys.clear();
    this.loadExistingDeduplicationKeys();
  }
}

module.exports = ReminderService;

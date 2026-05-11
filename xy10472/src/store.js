const fs = require('fs');
const path = require('path');
const uuid = require('uuid');
const dayjs = require('dayjs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const MODEL_FILE = path.join(DATA_DIR, 'data-model.json');

class Store {
  constructor() {
    this.init();
  }

  init() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    
    if (!fs.existsSync(DATA_FILE)) {
      const modelData = JSON.parse(fs.readFileSync(MODEL_FILE, 'utf-8'));
      fs.writeFileSync(DATA_FILE, JSON.stringify(modelData, null, 2));
    }
  }

  getData() {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  }

  saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  }

  getActivities() {
    return this.getData().activities;
  }

  getActivityById(id) {
    return this.getData().activities.find(a => a.id === id);
  }

  createActivity(activity) {
    const data = this.getData();
    const newActivity = {
      id: uuid.v4(),
      name: activity.name,
      channelId: activity.channelId,
      dailyBudget: parseFloat(activity.dailyBudget),
      totalBudget: parseFloat(activity.totalBudget),
      currentDailySpend: 0,
      currentTotalSpend: 0,
      totalRefund: 0,
      status: 'active',
      warningThreshold: parseFloat(activity.warningThreshold) || 0.8,
      createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss')
    };
    data.activities.push(newActivity);
    this.saveData(data);
    return newActivity;
  }

  updateActivity(id, updates) {
    const data = this.getData();
    const index = data.activities.findIndex(a => a.id === id);
    if (index !== -1) {
      data.activities[index] = {
        ...data.activities[index],
        ...updates,
        updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss')
      };
      this.saveData(data);
      return data.activities[index];
    }
    return null;
  }

  deleteActivity(id) {
    const data = this.getData();
    data.activities = data.activities.filter(a => a.id !== id);
    this.saveData(data);
    return true;
  }

  getChannels() {
    return this.getData().channels;
  }

  getSpendRecords() {
    return this.getData().spendRecords;
  }

  getSpendRecordByExternalId(externalId) {
    return this.getData().spendRecords.find(r => r.externalId === externalId);
  }

  createSpendRecord(spend) {
    const data = this.getData();
    const newSpend = {
      id: uuid.v4(),
      externalId: spend.externalId || uuid.v4(),
      activityId: spend.activityId,
      channelId: spend.channelId,
      amount: parseFloat(spend.amount),
      date: spend.date || dayjs().format('YYYY-MM-DD'),
      description: spend.description || '',
      source: spend.source || 'manual',
      status: 'pending',
      createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss')
    };
    data.spendRecords.push(newSpend);
    this.saveData(data);
    return newSpend;
  }

  updateSpendRecord(id, updates) {
    const data = this.getData();
    const index = data.spendRecords.findIndex(r => r.id === id);
    if (index !== -1) {
      data.spendRecords[index] = {
        ...data.spendRecords[index],
        ...updates
      };
      this.saveData(data);
      return data.spendRecords[index];
    }
    return null;
  }

  getAdjustmentRequests() {
    return this.getData().adjustmentRequests;
  }

  createAdjustmentRequest(request) {
    const data = this.getData();
    const newRequest = {
      id: uuid.v4(),
      activityId: request.activityId,
      requestedBy: request.requestedBy || '投放团队',
      requestType: request.requestType,
      adjustmentType: request.adjustmentType,
      currentAmount: parseFloat(request.currentAmount),
      requestedAmount: parseFloat(request.requestedAmount),
      reason: request.reason,
      status: 'pending',
      createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss')
    };
    data.adjustmentRequests.push(newRequest);
    this.saveData(data);
    return newRequest;
  }

  updateAdjustmentRequest(id, updates) {
    const data = this.getData();
    const index = data.adjustmentRequests.findIndex(r => r.id === id);
    if (index !== -1) {
      data.adjustmentRequests[index] = {
        ...data.adjustmentRequests[index],
        ...updates,
        approvedAt: dayjs().format('YYYY-MM-DD HH:mm:ss')
      };
      this.saveData(data);
      return data.adjustmentRequests[index];
    }
    return null;
  }

  getRefunds() {
    return this.getData().refunds;
  }

  createRefund(refund) {
    const data = this.getData();
    const newRefund = {
      id: uuid.v4(),
      externalRefundId: refund.externalRefundId || uuid.v4(),
      activityId: refund.activityId,
      channelId: refund.channelId,
      relatedSpendId: refund.relatedSpendId || null,
      amount: parseFloat(refund.amount),
      date: refund.date || dayjs().format('YYYY-MM-DD'),
      reason: refund.reason || '',
      status: 'pending',
      createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss')
    };
    data.refunds.push(newRefund);
    this.saveData(data);
    return newRefund;
  }

  updateRefund(id, updates) {
    const data = this.getData();
    const index = data.refunds.findIndex(r => r.id === id);
    if (index !== -1) {
      data.refunds[index] = {
        ...data.refunds[index],
        ...updates,
        approvedAt: dayjs().format('YYYY-MM-DD HH:mm:ss')
      };
      this.saveData(data);
      return data.refunds[index];
    }
    return null;
  }

  getApprovalHistory() {
    return this.getData().approvalHistory;
  }

  addApprovalHistory(record) {
    const data = this.getData();
    const newHistory = {
      id: uuid.v4(),
      type: record.type,
      recordId: record.recordId,
      action: record.action,
      operator: record.operator || '系统',
      description: record.description,
      createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss')
    };
    data.approvalHistory.unshift(newHistory);
    this.saveData(data);
    return newHistory;
  }

  resetData() {
    const modelData = JSON.parse(fs.readFileSync(MODEL_FILE, 'utf-8'));
    fs.writeFileSync(DATA_FILE, JSON.stringify(modelData, null, 2));
    return true;
  }
}

module.exports = new Store();

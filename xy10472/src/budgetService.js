const store = require('./store');
const dayjs = require('dayjs');

class BudgetService {
  
  checkDuplicateSpend(externalId) {
    const existing = store.getSpendRecordByExternalId(externalId);
    return existing && existing.status === 'approved';
  }

  calculateAvailableBudget(activity, currentDailySpend, currentTotalSpend, totalRefund) {
    const effectiveDailyBudget = activity.dailyBudget;
    const effectiveTotalBudget = activity.totalBudget + totalRefund;
    
    return {
      daily: {
        budget: effectiveDailyBudget,
        spend: currentDailySpend,
        remaining: Math.max(0, effectiveDailyBudget - currentDailySpend),
        utilization: currentDailySpend / effectiveDailyBudget
      },
      total: {
        budget: effectiveTotalBudget,
        spend: currentTotalSpend,
        remaining: Math.max(0, effectiveTotalBudget - currentTotalSpend),
        utilization: currentTotalSpend / effectiveTotalBudget
      }
    };
  }

  checkBudgetOverflow(activity, newSpend) {
    const dailySpend = activity.currentDailySpend + newSpend;
    const totalSpend = activity.currentTotalSpend + newSpend;
    
    const isDailyOver = dailySpend > activity.dailyBudget;
    const isTotalOver = totalSpend > (activity.totalBudget + activity.totalRefund);
    const isWarning = totalSpend > (activity.totalBudget + activity.totalRefund) * activity.warningThreshold;
    
    return {
      dailyOver: isDailyOver,
      totalOver: isTotalOver,
      isWarning: isWarning && !isTotalOver,
      dailyOverAmount: Math.max(0, dailySpend - activity.dailyBudget),
      totalOverAmount: Math.max(0, totalSpend - (activity.totalBudget + activity.totalRefund))
    };
  }

  importSpend(spendData) {
    if (this.checkDuplicateSpend(spendData.externalId)) {
      return {
        success: false,
        code: 'DUPLICATE',
        message: '该消耗记录已存在，不会重复扣减',
        existingRecord: store.getSpendRecordByExternalId(spendData.externalId)
      };
    }

    const activity = store.getActivityById(spendData.activityId);
    if (!activity) {
      return {
        success: false,
        code: 'NOT_FOUND',
        message: '活动不存在'
      };
    }

    if (activity.status !== 'active') {
      return {
        success: false,
        code: 'INACTIVE',
        message: '活动已暂停或结束'
      };
    }

    const budgetCheck = this.checkBudgetOverflow(activity, parseFloat(spendData.amount));
    
    const newRecord = store.createSpendRecord(spendData);
    
    if (budgetCheck.totalOver) {
      store.updateSpendRecord(newRecord.id, {
        status: 'rejected',
        rejectReason: `超预算！超支金额：¥${budgetCheck.totalOverAmount.toFixed(2)}（日预算超支：¥${budgetCheck.dailyOverAmount.toFixed(2)}）`
      });
      
      store.addApprovalHistory({
        type: 'spend',
        recordId: newRecord.id,
        action: 'reject',
        operator: '系统',
        description: `消耗导入被拒绝：${activity.name} 超预算 ¥${budgetCheck.totalOverAmount.toFixed(2)}`
      });
      
      return {
        success: false,
        code: 'OVER_BUDGET',
        message: '消耗导入被拒绝：超预算',
        budgetCheck,
        record: newRecord
      };
    }

    store.updateSpendRecord(newRecord.id, {
      status: budgetCheck.isWarning ? 'warning' : 'approved'
    });

    const updatedActivity = store.updateActivity(spendData.activityId, {
      currentDailySpend: activity.currentDailySpend + parseFloat(spendData.amount),
      currentTotalSpend: activity.currentTotalSpend + parseFloat(spendData.amount)
    });

    store.addApprovalHistory({
      type: 'spend',
      recordId: newRecord.id,
      action: budgetCheck.isWarning ? 'approve_warning' : 'approve',
      operator: '系统',
      description: `消耗导入${budgetCheck.isWarning ? '(预警)' : ''}：${activity.name} +¥${spendData.amount}`
    });

    return {
      success: true,
      code: budgetCheck.isWarning ? 'APPROVED_WITH_WARNING' : 'APPROVED',
      message: budgetCheck.isWarning ? '消耗已导入，但接近预算上限' : '消耗已成功导入',
      budgetCheck,
      record: newRecord,
      updatedActivity
    };
  }

  requestAdjustment(activityId, adjustmentType, requestedAmount, reason) {
    const activity = store.getActivityById(activityId);
    if (!activity) {
      return {
        success: false,
        message: '活动不存在'
      };
    }

    const currentAmount = adjustmentType === 'daily' ? activity.dailyBudget : activity.totalBudget;
    if (requestedAmount <= 0) {
      return {
        success: false,
        message: '调整金额必须大于0'
      };
    }

    const request = store.createAdjustmentRequest({
      activityId,
      requestType: adjustmentType === 'daily' ? 'increase' : (requestedAmount > currentAmount ? 'increase' : 'decrease'),
      adjustmentType,
      currentAmount,
      requestedAmount,
      reason
    });

    store.addApprovalHistory({
      type: 'adjustment',
      recordId: request.id,
      action: 'create',
      operator: '投放团队',
      description: `申请${adjustmentType === 'daily' ? '日' : '总'}预算调整：¥${currentAmount} → ¥${requestedAmount}`
    });

    return {
      success: true,
      request
    };
  }

  approveAdjustment(requestId, approved) {
    const request = store.getAdjustmentRequests().find(r => r.id === requestId);
    if (!request) {
      return {
        success: false,
        message: '申请不存在'
      };
    }

    if (request.status !== 'pending') {
      return {
        success: false,
        message: '申请已处理'
      };
    }

    if (approved) {
      const activity = store.getActivityById(request.activityId);
      const updates = {};
      
      if (request.adjustmentType === 'daily') {
        updates.dailyBudget = request.requestedAmount;
      } else {
        updates.totalBudget = request.requestedAmount;
      }

      store.updateActivity(request.activityId, updates);

      store.updateAdjustmentRequest(requestId, {
        status: 'approved'
      });

      store.addApprovalHistory({
        type: 'adjustment',
        recordId: requestId,
        action: 'approve',
        operator: '审批人',
        description: `预算调整已通过：${request.adjustmentType === 'daily' ? '日' : '总'}预算 ¥${request.currentAmount} → ¥${request.requestedAmount}`
      });

      return {
        success: true,
        message: '审批通过',
        request: { ...request, status: 'approved' }
      };
    } else {
      store.updateAdjustmentRequest(requestId, {
        status: 'rejected'
      });

      store.addApprovalHistory({
        type: 'adjustment',
        recordId: requestId,
        action: 'reject',
        operator: '审批人',
        description: `预算调整被拒绝：申请金额 ¥${request.requestedAmount}`
      });

      return {
        success: true,
        message: '已拒绝',
        request: { ...request, status: 'rejected' }
      };
    }
  }

  processRefund(refundData) {
    const activity = store.getActivityById(refundData.activityId);
    if (!activity) {
      return {
        success: false,
        message: '活动不存在'
      };
    }

    const refund = store.createRefund(refundData);
    
    store.updateRefund(refund.id, {
      status: 'approved'
    });

    const updatedActivity = store.updateActivity(refundData.activityId, {
      totalRefund: activity.totalRefund + parseFloat(refundData.amount)
    });

    store.addApprovalHistory({
      type: 'refund',
      recordId: refund.id,
      action: 'approve',
      operator: '系统',
      description: `退款回写：${activity.name} +¥${refundData.amount}`
    });

    return {
      success: true,
      message: '退款已回写，预算已回补',
      refund,
      updatedActivity
    };
  }

  getDashboardData() {
    const activities = store.getActivities();
    const channels = store.getChannels();
    const spendRecords = store.getSpendRecords();
    const adjustmentRequests = store.getAdjustmentRequests();
    const refunds = store.getRefunds();
    const approvalHistory = store.getApprovalHistory();

    let totalBudget = 0;
    let totalSpend = 0;
    let totalRefund = 0;
    const riskyActivities = [];

    activities.forEach(activity => {
      totalBudget += activity.totalBudget;
      totalSpend += activity.currentTotalSpend;
      totalRefund += activity.totalRefund;

      const budget = this.calculateAvailableBudget(
        activity,
        activity.currentDailySpend,
        activity.currentTotalSpend,
        activity.totalRefund
      );

      if (budget.total.over || budget.total.utilization > activity.warningThreshold) {
        riskyActivities.push({
          ...activity,
          channel: channels.find(c => c.id === activity.channelId),
          budgetSummary: budget,
          riskLevel: budget.total.over ? 'critical' : 'warning'
        });
      }
    });

    riskyActivities.sort((a, b) => {
      if (a.riskLevel === b.riskLevel) {
        return b.budgetSummary.total.utilization - a.budgetSummary.total.utilization;
      }
      return a.riskLevel === 'critical' ? -1 : 1;
    });

    const overSpendActivities = riskyActivities.filter(a => a.riskLevel === 'critical');

    const overSpendActivitiesWithImport = overSpendActivities.map(activity => {
      const relatedSpends = spendRecords.filter(
        s => s.activityId === activity.id && (s.status === 'approved' || s.status === 'warning' || s.status === 'rejected')
      );
      
      const importCausingOver = spendRecords.find(
        s => s.activityId === activity.id && s.status === 'rejected'
      );

      return {
        ...activity,
        relatedSpends,
        importCausingOver
      };
    });

    return {
      summary: {
        totalBudget,
        totalSpend,
        totalRefund,
        remainingBudget: Math.max(0, totalBudget + totalRefund - totalSpend),
        utilizationRate: ((totalSpend / (totalBudget + totalRefund)) * 100).toFixed(2)
      },
      riskyActivities,
      overSpendActivities: overSpendActivitiesWithImport,
      pendingRequests: adjustmentRequests.filter(r => r.status === 'pending'),
      recentApproval: approvalHistory.slice(0, 10),
      activities: activities.map(a => ({
        ...a,
        channel: channels.find(c => c.id === a.channelId),
        budgetSummary: this.calculateAvailableBudget(
          a,
          a.currentDailySpend,
          a.currentTotalSpend,
          a.totalRefund
        )
      })),
      channels,
      spendRecords,
      refunds
    };
  }

  exportSpendReconciliation() {
    const dashboard = this.getDashboardData();
    const today = dayjs().format('YYYY-MM-DD');
    
    const headers = [
      '活动名称', '渠道', '日期', '消耗金额', '预算类型', '预算金额', 
      '实际消耗', '剩余预算', '预算使用率', '状态', '导入来源'
    ];

    const rows = dashboard.spendRecords.map(record => {
      const activity = dashboard.activities.find(a => a.id === record.activityId);
      return [
        activity?.name || '未知活动',
        dashboard.channels.find(c => c.id === record.channelId)?.name || '未知渠道',
        record.date,
        record.amount.toFixed(2),
        activity?.adjustmentType === 'daily' ? '日预算' : '总预算',
        activity?.totalBudget.toFixed(2) || '0',
        activity?.currentTotalSpend.toFixed(2) || '0',
        activity ? (activity.totalBudget + activity.totalRefund - activity.currentTotalSpend).toFixed(2) : '0',
        activity ? `${((activity.currentTotalSpend / (activity.totalBudget + activity.totalRefund)) * 100).toFixed(2)}%` : '0%',
        this.getStatusText(record.status),
        record.source
      ];
    });

    return {
      headers,
      rows,
      generatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      reportDate: today
    };
  }

  getStatusText(status) {
    const statusMap = {
      'approved': '已通过',
      'warning': '已通过(预警)',
      'rejected': '已拒绝',
      'pending': '待处理'
    };
    return statusMap[status] || status;
  }
}

module.exports = new BudgetService();

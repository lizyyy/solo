const store = require('../models/store');
const { WORKFLOW_STATUS, HEALTH_LEVEL } = require('../models/factory');

class ReportService {
  generateDashboard() {
    const workflows = store.getRenewalWorkflows();
    const customers = store.getCustomers();
    
    const statusCounts = {};
    Object.values(WORKFLOW_STATUS).forEach(status => {
      statusCounts[status] = 0;
    });
    
    workflows.forEach(w => {
      statusCounts[w.status] = (statusCounts[w.status] || 0) + 1;
    });

    const atRiskWorkflows = workflows.filter(w => 
      w.status === WORKFLOW_STATUS.AT_RISK || 
      w.status === WORKFLOW_STATUS.BLOCKED
    );

    const riskSummary = atRiskWorkflows.map(w => ({
      workflowId: w.id,
      customerName: w.data.customerProfile?.name || '未知客户',
      customerId: w.customerId,
      status: w.status,
      riskFlags: w.riskFlags,
      alerts: w.alerts,
      updatedAt: w.updatedAt
    }));

    const completedCount = statusCounts[WORKFLOW_STATUS.COMPLETED];
    const totalCount = workflows.length;
    const successRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    return {
      summary: {
        totalWorkflows: totalCount,
        statusCounts,
        successRate,
        atRiskCount: atRiskWorkflows.length,
        blockedCount: statusCounts[WORKFLOW_STATUS.BLOCKED] || 0,
        inProgressCount: totalCount - completedCount - (statusCounts[WORKFLOW_STATUS.FAILED] || 0)
      },
      atRiskWorkflows: riskSummary,
      recentWorkflows: workflows
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .slice(0, 10)
        .map(w => ({
          workflowId: w.id,
          customerName: w.data.customerProfile?.name || '未知客户',
          status: w.status,
          riskFlags: w.riskFlags.length,
          updatedAt: w.updatedAt
        }))
    };
  }

  generateRenewalReport(workflowId) {
    const workflow = store.getRenewalWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const history = store.getHistory('renewal', workflowId);
    const customer = workflow.data.customerProfile;
    const healthScore = workflow.data.healthScore;
    const openTickets = workflow.data.openTickets || [];
    const quotes = store.getQuotes(workflow.customerId)
      .filter(q => q.workflowId === workflowId)
      .sort((a, b) => b.version - a.version);

    const usageMetrics = workflow.data.usageMetrics || [];

    const riskReasons = this._extractRiskReasons(workflow, healthScore, openTickets);

    return {
      reportType: 'renewal_summary',
      generatedAt: new Date().toISOString(),
      workflow: {
        id: workflow.id,
        status: workflow.status,
        assignee: workflow.assignee,
        createdAt: workflow.createdAt,
        updatedAt: workflow.updatedAt,
        completedAt: workflow.completedAt
      },
      customer: {
        id: customer?.id,
        name: customer?.name,
        email: customer?.email,
        industry: customer?.industry,
        tier: customer?.tier,
        currentContract: customer?.currentContract
      },
      healthAssessment: {
        score: healthScore?.score,
        level: healthScore?.level,
        factors: healthScore?.factors || [],
        risks: healthScore?.risks || []
      },
      usageMetrics: usageMetrics.map(m => ({
        productId: m.productId,
        trend: m.trend,
        change: m.comparedToLastPeriod,
        usage: m.usage
      })),
      tickets: {
        openCount: openTickets.length,
        criticalCount: openTickets.filter(t => t.priority === 'critical' || t.severity === 'severe').length,
        slaBreached: openTickets.filter(t => t.slaBreached).length,
        tickets: openTickets
      },
      quotes: {
        latestVersion: quotes.length > 0 ? quotes[0].version : 0,
        history: quotes.map(q => ({
          version: q.version,
          baseTotal: q.baseTotal,
          discountPercent: q.discountPercent,
          discountAmount: q.discountAmount,
          finalTotal: q.finalTotal,
          status: q.status,
          approvalRequired: q.approvalRequired,
          createdAt: q.createdAt
        }))
      },
      riskAnalysis: {
        hasRisks: riskReasons.length > 0,
        reasons: riskReasons,
        canMarkGreen: workflow.status !== WORKFLOW_STATUS.BLOCKED && 
          !riskReasons.some(r => r.severity === 'critical')
      },
      timeline: history.map(h => ({
        timestamp: h.timestamp,
        action: h.action,
        operator: h.operator,
        reason: h.reason,
        previousState: h.previousState,
        newState: h.newState,
        changes: h.changes
      }))
    };
  }

  generateCustomerCommunicationReport(workflowId) {
    const report = this.generateRenewalReport(workflowId);
    
    const talkingPoints = this._generateTalkingPoints(report);
    const objections = this._prepareObjectionResponses(report);
    const recommendedActions = this._generateRecommendedActions(report);

    return {
      ...report,
      reportType: 'customer_communication',
      communication: {
        talkingPoints,
        objectionResponses: objections,
        recommendedActions,
        closingSuggestion: this._generateClosingSuggestion(report)
      }
    };
  }

  exportToJSON(report) {
    return JSON.stringify(report, null, 2);
  }

  exportToCSV(report) {
    if (report.reportType === 'renewal_summary') {
      return this._renewalReportToCSV(report);
    } else if (report.reportType === 'customer_communication') {
      return this._communicationReportToCSV(report);
    } else if (report.summary) {
      return this._dashboardToCSV(report);
    }
    return this._genericToCSV(report);
  }

  _extractRiskReasons(workflow, healthScore, openTickets) {
    const reasons = [];

    if (healthScore) {
      if (healthScore.level === HEALTH_LEVEL.CRITICAL) {
        reasons.push({
          type: 'health_score',
          severity: 'critical',
          message: `健康分极低 (${healthScore.score}分)，客户流失风险极高`,
          action: '立即安排客户会议，了解问题并制定挽回方案'
        });
      } else if (healthScore.level === HEALTH_LEVEL.POOR) {
        reasons.push({
          type: 'health_score',
          severity: 'high',
          message: `健康分较低 (${healthScore.score}分)，需要关注`,
          action: '在沟通中了解客户使用中的问题'
        });
      }
    }

    const criticalTickets = openTickets.filter(t => 
      t.priority === 'critical' || t.priority === 'high' || 
      t.severity === 'severe' || t.severity === 'major'
    );

    if (criticalTickets.length > 0) {
      reasons.push({
        type: 'open_tickets',
        severity: 'high',
        message: `存在 ${criticalTickets.length} 个重大未结工单`,
        action: '在沟通前先确认工单处理进度，或与客户确认接受度'
      });
    }

    const slaBreached = openTickets.filter(t => t.slaBreached);
    if (slaBreached.length > 0) {
      reasons.push({
        type: 'sla_breach',
        severity: 'high',
        message: `${slaBreached.length} 个工单已超出 SLA`,
        action: '准备好解释和补救方案'
      });
    }

    return reasons;
  }

  _generateTalkingPoints(report) {
    const points = [];

    if (report.healthAssessment.score >= 70) {
      points.push({
        category: 'positive',
        point: `贵公司健康分为 ${report.healthAssessment.score} 分，使用情况良好`,
        detail: '这说明我们的产品为您的业务提供了稳定的价值'
      });
    }

    const usageGrowing = report.usageMetrics.filter(m => m.trend === 'growing');
    if (usageGrowing.length > 0) {
      points.push({
        category: 'positive',
        point: `注意到贵公司 ${usageGrowing.length} 个产品的使用量在增长`,
        detail: '这是产品价值被认可的很好信号'
      });
    }

    if (report.customer?.currentContract) {
      points.push({
        category: 'logistics',
        point: `当前合同将于 ${report.customer.currentContract.endDate} 到期`,
        detail: '我们可以提前讨论续约事宜，确保服务无缝衔接'
      });
    }

    if (report.quotes.latestVersion > 0) {
      const latest = report.quotes.history[0];
      points.push({
        category: 'proposal',
        point: `根据您的使用情况，我们准备了续约报价`,
        detail: `报价金额 ¥${latest.finalTotal.toLocaleString()}，${latest.discountPercent > 0 ? `包含 ${latest.discountPercent}% 折扣` : '标准定价'}`
      });
    }

    return points;
  }

  _prepareObjectionResponses(report) {
    const responses = [];

    responses.push({
      objection: '价格太高',
      response: '我理解价格是重要考量因素。我们的定价是基于为您创造的价值设定的。让我详细说明一下续约后您将获得的持续价值...',
      alternatives: '如果预算有压力，我们也可以讨论分阶段方案或调整产品组合'
    });

    responses.push({
      objection: '使用量下降，不需要全部功能',
      response: '感谢您的坦诚。让我们一起看看哪些功能对您最有价值，我可以为您定制更符合当前需求的方案...',
      alternatives: '我们也可以讨论降级方案，确保您只为需要的功能付费'
    });

    responses.push({
      objection: '还有一些问题没解决',
      response: '我完全理解，问题解决是续约的基础。让我现在就带您过一下这些工单的最新状态，以及我们为解决它们制定的计划...',
      alternatives: '我们可以安排与技术团队的专门会议来深入讨论'
    });

    return responses;
  }

  _generateRecommendedActions(report) {
    const actions = [];

    if (report.riskAnalysis.hasRisks) {
      report.riskAnalysis.reasons.forEach(r => {
        actions.push({
          priority: r.severity === 'critical' ? 'urgent' : 'high',
          action: r.message,
          recommendation: r.action
        });
      });
    }

    if (report.workflow.status === 'ready_for_csm') {
      actions.push({
        priority: 'high',
        action: '安排客户续约沟通',
        recommendation: '使用本报告中的沟通要点，与客户确认续约意向'
      });
    }

    if (report.quotes.history.length > 0) {
      const latest = report.quotes.history[0];
      if (latest.status === 'pending_approval') {
        actions.push({
          priority: 'medium',
          action: '等待折扣审批',
          recommendation: `需要 ${report.customer?.tier === 'standard' ? '团队负责人' : '经理'} 级别审批`
        });
      }
    }

    return actions;
  }

  _generateClosingSuggestion(report) {
    if (report.riskAnalysis.hasRisks) {
      return '建议先解决列出的风险问题，再推进正式续约流程。客户成功经理应提前介入，了解客户顾虑。';
    }

    if (report.healthAssessment.score >= 80) {
      return '客户状态良好，可以推进续约。建议强调产品价值和持续服务，争取顺利续约。';
    }

    return '建议在沟通中重点关注产品价值展示，了解客户未来一年的业务规划，寻找新的合作机会。';
  }

  _renewalReportToCSV(report) {
    let csv = '类别,项目,值,详情\n';
    
    csv += `客户,客户名称,${report.customer?.name || ''},${report.customer?.industry || ''}\n`;
    csv += `客户,客户级别,${report.customer?.tier || ''},\n`;
    csv += `客户,合同到期日,${report.customer?.currentContract?.endDate || ''},\n`;
    csv += `客户,当前年价值,${report.customer?.currentContract?.annualValue || 0},\n`;
    
    csv += `健康,健康分,${report.healthAssessment?.score || 'N/A'},${report.healthAssessment?.level || ''}\n`;
    
    csv += `工单,未结工单,${report.tickets?.openCount || 0},关键:${report.tickets?.criticalCount || 0}\n`;
    csv += `工单,SLA超时,${report.tickets?.slaBreached || 0},\n`;
    
    csv += `报价,最新版本,${report.quotes?.latestVersion || 0},\n`;
    if (report.quotes?.history?.length > 0) {
      const latest = report.quotes.history[0];
      csv += `报价,报价金额,${latest.finalTotal || 0},折扣:${latest.discountPercent || 0}%\n`;
      csv += `报价,报价状态,${latest.status || ''},\n`;
    }
    
    csv += `风险,风险数量,${report.riskAnalysis?.reasons?.length || 0},\n`;
    report.riskAnalysis?.reasons?.forEach((r, i) => {
      csv += `风险,风险${i + 1},${r.message},${r.action}\n`;
    });
    
    csv += `流程,状态,${report.workflow?.status || ''},\n`;
    csv += `流程,创建时间,${report.workflow?.createdAt || ''},\n`;
    csv += `流程,更新时间,${report.workflow?.updatedAt || ''},\n`;
    
    return csv;
  }

  _communicationReportToCSV(report) {
    let csv = this._renewalReportToCSV(report);
    csv += '\n\n沟通要点\n';
    csv += '类别,要点,详情\n';
    
    report.communication?.talkingPoints?.forEach(p => {
      csv += `${p.category},"${p.point}","${p.detail}"\n`;
    });
    
    return csv;
  }

  _dashboardToCSV(report) {
    let csv = '指标,值\n';
    
    csv += `总流程数,${report.summary.totalWorkflows}\n`;
    csv += `成功率,${report.summary.successRate}%\n`;
    csv += `进行中,${report.summary.inProgressCount}\n`;
    csv += `已完成,${report.summary.statusCounts.completed || 0}\n`;
    csv += `风险中,${report.summary.atRiskCount}\n`;
    csv += `阻塞中,${report.summary.blockedCount}\n`;
    csv += `已失败,${report.summary.statusCounts.failed || 0}\n`;
    
    return csv;
  }

  _genericToCSV(data) {
    return JSON.stringify(data, null, 2);
  }
}

module.exports = new ReportService();

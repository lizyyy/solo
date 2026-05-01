const moment = require('moment');
const { Op } = require('sequelize');
const Issue = require('../models/Issue');

const RULES = {
  OVERDUE_SOON_HOURS: 2,
};

class RuleEngine {
  static isOverdueSoon(deadline) {
    const now = moment();
    const deadlineMoment = moment(deadline);
    const diffHours = deadlineMoment.diff(now, 'hours', true);
    return diffHours > 0 && diffHours <= RULES.OVERDUE_SOON_HOURS;
  }

  static isOverdue(deadline) {
    const now = moment();
    return moment(deadline).isBefore(now);
  }

  static isHighRisk(riskLevel) {
    return riskLevel === '高' || riskLevel === '紧急';
  }

  static enhanceIssue(issue) {
    const issueData = issue.toJSON ? issue.toJSON() : { ...issue };
    
    return {
      ...issueData,
      isOverdueSoon: this.isOverdueSoon(issueData.deadline) && issueData.status !== '已关闭',
      isOverdue: this.isOverdue(issueData.deadline) && issueData.status !== '已关闭',
      isHighRisk: this.isHighRisk(issueData.riskLevel),
    };
  }

  static async getRiskSummary() {
    const now = moment();
    const overdueSoonThreshold = now.clone().add(RULES.OVERDUE_SOON_HOURS, 'hours');

    const [
      totalIssues,
      overdueSoonCount,
      highRiskUnresolved,
      pendingReview,
      closed,
    ] = await Promise.all([
      Issue.count(),
      Issue.count({
        where: {
          deadline: { [Op.between]: [now.toDate(), overdueSoonThreshold.toDate()] },
          status: { [Op.ne]: '已关闭' },
        },
      }),
      Issue.count({
        where: {
          riskLevel: { [Op.in]: ['高', '紧急'] },
          status: { [Op.in]: ['待处理', '处理中'] },
        },
      }),
      Issue.count({
        where: { status: '待复盘' },
      }),
      Issue.count({
        where: { status: '已关闭' },
      }),
    ]);

    return {
      total: totalIssues,
      overdueSoon: overdueSoonCount,
      highRiskUnresolved: highRiskUnresolved,
      pendingReview: pendingReview,
      closed: closed,
      open: totalIssues - closed,
    };
  }

  static async getGroupedIssues(filters = {}) {
    const allIssues = await this.getFilteredIssues(filters);
    const enhancedIssues = allIssues.map((issue) => this.enhanceIssue(issue));

    const groups = {
      overdueSoon: [],
      highRiskUnresolved: [],
      pendingReview: [],
      closed: [],
    };

    const riskPriority = { '紧急': 0, '高': 1, '中': 2, '低': 3 };
    const sortByPriority = (a, b) => {
      if (riskPriority[a.riskLevel] !== riskPriority[b.riskLevel]) {
        return riskPriority[a.riskLevel] - riskPriority[b.riskLevel];
      }
      return new Date(a.deadline) - new Date(b.deadline);
    };

    enhancedIssues.forEach((issue) => {
      if (issue.status === '已关闭') {
        groups.closed.push(issue);
      } else if (issue.status === '待复盘') {
        groups.pendingReview.push(issue);
      } else if (issue.isOverdueSoon) {
        groups.overdueSoon.push(issue);
      } else if (issue.isHighRisk) {
        groups.highRiskUnresolved.push(issue);
      } else if (!groups.highRiskUnresolved.some(i => i.id === issue.id) && 
                 !groups.overdueSoon.some(i => i.id === issue.id)) {
        if (issue.isHighRisk) {
          groups.highRiskUnresolved.push(issue);
        } else {
          groups.highRiskUnresolved.push(issue);
        }
      }
    });

    const seenInOverdueSoon = new Set(groups.overdueSoon.map(i => i.id));
    groups.highRiskUnresolved = enhancedIssues.filter(
      (i) => i.isHighRisk && 
             i.status !== '已关闭' && 
             i.status !== '待复盘' &&
             !seenInOverdueSoon.has(i.id)
    );

    const otherOpen = enhancedIssues.filter(
      (i) => i.status !== '已关闭' && 
             i.status !== '待复盘' &&
             !groups.overdueSoon.some(o => o.id === i.id) &&
             !groups.highRiskUnresolved.some(h => h.id === i.id)
    );
    groups.highRiskUnresolved = [...groups.highRiskUnresolved, ...otherOpen];

    groups.overdueSoon.sort(sortByPriority);
    groups.highRiskUnresolved.sort(sortByPriority);
    groups.pendingReview.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
    groups.closed.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    return groups;
  }

  static async getFilteredIssues(filters = {}) {
    const where = {};

    if (filters.shift) {
      where.shift = filters.shift;
    }
    if (filters.assignee) {
      where.assignee = filters.assignee;
    }
    if (filters.riskLevel) {
      where.riskLevel = filters.riskLevel;
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.tag) {
      where.tags = { [Op.like]: `%"${filters.tag}"%` };
    }

    return await Issue.findAll({
      where,
      order: [['createdAt', 'DESC']],
    });
  }
}

module.exports = RuleEngine;

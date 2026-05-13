const { SatisfactionTrend, ReturnVisitSurvey, RemedyTask, sequelize } = require('../models');
const dayjs = require('dayjs');
const { Op } = require('sequelize');

class TrendService {
  static async calculateTrend(periodType = 'daily', startDate, endDate) {
    const periods = this.generatePeriods(periodType, startDate, endDate);
    const results = [];

    for (const period of periods) {
      const periodStart = period.start;
      const periodEnd = period.end;

      const surveys = await ReturnVisitSurvey.findAll({
        where: {
          surveyTime: { [Op.between]: [periodStart, periodEnd] }
        }
      });

      const totalSurveys = surveys.length;
      const lowScoreCount = surveys.filter(s => s.isLowScore).length;
      const lowScoreRate = totalSurveys > 0 ? ((lowScoreCount / totalSurveys) * 100).toFixed(2) : 0;
      const avgScore = totalSurveys > 0 
        ? (surveys.reduce((sum, s) => sum + s.score, 0) / totalSurveys).toFixed(2) 
        : 0;

      const completedTasks = await RemedyTask.count({
        where: {
          status: 'completed',
          completedTime: { [Op.between]: [periodStart, periodEnd] }
        }
      });

      const successTasks = await RemedyTask.count({
        where: {
          status: 'completed',
          completedTime: { [Op.between]: [periodStart, periodEnd] },
          remedyResult: { [Op.like]: '%成功%' }
        }
      });

      const successRate = completedTasks > 0 ? ((successTasks / completedTasks) * 100).toFixed(2) : 0;

      const trend = await SatisfactionTrend.findOne({
        where: { period: period.period, periodType }
      });

      const data = {
        period: period.period,
        periodType,
        totalSurveys,
        lowScoreCount,
        lowScoreRate,
        avgScore,
        remedyCompletedCount: completedTasks,
        remedySuccessCount: successTasks,
        remedySuccessRate: successRate
      };

      if (trend) {
        await trend.update(data);
        results.push(trend);
      } else {
        results.push(await SatisfactionTrend.create(data));
      }
    }

    return results;
  }

  static generatePeriods(periodType, startDate, endDate) {
    const periods = [];
    let current = dayjs(startDate);
    const end = dayjs(endDate);

    while (current.isBefore(end) || current.isSame(end, 'day')) {
      if (periodType === 'daily') {
        periods.push({
          period: current.format('YYYY-MM-DD'),
          start: current.startOf('day').toDate(),
          end: current.endOf('day').toDate()
        });
        current = current.add(1, 'day');
      } else {
        periods.push({
          period: current.format('YYYY-MM'),
          start: current.startOf('month').toDate(),
          end: current.endOf('month').toDate()
        });
        current = current.add(1, 'month');
      }
    }

    return periods;
  }

  static async getTrends(params = {}) {
    const { periodType = 'daily', startDate, endDate, departmentId } = params;
    const where = { periodType };

    if (startDate && endDate) {
      where.period = { [Op.between]: [startDate, endDate] };
    }
    if (departmentId) {
      where.departmentId = departmentId;
    }

    return await SatisfactionTrend.findAll({
      where,
      order: [['period', 'ASC']]
    });
  }

  static async getStatistics() {
    const today = dayjs();
    const thisMonth = today.format('YYYY-MM');
    const lastMonth = today.subtract(1, 'month').format('YYYY-MM');

    const [thisMonthData, lastMonthData] = await Promise.all([
      SatisfactionTrend.findOne({ where: { period: thisMonth, periodType: 'monthly' } }),
      SatisfactionTrend.findOne({ where: { period: lastMonth, periodType: 'monthly' } })
    ]);

    const pendingTasks = await RemedyTask.count({
      where: { status: { [Op.in]: ['pending', 'assigned', 'processing'] } }
    });

    return {
      thisMonth: thisMonthData?.toJSON() || null,
      lastMonth: lastMonthData?.toJSON() || null,
      pendingTasks
    };
  }
}

module.exports = TrendService;

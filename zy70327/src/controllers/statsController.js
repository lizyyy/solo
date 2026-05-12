const statsRepository = require('../repositories/statsRepository');
const archiveRepository = require('../repositories/archiveRepository');

class StatsController {
  async getWeeklyStats(req, res) {
    try {
      const weeklyStats = await statsRepository.getWeeklyStats();
      const categoryStats = await statsRepository.getCategoryStats();
      const statusStats = await statsRepository.getStatusStats();

      res.json({
        success: true,
        data: {
          weekly_new: parseInt(weeklyStats.new_count),
          weekly_recurrence: parseInt(weeklyStats.recurrence_count),
          category_stats: categoryStats,
          status_stats: statusStats,
        },
      });
    } catch (error) {
      console.error('获取周统计失败:', error);
      res.status(500).json({
        error: '获取周统计失败',
        message: error.message,
      });
    }
  }

  async getTrendReport(req, res) {
    try {
      const { days = 7 } = req.query;
      const trend = await statsRepository.getTrendReport(parseInt(days));
      const topAPIs = await statsRepository.getTopSlowAPIs(10);

      res.json({
        success: true,
        data: {
          period: `${days}天`,
          trend: trend.map(item => ({
            date: item.date,
            new_archives: parseInt(item.new_archives),
          })),
          top_slow_apis: topAPIs,
        },
      });
    } catch (error) {
      console.error('获取趋势报告失败:', error);
      res.status(500).json({
        error: '获取趋势报告失败',
        message: error.message,
      });
    }
  }

  async getDashboard(req, res) {
    try {
      const [weeklyStats, categoryStats, statusStats, topAPIs, allArchives] = await Promise.all([
        statsRepository.getWeeklyStats(),
        statsRepository.getCategoryStats(),
        statsRepository.getStatusStats(),
        statsRepository.getTopSlowAPIs(5),
        archiveRepository.findAll({}),
      ]);

      const pendingArchives = allArchives.filter(a => a.status === 'pending').length;
      const processingArchives = allArchives.filter(a => a.status === 'processing').length;
      const resolvedArchives = allArchives.filter(a => a.status === 'resolved').length;
      const falsePositiveArchives = allArchives.filter(a => a.status === 'false_positive').length;

      const avgOccurrences = allArchives.length > 0 
        ? allArchives.reduce((sum, a) => sum + a.occurrence_count, 0) / allArchives.length 
        : 0;

      res.json({
        success: true,
        data: {
          summary: {
            total_archives: allArchives.length,
            pending: pendingArchives,
            processing: processingArchives,
            resolved: resolvedArchives,
            false_positive: falsePositiveArchives,
            avg_occurrences: avgOccurrences.toFixed(2),
          },
          weekly: {
            new: parseInt(weeklyStats.new_count),
            recurrence: parseInt(weeklyStats.recurrence_count),
          },
          top_apis: topAPIs,
          category_distribution: categoryStats,
          status_distribution: statusStats,
        },
      });
    } catch (error) {
      console.error('获取仪表盘数据失败:', error);
      res.status(500).json({
        error: '获取仪表盘数据失败',
        message: error.message,
      });
    }
  }
}

module.exports = new StatsController();

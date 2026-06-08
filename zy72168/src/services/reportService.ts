import type { Report, CrossPeriodData, Point, Feedback, PlanVersion } from '@/types';
import { mockReport } from '@/mocks/reports';
import { getStatusText } from '@/utils/export';

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface ReportInput {
  points: Point[];
  feedbacks: Feedback[];
  plans: PlanVersion[];
}

export const reportService = {
  async generateReport(
    input: ReportInput,
    timeRange?: { start: string; end: string },
  ): Promise<Report> {
    await delay(800);
    const { points, feedbacks, plans } = input;
    const completedPoints = points.filter(
      (p) => p.status === 'completed' || p.status === 'verified',
    );
    const pendingPoints = points.filter(
      (p) => p.status === 'pending' || p.status === 'processing',
    );
    const reviewPoints = points.filter((p) => p.status === 'review');
    const getLatestFeedback = (pointId: string) => {
      const related = feedbacks.filter((f) => f.pointId === pointId);
      if (related.length === 0) return '暂无反馈';
      const latest = [...related].sort(
        (a, b) =>
          new Date(b.reportTime).getTime() - new Date(a.reportTime).getTime(),
      )[0];
      return `${latest.title || '（无标题）'} - ${getStatusText(latest.status)}`;
    };
    const getLatestPlan = (pointId: string) => {
      const related = plans.filter((p) => p.pointIds.includes(pointId));
      if (related.length === 0) return '暂无方案';
      const latest = [...related].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )[0];
      return `绕行方案${latest.version} - ${latest.isActive ? '已生效' : '待确认'}`;
    };
    const makeSection = (
      title: string,
      status: 'completed' | 'pending' | 'review',
      items: Point[],
    ) => ({
      title,
      status,
      count: items.length,
      items: items.map((p) => ({
        id: p.id,
        pointName: p.name,
        address: p.address,
        status: p.status,
        latestFeedback: getLatestFeedback(p.id),
        latestPlan: getLatestPlan(p.id),
      })),
    });
    return {
      ...mockReport,
      id: `report-${Date.now()}`,
      generatedAt: new Date().toISOString(),
      timeRange: timeRange || mockReport.timeRange,
      statistics: {
        totalPoints: points.length,
        completedPoints: completedPoints.length,
        pendingPoints: pendingPoints.length,
        reviewPoints: reviewPoints.length,
        totalFeedbacks: feedbacks.length,
        resolvedFeedbacks: feedbacks.filter((f) => f.status === 'resolved').length,
        conflictFeedbacks: feedbacks.filter((f) => f.hasConflict).length,
      },
      sections: {
        completed: makeSection('已处理点位', 'completed', completedPoints),
        pending: makeSection('待核实点位', 'pending', pendingPoints),
        review: makeSection('需要现场复看点位', 'review', reviewPoints),
      },
    };
  },

  async getCrossPeriodStats(input: ReportInput): Promise<CrossPeriodData[]> {
    await delay(300);
    const { points, feedbacks } = input;
    const periodLabels: Record<string, string> = {
      morning: '早高峰(7:00-9:00)',
      daytime: '日间(9:00-17:00)',
      evening: '晚高峰(17:00-19:00)',
      night: '夜间(19:00-7:00)',
    };
    const periods = ['morning', 'daytime', 'evening', 'night'] as const;
    return periods.map((period) => {
      const periodPoints = points.filter((p) =>
        p.timePeriods.includes(period),
      );
      const periodFeedbacks = feedbacks.filter((f) => {
        if (!f.timePeriod) return false;
        return f.timePeriod === period;
      });
      const completedInPeriod = periodPoints.filter(
        (p) =>
          p.status === 'completed' || p.status === 'verified',
      );
      return {
        period,
        periodLabel: periodLabels[period],
        pointCount: periodPoints.length,
        feedbackCount: periodFeedbacks.length,
        completedRate:
          periodPoints.length > 0
            ? Math.round(
                (completedInPeriod.length / periodPoints.length) * 100,
              )
            : 0,
      };
    });
  },
};

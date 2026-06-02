import type { Report, CrossPeriodData } from '@/types';
import { mockReport, mockCrossPeriodData } from '@/mocks/reports';
import { mockPoints } from '@/mocks/points';
import { mockFeedbacks } from '@/mocks/feedbacks';
import { mockPlans } from '@/mocks/plans';
import { getStatusText } from '@/utils/export';

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const reportService = {
  async generateReport(timeRange?: { start: string; end: string }): Promise<Report> {
    await delay(800);
    const points = mockPoints.filter(p => !p.id.includes('alias'));
    const completedPoints = points.filter(p => p.status === 'completed' || p.status === 'verified');
    const pendingPoints = points.filter(p => p.status === 'pending' || p.status === 'processing');
    const reviewPoints = points.filter(p => p.status === 'review');
    const getLatestFeedback = (pointId: string) => {
      const feedbacks = mockFeedbacks.filter(f => f.pointId === pointId);
      if (feedbacks.length === 0) return '暂无反馈';
      const latest = feedbacks.sort((a, b) =>
        new Date(b.reportTime).getTime() - new Date(a.reportTime).getTime()
      )[0];
      return `${latest.title} - ${getStatusText(latest.status)}`;
    };
    const getLatestPlan = (pointId: string) => {
      const plans = mockPlans.filter(p => p.pointIds.includes(pointId));
      if (plans.length === 0) return '暂无方案';
      const latest = plans.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];
      return `绕行方案${latest.version} - ${latest.isActive ? '已生效' : '待确认'}`;
    };
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
        totalFeedbacks: mockFeedbacks.length,
        resolvedFeedbacks: mockFeedbacks.filter(f => f.status === 'resolved').length,
        conflictFeedbacks: mockFeedbacks.filter(f => f.hasConflict).length,
      },
      sections: {
        completed: {
          ...mockReport.sections.completed,
          count: completedPoints.length,
          items: completedPoints.map(p => ({
            id: p.id,
            pointName: p.name,
            address: p.address,
            status: p.status,
            latestFeedback: getLatestFeedback(p.id),
            latestPlan: getLatestPlan(p.id),
          })),
        },
        pending: {
          ...mockReport.sections.pending,
          count: pendingPoints.length,
          items: pendingPoints.map(p => ({
            id: p.id,
            pointName: p.name,
            address: p.address,
            status: p.status,
            latestFeedback: getLatestFeedback(p.id),
            latestPlan: getLatestPlan(p.id),
          })),
        },
        review: {
          ...mockReport.sections.review,
          count: reviewPoints.length,
          items: reviewPoints.map(p => ({
            id: p.id,
            pointName: p.name,
            address: p.address,
            status: p.status,
            latestFeedback: getLatestFeedback(p.id),
            latestPlan: getLatestPlan(p.id),
          })),
        },
      },
    };
  },

  async getReportById(id: string): Promise<Report | null> {
    await delay(200);
    if (id === mockReport.id) {
      return mockReport;
    }
    return null;
  },

  async exportReport(id: string, format: 'pdf' | 'excel' | 'print'): Promise<Blob> {
    await delay(500);
    const report = await this.getReportById(id) || mockReport;
    const content = JSON.stringify(report, null, 2);
    return new Blob([content], { type: 'application/json' });
  },

  async getCrossPeriodStats(): Promise<CrossPeriodData[]> {
    await delay(300);
    return mockCrossPeriodData;
  },
};

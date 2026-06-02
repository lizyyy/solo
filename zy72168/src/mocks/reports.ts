import type { Report, CrossPeriodData } from '@/types';

export const mockCrossPeriodData: CrossPeriodData[] = [
  {
    period: 'morning',
    periodLabel: '早高峰(7:00-9:00)',
    pointCount: 4,
    feedbackCount: 8,
    completedRate: 75,
  },
  {
    period: 'daytime',
    periodLabel: '日间(9:00-17:00)',
    pointCount: 6,
    feedbackCount: 5,
    completedRate: 60,
  },
  {
    period: 'evening',
    periodLabel: '晚高峰(17:00-19:00)',
    pointCount: 5,
    feedbackCount: 7,
    completedRate: 80,
  },
  {
    period: 'night',
    periodLabel: '夜间(19:00-7:00)',
    pointCount: 2,
    feedbackCount: 3,
    completedRate: 50,
  },
];

export const mockReport: Report = {
  id: 'report001',
  title: '2026年5月道路施工绕行评估报告',
  generatedAt: '2026-06-02T10:00:00Z',
  generatedBy: '周姐',
  timeRange: {
    start: '2026-05-15T00:00:00Z',
    end: '2026-06-02T23:59:59Z',
  },
  statistics: {
    totalPoints: 9,
    completedPoints: 3,
    pendingPoints: 3,
    reviewPoints: 2,
    totalFeedbacks: 10,
    resolvedFeedbacks: 5,
    conflictFeedbacks: 2,
  },
  sections: {
    completed: {
      title: '已处理点位',
      status: 'completed',
      count: 3,
      items: [
        {
          id: 'p001',
          pointName: '人民路与建设路交叉口',
          address: '人民路123号',
          status: 'completed',
          latestFeedback: '晚高峰通行方案讨论 - 已解决',
          latestPlan: '绕行方案v2 - 已生效',
        },
        {
          id: 'p006',
          pointName: '黑龙江路与吉林路交叉口',
          address: '黑龙江路202号',
          status: 'completed',
          latestFeedback: '晚高峰绕行路线不合理 - 已优化',
          latestPlan: '绕行方案v1 - 已生效',
        },
        {
          id: 'p002',
          pointName: '中山路与解放路交叉口',
          address: '中山路456号',
          status: 'verified',
          latestFeedback: '现场会议纪要 - 待核实数据冲突',
          latestPlan: '绕行方案v1 - 待确认',
        },
      ],
    },
    pending: {
      title: '待核实点位',
      status: 'pending',
      count: 3,
      items: [
        {
          id: 'p003',
          pointName: '长江路与淮海路交叉口',
          address: '长江路789号',
          status: 'pending',
          latestFeedback: '现场巡查记录 - 内容为空，待补全',
          latestPlan: '暂无方案',
        },
        {
          id: 'p004',
          pointName: '长江路与南京路交叉口',
          address: '长江路800号',
          status: 'pending',
          latestFeedback: '暂无反馈',
          latestPlan: '暂无方案',
        },
        {
          id: 'p007',
          pointName: '辽宁路与河北路交叉口',
          address: '辽宁路303号',
          status: 'pending',
          latestFeedback: '暂无反馈',
          latestPlan: '暂无方案',
        },
      ],
    },
    review: {
      title: '需要现场复看点位',
      status: 'review',
      count: 2,
      items: [
        {
          id: 'p005',
          pointName: '黄河路与珠江路交叉口',
          address: '黄河路101号',
          status: 'review',
          latestFeedback: '夜间施工噪音投诉 - 边界记录，需现场复核',
          latestPlan: '暂无方案',
        },
        {
          id: 'p008',
          pointName: '山东路与山西路交叉口',
          address: '山东路404号',
          status: 'review',
          latestFeedback: '公交改道通知 - 标题为空，边界记录，需现场复核',
          latestPlan: '暂无方案',
        },
      ],
    },
  },
};

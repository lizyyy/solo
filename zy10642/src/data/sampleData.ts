import { reviewService } from '../services/ReviewService';
import { ReviewStatus, DeductionItem } from '../models/types';

export const createSampleDeductions = (): DeductionItem[] => [
  {
    id: 'd1',
    category: '服务态度',
    description: '语气生硬，缺乏礼貌',
    points: 5,
    createdAt: new Date()
  },
  {
    id: 'd2',
    category: '专业知识',
    description: '对产品功能不熟悉',
    points: 10,
    createdAt: new Date()
  }
];

export const initSampleData = (): void => {
  const deductions1 = createSampleDeductions();
  const review1 = reviewService.createReview({
    sessionId: 'sess-001',
    customerServiceId: 'cs-001',
    customerServiceName: '张三',
    inspectorId: 'qa-001',
    inspectorName: '质检员A',
    originalScore: 85,
    currentScore: 85,
    deductions: deductions1
  });

  reviewService.submitAppeal(
    review1.id,
    {
      reason: '客户情绪激动，我已尽力安抚，产品功能问题我已记录并反馈给技术团队',
      materials: [
        { type: 'screenshot', url: 'http://example.com/s1.jpg', uploadedBy: 'cs-001' },
        { type: 'recording', url: 'http://example.com/r1.mp3', uploadedBy: 'cs-001' }
      ]
    },
    'cs-001',
    '张三'
  );

  reviewService.reviewAppeal(review1.id, {
    action: 'approve',
    reviewerId: 'manager-001',
    reviewerName: '主管李',
    comment: '复议属实，撤销扣分',
    newScore: 100,
    newDeductions: []
  });

  const deductions2 = [
    {
      id: 'd3',
      category: '响应时效',
      description: '客户等待超过5分钟未响应',
      points: 15,
      createdAt: new Date()
    }
  ];
  const review2 = reviewService.createReview({
    sessionId: 'sess-002',
    customerServiceId: 'cs-002',
    customerServiceName: '李四',
    inspectorId: 'qa-002',
    inspectorName: '质检员B',
    originalScore: 85,
    currentScore: 85,
    deductions: deductions2
  });

  reviewService.submitAppeal(
    review2.id,
    {
      reason: '当时系统卡顿，非人为原因',
      materials: [
        { type: 'text', content: '系统日志显示10:05-10:08期间服务器响应异常', uploadedBy: 'cs-002' }
      ]
    },
    'cs-002',
    '李四'
  );

  reviewService.reviewAppeal(review2.id, {
    action: 'reject',
    reviewerId: 'manager-001',
    reviewerName: '主管李',
    comment: '系统异常不成立，维持原评分',
    newScore: undefined,
    newDeductions: undefined
  });

  const deductions3 = [
    {
      id: 'd4',
      category: '信息准确性',
      description: '提供的解决方案有误',
      points: 20,
      createdAt: new Date()
    }
  ];
  reviewService.createReview({
    sessionId: 'sess-003',
    customerServiceId: 'cs-003',
    customerServiceName: '王五',
    inspectorId: 'qa-001',
    inspectorName: '质检员A',
    originalScore: 80,
    currentScore: 80,
    deductions: deductions3
  });

  const deductions4 = [
    {
      id: 'd5',
      category: '服务态度',
      description: '与客户发生争执',
      points: 25,
      createdAt: new Date()
    }
  ];
  const review4 = reviewService.createReview({
    sessionId: 'sess-004',
    customerServiceId: 'cs-004',
    customerServiceName: '赵六',
    inspectorId: 'qa-002',
    inspectorName: '质检员B',
    originalScore: 75,
    currentScore: 75,
    deductions: deductions4
  });

  reviewService.submitAppeal(
    review4.id,
    {
      reason: '客户先进行人身攻击，我只是在维护公司形象',
      materials: [
        { type: 'recording', url: 'http://example.com/r2.mp3', uploadedBy: 'cs-004' }
      ]
    },
    'cs-004',
    '赵六'
  );
};

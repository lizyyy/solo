import { reviewService, StateValidationError } from '../services/ReviewService';
import { reviewStore } from '../models/store';
import { ReviewStatus } from '../models/types';

describe('客服质检系统抽检结果复议 - 完整流程测试', () => {
  beforeEach(() => {
    reviewStore.clear();
  });

  test('完整流转：创建质检 -> 提交复议 -> 复核通过（改分）', () => {
    const deductions = [
      { id: 'd1', category: '服务态度', description: '语气生硬', points: 5, createdAt: new Date() }
    ];
    
    const review = reviewService.createReview({
      sessionId: 'sess-flow-001',
      customerServiceId: 'cs-flow-001',
      customerServiceName: '测试客服',
      inspectorId: 'qa-flow-001',
      inspectorName: '测试质检员',
      originalScore: 95,
      currentScore: 95,
      deductions
    });

    expect(review.status).toBe(ReviewStatus.SCORED);
    expect(review.history.length).toBe(1);
    expect(review.history[0].action).toBe('质检评分');

    const appealedReview = reviewService.submitAppeal(
      review.id,
      {
        reason: '测试复议原因',
        materials: [{ type: 'text', content: '测试材料内容', uploadedBy: 'cs-flow-001' }]
      },
      'cs-flow-001',
      '测试客服'
    );

    expect(appealedReview.status).toBe(ReviewStatus.APPEALING);
    expect(appealedReview.history.length).toBe(2);
    expect(appealedReview.appealReason).toBe('测试复议原因');
    expect(appealedReview.appealMaterials.length).toBe(1);

    const reviewedReview = reviewService.reviewAppeal(review.id, {
      action: 'approve',
      reviewerId: 'manager-flow-001',
      reviewerName: '测试主管',
      comment: '复议通过',
      newScore: 100,
      newDeductions: []
    });

    expect(reviewedReview.status).toBe(ReviewStatus.SCORE_CHANGED);
    expect(reviewedReview.currentScore).toBe(100);
    expect(reviewedReview.history.length).toBe(3);
    expect(reviewedReview.history[2].action).toBe('复议通过-改分');
    expect(reviewedReview.history[2].previousScore).toBe(95);
    expect(reviewedReview.history[2].previousDeductions).toHaveLength(1);
    expect(reviewedReview.reviewerName).toBe('测试主管');
    expect(reviewedReview.reviewComment).toBe('复议通过');

    const listResult = reviewService.listReviews();
    expect(listResult).toHaveLength(1);
    expect(listResult[0].id).toBe(review.id);

    const detailResult = reviewService.getReview(review.id);
    expect(detailResult).toBeDefined();
    expect(detailResult?.status).toBe(ReviewStatus.SCORE_CHANGED);

    const exportedData = reviewService.exportToCSV([reviewedReview]);
    expect(exportedData[0]['原始分数']).toBe(95);
    expect(exportedData[0]['当前分数']).toBe(100);
    expect(exportedData[0]['原始扣分原因']).toContain('语气生硬');
    expect(exportedData[0]['状态']).toBe(ReviewStatus.SCORE_CHANGED);
  });
});

describe('客服质检系统抽检结果复议 - 冲突记录测试', () => {
  beforeEach(() => {
    reviewStore.clear();
  });

  test('重复提交复议应该抛出状态冲突错误', () => {
    const deductions = [
      { id: 'd1', category: '服务态度', description: '语气生硬', points: 5, createdAt: new Date() }
    ];
    
    const review = reviewService.createReview({
      sessionId: 'sess-conflict-001',
      customerServiceId: 'cs-conflict-001',
      customerServiceName: '测试客服',
      inspectorId: 'qa-conflict-001',
      inspectorName: '测试质检员',
      originalScore: 95,
      currentScore: 95,
      deductions
    });

    reviewService.submitAppeal(
      review.id,
      {
        reason: '第一次复议',
        materials: []
      },
      'cs-conflict-001',
      '测试客服'
    );

    expect(() => {
      reviewService.submitAppeal(
        review.id,
        {
          reason: '重复提交的复议',
          materials: []
        },
        'cs-conflict-001',
        '测试客服'
      );
    }).toThrow(StateValidationError);

    expect(() => {
      reviewService.submitAppeal(
        review.id,
        {
          reason: '重复提交的复议',
          materials: []
        },
        'cs-conflict-001',
        '测试客服'
      );
    }).toThrow('当前状态"复议中"不允许提交复议');
  });

  test('在已评分状态直接复核应该抛出状态冲突错误', () => {
    const deductions = [
      { id: 'd1', category: '服务态度', description: '语气生硬', points: 5, createdAt: new Date() }
    ];
    
    const review = reviewService.createReview({
      sessionId: 'sess-conflict-002',
      customerServiceId: 'cs-conflict-002',
      customerServiceName: '测试客服',
      inspectorId: 'qa-conflict-002',
      inspectorName: '测试质检员',
      originalScore: 95,
      currentScore: 95,
      deductions
    });

    expect(() => {
      reviewService.reviewAppeal(review.id, {
        action: 'approve',
        reviewerId: 'manager-conflict-001',
        reviewerName: '测试主管',
        comment: '直接复核',
        newScore: 100
      });
    }).toThrow('当前状态"已评分"不允许复核');
  });

  test('已改分状态提交复议应该抛出状态冲突错误', () => {
    const deductions = [
      { id: 'd1', category: '服务态度', description: '语气生硬', points: 5, createdAt: new Date() }
    ];
    
    const review = reviewService.createReview({
      sessionId: 'sess-conflict-003',
      customerServiceId: 'cs-conflict-003',
      customerServiceName: '测试客服',
      inspectorId: 'qa-conflict-003',
      inspectorName: '测试质检员',
      originalScore: 95,
      currentScore: 95,
      deductions
    });

    reviewService.submitAppeal(
      review.id,
      { reason: '测试复议', materials: [] },
      'cs-conflict-003',
      '测试客服'
    );

    reviewService.reviewAppeal(review.id, {
      action: 'approve',
      reviewerId: 'manager-conflict-001',
      reviewerName: '测试主管',
      comment: '复议通过',
      newScore: 100
    });

    expect(() => {
      reviewService.submitAppeal(
        review.id,
        { reason: '再次复议', materials: [] },
        'cs-conflict-003',
        '测试客服'
      );
    }).toThrow('当前状态"已改分"不允许提交复议');
  });
});

describe('客服质检系统抽检结果复议 - 驳回流程测试', () => {
  beforeEach(() => {
    reviewStore.clear();
  });

  test('完整流转：创建质检 -> 提交复议 -> 复核驳回（维持原分）', () => {
    const deductions = [
      { id: 'd1', category: '服务态度', description: '语气生硬', points: 5, createdAt: new Date() }
    ];
    
    const review = reviewService.createReview({
      sessionId: 'sess-reject-001',
      customerServiceId: 'cs-reject-001',
      customerServiceName: '测试客服',
      inspectorId: 'qa-reject-001',
      inspectorName: '测试质检员',
      originalScore: 95,
      currentScore: 95,
      deductions
    });

    reviewService.submitAppeal(
      review.id,
      {
        reason: '测试复议原因',
        materials: []
      },
      'cs-reject-001',
      '测试客服'
    );

    const reviewedReview = reviewService.reviewAppeal(review.id, {
      action: 'reject',
      reviewerId: 'manager-reject-001',
      reviewerName: '测试主管',
      comment: '复议不成立，维持原评分'
    });

    expect(reviewedReview.status).toBe(ReviewStatus.MAINTAINED);
    expect(reviewedReview.currentScore).toBe(95);
    expect(reviewedReview.history.length).toBe(3);
    expect(reviewedReview.history[2].action).toBe('复议驳回-维持原分');
    expect(reviewedReview.reviewerName).toBe('测试主管');
    expect(reviewedReview.reviewComment).toBe('复议不成立，维持原评分');

    const listResult = reviewService.listReviews();
    expect(listResult).toHaveLength(1);

    const exportedData = reviewService.exportToCSV([reviewedReview]);
    expect(exportedData[0]['状态']).toBe(ReviewStatus.MAINTAINED);
    expect(exportedData[0]['当前分数']).toBe(95);
  });
});

describe('客服质检系统抽检结果复议 - 导入坏行/异常数据测试', () => {
  beforeEach(() => {
    reviewStore.clear();
  });

  test('复核通过时不提供新分数应该抛出错误', () => {
    const deductions = [
      { id: 'd1', category: '服务态度', description: '语气生硬', points: 5, createdAt: new Date() }
    ];
    
    const review = reviewService.createReview({
      sessionId: 'sess-bad-001',
      customerServiceId: 'cs-bad-001',
      customerServiceName: '测试客服',
      inspectorId: 'qa-bad-001',
      inspectorName: '测试质检员',
      originalScore: 95,
      currentScore: 95,
      deductions
    });

    reviewService.submitAppeal(
      review.id,
      { reason: '测试复议', materials: [] },
      'cs-bad-001',
      '测试客服'
    );

    expect(() => {
      reviewService.reviewAppeal(review.id, {
        action: 'approve',
        reviewerId: 'manager-bad-001',
        reviewerName: '测试主管',
        comment: '复议通过'
      });
    }).toThrow('通过复议时必须提供新分数');
  });

  test('对不存在的记录操作应该抛出错误', () => {
    expect(() => {
      reviewService.submitAppeal(
        'non-existent-id',
        { reason: '测试', materials: [] },
        'cs-001',
        '测试客服'
      );
    }).toThrow('质检记录不存在');

    expect(() => {
      reviewService.reviewAppeal('non-existent-id', {
        action: 'approve',
        reviewerId: 'manager-001',
        reviewerName: '测试主管',
        comment: '测试',
        newScore: 100
      });
    }).toThrow('质检记录不存在');
  });
});

describe('客服质检系统抽检结果复议 - 列表、详情、历史、导出数据一致性测试', () => {
  beforeEach(() => {
    reviewStore.clear();
  });

  test('列表、详情、历史记录和导出数据应该互相对应', () => {
    const deductions = [
      { id: 'd1', category: '专业知识', description: '产品不熟悉', points: 10, createdAt: new Date() }
    ];
    
    const review = reviewService.createReview({
      sessionId: 'sess-consist-001',
      customerServiceId: 'cs-consist-001',
      customerServiceName: '一致性测试客服',
      inspectorId: 'qa-consist-001',
      inspectorName: '一致性测试质检员',
      originalScore: 90,
      currentScore: 90,
      deductions
    });

    reviewService.submitAppeal(
      review.id,
      {
        reason: '已参加最新产品培训，当时确实有信息滞后',
        materials: [{ type: 'text', content: '培训证书截图', uploadedBy: 'cs-consist-001' }]
      },
      'cs-consist-001',
      '一致性测试客服'
    );

    reviewService.reviewAppeal(review.id, {
      action: 'approve',
      reviewerId: 'manager-consist-001',
      reviewerName: '一致性测试主管',
      comment: '情况属实，撤销专业知识项扣分',
      newScore: 100,
      newDeductions: []
    });

    const list = reviewService.listReviews();
    expect(list).toHaveLength(1);
    const listItem = list[0];

    const detail = reviewService.getReview(review.id);
    expect(detail).toBeDefined();

    expect(listItem.id).toBe(detail!.id);
    expect(listItem.status).toBe(detail!.status);
    expect(listItem.currentScore).toBe(detail!.currentScore);

    const history = detail!.history;
    expect(history).toHaveLength(3);
    expect(history[0].action).toBe('质检评分');
    expect(history[1].action).toBe('提交复议');
    expect(history[2].action).toBe('复议通过-改分');

    expect(history[2].previousScore).toBe(90);
    expect(history[2].newScore).toBe(100);
    expect(history[2].previousDeductions).toHaveLength(1);
    expect(history[2].previousDeductions![0].description).toBe('产品不熟悉');

    const exported = reviewService.exportToCSV(list);
    expect(exported).toHaveLength(1);
    expect(exported[0]['质检ID']).toBe(listItem.id);
    expect(exported[0]['会话ID']).toBe('sess-consist-001');
    expect(exported[0]['客服姓名']).toBe('一致性测试客服');
    expect(exported[0]['原始分数']).toBe(90);
    expect(exported[0]['当前分数']).toBe(100);
    expect(exported[0]['状态']).toBe(ReviewStatus.SCORE_CHANGED);
    expect(exported[0]['原始扣分原因']).toContain('产品不熟悉');
    expect(exported[0]['当前扣分原因']).toBe('');
    expect(exported[0]['复核人']).toBe('一致性测试主管');
    expect(exported[0]['复核意见']).toBe('情况属实，撤销专业知识项扣分');
  });
});

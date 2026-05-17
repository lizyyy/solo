import { store } from './store';
import { PlanStatus, FlowType, ReviewResult } from './types';

console.log('🌱 正在生成种子数据...');

const advertiser1 = store.addAdvertiser({
  name: '字节跳动科技有限公司',
  companyName: '北京字节跳动科技有限公司',
  industry: '互联网',
  contactPerson: '张小明',
  contactPhone: '138****1234',
  totalBudget: 1000000,
  usedBudget: 450000
});

const advertiser2 = store.addAdvertiser({
  name: '阿里巴巴集团',
  companyName: '阿里巴巴集团控股有限公司',
  industry: '电商',
  contactPerson: '李大华',
  contactPhone: '139****5678',
  totalBudget: 2000000,
  usedBudget: 1200000
});

const advertiser3 = store.addAdvertiser({
  name: '腾讯科技',
  companyName: '腾讯科技(深圳)有限公司',
  industry: '游戏/社交',
  contactPerson: '王小红',
  contactPhone: '137****9012',
  totalBudget: 1500000,
  usedBudget: 800000
});

const now = new Date();

const plan1 = store.addAdPlan({
  advertiserId: advertiser1.id,
  name: '抖音618大促信息流投放计划',
  platform: '抖音',
  dailyBudget: 10000,
  totalBudget: 100000,
  currentSpend: 98000,
  status: PlanStatus.RUNNING,
  startDate: new Date(now.getFullYear(), 5, 1),
  endDate: new Date(now.getFullYear(), 5, 30)
});

store.addSpendCallback({
  planId: plan1.id,
  spendAmount: 20000,
  callbackTime: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
  callbackSource: '抖音广告后台',
  isDelayed: false
});

store.addSpendCallback({
  planId: plan1.id,
  spendAmount: 35000,
  callbackTime: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
  callbackSource: '抖音广告后台',
  isDelayed: false
});

store.addSpendCallback({
  planId: plan1.id,
  spendAmount: 43000,
  callbackTime: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
  callbackSource: '抖音广告后台',
  isDelayed: false
});

const plan2 = store.addAdPlan({
  advertiserId: advertiser1.id,
  name: '今日头条品牌推广计划',
  platform: '今日头条',
  dailyBudget: 5000,
  totalBudget: 50000,
  currentSpend: 48000,
  status: PlanStatus.RUNNING,
  startDate: new Date(now.getFullYear(), 5, 1),
  endDate: new Date(now.getFullYear(), 5, 20)
});

const plan3 = store.addAdPlan({
  advertiserId: advertiser2.id,
  name: '淘宝双11预热投放',
  platform: '淘宝联盟',
  dailyBudget: 20000,
  totalBudget: 200000,
  currentSpend: 195000,
  status: PlanStatus.STOPPING,
  startDate: new Date(now.getFullYear(), 9, 1),
  endDate: new Date(now.getFullYear(), 10, 11)
});

store.addReviewRecord({
  planId: plan3.id,
  flowType: FlowType.NORMAL,
  operatorId: 'sys-001',
  operatorName: '系统自动',
  reviewResult: ReviewResult.APPROVED,
  reason: '系统检测到预算超支，自动触发止损',
  evidenceUrls: [
    `https://ad-platform.example.com/evidence/${plan3.id}/spend-report.pdf`,
    `https://ad-platform.example.com/evidence/${plan3.id}/budget-snapshot.png`
  ]
});

const plan4 = store.addAdPlan({
  advertiserId: advertiser2.id,
  name: '天猫超级品牌日投放',
  platform: '天猫',
  dailyBudget: 15000,
  totalBudget: 150000,
  currentSpend: 145000,
  status: PlanStatus.RUNNING,
  startDate: new Date(now.getFullYear(), 5, 10),
  endDate: new Date(now.getFullYear(), 5, 25)
});

store.addReviewRecord({
  planId: plan4.id,
  flowType: FlowType.NORMAL,
  operatorId: 'op-001',
  operatorName: '张三',
  reviewResult: ReviewResult.APPROVED,
  reason: '系统检测到预算超支，触发止损',
  evidenceUrls: [
    `https://ad-platform.example.com/evidence/${plan4.id}/spend-report.pdf`
  ]
});

store.addReviewRecord({
  planId: plan4.id,
  flowType: FlowType.REJECT,
  operatorId: 'mgr-001',
  operatorName: '李四',
  reviewResult: ReviewResult.REJECTED,
  reason: '驳回止损：实际消耗统计有误，包含了测试订单金额。扣除测试订单后实际消耗为120000元，未超预算。',
  evidenceUrls: [
    `https://ad-platform.example.com/evidence/${plan4.id}/reject-form.pdf`,
    `https://ad-platform.example.com/evidence/${plan4.id}/actual-spend-proof.xlsx`
  ]
});

const plan5 = store.addAdPlan({
  advertiserId: advertiser3.id,
  name: '王者荣耀暑期推广计划',
  platform: '微信朋友圈',
  dailyBudget: 25000,
  totalBudget: 250000,
  currentSpend: 255000,
  status: PlanStatus.PENDING_COMPENSATION,
  startDate: new Date(now.getFullYear(), 6, 1),
  endDate: new Date(now.getFullYear(), 7, 31)
});

store.addReviewRecord({
  planId: plan5.id,
  flowType: FlowType.NORMAL,
  operatorId: 'sys-001',
  operatorName: '系统自动',
  reviewResult: ReviewResult.APPROVED,
  reason: '系统检测到预算超支，自动触发止损',
  evidenceUrls: [
    `https://ad-platform.example.com/evidence/${plan5.id}/spend-report.pdf`
  ]
});

store.addReviewRecord({
  planId: plan5.id,
  flowType: FlowType.MANUAL_REVIEW,
  operatorId: 'mgr-002',
  operatorName: '王五',
  reviewResult: ReviewResult.APPROVED,
  reason: '人工复核通过：确认超投5000元，已启动补偿流程。补偿方式：延长投放时间3天。',
  evidenceUrls: [
    `https://ad-platform.example.com/evidence/${plan5.id}/manual-review-form.pdf`,
    `https://ad-platform.example.com/evidence/${plan5.id}/meeting-minutes.docx`
  ]
});

const plan6 = store.addAdPlan({
  advertiserId: advertiser3.id,
  name: '和平精英赛事合作投放',
  platform: '腾讯广告',
  dailyBudget: 30000,
  totalBudget: 300000,
  currentSpend: 305000,
  status: PlanStatus.CLOSED,
  startDate: new Date(now.getFullYear(), 4, 1),
  endDate: new Date(now.getFullYear(), 5, 30)
});

store.addReviewRecord({
  planId: plan6.id,
  flowType: FlowType.NORMAL,
  operatorId: 'sys-001',
  operatorName: '系统自动',
  reviewResult: ReviewResult.APPROVED,
  reason: '系统检测到预算超支，自动触发止损',
  evidenceUrls: [
    `https://ad-platform.example.com/evidence/${plan6.id}/spend-report.pdf`
  ]
});

store.addReviewRecord({
  planId: plan6.id,
  flowType: FlowType.MANUAL_REVIEW,
  operatorId: 'mgr-002',
  operatorName: '王五',
  reviewResult: ReviewResult.APPROVED,
  reason: '人工复核通过：确认超投5000元，已按约定执行补偿方案。',
  evidenceUrls: [
    `https://ad-platform.example.com/evidence/${plan6.id}/manual-review-form.pdf`
  ]
});

store.addReviewRecord({
  planId: plan6.id,
  flowType: FlowType.NORMAL,
  operatorId: 'op-002',
  operatorName: '赵六',
  reviewResult: ReviewResult.APPROVED,
  reason: '补偿处理完成，计划关闭。客户确认无异议。',
  evidenceUrls: [
    `https://ad-platform.example.com/evidence/${plan6.id}/completion-certificate.pdf`
  ]
});

console.log(`
✅ 种子数据生成完成！

📊 数据统计:
  - 广告主: 3 个
  - 投放计划: 6 个
  - 审批记录: 7 条
  - 消耗回传: 3 条

🎯 验收场景:
  1. 完整流转记录 (plan6 - 王者荣耀暑期推广计划)
     - 投放中 → 止损中 → 人工复核通过 → 待补偿 → 已关闭

  2. 冲突记录 (plan4 - 天猫超级品牌日投放)
     - 触发止损 → 驳回止损 → 恢复投放中

  3. 导入坏行测试
     - 使用不存在的计划ID导入
     - 使用回传延迟超过2小时且超预算的数据导入

💡 提示: 运行 npm run dev 启动服务后，可通过 /api/plans 查看所有计划
`);

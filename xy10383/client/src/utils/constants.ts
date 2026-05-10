import { LeadStatus, CustomerLevel } from '../types';

export const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  [LeadStatus.PENDING]: { label: '待分配', color: 'default' },
  [LeadStatus.ASSIGNED]: { label: '已分配', color: 'blue' },
  [LeadStatus.FOLLOWING]: { label: '跟进中', color: 'processing' },
  [LeadStatus.CONVERTED]: { label: '已转化', color: 'success' },
  [LeadStatus.REJECTED]: { label: '已拒绝', color: 'error' },
  [LeadStatus.NEEDS_REVIEW]: { label: '待复核', color: 'warning' }
};

export const LEVEL_LABELS: Record<string, { label: string; color: string }> = {
  [CustomerLevel.HIGH]: { label: '高价值', color: '#f5222d' },
  [CustomerLevel.MEDIUM]: { label: '中价值', color: '#fa8c16' },
  [CustomerLevel.LOW]: { label: '低价值', color: '#52c41a' }
};

export const REGION_OPTIONS = [
  '北京', '天津', '河北', '山西', '内蒙古',
  '辽宁', '吉林', '黑龙江',
  '上海', '江苏', '浙江', '安徽', '福建', '江西', '山东',
  '河南', '湖北', '湖南',
  '广东', '广西', '海南',
  '重庆', '四川', '贵州', '云南', '西藏',
  '陕西', '甘肃', '青海', '宁夏', '新疆',
  '台湾', '香港', '澳门'
];

export const PRODUCT_OPTIONS = [
  '云服务器', '云数据库', '云存储',
  '企业应用', '数据中台', '安全服务',
  'AI解决方案', '机器学习平台', '大数据分析',
  'IoT平台', '边缘计算', '数据分析'
];

export const FOLLOW_UP_STATUS_OPTIONS = [
  '首次联系',
  '电话跟进',
  '邮件沟通',
  '客户回访',
  '需求确认',
  '方案提交',
  '商务谈判',
  '合同签署',
  '已转化',
  '客户拒绝'
];

import { v4 as uuidv4 } from 'uuid';
import {
  ChannelInfo,
  QuotaRule,
  QualityRule,
  SurveyAnswer,
  ProjectConfig
} from '../types';

export const SAMPLE_CHANNELS: ChannelInfo[] = [
  {
    id: 'channel-online',
    name: '线上广告',
    type: 'online_ad',
    description: '抖音、微信朋友圈等线上广告投放渠道',
    enabled: true
  },
  {
    id: 'channel-offline',
    name: '地推',
    type: 'offline_promotion',
    description: '线下门店、商场等地推活动渠道',
    enabled: true
  },
  {
    id: 'channel-member',
    name: '会员渠道',
    type: 'member',
    description: '现有会员数据库定向邀请',
    enabled: true
  }
];

export const SAMPLE_QUOTA_RULES: QuotaRule[] = [
  {
    id: 'quota-beijing',
    name: '北京配额',
    type: 'city',
    limit: 100,
    criteria: { city: '北京' },
    priority: 10
  },
  {
    id: 'quota-shanghai',
    name: '上海配额',
    type: 'city',
    limit: 100,
    criteria: { city: '上海' },
    priority: 10
  },
  {
    id: 'quota-guangzhou',
    name: '广州配额',
    type: 'city',
    limit: 80,
    criteria: { city: '广州' },
    priority: 10
  },
  {
    id: 'quota-shenzhen',
    name: '深圳配额',
    type: 'city',
    limit: 80,
    criteria: { city: '深圳' },
    priority: 10
  },
  {
    id: 'quota-age-18-25',
    name: '18-25岁配额',
    type: 'age',
    limit: 120,
    criteria: { ageGroup: '18-25' },
    priority: 5
  },
  {
    id: 'quota-age-26-35',
    name: '26-35岁配额',
    type: 'age',
    limit: 150,
    criteria: { ageGroup: '26-35' },
    priority: 5
  },
  {
    id: 'quota-age-36-45',
    name: '36-45岁配额',
    type: 'age',
    limit: 100,
    criteria: { ageGroup: '36-45' },
    priority: 5
  },
  {
    id: 'quota-age-46-55',
    name: '46-55岁配额',
    type: 'age',
    limit: 90,
    criteria: { ageGroup: '46-55' },
    priority: 5
  },
  {
    id: 'quota-channel-online',
    name: '线上广告配额',
    type: 'channel',
    limit: 200,
    criteria: { channel: '线上广告' },
    priority: 15
  },
  {
    id: 'quota-channel-offline',
    name: '地推配额',
    type: 'channel',
    limit: 100,
    criteria: { channel: '地推' },
    priority: 15
  },
  {
    id: 'quota-channel-member',
    name: '会员渠道配额',
    type: 'channel',
    limit: 160,
    criteria: { channel: '会员渠道' },
    priority: 15
  },
  {
    id: 'quota-beijing-26-35',
    name: '北京26-35岁组合配额',
    type: 'combined',
    limit: 50,
    criteria: { city: '北京', ageGroup: '26-35' },
    priority: 20
  }
];

export const SAMPLE_QUALITY_RULES: QualityRule[] = [
  {
    id: 'quality-duplicate-phone',
    name: '手机号去重',
    type: 'duplicate_phone',
    enabled: true,
    config: {}
  },
  {
    id: 'quality-min-duration',
    name: '最小答题时长',
    type: 'min_duration',
    enabled: true,
    config: { minSeconds: 60 }
  },
  {
    id: 'quality-all-same-options',
    name: '选项全一样检查',
    type: 'all_same_options',
    enabled: true,
    config: {}
  }
];

export function generateSampleSurveys(): SurveyAnswer[] {
  const surveys: SurveyAnswer[] = [];
  const channels = ['线上广告', '地推', '会员渠道'];
  const cities = ['北京', '上海', '广州', '深圳'];
  const ageGroups = ['18-25', '26-35', '36-45', '46-55'];

  for (let i = 1; i <= 20; i++) {
    const channelIndex = Math.floor(i / 7) % 3;
    const cityIndex = Math.floor(i / 5) % 4;
    const ageIndex = Math.floor(i / 5) % 4;

    surveys.push({
      id: uuidv4(),
      phone: `138${String(10000000 + i).padStart(8, '0')}`,
      channel: channels[channelIndex],
      city: cities[cityIndex],
      ageGroup: ageGroups[ageIndex],
      duration: 60 + Math.floor(Math.random() * 180),
      answers: {
        q1: Math.floor(Math.random() * 5) + 1,
        q2: Math.floor(Math.random() * 5) + 1,
        q3: Math.floor(Math.random() * 5) + 1,
        q4: ['满意', '一般', '不满意'][Math.floor(Math.random() * 3)],
        q5: ['是', '否'][Math.floor(Math.random() * 2)]
      },
      submittedAt: new Date(Date.now() - Math.random() * 86400000).toISOString(),
      sourceId: `batch-${i}`
    });
  }

  surveys.push({
    id: uuidv4(),
    phone: '13810000001',
    channel: '线上广告',
    city: '北京',
    ageGroup: '26-35',
    duration: 120,
    answers: { q1: 3, q2: 4, q3: 2, q4: '满意', q5: '是' },
    submittedAt: new Date().toISOString(),
    sourceId: 'duplicate-test'
  });

  surveys.push({
    id: uuidv4(),
    phone: '13899999901',
    channel: '地推',
    city: '上海',
    ageGroup: '18-25',
    duration: 15,
    answers: { q1: 1, q2: 2, q3: 3, q4: '不满意', q5: '否' },
    submittedAt: new Date().toISOString(),
    sourceId: 'too-fast-test'
  });

  surveys.push({
    id: uuidv4(),
    phone: '13899999902',
    channel: '会员渠道',
    city: '广州',
    ageGroup: '36-45',
    duration: 90,
    answers: { q1: 1, q2: 1, q3: 1, q4: 1, q5: 1 },
    submittedAt: new Date().toISOString(),
    sourceId: 'all-same-test'
  });

  for (let i = 0; i < 5; i++) {
    surveys.push({
      id: uuidv4(),
      phone: `1380000${String(100 + i).padStart(3, '0')}`,
      channel: '线上广告',
      city: '北京',
      ageGroup: '26-35',
      duration: 80 + Math.floor(Math.random() * 100),
      answers: {
        q1: Math.floor(Math.random() * 5) + 1,
        q2: Math.floor(Math.random() * 5) + 1,
        q3: Math.floor(Math.random() * 5) + 1,
        q4: ['满意', '一般'][Math.floor(Math.random() * 2)],
        q5: '是'
      },
      submittedAt: new Date().toISOString(),
      sourceId: `beijing-over-quota-${i}`
    });
  }

  return surveys;
}

export function createSampleProjectConfig(): ProjectConfig {
  return {
    id: 'project-sample-001',
    name: '新产品市场调研项目',
    createdAt: new Date().toISOString(),
    channels: SAMPLE_CHANNELS,
    quotaRules: SAMPLE_QUOTA_RULES,
    qualityRules: SAMPLE_QUALITY_RULES
  };
}

export const NEEDS_REVIEW_SURVEY: SurveyAnswer = {
  id: uuidv4(),
  phone: '13855555555',
  channel: '线上广告',
  city: '深圳',
  ageGroup: '26-35',
  duration: 25,
  answers: { q1: 5, q2: 4, q3: 5, q4: '满意', q5: '是' },
  submittedAt: new Date().toISOString(),
  sourceId: 'review-test'
};

export const SHORT_DURATION_SURVEY: SurveyAnswer = {
  id: uuidv4(),
  phone: '13866666666',
  channel: '地推',
  city: '上海',
  ageGroup: '36-45',
  duration: 20,
  answers: { q1: 2, q2: 3, q3: 4, q4: '一般', q5: '否' },
  submittedAt: new Date().toISOString(),
  sourceId: 'short-duration-test'
};

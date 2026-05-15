import { SearchKeywordReport } from '../types';

export const validSearchKeywordReports: SearchKeywordReport[] = [
  {
    keyword: '智能音箱推荐',
    searchVolume: 15234,
    clickRate: 12.5,
    conversionRate: 3.2,
    avgPosition: 3,
    competition: 'high',
    category: '消费电子',
    region: '华东',
    downloadUrl: 'https://example.com/reports/smart-speaker-2024.csv',
    reportDate: '2024-01-15',
    department: '搜索产品部',
    submittedBy: '张三'
  },
  {
    keyword: '蓝牙耳机测评',
    searchVolume: 28456,
    clickRate: 18.7,
    conversionRate: 5.1,
    avgPosition: 2,
    competition: 'high',
    category: '数码配件',
    region: '华南',
    downloadUrl: 'https://example.com/reports/bluetooth-earphone-2024.csv',
    reportDate: '2024-01-16',
    department: '搜索产品部',
    submittedBy: '李四'
  },
  {
    keyword: '机械键盘推荐',
    searchVolume: 8923,
    clickRate: 9.3,
    conversionRate: 2.8,
    avgPosition: 5,
    competition: 'medium',
    category: '电脑外设',
    region: '华北',
    downloadUrl: 'https://example.com/reports/mechanical-keyboard-2024.csv',
    reportDate: '2024-01-17',
    department: '电商运营部',
    submittedBy: '王五'
  },
  {
    keyword: '笔记本电脑排行榜',
    searchVolume: 45678,
    clickRate: 22.1,
    conversionRate: 6.7,
    avgPosition: 1,
    competition: 'high',
    category: '电脑整机',
    region: '华东',
    downloadUrl: 'https://example.com/reports/laptop-ranking-2024.csv',
    reportDate: '2024-01-18',
    department: '电商运营部',
    submittedBy: '赵六'
  },
  {
    keyword: '无线鼠标推荐',
    searchVolume: 5678,
    clickRate: 7.8,
    conversionRate: 2.1,
    avgPosition: 6,
    competition: 'low',
    category: '电脑外设',
    region: '西南',
    downloadUrl: 'https://example.com/reports/wireless-mouse-2024.csv',
    reportDate: '2024-01-19',
    department: '搜索产品部',
    submittedBy: '张三'
  }
];

export const invalidSearchKeywordReports: SearchKeywordReport[] = [
  {
    keyword: '',
    searchVolume: 1000,
    clickRate: 10,
    conversionRate: 2,
    avgPosition: 3,
    competition: 'high',
    category: '测试分类',
    region: '测试地区',
    downloadUrl: 'https://example.com/valid.csv',
    reportDate: '2024-01-20',
    department: '测试部门',
    submittedBy: '测试人'
  },
  {
    keyword: '下载链接失效测试',
    searchVolume: 5000,
    clickRate: 15,
    conversionRate: 3,
    avgPosition: 2,
    competition: 'medium',
    category: '测试分类',
    region: '测试地区',
    downloadUrl: 'https://example.com/expired-report.csv',
    reportDate: '2024-01-21',
    department: '测试部门',
    submittedBy: '测试人'
  },
  {
    keyword: '负数搜索量',
    searchVolume: -100,
    clickRate: 10,
    conversionRate: 2,
    avgPosition: 4,
    competition: 'low',
    category: '测试分类',
    region: '测试地区',
    downloadUrl: 'https://example.com/valid.csv',
    reportDate: '2024-01-22',
    department: '测试部门',
    submittedBy: '测试人'
  },
  {
    keyword: '点击率超出范围',
    searchVolume: 2000,
    clickRate: 150,
    conversionRate: 2,
    avgPosition: 3,
    competition: 'high',
    category: '测试分类',
    region: '测试地区',
    downloadUrl: 'https://example.com/valid.csv',
    reportDate: '2024-01-23',
    department: '测试部门',
    submittedBy: '测试人'
  },
  {
    keyword: '转化率超出范围',
    searchVolume: 3000,
    clickRate: 10,
    conversionRate: -5,
    avgPosition: 2,
    competition: 'medium',
    category: '测试分类',
    region: '测试地区',
    downloadUrl: 'https://example.com/valid.csv',
    reportDate: '2024-01-24',
    department: '测试部门',
    submittedBy: '测试人'
  },
  {
    keyword: '无效平均排名',
    searchVolume: 4000,
    clickRate: 10,
    conversionRate: 2,
    avgPosition: 0,
    competition: 'high',
    category: '测试分类',
    region: '测试地区',
    downloadUrl: 'https://example.com/valid.csv',
    reportDate: '2024-01-25',
    department: '测试部门',
    submittedBy: '测试人'
  },
  {
    keyword: '无效竞争程度',
    searchVolume: 5000,
    clickRate: 10,
    conversionRate: 2,
    avgPosition: 3,
    competition: 'extreme' as any,
    category: '测试分类',
    region: '测试地区',
    downloadUrl: 'https://example.com/valid.csv',
    reportDate: '2024-01-26',
    department: '测试部门',
    submittedBy: '测试人'
  },
  {
    keyword: '日期格式错误',
    searchVolume: 6000,
    clickRate: 10,
    conversionRate: 2,
    avgPosition: 3,
    competition: 'high',
    category: '测试分类',
    region: '测试地区',
    downloadUrl: 'https://example.com/valid.csv',
    reportDate: '2024/01/27',
    department: '测试部门',
    submittedBy: '测试人'
  },
  {
    keyword: '多个字段错误',
    searchVolume: -500,
    clickRate: 200,
    conversionRate: -10,
    avgPosition: -1,
    competition: 'invalid' as any,
    category: '测试分类',
    region: '测试地区',
    downloadUrl: 'invalid-url',
    reportDate: '2024-13-01',
    department: '测试部门',
    submittedBy: '测试人'
  }
];

export const conflictTestRecords: SearchKeywordReport[] = [
  {
    keyword: '智能音箱推荐',
    searchVolume: 15234,
    clickRate: 12.5,
    conversionRate: 3.2,
    avgPosition: 3,
    competition: 'high',
    category: '消费电子',
    region: '华东',
    downloadUrl: 'https://example.com/reports/different-url.csv',
    reportDate: '2024-01-15',
    department: '搜索产品部',
    submittedBy: '李四'
  }
];

export const reuseTestRecords: SearchKeywordReport[] = [
  {
    keyword: '智能音箱推荐',
    searchVolume: 15234,
    clickRate: 12.5,
    conversionRate: 3.2,
    avgPosition: 3,
    competition: 'high',
    category: '消费电子',
    region: '华东',
    downloadUrl: 'https://example.com/reports/smart-speaker-2024.csv',
    reportDate: '2024-01-15',
    department: '搜索产品部',
    submittedBy: '张三'
  }
];

export const mixedBatchRecords: SearchKeywordReport[] = [
  ...validSearchKeywordReports.slice(0, 2),
  ...invalidSearchKeywordReports.slice(0, 2),
  ...reuseTestRecords
];

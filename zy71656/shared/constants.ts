import { ChannelMapping } from './types';

export const DB_PATH = process.env.DB_PATH || './data/royalty.db';

export const CHANNEL_MAPPING: ChannelMapping = {
  '京东': '京东',
  'JD': '京东',
  'jd.com': '京东',
  '天猫': '天猫',
  'TMALL': '天猫',
  'tmall.com': '天猫',
  '当当': '当当',
  'DANGDANG': '当当',
  'dd.com': '当当',
  '拼多多': '拼多多',
  'PDD': '拼多多',
  'pdd.com': '拼多多',
  '抖音': '抖音',
  'DOUYIN': '抖音',
  '抖音电商': '抖音',
  '微信': '微信',
  'WECHAT': '微信',
  '微信小店': '微信',
  '线下': '线下',
  'OFFLINE': '线下',
  '实体店': '线下',
  '官网': '官网',
  'OFFICIAL': '官网',
  '官方商城': '官网',
  '其他': '其他',
  'OTHER': '其他',
};

export const DEFAULT_LADDER_PHYSICAL = [
  { minVolume: 0, maxVolume: 5000, rate: 0.08 },
  { minVolume: 5001, maxVolume: 10000, rate: 0.10 },
  { minVolume: 10001, maxVolume: 20000, rate: 0.12 },
  { minVolume: 20001, maxVolume: undefined, rate: 0.15 },
];

export const DEFAULT_LADDER_EBOOK = [
  { minVolume: 0, maxVolume: 3000, rate: 0.10 },
  { minVolume: 3001, maxVolume: 8000, rate: 0.12 },
  { minVolume: 8001, maxVolume: 15000, rate: 0.15 },
  { minVolume: 15001, maxVolume: undefined, rate: 0.18 },
];

export const DEFAULT_LADDER_DISCOUNT = [
  { minVolume: 0, maxVolume: undefined, rate: 0.06 },
];

export const LATE_RETURN_THRESHOLD_DAYS = 90;

export const SETTLEMENT_PERIOD_FORMAT = 'YYYY-MM';

export const EXPORT_FIELD_MAPPING: Record<string, string> = {
  bookName: '图书名称',
  authorName: '作者',
  productType: '产品类型',
  channel: '销售渠道',
  salesVolume: '销售册数',
  salesAmount: '销售码洋',
  returnVolume: '退货册数',
  returnAmount: '退货码洋',
  netSalesVolume: '净销售册数',
  ladderTier: '阶梯档位',
  ladderRange: '阶梯区间',
  royaltyRate: '版税率',
  royaltyAmount: '版税金额',
};

export const PROCESSING_NOTE_TEMPLATE = `
版税结算处理口径说明
==================

一、计算规则
1. 纸书版税：按累计销量分档计算，阶梯税率为{physicalLadders}
2. 电书版税：按累计销量分档计算，阶梯税率为{ebookLadders}
3. 活动折扣：统一按{discountRate}%计算，不计阶梯
4. 退货回滚：退货从对应销售期的销量中扣除
5. 渠道归并：{channelMappingNote}

二、数据范围
- 结算周期：{period}
- 销售日期：{salesDateRange}
- 退货日期：{returnDateRange}

三、异常处理
- 标记异常共{exceptionCount}笔
- 已人工确认：{confirmedCount}笔
- 待确认：{pendingCount}笔
- 异常类型：{exceptionTypes}

四、特殊说明
{specialNotes}

生成时间：{generatedAt}
计算引擎版本：v1.0.0
`;

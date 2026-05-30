import type { NewsEvent } from '@/types';

export const NEWS_EVENTS: NewsEvent[] = [
  {
    id: 'news-001',
    title: '突发：央行宣布全面降准0.5个百分点',
    content: '中国人民银行决定于下周一起下调金融机构存款准备金率0.5个百分点，释放长期资金约1万亿元。市场流动性预期大幅改善，债券市场整体向好。',
    type: 'macro',
    severity: 'high',
    direction: 'upgrade',
    affectedBondCodes: ['24国开01', '24农发03', '24进出05', '24茅台01'],
    expectedRating: 'AAA',
  },
  {
    id: 'news-002',
    title: '万科发布业绩预警：净利润预计同比下降40%',
    content: '万科企业股份有限公司发布2024年度业绩预告，受房地产市场持续调整影响，预计净利润同比下降约40%。公司表示将继续推进销售和债务管理。',
    type: 'company',
    severity: 'high',
    direction: 'downgrade',
    affectedBondCodes: ['24万科01'],
    expectedRating: 'A',
  },
  {
    id: 'news-003',
    title: '碧桂园债务重组方案获债权人通过',
    content: '碧桂园控股有限公司宣布，其债务重组方案已获得多数债权人投票通过。根据方案，公司将延长债务期限并降低利率，短期流动性压力得到缓解。',
    type: 'company',
    severity: 'medium',
    direction: 'upgrade',
    affectedBondCodes: ['24碧桂02'],
    expectedRating: 'BB',
  },
  {
    id: 'news-004',
    title: '华能集团获得100亿元绿色低碳转型专项贷款',
    content: '中国华能集团有限公司宣布获得国家开发银行100亿元绿色低碳转型专项贷款，用于支持新能源项目建设。公司绿色债券资质进一步增强。',
    type: 'company',
    severity: 'medium',
    direction: 'upgrade',
    affectedBondCodes: ['24华能01'],
    expectedRating: 'AA',
  },
  {
    id: 'news-005',
    title: '万达商管未能按时兑付5亿美元债券利息',
    content: '大连万达商业管理集团股份有限公司公告称，因流动性紧张，未能按时兑付一笔5亿美元债券的利息。标普已将其信用评级列入负面观察名单。',
    type: 'company',
    severity: 'high',
    direction: 'downgrade',
    affectedBondCodes: ['24万达03'],
    expectedRating: 'CCC',
  },
  {
    id: 'news-006',
    title: '茅台集团发布ESG报告：环境治理评级提升',
    content: '贵州茅台酒股份有限公司发布2024年度ESG报告，公司环境治理和社会责任评分显著提升，MSCI ESG评级从BBB上调至A。',
    type: 'company',
    severity: 'low',
    direction: 'upgrade',
    affectedBondCodes: ['24茅台01'],
    expectedRating: 'AAA',
  },
  {
    id: 'news-007',
    title: '监管新规：地方政府融资平台债务纳入统一监管',
    content: '财政部发布新规，将地方政府融资平台债务纳入统一监管体系，要求金融机构审慎评估相关风险。政策性金融债信用资质进一步强化。',
    type: 'policy',
    severity: 'medium',
    direction: 'upgrade',
    affectedBondCodes: ['24国开01', '24农发03', '24进出05'],
    expectedRating: 'AAA',
  },
  {
    id: 'news-008',
    title: '房地产市场回暖：一线城市新房成交量环比上涨25%',
    content: '据统计局数据，受多项利好政策刺激，一线城市新房成交量环比上涨25%，市场信心有所恢复。房地产行业整体风险偏好有所改善。',
    type: 'industry',
    severity: 'medium',
    direction: 'upgrade',
    affectedBondCodes: ['24万科01', '24碧桂02', '24万达03'],
    expectedRating: 'A',
  },
  {
    id: 'news-009',
    title: '通胀数据超预期：CPI同比上涨2.1%',
    content: '国家统计局发布数据，上月CPI同比上涨2.1%，超出市场预期的1.8%。市场担忧货币政策收紧空间受限，债券市场整体承压。',
    type: 'macro',
    severity: 'medium',
    direction: 'downgrade',
    affectedBondCodes: ['24国开01', '24农发03', '24进出05', '24华能01', '24茅台01'],
    expectedRating: 'AA',
  },
  {
    id: 'news-010',
    title: '万科引入深圳地铁集团作为战略投资者',
    content: '万科企业股份有限公司宣布，深圳地铁集团将以现金方式认购公司新发行股份，持股比例将达到20%。此举将显著增强公司资本实力和信用资质。',
    type: 'company',
    severity: 'high',
    direction: 'upgrade',
    affectedBondCodes: ['24万科01'],
    expectedRating: 'AA',
  },
];

export const getNewsById = (id: string): NewsEvent | undefined => {
  return NEWS_EVENTS.find((news) => news.id === id);
};

export const getRandomNews = (count: number = 5, excludeIds: string[] = []): NewsEvent[] => {
  const available = NEWS_EVENTS.filter((news) => !excludeIds.includes(news.id));
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
};

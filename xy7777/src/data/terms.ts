import { Term } from '../types';

export const terms: Term[] = [
  {
    id: 'term-001',
    term: 'SKU',
    definition: 'Stock Keeping Unit（库存量单位），是库存管理中的最小单位，用于区分不同的商品属性。在电商中，一个商品可能有多个SKU，比如不同颜色、不同尺码的同一款衣服就是不同的SKU。',
    examples: [
      '一件白色M码的T恤是一个SKU',
      '同样款式的黑色L码T恤是另一个SKU',
      '运营需要关注每个SKU的销售表现'
    ],
    category: '电商通用',
    relatedTerms: ['SPU', '库存管理', '动销率'],
    positionIds: ['book', 'live', 'shop', 'shortvideo']
  },
  {
    id: 'term-002',
    term: 'SPU',
    definition: 'Standard Product Unit（标准化产品单元），是商品信息聚合的最小单位。一组可复用、易检索的标准化信息的集合，该集合描述了一个产品的特性。简单说，SPU是"款"，SKU是"件"。',
    examples: [
      'iPhone 15 Pro Max是一个SPU',
      'iPhone 15 Pro Max 256G 深空黑色是一个SKU',
      '一个SPU下可以有多个SKU'
    ],
    category: '电商通用',
    relatedTerms: ['SKU', '商品上架', '商品管理'],
    positionIds: ['book', 'live', 'shop', 'shortvideo']
  },
  {
    id: 'term-003',
    term: 'UV',
    definition: 'Unique Visitor（独立访客），指访问某个站点的不同IP地址的人数。在同一天内，UV只记录第一次进入网站的具有独立IP的访问者，同一IP多次访问只算一次。',
    examples: [
      '今天店铺来了1000个UV',
      'UV是衡量流量质量的重要指标',
      '通过推广活动可以提升UV'
    ],
    category: '数据分析',
    relatedTerms: ['PV', '转化率', '客单价'],
    positionIds: ['book', 'live', 'shop', 'shortvideo']
  },
  {
    id: 'term-004',
    term: 'PV',
    definition: 'Page View（页面浏览量），用户每打开一个页面就记录一次PV。用户多次打开同一页面，PV值累计。PV反映了用户浏览的深度。',
    examples: [
      '一个用户看了5个商品页面，贡献了5个PV',
      'PV/UV的比值越高，说明用户浏览深度越深',
      '详情页的PV是衡量商品吸引力的指标'
    ],
    category: '数据分析',
    relatedTerms: ['UV', '人均浏览量', '跳出率'],
    positionIds: ['book', 'live', 'shop', 'shortvideo']
  },
  {
    id: 'term-005',
    term: '转化率',
    definition: '指完成目标动作的用户占总访问用户的比例。在电商中，通常指成交转化率，即下单用户数占访客数的比例。公式：转化率 = 转化人数 / 总访客数 × 100%',
    examples: [
      '今天有1000个访客，50人下单，转化率是5%',
      '不同品类的转化率不同，女装通常在2-5%',
      '提升转化率是运营的核心目标之一'
    ],
    category: '核心指标',
    relatedTerms: ['UV', '客单价', 'GMV'],
    positionIds: ['book', 'live', 'shop', 'shortvideo']
  },
  {
    id: 'term-006',
    term: '客单价',
    definition: 'Average Order Value（AOV），指每一位顾客平均购买商品的金额。公式：客单价 = 销售额 / 订单数。提升客单价是提升GMV的重要途径。',
    examples: [
      '今天卖了100单，总销售额5000元，客单价50元',
      '可以通过关联推荐、满减活动提升客单价',
      '客单价反映了用户的消费能力'
    ],
    category: '核心指标',
    relatedTerms: ['GMV', '转化率', '关联销售'],
    positionIds: ['book', 'live', 'shop', 'shortvideo']
  },
  {
    id: 'term-007',
    term: 'GMV',
    definition: 'Gross Merchandise Volume（商品交易总额），指一定时间内的成交总额。注意：GMV包含拍下未付款的金额，不等于实际营收。公式：GMV = UV × 转化率 × 客单价',
    examples: [
      '本月GMV达到100万',
      'GMV是衡量店铺规模的核心指标',
      '直播带货常用来做GMV目标'
    ],
    category: '核心指标',
    relatedTerms: ['UV', '转化率', '客单价'],
    positionIds: ['book', 'live', 'shop', 'shortvideo']
  },
  {
    id: 'term-008',
    term: '点击率',
    definition: 'Click Through Rate（CTR），指点击某个元素的用户数占展示用户数的比例。公式：CTR = 点击数 / 展示数 × 100%。点击率是衡量吸引力的重要指标。',
    examples: [
      '商品主图展示了10000次，被点击了500次，点击率5%',
      '直通车的点击率影响质量分',
      '提升点击率的核心是优化主图和标题'
    ],
    category: '流量指标',
    relatedTerms: ['主图优化', '直通车', '钻展'],
    positionIds: ['book', 'live', 'shop', 'shortvideo']
  },
  {
    id: 'term-009',
    term: '完播率',
    definition: '指观看完整个视频的用户占总观看用户的比例。是短视频和直播数据分析中的关键指标，反映了内容的吸引力。完播率越高，平台越愿意推荐。',
    examples: [
      '100人看到视频开头，30人看完，完播率30%',
      '短视频的前3秒决定了完播率',
      '完播率是抖音算法推荐的核心指标'
    ],
    category: '内容指标',
    relatedTerms: ['停留时长', '点赞率', '转发率'],
    positionIds: ['shortvideo', 'live']
  },
  {
    id: 'term-010',
    term: '场控',
    definition: '直播运营中的重要角色，负责配合主播控制直播间节奏、引导互动、处理突发情况。场控是主播的"左膀右臂"，一个好的场控能让直播效果翻倍。',
    examples: [
      '场控要及时在评论区回复观众问题',
      '主播忘词时场控要及时提醒',
      '场控要配合主播营造抢购氛围'
    ],
    category: '直播运营',
    relatedTerms: ['直播脚本', '主播', '互动率'],
    positionIds: ['live']
  },
  {
    id: 'term-011',
    term: '动销率',
    definition: '指有销量的商品数占店铺总商品数的比例。公式：动销率 = 有销量的商品数 / 总商品数 × 100%。动销率反映了店铺商品的健康度。',
    examples: [
      '店铺有100个商品，30个有销量，动销率30%',
      '动销率低说明很多商品是"死款"',
      '要定期清理滞销品提升动销率'
    ],
    category: '商品指标',
    relatedTerms: ['滞销品', '商品优化', '上新'],
    positionIds: ['shop', 'book']
  },
  {
    id: 'term-012',
    term: '复购率',
    definition: '指购买两次及以上的用户占总购买用户的比例。公式：复购率 = 复购用户数 / 总购买用户数 × 100%。复购率反映了用户忠诚度和产品竞争力。',
    examples: [
      '本月100个新用户，20人再次购买，复购率20%',
      '不同品类复购率差异大，美妆复购率高',
      '提升复购率可以通过会员体系、售后关怀'
    ],
    category: '用户指标',
    relatedTerms: ['用户留存', '会员体系', 'CRM'],
    positionIds: ['book', 'live', 'shop', 'shortvideo']
  },
  {
    id: 'term-013',
    term: 'ROI',
    definition: 'Return on Investment（投资回报率），指投入产出比。公式：ROI = 产出金额 / 投入金额。ROI是衡量推广效果的核心指标，ROI大于1才是盈利的。',
    examples: [
      '花了1000元广告费，带来了5000元销售额，ROI是5:1',
      '不同品类的盈亏平衡点ROI不同',
      '运营要不断优化推广策略提升ROI'
    ],
    category: '推广指标',
    relatedTerms: ['直通车', '钻展', '投产比'],
    positionIds: ['book', 'live', 'shop', 'shortvideo']
  },
  {
    id: 'term-014',
    term: '千人千面',
    definition: '指电商平台根据用户的浏览历史、购买记录、兴趣偏好等数据，为每个用户展示个性化的商品推荐。不同的人搜索同一个关键词，看到的商品是不一样的。',
    examples: [
      '喜欢买高端护肤品的用户，搜索"面霜"会看到高端品牌',
      '刚生宝宝的妈妈，首页会推荐母婴用品',
      '千人千面让流量更精准，但也增加了运营难度'
    ],
    category: '平台机制',
    relatedTerms: ['标签', '人群画像', '个性化推荐'],
    positionIds: ['book', 'live', 'shop', 'shortvideo']
  },
  {
    id: 'term-015',
    term: '权重',
    definition: '指平台对商品、店铺的综合评分，权重越高，排名越靠前，获得的流量越多。权重是一个综合指标，受点击率、转化率、销量、好评率等多方面影响。',
    examples: [
      '新品上架初期权重低，需要做基础销量提升权重',
      '违规操作会降低权重，甚至被降权',
      '提升权重是一个持续优化的过程'
    ],
    category: '平台机制',
    relatedTerms: ['搜索排名', '降权', '新品标'],
    positionIds: ['book', 'live', 'shop', 'shortvideo']
  },
  {
    id: 'term-016',
    term: '内容种草',
    definition: '指通过内容（文章、视频、直播等）让用户对产品产生兴趣和购买欲望。种草是内容营销的核心，区别于硬广，种草更偏向"软"，通过分享和推荐影响用户决策。',
    examples: [
      '小红书笔记是典型的内容种草',
      '抖音好物分享视频也是种草',
      '种草的核心是建立信任'
    ],
    category: '内容营销',
    relatedTerms: ['KOL', '内容营销', '转化'],
    positionIds: ['shortvideo', 'live', 'shop']
  },
  {
    id: 'term-017',
    term: '公域流量',
    definition: '指平台提供的免费或付费流量，是公共的流量池，所有商家都可以竞争获取。如淘宝搜索、抖音推荐、平台活动流量等。公域流量的特点是量大但不稳定。',
    examples: [
      '用户在淘宝搜索"连衣裙"看到的商品就是公域流量',
      '抖音推荐页的视频属于公域流量',
      '公域流量要和私域流量结合运营'
    ],
    category: '流量分类',
    relatedTerms: ['私域流量', '流量池', '获客成本'],
    positionIds: ['book', 'live', 'shop', 'shortvideo']
  },
  {
    id: 'term-018',
    term: '私域流量',
    definition: '指商家可以自主掌控、反复触达的用户流量。如微信个人号、企业微信、微信群、公众号粉丝等。私域流量的特点是免费、可控、可反复触达。',
    examples: [
      '把淘宝客户加到微信好友，就是私域流量',
      '企业微信的客户群是重要的私域资产',
      '私域运营的核心是用户关系维护'
    ],
    category: '流量分类',
    relatedTerms: ['公域流量', '用户运营', '复购'],
    positionIds: ['book', 'live', 'shop', 'shortvideo']
  },
  {
    id: 'term-019',
    term: '选题',
    definition: '指选择要创作的内容主题。选题决定了内容的方向和受众，是内容创作的第一步。好的选题是成功的一半，运营需要具备敏锐的选题嗅觉。',
    examples: [
      '做母婴号，"宝宝发烧怎么办"是好选题',
      '做职场号，"如何回答面试官的离职原因"是好选题',
      '选题可以从用户痛点、热点事件、竞品分析中寻找'
    ],
    category: '内容创作',
    relatedTerms: ['内容策划', '爆款', '用户痛点'],
    positionIds: ['shortvideo', 'live', 'book']
  },
  {
    id: 'term-020',
    term: '人设',
    definition: '指账号塑造的人物形象和性格特点。在短视频和直播中，鲜明的人设能让用户记住你、喜欢你。人设包括外在形象、语言风格、价值观念等。',
    examples: [
      '李佳琦的人设是"口红一哥"、专业、贴心',
      '李子柒的人设是"田园美食博主"、治愈、传统',
      '人设要真实，不要刻意表演'
    ],
    category: '账号定位',
    relatedTerms: ['账号定位', 'IP', '粉丝画像'],
    positionIds: ['shortvideo', 'live', 'book']
  }
];

export const getTermsByPosition = (positionId: string): Term[] => {
  return terms.filter(term => term.positionIds.includes(positionId as any));
};

export const searchTerms = (keyword: string): Term[] => {
  const lowerKeyword = keyword.toLowerCase();
  return terms.filter(term => 
    term.term.toLowerCase().includes(lowerKeyword) ||
    term.definition.toLowerCase().includes(lowerKeyword) ||
    term.category.toLowerCase().includes(lowerKeyword)
  );
};

export const getTermById = (id: string): Term | undefined => {
  return terms.find(term => term.id === id);
};

export const getTermsByCategory = (category: string): Term[] => {
  return terms.filter(term => term.category === category);
};

export const getAllCategories = (): string[] => {
  return Array.from(new Set(terms.map(term => term.category)));
};
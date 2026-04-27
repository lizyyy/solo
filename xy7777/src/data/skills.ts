import { Skill } from '../types';

export const skills: Skill[] = [
  {
    id: 'computer-basics-1',
    name: '电脑基础操作',
    description: '掌握Windows/Mac操作系统的基本操作，包括文件管理、快捷键使用、基础设置等',
    level: 'beginner',
    category: '电脑基础',
    positionIds: ['book', 'live', 'shop', 'shortvideo'],
    prerequisites: [],
    estimatedHours: 8,
    difficulty: 1,
    isComputerBasics: true,
    resources: [
      { type: 'video', title: 'Windows 10 基础操作教程', url: '', description: '从零基础学习Windows系统操作' },
      { type: 'article', title: 'Mac新手必学：10个提高效率的快捷键', url: '', description: '掌握Mac常用快捷键' }
    ]
  },
  {
    id: 'computer-basics-2',
    name: 'Office办公软件',
    description: '熟练使用Word、Excel、PPT进行文档编辑、数据处理和演示制作',
    level: 'beginner',
    category: '电脑基础',
    positionIds: ['book', 'live', 'shop', 'shortvideo'],
    prerequisites: ['computer-basics-1'],
    estimatedHours: 16,
    difficulty: 2,
    isComputerBasics: true,
    resources: [
      { type: 'course', title: 'Excel数据处理与分析', url: '', description: '学习Excel公式、函数和数据透视表' },
      { type: 'tool', title: 'Excel函数速查表', url: '', description: '常用Excel函数参考手册' }
    ]
  },
  {
    id: 'computer-basics-3',
    name: '网络与搜索引擎',
    description: '掌握浏览器使用、搜索引擎技巧、网络资源下载与整理',
    level: 'beginner',
    category: '电脑基础',
    positionIds: ['book', 'live', 'shop', 'shortvideo'],
    prerequisites: ['computer-basics-1'],
    estimatedHours: 6,
    difficulty: 1,
    isComputerBasics: true,
    resources: [
      { type: 'article', title: 'Google搜索技巧大全', url: '', description: '高级搜索语法和技巧' },
      { type: 'video', title: '如何高效整理网络资源', url: '', description: '书签管理和资料分类方法' }
    ]
  },
  {
    id: 'computer-basics-4',
    name: '图片处理基础',
    description: '使用PS或在线工具进行图片裁剪、调色、文字添加等基础处理',
    level: 'beginner',
    category: '电脑基础',
    positionIds: ['book', 'live', 'shop', 'shortvideo'],
    prerequisites: ['computer-basics-1'],
    estimatedHours: 12,
    difficulty: 2,
    isComputerBasics: true,
    resources: [
      { type: 'course', title: 'Photoshop零基础入门', url: '', description: 'PS基础工具和操作' },
      { type: 'tool', title: 'Canva在线设计工具', url: '', description: '无需安装的在线图片设计工具' }
    ]
  },
  {
    id: 'book-1',
    name: '图书行业认知',
    description: '了解出版行业整体格局、产业链、主要参与者和发展趋势',
    level: 'beginner',
    category: '行业认知',
    positionIds: ['book'],
    prerequisites: [],
    estimatedHours: 8,
    difficulty: 1,
    resources: [
      { type: 'book', title: '《出版专业实务》', url: '', description: '出版行业经典教材' },
      { type: 'article', title: '2024年中国出版行业报告', url: '', description: '最新行业数据和趋势分析' }
    ]
  },
  {
    id: 'book-2',
    name: '选题策划能力',
    description: '掌握图书选题的市场调研、竞品分析、选题论证和策划方案撰写',
    level: 'intermediate',
    category: '核心技能',
    positionIds: ['book'],
    prerequisites: ['book-1'],
    estimatedHours: 20,
    difficulty: 3,
    resources: [
      { type: 'course', title: '图书选题策划实战', url: '', description: '从市场调研到选题申报全流程' },
      { type: 'article', title: '如何判断一个选题是否值得做', url: '', description: '选题评估的10个维度' }
    ]
  },
  {
    id: 'book-3',
    name: '文案写作能力',
    description: '能够撰写吸引人的图书简介、作者简介、营销文案和书评',
    level: 'intermediate',
    category: '核心技能',
    positionIds: ['book'],
    prerequisites: ['computer-basics-2'],
    estimatedHours: 24,
    difficulty: 3,
    resources: [
      { type: 'book', title: '《文案创作完全手册》', url: '', description: '经典文案写作指南' },
      { type: 'video', title: '如何写出让读者想买书的文案', url: '', description: '图书营销文案实战技巧' }
    ]
  },
  {
    id: 'book-4',
    name: '电商平台运营',
    description: '掌握当当、京东、天猫图书等电商平台的运营规则和推广方法',
    level: 'intermediate',
    category: '核心技能',
    positionIds: ['book'],
    prerequisites: ['book-1'],
    estimatedHours: 16,
    difficulty: 3,
    resources: [
      { type: 'course', title: '图书电商运营实战', url: '', description: '各平台规则和玩法详解' },
      { type: 'article', title: '图书类目电商运营技巧', url: '', description: '搜索优化和活动策划' }
    ]
  },
  {
    id: 'book-5',
    name: '作者关系维护',
    description: '学习如何开发作者资源、维护作者关系、配合作者进行营销活动',
    level: 'advanced',
    category: '进阶技能',
    positionIds: ['book'],
    prerequisites: ['book-2', 'book-3'],
    estimatedHours: 12,
    difficulty: 4,
    resources: [
      { type: 'article', title: '如何成为作者喜欢的编辑', url: '', description: '作者沟通和维护技巧' },
      { type: 'video', title: '作者开发与签约全流程', url: '', description: '从接触到签约的完整流程' }
    ]
  },
  {
    id: 'live-1',
    name: '直播行业认知',
    description: '了解直播电商行业格局、平台规则、主流玩法和发展趋势',
    level: 'beginner',
    category: '行业认知',
    positionIds: ['live'],
    prerequisites: [],
    estimatedHours: 6,
    difficulty: 1,
    resources: [
      { type: 'article', title: '2024直播电商行业白皮书', url: '', description: '行业数据和趋势分析' },
      { type: 'video', title: '直播运营入门：你需要知道的一切', url: '', description: '直播行业全景介绍' }
    ]
  },
  {
    id: 'live-2',
    name: '直播脚本策划',
    description: '能够撰写完整的直播脚本，包括开场、产品介绍、互动环节、促单话术等',
    level: 'intermediate',
    category: '核心技能',
    positionIds: ['live'],
    prerequisites: ['live-1'],
    estimatedHours: 20,
    difficulty: 3,
    resources: [
      { type: 'course', title: '直播脚本撰写实战', url: '', description: '不同品类脚本模板和案例' },
      { type: 'article', title: '爆款直播脚本的10个要素', url: '', description: '高转化率脚本的核心要点' }
    ]
  },
  {
    id: 'live-3',
    name: '场控与互动技巧',
    description: '掌握直播现场控制、粉丝互动、节奏把控和应急处理能力',
    level: 'intermediate',
    category: '核心技能',
    positionIds: ['live'],
    prerequisites: ['live-1'],
    estimatedHours: 16,
    difficulty: 3,
    resources: [
      { type: 'video', title: '直播场控的一天', url: '', description: '场控工作流程和技巧' },
      { type: 'article', title: '如何调动直播间气氛', url: '', description: '互动技巧和节奏把控' }
    ]
  },
  {
    id: 'live-4',
    name: '流量获取与投放',
    description: '了解直播流量机制，掌握DOU+、巨量千川等投放工具的使用',
    level: 'intermediate',
    category: '核心技能',
    positionIds: ['live'],
    prerequisites: ['live-1'],
    estimatedHours: 24,
    difficulty: 4,
    resources: [
      { type: 'course', title: '巨量千川投放实战', url: '', description: '从入门到精通的投放课程' },
      { type: 'article', title: '直播投放ROI提升技巧', url: '', description: '优化投放效果的方法' }
    ]
  },
  {
    id: 'live-5',
    name: '数据分析与优化',
    description: '能够分析直播数据（观看人数、停留时长、转化率、GMV等）并提出优化方案',
    level: 'advanced',
    category: '进阶技能',
    positionIds: ['live'],
    prerequisites: ['live-2', 'live-3', 'live-4'],
    estimatedHours: 16,
    difficulty: 4,
    resources: [
      { type: 'video', title: '直播数据分析实战', url: '', description: '核心指标解读和优化方法' },
      { type: 'article', title: '直播数据复盘指南', url: '', description: '如何从数据中发现问题' }
    ]
  },
  {
    id: 'shop-1',
    name: '电商平台规则',
    description: '熟悉淘宝、天猫、京东、拼多多等主流电商平台的规则和玩法',
    level: 'beginner',
    category: '行业认知',
    positionIds: ['shop'],
    prerequisites: [],
    estimatedHours: 10,
    difficulty: 2,
    resources: [
      { type: 'article', title: '淘宝规则中心完全解读', url: '', description: '避免违规的必学内容' },
      { type: 'video', title: '拼多多运营入门指南', url: '', description: '拼多多平台规则和特点' }
    ]
  },
  {
    id: 'shop-2',
    name: '产品上架与优化',
    description: '掌握产品标题、主图、详情页的设计与优化，提升搜索排名',
    level: 'intermediate',
    category: '核心技能',
    positionIds: ['shop'],
    prerequisites: ['shop-1', 'computer-basics-4'],
    estimatedHours: 20,
    difficulty: 3,
    resources: [
      { type: 'course', title: '淘宝标题优化实战', url: '', description: '关键词研究和标题组合技巧' },
      { type: 'article', title: '高点击率主图设计指南', url: '', description: '主图设计的核心原则' }
    ]
  },
  {
    id: 'shop-3',
    name: '流量获取与推广',
    description: '掌握直通车、钻展、淘宝客等付费推广工具，以及自然流量优化方法',
    level: 'intermediate',
    category: '核心技能',
    positionIds: ['shop'],
    prerequisites: ['shop-1'],
    estimatedHours: 28,
    difficulty: 4,
    resources: [
      { type: 'course', title: '直通车从入门到精通', url: '', description: '淘宝最核心的推广工具' },
      { type: 'article', title: '自然搜索流量提升技巧', url: '', description: 'SEO优化方法' }
    ]
  },
  {
    id: 'shop-4',
    name: '转化率优化',
    description: '从产品、价格、评价、客服等多维度提升店铺转化率',
    level: 'intermediate',
    category: '核心技能',
    positionIds: ['shop'],
    prerequisites: ['shop-2'],
    estimatedHours: 16,
    difficulty: 3,
    resources: [
      { type: 'book', title: '《电商流量密码》', url: '', description: '转化率优化经典书籍' },
      { type: 'video', title: '详情页转化率提升技巧', url: '', description: '详情页设计的心理学原理' }
    ]
  },
  {
    id: 'shop-5',
    name: '数据分析与运营',
    description: '使用生意参谋等工具分析店铺数据，制定运营策略',
    level: 'advanced',
    category: '进阶技能',
    positionIds: ['shop'],
    prerequisites: ['shop-2', 'shop-3', 'shop-4'],
    estimatedHours: 20,
    difficulty: 4,
    resources: [
      { type: 'course', title: '生意参谋数据分析实战', url: '', description: '数据指标解读和应用' },
      { type: 'article', title: '电商数据运营思维', url: '', description: '用数据驱动决策' }
    ]
  },
  {
    id: 'shortvideo-1',
    name: '短视频平台认知',
    description: '了解抖音、快手、视频号等平台的特点、规则和算法机制',
    level: 'beginner',
    category: '行业认知',
    positionIds: ['shortvideo'],
    prerequisites: [],
    estimatedHours: 8,
    difficulty: 1,
    resources: [
      { type: 'article', title: '抖音算法机制深度解析', url: '', description: '理解推荐逻辑是做好运营的基础' },
      { type: 'video', title: '视频号运营入门', url: '', description: '微信生态短视频的特点和玩法' }
    ]
  },
  {
    id: 'shortvideo-2',
    name: '内容策划与选题',
    description: '掌握用户需求分析、爆款选题方法、内容定位和账号人设打造',
    level: 'intermediate',
    category: '核心技能',
    positionIds: ['shortvideo'],
    prerequisites: ['shortvideo-1'],
    estimatedHours: 24,
    difficulty: 3,
    resources: [
      { type: 'course', title: '爆款短视频选题公式', url: '', description: '可复制的选题方法' },
      { type: 'book', title: '《内容算法》', url: '', description: '理解内容平台的底层逻辑' }
    ]
  },
  {
    id: 'shortvideo-3',
    name: '脚本撰写与拍摄',
    description: '能够撰写短视频脚本，指导拍摄，掌握镜头语言和画面构图',
    level: 'intermediate',
    category: '核心技能',
    positionIds: ['shortvideo'],
    prerequisites: ['shortvideo-2'],
    estimatedHours: 20,
    difficulty: 3,
    resources: [
      { type: 'video', title: '手机拍大片：短视频拍摄技巧', url: '', description: '用手机拍出专业感' },
      { type: 'article', title: '10种爆款短视频脚本模板', url: '', description: '直接套用的脚本框架' }
    ]
  },
  {
    id: 'shortvideo-4',
    name: '视频剪辑基础',
    description: '使用剪映、PR等工具进行视频剪辑、字幕添加、特效处理和音频处理',
    level: 'intermediate',
    category: '核心技能',
    positionIds: ['shortvideo'],
    prerequisites: ['computer-basics-1'],
    estimatedHours: 24,
    difficulty: 3,
    resources: [
      { type: 'course', title: '剪映从入门到精通', url: '', description: '最流行的手机剪辑软件' },
      { type: 'tool', title: '剪映官方教程', url: '', description: '官方学习资源' }
    ]
  },
  {
    id: 'shortvideo-5',
    name: '数据分析与增长',
    description: '分析视频数据（完播率、点赞率、转发率等），优化内容策略，实现粉丝增长',
    level: 'advanced',
    category: '进阶技能',
    positionIds: ['shortvideo'],
    prerequisites: ['shortvideo-2', 'shortvideo-3', 'shortvideo-4'],
    estimatedHours: 16,
    difficulty: 4,
    resources: [
      { type: 'article', title: '抖音数据指标完全解读', url: '', description: '核心指标及其优化方法' },
      { type: 'video', title: '如何从0到10万粉', url: '', description: '冷启动和增长策略' }
    ]
  }
];

export const getSkillsByPosition = (positionId: string): Skill[] => {
  return skills.filter(skill => 
    skill.positionIds.includes(positionId as any) || skill.isComputerBasics
  );
};

export const getSkillById = (id: string): Skill | undefined => {
  return skills.find(skill => skill.id === id);
};

export const getComputerBasicsSkills = (): Skill[] => {
  return skills.filter(skill => skill.isComputerBasics);
};
import { Task } from '../types';

export const tasks: Task[] = [
  {
    id: 'task-cb-001',
    title: '熟悉电脑基本操作',
    description: '学习Windows或Mac系统的基本操作，包括文件管理、快捷键使用等',
    detailedSteps: [
      '打开文件资源管理器（Windows）或访达（Mac）',
      '创建一个新文件夹，命名为"运营学习资料"',
      '在文件夹内创建3个子文件夹："电子书"、"课程笔记"、"练习作业"',
      '学习10个常用快捷键：复制(Ctrl+C/⌘C)、粘贴(Ctrl+V/⌘V)、撤销(Ctrl+Z/⌘Z)、保存(Ctrl+S/⌘S)、全选(Ctrl+A/⌘A)等',
      '练习使用快捷键完成一次文件复制粘贴操作'
    ],
    skillId: 'computer-basics-1',
    positionId: 'book',
    level: 'beginner',
    estimatedMinutes: 60,
    difficulty: 1,
    weekNumber: 1,
    dayOfWeek: 1,
    tags: ['电脑基础', '入门'],
    deliverables: ['创建好的文件夹结构截图', '快捷键使用笔记'],
    tips: ['快捷键是提高效率的关键，建议打印一张快捷键表贴在电脑旁', '不用刻意背诵，在使用中慢慢记住'],
    isComputerBasics: true
  },
  {
    id: 'task-cb-002',
    title: 'Excel基础入门',
    description: '学习Excel的基本操作，包括数据录入、单元格格式化、简单公式计算',
    detailedSteps: [
      '打开Excel，创建一个新工作簿',
      '在Sheet1中录入以下数据：日期、书籍名称、销售数量、单价、销售额',
      '录入5行模拟数据',
      '学习使用SUM函数计算总销售额',
      '学习使用VLOOKUP函数进行简单查找',
      '设置单元格边框和背景色，美化表格'
    ],
    skillId: 'computer-basics-2',
    positionId: 'book',
    level: 'beginner',
    estimatedMinutes: 90,
    difficulty: 2,
    weekNumber: 1,
    dayOfWeek: 2,
    tags: ['Excel', '数据分析'],
    deliverables: ['创建的Excel练习文件', '函数使用笔记'],
    tips: ['Excel函数不用死记硬背，理解逻辑更重要', '遇到问题先搜索，Excel的问题网上都有答案'],
    isComputerBasics: true
  },
  {
    id: 'task-book-001',
    title: '出版行业调研',
    description: '了解出版行业的整体格局、主要参与者和发展趋势',
    detailedSteps: [
      '搜索"2024中国出版行业报告"，阅读3篇相关文章',
      '列出国内主要的出版集团（如中信、磨铁、读客等）',
      '了解图书从选题到上市的完整流程',
      '分析电子书和纸质书的市场占比变化趋势',
      '写下你对出版行业未来发展的3点看法'
    ],
    skillId: 'book-1',
    positionId: 'book',
    level: 'beginner',
    estimatedMinutes: 120,
    difficulty: 2,
    weekNumber: 1,
    dayOfWeek: 3,
    tags: ['行业调研', '图书运营'],
    deliverables: ['行业调研笔记文档', '主要出版社列表'],
    tips: ['关注"出版人杂志"、"做书"等公众号获取行业资讯', '可以去豆瓣读书、当当网看看热门书籍']
  },
  {
    id: 'task-book-002',
    title: '模拟选题策划',
    description: '选择一个你感兴趣的图书方向，完成一份简易的选题策划方案',
    detailedSteps: [
      '确定一个你感兴趣的图书品类（如：职场、育儿、文学、科普等）',
      '在当当网、京东图书搜索该品类的Top10书籍',
      '分析这些畅销书的共同点：书名特点、封面风格、内容结构',
      '构思一个你认为有市场潜力的选题',
      '撰写简易策划方案：书名、目标读者、核心卖点、竞品分析'
    ],
    skillId: 'book-2',
    positionId: 'book',
    level: 'intermediate',
    estimatedMinutes: 180,
    difficulty: 3,
    weekNumber: 2,
    dayOfWeek: 1,
    tags: ['选题策划', '核心技能'],
    deliverables: ['选题策划方案文档', '竞品分析表格'],
    tips: ['好的选题要解决读者的"痛点"或满足"爽点"', '书名是最重要的，要反复打磨']
  },
  {
    id: 'task-book-003',
    title: '撰写图书简介文案',
    description: '选择一本你喜欢的书，为它撰写3个不同风格的简介文案',
    detailedSteps: [
      '选择一本你读过或感兴趣的书',
      '分析这本书的目标读者是谁',
      '思考这本书能给读者带来什么价值',
      '撰写第一个版本：干货实用型（突出价值）',
      '撰写第二个版本：情感共鸣型（讲故事）',
      '撰写第三个版本：好奇悬念型（引发兴趣）'
    ],
    skillId: 'book-3',
    positionId: 'book',
    level: 'intermediate',
    estimatedMinutes: 120,
    difficulty: 3,
    weekNumber: 2,
    dayOfWeek: 3,
    tags: ['文案写作', '核心技能'],
    deliverables: ['3个版本的图书简介文案', '文案写作思路笔记'],
    tips: ['好的文案不是自说自话，而是站在读者角度说话', '可以去豆瓣读书看看热门书籍的简介是怎么写的']
  },
  {
    id: 'task-live-001',
    title: '观看3场不同类型的直播',
    description: '观看并分析3场不同类型的直播，了解直播运营的基本要素',
    detailedSteps: [
      '选择3场不同类型的直播：带货直播、知识直播、娱乐直播',
      '每场直播观看至少30分钟',
      '记录每场直播的：主播风格、直播节奏、互动方式、产品介绍方式',
      '分析哪场直播让你最想停留，为什么',
      '写下你对3场直播的改进建议'
    ],
    skillId: 'live-1',
    positionId: 'live',
    level: 'beginner',
    estimatedMinutes: 150,
    difficulty: 1,
    weekNumber: 1,
    dayOfWeek: 1,
    tags: ['直播观察', '入门'],
    deliverables: ['直播观察笔记', '3场直播对比分析表'],
    tips: ['带着问题看直播，而不是单纯看热闹', '关注评论区的互动，了解观众关心什么']
  },
  {
    id: 'task-live-002',
    title: '撰写一份直播脚本',
    description: '选择一个虚拟产品，撰写一份完整的直播带货脚本',
    detailedSteps: [
      '选择一个虚拟带货产品（如：一款保温杯、一本畅销书、一套护肤品）',
      '确定目标受众：谁会买这个产品',
      '撰写脚本结构：开场(5分钟)、产品介绍(15分钟)、互动环节(10分钟)、促单(10分钟)',
      '详细撰写每部分的话术',
      '设计互动小游戏或福利环节'
    ],
    skillId: 'live-2',
    positionId: 'live',
    level: 'intermediate',
    estimatedMinutes: 180,
    difficulty: 3,
    weekNumber: 2,
    dayOfWeek: 2,
    tags: ['脚本撰写', '核心技能'],
    deliverables: ['完整的直播脚本', '产品卖点分析'],
    tips: ['好的脚本要有"钩子"，开场就要抓住观众', '产品介绍要讲"好处"，而不是"功能"']
  },
  {
    id: 'task-shop-001',
    title: '淘宝店铺注册与后台熟悉',
    description: '了解淘宝开店流程，熟悉卖家后台的主要功能模块',
    detailedSteps: [
      '搜索"淘宝开店流程"，阅读官方指南',
      '了解个人店铺和企业店铺的区别',
      '登录淘宝卖家中心（如果没有账号可以用游客模式浏览）',
      '熟悉以下模块：商品管理、订单管理、营销中心、数据中心',
      '了解"千牛"工作台的主要功能'
    ],
    skillId: 'shop-1',
    positionId: 'shop',
    level: 'beginner',
    estimatedMinutes: 90,
    difficulty: 2,
    weekNumber: 1,
    dayOfWeek: 1,
    tags: ['平台规则', '入门'],
    deliverables: ['淘宝开店流程笔记', '卖家后台功能导图'],
    tips: ['平台规则会经常更新，要养成看规则中心的习惯', '可以关注"淘宝大学"学习官方教程']
  },
  {
    id: 'task-shop-002',
    title: '模拟商品上架',
    description: '选择一个商品，完成从标题撰写到详情页设计的完整上架流程',
    detailedSteps: [
      '选择一个虚拟商品（如：一款男士剃须刀）',
      '在淘宝搜索同类商品，分析Top10商品的标题关键词',
      '为你的商品撰写一个30字以内的标题',
      '设计5张主图的内容构思（每张图展示什么卖点）',
      '撰写详情页的内容框架：痛点引入→产品展示→卖点详解→用户评价→售后保障'
    ],
    skillId: 'shop-2',
    positionId: 'shop',
    level: 'intermediate',
    estimatedMinutes: 150,
    difficulty: 3,
    weekNumber: 2,
    dayOfWeek: 2,
    tags: ['商品上架', '核心技能'],
    deliverables: ['商品标题', '主图构思方案', '详情页框架'],
    tips: ['标题关键词决定了搜索流量，要反复研究', '主图是点击率的关键，要有差异化']
  },
  {
    id: 'task-shortvideo-001',
    title: '抖音竞品账号分析',
    description: '选择3个同类型的抖音账号，分析他们的内容策略和数据表现',
    detailedSteps: [
      '确定你感兴趣的内容赛道（如：职场、美妆、美食、知识等）',
      '在抖音上找到3个该赛道的头部账号',
      '分析每个账号的：账号定位、内容形式、更新频率、粉丝画像',
      '选择每个账号的3条爆款视频，分析为什么会火',
      '总结你可以借鉴的3个点'
    ],
    skillId: 'shortvideo-1',
    positionId: 'shortvideo',
    level: 'beginner',
    estimatedMinutes: 120,
    difficulty: 2,
    weekNumber: 1,
    dayOfWeek: 2,
    tags: ['竞品分析', '入门'],
    deliverables: ['3个账号分析报告', '可借鉴点总结'],
    tips: ['不要只看大V，也要关注刚起步但增长快的账号', '关注完播率、点赞率、转发率等数据指标']
  },
  {
    id: 'task-shortvideo-002',
    title: '撰写3个短视频脚本',
    description: '根据你的账号定位，撰写3个不同类型的短视频脚本',
    detailedSteps: [
      '确定你的账号定位：给谁看？提供什么价值？',
      '撰写第一个脚本：干货知识型（30秒以内）',
      '撰写第二个脚本：情感共鸣型（1分钟左右）',
      '撰写第三个脚本：剧情反转型（1-2分钟）',
      '每个脚本包含：画面描述、台词/旁白、字幕提示、BGM建议'
    ],
    skillId: 'shortvideo-3',
    positionId: 'shortvideo',
    level: 'intermediate',
    estimatedMinutes: 180,
    difficulty: 3,
    weekNumber: 2,
    dayOfWeek: 3,
    tags: ['脚本撰写', '核心技能'],
    deliverables: ['3个完整脚本', '账号定位说明'],
    tips: ['短视频的前3秒是"黄金3秒"，决定了用户是否会继续看', '多用"你"这个字，让观众有代入感']
  }
];

export const getTasksByPosition = (positionId: string): Task[] => {
  return tasks.filter(task => task.positionId === positionId || task.isComputerBasics);
};

export const getTasksBySkill = (skillId: string): Task[] => {
  return tasks.filter(task => task.skillId === skillId);
};

export const getTasksByWeek = (positionId: string, weekNumber: number): Task[] => {
  return tasks.filter(task => (task.positionId === positionId || task.isComputerBasics) && task.weekNumber === weekNumber);
};

export const getTaskById = (id: string): Task | undefined => {
  return tasks.find(task => task.id === id);
};
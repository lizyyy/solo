(function() {
  'use strict';

  // ==================== 数据定义 ====================
  
  const salaryTiers = {
    '3k': {
      id: '3k', name: '生存模式', displayName: '3000元档',
      minSalary: 0, maxSalary: 3000, color: '#95a5a6',
      icon: '🏠', description: '先活下去，再谈生活',
      consumption: {
        diet: { title: '饮食', daily: '15-25元/天', monthly: '450-750元', details: ['早餐：包子、粥、豆浆（3-5元）', '午餐：公司食堂、外卖特惠（10-15元）'] },
        housing: { title: '租房', monthly: '800-1200元', details: ['合租单间，4-6人合租', '距离地铁1-2公里'] },
        clothing: { title: '穿搭', monthly: '50-100元', details: ['拼多多、1688、淘宝特价版', '换季才买'] },
        skincare: { title: '护肤', monthly: '30-50元', details: ['大宝、百雀羚等国民品牌', '洗面奶+爽肤水+乳液'] },
        entertainment: { title: '娱乐', monthly: '80-150元', details: ['视频平台会员：拼单共享', '周末宅家刷剧'] },
        savings: { title: '存款', monthly: '200-300元', details: ['每月强制存，哪怕只有200', '目标：先存够3个月生活费'] }
      },
      avoidWaste: ['不要办健身房年卡', '不要买各种网红零食', '不要超前消费'],
      cheapJoy: ['周末去公园散步', '图书馆看书', '菜市场买菜自己做饭'],
      mindset: {
        current: ['接受现状，3k月薪不是你的全部', '不要和别人比'],
        nextStep: { target: '9k档', goals: ['提升专业技能', '学习一门副业'], ways: ['免费网课', '技能学习'] }
      },
      realLife: { work: '流水线工人、服务员', location: '城中村', transportation: '公交', dailyRoutine: '早上7点起，晚上9点回', dreams: '希望下个月能涨工资' }
    },
    '9k': {
      id: '9k', name: '生活模式', displayName: '9000元档',
      minSalary: 3001, maxSalary: 9000, color: '#3498db',
      icon: '🏢', description: '终于可以谈谈生活品质了',
      consumption: {
        diet: { title: '饮食', daily: '30-50元/天', monthly: '900-1500元', details: ['早餐：肯德基、麦当劳', '午餐：公司附近商圈'] },
        housing: { title: '租房', monthly: '2500-3500元', details: ['2-3人合租，有独立卫生间', '距离地铁1公里内'] },
        clothing: { title: '穿搭', monthly: '300-500元', details: ['优衣库、ZARA、H&M快时尚', '每季买2-3件新衣服'] },
        skincare: { title: '护肤', monthly: '200-300元', details: ['欧莱雅、玉兰油、珂润等中端品牌', '开始注重防晒'] },
        entertainment: { title: '娱乐', monthly: '500-800元', details: ['视频会员自己充', '每月看1-2场电影'] },
        savings: { title: '存款', monthly: '800-1500元', details: ['每月强制存10%左右', '目标：存够首付'] }
      },
      avoidWaste: ['不要为了面子买超出能力的奢侈品', '不要频繁换手机'],
      cheapJoy: ['办一张图书馆借书证', '公园跑步', '自己研究美食'],
      mindset: {
        current: ['你已经超过很多人了，要知足', '但也不要安于现状'],
        nextStep: { target: '3w档', goals: ['成为团队核心', '发展稳定副业'], ways: ['主动承担更多责任', '学习管理知识'] }
      },
      realLife: { work: '互联网运营、设计师', location: '市区近郊小区', transportation: '地铁', dailyRoutine: '早上8点起，晚上8点回', dreams: '希望能在这个城市扎根' }
    },
    '3w': {
      id: '3w', name: '品质模式', displayName: '30000元档',
      minSalary: 9001, maxSalary: 30000, color: '#27ae60',
      icon: '🏡', description: '开始追求真正的生活品质',
      consumption: {
        diet: { title: '饮食', daily: '80-150元/天', monthly: '2400-4500元', details: ['早餐：wagas、星爸爸', '午餐：高端商务餐厅'] },
        housing: { title: '租房', monthly: '6000-10000元', details: ['独居一居室或小两居', '市中心或地铁口高端小区'] },
        clothing: { title: '穿搭', monthly: '1500-2500元', details: ['开始买品牌：Coach、MK', '每季买几件品质单品'] },
        skincare: { title: '护肤', monthly: '1000-2000元', details: ['SK-II、雅诗兰黛、兰蔻', '开始做医美'] },
        entertainment: { title: '娱乐', monthly: '2000-3500元', details: ['演唱会、话剧常客', '每年2-3次国内旅游'] },
        savings: { title: '存款', monthly: '5000-8000元', details: ['每月强制存20%以上', '开始考虑买房'] }
      },
      avoidWaste: ['不要盲目追求奢侈品Logo', '不要为了社交而社交'],
      cheapJoy: ['早起看日出', '自己做咖啡', '学一项乐器'],
      mindset: {
        current: ['你已经是社会中坚力量了', '但不要忘记保持谦逊'],
        nextStep: { target: '5w档', goals: ['成为行业专家', '创业或成为合伙人'], ways: ['深耕行业', '创业：找到痛点'] }
      },
      realLife: { work: '互联网大厂P6-P7', location: '市中心高端小区', transportation: '自己开车', dailyRoutine: '工作时间相对自由', dreams: '希望能实现财务自由' }
    },
    '5w': {
      id: '5w', name: '舒适模式', displayName: '50000元档',
      minSalary: 30001, maxSalary: 50000, color: '#9b59b6',
      icon: '🏘️', description: '生活已进入舒适区',
      consumption: {
        diet: { title: '饮食', monthly: '4500-9000元', details: ['有机食材、进口水果', '高端商务餐厅'] },
        housing: { title: '住房', monthly: '12000-20000元', details: ['市区大两居或小三居', '学区房、地铁口'] },
        clothing: { title: '穿搭', monthly: '3000-5000元', details: ['奢侈品入门：LV、Gucci', '定制西装、高级成衣'] },
        skincare: { title: '护肤', monthly: '2000-4000元', details: ['La Mer、莱珀妮、赫莲娜', '定期医美'] },
        entertainment: { title: '娱乐', monthly: '5000-8000元', details: ['高端会所会员', '每年2-3次国外旅游'] },
        savings: { title: '资产配置', monthly: '10000-20000元', details: ['多元化投资组合', '房产、股票、基金'] }
      },
      avoidWaste: ['不要为了炫富而消费', '不要忽视健康'],
      cheapJoy: ['和家人一起做饭', '周末去郊外徒步', '读一本好书'],
      mindset: {
        current: ['你已经实现了大多数人的梦想', '但真正的富有是内心的富足'],
        nextStep: { target: '10w档', goals: ['实现财务自由', '成为行业领袖'], ways: ['创业升级', '投资：成为天使投资人'] }
      },
      realLife: { work: '大厂P8-P9、创业公司创始人', location: '市中心豪宅', transportation: '专车司机', dailyRoutine: '时间自由但责任重大', dreams: '希望能改变世界' }
    },
    '10w': {
      id: '10w', name: '自由模式', displayName: '100000元档',
      minSalary: 50001, maxSalary: 999999, color: '#f39c12',
      icon: '🏰', description: '真正的财务自由开始了',
      consumption: {
        diet: { title: '饮食', monthly: '不设上限，但追求健康', details: ['私人厨师、定制营养餐', '米其林三星'] },
        housing: { title: '住房', monthly: '房产已成为资产配置的一部分', details: ['一线城市多套房产', '别墅、大平层'] },
        clothing: { title: '穿搭', monthly: '品牌已不重要，适合自己最重要', details: ['高级定制、设计师品牌', '低调奢华'] },
        skincare: { title: '保养', monthly: '全方位抗衰管理', details: ['全球顶级医美机构', '私人医生'] },
        entertainment: { title: '生活方式', monthly: '追求体验和意义', details: ['私人飞机、游艇', '环球旅行'] },
        savings: { title: '财富管理', monthly: '资产增值成为主要目标', details: ['家族办公室、私人银行', '多元化资产配置'] }
      },
      avoidWaste: ['不要忘记初心', '不要忽视健康'],
      cheapJoy: ['和家人一起', '帮助别人', '大自然'],
      mindset: {
        current: ['你已经站在金字塔顶端', '但真正的自由是内心的自由'],
        nextStep: { target: '自我实现', goals: ['实现自我价值', '为社会做出重大贡献'], ways: ['慈善', '教育'] }
      },
      realLife: { work: '上市公司创始人/CEO', location: '全球多处房产', transportation: '私人飞机', dailyRoutine: '时间由自己掌控', dreams: '希望能留下有价值的东西' }
    }
  };

  const tierList = ['3k', '9k', '3w', '5w', '10w'];

  const categories = [
    { id: 'all', name: '全部' },
    { id: 'daily', name: '日常分享' },
    { id: 'money', name: '理财存钱' },
    { id: 'career', name: '职场交流' },
    { id: 'emotion', name: '情感树洞' },
    { id: 'food', name: '美食探店' }
  ];

  const mockPosts = [
    {
      id: 1, user: { id: 'u1', nickname: '月光族小A', avatar: '👩', tier: '3k', isFriend: false },
      category: 'daily', content: '今天发工资了！3000块，虽然不多，但都是自己努力赚的。存了1000，剩下的当生活费。继续加油，未来会更好的！💪',
      images: [], likes: 128, comments: 23, shares: 5, isLiked: false, createTime: '2024-01-15 10:30'
    },
    {
      id: 2, user: { id: 'u2', nickname: '打工人小王', avatar: '👨', tier: '9k', isFriend: true },
      category: 'money', content: '月薪9k，房租2500，吃饭1500，每个月能存3000。虽然不算多，但很踏实。大家每个月能存多少钱？',
      images: [], likes: 256, comments: 67, shares: 12, isLiked: true, createTime: '2024-01-14 18:45'
    },
    {
      id: 3, user: { id: 'u3', nickname: '产品经理小李', avatar: '👨‍💼', tier: '3w', isFriend: false },
      category: 'career', content: '月薪3万，但房贷15000，车贷5000，孩子幼儿园3000。剩下的7000要支付生活费。不敢辞职，不敢生病。但看到孩子的笑脸，觉得一切都值得。👨‍👩‍👧',
      images: [], likes: 512, comments: 134, shares: 45, isLiked: false, createTime: '2024-01-13 21:20'
    },
    {
      id: 4, user: { id: 'u4', nickname: '省钱小能手', avatar: '🧑', tier: '3k', isFriend: false },
      category: 'money', content: '周末去公园散步，免费的阳光和空气，也很美好。有时候快乐不需要花钱。',
      images: [], likes: 345, comments: 89, shares: 56, isLiked: false, createTime: '2024-01-12 14:15'
    }
  ];

  const mockComments = {
    1: [
      { id: 'c1', user: { nickname: '加油打工人', avatar: '💪' }, content: '加油！未来可期！', createTime: '2024-01-15 11:00' },
      { id: 'c2', user: { nickname: '省钱达人', avatar: '💰' }, content: '能存1000已经很棒了！', createTime: '2024-01-15 12:30' }
    ]
  };

  const mentalHealthData = {
    anxietyRelief: [
      { id: 1, title: '为什么你总是在焦虑？', content: '焦虑的根源往往是比较。你刷着朋友圈，看着别人晒的精致生活，觉得自己过得很差。', icon: '😔' },
      { id: 2, title: '接受自己的普通，然后全力以赴', content: '这个世界上99%的人都是普通人。接受这个事实，不是认输，而是清醒。', icon: '💪' }
    ],
    realLifeStories: [
      { id: 1, tier: '3k', title: '我在深圳月薪3000的日子', avatar: '👩', author: '小A', age: 24, city: '深圳', job: '行政前台', content: '我今年24岁，在深圳做行政前台，月薪3000，包吃住。很多人说深圳月薪3000活不下去，但我活下来了。', likes: 1234, comments: 89 }
    ],
    warnings: [
      { id: 1, title: '不要跨薪资消费', content: '月薪3000，就不要去买10000的包；月薪5000，就不要去追求最新款的iPhone。', icon: '⚠️' }
    ],
    comfortingQuotes: [
      '接受自己的普通，然后全力以赴地出众。',
      '慢慢来，比较快。',
      '你已经很努力了，剩下的交给时间。'
    ]
  };

  const wallpaperData = {
    '3k': {
      tier: '3k', name: '生存模式',
      quotes: [
        { id: 1, content: '先活下去，再谈生活。', category: '励志', wallpaper: true },
        { id: 2, content: '月薪3000，不代表人生3000。', category: '励志', wallpaper: true }
      ],
      wallpapers: [
        { id: 101, title: '先活下去，再谈生活', description: '简约黑白风格', color: '#95a5a6', textColor: '#ffffff' }
      ],
      '朋友圈文案': [
        { id: 201, content: '今天发工资了，3000块。虽然不多，但都是自己努力赚的。', tags: ['#打工人', '#存钱', '#加油'] }
      ]
    },
    '9k': {
      tier: '9k', name: '生活模式',
      quotes: [
        { id: 7, content: '月薪9000，可以谈谈生活品质了。', category: '生活', wallpaper: true },
        { id: 8, content: '比上不足，比下有余。知足常乐。', category: '心态', wallpaper: true }
      ],
      wallpapers: [
        { id: 103, title: '该省省该花花', description: '清新蓝色系', color: '#3498db', textColor: '#ffffff' }
      ],
      '朋友圈文案': [
        { id: 204, content: '月薪9k，房租2500，吃饭1500，每个月能存3000。', tags: ['#月薪9k', '#存钱', '#买房'] }
      ]
    },
    '3w': {
      tier: '3w', name: '品质模式',
      quotes: [
        { id: 11, content: '月薪3万，开始追求真正的生活品质。', category: '品质', wallpaper: true },
        { id: 12, content: '你已经是社会中坚力量了，但不要忘记保持谦逊。', category: '心态', wallpaper: true },
        { id: 13, content: '工作生活平衡很重要，别让工作占据全部。', category: '生活', wallpaper: true }
      ],
      wallpapers: [
        { id: 105, title: '品质生活', description: '活力绿色系', color: '#27ae60', textColor: '#ffffff' },
        { id: 106, title: '保持谦逊', description: '清新简约风', color: '#2ecc71', textColor: '#ffffff' }
      ],
      '朋友圈文案': [
        { id: 207, content: '月薪3万，房贷15000，车贷5000，孩子幼儿园3000。虽然压力大，但看到家人的笑脸，一切都值得。', tags: ['#月薪3w', '#家庭', '#责任'] },
        { id: 208, content: '周末带家人去近郊自驾游，享受难得的亲子时光。工作再忙，也要抽时间陪陪家人。', tags: ['#周末', '#家庭', '#生活'] }
      ]
    },
    '5w': {
      tier: '5w', name: '舒适模式',
      quotes: [
        { id: 15, content: '生活已进入舒适区，但不要停止成长。', category: '成长', wallpaper: true },
        { id: 16, content: '你已经实现了大多数人的梦想，但真正的富有是内心的富足。', category: '心态', wallpaper: true },
        { id: 17, content: '开始思考人生的意义和价值。', category: '思考', wallpaper: true }
      ],
      wallpapers: [
        { id: 107, title: '舒适生活', description: '优雅紫色系', color: '#9b59b6', textColor: '#ffffff' },
        { id: 108, title: '内心富足', description: '深邃紫色系', color: '#8e44ad', textColor: '#ffffff' }
      ],
      '朋友圈文案': [
        { id: 209, content: '月薪5万，但最怀念的还是刚毕业时月薪3000的日子。那时候虽然穷，但很快乐。开始反思，赚钱是为了什么？', tags: ['#思考', '#生活', '#人生'] },
        { id: 210, content: '开始学习投资和理财，让钱为自己工作。被动收入越来越重要了。', tags: ['#理财', '#投资', '#财务自由'] }
      ]
    },
    '10w': {
      tier: '10w', name: '自由模式',
      quotes: [
        { id: 19, content: '真正的财务自由开始了。', category: '自由', wallpaper: true },
        { id: 20, content: '你已经站在金字塔顶端，但真正的自由是内心的自由。', category: '心态', wallpaper: true },
        { id: 21, content: '能力越大，责任越大。考虑如何回馈社会。', category: '责任', wallpaper: true }
      ],
      wallpapers: [
        { id: 109, title: '财务自由', description: '金色系', color: '#f39c12', textColor: '#ffffff' },
        { id: 110, title: '内心自由', description: '温暖橙色系', color: '#e67e22', textColor: '#ffffff' }
      ],
      '朋友圈文案': [
        { id: 211, content: '月薪10万+，但最想要的还是健康和家人的陪伴。去年体检出一堆毛病，开始调整生活方式。钱很重要，但健康和家人更重要。', tags: ['#健康', '#家庭', '#生活'] },
        { id: 212, content: '开始做一些公益和慈善，帮助更多需要帮助的人。能力越大，责任越大。希望能给这个世界留下一些有价值的东西。', tags: ['#公益', '#慈善', '#回馈社会'] }
      ]
    }
  };

  const universalQuotes = [
    { id: 1001, content: '接受自己的普通，然后全力以赴地出众。', category: '励志' },
    { id: 1002, content: '慢慢来，比较快。', category: '心态' },
    { id: 1003, content: '你已经很努力了，剩下的交给时间。', category: '治愈' }
  ];

  const goodsData = {
    '3k': {
      tier: '3k', title: '平价好物推荐', description: '性价比优先，便宜又好用',
      categories: [
        { name: '护肤彩妆', items: [
          { id: 1, name: '大宝SOD蜜', price: '19.9元', originalPrice: '29.9元', description: '国民润肤乳，滋润不油腻', reason: '便宜大碗，保湿效果好', buyLink: '各大超市', rating: 4.8, sales: '100万+' }
        ]}
      ]
    },
    '9k': {
      tier: '9k', title: '性价比好物推荐', description: '追求品质，但不盲目追求品牌',
      categories: [
        { name: '护肤彩妆', items: [
          { id: 10, name: '珂润保湿面霜', price: '150元左右', originalPrice: '188元', description: '敏感肌友好', reason: '成分安全', buyLink: '电商平台', rating: 4.9, sales: '500万+' }
        ]}
      ]
    },
    '3w': {
      tier: '3w', title: '品质好物推荐', description: '追求品质和体验，开始注重品牌',
      categories: [
        { name: '护肤彩妆', items: [
          { id: 17, name: 'SK-II神仙水', price: '1500元/230ml', originalPrice: '1590元', description: '调节肌肤状态', reason: '成分简单但有效', buyLink: '专柜', rating: 4.9, sales: '1000万+' }
        ]}
      ]
    }
  };

  const tierGoods = {
    '3k': goodsData['3k'],
    '9k': goodsData['9k'],
    '3w': goodsData['3w'],
    '5w': goodsData['3w'],
    '10w': goodsData['3w']
  };

  let currentFilter = 'all';

  // ==================== 全局状态管理 ====================
  const AppData = {
    globalData: {
      userInfo: null,
      currentSalary: null,
      currentTier: null,
      checkinRecords: [],
      incomeRecords: [],
      friends: [],
      posts: []
    },
    
    saveUserInfo: function(userInfo) {
      this.globalData.userInfo = userInfo;
      localStorage.setItem('userInfo', JSON.stringify(userInfo));
    },
    
    getUserInfo: function() {
      if (this.globalData.userInfo) {
        return this.globalData.userInfo;
      }
      const stored = localStorage.getItem('userInfo');
      if (stored) {
        this.globalData.userInfo = JSON.parse(stored);
        return this.globalData.userInfo;
      }
      return null;
    },
    
    saveCheckinRecords: function(records) {
      this.globalData.checkinRecords = records;
      localStorage.setItem('checkinRecords', JSON.stringify(records));
    },
    
    getCheckinRecords: function() {
      if (this.globalData.checkinRecords.length > 0) {
        return this.globalData.checkinRecords;
      }
      const stored = localStorage.getItem('checkinRecords');
      if (stored) {
        this.globalData.checkinRecords = JSON.parse(stored);
        return this.globalData.checkinRecords;
      }
      return [];
    },
    
    saveIncomeRecords: function(records) {
      this.globalData.incomeRecords = records;
      localStorage.setItem('incomeRecords', JSON.stringify(records));
    },
    
    getIncomeRecords: function() {
      if (this.globalData.incomeRecords.length > 0) {
        return this.globalData.incomeRecords;
      }
      const stored = localStorage.getItem('incomeRecords');
      if (stored) {
        this.globalData.incomeRecords = JSON.parse(stored);
        return this.globalData.incomeRecords;
      }
      return [];
    }
  };

  // ==================== 模拟 wx 对象 ====================
  window.wx = {
    showToast: function(options) {
      const toast = document.createElement('div');
      toast.className = 'toast';
      toast.textContent = options.title || '';
      document.body.appendChild(toast);
      setTimeout(() => {
        toast.remove();
      }, 2000);
    },
    
    setStorageSync: function(key, value) {
      localStorage.setItem(key, JSON.stringify(value));
    },
    
    getStorageSync: function(key) {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    },
    
    switchTab: function(options) {
      const path = options.url;
      let page = 'index';
      if (path.includes('calculator')) page = 'calculator';
      if (path.includes('social')) page = 'social';
      if (path.includes('profile')) page = 'profile';
      Router.switchTab(page);
    },
    
    navigateTo: function(options) {
      const path = options.url;
      Router.navigateTo(path);
    },
    
    navigateBack: function(options) {
      Router.navigateBack();
    },
    
    getUserProfile: function(options) {
      const userInfo = {
        nickname: '打工人' + Math.floor(Math.random() * 10000),
        avatar: '👤',
        salary: null
      };
      AppData.saveUserInfo(userInfo);
      if (options.success) {
        options.success({ userInfo: userInfo });
      }
      wx.showToast({ title: '登录成功', icon: 'success' });
    }
  };

  // ==================== 页面路由系统 ====================
  const Router = {
    currentPage: 'index',
    pageHistory: [],
    pageParams: {},
    
    switchTab: function(page) {
      this.currentPage = page;
      this.pageHistory = [page];
      this.renderPage(page);
      this.updateTabbar(page);
    },
    
    navigateTo: function(path) {
      let page = '';
      let params = {};
      
      if (path.includes('tier-detail')) {
        page = 'tier-detail';
        const tierMatch = path.match(/tier=([^&]+)/);
        if (tierMatch) params.tier = tierMatch[1];
      } else if (path.includes('comparison')) {
        page = 'comparison';
      } else if (path.includes('mental-health')) {
        page = 'mental-health';
      } else if (path.includes('checkin')) {
        page = 'checkin';
      } else if (path.includes('goods')) {
        page = 'goods';
      } else if (path.includes('wallpaper')) {
        page = 'wallpaper';
      } else if (path.includes('post-detail')) {
        page = 'post-detail';
        const idMatch = path.match(/id=([^&]+)/);
        if (idMatch) params.id = idMatch[1];
      } else if (path.includes('create-post')) {
        page = 'create-post';
      } else {
        page = 'index';
      }
      
      this.pageHistory.push(this.currentPage);
      this.currentPage = page;
      this.pageParams = params;
      this.renderPage(page, params);
    },
    
    navigateBack: function() {
      if (this.pageHistory.length > 0) {
        const prevPage = this.pageHistory.pop();
        this.currentPage = prevPage;
        this.renderPage(prevPage);
        if (['index', 'calculator', 'social', 'profile'].includes(prevPage)) {
          this.updateTabbar(prevPage);
        }
      }
    },
    
    renderPage: function(page, params) {
      const container = document.getElementById('miniprogram-container');
      let content = '';
      
      switch (page) {
        case 'index':
          content = renderIndexPage();
          break;
        case 'calculator':
          content = renderCalculatorPage();
          break;
        case 'social':
          content = renderSocialPage();
          break;
        case 'profile':
          content = renderProfilePage();
          break;
        case 'tier-detail':
          content = renderTierDetailPage(params);
          break;
        case 'comparison':
          content = renderComparisonPage();
          break;
        case 'mental-health':
          content = renderMentalHealthPage();
          break;
        case 'checkin':
          content = renderCheckinPage();
          break;
        case 'goods':
          content = renderGoodsPage();
          break;
        case 'wallpaper':
          content = renderWallpaperPage();
          break;
        case 'post-detail':
          content = renderPostDetailPage(params);
          break;
        case 'create-post':
          content = renderCreatePostPage();
          break;
        default:
          content = renderIndexPage();
      }
      
      container.innerHTML = content;
      bindPageEvents(page);
    },
    
    updateTabbar: function(page) {
      const tabItems = document.querySelectorAll('.tabbar-item');
      tabItems.forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === page) {
          item.classList.add('active');
        }
      });
    }
  };

  window.Router = Router;

  // ==================== 页面渲染函数 ====================
  
  function renderIndexPage() {
    const userInfo = AppData.getUserInfo();
    const dailyQuote = universalQuotes[Math.floor(Math.random() * universalQuotes.length)];
    const hotPosts = mockPosts.slice(0, 3);
    
    let tierListHtml = '';
    tierList.forEach(tierId => {
      const tier = salaryTiers[tierId];
      tierListHtml += `
        <div class="tier-item" onclick="goToTierDetail('${tierId}')">
          <div class="tier-icon">${tier.icon}</div>
          <div class="tier-name">${tier.displayName}</div>
          <div class="tier-mode">${tier.name}</div>
        </div>
      `;
    });
    
    let userSection = '';
    if (userInfo) {
      const userTier = userInfo.salary ? getSalaryTier(userInfo.salary) : null;
      userSection = `
        <div class="header-card">
          <div class="user-avatar">${userInfo.avatar || '👤'}</div>
          <div class="header-title">${userInfo.nickname}</div>
          ${userTier ? `<div class="user-tier">${getTierName(userTier)}</div>` : ''}
          ${userInfo.salary ? `<div style="margin-top:8px;font-size:14px;opacity:0.9;">月薪 ¥${formatMoney(userInfo.salary)}</div>` : ''}
        </div>
      `;
    } else {
      userSection = `
        <div class="header-card">
          <div class="header-title">📱 工资等级生存</div>
          <div class="header-subtitle">找到你的档位，过好当下生活</div>
          <button style="margin-top:12px;padding:8px 24px;background:rgba(255,255,255,0.2);border:none;border-radius:20px;color:#fff;cursor:pointer;" onclick="handleLogin()">点击登录</button>
        </div>
      `;
    }
    
    let hotPostsHtml = '';
    hotPosts.forEach(post => {
      hotPostsHtml += `
        <div class="post-item" style="padding:12px;margin-bottom:8px;cursor:pointer;" onclick="goToPostDetail(${post.id})">
          <div style="display:flex;align-items:center;margin-bottom:8px;">
            <div style="width:32px;height:32px;border-radius:50%;background:#f5f5f5;display:flex;align-items:center;justify-content:center;margin-right:8px;font-size:16px;">${post.user.avatar}</div>
            <div>
              <div style="font-size:13px;font-weight:500;">${post.user.nickname}</div>
              <div style="font-size:11px;color:#999;">${getTierName(post.user.tier)}</div>
            </div>
          </div>
          <div style="font-size:13px;color:#333;line-height:1.5;">${post.content.substring(0, 50)}...</div>
        </div>
      `;
    });
    
    return `
      <div class="page-container">
        ${userSection}
        
        <div class="card">
          <div style="font-size:14px;font-weight:600;color:#333;margin-bottom:12px;">💼 选择你的薪资档位</div>
          <div class="tier-scroll">
            ${tierListHtml}
          </div>
        </div>
        
        <div class="quick-grid">
          <div class="quick-item" onclick="goToCalculator()">
            <div class="quick-icon">🧮</div>
            <div class="quick-text">薪资计算器</div>
          </div>
          <div class="quick-item" onclick="goToComparison()">
            <div class="quick-icon">📊</div>
            <div class="quick-text">对照图鉴</div>
          </div>
          <div class="quick-item" onclick="goToMentalHealth()">
            <div class="quick-icon">💚</div>
            <div class="quick-text">心态治愈</div>
          </div>
          <div class="quick-item" onclick="goToCheckin()">
            <div class="quick-icon">📅</div>
            <div class="quick-text">存钱打卡</div>
          </div>
          <div class="quick-item" onclick="goToGoods()">
            <div class="quick-icon">🎁</div>
            <div class="quick-text">好物推荐</div>
          </div>
          <div class="quick-item" onclick="goToWallpaper()">
            <div class="quick-icon">🖼️</div>
            <div class="quick-text">文案壁纸</div>
          </div>
        </div>
        
        <div class="daily-quote">
          <div class="quote-title">💡 今日寄语</div>
          <div class="quote-content">${dailyQuote.content}</div>
        </div>
        
        <div class="card">
          <div style="font-size:14px;font-weight:600;color:#333;margin-bottom:12px;">🔥 热门帖子</div>
          ${hotPostsHtml}
        </div>
      </div>
    `;
  }

  function renderCalculatorPage() {
    return `
      <div class="page-container">
        <div class="calc-header">
          <div class="calc-icon">🧮</div>
          <div class="calc-title">薪资分配计算器</div>
        </div>
        
        <div class="input-section">
          <div class="input-label">请输入你的月薪（元）</div>
          <div class="input-wrapper">
            <span class="input-prefix">¥</span>
            <input type="number" class="money-input" id="salary-input" placeholder="0" oninput="handleSalaryInput(this.value)">
          </div>
          <div class="quick-select">
            <div class="quick-btn" onclick="setQuickSalary(3000)">3k</div>
            <div class="quick-btn" onclick="setQuickSalary(9000)">9k</div>
            <div class="quick-btn" onclick="setQuickSalary(30000)">3w</div>
            <div class="quick-btn" onclick="setQuickSalary(50000)">5w</div>
            <div class="quick-btn" onclick="setQuickSalary(100000)">10w</div>
          </div>
        </div>
        
        <button class="calc-btn" onclick="calculateAndShowResult()">开始计算</button>
        
        <div id="result-section" style="display:none;">
          <div class="result-section">
            <div class="result-title">
              分配结果
              <span class="tier-badge" id="result-tier"></span>
            </div>
            
            <div class="visual-ratio" id="visual-ratio"></div>
            
            <div class="allocation-list" id="allocation-list"></div>
          </div>
        </div>
      </div>
    `;
  }

  function renderSocialPage() {
    const userInfo = AppData.getUserInfo();
    const userTier = userInfo && userInfo.salary ? getSalaryTier(userInfo.salary) : null;
    
    let filteredPosts = mockPosts;
    
    if (currentFilter === 'sameTier' && userTier) {
      filteredPosts = mockPosts.filter(p => p.user.tier === userTier);
    } else if (currentFilter === 'friends') {
      filteredPosts = mockPosts.filter(p => p.user.isFriend);
    }
    
    let categoryHtml = '';
    categories.forEach(cat => {
      categoryHtml += `
        <div class="category-item ${cat.id === 'all' ? 'active' : ''}" data-category="${cat.id}" onclick="selectCategory('${cat.id}')">
          ${cat.name}
        </div>
      `;
    });
    
    let postsHtml = '';
    if (filteredPosts.length === 0) {
      if (currentFilter === 'sameTier') {
        postsHtml = '<div style="text-align:center;padding:40px;color:#999;">暂无同档位的帖子</div>';
      } else if (currentFilter === 'friends') {
        postsHtml = '<div style="text-align:center;padding:40px;color:#999;">暂无关注的帖子，去社交圈关注一些人吧~</div>';
      } else {
        postsHtml = '<div style="text-align:center;padding:40px;color:#999;">暂无帖子</div>';
      }
    } else {
      filteredPosts.forEach((post) => {
        const commentCount = mockComments[post.id] ? mockComments[post.id].length : 0;
        postsHtml += `
          <div class="post-item">
            <div class="post-header">
              <div class="post-avatar">${post.user.avatar}</div>
              <div class="post-user">
                <div class="post-name">${post.user.nickname}</div>
                <div class="post-meta">
                  <span class="post-tier">${getTierName(post.user.tier)}</span>
                  ${post.createTime}
                </div>
              </div>
              ${!post.user.isFriend ? `<button style="padding:4px 12px;background:#FF6B6B;color:#fff;border:none;border-radius:12px;font-size:12px;cursor:pointer;" onclick="addFriend(${post.id})">关注</button>` : ''}
            </div>
            <div class="post-content">${post.content}</div>
            <div class="post-stats">
              <div class="stat-btn ${post.isLiked ? 'active' : ''}" onclick="toggleLike(${post.id})">
                <span class="stat-icon">${post.isLiked ? '❤️' : '🤍'}</span>
                <span>${post.likes}</span>
              </div>
              <div class="stat-btn" onclick="goToPostDetail(${post.id})">
                <span class="stat-icon">💬</span>
                <span>${commentCount}</span>
              </div>
              <div class="stat-btn" onclick="sharePost(${post.id})">
                <span class="stat-icon">🔗</span>
                <span>${post.shares}</span>
              </div>
            </div>
          </div>
        `;
      });
    }
    
    return `
      <div class="page-container">
        <div class="social-header">
          <div class="social-title">👥 社交圈</div>
          <div class="post-btn" onclick="goToCreatePost()">+ 发布</div>
        </div>
        
        <div class="category-scroll">
          ${categoryHtml}
        </div>
        
        <div class="filter-bar">
          <div class="filter-item active" data-filter="all" onclick="switchFilter('all')">全部</div>
          <div class="filter-item" data-filter="sameTier" onclick="switchFilter('sameTier')">同档位</div>
          <div class="filter-item" data-filter="friends" onclick="switchFilter('friends')">关注</div>
        </div>
        
        ${postsHtml}
      </div>
    `;
  }

  function renderProfilePage() {
    const userInfo = AppData.getUserInfo();
    const checkinRecords = AppData.getCheckinRecords();
    
    let userSection = '';
    if (userInfo) {
      const userTier = userInfo.salary ? getSalaryTier(userInfo.salary) : null;
      userSection = `
        <div class="profile-header">
          <div class="user-avatar">${userInfo.avatar || '👤'}</div>
          <div class="user-name">${userInfo.nickname}</div>
          ${userTier ? `<div class="user-tier">${getTierName(userTier)}</div>` : ''}
          ${userInfo.salary ? `<div style="margin-top:8px;font-size:14px;opacity:0.9;">月薪 ¥${formatMoney(userInfo.salary)}</div>` : ''}
        </div>
      `;
    } else {
      userSection = `
        <div class="profile-header">
          <div class="user-avatar">👤</div>
          <div class="user-name">未登录</div>
          <div class="user-tier">点击登录</div>
        </div>
      `;
    }
    
    const totalSavings = checkinRecords.reduce((sum, r) => sum + (r.amount || 0), 0);
    
    return `
      <div class="page-container">
        ${userSection}
        
        <div class="card" style="display:flex;justify-content:space-around;text-align:center;padding:20px;">
          <div>
            <div style="font-size:24px;font-weight:600;color:#FF6B6B;">${checkinRecords.length}</div>
            <div style="font-size:12px;color:#999;">打卡次数</div>
          </div>
          <div>
            <div style="font-size:24px;font-weight:600;color:#27ae60;">¥${formatMoney(totalSavings)}</div>
            <div style="font-size:12px;color:#999;">累计存钱</div>
          </div>
          <div>
            <div style="font-size:24px;font-weight:600;color:#3498db;">${mockPosts.filter(p => p.user.isFriend).length}</div>
            <div style="font-size:12px;color:#999;">关注数</div>
          </div>
        </div>
        
        <div class="menu-list">
          <div class="menu-item" onclick="goToCheckin()">
            <span class="menu-icon">📅</span>
            <span class="menu-text">我的打卡</span>
            <span class="menu-arrow">›</span>
          </div>
          <div class="menu-item" onclick="goToCalculator()">
            <span class="menu-icon">🧮</span>
            <span class="menu-text">薪资计算</span>
            <span class="menu-arrow">›</span>
          </div>
          <div class="menu-item" onclick="goToComparison()">
            <span class="menu-icon">📊</span>
            <span class="menu-text">薪资图鉴</span>
            <span class="menu-arrow">›</span>
          </div>
          <div class="menu-item" onclick="goToMentalHealth()">
            <span class="menu-icon">💚</span>
            <span class="menu-text">心态治愈</span>
            <span class="menu-arrow">›</span>
          </div>
          <div class="menu-item" onclick="goToGoods()">
            <span class="menu-icon">🎁</span>
            <span class="menu-text">好物推荐</span>
            <span class="menu-arrow">›</span>
          </div>
          <div class="menu-item" onclick="goToWallpaper()">
            <span class="menu-icon">🖼️</span>
            <span class="menu-text">文案壁纸</span>
            <span class="menu-arrow">›</span>
          </div>
        </div>
        
        ${userInfo ? `
          <div class="menu-item" style="margin-top:20px;background:#fef0f0;" onclick="handleLogout()">
            <span class="menu-icon">🚪</span>
            <span class="menu-text" style="color:#FF6B6B;">退出登录</span>
            <span class="menu-arrow">›</span>
          </div>
        ` : ''}
      </div>
    `;
  }

  function renderTierDetailPage(params) {
    const tierId = params.tier || '3k';
    const tier = salaryTiers[tierId];
    
    if (!tier) {
      return `
        <div class="page-container">
          <div class="nav-header">
            <span class="nav-back" onclick="Router.navigateBack()">‹</span>
            <span class="nav-title">档位详情</span>
          </div>
          <div style="text-align:center;padding:40px;color:#999;">档位不存在</div>
        </div>
      `;
    }
    
    return `
      <div class="nav-header">
        <span class="nav-back" onclick="Router.navigateBack()">‹</span>
        <span class="nav-title">${tier.displayName}</span>
      </div>
      <div class="page-container">
        <div class="tier-detail-header">
          <div class="tier-detail-name">${tier.icon} ${tier.name}</div>
          <div class="tier-detail-range">${tier.description}</div>
        </div>
        
        <div class="tier-tabs">
          <div class="tier-tab active" data-tab="consumption" onclick="switchTierTab('consumption')">消费水平</div>
          <div class="tier-tab" data-tab="warning" onclick="switchTierTab('warning')">避雷指南</div>
          <div class="tier-tab" data-tab="joy" onclick="switchTierTab('joy')">低成本快乐</div>
          <div class="tier-tab" data-tab="mindset" onclick="switchTierTab('mindset')">心态建议</div>
        </div>
        
        <div id="tier-tab-content">
          ${renderConsumptionTab(tier)}
        </div>
      </div>
    `;
  }

  function renderConsumptionTab(tier) {
    let html = '<div class="card">';
    
    const consumption = tier.consumption;
    Object.keys(consumption).forEach(key => {
      const item = consumption[key];
      html += `
        <div class="expense-item">
          <div class="expense-left">
            <div class="expense-icon">${getCategoryIcon(key)}</div>
            <div class="expense-info">
              <div class="expense-name">${item.title}</div>
              <div class="expense-desc">${item.daily || item.monthly}</div>
            </div>
          </div>
        </div>
      `;
      
      if (item.details) {
        item.details.forEach(detail => {
          html += `<div style="font-size:12px;color:#666;padding:4px 0;padding-left:40px;">• ${detail}</div>`;
        });
      }
    });
    
    html += '</div>';
    return html;
  }

  function renderWarningTab(tier) {
    let html = '';
    tier.avoidWaste.forEach(warning => {
      html += `
        <div class="warning-item">
          <div class="warning-icon">⚠️</div>
          <div class="warning-text">
            <div class="warning-desc">${warning}</div>
          </div>
        </div>
      `;
    });
    return html;
  }

  function renderJoyTab(tier) {
    let html = '';
    tier.cheapJoy.forEach((joy, index) => {
      html += `
        <div class="happy-item">
          <div class="happy-header">
            <div class="happy-icon">✨</div>
            <div class="happy-title">快乐方式 ${index + 1}</div>
          </div>
          <div class="happy-desc">${joy}</div>
        </div>
      `;
    });
    return html;
  }

  function renderMindsetTab(tier) {
    let html = `
      <div class="mindset-card">
        <div class="mindset-title">💭 当前心态建议</div>
        <div class="mindset-text">
          ${tier.mindset.current.map(m => `<div style="margin-bottom:8px;">• ${m}</div>`).join('')}
        </div>
      </div>
      
      <div class="next-goal">
        <div class="next-goal-title">🎯 下一个目标：${tier.mindset.nextStep.target}</div>
        <div style="font-size:14px;font-weight:500;color:#333;margin-bottom:8px;">提升方向：</div>
        ${tier.mindset.nextStep.goals.map(goal => `
          <div class="next-goal-item">
            <div class="next-goal-icon">✓</div>
            <div class="next-goal-text">${goal}</div>
          </div>
        `).join('')}
      </div>
    `;
    return html;
  }

  function renderComparisonPage() {
    return `
      <div class="nav-header">
        <span class="nav-back" onclick="Router.navigateBack()">‹</span>
        <span class="nav-title">薪资生活对照图鉴</span>
      </div>
      <div class="page-container">
        <div class="card" style="text-align:center;padding:20px;">
          <div style="font-size:16px;font-weight:600;color:#333;margin-bottom:8px;">📊 五档薪资生活对比</div>
          <div style="font-size:12px;color:#999;">点击下方卡片查看各档位详情</div>
        </div>
        
        ${tierList.map(tierId => {
          const tier = salaryTiers[tierId];
          return `
            <div class="card" style="cursor:pointer;border-left:4px solid ${tier.color};" onclick="goToTierDetail('${tierId}')">
              <div style="display:flex;align-items:center;margin-bottom:12px;">
                <div style="font-size:28px;margin-right:12px;">${tier.icon}</div>
                <div>
                  <div style="font-size:16px;font-weight:600;color:#333;">${tier.displayName} - ${tier.name}</div>
                  <div style="font-size:12px;color:#999;">${tier.description}</div>
                </div>
              </div>
              
              <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;font-size:12px;">
                <div style="background:#f5f5f5;padding:8px;border-radius:8px;text-align:center;">
                  <div style="color:#999;">工作</div>
                  <div style="color:#333;font-weight:500;">${tier.realLife.work.substring(0, 10)}...</div>
                </div>
                <div style="background:#f5f5f5;padding:8px;border-radius:8px;text-align:center;">
                  <div style="color:#999;">居住</div>
                  <div style="color:#333;font-weight:500;">${tier.realLife.location}</div>
                </div>
                <div style="background:#f5f5f5;padding:8px;border-radius:8px;text-align:center;">
                  <div style="color:#999;">存款</div>
                  <div style="color:#333;font-weight:500;">${tier.consumption.savings.monthly}</div>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function renderMentalHealthPage() {
    const data = mentalHealthData;
    
    return `
      <div class="nav-header">
        <span class="nav-back" onclick="Router.navigateBack()">‹</span>
        <span class="nav-title">心态治愈专区</span>
      </div>
      <div class="page-container">
        <div class="daily-quote">
          <div class="quote-title">💚 今日治愈</div>
          <div class="quote-content">${data.comfortingQuotes[Math.floor(Math.random() * data.comfortingQuotes.length)]}</div>
        </div>
        
        <div class="card">
          <div style="font-size:14px;font-weight:600;color:#333;margin-bottom:12px;">😔 焦虑缓解</div>
          ${data.anxietyRelief.map(item => `
            <div class="happy-item" style="cursor:pointer;">
              <div class="happy-header">
                <div class="happy-icon">${item.icon}</div>
                <div class="happy-title">${item.title}</div>
              </div>
              <div class="happy-desc">${item.content.substring(0, 60)}...</div>
            </div>
          `).join('')}
        </div>
        
        <div class="card">
          <div style="font-size:14px;font-weight:600;color:#333;margin-bottom:12px;">📖 真实故事</div>
          ${data.realLifeStories.map(story => `
            <div class="post-item" style="cursor:pointer;">
              <div class="post-header">
                <div class="post-avatar">${story.avatar}</div>
                <div class="post-user">
                  <div class="post-name">${story.author} (${story.age}岁)</div>
                  <div class="post-meta">
                    <span class="post-tier">${getTierName(story.tier)}</span>
                    ${story.city} · ${story.job}
                  </div>
                </div>
              </div>
              <div style="font-size:14px;font-weight:500;color:#333;margin-bottom:8px;">${story.title}</div>
              <div class="post-content">${story.content.substring(0, 80)}...</div>
              <div style="display:flex;gap:16px;margin-top:12px;font-size:12px;color:#999;">
                <span>❤️ ${story.likes}</span>
                <span>💬 ${story.comments}</span>
              </div>
            </div>
          `).join('')}
        </div>
        
        <div class="card">
          <div style="font-size:14px;font-weight:600;color:#333;margin-bottom:12px;">⚠️ 消费警示</div>
          ${data.warnings.map(warning => `
            <div class="warning-item">
              <div class="warning-icon">${warning.icon}</div>
              <div class="warning-text">
                <div class="warning-title">${warning.title}</div>
                <div class="warning-desc">${warning.content}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function renderCheckinPage() {
    const records = AppData.getCheckinRecords();
    const totalSavings = records.reduce((sum, r) => sum + (r.amount || 0), 0);
    
    let recordsHtml = '';
    if (records.length === 0) {
      recordsHtml = '<div style="text-align:center;padding:40px;color:#999;">暂无打卡记录，点击上方按钮开始打卡</div>';
    } else {
      records.slice().reverse().forEach(record => {
        recordsHtml += `
          <div class="expense-item">
            <div class="expense-left">
              <div class="expense-icon">💰</div>
              <div class="expense-info">
                <div class="expense-name">${record.note || '存钱打卡'}</div>
                <div class="expense-desc">${record.date}</div>
              </div>
            </div>
            <div class="expense-right">
              <div class="expense-amount">+¥${formatMoney(record.amount)}</div>
            </div>
          </div>
        `;
      });
    }
    
    return `
      <div class="nav-header">
        <span class="nav-back" onclick="Router.navigateBack()">‹</span>
        <span class="nav-title">存钱打卡</span>
      </div>
      <div class="page-container">
        <div class="card" style="text-align:center;padding:24px;">
          <div style="font-size:12px;color:#999;margin-bottom:8px;">累计存钱</div>
          <div style="font-size:32px;font-weight:600;color:#FF6B6B;">¥${formatMoney(totalSavings)}</div>
          <div style="display:flex;justify-content:center;gap:40px;margin-top:16px;font-size:14px;">
            <div>
              <div style="font-size:20px;font-weight:600;color:#333;">${records.length}</div>
              <div style="color:#999;">打卡次数</div>
            </div>
            <div>
              <div style="font-size:20px;font-weight:600;color:#333;">${records.length > 0 ? Math.round(totalSavings / records.length) : 0}</div>
              <div style="color:#999;">平均每次</div>
            </div>
          </div>
        </div>
        
        <button class="calc-btn" onclick="showCheckinModal()">+ 今日打卡</button>
        
        <div class="card">
          <div style="font-size:14px;font-weight:600;color:#333;margin-bottom:12px;">📅 打卡记录</div>
          ${recordsHtml}
        </div>
      </div>
    `;
  }

  function renderGoodsPage() {
    const userInfo = AppData.getUserInfo();
    const userTier = userInfo && userInfo.salary ? getSalaryTier(userInfo.salary) : '9k';
    
    let tierListHtml = '';
    tierList.forEach(tierId => {
      const tier = salaryTiers[tierId];
      tierListHtml += `
        <div class="tier-item ${tierId === userTier ? 'active' : ''}" onclick="selectGoodsTier('${tierId}')">
          <div class="tier-icon">${tier.icon}</div>
          <div class="tier-name">${tier.displayName}</div>
          <div class="tier-mode">${tier.name}</div>
        </div>
      `;
    });
    
    const tier = tierGoods[userTier] || tierGoods['9k'];
    
    return `
      <div class="nav-header">
        <span class="nav-back" onclick="Router.navigateBack()">‹</span>
        <span class="nav-title">好物推荐</span>
      </div>
      <div class="page-container">
        <div class="card">
          <div style="font-size:14px;font-weight:600;color:#333;margin-bottom:12px;">💼 选择档位</div>
          <div class="tier-scroll">
            ${tierListHtml}
          </div>
        </div>
        
        <div class="card" style="text-align:center;padding:16px;">
          <div style="font-size:14px;font-weight:600;color:#333;margin-bottom:4px;">${tier.title}</div>
          <div style="font-size:12px;color:#999;">${tier.description}</div>
        </div>
        
        ${tier.categories.map(category => `
          <div class="card">
            <div style="font-size:14px;font-weight:600;color:#333;margin-bottom:12px;">🎯 ${category.name}</div>
            ${category.items.map(item => `
              <div class="happy-item">
                <div class="happy-header">
                  <div class="happy-title">${item.name}</div>
                  <div class="happy-cost">${item.price}</div>
                </div>
                <div style="font-size:12px;color:#FF6B6B;margin-bottom:8px;">原价 ${item.originalPrice}</div>
                <div class="happy-desc">${item.description}</div>
                <div style="margin-top:8px;font-size:12px;color:#27ae60;">💡 ${item.reason}</div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;font-size:11px;color:#999;">
                  <span>⭐ ${item.rating}分 | 销量 ${item.sales}</span>
                  <span>购买：${item.buyLink}</span>
                </div>
              </div>
            `).join('')}
          </div>
        `).join('')}
      </div>
    `;
  }

  window.selectGoodsTier = function(tierId) {
    const userInfo = AppData.getUserInfo();
    if (userInfo) {
      const salaryMap = { '3k': 3000, '9k': 9000, '3w': 30000, '5w': 50000, '10w': 100000 };
      userInfo.salary = salaryMap[tierId] || 9000;
      AppData.saveUserInfo(userInfo);
    }
    Router.renderPage('goods');
  };

  window.selectWallpaperTier = function(tierId) {
    const userInfo = AppData.getUserInfo();
    if (userInfo) {
      const salaryMap = { '3k': 3000, '9k': 9000, '3w': 30000, '5w': 50000, '10w': 100000 };
      userInfo.salary = salaryMap[tierId] || 9000;
      AppData.saveUserInfo(userInfo);
    }
    Router.renderPage('wallpaper');
  };

  function renderWallpaperPage() {
    const userInfo = AppData.getUserInfo();
    const userTier = userInfo && userInfo.salary ? getSalaryTier(userInfo.salary) : '9k';
    
    let tierListHtml = '';
    tierList.forEach(tierId => {
      const tier = salaryTiers[tierId];
      tierListHtml += `
        <div class="tier-item ${tierId === userTier ? 'active' : ''}" onclick="selectWallpaperTier('${tierId}')">
          <div class="tier-icon">${tier.icon}</div>
          <div class="tier-name">${tier.displayName}</div>
          <div class="tier-mode">${tier.name}</div>
        </div>
      `;
    });
    
    const tierData = wallpaperData[userTier] || wallpaperData['9k'];
    
    return `
      <div class="nav-header">
        <span class="nav-back" onclick="Router.navigateBack()">‹</span>
        <span class="nav-title">文案壁纸</span>
      </div>
      <div class="page-container">
        <div class="card">
          <div style="font-size:14px;font-weight:600;color:#333;margin-bottom:12px;">💼 选择档位</div>
          <div class="tier-scroll">
            ${tierListHtml}
          </div>
        </div>
        
        <div class="card">
          <div style="font-size:14px;font-weight:600;color:#333;margin-bottom:12px;">💭 专属文案 (${getTierName(userTier)})</div>
          ${tierData.quotes.map(quote => `
            <div class="daily-quote" style="margin-bottom:12px;cursor:pointer;" onclick="copyText('${quote.content}')">
              <div class="quote-title">#${quote.category}</div>
              <div class="quote-content">${quote.content}</div>
            </div>
          `).join('')}
        </div>
        
        <div class="card">
          <div style="font-size:14px;font-weight:600;color:#333;margin-bottom:12px;">📱 壁纸模板</div>
          ${tierData.wallpapers.map(wp => `
            <div style="padding:16px;background:${wp.color};border-radius:12px;margin-bottom:12px;text-align:center;color:${wp.textColor};cursor:pointer;">
              <div style="font-size:18px;font-weight:600;margin-bottom:8px;">${wp.title}</div>
              <div style="font-size:12px;opacity:0.8;">${wp.description}</div>
            </div>
          `).join('')}
        </div>
        
        <div class="card">
          <div style="font-size:14px;font-weight:600;color:#333;margin-bottom:12px;">📝 朋友圈文案</div>
          ${tierData['朋友圈文案'].map(post => `
            <div class="post-item">
              <div class="post-content">${post.content}</div>
              <div style="margin-top:8px;font-size:12px;color:#FF6B6B;">
                ${post.tags.join(' ')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function renderPostDetailPage(params) {
    const postId = parseInt(params.id);
    const post = mockPosts.find(p => p.id === postId);
    
    if (!post) {
      return `
        <div class="nav-header">
          <span class="nav-back" onclick="Router.navigateBack()">‹</span>
          <span class="nav-title">帖子详情</span>
        </div>
        <div class="page-container">
          <div style="text-align:center;padding:40px;color:#999;">帖子不存在</div>
        </div>
      `;
    }
    
    const comments = mockComments[postId] || [];
    
    return `
      <div class="nav-header">
        <span class="nav-back" onclick="Router.navigateBack()">‹</span>
        <span class="nav-title">帖子详情</span>
      </div>
      <div class="page-container" style="padding-bottom: 80px;position:relative;">
        <div class="post-item">
          <div class="post-header">
            <div class="post-avatar">${post.user.avatar}</div>
            <div class="post-user">
              <div class="post-name">${post.user.nickname}</div>
              <div class="post-meta">
                <span class="post-tier">${getTierName(post.user.tier)}</span>
                ${post.createTime}
              </div>
            </div>
          </div>
          <div class="post-content">${post.content}</div>
          <div class="post-stats">
            <div class="stat-btn ${post.isLiked ? 'active' : ''}">
              <span class="stat-icon">${post.isLiked ? '❤️' : '🤍'}</span>
              <span>${post.likes}</span>
            </div>
            <div class="stat-btn">
              <span class="stat-icon">💬</span>
              <span>${comments.length}</span>
            </div>
            <div class="stat-btn">
              <span class="stat-icon">🔗</span>
              <span>${post.shares}</span>
            </div>
          </div>
        </div>
        
        <div class="card">
          <div style="font-size:14px;font-weight:600;color:#333;margin-bottom:12px;">💬 评论 (${comments.length})</div>
          ${comments.length === 0 ? 
            '<div style="text-align:center;padding:20px;color:#999;">暂无评论，快来抢沙发吧~</div>' :
            comments.map(comment => `
              <div class="expense-item">
                <div class="expense-left">
                  <div style="width:32px;height:32px;border-radius:50%;background:#f5f5f5;display:flex;align-items:center;justify-content:center;margin-right:12px;font-size:16px;">${comment.user.avatar}</div>
                  <div>
                    <div style="font-size:13px;font-weight:500;color:#333;">${comment.user.nickname}</div>
                    <div style="font-size:13px;color:#666;margin-top:4px;">${comment.content}</div>
                  </div>
                </div>
                <div style="font-size:11px;color:#999;">${comment.createTime}</div>
              </div>
            `).join('')
          }
        </div>
      </div>
      <div style="position:absolute;bottom:0;left:16px;right:16px;padding:12px 16px;background:#fff;border-top:1px solid #eee;display:flex;gap:8px;z-index:100;">
        <input type="text" placeholder="说点什么..." style="flex:1;height:36px;padding:0 12px;background:#f5f5f5;border:none;border-radius:18px;font-size:14px;outline:none;" id="comment-input">
        <button onclick="submitComment(${postId})" style="padding:0 16px;background:#FF6B6B;color:#fff;border:none;border-radius:18px;font-size:14px;cursor:pointer;">发送</button>
      </div>
    `;
  }

  function renderCreatePostPage() {
    return `
      <div class="nav-header">
        <span class="nav-back" onclick="Router.navigateBack()">‹</span>
        <span class="nav-title">发布帖子</span>
      </div>
      <div class="page-container">
        <div class="card">
          <div class="form-group">
            <label class="form-label">选择分类</label>
            <div class="category-scroll" style="margin-top:8px;">
              ${categories.filter(c => c.id !== 'all').map(cat => `
                <div class="category-item ${cat.id === 'daily' ? 'active' : ''}" data-category="${cat.id}" onclick="selectPostCategory('${cat.id}')">
                  ${cat.name}
                </div>
              `).join('')}
            </div>
          </div>
          
          <div class="form-group">
            <label class="form-label">内容</label>
            <textarea id="post-content" placeholder="分享你的想法..." style="width:100%;min-height:150px;padding:12px;background:#f5f5f5;border:none;border-radius:8px;font-size:14px;outline:none;resize:vertical;"></textarea>
          </div>
        </div>
        
        <button class="calc-btn" onclick="submitPost()">发布</button>
      </div>
    `;
  }

  // ==================== 辅助函数 ====================
  
  function getCategoryIcon(key) {
    const icons = {
      diet: '🍜',
      housing: '🏠',
      clothing: '👕',
      skincare: '💄',
      entertainment: '🎮',
      savings: '💰'
    };
    return icons[key] || '📦';
  }

  function formatMoney(amount) {
    if (!amount) return '0';
    return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function getSalaryTier(salary) {
    if (salary <= 3000) return '3k';
    if (salary <= 9000) return '9k';
    if (salary <= 30000) return '3w';
    if (salary <= 50000) return '5w';
    return '10w';
  }

  function getTierName(tier) {
    const names = {
      '3k': '生存模式',
      '9k': '生活模式',
      '3w': '品质模式',
      '5w': '舒适模式',
      '10w': '自由模式'
    };
    return names[tier] || '未知模式';
  }

  function getTierColor(tier) {
    const colors = {
      '3k': '#95a5a6',
      '9k': '#3498db',
      '3w': '#27ae60',
      '5w': '#9b59b6',
      '10w': '#f39c12'
    };
    return colors[tier] || '#FF6B6B';
  }

  function calculateAllocation(salary, tier) {
    const rules = {
      '3k': { rent: 0.40, food: 0.25, shopping: 0.08, entertainment: 0.07, savings: 0.10, reserve: 0.05, social: 0.05 },
      '9k': { rent: 0.35, food: 0.25, shopping: 0.12, entertainment: 0.10, savings: 0.10, reserve: 0.05, social: 0.03 },
      '3w': { rent: 0.30, food: 0.20, shopping: 0.15, entertainment: 0.12, savings: 0.15, reserve: 0.05, social: 0.03 },
      '5w': { rent: 0.25, food: 0.15, shopping: 0.18, entertainment: 0.15, savings: 0.20, reserve: 0.04, social: 0.03 },
      '10w': { rent: 0.20, food: 0.12, shopping: 0.20, entertainment: 0.15, savings: 0.25, reserve: 0.04, social: 0.04 }
    };
    
    const rule = rules[tier] || rules['9k'];
    const result = {};
    
    Object.keys(rule).forEach(key => {
      result[key] = {
        ratio: rule[key],
        amount: Math.round(salary * rule[key])
      };
    });
    
    return result;
  }

  // ==================== 全局事件处理函数 ====================
  
  window.goToTierDetail = function(tier) {
    Router.navigateTo(`/pages/salary-tier/tier-detail/tier-detail?tier=${tier}`);
  };

  window.goToCalculator = function() {
    Router.switchTab('calculator');
  };

  window.goToComparison = function() {
    Router.navigateTo('/pages/comparison/comparison');
  };

  window.goToMentalHealth = function() {
    Router.navigateTo('/pages/mental-health/mental-health');
  };

  window.goToCheckin = function() {
    Router.navigateTo('/pages/checkin/checkin');
  };

  window.goToGoods = function() {
    Router.navigateTo('/pages/goods/goods');
  };

  window.goToWallpaper = function() {
    Router.navigateTo('/pages/wallpaper/wallpaper');
  };

  window.goToPostDetail = function(id) {
    Router.navigateTo(`/pages/social/post-detail/post-detail?id=${id}`);
  };

  window.goToCreatePost = function() {
    const userInfo = AppData.getUserInfo();
    if (!userInfo) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    Router.navigateTo('/pages/social/create-post/create-post');
  };

  window.handleLogin = function() {
    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: () => {
        Router.renderPage('index');
      }
    });
  };

  window.handleLogout = function() {
    AppData.globalData.userInfo = null;
    localStorage.removeItem('userInfo');
    wx.showToast({ title: '已退出登录', icon: 'success' });
    setTimeout(() => {
      Router.renderPage('profile');
    }, 1000);
  };

  window.handleSalaryInput = function(value) {
    const quickBtns = document.querySelectorAll('.quick-btn');
    quickBtns.forEach(btn => btn.classList.remove('active'));
  };

  window.setQuickSalary = function(value) {
    const input = document.getElementById('salary-input');
    if (input) {
      input.value = value;
    }
    const quickBtns = document.querySelectorAll('.quick-btn');
    quickBtns.forEach(btn => {
      btn.classList.remove('active');
      if (btn.textContent.trim() === (value >= 10000 ? (value/10000) + 'w' : (value/1000) + 'k')) {
        btn.classList.add('active');
      }
    });
  };

  window.calculateAndShowResult = function() {
    const input = document.getElementById('salary-input');
    const salary = parseFloat(input.value);
    
    if (!salary || salary <= 0) {
      wx.showToast({ title: '请输入有效薪资', icon: 'none' });
      return;
    }
    
    const tier = getSalaryTier(salary);
    const allocation = calculateAllocation(salary, tier);
    
    const resultSection = document.getElementById('result-section');
    const resultTier = document.getElementById('result-tier');
    const visualRatio = document.getElementById('visual-ratio');
    const allocationList = document.getElementById('allocation-list');
    
    resultTier.textContent = getTierName(tier);
    
    const allocationInfo = {
      rent: { name: '房租', icon: '🏠', color: '#FF6B6B' },
      food: { name: '伙食', icon: '🍜', color: '#FFA500' },
      shopping: { name: '购物', icon: '🛍️', color: '#9B59B6' },
      entertainment: { name: '娱乐', icon: '🎮', color: '#3498DB' },
      savings: { name: '存款', icon: '💰', color: '#27AE60' },
      reserve: { name: '备用金', icon: '💳', color: '#95A5A6' },
      social: { name: '社交', icon: '👥', color: '#E91E63' }
    };
    
    let ratioBarHtml = '<div class="ratio-bar">';
    let legendHtml = '<div class="ratio-legend">';
    
    Object.keys(allocation).forEach(key => {
      const info = allocationInfo[key];
      const item = allocation[key];
      ratioBarHtml += `<div class="ratio-segment" style="width:${item.ratio * 100}%;background:${info.color};" title="${info.name}: ${item.ratio * 100}%">${item.ratio >= 0.1 ? Math.round(item.ratio * 100) + '%' : ''}</div>`;
      legendHtml += `<div class="legend-item"><span class="legend-color" style="background:${info.color};"></span>${info.name}</div>`;
    });
    
    ratioBarHtml += '</div>';
    legendHtml += '</div>';
    visualRatio.innerHTML = ratioBarHtml + legendHtml;
    
    let listHtml = '';
    Object.keys(allocation).forEach(key => {
      const info = allocationInfo[key];
      const item = allocation[key];
      listHtml += `
        <div class="allocation-item">
          <div class="allocation-left">
            <div class="allocation-icon">${info.icon}</div>
            <div class="allocation-name">${info.name}</div>
          </div>
          <div class="allocation-right">
            <div class="allocation-amount">¥${formatMoney(item.amount)}</div>
            <div class="allocation-percent">${Math.round(item.ratio * 100)}%</div>
          </div>
        </div>
      `;
    });
    
    allocationList.innerHTML = listHtml;
    resultSection.style.display = 'block';
    
    const userInfo = AppData.getUserInfo();
    if (userInfo) {
      userInfo.salary = salary;
      AppData.saveUserInfo(userInfo);
    }
  };

  window.selectCategory = function(category) {
    const items = document.querySelectorAll('.category-item');
    items.forEach(item => {
      item.classList.remove('active');
      if (item.dataset.category === category) {
        item.classList.add('active');
      }
    });
  };

  window.switchFilter = function(type) {
    currentFilter = type;
    const items = document.querySelectorAll('.filter-item');
    items.forEach(item => {
      item.classList.remove('active');
      if (item.dataset.filter === type) {
        item.classList.add('active');
      }
    });
    Router.renderPage('social');
  };

  window.toggleLike = function(postId) {
    const post = mockPosts.find(p => p.id === postId);
    if (post) {
      post.isLiked = !post.isLiked;
      post.likes += post.isLiked ? 1 : -1;
    }
    Router.renderPage('social');
  };

  window.sharePost = function(postId) {
    const post = mockPosts.find(p => p.id === postId);
    if (post) {
      post.shares++;
    }
    wx.showToast({ title: '分享成功', icon: 'success' });
    Router.renderPage('social');
  };

  window.addFriend = function(postId) {
    const post = mockPosts.find(p => p.id === postId);
    if (post) {
      post.user.isFriend = true;
    }
    wx.showToast({ title: '关注成功', icon: 'success' });
    Router.renderPage('social');
  };

  window.switchTierTab = function(tab) {
    const tabs = document.querySelectorAll('.tier-tab');
    const content = document.getElementById('tier-tab-content');
    
    tabs.forEach(t => t.classList.remove('active'));
    tabs.forEach(t => {
      if (t.dataset.tab === tab) {
        t.classList.add('active');
      }
    });
    
    const userInfo = AppData.getUserInfo();
    const currentTierId = Router.pageParams.tier || (userInfo && userInfo.salary ? getSalaryTier(userInfo.salary) : '9k');
    const tier = salaryTiers[currentTierId];
    
    if (tab === 'consumption') {
      content.innerHTML = renderConsumptionTab(tier);
    } else if (tab === 'warning') {
      content.innerHTML = renderWarningTab(tier);
    } else if (tab === 'joy') {
      content.innerHTML = renderJoyTab(tier);
    } else if (tab === 'mindset') {
      content.innerHTML = renderMindsetTab(tier);
    }
  };

  window.showCheckinModal = function() {
    const today = new Date().toISOString().split('T')[0];
    const modalHtml = `
      <div class="modal-mask" id="checkin-modal">
        <div class="modal-content">
          <div class="modal-title">💰 今日存钱打卡</div>
          <div class="form-group">
            <label class="form-label">存入金额（元）</label>
            <input type="number" class="form-input" id="checkin-amount" placeholder="请输入金额" min="0" step="1">
          </div>
          <div class="form-group">
            <label class="form-label">备注（选填）</label>
            <input type="text" class="form-input" id="checkin-note" placeholder="例如：工资存入、副业收入">
          </div>
          <div class="modal-actions">
            <div class="modal-btn cancel-btn" onclick="closeCheckinModal()">取消</div>
            <div class="modal-btn confirm-btn" onclick="submitCheckin()">确认打卡</div>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  };

  window.closeCheckinModal = function() {
    const modal = document.getElementById('checkin-modal');
    if (modal) modal.remove();
  };

  window.submitCheckin = function() {
    const amount = parseFloat(document.getElementById('checkin-amount').value);
    const note = document.getElementById('checkin-note').value;
    
    if (!amount || amount <= 0) {
      wx.showToast({ title: '请输入有效金额', icon: 'none' });
      return;
    }
    
    const records = AppData.getCheckinRecords();
    const today = new Date().toISOString().split('T')[0];
    
    records.push({
      date: today,
      amount: amount,
      note: note || '存钱打卡'
    });
    
    AppData.saveCheckinRecords(records);
    closeCheckinModal();
    wx.showToast({ title: '打卡成功', icon: 'success' });
    
    setTimeout(() => {
      Router.renderPage('checkin');
    }, 1000);
  };

  window.selectPostCategory = function(category) {
    const items = document.querySelectorAll('.category-item');
    items.forEach(item => {
      item.classList.remove('active');
      if (item.dataset.category === category) {
        item.classList.add('active');
      }
    });
  };

  window.submitPost = function() {
    const content = document.getElementById('post-content').value.trim();
    
    if (!content) {
      wx.showToast({ title: '请输入内容', icon: 'none' });
      return;
    }
    
    const userInfo = AppData.getUserInfo();
    const userTier = userInfo && userInfo.salary ? getSalaryTier(userInfo.salary) : '9k';
    
    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    const newPost = {
      id: Date.now(),
      user: {
        id: 'u_self',
        nickname: userInfo ? userInfo.nickname : '我',
        avatar: userInfo ? userInfo.avatar : '😊',
        tier: userTier,
        isFriend: false
      },
      category: 'daily',
      content: content,
      images: [],
      likes: 0,
      comments: 0,
      shares: 0,
      isLiked: false,
      createTime: timeStr
    };
    
    mockPosts.unshift(newPost);
    
    wx.showToast({ title: '发布成功', icon: 'success' });
    
    setTimeout(() => {
      currentFilter = 'all';
      Router.switchTab('social');
    }, 1000);
  };

  window.submitComment = function(postId) {
    const input = document.getElementById('comment-input');
    const content = input.value.trim();
    
    if (!content) {
      wx.showToast({ title: '请输入评论内容', icon: 'none' });
      return;
    }
    
    if (!mockComments[postId]) {
      mockComments[postId] = [];
    }
    
    const userInfo = AppData.getUserInfo();
    const newComment = {
      id: 'c' + Date.now(),
      user: {
        nickname: userInfo ? userInfo.nickname : '匿名用户',
        avatar: userInfo ? userInfo.avatar : '😊'
      },
      content: content,
      createTime: new Date().toLocaleString('zh-CN', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }).replace(/\//g, '-')
    };
    
    mockComments[postId].push(newComment);
    
    const post = mockPosts.find(p => p.id === postId);
    if (post) {
      post.comments++;
    }
    
    input.value = '';
    wx.showToast({ title: '评论成功', icon: 'success' });
    
    setTimeout(() => {
      Router.renderPage('post-detail', { id: postId.toString() });
    }, 500);
  };

  window.copyText = function(text) {
    navigator.clipboard.writeText(text).then(() => {
      wx.showToast({ title: '已复制到剪贴板', icon: 'success' });
    }).catch(() => {
      wx.showToast({ title: '复制失败', icon: 'none' });
    });
  };

  function bindPageEvents(page) {
    const tabbar = document.getElementById('tabbar');
    if (tabbar) {
      const tabItems = tabbar.querySelectorAll('.tabbar-item');
      tabItems.forEach(item => {
        item.onclick = function() {
          const targetPage = this.dataset.page;
          if (targetPage) {
            Router.switchTab(targetPage);
          }
        };
      });
    }
  }

  // ==================== 初始化 ====================
  document.addEventListener('DOMContentLoaded', function() {
    Router.switchTab('index');
  });

  window.addEventListener('load', function() {
    Router.switchTab('index');
  });

})();

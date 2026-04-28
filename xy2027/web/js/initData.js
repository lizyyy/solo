function initSampleData() {
  const fabrics = getStorageData(STORAGE_KEYS.FABRICS);
  if (fabrics.length === 0) {
    const sampleFabrics = [
      {
        id: generateId(),
        name: '纯棉布料 白色',
        type: '纯棉',
        color: '白色',
        quantity: 5.5,
        unit: '米',
        price: 25.00,
        totalValue: 137.50,
        purchaseDate: '2026-01-15',
        supplier: '淘宝面料店',
        width: 150,
        thickness: '中厚',
        purpose: 'T恤、衬衫',
        notes: '柔软舒适，适合做夏季服装',
        image: '',
        createTime: Date.now(),
        updateTime: Date.now()
      },
      {
        id: generateId(),
        name: '牛仔布料 蓝色',
        type: '牛仔',
        color: '蓝色',
        quantity: 3.0,
        unit: '米',
        price: 45.00,
        totalValue: 135.00,
        purchaseDate: '2026-02-20',
        supplier: '面料批发市场',
        width: 150,
        thickness: '厚',
        purpose: '牛仔裤、外套',
        notes: '经典蓝色牛仔布',
        image: '',
        createTime: Date.now(),
        updateTime: Date.now()
      },
      {
        id: generateId(),
        name: '丝绸布料 红色',
        type: '丝绸',
        color: '红色',
        quantity: 2.0,
        unit: '米',
        price: 88.00,
        totalValue: 176.00,
        purchaseDate: '2026-03-10',
        supplier: '丝绸专卖店',
        width: 114,
        thickness: '薄',
        purpose: '旗袍、礼服',
        notes: '高档真丝绸缎',
        image: '',
        createTime: Date.now(),
        updateTime: Date.now()
      }
    ];
    setStorageData(STORAGE_KEYS.FABRICS, sampleFabrics);
  }

  const patterns = getStorageData(STORAGE_KEYS.PATTERNS);
  if (patterns.length === 0) {
    const samplePatterns = [
      {
        id: generateId(),
        name: '基本款T恤纸样',
        type: '上衣',
        difficulty: '简单',
        sizes: ['S', 'M', 'L', 'XL'],
        fabricType: '针织、纯棉',
        fabricQuantity: 1.5,
        price: 35.00,
        purchaseDate: '2026-01-05',
        source: '网上下载',
        status: '已完成',
        completedProjects: 2,
        notes: '经典版型，适合新手练习',
        image: '',
        createTime: Date.now(),
        updateTime: Date.now()
      },
      {
        id: generateId(),
        name: 'A字连衣裙纸样',
        type: '连衣裙',
        difficulty: '中等',
        sizes: ['XS', 'S', 'M', 'L'],
        fabricType: '棉麻、雪纺',
        fabricQuantity: 2.0,
        price: 48.00,
        purchaseDate: '2026-02-15',
        source: '纸样店购买',
        status: '进行中',
        completedProjects: 0,
        notes: '优雅A字版型，夏季必备',
        image: '',
        createTime: Date.now(),
        updateTime: Date.now()
      },
      {
        id: generateId(),
        name: '直筒牛仔裤纸样',
        type: '裤子',
        difficulty: '困难',
        sizes: ['26', '27', '28', '29', '30'],
        fabricType: '牛仔布',
        fabricQuantity: 1.8,
        price: 58.00,
        purchaseDate: '2026-03-01',
        source: '专业纸样师',
        status: '待开始',
        completedProjects: 0,
        notes: '经典直筒裤型，需要一定缝纫经验',
        image: '',
        createTime: Date.now(),
        updateTime: Date.now()
      }
    ];
    setStorageData(STORAGE_KEYS.PATTERNS, samplePatterns);
  }

  const materials = getStorageData(STORAGE_KEYS.MATERIALS);
  if (materials.length === 0) {
    const sampleMaterials = [
      {
        id: generateId(),
        name: '缝纫线 白色',
        type: '缝纫线',
        color: '白色',
        brand: '兄弟',
        quantity: 10,
        unit: '卷',
        price: 5.00,
        totalValue: 50.00,
        purchaseDate: '2026-01-10',
        supplier: '缝纫配件店',
        minimumStock: 5,
        notes: '402号常用线',
        image: '',
        createTime: Date.now(),
        updateTime: Date.now()
      },
      {
        id: generateId(),
        name: '缝纫线 黑色',
        type: '缝纫线',
        color: '黑色',
        brand: '兄弟',
        quantity: 3,
        unit: '卷',
        price: 5.00,
        totalValue: 15.00,
        purchaseDate: '2026-01-10',
        supplier: '缝纫配件店',
        minimumStock: 5,
        notes: '402号常用线',
        image: '',
        createTime: Date.now(),
        updateTime: Date.now()
      },
      {
        id: generateId(),
        name: '拉链 20cm 黑色',
        type: '拉链',
        color: '黑色',
        brand: 'YKK',
        length: 20,
        quantity: 15,
        unit: '条',
        price: 3.50,
        totalValue: 52.50,
        purchaseDate: '2026-02-05',
        supplier: '拉链专卖店',
        minimumStock: 10,
        notes: '尼龙拉链，适合裤子、裙子',
        image: '',
        createTime: Date.now(),
        updateTime: Date.now()
      },
      {
        id: generateId(),
        name: '纽扣 圆形 黑色',
        type: '纽扣',
        color: '黑色',
        brand: '无',
        size: 15,
        quantity: 50,
        unit: '颗',
        price: 0.50,
        totalValue: 25.00,
        purchaseDate: '2026-02-15',
        supplier: '辅料市场',
        minimumStock: 30,
        notes: '树脂纽扣，直径15mm',
        image: '',
        createTime: Date.now(),
        updateTime: Date.now()
      },
      {
        id: generateId(),
        name: '松紧带 1cm 白色',
        type: '松紧带',
        color: '白色',
        width: 1,
        quantity: 20,
        unit: '米',
        price: 2.00,
        totalValue: 40.00,
        purchaseDate: '2026-03-01',
        supplier: '松紧带批发',
        minimumStock: 10,
        notes: '进口乳胶松紧带',
        image: '',
        createTime: Date.now(),
        updateTime: Date.now()
      }
    ];
    setStorageData(STORAGE_KEYS.MATERIALS, sampleMaterials);
  }

  const tools = getStorageData(STORAGE_KEYS.TOOLS);
  if (tools.length === 0) {
    const sampleTools = [
      {
        id: generateId(),
        name: '兄弟缝纫机 GS2700',
        type: '缝纫机',
        brand: '兄弟',
        model: 'GS2700',
        price: 1299.00,
        purchaseDate: '2025-12-01',
        supplier: '京东',
        status: '正常',
        lastMaintenance: '2026-02-15',
        nextMaintenance: '2026-08-15',
        warrantyExpiry: '2026-12-01',
        notes: '家用电动缝纫机，27种针迹',
        image: '',
        createTime: Date.now(),
        updateTime: Date.now()
      },
      {
        id: generateId(),
        name: '裁缝剪刀 8寸',
        type: '剪刀',
        brand: '张小泉',
        size: '8寸',
        price: 88.00,
        purchaseDate: '2025-12-15',
        supplier: '天猫',
        status: '正常',
        lastMaintenance: '2026-01-20',
        notes: '专业裁缝剪，锋利耐用',
        image: '',
        createTime: Date.now(),
        updateTime: Date.now()
      },
      {
        id: generateId(),
        name: '拆线器',
        type: '拆线器',
        brand: '无',
        price: 15.00,
        purchaseDate: '2025-12-20',
        supplier: '缝纫配件店',
        status: '正常',
        quantity: 3,
        notes: '拆线必备工具',
        image: '',
        createTime: Date.now(),
        updateTime: Date.now()
      },
      {
        id: generateId(),
        name: '卷尺',
        type: '测量工具',
        brand: '得力',
        length: 150,
        price: 12.00,
        purchaseDate: '2025-12-20',
        supplier: '文具店',
        status: '正常',
        notes: '软尺，测量身体尺寸',
        image: '',
        createTime: Date.now(),
        updateTime: Date.now()
      },
      {
        id: generateId(),
        name: '珠针',
        type: '定位工具',
        brand: '无',
        quantity: 100,
        price: 8.00,
        purchaseDate: '2025-12-25',
        supplier: '辅料市场',
        status: '正常',
        minimumStock: 50,
        notes: '彩色大头针，固定布料',
        image: '',
        createTime: Date.now(),
        updateTime: Date.now()
      }
    ];
    setStorageData(STORAGE_KEYS.TOOLS, sampleTools);
  }

  const sessions = getStorageData(STORAGE_KEYS.SEWING_SESSIONS);
  if (sessions.length === 0) {
    const sampleSessions = [
      {
        id: generateId(),
        projectName: '白色T恤制作',
        type: 'countdown',
        duration: 3600,
        actualDuration: 3200,
        startTime: Date.now() - 86400000,
        endTime: Date.now() - 86400000 + 3200000,
        completed: true,
        interrupted: false,
        notes: '完成了T恤的主体部分',
        createTime: Date.now() - 86400000
      },
      {
        id: generateId(),
        projectName: '牛仔裤缝制练习',
        type: 'countdown',
        duration: 1800,
        actualDuration: 1800,
        startTime: Date.now() - 172800000,
        endTime: Date.now() - 172800000 + 1800000,
        completed: true,
        interrupted: false,
        notes: '练习牛仔布的缝制技巧',
        createTime: Date.now() - 172800000
      },
      {
        id: generateId(),
        projectName: '连衣裙裁剪',
        type: 'stopwatch',
        actualDuration: 2400,
        startTime: Date.now() - 259200000,
        endTime: Date.now() - 259200000 + 2400000,
        completed: true,
        interrupted: false,
        notes: '完成了A字连衣裙的纸样裁剪',
        createTime: Date.now() - 259200000
      }
    ];
    setStorageData(STORAGE_KEYS.SEWING_SESSIONS, sampleSessions);
  }

  const purchases = getStorageData(STORAGE_KEYS.PURCHASES);
  if (purchases.length === 0) {
    const samplePurchases = [
      {
        id: generateId(),
        itemType: 'fabric',
        itemId: 'sample1',
        name: '纯棉布料 白色',
        quantity: 5.5,
        unit: '米',
        price: 25.00,
        totalAmount: 137.50,
        purchaseDate: '2026-01-15',
        supplier: '淘宝面料店',
        notes: '柔软舒适，适合做夏季服装',
        createTime: Date.now()
      },
      {
        id: generateId(),
        itemType: 'material',
        itemId: 'sample2',
        name: '缝纫线 白色',
        quantity: 10,
        unit: '卷',
        price: 5.00,
        totalAmount: 50.00,
        purchaseDate: '2026-01-10',
        supplier: '缝纫配件店',
        notes: '402号常用线',
        createTime: Date.now()
      },
      {
        id: generateId(),
        itemType: 'tool',
        itemId: 'sample3',
        name: '兄弟缝纫机 GS2700',
        quantity: 1,
        unit: '台',
        price: 1299.00,
        totalAmount: 1299.00,
        purchaseDate: '2025-12-01',
        supplier: '京东',
        notes: '家用电动缝纫机',
        createTime: Date.now()
      },
      {
        id: generateId(),
        itemType: 'pattern',
        itemId: 'sample4',
        name: '基本款T恤纸样',
        quantity: 1,
        unit: '份',
        price: 35.00,
        totalAmount: 35.00,
        purchaseDate: '2026-01-05',
        supplier: '网上下载',
        notes: '经典版型',
        createTime: Date.now()
      }
    ];
    setStorageData(STORAGE_KEYS.PURCHASES, samplePurchases);
  }

  const posts = getStorageData(STORAGE_KEYS.COMMUNITY_POSTS);
  if (posts.length === 0) {
    const samplePosts = [
      {
        id: generateId(),
        userId: 'user1',
        userName: '缝纫新手小唐',
        avatar: '',
        title: '第一次做T恤成功了！',
        content: '跟着教程做了第一件T恤，虽然针脚还有点歪，但是穿上去很合身！用的是纯棉布料，非常舒服。分享给大家看看成品～',
        images: [],
        tags: ['T恤', '新手作品', '成就感'],
        likes: 24,
        comments: 8,
        isLiked: false,
        createTime: Date.now() - 86400000,
        commentsList: [
          {
            id: generateId(),
            userId: 'user2',
            userName: '资深裁缝李姐',
            avatar: '',
            content: '做得很好！针脚再练习一下会更完美的。',
            createTime: Date.now() - 80000000
          },
          {
            id: generateId(),
            userId: 'user3',
            userName: '手工爱好者小王',
            avatar: '',
            content: '我也刚买了同款纸样，期待我的第一件作品！',
            createTime: Date.now() - 70000000
          }
        ]
      },
      {
        id: generateId(),
        userId: 'user4',
        userName: '资深裁缝李姐',
        avatar: '',
        title: '分享牛仔布缝制小技巧',
        content: '最近在做牛仔裤，发现牛仔布比较厚，缝制的时候有几个小技巧：\n1. 换用粗针（14号或16号）\n2. 适当调大针距\n3. 过厚的地方可以用手轮辅助\n4. 可以在压脚下垫一张纸帮助送布\n希望对大家有帮助！',
        images: [],
        tags: ['技巧分享', '牛仔布', '经验总结'],
        likes: 56,
        comments: 15,
        isLiked: false,
        createTime: Date.now() - 172800000,
        commentsList: [
          {
            id: generateId(),
            userId: 'user5',
            userName: '布艺达人张师傅',
            avatar: '',
            content: '非常实用的技巧！补充一下：牛仔布缝制前最好先预缩水。',
            createTime: Date.now() - 160000000
          }
        ]
      },
      {
        id: generateId(),
        userId: 'user6',
        userName: '手工爱好者小王',
        avatar: '',
        title: '新买的丝绸布料，准备做旗袍',
        content: '入手了一块红色真丝绸缎，手感超级好！准备用来做一件旗袍。有没有前辈分享一下丝绸布料的裁剪和缝制经验？怕剪坏了这块贵布料...',
        images: [],
        tags: ['丝绸', '旗袍', '求助'],
        likes: 32,
        comments: 12,
        isLiked: false,
        createTime: Date.now() - 259200000,
        commentsList: []
      }
    ];
    setStorageData(STORAGE_KEYS.COMMUNITY_POSTS, samplePosts);
  }
}
